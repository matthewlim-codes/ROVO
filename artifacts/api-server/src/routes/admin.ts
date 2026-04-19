import { Router } from "express";
import { db } from "@workspace/db";
import {
  clubsTable,
  clubCodesTable,
  tournamentsTable,
} from "@workspace/db/schema";

const router = Router();

const ADMIN_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>ReadySetGo Admin</title>
<style>
  :root {
    --bg: #F6F6F6;
    --card: #FFFFFF;
    --primary: #0A0A0A;
    --accent: #22C55E;
    --muted: #8A8A8A;
    --border: #E8E8E8;
    --danger: #EF4444;
    --radius: 12px;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: var(--bg); color: var(--primary); font-size: 14px; }
  header { background: var(--card); border-bottom: 1px solid var(--border); padding: 16px 24px; display: flex; align-items: center; gap: 12px; position: sticky; top: 0; z-index: 100; }
  .logo { width: 32px; height: 32px; background: var(--primary); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 16px; }
  header h1 { font-size: 17px; font-weight: 700; }
  header span { color: var(--muted); font-size: 13px; }
  .tabs { display: flex; gap: 0; border-bottom: 1px solid var(--border); background: var(--card); padding: 0 24px; overflow-x: auto; }
  .tab { padding: 14px 16px; cursor: pointer; font-size: 14px; font-weight: 500; color: var(--muted); border-bottom: 2px solid transparent; white-space: nowrap; user-select: none; }
  .tab.active { color: var(--primary); border-bottom-color: var(--primary); font-weight: 600; }
  .container { max-width: 900px; margin: 0 auto; padding: 24px; }
  .section { display: none; }
  .section.active { display: block; }
  .card { background: var(--card); border-radius: var(--radius); border: 1px solid var(--border); overflow: hidden; margin-bottom: 16px; }
  .card-header { padding: 16px 20px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
  .card-header h2 { font-size: 15px; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; padding: 10px 16px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted); border-bottom: 1px solid var(--border); }
  td { padding: 13px 16px; border-bottom: 1px solid var(--border); vertical-align: middle; }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: var(--bg); }
  .badge { display: inline-block; background: #F0FDF4; color: #22C55E; border: 1px solid #86EFAC; border-radius: 6px; padding: 2px 8px; font-size: 12px; font-weight: 600; letter-spacing: 0.5px; }
  .btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 8px; border: none; cursor: pointer; font-size: 13px; font-weight: 600; transition: opacity 0.15s; }
  .btn:hover { opacity: 0.8; }
  .btn-primary { background: var(--primary); color: #fff; }
  .btn-ghost { background: transparent; color: var(--primary); border: 1px solid var(--border); }
  .btn-danger { background: transparent; color: var(--danger); border: 1px solid var(--border); }
  .btn-sm { padding: 5px 11px; font-size: 12px; border-radius: 6px; }
  .actions { display: flex; gap: 6px; }
  .form-row { display: grid; gap: 12px; margin-bottom: 12px; }
  .form-row.cols-2 { grid-template-columns: 1fr 1fr; }
  .form-row.cols-3 { grid-template-columns: 1fr 1fr 1fr; }
  label { display: block; font-size: 12px; font-weight: 600; color: var(--muted); margin-bottom: 5px; }
  input, select, textarea { width: 100%; padding: 10px 12px; border: 1px solid var(--border); border-radius: 8px; font-size: 14px; background: var(--bg); outline: none; transition: border-color 0.15s; font-family: inherit; }
  input:focus, select:focus, textarea:focus { border-color: var(--primary); }
  .form-footer { display: flex; gap: 8px; margin-top: 16px; }
  .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 200; display: none; align-items: center; justify-content: center; padding: 16px; }
  .modal-backdrop.open { display: flex; }
  .modal { background: var(--card); border-radius: 16px; padding: 24px; width: 100%; max-width: 480px; max-height: 90vh; overflow-y: auto; }
  .modal h3 { font-size: 18px; font-weight: 700; margin-bottom: 20px; }
  .empty { padding: 40px; text-align: center; color: var(--muted); }
  .toast { position: fixed; bottom: 24px; right: 24px; background: var(--primary); color: #fff; padding: 12px 20px; border-radius: 10px; font-size: 14px; font-weight: 500; z-index: 1000; transform: translateY(80px); opacity: 0; transition: all 0.3s ease; pointer-events: none; }
  .toast.show { transform: translateY(0); opacity: 1; }
  @media (max-width: 600px) { .form-row.cols-2, .form-row.cols-3 { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<header>
  <div class="logo">R</div>
  <div>
    <h1>ReadySetGo Admin</h1>
  </div>
  <span style="margin-left:auto">Manage clubs, codes &amp; tournaments</span>
</header>

<div class="tabs">
  <div class="tab active" onclick="switchTab('clubs')">Clubs</div>
  <div class="tab" onclick="switchTab('codes')">Club Codes</div>
  <div class="tab" onclick="switchTab('tournaments')">Tournaments</div>
</div>

<div class="container">
  <!-- CLUBS -->
  <div id="tab-clubs" class="section active">
    <div class="card">
      <div class="card-header">
        <h2>Clubs</h2>
        <button class="btn btn-primary" onclick="openModal('club')">+ Add Club</button>
      </div>
      <table>
        <thead><tr><th>Name</th><th>City</th><th>State</th><th>Actions</th></tr></thead>
        <tbody id="clubs-table-body"><tr><td colspan="4" class="empty">Loading...</td></tr></tbody>
      </table>
    </div>
  </div>

  <!-- CODES -->
  <div id="tab-codes" class="section">
    <div class="card">
      <div class="card-header">
        <h2>Club Codes</h2>
        <button class="btn btn-primary" onclick="openModal('code')">+ Add Code</button>
      </div>
      <table>
        <thead><tr><th>Code</th><th>Club</th><th>Team Name</th><th>Actions</th></tr></thead>
        <tbody id="codes-table-body"><tr><td colspan="4" class="empty">Loading...</td></tr></tbody>
      </table>
    </div>
  </div>

  <!-- TOURNAMENTS -->
  <div id="tab-tournaments" class="section">
    <div class="card">
      <div class="card-header">
        <h2>Tournaments</h2>
        <button class="btn btn-primary" onclick="openModal('tournament')">+ Add Tournament</button>
      </div>
      <table>
        <thead><tr><th>Name</th><th>Location</th><th>Dates</th><th>Gender</th><th>Actions</th></tr></thead>
        <tbody id="tournaments-table-body"><tr><td colspan="5" class="empty">Loading...</td></tr></tbody>
      </table>
    </div>
  </div>
</div>

<!-- MODAL -->
<div id="modal" class="modal-backdrop" onclick="if(event.target===this)closeModal()">
  <div class="modal">
    <h3 id="modal-title">Add</h3>
    <div id="modal-body"></div>
    <div class="form-footer">
      <button class="btn btn-primary" id="modal-save" onclick="saveModal()">Save</button>
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
    </div>
  </div>
</div>

<div id="toast" class="toast"></div>

<script>
let currentTab = 'clubs';
let clubs = [], codes = [], tournaments = [];
let editingId = null, editingType = null;

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab').forEach((el, i) => {
    el.classList.toggle('active', ['clubs','codes','tournaments'][i] === tab);
  });
  document.querySelectorAll('.section').forEach(el => el.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
}

function toast(msg, error = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.background = error ? '#EF4444' : '#0A0A0A';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

async function api(method, path, body) {
  const res = await fetch('/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

async function loadAll() {
  [clubs, codes, tournaments] = await Promise.all([
    api('GET', '/clubs'),
    api('GET', '/club-codes'),
    api('GET', '/tournaments?includePast=true'),
  ]);
  renderClubs(); renderCodes(); renderTournaments();
}

function renderClubs() {
  const tb = document.getElementById('clubs-table-body');
  if (!clubs.length) { tb.innerHTML = '<tr><td colspan="4" class="empty">No clubs yet.</td></tr>'; return; }
  tb.innerHTML = clubs.map(c => \`<tr>
    <td>\${esc(c.name)}</td>
    <td>\${esc(c.city || '—')}</td>
    <td>\${esc(c.state || '—')}</td>
    <td><div class="actions">
      <button class="btn btn-ghost btn-sm" onclick="editClub('\${c.id}')">Edit</button>
      <button class="btn btn-danger btn-sm" onclick="deleteItem('club','\${c.id}')">Delete</button>
    </div></td>
  </tr>\`).join('');
}

function renderCodes() {
  const tb = document.getElementById('codes-table-body');
  if (!codes.length) { tb.innerHTML = '<tr><td colspan="4" class="empty">No codes yet.</td></tr>'; return; }
  tb.innerHTML = codes.map(c => \`<tr>
    <td><span class="badge">\${esc(c.code)}</span></td>
    <td>\${esc(c.clubName || '—')}</td>
    <td>\${esc(c.teamName)}</td>
    <td><div class="actions">
      <button class="btn btn-ghost btn-sm" onclick="editCode('\${c.id}')">Edit</button>
      <button class="btn btn-danger btn-sm" onclick="deleteItem('code','\${c.id}')">Delete</button>
    </div></td>
  </tr>\`).join('');
}

function renderTournaments() {
  const tb = document.getElementById('tournaments-table-body');
  if (!tournaments.length) { tb.innerHTML = '<tr><td colspan="5" class="empty">No tournaments yet.</td></tr>'; return; }
  tb.innerHTML = tournaments.map(t => \`<tr>
    <td>\${esc(t.name)}</td>
    <td>\${esc(t.location)}</td>
    <td>\${esc(t.dates)}<div style="font-size:11px;color:var(--muted);margin-top:2px">\${esc(t.startDate || '')} → \${esc(t.endDate || '')}</div></td>
    <td><span class="badge" style="background:#EEF2FF;color:#4F46E5;border-color:#C7D2FE">\${esc((t.gender||'coed').toUpperCase())}</span></td>
    <td><div class="actions">
      <button class="btn btn-ghost btn-sm" onclick="editTournament('\${t.id}')">Edit</button>
      <button class="btn btn-danger btn-sm" onclick="deleteItem('tournament','\${t.id}')">Delete</button>
    </div></td>
  </tr>\`).join('');
}

function clubOptions(selectedId = '') {
  return clubs.map(c => \`<option value="\${c.id}" \${c.id===selectedId?'selected':''}>\${esc(c.name)}</option>\`).join('');
}

function openModal(type, data = null) {
  editingType = type; editingId = data?.id ?? null;
  const modal = document.getElementById('modal');
  const title = document.getElementById('modal-title');
  const body = document.getElementById('modal-body');
  modal.classList.add('open');

  if (type === 'club') {
    title.textContent = data ? 'Edit Club' : 'Add Club';
    body.innerHTML = \`
      <div class="form-row cols-2"><div><label>Club Name *</label><input id="f-name" value="\${esc(data?.name||'')}"></div>
      <div><label>City</label><input id="f-city" value="\${esc(data?.city||'')}"></div></div>
      <div class="form-row"><div><label>State</label><input id="f-state" maxlength="2" value="\${esc(data?.state||'')}"></div></div>\`;
  } else if (type === 'code') {
    title.textContent = data ? 'Edit Club Code' : 'Add Club Code';
    body.innerHTML = \`
      <div class="form-row cols-2">
        <div><label>Code *</label><input id="f-code" value="\${esc(data?.code||'')}" style="text-transform:uppercase;letter-spacing:2px;font-weight:700"></div>
        <div><label>Team Name *</label><input id="f-team" value="\${esc(data?.teamName||'')}"></div>
      </div>
      <div class="form-row"><div><label>Club *</label><select id="f-club"><option value="">Select club...</option>\${clubOptions(data?.clubId)}</select></div></div>\`;
  } else if (type === 'tournament') {
    title.textContent = data ? 'Edit Tournament' : 'Add Tournament';
    body.innerHTML = \`
      <div class="form-row"><div><label>Name *</label><input id="f-name" value="\${esc(data?.name||'')}"></div></div>
      <div class="form-row cols-2">
        <div><label>Location *</label><input id="f-location" placeholder="e.g. Dallas, TX" value="\${esc(data?.location||'')}"></div>
        <div><label>Display Dates *</label><input id="f-dates" placeholder="e.g. Jan 10–12, 2026" value="\${esc(data?.dates||'')}"></div>
      </div>
      <div class="form-row cols-3">
        <div><label>Start Date *</label><input id="f-start-date" type="date" value="\${esc(data?.startDate||'')}"></div>
        <div><label>End Date *</label><input id="f-end-date" type="date" value="\${esc(data?.endDate||'')}"></div>
        <div><label>Gender *</label><select id="f-gender">
          <option value="girls" \${(data?.gender||'coed')==='girls'?'selected':''}>Girls</option>
          <option value="boys" \${(data?.gender||'coed')==='boys'?'selected':''}>Boys</option>
          <option value="coed" \${(data?.gender||'coed')==='coed'?'selected':''}>Coed</option>
        </select></div>
      </div>
      <div class="form-row"><div><label>Description</label><textarea id="f-description" rows="2">\${esc(data?.description||'')}</textarea></div></div>\`;
  }
}

function closeModal() {
  document.getElementById('modal').classList.remove('open');
  editingType = null; editingId = null;
}

function editClub(id) { openModal('club', clubs.find(c => c.id === id)); }
function editCode(id) { openModal('code', codes.find(c => c.id === id)); }
function editTournament(id) { openModal('tournament', tournaments.find(t => t.id === id)); }

async function saveModal() {
  try {
    let payload, path, method;
    if (editingType === 'club') {
      payload = { name: v('f-name'), city: v('f-city')||null, state: v('f-state')||null };
      path = editingId ? '/clubs/' + editingId : '/clubs';
      method = editingId ? 'PUT' : 'POST';
    } else if (editingType === 'code') {
      payload = { code: v('f-code').toUpperCase(), teamName: v('f-team'), clubId: v('f-club') };
      path = editingId ? '/club-codes/' + editingId : '/club-codes';
      method = editingId ? 'PUT' : 'POST';
    } else if (editingType === 'tournament') {
      payload = {
        name: v('f-name'),
        location: v('f-location'),
        dates: v('f-dates'),
        startDate: v('f-start-date'),
        endDate: v('f-end-date'),
        gender: v('f-gender') || 'coed',
        description: v('f-description')||null,
      };
      path = editingId ? '/tournaments/' + editingId : '/tournaments';
      method = editingId ? 'PUT' : 'POST';
    }
    await api(method, path, payload);
    toast(editingId ? 'Saved!' : 'Created!');
    closeModal();
    await loadAll();
  } catch (e) {
    toast(e.message, true);
  }
}

async function deleteItem(type, id) {
  if (!confirm('Are you sure?')) return;
  const paths = { club: '/clubs/', code: '/club-codes/', tournament: '/tournaments/' };
  try {
    await api('DELETE', paths[type] + id);
    toast('Deleted');
    await loadAll();
  } catch (e) {
    toast(e.message, true);
  }
}

function v(id) { return (document.getElementById(id)?.value || '').trim(); }
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

loadAll();
</script>
</body>
</html>`;

router.get("/admin", (req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.send(ADMIN_HTML);
});

export default router;
