// ════════════════════════════════════════
// conductor/js/viaje.js
// Estado del conductor, lógica de viajes,
// mapa de viaje, calificaciones, panel v6
// Depende de: db, driverUnit, driverName, lat, lng, spd, acc,
//             viajeActivo, historial, tripViajes, totalKm,
//             myStatus (globals en index.html)
// ════════════════════════════════════════

// ── Estado del conductor ─────────────────
function setStatus(s) {
  const prev            = myStatus;
  const statusUpperCase = String(s).trim().toUpperCase();

  if (!['LIBRE', 'OCUPADO', 'DESCANSO', 'SOS'].includes(statusUpperCase)) {
    console.error('❌ Status inválido:', s);
    toast('⚠️ Status inválido', 'warn');
    return;
  }

  // Capturar fin de viaje (OCUPADO → otro)
  if (prev === 'OCUPADO' && statusUpperCase !== 'OCUPADO' && viajeActivo) {
    if (lat !== null && lng !== null) {
      const inicio     = viajeActivo.startTime;
      const fin        = Date.now();
      const durMinutos = Math.max(1, Math.round((fin - inicio) / 60000));
      const distancia  = calcDist(viajeActivo.startLat, viajeActivo.startLng, lat, lng);

      const viaje = {
        id:       historial.length + 1,
        inicio:   firebase.database.ServerValue.TIMESTAMP,
        fin:      firebase.database.ServerValue.TIMESTAMP,
        fecha:    new Date(inicio).toLocaleDateString('es-MX'),
        horaIni:  new Date(inicio).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        horaFin:  new Date(fin).toLocaleTimeString('es-MX',   { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        duracion: durMinutos,
        distancia: Math.max(0, distancia).toFixed(1),
        latIni: viajeActivo.startLat, lngIni: viajeActivo.startLng,
        latFin: lat,                  lngFin: lng,
        estado: 'completado'
      };

      historial.unshift(viaje);
      tripViajes++;
      totalKm += parseFloat(viaje.distancia);

      document.getElementById('pf-viajes').textContent = tripViajes;
      const espViajesEl = document.getElementById('esp-viajes');
      const espKmEl     = document.getElementById('esp-km');
      if (espViajesEl) espViajesEl.textContent = tripViajes;
      if (espKmEl)     espKmEl.textContent     = totalKm.toFixed(0);
      document.getElementById('pf-km').textContent = totalKm.toFixed(1);
      renderHistorial();

      if (db && driverUnit) {
        const viajePath = 'historial_viajes/' + driverUnit + '/' + viaje.id;
        db.ref(viajePath).set(viaje).then(() => {
          toast('✅ Viaje registrado en bitácora', 'ok');
        }).catch(err => {
          console.error('❌ RTDB error en setStatus/historial_viajes — code:', err.code, '| message:', err.message, err);
          toast('⚠️ Error guardando viaje: ' + err.message, 'warn');
        });
      }

      viajeActivo = null;
    } else {
      // GPS no disponible al finalizar — guardar con coordenadas de inicio y estado incompleto
      const inicio     = viajeActivo.startTime;
      const fin        = Date.now();
      const durMinutos = Math.max(1, Math.round((fin - inicio) / 60000));

      const viaje = {
        id:        historial.length + 1,
        inicio:    firebase.database.ServerValue.TIMESTAMP,
        fin:       firebase.database.ServerValue.TIMESTAMP,
        fecha:     new Date(inicio).toLocaleDateString('es-MX'),
        horaIni:   new Date(inicio).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        horaFin:   new Date(fin).toLocaleTimeString('es-MX',   { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        duracion:  durMinutos,
        distancia: '0.0',
        latIni: viajeActivo.startLat, lngIni: viajeActivo.startLng,
        latFin: viajeActivo.startLat, lngFin: viajeActivo.startLng,
        estado: 'incompleto' // GPS no disponible al finalizar
      };

      historial.unshift(viaje);
      tripViajes++;
      renderHistorial();

      if (db && driverUnit) {
        db.ref('historial_viajes/' + driverUnit + '/' + viaje.id).set(viaje).catch(() => {});
      }

      toast('⚠️ Sin GPS al finalizar — viaje guardado como incompleto', 'warn');
      viajeActivo = null;
    }
  }

  // Iniciar nuevo viaje (LIBRE → OCUPADO)
  if (statusUpperCase === 'OCUPADO' && prev !== 'OCUPADO') {
    if (lat !== null && lng !== null) {
      viajeActivo = { startTime: Date.now(), startLat: lat, startLng: lng };
    } else {
      toast('⚠️ Requiere señal GPS para estado OCUPADO', 'warn');
      return;
    }
  }

  // Actualizar estado localmente
  myStatus = statusUpperCase;
  document.getElementById('gc-st').textContent = statusUpperCase;
  document.querySelectorAll('.st-btn').forEach(b => {
    b.classList.toggle('on', b.dataset.st === statusUpperCase);
  });

  // Sincronizar con Firebase
  const estadoMap = { LIBRE: 'libre', OCUPADO: 'ocupado', DESCANSO: 'descanso', SOS: 'sos' };
  if (db && driverUnit) {
    db.ref('unidades/' + driverUnit).update({
      status:            statusUpperCase.toLowerCase(),
      estado:            estadoMap[statusUpperCase] || 'libre',
      ultimoEstado:      firebase.database.ServerValue.TIMESTAMP,
      lastStatusChange:  firebase.database.ServerValue.TIMESTAMP
    }).catch(err => {
      console.error('❌ RTDB error en setStatus/unidades — code:', err.code, '| message:', err.message, err);
      toast('⚠️ Error conectando con Base: ' + err.message, 'warn');
    });
  }
}

function calcDist(lat1, lng1, lat2, lng2) {
  if (!lat1 || !lng1 || !lat2 || !lng2 ||
      isNaN(lat1) || isNaN(lng1) || isNaN(lat2) || isNaN(lng2)) {
    return 0;
  }
  const R    = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a    = Math.sin(dLat / 2) ** 2 +
               Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
               Math.sin(dLng / 2) ** 2;
  const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.abs(dist) >= 0.001 ? dist : 0;
}

// ── Pantalla de espera ────────────────────
function mostrarPantallaEspera() {
  document.getElementById('pantalla-espera').style.display = 'flex';
  document.getElementById('esp-viajes').textContent = tripViajes || 0;
  document.getElementById('esp-km').textContent     = (totalKm || 0).toFixed(0);
}

function ocultarPantallaEspera() {
  document.getElementById('pantalla-espera').style.display = 'none';
}

function salirEspera() {
  ocultarPantallaEspera();
  doLogout();
}

// ── Módulo de viaje asignado + mapa ───────
var _viajeMap        = null;
var _viajeMarker     = null;
var _miMarker        = null;
var _viajeLinea      = null;
var _countdownInt    = null;
var _viajeActualId   = null;
var _viajeActualData = null;

function mostrarViajeAsignado(viajeData, viajeId) {
  _viajeActualId   = viajeId;
  _viajeActualData = viajeData;

  ocultarPantallaEspera();
  document.getElementById('modal-viaje').style.display = 'flex';

  const oLat  = viajeData.origen_lat || viajeData.lat || 17.4594;
  const oLng  = viajeData.origen_lng || viajeData.lng || -97.2253;
  const distM = lat && lng ? calcDist(lat, lng, oLat, oLng) * 1000 : 0;
  const distKm = (distM / 1000).toFixed(1);
  const etaMin = Math.max(1, Math.ceil(distM / 1000 / 0.417));

  document.getElementById('viaje-dist').textContent = distKm;
  document.getElementById('viaje-eta').textContent  = etaMin;
  document.getElementById('viaje-base').textContent = viajeData.baseId || 'B1';

  _iniciarMapaViaje(oLat, oLng);

  let segundos = 30;
  const countEl = document.getElementById('viaje-countdown');
  if (_countdownInt) clearInterval(_countdownInt);
  _countdownInt = setInterval(() => {
    segundos--;
    countEl.textContent = segundos;
    if (segundos <= 10) countEl.style.animation = 'countdownUrgente 0.5s ease-in-out infinite';
    if (segundos <= 0) { clearInterval(_countdownInt); rechazarViaje(); }
  }, 1000);

  toast('🚕 ¡Nuevo servicio disponible!', 'ok');
  try { navigator.vibrate([300, 100, 300, 100, 300]); } catch (_) {}
}

function _iniciarMapaViaje(oLat, oLng) {
  if (_viajeMap) {
    _viajeMap.setView([oLat, oLng], 15);
    if (_viajeMarker) _viajeMarker.setLatLng([oLat, oLng]);
    if (lat && lng && _miMarker) _miMarker.setLatLng([lat, lng]);
    _actualizarLineaViaje(oLat, oLng);
    return;
  }

  _viajeMap = L.map('viaje-map', {
    center: [oLat, oLng], zoom: 15,
    zoomControl: true, attributionControl: false,
  });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(_viajeMap);

  const iconCliente = L.divIcon({
    html: `<div style="width:44px;height:44px;border-radius:50%;
      background:linear-gradient(135deg,#C9A84C,#E8C97A);
      border:3px solid #fff;display:flex;align-items:center;justify-content:center;
      font-size:22px;box-shadow:0 4px 16px rgba(201,168,76,.5);">📍</div>`,
    iconSize: [44, 44], iconAnchor: [22, 22], className: ''
  });
  _viajeMarker = L.marker([oLat, oLng], { icon: iconCliente })
    .addTo(_viajeMap)
    .bindPopup('<b style="font-family:monospace">📍 Cliente aquí</b>').openPopup();

  if (lat && lng) {
    const iconConductor = L.divIcon({
      html: `<div style="width:44px;height:44px;border-radius:50%;
        background:linear-gradient(135deg,#3B82F6,#60A5FA);
        border:3px solid #fff;display:flex;align-items:center;justify-content:center;
        font-size:22px;box-shadow:0 4px 16px rgba(59,130,246,.5);">🚕</div>`,
      iconSize: [44, 44], iconAnchor: [22, 22], className: ''
    });
    _miMarker = L.marker([lat, lng], { icon: iconConductor })
      .addTo(_viajeMap)
      .bindPopup('<b style="font-family:monospace">🚕 Tu posición</b>');

    _actualizarLineaViaje(oLat, oLng);
    _viajeMap.fitBounds([[lat, lng], [oLat, oLng]], { padding: [40, 40] });
  }
}

function _actualizarLineaViaje(oLat, oLng) {
  if (!_viajeMap || !lat || !lng) return;
  if (_viajeLinea) _viajeMap.removeLayer(_viajeLinea);
  _viajeLinea = L.polyline([[lat, lng], [oLat, oLng]], {
    color: '#C9A84C', weight: 3, opacity: 0.7, dashArray: '8,6'
  }).addTo(_viajeMap);
}

function aceptarViaje() {
  if (!_viajeActualId || !db) return;
  if (_countdownInt) clearInterval(_countdownInt);

  const btn = document.getElementById('btn-aceptar-viaje');
  btn.textContent = '⏳ ACEPTANDO...';
  btn.disabled    = true;

  const solicitudRef = db.ref('solicitudes/' + _viajeActualId);
  const _vData = _viajeActualData || {};

  // Transacción atómica: solo el primer conductor que llegue puede aceptar.
  // Si otro conductor ya lo tomó, la transacción aborta sin modificar nada.
  solicitudRef.transaction(current => {
    if (!current) return current; // nodo eliminado — abortar
    if (current.estado !== 'enviado' || current.conductorId) {
      return; // undefined → abortar: ya fue tomado
    }
    return {
      ...current,
      estado:       'aceptado',
      conductorId:  driverUnit,
      unidadNumero: driverUnit,
      aceptadoEn:   firebase.database.ServerValue.TIMESTAMP,
    };
  }, (error, committed) => {
    if (error) {
      toast('❌ Error al aceptar: ' + error.message, 'danger');
      btn.textContent = '✓ ACEPTAR';
      btn.disabled    = false;
      return;
    }
    if (!committed) {
      // Otro conductor llegó primero
      toast('⚠️ Este viaje ya fue tomado por otro conductor', 'warn');
      cerrarModalViaje();
      mostrarPantallaEspera();
      return;
    }
    // Éxito — este conductor ganó la transacción
    setStatus('OCUPADO');
    cerrarModalViaje();
    toast('✅ Viaje aceptado — ¡En camino!', 'ok');
    viajeActivo = {
      startTime:     Date.now(),
      startLat: lat, startLng: lng,
      solicitudId:   _viajeActualId,
      clienteLat:    _vData.lat || _vData.clienteLat || null,
      clienteLng:    _vData.lng || _vData.clienteLng || null,
      clienteNombre: _vData.nombre || _vData.clienteNombre || 'Cliente',
      destino:       _vData.destino || '',
    };
    actualizarPanelViaje();
  });
}

function rechazarViaje() {
  if (_countdownInt) clearInterval(_countdownInt);
  cerrarModalViaje();
  mostrarPantallaEspera();
}

function cerrarModalViaje() {
  if (_countdownInt) { clearInterval(_countdownInt); _countdownInt = null; } // BUG #10
  document.getElementById('modal-viaje').style.display = 'none';
  document.getElementById('viaje-countdown').style.animation = '';
  _viajeActualId   = null;
  _viajeActualData = null;
}

// Referencias guardadas para poder hacer .off() en logout (BUG #4)
var _solicitudesRef1 = null;
var _solicitudesRef2 = null;

function escucharSolicitudesAsignadas() {
  if (!db || !driverUnit) return;

  // Limpiar listeners previos antes de registrar nuevos
  if (_solicitudesRef1) { _solicitudesRef1.off(); }
  if (_solicitudesRef2) { _solicitudesRef2.off(); }

  // Viajes asignados a este conductor. Firebase filtra en servidor por unidadId (índice declarado),
  // luego el callback descarta los que no estén en 'pendiente' — conjunto pequeño, aceptable.
  _solicitudesRef1 = db.ref('solicitudes')
    .orderByChild('unidadId')
    .equalTo(driverUnit);
  _solicitudesRef1.on('child_added', snap => {
    const v = snap.val();
    if (v && v.estado === 'enviado' && myStatus === 'LIBRE') mostrarViajeAsignado(v, snap.key);
  });

  // Viajes sin conductor asignado — índice 'estado' en DB evita descargar toda la colección.
  // limitToLast(1) garantiza que solo llega el viaje más reciente.
  _solicitudesRef2 = db.ref('solicitudes')
    .orderByChild('estado')
    .equalTo('enviado')
    .limitToLast(1);
  _solicitudesRef2.on('child_added', snap => {
    const v = snap.val();
    if (v && !v.unidadId && myStatus === 'LIBRE' && !_viajeActualId) mostrarViajeAsignado(v, snap.key);
  });
}

// Referencia guardada para poder hacer .off() en logout (BUG #5)
var _metricasRef = null;

// ── Calificaciones del conductor ──────────
function cargarCalificacionesConductor() {
  if (!db || !driverUnit) return;
  const email = 'unidad' + driverUnit.toLowerCase() + '@sitiohidalgo.mx';

  if (_metricasRef) _metricasRef.off();
  _metricasRef = db.ref('/metricas_conductores/' + email);
  _metricasRef.on('value', snap => {
    const m = snap.val();
    if (!m) return;
    const prom  = m.promedioEstrellas    || 0;
    const total = m.totalCalificaciones  || 0;

    const numEl = document.getElementById('pf-cal-num');
    if (numEl) numEl.textContent = prom.toFixed(1);

    const starsEl = document.getElementById('pf-cal-stars');
    if (starsEl) {
      const llenas = Math.round(prom);
      starsEl.textContent = '★'.repeat(llenas) + '☆'.repeat(5 - llenas);
      starsEl.style.color = prom >= 4 ? '#34D399' : prom >= 3 ? '#FCD34D' : '#F43F5E';
    }

    const subEl = document.getElementById('pf-cal-total');
    if (subEl) subEl.textContent = total + ' calificaciones recibidas';

    const alertasEl = document.getElementById('pf-cal-alertas');
    if (alertasEl) alertasEl.textContent = m.alertasRojas || 0;

    const bonosEl = document.getElementById('pf-cal-bonos');
    if (bonosEl) bonosEl.textContent = m.bonosAcumulados || 0;

    const totalEl = document.getElementById('pf-cal-total-num');
    if (totalEl) totalEl.textContent = total;
  });

  db.ref('/calificaciones')
    .orderByChild('conductorId').equalTo(email)
    .limitToLast(5)
    .once('value', snap => {
      const items = [];
      snap.forEach(c => items.unshift({ id: c.key, ...c.val() }));
      const lista = document.getElementById('pf-cal-historial');
      if (!lista || items.length === 0) return;
      lista.innerHTML = items.map(c => {
        const cls = c.estrellas >= 4 ? 'alta' : c.estrellas >= 3 ? 'media' : 'baja';
        const est = '★'.repeat(c.estrellas) + '☆'.repeat(5 - c.estrellas);
        const fch = new Date(c.timestamp).toLocaleString('es-MX', {
          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
        });
        const tags = (c.etiquetas || []).map(t => t.replace(/_/g, ' ')).join(' · ');
        return `<div class="cal-hist-item ${cls}">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:16px;letter-spacing:1px">${est}</span>
            <span style="font-family:var(--mono);font-size:9px;color:var(--silver3)">${fch}</span>
          </div>
          ${tags ? `<div style="font-family:var(--mono);font-size:9px;color:var(--silver3);margin-top:4px">${tags}</div>` : ''}
        </div>`;
      }).join('');
    });
}

// ── Panel viaje en curso (v6) ─────────────
function actualizarPanelViaje() {
  const panel = document.getElementById('panel-viaje-curso');
  if (!panel) return;
  if (viajeActivo && viajeActivo.solicitudId) {
    panel.style.display = 'block';
    const info = document.getElementById('viaje-cliente-info');
    if (info) info.textContent = viajeActivo.clienteNombre
      ? '👤 ' + viajeActivo.clienteNombre + (viajeActivo.destino ? ' → ' + viajeActivo.destino : '')
      : '🚖 Viaje en progreso';
  } else {
    panel.style.display = 'none';
  }
}

function btnLlegue() {
  if (!db || !viajeActivo || !viajeActivo.solicitudId) return; // BUG #3
  db.ref('solicitudes/' + viajeActivo.solicitudId).update({
    estado:    'conductor_llego',
    llegadaEn: firebase.database.ServerValue.TIMESTAMP
  }).then(() => toast('📍 Llegada notificada al cliente', 'ok'))
    .catch(e  => toast('❌ Error: ' + e.message, 'danger'));
  if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
}

function btnNavegar() {
  const dLat = viajeActivo && viajeActivo.clienteLat;
  const dLng = viajeActivo && viajeActivo.clienteLng;
  if (!dLat || !dLng) { toast('⚠️ Sin coordenadas del cliente', 'warn'); return; }

  // Intenta abrir Waze app; si no está instalada el navegador lo ignorará.
  // Solo si el intento falla (iframe trick) abre la versión web como fallback.
  const wazeApp = 'waze://?ll=' + dLat + ',' + dLng + '&navigate=yes';
  const wazeWeb = 'https://waze.com/ul?ll=' + dLat + ',' + dLng + '&navigate=yes';

  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.src = wazeApp;
  document.body.appendChild(iframe);

  // Si la app no abre en 1.5s, redirige a la web como fallback
  const fallback = setTimeout(() => {
    window.open(wazeWeb, '_blank');
  }, 1500);

  // Si la página pierde el foco, la app se abrió — cancelar el fallback
  window.addEventListener('blur', () => clearTimeout(fallback), { once: true });

  setTimeout(() => document.body.removeChild(iframe), 2000);
  toast('🗺️ Abriendo navegación GPS...', 'ok');
}

/** Llamar desde doLogout() para evitar memory leaks en listeners de viajes */
function cleanupViajeListeners() {
  if (_solicitudesRef1) { _solicitudesRef1.off(); _solicitudesRef1 = null; }
  if (_solicitudesRef2) { _solicitudesRef2.off(); _solicitudesRef2 = null; }
  if (_metricasRef)     { _metricasRef.off();     _metricasRef     = null; }
  if (_countdownInt)    { clearInterval(_countdownInt); _countdownInt = null; }
  _viajeActualId   = null;
  _viajeActualData = null;
}

function btnCompletado() {
  if (!db || !viajeActivo || !viajeActivo.solicitudId) { toast('⚠️ Sin viaje activo', 'warn'); return; } // BUG #8
  if (!confirm('¿Confirmar viaje completado?')) return;
  const duracion  = Math.round((Date.now() - (viajeActivo.startTime || Date.now())) / 60000);
  const distancia = (lat && viajeActivo.startLat)
    ? calcDist(viajeActivo.startLat, viajeActivo.startLng, lat, lng).toFixed(2)
    : 0;

  db.ref('solicitudes/' + viajeActivo.solicitudId).update({
    estado:       'completado',
    completadoEn: firebase.database.ServerValue.TIMESTAMP,
    duracionMin:  duracion,
    distanciaKm:  distancia
  }).then(() => {
    db.ref('historial_viajes/' + driverUnit).push({
      solicitudId:  viajeActivo.solicitudId,
      inicio:       viajeActivo.startTime || Date.now(),
      fin:          Date.now(),
      duracionMin:  duracion,
      distanciaKm:  distancia
    });
    toast('✅ ¡Viaje completado!', 'ok');
    setStatus('LIBRE');
    viajeActivo = null;
    actualizarPanelViaje();
  }).catch(e => toast('❌ Error: ' + e.message, 'danger'));
}
