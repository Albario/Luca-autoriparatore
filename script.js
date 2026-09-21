// ========== AUTENTICAZIONE ==========
// ⚠️ SOSTITUISCI QUESTO HASH con il tuo (generato da https://emn178.github.io/online-tools/sha256.html)
const PASSWORD_HASH = 'a3a3e110f5bce3211d1d265f3ace7fab88dce16019db6062082347f8e1677c21';

// Controllo login all'avvio
(async function checkAuth() {
  const logged = sessionStorage.getItem('officina_logged');
  if (logged === 'ok') {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('appContainer').style.display = 'block';
    initApp();
  } else {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('appContainer').style.display = 'none';
    document.getElementById('loginPassword').focus();
  }
})();

async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function tentaLogin() {
  const pwd = document.getElementById('loginPassword').value;
  const hash = await sha256(pwd);
  if (hash === PASSWORD_HASH) {
    sessionStorage.setItem('officina_logged', 'ok');
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('appContainer').style.display = 'block';
    initApp();
  } else {
    const err = document.getElementById('loginError');
    err.textContent = '❌ Password errata';
    document.getElementById('loginPassword').value = '';
    document.getElementById('loginPassword').focus();
    setTimeout(() => err.textContent = '', 3000);
  }
}

function logout() {
  if (!confirm('Vuoi uscire?')) return;
  sessionStorage.removeItem('officina_logged');
  location.reload();
}

// ========== DATABASE ==========
const DB_KEY = 'officina_db_v2';
let db = loadDB();

function loadDB() {
  const raw = localStorage.getItem(DB_KEY);
  if (raw) {
    try { 
      const d = JSON.parse(raw);
      if (!d.preventivi) d.preventivi = [];
      if (!d.nextId) d.nextId = 1;
      return d;
    } catch(e) {}
  }
  return { clienti: [], auto: [], interventi: [], preventivi: [], nextId: 1 };
}

function saveDB() {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
  updateHeader();
}

function newId() { return db.nextId++; }

// ========== UTIL ==========
function fmtDate(d) {
  if (!d) return '-';
  const dt = new Date(d);
  return dt.toLocaleDateString('it-IT', { day:'2-digit', month:'2-digit', year:'numeric' });
}

function fmtKm(k) {
  if (k === null || k === undefined || k === '') return '-';
  return Number(k).toLocaleString('it-IT') + ' km';
}

function fmtEuro(v) {
  if (v === null || v === undefined || v === '') return '-';
  return '€ ' + Number(v).toFixed(2).replace('.', ',');
}

function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const now = new Date(); now.setHours(0,0,0,0);
  const d = new Date(dateStr); d.setHours(0,0,0,0);
  return Math.round((d - now) / 86400000);
}

// ========== NAVIGAZIONE ==========
const tabs = document.querySelectorAll('.tab');
let currentTab = 'dashboard';
let currentClienteId = null;
let currentSubTab = 'auto';

tabs.forEach(t => t.addEventListener('click', () => {
  tabs.forEach(x => x.classList.remove('active'));
  t.classList.add('active');
  currentTab = t.dataset.tab;
  showView('view-' + currentTab);
  renderCurrent();
}));

function showView(viewId) {
  document.querySelectorAll('[id^="view-"]').forEach(v => v.style.display = 'none');
  document.getElementById(viewId).style.display = 'block';
}

function updateHeader() {
  const oggi = new Date().toLocaleDateString('it-IT', { weekday:'long', day:'numeric', month:'long' });
  document.getElementById('headerSub').textContent =
    oggi.charAt(0).toUpperCase() + oggi.slice(1) + ' • ' +
    db.clienti.length + ' clienti • ' + db.auto.length + ' auto';
}

// ========== MODAL ==========
function openModal(html) {
  document.getElementById('modalContent').innerHTML = html;
  document.getElementById('modal').classList.add('show');
}

function closeModal() {
  document.getElementById('modal').classList.remove('show');
}

document.getElementById('modal').addEventListener('click', e => {
  if (e.target.id === 'modal') closeModal();
});

// ========== CLIENTI CRUD ==========
function openClienteModal(id = null) {
  const c = id ? db.clienti.find(x => x.id === id) : { nome:'', cognome:'', telefono:'', email:'', indirizzo:'', note:'' };
  openModal(`
    <h2>${id ? 'Modifica' : 'Nuovo'} Cliente</h2>
    <label>Nome</label>
    <input id="f_nome" value="${escapeHtml(c.nome)}" placeholder="Mario">
    <label>Cognome</label>
    <input id="f_cognome" value="${escapeHtml(c.cognome)}" placeholder="Rossi">
    <label>Telefono</label>
    <input id="f_telefono" value="${escapeHtml(c.telefono)}" type="tel" placeholder="+39 333 1234567">
    <label>Email</label>
    <input id="f_email" value="${escapeHtml(c.email)}" type="email">
    <label>Indirizzo</label>
    <input id="f_indirizzo" value="${escapeHtml(c.indirizzo)}">
    <label>Note</label>
    <textarea id="f_note" rows="2">${escapeHtml(c.note)}</textarea>
    <div class="btn-row">
      <button class="btn btn-primary" onclick="saveCliente(${id || 'null'})">💾 Salva</button>
      ${id ? `<button class="btn btn-danger" onclick="deleteCliente(${id})">🗑️ Elimina</button>` : ''}
      <button class="btn btn-secondary" onclick="closeModal()">Annulla</button>
    </div>
  `);
}

function saveCliente(id) {
  const data = {
    nome: document.getElementById('f_nome').value.trim(),
    cognome: document.getElementById('f_cognome').value.trim(),
    telefono: document.getElementById('f_telefono').value.trim(),
    email: document.getElementById('f_email').value.trim(),
    indirizzo: document.getElementById('f_indirizzo').value.trim(),
    note: document.getElementById('f_note').value.trim()
  };
  if (!data.nome && !data.cognome) { alert('Inserisci almeno nome o cognome'); return; }
  if (id) {
    Object.assign(db.clienti.find(x => x.id === id), data);
  } else {
    db.clienti.push({ id: newId(), ...data, createdAt: new Date().toISOString() });
  }
  saveDB();
  closeModal();
  if (id && currentClienteId === id) renderSchedaCliente();
  else renderCurrent();
}

