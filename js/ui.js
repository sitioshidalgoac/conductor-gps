// ════════════════════════════════════════
// conductor/js/ui.js
// UI pura: navegación, toast, historial, radio/chat
// Depende de: db, driverUnit, unread (globals en index.html)
// ════════════════════════════════════════

// ── Navegación ───────────────────────────
function showPage(id, el) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-it').forEach(n => n.classList.remove('on'));
  document.getElementById('pg-' + id).classList.add('active');
  el.classList.add('on');
  if (id === 'chat') { unread = 0; updateUnreadBadge(); }
}

function updateUnreadBadge() {
  const el = document.querySelector('.nav-it:nth-child(3) .nav-lb');
  if (el) el.textContent = unread > 0 ? 'RADIO (' + unread + ')' : 'RADIO';
}

// ── Toast ────────────────────────────────
function toast(msg, type) {
  const tw = document.getElementById('tw');
  const t  = document.createElement('div');
  t.className = 't ' + (type || '');
  t.textContent = msg;
  tw.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

// ── Historial de viajes ───────────────────
function renderHistorial() {
  const el = document.getElementById('hist-list');

  document.getElementById('hist-dt').textContent = 'HOY · ' + tripViajes + ' VIAJES';

  if (!historial || historial.length === 0) {
    el.innerHTML = '<div style="text-align:center;color:var(--muted);padding:40px;font-family:var(--mono);font-size:12px;line-height:2.5">Los viajes aparecerán aquí<br>conforme avance el turno<br><br><span style="font-size:10px">Total: ' + totalKm.toFixed(1) + ' km</span></div>';
    return;
  }

  el.innerHTML = historial.map((v, idx) => {
    const dur     = v.duracion  || 0;
    const dist    = v.distancia || '0.0';
    const horaIni = v.horaIni   || '—';
    const horaFin = v.horaFin   || '—';
    const fecha   = v.fecha     || new Date().toLocaleDateString('es-MX');

    return `
      <div class="hist-item" style="opacity:${idx === 0 ? '1' : '0.7'};transition:opacity .3s">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span class="hist-id">VIAJE #${v.id || idx + 1}</span>
          <span style="font-family:var(--mono);font-size:9px;color:var(--muted);display:flex;gap:4px">
            <span>${v.estado === 'completado' ? '✅' : '⏳'}</span>
            <span>${fecha}</span>
          </span>
        </div>
        <div class="hist-grid">
          <div class="hist-box">
            <div class="hist-val">${dur}<small style="font-size:10px;color:var(--muted)">min</small></div>
            <div class="hist-lbl">DURACIÓN</div>
          </div>
          <div class="hist-box">
            <div class="hist-val">${dist}<small style="font-size:10px;color:var(--muted)">km</small></div>
            <div class="hist-lbl">DISTANCIA</div>
          </div>
        </div>
        <div class="hist-hora" style="text-align:center;font-size:11px">
          <span style="color:var(--green)">🕐 ${horaIni}</span>
          <span style="color:var(--muted);">→</span>
          <span style="color:var(--green)">${horaFin}</span>
        </div>
      </div>`;
  }).join('');
}

// ── Radio / Chat ─────────────────────────
// Referencias guardadas para poder hacer .off() en logout
var _msgRef   = null;
var _alertRef = null;

function subscribeMessages() {
  if (!db) return;
  _msgRef = db.ref('mensajes').limitToLast(30);
  _msgRef.on('child_added', snap => {
    const m = snap.val();
    if (!m) return;
    addMsg(m.from, m.text, m.from === driverUnit ? 'mine' : '');
    if (m.from !== driverUnit) {
      unread++;
      updateUnreadBadge();
    }
  });
}

function subscribeAlerts() {
  if (!db) return;
  _alertRef = db.ref('alertas_sos');
  _alertRef.on('child_added', snap => {
    const a = snap.val();
    if (!a || a.unit === driverUnit) return;
    addMsg('🚨 ALERTA', '¡SOS activado por ' + (a.name || a.unit) + '!', 'alert');
  });
}

/** Llamar desde doLogout() para evitar memory leaks */
function cleanupUIListeners() {
  if (_msgRef)   { _msgRef.off();   _msgRef   = null; }
  if (_alertRef) { _alertRef.off(); _alertRef = null; }
  unread = 0;
}

function addMsg(from, text, cls) {
  const area = document.getElementById('chat-area');
  const d    = document.createElement('div');
  d.className = 'msg ' + (cls || '');
  d.innerHTML = `<div class="msg-from">${from}</div><div class="msg-txt">${text}</div>`;
  area.appendChild(d);
  area.scrollTop = area.scrollHeight;
}

function sendChat() {
  const inp = document.getElementById('chat-in');
  const txt = inp.value.trim();
  if (!txt || !driverUnit) return;
  inp.value = '';
  if (db) db.ref('mensajes').push({ from: driverUnit, text: txt, ts: firebase.database.ServerValue.TIMESTAMP });
}

document.addEventListener('DOMContentLoaded', () => {
  const inp = document.getElementById('chat-in');
  if (inp) inp.addEventListener('keyup', e => { if (e.key === 'Enter') sendChat(); });
});
