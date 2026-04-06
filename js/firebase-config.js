// ════════════════════════════════════════
// FIREBASE CONFIG
// conductor/js/firebase-config.js
// Requiere: firebase-app-compat, firebase-database-compat,
//           firebase-auth-compat (cargados antes en el HTML)
// ════════════════════════════════════════

const FB = {
  apiKey:            "AIzaSyDEu6dOk9mUqXp52lyY6vBEm4GAsgU0ESU",
  authDomain:        "sitios-hidalgo-gps.firebaseapp.com",
  databaseURL:       "https://sitios-hidalgo-gps-default-rtdb.firebaseio.com",
  projectId:         "sitios-hidalgo-gps",
  storageBucket:     "sitios-hidalgo-gps.firebasestorage.app",
  messagingSenderId: "140903781731",
  appId:             "1:140903781731:web:2178219a57a3244db42f56"
};

// ════════════════════════════════════════
// REFERENCIA GLOBAL A LA BD
// (usada en todo el resto del código)
// ════════════════════════════════════════
var db = null;

// ════════════════════════════════════════
// INIT — arrancar Firebase al cargar
// ════════════════════════════════════════
(function init() {
  try {
    firebase.initializeApp(FB);
    db = firebase.database();
    console.log('✅ Firebase OK');
  } catch (e) {
    console.warn('Firebase error:', e.message);
  }
})();

// ════════════════════════════════════════
// MONITOR DE ESTADO (sincronización RTDB)
// ════════════════════════════════════════

// Referencia al intervalo, global para poder pararlo desde doLogout()
var statusMonitorInt = null;

/**
 * Escribe el estado inicial del conductor en /unidades/{id}
 * y arranca el monitor de sincronización.
 * Depende de: db, driverUnit, driverName (definidos en index.html)
 */
function initializeDriverStatus() {
  if (!db || !driverUnit) return;

  const ref = db.ref('unidades/' + driverUnit);
  const now = firebase.database.ServerValue.TIMESTAMP;

  ref.set({
    id:            driverUnit,
    name:          driverName,
    status:        'LIBRE',
    online:        true,
    lat:           0,
    lng:           0,
    speed:         0,
    accuracy:      0,
    conectadoEn:   now,
    timestamp:     now,
    ultimoReporte: now
  }).then(() => {
    console.log('✅ Estado inicial sincronizado en Firebase — LIBRE');
    startStatusMonitor();
  }).catch(err => {
    console.error('❌ Error inicializando estado:', err);
    toast('⚠️ Error de conexión inicial', 'warn');
  });
}

/**
 * Inicia un intervalo de 30 s que detecta y corrige desincronizaciones
 * entre el status local (myStatus) y el guardado en RTDB.
 */
function startStatusMonitor() {
  if (statusMonitorInt) clearInterval(statusMonitorInt);

  statusMonitorInt = setInterval(() => {
    if (!db || !driverUnit) return;

    db.ref('unidades/' + driverUnit + '/status').once('value', snap => {
      const fbStatus    = String(snap.val() || '').toUpperCase();
      const localStatus = String(myStatus).toUpperCase();

      if (fbStatus !== localStatus && fbStatus !== 'SOS' && localStatus !== 'SOS') {
        console.warn(`⚠️ Desincronización detectada: Firebase=${fbStatus}, Local=${localStatus}`);
        console.warn('🔄 Resintonizando...');

        db.ref('unidades/' + driverUnit).update({
          status:     localStatus,
          lastResync: firebase.database.ServerValue.TIMESTAMP
        }).then(() => {
          console.log('✅ Status resintonizado');
        }).catch(err => {
          console.error('❌ Error en resintonización:', err);
        });
      }
    });
  }, 30000);
}

/** Detiene el monitor de sincronización (llamado en doLogout). */
function stopStatusMonitor() {
  if (statusMonitorInt) {
    clearInterval(statusMonitorInt);
    statusMonitorInt = null;
  }
}