function deleteCliente(id) {
  if (!confirm('Eliminare il cliente e TUTTI i dati collegati (auto, interventi, preventivi)?')) return;
  const autoIds = db.auto.filter(a => a.clienteId === id).map(a => a.id);
  db.interventi = db.interventi.filter(i => !autoIds.includes(i.autoId));
  db.preventivi = db.preventivi.filter(p => p.clienteId !== id);
  db.auto = db.auto.filter(a => a.clienteId !== id);
  db.clienti = db.clienti.filter(c => c.id !== id);
  saveDB();
  closeModal();
  if (currentClienteId === id) {
    currentClienteId = null;
    switchToTab('clienti');
  } else {
    renderCurrent();
  }
}

// ========== AUTO CRUD ==========
function openAutoModal(id = null, prefillClienteId = null) {
  const a = id ? db.auto.find(x => x.id === id) : { marca:'', modello:'', targa:'', anno:'', km:'', clienteId: prefillClienteId || currentClienteId || '', note:'', telaio:'' };
  const opts = db.clienti.map(c => `<option value="${c.id}" ${c.id == a.clienteId ? 'selected' : ''}>${escapeHtml(c.nome + ' ' + c.cognome)}</option>`).join('');
  openModal(`
    <h2>${id ? 'Modifica' : 'Nuova'} Auto</h2>
    <label>Cliente *</label>
    <select id="f_clienteId">
      <option value="">-- Seleziona --</option>
      ${opts}
    </select>
    <label>Marca</label>
    <input id="f_marca" value="${escapeHtml(a.marca)}" placeholder="Fiat">
    <label>Modello</label>
    <input id="f_modello" value="${escapeHtml(a.modello)}" placeholder="Panda">
    <label>Targa</label>
    <input id="f_targa" value="${escapeHtml(a.targa)}" placeholder="AB123CD" style="text-transform:uppercase">
    <label>Telaio (VIN) - opzionale</label>
    <input id="f_telaio" value="${escapeHtml(a.telaio)}" placeholder="ZFA...">
    <label>Anno</label>
    <input id="f_anno" value="${escapeHtml(a.anno)}" type="number" placeholder="2018">
    <label>Chilometri attuali</label>
    <input id="f_km" value="${escapeHtml(a.km)}" type="number" placeholder="85000">
    <label>Note</label>
    <textarea id="f_note" rows="2">${escapeHtml(a.note)}</textarea>
    <div class="btn-row">
      <button class="btn btn-primary" onclick="saveAuto(${id || 'null'})">💾 Salva</button>
      ${id ? `<button class="btn btn-danger" onclick="deleteAuto(${id})">🗑️ Elimina</button>` : ''}
      <button class="btn btn-secondary" onclick="closeModal()">Annulla</button>
    </div>
  `);
}

function saveAuto(id) {
  const data = {
    clienteId: parseInt(document.getElementById('f_clienteId').value),
    marca: document.getElementById('f_marca').value.trim(),
    modello: document.getElementById('f_modello').value.trim(),
    targa: document.getElementById('f_targa').value.trim().toUpperCase(),
    telaio: document.getElementById('f_telaio').value.trim().toUpperCase(),
    anno: document.getElementById('f_anno').value,
    km: document.getElementById('f_km').value,
    note: document.getElementById('f_note').value.trim()
  };
  if (!data.clienteId) { alert('Seleziona un cliente'); return; }
  if (id) {
    Object.assign(db.auto.find(x => x.id === id), data);
  } else {
    db.auto.push({ id: newId(), ...data, createdAt: new Date().toISOString() });
  }
  saveDB();
  closeModal();
  if (currentClienteId === data.clienteId) renderSchedaCliente();
  else renderCurrent();
}

function deleteAuto(id) {
  if (!confirm('Eliminare l\'auto e tutti i suoi interventi?')) return;
  const auto = db.auto.find(a => a.id === id);
  db.interventi = db.interventi.filter(i => i.autoId !== id);
  db.auto = db.auto.filter(a => a.id !== id);
  saveDB();
  closeModal();
  if (auto && currentClienteId === auto.clienteId) renderSchedaCliente();
  else renderCurrent();
}

// ========== INTERVENTI CRUD ==========
function openInterventoModal(id = null, prefillAutoId = null) {
  const i = id ? db.interventi.find(x => x.id === id) : { 
    autoId: prefillAutoId || '', 
    tipo:'manutenzione', 
    data: new Date().toISOString().slice(0,10), 
    km:'', 
    descrizione:'', 
    pezzi:'', 
    costoManodopera:'',
    costoPezzi:'',
    prossimoData:'', 
    prossimoKm:'', 
    note:'' 
  };
  
  // Filtra auto: se sono dentro una scheda cliente, mostra solo le sue auto
  let autoList = db.auto;
  if (currentClienteId) autoList = autoList.filter(a => a.clienteId === currentClienteId);
  
  const opts = autoList.map(a => {
    const c = db.clienti.find(x => x.id === a.clienteId);
    const cn = c ? ` (${c.nome} ${c.cognome})` : '';
    return `<option value="${a.id}" ${a.id == i.autoId ? 'selected' : ''}>${escapeHtml(a.marca + ' ' + a.modello + ' ' + a.targa)}${cn}</option>`;
  }).join('');
  
  const costoTot = (Number(i.costoManodopera) || 0) + (Number(i.costoPezzi) || 0);
  
  openModal(`
    <h2>${id ? 'Modifica' : 'Nuovo'} Intervento</h2>
    <label>Auto *</label>
    <select id="f_autoId">
      <option value="">-- Seleziona --</option>
      ${opts}
    </select>
    <label>Tipo</label>
    <select id="f_tipo">
      <option value="manutenzione" ${i.tipo==='manutenzione'?'selected':''}>🛠️ Manutenzione (tagliando)</option>
      <option value="riparazione" ${i.tipo==='riparazione'?'selected':''}>🔧 Riparazione</option>
      <option value="diagnosi" ${i.tipo==='diagnosi'?'selected':''}>🔍 Diagnosi / Controllo</option>
      <option value="revisione" ${i.tipo==='revisione'?'selected':''}>📋 Revisione</option>
      <option value="altro" ${i.tipo==='altro'?'selected':''}>📦 Altro</option>
    </select>
    <label>Data</label>
    <input id="f_data" type="date" value="${i.data}">
    <label>Chilometri al momento dell'intervento</label>
    <input id="f_km" type="number" value="${escapeHtml(i.km)}">
    <label>Descrizione lavoro</label>
    <textarea id="f_descrizione" rows="3" placeholder="Cosa è stato fatto...">${escapeHtml(i.descrizione)}</textarea>
    <label>Pezzi ricambi usati</label>
    <textarea id="f_pezzi" rows="2" placeholder="Filtro olio, olio 5W30...">${escapeHtml(i.pezzi)}</textarea>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px">
      <div>
        <label>Costo manodopera (€)</label>
        <input id="f_costoManodopera" type="number" step="0.01" value="${escapeHtml(i.costoManodopera)}" oninput="aggiornaTotale()">
      </div>
      <div>
        <label>Costo pezzi (€)</label>
        <input id="f_costoPezzi" type="number" step="0.01" value="${escapeHtml(i.costoPezzi)}" oninput="aggiornaTotale()">
      </div>
    </div>
    <div style="background:#f0f9ff; padding:10px; border-radius:8px; margin-bottom:10px; text-align:right">
      <strong>Totale: <span id="totalePreview">${fmtEuro(costoTot)}</span></strong>
    </div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px">
      <div>
        <label>Prossimo - Data</label>
        <input id="f_prossimoData" type="date" value="${i.prossimoData}">
      </div>
      <div>
        <label>Prossimo - Km</label>
        <input id="f_prossimoKm" type="number" value="${escapeHtml(i.prossimoKm)}">
      </div>
    </div>
    <label>Note</label>
    <textarea id="f_note" rows="2">${escapeHtml(i.note)}</textarea>
    <div class="btn-row">
      <button class="btn btn-primary" onclick="saveIntervento(${id || 'null'})">💾 Salva</button>
      ${id ? `<button class="btn btn-danger" onclick="deleteIntervento(${id})">🗑️ Elimina</button>` : ''}
      <button class="btn btn-secondary" onclick="closeModal()">Annulla</button>
    </div>
  `);
}

