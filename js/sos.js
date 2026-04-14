// ════════════════════════════════════════
// conductor/js/sos.js
// Sistema de alerta SOS del conductor
// Depende de: db, driverUnit, driverName, lat, lng, myStatus (globals)
// ════════════════════════════════════════

function openSOS()  { document.getElementById('sos-modal').classList.add('show'); }
function closeSOS() { document.getElementById('sos-modal').classList.remove('show'); }

function confirmSOS() {
  closeSOS();
  myStatus = 'SOS';
  document.getElementById('sos-activo').style.display = 'flex';

  if (db && driverUnit) {
    db.ref('unidades/' + driverUnit).update({
      status:        'sos',
      estado:        'sos',
      sosActivadoEn: firebase.database.ServerValue.TIMESTAMP
    }).then(() => {
      console.log('🚨 SOS actualizado en Firebase');
    }).catch(err => {
      console.error('❌ Error enviando SOS:', err);
    });

    db.ref('alertas_sos/' + driverUnit).set({
      unit:      driverUnit,
      name:      driverName,
      lat:       lat || 0,
      lng:       lng || 0,
      timestamp: firebase.database.ServerValue.TIMESTAMP
    }).catch(err => {
      console.error('❌ Error registrando alerta SOS:', err);
    });
  }

  toast('🚨 SOS enviado — Base Central notificada', 'danger');
}

// Referencia guardada para poder hacer .off() en logout
var _sosResetRef = null;

function listenSOSReset() {
  if (!db || !driverUnit) return;
  if (_sosResetRef) { _sosResetRef.off(); _sosResetRef = null; } // guard anti-duplicado
  _sosResetRef = db.ref('unidades/' + driverUnit + '/status');
  _sosResetRef.on('value', snap => {
    const s = snap.val();
    if (s && String(s).toUpperCase() !== 'SOS' && myStatus === 'SOS') {
      myStatus = String(s).toUpperCase(); // estado local siempre en mayúsculas
      document.getElementById('sos-activo').style.display = 'none';
      document.querySelectorAll('.st-btn').forEach(b => b.classList.toggle('on', b.dataset.st === myStatus));
      toast('✅ SOS desactivado por Base Central', 'ok');
    }
  });
}

/** Llamar desde doLogout() para evitar memory leaks */
function cleanupSOSListeners() {
  if (_sosResetRef) { _sosResetRef.off(); _sosResetRef = null; }
}
