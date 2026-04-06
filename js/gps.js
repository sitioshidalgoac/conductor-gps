// ════════════════════════════════════════
// conductor/js/gps.js
// GPS, Wake Lock, mapa propio, cola offline
// Depende de: db, driverUnit, driverName, myStatus,
//             lat, lng, spd, acc, watchId, sendInt, wakeLock (globals)
// ════════════════════════════════════════

// ── GPS principal ────────────────────────
function startGPS() {
  if (!navigator.geolocation) { toast('⚠️ GPS no disponible', 'warn'); return; }
  document.getElementById('gps-status').style.display = 'block';

  watchId = navigator.geolocation.watchPosition(
    onPos,
    onGPSErr,
    { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 }
  );

  sendInt = setInterval(sendPosConOffline, 5000);
}

function onPos(p) {
  lat = p.coords.latitude;
  lng = p.coords.longitude;
  spd = p.coords.speed ? Math.round(p.coords.speed * 3.6) : 0;
  acc = Math.round(p.coords.accuracy);

  document.getElementById('gps-status').style.display = 'none';
  document.getElementById('gc-lat').textContent = lat.toFixed(5);
  document.getElementById('gc-lng').textContent = lng.toFixed(5);
  document.getElementById('gc-spd').textContent = spd;
  document.getElementById('gc-acc').textContent = '±' + acc + 'm';
  document.getElementById('gc-st').textContent  = myStatus.toUpperCase();
  document.getElementById('gps-fecha').textContent = new Date().toLocaleTimeString('es-MX');

  const gpsEl = document.getElementById('sos-gps-txt');
  if (gpsEl) gpsEl.textContent = lat.toFixed(5) + ', ' + lng.toFixed(5);
  actualizarMiMapa(lat, lng, acc);
}

function onGPSErr(e) {
  document.getElementById('gps-status').style.display = 'block';
  document.getElementById('gps-status').textContent = '⚠️ ' + (
    e.code === 1 ? 'Permiso GPS denegado — ve a ajustes del celular' :
    e.code === 2 ? 'GPS no disponible — sal a un lugar abierto' :
    'Buscando señal GPS...'
  );
}

function sendPos() {
  if (!db || !driverUnit || lat === null) return;

  const now = firebase.database.ServerValue.TIMESTAMP;
  const ref = db.ref('unidades/' + driverUnit);

  ref.child('online').onDisconnect().set(false);
  ref.child('status').onDisconnect().set('OFFLINE');

  ref.update({
    id: driverUnit,
    name: driverName,
    lat, lng,
    speed: spd,
    accuracy: acc,
    status: String(myStatus).toUpperCase(),
    online: true,
    ultimoReporte: now,
    timestamp: now,
    lastSeen: now,
    'sync-check': firebase.database.ServerValue.TIMESTAMP
  }).catch(err => {
    console.error('❌ Error actualizando posición en Firebase:', err);
  });

  document.getElementById('conn-txt').textContent = 'EN LÍNEA';
  document.getElementById('conn-txt').style.color = '#00FF88';
}

// ── Wake Lock ────────────────────────────
async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen');
  } catch (e) {}
}

document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible' && driverUnit) requestWakeLock();
});

// ── Mapa GPS propio del conductor ─────────
var _miMapa     = null;
var _miMarcador = null;
var _miCirculo  = null;

function iniciarMiMapa() {
  if (_miMapa) return;
  const container = document.getElementById('mi-mapa-gps');
  if (!container) return;

  _miMapa = L.map('mi-mapa-gps', {
    center: [17.4594, -97.2253], zoom: 15,
    zoomControl: false, attributionControl: false,
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19
  }).addTo(_miMapa);

  const iconCond = L.divIcon({
    html: `<div style="
      width:48px;height:48px;border-radius:50%;
      background:linear-gradient(135deg,#C9A84C,#E8C97A);
      border:3px solid #fff;display:flex;align-items:center;
      justify-content:center;font-size:24px;
      box-shadow:0 4px 16px rgba(201,168,76,.6);
    ">🚕</div>`,
    iconSize: [48, 48], iconAnchor: [24, 24], className: ''
  });

  _miMarcador = L.marker([17.4594, -97.2253], { icon: iconCond })
    .addTo(_miMapa)
    .bindPopup('<b style="font-family:monospace">📍 Mi posición</b>');

  setTimeout(() => _miMapa.invalidateSize(), 200);
}