function aggiornaTotale() {
  const m = Number(document.getElementById('f_costoManodopera').value) || 0;
  const p = Number(document.getElementById('f_costoPezzi').value) || 0;
  document.getElementById('totalePreview').textContent = fmtEuro(m + p);
}

function saveIntervento(id) {
  const data = {
    autoId: parseInt(document.getElementById('f_autoId').value),
    tipo: document.getElementById('f_tipo').value,
    data: document.getElementById('f_data').value,
    km: document.getElementById('f_km').value,
    descrizione: document.getElementById('f_descrizione').value.trim(),
    pezzi: document.getElementById('f_pezzi').value.trim(),
    costoManodopera: document.getElementById('f_costoManodopera').value,
    costoPezzi: document.getElementById('f_costoPezzi').value,
    costo: (Number(document.getElementById('f_costoManodopera').value) || 0) + (Number(document.getElementById('f_costoPezzi').value) || 0),
    prossimoData: document.getElementById('f_prossimoData').value,
    prossimoKm: document.getElementById('f_prossimoKm').value,
    note: document.getElementById('f_note').value.trim()
  };
  if (!data.autoId) { alert('Seleziona un\'auto'); return; }
  if (id) {
    Object.assign(db.interventi.find(x => x.id === id), data);
  } else {
    db.interventi.push({ id: newId(), ...data, createdAt: new Date().toISOString() });
  }
  // aggiorna km auto
  if (data.km) {
    const auto = db.auto.find(a => a.id === data.autoId);
    if (auto && (!auto.km || Number(data.km) > Number(auto.km))) {
      auto.km = data.km;
    }
  }
  saveDB();
  closeModal();
  // torna alla scheda cliente se pertinente
  const auto = db.auto.find(a => a.id === data.autoId);
  if (auto && currentClienteId === auto.clienteId) renderSchedaCliente();
  else renderCurrent();
}

function deleteIntervento(id) {
  if (!confirm('Eliminare l\'intervento?')) return;
  const int = db.interventi.find(i => i.id === id);
  db.interventi = db.interventi.filter(i => i.id !== id);
  saveDB();
  closeModal();
  if (int) {
    const auto = db.auto.find(a => a.id === int.autoId);
    if (auto && currentClienteId === auto.clienteId) renderSchedaCliente();
    else renderCurrent();
  }
}

// ========== PREVENTIVI CRUD ==========
function openPreventivoModal(id = null) {
  const p = id ? db.preventivi.find(x => x.id === id) : { 
    clienteId: currentClienteId || '', 
    autoId: '', 
    data: new Date().toISOString().slice(0,10),
    voci: [{ descrizione: '', quantita: 1, prezzo: 0 }],
    note: '',
    validoFino: '',
    stato: 'bozza'
  };
  
  const clientiOpts = db.clienti.map(c => 
    `<option value="${c.id}" ${c.id == p.clienteId ? 'selected' : ''}>${escapeHtml(c.nome + ' ' + c.cognome)}</option>`
  ).join('');
  
  // Auto del cliente selezionato
  let autoList = p.clienteId ? db.auto.filter(a => a.clienteId == p.clienteId) : db.auto;
  const autoOpts = autoList.map(a => {
    return `<option value="${a.id}" ${a.id == p.autoId ? 'selected' : ''}>${escapeHtml(a.marca + ' ' + a.modello + ' ' + a.targa)}</option>`;
  }).join('');

  const vociHtml = p.voci.map((v, idx) => `
    <div class="voce-row" data-idx="${idx}">
      <input placeholder="Descrizione" value="${escapeHtml(v.descrizione)}" onchange="updateVoce(${idx}, 'descrizione', this.value)">
      <input type="number" placeholder="Qtà" value="${v.quantita}" style="width:70px" onchange="updateVoce(${idx}, 'quantita', this.value)">
      <input type="number" step="0.01" placeholder="€" value="${v.prezzo}" style="width:90px" onchange="updateVoce(${idx}, 'prezzo', this.value)">
      <button class="btn btn-danger btn-sm" onclick="removeVoce(${idx})">×</button>
    </div>
  `).join('');

  openModal(`
    <h2>${id ? 'Modifica' : 'Nuovo'} Preventivo</h2>
    <label>Cliente *</label>
    <select id="f_clienteId" onchange="updatePrevField('clienteId', this.value); refreshAutoPrev()">
      <option value="">-- Seleziona --</option>
      ${clientiOpts}
    </select>
    <label>Auto</label>
    <select id="f_autoId" onchange="updatePrevField('autoId', this.value)">
      <option value="">-- Nessuna --</option>
      ${autoOpts}
    </select>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px">
      <div>
        <label>Data</label>
        <input type="date" id="f_data" value="${p.data}" onchange="updatePrevField('data', this.value)">
      </div>
      <div>
        <label>Valido fino al</label>
        <input type="date" id="f_validoFino" value="${p.validoFino}" onchange="updatePrevField('validoFino', this.value)">
      </div>
    </div>
    <label>Stato</label>
    <select id="f_stato" onchange="updatePrevField('stato', this.value)">
      <option value="bozza" ${p.stato==='bozza'?'selected':''}>📝 Bozza</option>
      <option value="inviato" ${p.stato==='inviato'?'selected':''}>📤 Inviato</option>
      <option value="accettato" ${p.stato==='accettato'?'selected':''}>✅ Accettato</option>
      <option value="rifiutato" ${p.stato==='rifiutato'?'selected':''}>❌ Rifiutato</option>
    </select>
    
    <label style="margin-top:10px">Voci del preventivo</label>
    <div id="vociContainer">${vociHtml}</div>
    <button class="btn btn-secondary btn-sm" onclick="addVoce()">+ Aggiungi voce</button>
    
    <label style="margin-top:16px">Note</label>
    <textarea id="f_note" rows="2" onchange="updatePrevField('note', this.value)">${escapeHtml(p.note)}</textarea>
    
    <div class="btn-row" style="margin-top:16px">
      <button class="btn btn-primary" onclick="savePreventivo(${id || 'null'})">💾 Salva</button>
      ${id ? `<button class="btn btn-success" onclick="generatePDF(${id})">📄 PDF</button>` : ''}
      ${id ? `<button class="btn btn-danger" onclick="deletePreventivo(${id})">🗑️</button>` : ''}
      <button class="btn btn-secondary" onclick="closeModal()">Annulla</button>
    </div>
  `);
  
  window.currentPreventivo = JSON.parse(JSON.stringify(p));
}