function actualizarMiMapa(pLat, pLng, precision) {
  if (!_miMapa) { iniciarMiMapa(); return; }
  const ll = [pLat, pLng];
  _miMarcador.setLatLng(ll);
  _miMapa.setView(ll, _miMapa.getZoom());
  if (_miCirculo) _miMapa.removeLayer(_miCirculo);
  if (precision < 200) {
    _miCirculo = L.circle(ll, {
      radius: precision, color: '#C9A84C',
      fillColor: '#C9A84C', fillOpacity: 0.08, weight: 1
    }).addTo(_miMapa);
  }
}

// ── Modo offline — cola de posiciones ────
const OFFLINE_KEY  = 'sh_pos_queue';
var _isOnline      = navigator.onLine;
var _offlineQueue  = [];

try {
  const saved = localStorage.getItem(OFFLINE_KEY);
  if (saved) _offlineQueue = JSON.parse(saved) || [];
} catch (_) {}

function _guardarColaOffline() {
  try { localStorage.setItem(OFFLINE_KEY, JSON.stringify(_offlineQueue.slice(-50))); } catch (_) {}
}

function _actualizarBannerOffline() {
  const banner = document.getElementById('offline-banner');
  const count  = document.getElementById('offline-count');
  if (!banner) return;
  if (!_isOnline) {
    banner.classList.add('show');
    if (count) count.textContent = _offlineQueue.length;
  } else {
    banner.classList.remove('show');
  }
}

function _enviarColaOffline() {
  if (!db || !driverUnit || _offlineQueue.length === 0) return;
  const lote = _offlineQueue.splice(0, 10);
  _guardarColaOffline();
  const updates = {};
  lote.forEach(pos => {
    updates['historial_pos/' + driverUnit + '/' + pos.ts] = pos;
  });
  db.ref().update(updates).catch(() => {
    _offlineQueue = [...lote, ..._offlineQueue];
    _guardarColaOffline();
  });
  if (_offlineQueue.length > 0) setTimeout(_enviarColaOffline, 2000);
  else toast('📡 ' + lote.length + ' posiciones sincronizadas', 'ok');
}

window.addEventListener('online', () => {
  _isOnline = true;
  _actualizarBannerOffline();
  _enviarColaOffline();
  toast('📡 Conexión restaurada', 'ok');
});

window.addEventListener('offline', () => {
  _isOnline = false;
  _actualizarBannerOffline();
  toast('📵 Sin conexión — guardando localmente', 'warn');
});

/** Wrapper de sendPos con soporte offline. Llamado cada 5 s por setInterval. */
function sendPosConOffline() {
  if (!lat || !lng) return;
  const payload = {
    id: driverUnit, name: driverName,
    lat, lng, speed: spd, accuracy: acc,
    status: myStatus, ts: Date.now(),
  };

  if (!_isOnline || !db) {
    _offlineQueue.push(payload);
    _guardarColaOffline();
    _actualizarBannerOffline();
    return;
  }

  if (db && driverUnit) {
    db.ref('unidades/' + driverUnit).update({
      ...payload,
      online: true,
      ultimoReporte: firebase.database.ServerValue.TIMESTAMP,
      timestamp:     firebase.database.ServerValue.TIMESTAMP,
      lastSeen:      firebase.database.ServerValue.TIMESTAMP,
    }).catch(() => {
      _offlineQueue.push(payload);
      _guardarColaOffline();
    });
  }
}