function refreshAutoPrev() {
  const cid = window.currentPreventivo.clienteId;
  const autoList = cid ? db.auto.filter(a => a.clienteId == cid) : db.auto;
  const sel = document.getElementById('f_autoId');
  const currentVal = window.currentPreventivo.autoId;
  sel.innerHTML = '<option value="">-- Nessuna --</option>' + 
    autoList.map(a => `<option value="${a.id}" ${a.id == currentVal ? 'selected' : ''}>${escapeHtml(a.marca + ' ' + a.modello + ' ' + a.targa)}</option>`).join('');
}

function updatePrevField(field, value) {
  window.currentPreventivo[field] = value;
}

function updateVoce(idx, field, value) {
  window.currentPreventivo.voci[idx][field] = field === 'descrizione' ? value : Number(value);
}

function addVoce() {
  window.currentPreventivo.voci.push({ descrizione: '', quantita: 1, prezzo: 0 });
  openPreventivoModal(window.currentPreventivo.id || null);
}

function removeVoce(idx) {
  window.currentPreventivo.voci.splice(idx, 1);
  openPreventivoModal(window.currentPreventivo.id || null);
}

function savePreventivo(id) {
  const p = window.currentPreventivo;
  if (!p.clienteId) { alert('Seleziona un cliente'); return; }
  if (!p.voci.length || p.voci.every(v => !v.descrizione)) { alert('Aggiungi almeno una voce'); return; }
  
  if (id) {
    Object.assign(db.preventivi.find(x => x.id === id), p);
  } else {
    db.preventivi.push({ id: newId(), ...p, createdAt: new Date().toISOString() });
  }
  saveDB();
  closeModal();
  if (currentClienteId == p.clienteId) renderSchedaCliente();
  else renderCurrent();
}

function deletePreventivo(id) {
  if (!confirm('Eliminare il preventivo?')) return;
  const p = db.preventivi.find(x => x.id === id);
  db.preventivi = db.preventivi.filter(x => x.id !== id);
  saveDB();
  closeModal();
  if (p && currentClienteId == p.clienteId) renderSchedaCliente();
  else renderCurrent();
}

function generatePDF(id) {
  const p = db.preventivi.find(x => x.id === id);
  if (!p) return;
  const cliente = db.clienti.find(c => c.id == p.clienteId);
  const auto = p.autoId ? db.auto.find(a => a.id == p.autoId) : null;
  const totale = p.voci.reduce((sum, v) => sum + (v.quantita * v.prezzo), 0);
  
  const html = `
    <div class="preventivo-doc">
      <h1>PREVENTIVO N. ${String(p.id).padStart(4, '0')}</h1>
      <p><strong>Data:</strong> ${fmtDate(p.data)}${p.validoFino ? ` &nbsp;|&nbsp; <strong>Valido fino al:</strong> ${fmtDate(p.validoFino)}` : ''}</p>
      
      <h3 style="margin-top:20px">Cliente</h3>
      <p><strong>${escapeHtml(cliente.nome + ' ' + cliente.cognome)}</strong></p>
      ${cliente.telefono ? `<p>Tel: ${escapeHtml(cliente.telefono)}</p>` : ''}
      ${cliente.email ? `<p>Email: ${escapeHtml(cliente.email)}</p>` : ''}
      ${cliente.indirizzo ? `<p>${escapeHtml(cliente.indirizzo)}</p>` : ''}
      
      ${auto ? `
        <h3 style="margin-top:20px">Veicolo</h3>
        <p>${escapeHtml(auto.marca + ' ' + auto.modello)} - Targa: <strong>${escapeHtml(auto.targa)}</strong></p>
        ${auto.anno ? `<p>Anno: ${escapeHtml(auto.anno)}</p>` : ''}
      ` : ''}
      
      <table>
        <thead>
          <tr><th>Descrizione</th><th style="width:60px">Qtà</th><th style="width:100px">Prezzo unit.</th><th style="width:100px">Totale</th></tr>
        </thead>
        <tbody>
          ${p.voci.map(v => `
            <tr>
              <td>${escapeHtml(v.descrizione)}</td>
              <td>${v.quantita}</td>
              <td>${fmtEuro(v.prezzo)}</td>
              <td>${fmtEuro(v.quantita * v.prezzo)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      <p class="total" style="text-align:right; margin-top:20px">TOTALE: ${fmtEuro(totale)}</p>
      
      ${p.note ? `<p style="margin-top:20px"><strong>Note:</strong><br>${escapeHtml(p.note).replace(/\n/g,'<br>')}</p>` : ''}
    </div>
  `;
  
  const template = document.getElementById('preventivoTemplate');
  template.innerHTML = html;
  template.style.display = 'block';
  
  setTimeout(() => {
    html2canvas(template.querySelector('.preventivo-doc'), { scale: 2, useCORS: true, logging: false }).then(canvas => {
      const imgData = canvas.toDataURL('image/png');
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`preventivo_${cliente.cognome}_${p.data}.pdf`);
      template.style.display = 'none';
      template.innerHTML = '';
    });
  }, 100);
}

// ========== RENDER PRINCIPALE ==========
function renderCurrent() {
  if (currentTab === 'dashboard') renderDashboard();
  else if (currentTab === 'clienti') renderListaClienti();
  else if (currentTab === 'ricambi') renderRicambi();
  else if (currentTab === 'impostazioni') renderImpostazioni();
}

function switchToTab(tabName) {
  currentTab = tabName;
  tabs.forEach(x => {
    x.classList.toggle('active', x.dataset.tab === tabName);
  });
  showView('view-' + tabName);
  renderCurrent();
}

// ========== DASHBOARD ==========
function renderDashboard() {
  const v = document.getElementById('view-dashboard');
  const totClienti = db.clienti.length;
  const totAuto = db.auto.length;
  const totInterventi = db.interventi.length;
  const incassoTot = db.interventi.reduce((s,i) => s + (Number(i.costo) || 0), 0);

  const prossimi = [];
  db.interventi.forEach(i => {
    const auto = db.auto.find(a => a.id === i.autoId);
    if (!auto) return;
    const cliente = db.clienti.find(c => c.id === auto.clienteId);
    if (i.prossimoData) {
      const d = daysUntil(i.prossimoData);
      if (d !== null && d <= 30) prossimi.push({ ...i, auto, cliente, alertType: 'data', daysLeft: d });
    }
    if (i.prossimoKm && auto.km) {
      const diff = Number(i.prossimoKm) - Number(auto.km);
      if (diff <= 1000) prossimi.push({ ...i, auto, cliente, alertType: 'km', kmLeft: diff });
    }
  });

  const ultimi = [...db.interventi].sort((a,b) => (b.data||'').localeCompare(a.data||'')).slice(0, 5);

  v.innerHTML = `
    <div class="stats">
      <div class="stat"><div class="num">${totClienti}</div><div class="lbl">Clienti</div></div>
      <div class="stat"><div class="num">${totAuto}</div><div class="lbl">Auto</div></div>
      <div class="stat"><div class="num">${totInterventi}</div><div class="lbl">Interventi</div></div>
      <div class="stat"><div class="num">${fmtEuro(incassoTot)}</div><div class="lbl">Incassi totali</div></div>
    </div>

    ${prossimi.length ? `
      <div class="card">
        <h3>⚠️ Prossimi interventi (${prossimi.length})</h3>
        ${prossimi.map(p => {
          const alert = p.alertType === 'data'
            ? (p.daysLeft < 0 ? `<span style="color:var(--danger)">Scaduto da ${-p.daysLeft}gg</span>` : `Tra ${p.daysLeft}gg`)
            : (p.kmLeft < 0 ? `<span style="color:var(--danger)">Superati di ${-p.kmLeft}km</span>` : `Tra ${p.kmLeft}km`);
          return `
            <div class="item" style="cursor:pointer" onclick="apriSchedaCliente(${p.cliente.id})">
              <div class="item-head">
                <div>
                  <div class="item-title">${escapeHtml(p.cliente.nome + ' ' + p.cliente.cognome)}</div>
                  <div class="item-sub">${escapeHtml(p.auto.marca + ' ' + p.auto.modello)} • ${p.auto.targa} • <span class="badge ${p.tipo}">${p.tipo}</span></div>
                </div>
                <div style="text-align:right;font-size:0.8rem">${alert}</div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    ` : ''}

    <div class="card">
      <h3>🕐 Ultimi interventi</h3>
      ${ultimi.length ? ultimi.map(i => {
        const auto = db.auto.find(a => a.id === i.autoId);
        const cliente = auto ? db.clienti.find(c => c.id === auto.clienteId) : null;
        if (!cliente) return '';
        return `
          <div class="item" style="cursor:pointer" onclick="apriSchedaCliente(${cliente.id})">
            <div class="item-head">
              <div>
                <div class="item-title">${escapeHtml(cliente.nome + ' ' + cliente.cognome)}</div>
                <div class="item-sub">${auto ? escapeHtml(auto.marca + ' ' + auto.modello) : '?'} • ${fmtDate(i.data)} • <span class="badge ${i.tipo}">${i.tipo}</span></div>
              </div>
              <div style="font-weight:600">${fmtEuro(i.costo)}</div>
            </div>
          </div>
        `;
      }).join('') : '<div class="empty"><div class="empty-icon">📭</div>Nessun intervento registrato</div>'}
    </div>
  `;
}

// ========== LISTA CLIENTI (con ricerca globale) ==========
function renderListaClienti() {
  const v = document.getElementById('view-clienti');
  const search = (window.searchClienti || '').toLowerCase().trim();
  
  // Ricerca globale: cerca in clienti, auto (targa/telaio), interventi
  let risultati = [];
  
  if (!search) {
    // Mostra tutti i clienti ordinati
    risultati = [...db.clienti].sort((a,b) => (a.cognome + a.nome).localeCompare(b.cognome + b.nome));
    v.innerHTML = `
      <input class="search" placeholder="🔍 Cerca cliente, targa, telaio..." value="" oninput="window.searchClienti=this.value; renderListaClienti()">
      <button class="btn btn-primary btn-block" onclick="openClienteModal()" style="margin-bottom:16px">+ Nuovo cliente</button>
      ${risultati.length ? risultati.map(c => renderCardCliente(c)).join('') : '<div class="empty"><div class="empty-icon">👥</div>Nessun cliente</div>'}
    `;
    return;
  }
  
  // Cerca in clienti
  db.clienti.forEach(c => {
    const txt = (c.nome + ' ' + c.cognome + ' ' + c.telefono + ' ' + c.email).toLowerCase();
    if (txt.includes(search)) risultati.push({ type: 'cliente', data: c });
  });
  
  // Cerca in auto (targa/telaio/marca/modello)
  db.auto.forEach(a => {
    const c = db.clienti.find(x => x.id === a.clienteId);
    if (!c) return;
    const txt = (a.marca + ' ' + a.modello + ' ' + a.targa + ' ' + a.telaio + ' ' + c.nome + ' ' + c.cognome).toLowerCase();
    if (txt.includes(search)) {
      // evita duplicati se cliente già trovato
      if (!risultati.some(r => r.type === 'cliente' && r.data.id === c.id)) {
        risultati.push({ type: 'cliente', data: c, matchInfo: `trovato via auto: ${a.targa}` });
      }
    }
  });
  
  v.innerHTML = `
    <input class="search" placeholder="🔍 Cerca cliente, targa, telaio..." value="${escapeHtml(search)}" oninput="window.searchClienti=this.value; renderListaClienti()" autofocus>
    <button class="btn btn-primary btn-block" onclick="openClienteModal()" style="margin-bottom:16px">+ Nuovo cliente</button>
    ${risultati.length ? `
      <div style="font-size:0.85rem; color:var(--muted); margin-bottom:10px">${risultati.length} risultat${risultati.length === 1 ? 'o' : 'i'}</div>
      ${risultati.map(r => renderCardCliente(r.data, r.matchInfo)).join('')}
    ` : '<div class="empty"><div class="empty-icon">🔍</div>Nessun risultato per "' + escapeHtml(search) + '"</div>'}
  `;
}

function renderCardCliente(c, matchInfo = '') {
  const autoCount = db.auto.filter(a => a.clienteId === c.id).length;
  const intCount = db.interventi.filter(i => {
    const a = db.auto.find(x => x.id === i.autoId);
    return a && a.clienteId === c.id;
  }).length;
  const prevCount = db.preventivi.filter(p => p.clienteId === c.id).length;
  const ultimaAuto = db.auto.filter(a => a.clienteId === c.id).sort((a,b) => (b.createdAt||'').localeCompare(a.createdAt||''))[0];
  
  return `
    <div class="item" style="cursor:pointer" onclick="apriSchedaCliente(${c.id})">
      <div class="item-head">
        <div>
          <div class="item-title">${escapeHtml(c.nome + ' ' + c.cognome)}</div>
          <div class="item-sub">${escapeHtml(c.telefono || '')}</div>
          ${ultimaAuto ? `<div class="item-sub">🚗 ${escapeHtml(ultimaAuto.marca + ' ' + ultimaAuto.modello)} • ${escapeHtml(ultimaAuto.targa)}</div>` : ''}
          ${matchInfo ? `<div class="item-sub" style="color:var(--accent)">🔎 ${escapeHtml(matchInfo)}</div>` : ''}
        </div>
        <div style="text-align:right; font-size:0.75rem">
          <span class="badge">${autoCount} auto</span><br>
          <span class="badge">${intCount} lav.</span>
          ${prevCount ? `<br><span class="badge">${prevCount} prev.</span>` : ''}
        </div>
      </div>
    </div>
  `;
}

// ========== SCHEDA CLIENTE COMPLETA ==========
function apriSchedaCliente(id) {
  currentClienteId = id;
  currentSubTab = 'auto';
  showView('view-scheda-cliente');
  renderSchedaCliente();
}

function tornaAListaClienti() {
  currentClienteId = null;
  switchToTab('clienti');
}

function setSubTab(tab) {
  currentSubTab = tab;
  renderSchedaCliente();
}

function renderSchedaCliente() {
  const v = document.getElementById('view-scheda-cliente');
  const c = db.clienti.find(x => x.id === currentClienteId);
  if (!c) { tornaAListaClienti(); return; }
  
  const autoList = db.auto.filter(a => a.clienteId === c.id);
  const tuttiInterventi = [];
  autoList.forEach(a => {
    db.interventi.filter(i => i.autoId === a.id).forEach(i => {
      tuttiInterventi.push({ ...i, auto: a });
    });
  });
  tuttiInterventi.sort((a,b) => (b.data||'').localeCompare(a.data||''));
  
  const preventiviList = db.preventivi.filter(p => p.clienteId === c.id).sort((a,b) => (b.data||'').localeCompare(a.data||''));
  
  const incassoTot = tuttiInterventi.reduce((s,i) => s + (Number(i.costo) || 0), 0);
  
  let contentHtml = '';
  if (currentSubTab === 'auto') contentHtml = renderSubTabAuto(c, autoList);
  else if (currentSubTab === 'storico') contentHtml = renderSubTabStorico(c, tuttiInterventi);
  else if (currentSubTab === 'preventivi') contentHtml = renderSubTabPreventivi(c, preventiviList);
  
  v.innerHTML = `
    <button class="back-btn" onclick="tornaAListaClienti()">← Torna alla lista</button>
    
    <div class="scheda-header">
      <h2>${escapeHtml(c.nome + ' ' + c.cognome)}</h2>
      ${c.telefono ? `<div class="sub-info">📞 ${escapeHtml(c.telefono)}</div>` : ''}
      ${c.email ? `<div class="sub-info">✉️ ${escapeHtml(c.email)}</div>` : ''}
      ${c.indirizzo ? `<div class="sub-info">🏠 ${escapeHtml(c.indirizzo)}</div>` : ''}
      <div class="quick-actions">
        ${c.telefono ? `<a href="tel:${escapeHtml(c.telefono)}" class="btn">📞 Chiama</a>` : ''}
        ${c.email ? `<a href="mailto:${escapeHtml(c.email)}" class="btn">✉️ Email</a>` : ''}
        <button class="btn" onclick="openClienteModal(${c.id})">✏️ Modifica</button>
        <button class="btn" onclick="openPreventivoModal()">📄 Nuovo prev.</button>
      </div>
    </div>
    
    <div class="stats">
      <div class="stat"><div class="num">${autoList.length}</div><div class="lbl">Auto</div></div>
      <div class="stat"><div class="num">${tuttiInterventi.length}</div><div class="lbl">Interventi</div></div>
      <div class="stat"><div class="num">${preventiviList.length}</div><div class="lbl">Preventivi</div></div>
      <div class="stat"><div class="num">${fmtEuro(incassoTot)}</div><div class="lbl">Totale speso</div></div>
    </div>
    
    ${c.note ? `<div class="card"><h3>📝 Note</h3><p style="font-size:0.9rem">${escapeHtml(c.note)}</p></div>` : ''}
    
    <div class="sub-tabs">
      <div class="sub-tab ${currentSubTab==='auto'?'active':''}" onclick="setSubTab('auto')">🚗 Auto (${autoList.length})</div>
      <div class="sub-tab ${currentSubTab==='storico'?'active':''}" onclick="setSubTab('storico')">🕐 Storico (${tuttiInterventi.length})</div>
      <div class="sub-tab ${currentSubTab==='preventivi'?'active':''}" onclick="setSubTab('preventivi')">📄 Preventivi (${preventiviList.length})</div>
    </div>
    
    ${contentHtml}
  `;
}

function renderSubTabAuto(c, autoList) {
  if (!autoList.length) {
    return `
      <div class="empty">
        <div class="empty-icon">🚗</div>
        <p>Nessuna auto registrata</p>
        <button class="btn btn-primary" onclick="openAutoModal(null, ${c.id})" style="margin-top:10px">+ Aggiungi prima auto</button>
      </div>
    `;
  }
  
  return `
    <button class="btn btn-primary btn-block" onclick="openAutoModal(null, ${c.id})" style="margin-bottom:12px">+ Aggiungi auto</button>
    ${autoList.map(a => {
      const ultimi = db.interventi.filter(i => i.autoId === a.id).sort((x,y) => (y.data||'').localeCompare(x.data||'')).slice(0, 2);
      return `
        <div class="auto-card">
          <div class="auto-card-head">
            <div>
              <div class="item-title">${escapeHtml(a.marca + ' ' + a.modello)}</div>
              <div class="auto-info">
                <span>🔖 <b>${escapeHtml(a.targa)}</b></span>
                <span>📅 ${escapeHtml(a.anno || '?')}</span>
                <span>🛣️ ${fmtKm(a.km)}</span>
              </div>
              ${a.telaio ? `<div class="auto-info">VIN: ${escapeHtml(a.telaio)}</div>` : ''}
            </div>
            <div style="display:flex; flex-direction:column; gap:4px">
              <button class="btn btn-primary btn-sm" onclick="openInterventoModal(null, ${a.id})">+ Intervento</button>
              <button class="btn btn-secondary btn-sm" onclick="openAutoModal(${a.id})">✏️</button>
            </div>
          </div>
          ${a.note ? `<div class="auto-info" style="margin-top:6px; font-style:italic">${escapeHtml(a.note)}</div>` : ''}
          ${ultimi.length ? `
            <div style="margin-top:10px; padding-top:10px; border-top:1px solid var(--border)">
              <div style="font-size:0.75rem; color:var(--muted); margin-bottom:6px">Ultimi interventi:</div>
              ${ultimi.map(i => `
                <div style="font-size:0.85rem; padding:4px 0; display:flex; justify-content:space-between; gap:8px">
                  <span><span class="badge ${i.tipo}">${i.tipo}</span> ${fmtDate(i.data)}</span>
                  <span style="color:var(--muted)">${fmtEuro(i.costo)}</span>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      `;
    }).join('')}
  `;
}

function renderSubTabStorico(c, interventi) {
  const autoList = db.auto.filter(a => a.clienteId === c.id);
  const filterAuto = window.filterAutoCliente || 'tutti';
  
  let filtered = interventi;
  if (filterAuto !== 'tutti') {
    filtered = interventi.filter(i => i.auto.id == filterAuto);
  }
  
  return `
    ${autoList.length > 1 ? `
      <div class="toolbar">
        <button class="btn btn-sm ${filterAuto==='tutti'?'btn-primary':'btn-secondary'}" onclick="window.filterAutoCliente='tutti'; renderSchedaCliente()">Tutte le auto</button>
        ${autoList.map(a => `
          <button class="btn btn-sm ${filterAuto==a.id?'btn-primary':'btn-secondary'}" onclick="window.filterAutoCliente=${a.id}; renderSchedaCliente()">${escapeHtml(a.targa)}</button>
        `).join('')}
      </div>
    ` : ''}
    
    ${filtered.length ? `
      <div class="timeline">
        ${filtered.map(i => `
          <div class="timeline-item" onclick="showDettaglioIntervento(${i.id})">
            <div class="timeline-date">${fmtDate(i.data)} • ${fmtKm(i.km)}</div>
            <div class="timeline-title">
              ${autoList.length > 1 ? `<span style="color:var(--accent)">${escapeHtml(i.auto.targa)}</span> • ` : ''}
              <span class="badge ${i.tipo}">${i.tipo}</span>
            </div>
            <div class="timeline-meta">${escapeHtml(i.descrizione || 'Nessuna descrizione').slice(0, 100)}</div>
            <div style="margin-top:6px; font-weight:600; color:var(--primary)">${fmtEuro(i.costo)}</div>
          </div>
        `).join('')}
      </div>
    ` : '<div class="empty"><div class="empty-icon">🕐</div>Nessun intervento</div>'}
  `;
}

function renderSubTabPreventivi(c, preventivi) {
  if (!preventivi.length) {
    return `
      <div class="empty">
        <div class="empty-icon">📄</div>
        <p>Nessun preventivo</p>
        <button class="btn btn-primary" onclick="openPreventivoModal()" style="margin-top:10px">+ Crea preventivo</button>
      </div>
    `;
  }
  
  const statoLabel = { bozza: '📝 Bozza', inviato: '📤 Inviato', accettato: '✅ Accettato', rifiutato: '❌ Rifiutato' };
  const statoColor = { bozza: '#6b7280', inviato: '#1e40af', accettato: '#16a34a', rifiutato: '#dc2626' };
  
  return `
    <button class="btn btn-primary btn-block" onclick="openPreventivoModal()" style="margin-bottom:12px">+ Nuovo preventivo</button>
    ${preventivi.map(p => {
      const auto = p.autoId ? db.auto.find(a => a.id == p.autoId) : null;
      const totale = p.voci.reduce((s, v) => s + (v.quantita * v.prezzo), 0);
      return `
        <div class="item" style="cursor:pointer" onclick="openPreventivoModal(${p.id})">
          <div class="item-head">
            <div>
              <div class="item-title">Preventivo #${String(p.id).padStart(4, '0')}</div>
              <div class="item-sub">${fmtDate(p.data)}${auto ? ' • ' + escapeHtml(auto.marca + ' ' + auto.modello + ' ' + auto.targa) : ''}</div>
              <div style="margin-top:4px">
                <span style="font-size:0.75rem; color:${statoColor[p.stato]}; font-weight:600">${statoLabel[p.stato] || p.stato}</span>
              </div>
            </div>
            <div style="text-align:right">
              <div style="font-weight:700; font-size:1.1rem; color:var(--primary)">${fmtEuro(totale)}</div>
              <button class="btn btn-success btn-sm" onclick="event.stopPropagation(); generatePDF(${p.id})">📄 PDF</button>
            </div>
          </div>
        </div>
      `;
    }).join('')}
  `;
}

function showDettaglioIntervento(id) {
  const i = db.interventi.find(x => x.id === id);
  if (!i) return;
  const a = db.auto.find(x => x.id === i.autoId);
  openModal(`
    <h2><span class="badge ${i.tipo}">${i.tipo}</span> ${fmtDate(i.data)}</h2>
    <div class="detail-row"><span>🚗 Auto</span><span>${a ? escapeHtml(a.marca + ' ' + a.modello + ' ' + a.targa) : '-'}</span></div>
    <div class="detail-row"><span>🛣️ Km</span><span>${fmtKm(i.km)}</span></div>
    <div class="detail-row"><span>💰 Manodopera</span><span>${fmtEuro(i.costoManodopera)}</span></div>
    <div class="detail-row"><span>🔩 Pezzi</span><span>${fmtEuro(i.costoPezzi)}</span></div>
    <div class="detail-row"><span><b>Totale</b></span><span><b>${fmtEuro(i.costo)}</b></span></div>
    ${i.descrizione ? `<div class="detail-row"><span>📝 Lavoro</span><span>${escapeHtml(i.descrizione)}</span></div>` : ''}
    ${i.pezzi ? `<div class="detail-row"><span>🔩 Pezzi usati</span><span>${escapeHtml(i.pezzi)}</span></div>` : ''}
    ${i.prossimoData ? `<div class="detail-row"><span>📅 Prossimo (data)</span><span>${fmtDate(i.prossimoData)}</span></div>` : ''}
    ${i.prossimoKm ? `<div class="detail-row"><span>🛣️ Prossimo (km)</span><span>${fmtKm(i.prossimoKm)}</span></div>` : ''}
    ${i.note ? `<div class="detail-row"><span>📌 Note</span><span>${escapeHtml(i.note)}</span></div>` : ''}
    <div class="btn-row" style="margin-top:16px">
      <button class="btn btn-secondary" onclick="closeModal(); setTimeout(()=>openInterventoModal(${id}),100)">✏️ Modifica</button>
    </div>
  `);
}

// ========== RICAMBI ==========
function renderRicambi() {
  const v = document.getElementById('view-ricambi');
  v.innerHTML = `
    <div class="card">
      <h3>🔩 Ricerca Ricambi</h3>
      <label>Marca veicolo</label>
      <input id="ricerca_marca" placeholder="es. Fiat">
      <label>Modello</label>
      <input id="ricerca_modello" placeholder="es. Panda">
      <label>Anno</label>
      <input id="ricerca_anno" type="number" placeholder="es. 2018">
      <label>Tipo ricambio</label>
      <select id="ricerca_tipo">
        <option value="">-- Tutti --</option>
        <option value="filtro olio">Filtro olio</option>
        <option value="filtro aria">Filtro aria</option>
        <option value="filtro abitacolo">Filtro abitacolo</option>
        <option value="olio motore">Olio motore</option>
        <option value="pastiglie freni">Pastiglie freni</option>
        <option value="candele">Candele</option>
        <option value="batteria">Batteria</option>
      </select>
      <button class="btn btn-primary btn-block" onclick="cercaRicambi()">🔍 Cerca</button>
    </div>
    <div id="risultatiRicambi"></div>
  `;
}

function cercaRicambi() {
  const marca = document.getElementById('ricerca_marca').value.trim();
  const modello = document.getElementById('ricerca_modello').value.trim();
  const anno = document.getElementById('ricerca_anno').value;
  const tipo = document.getElementById('ricerca_tipo').value;
  const query = [marca, modello, anno, tipo].filter(x => x).join(' ');
  if (!query) { alert('Inserisci almeno un parametro'); return; }
  
  document.getElementById('risultatiRicambi').innerHTML = `
    <div class="card">
      <h3>🔍 Cerca: "${escapeHtml(query)}"</h3>
      <div class="btn-row" style="margin-top:10px">
        <a href="https://www.autodoc.it/ricambi-auto?${encodeURIComponent(query)}" target="_blank" class="btn btn-primary">🔧 AutoDoc</a>
        <a href="https://www.ebay.it/sch/i.html?_nkw=${encodeURIComponent(query + ' ricambio')}" target="_blank" class="btn btn-accent">🛒 eBay</a>
        <a href="https://www.amazon.it/s?k=${encodeURIComponent(query + ' ricambio auto')}" target="_blank" class="btn btn-success">📦 Amazon</a>
      </div>
    </div>
  `;
}

// ========== IMPOSTAZIONI ==========
function renderImpostazioni() {
  const v = document.getElementById('view-impostazioni');
  const size = new Blob([JSON.stringify(db)]).size;
  v.innerHTML = `
    <div class="card">
      <h3>🔐 Sessione</h3>
      <button class="btn btn-danger btn-block" onclick="logout()">🚪 Esci (logout)</button>
      <p class="item-sub" style="margin-top:8px">Dovrai reinserire la password</p>
    </div>
    <div class="card">
      <h3>💾 Backup dati</h3>
      <p class="item-sub" style="margin-bottom:10px">Dimensione: ${(size/1024).toFixed(1)} KB</p>
      <div class="btn-row">
        <button class="btn btn-primary" onclick="exportData()">📤 Esporta JSON</button>
        <button class="btn btn-accent" onclick="document.getElementById('importFile').click()">📥 Importa</button>
        <input type="file" id="importFile" accept=".json" style="display:none" onchange="importData(event)">
      </div>
    </div>
    <div class="card">
      <h3>🗑️ Zona pericolosa</h3>
      <button class="btn btn-danger" onclick="resetAll()">Cancella TUTTI i dati</button>
    </div>
    <div class="card">
      <h3>ℹ️ Info</h3>
      <div class="detail-row"><span>Versione</span><span>3.1 - Con login</span></div>
      <div class="detail-row"><span>Clienti</span><span>${db.clienti.length}</span></div>
      <div class="detail-row"><span>Auto</span><span>${db.auto.length}</span></div>
      <div class="detail-row"><span>Interventi</span><span>${db.interventi.length}</span></div>
      <div class="detail-row"><span>Preventivi</span><span>${db.preventivi.length}</span></div>
    </div>
  `;
}

function exportData() {
  const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'officina_backup_' + new Date().toISOString().slice(0,10) + '.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);
      if (!data.clienti || !data.auto || !data.interventi) throw new Error('Formato non valido');
      if (!confirm('Sostituire i dati attuali?')) return;
      db = data;
      if (!db.nextId) db.nextId = 1;
      if (!db.preventivi) db.preventivi = [];
      saveDB();
      alert('✅ Importato');
      renderCurrent();
    } catch(err) { alert('❌ ' + err.message); }
  };
  reader.readAsText(file);
}

function resetAll() {
  if (!confirm('Cancellare TUTTO?')) return;
  if (!confirm('ULTIMA possibilità!')) return;
  db = { clienti: [], auto: [], interventi: [], preventivi: [], nextId: 1 };
  saveDB();
  renderCurrent();
}

// ========== INIT ==========
function initApp() {
  updateHeader();
  renderCurrent();
}