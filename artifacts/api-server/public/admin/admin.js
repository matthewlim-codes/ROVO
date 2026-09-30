/* Rovo Admin client — tournament lifecycle, discovery, jobs, clubs */
const TAB_ORDER = [
  "published",
  "scheduled",
  "pending",
  "archived",
  "sources",
  "jobs",
  "clubs",
  "codes",
  "metrics",
  "feedback",
];

let clubs = [],
  codes = [],
  cityImages = [];
let editingId = null,
  editingType = null;

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toast(msg, err) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.style.background = err ? "#EF4444" : "#0A0A0A";
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2800);
}

async function api(method, path, body) {
  const opts = { method, headers: { "Content-Type": "application/json" } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch("/api" + path, opts);
  if (res.status === 204) return null;
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text };
  }
  if (!res.ok) throw new Error(data?.error || data?.message || res.statusText);
  return data;
}

function switchTab(tab, opts) {
  if (!TAB_ORDER.includes(tab)) tab = "published";
  document.querySelectorAll(".tab").forEach((el, i) => {
    el.classList.toggle("active", TAB_ORDER[i] === tab);
  });
  document.querySelectorAll(".section").forEach((el) => el.classList.remove("active"));
  const section = document.getElementById("tab-" + tab);
  if (section) section.classList.add("active");
  if (!opts || opts.updateHash !== false) {
    const next = "#" + tab;
    if (location.hash !== next) {
      history.replaceState(null, "", next);
    }
  }
  if (tab === "published") loadTournaments("published");
  if (tab === "scheduled") loadTournaments("approved");
  if (tab === "pending") loadTournaments("pending_review");
  if (tab === "archived") loadTournaments("archived");
  if (tab === "sources") loadSourcesTab();
  if (tab === "jobs") loadJobs();
  if (tab === "metrics") loadMetrics();
  if (tab === "feedback") loadFeedback();
  if (tab === "clubs") renderClubs();
  if (tab === "codes") renderCodes();
}

function tabFromHash() {
  const raw = (location.hash || "").replace(/^#/, "").trim();
  return TAB_ORDER.includes(raw) ? raw : null;
}

function statusBadge(status) {
  return `<span class="badge badge-${esc(status)}">${esc(status)}</span>`;
}

async function loadAll() {
  try {
    [clubs, codes, cityImages] = await Promise.all([
      api("GET", "/clubs"),
      api("GET", "/club-codes"),
      api("GET", "/city-images").catch(() => []),
    ]);
    renderClubs();
    renderCodes();
    await refreshSetupBanner();
    const initial = tabFromHash() || "published";
    switchTab(initial, { updateHash: true });
  } catch (e) {
    toast(e.message, true);
  }
}

window.addEventListener("hashchange", () => {
  const tab = tabFromHash();
  if (tab) switchTab(tab, { updateHash: false });
});

async function refreshSetupBanner() {
  try {
    const s = await api("GET", "/discovery/setup-status");
    const el = document.getElementById("setup-banner");
    if (!el) return;
    if (s.setupRequired) {
      el.style.display = "block";
      el.textContent = s.message;
    } else {
      el.style.display = "none";
    }
  } catch {
    /* ignore */
  }
}

async function loadTournaments(status) {
  const q = (document.getElementById("search-" + status)?.value || "").trim();
  const map = {
    published: "published",
    approved: "scheduled",
    pending_review: "pending",
    archived: "archived",
  };
  const tabKey = map[status] || status;
  const body = document.getElementById("tbody-" + tabKey);
  if (!body) return;
  body.innerHTML = `<tr><td colspan="6" class="empty">Loading…</td></tr>`;
  try {
    const rows = await api(
      "GET",
      `/tournaments/admin?status=${encodeURIComponent(status)}${q ? "&q=" + encodeURIComponent(q) : ""}`,
    );
    if (!rows.length) {
      body.innerHTML = `<tr><td colspan="6" class="empty">No ${esc(status)} tournaments.</td></tr>`;
      return;
    }
    body.innerHTML = rows
      .map((t) => {
        const actions = tournamentActions(t);
        return `<tr>
          <td><strong>${esc(t.name)}</strong>
            ${t.hasDiscrepancy ? '<div class="discrepancy">Discrepancy</div>' : ""}
            <div class="muted">${esc(t.organizer || "")}</div></td>
          <td>${esc(t.city || t.location)}<div class="muted">${esc(t.timezone)}</div></td>
          <td>${esc(t.startDate)} → ${esc(t.endDate)}
            <div class="muted">Publish: ${esc(t.expectedPublishDate || "—")}</div></td>
          <td>${statusBadge(t.status)}${t.hidden ? ' <span class="badge">hidden</span>' : ""}
            <div class="muted">Checked: ${t.lastSourceCheckAt ? esc(new Date(t.lastSourceCheckAt).toLocaleString()) : "—"}</div></td>
          <td>${esc((t.gender || "").toUpperCase())}</td>
          <td><div class="actions">${actions}</div></td>
        </tr>`;
      })
      .join("");
  } catch (e) {
    body.innerHTML = `<tr><td colspan="6" class="empty">${esc(e.message)}</td></tr>`;
  }
}

function tournamentActions(t) {
  const id = t.id;
  let html = `<button class="btn btn-ghost btn-sm" onclick="viewTournament('${id}')">View</button>`;
  if (t.status === "pending_review") {
    html += `<button class="btn btn-primary btn-sm" onclick="setStatus('${id}','approved')">Approve</button>`;
    html += `<button class="btn btn-danger btn-sm" onclick="setStatus('${id}','rejected')">Reject</button>`;
  }
  if (t.status === "approved") {
    html += `<button class="btn btn-primary btn-sm" onclick="setStatus('${id}','published')">Publish now</button>`;
  }
  if (t.status === "archived") {
    html += `<button class="btn btn-ghost btn-sm" onclick="setStatus('${id}','published')">Restore</button>`;
  }
  if (t.status === "published" || t.status === "approved") {
    html += `<button class="btn btn-ghost btn-sm" onclick="setStatus('${id}','archived')">Archive</button>`;
  }
  html += `<button class="btn btn-ghost btn-sm" onclick="toggleHide('${id}', ${!!t.hidden})">${t.hidden ? "Unhide" : "Hide"}</button>`;
  html += `<button class="btn btn-ghost btn-sm" onclick="editTournament('${id}')">Edit</button>`;
  return html;
}

async function viewTournament(id) {
  const rows = await api("GET", "/tournaments/admin?q=");
  const t = rows.find((x) => x.id === id);
  const evidence = await api("GET", `/tournaments/${id}/evidence`).catch(() => []);
  const body = document.getElementById("modal-body");
  document.getElementById("modal-title").textContent = t?.name || "Tournament";
  body.innerHTML = `
    <p class="muted" style="margin-bottom:12px">${statusBadge(t.status)} · expected publish ${esc(t.expectedPublishDate)}</p>
    ${t.hasDiscrepancy ? `<div class="setup-banner">${esc(t.discrepancyNotes || "Source differs from manual corrections")}</div>` : ""}
    <p><strong>Location:</strong> ${esc(t.location)}</p>
    <p><strong>Dates:</strong> ${esc(t.startDate)} → ${esc(t.endDate)} (${esc(t.timezone)})</p>
    <p><strong>URL:</strong> ${t.eventUrl ? `<a href="${esc(t.eventUrl)}" target="_blank" rel="noopener">Open</a>` : "—"}</p>
    <p><strong>Image credit:</strong> ${esc(t.imageCredit || "—")}</p>
    <h4 style="margin:16px 0 8px">Attendance evidence</h4>
    ${
      evidence.length
        ? `<table><thead><tr><th>Club/Team</th><th>Type</th><th>Verified</th><th>Source</th></tr></thead><tbody>${evidence
            .map(
              (e) => `<tr>
            <td>${esc(e.clubOrTeamName)}</td>
            <td>${esc(e.evidenceType)}</td>
            <td class="muted">${esc(new Date(e.verifiedAt).toLocaleString())}</td>
            <td><a href="${esc(e.sourceUrl)}" target="_blank" rel="noopener">Link</a></td>
          </tr>`,
            )
            .join("")}</tbody></table>`
        : `<div class="empty">No evidence recorded.</div>`
    }
    <div class="form-footer"><button class="btn btn-ghost" onclick="closeModal()">Close</button></div>`;
  document.getElementById("modal").classList.add("open");
}

async function setStatus(id, status) {
  try {
    let reason;
    if (status === "rejected") {
      reason = prompt("Rejection reason (optional)") || undefined;
    }
    await api("POST", `/tournaments/${id}/status`, { status, reason });
    toast("Updated to " + status);
    const active = document.querySelector(".tab.active");
    if (active) active.click();
  } catch (e) {
    toast(e.message, true);
  }
}

async function toggleHide(id, currentlyHidden) {
  try {
    await api("POST", `/tournaments/${id}/hide`, { hidden: !currentlyHidden });
    toast(currentlyHidden ? "Unhidden" : "Hidden");
    const active = document.querySelector(".tab.active");
    if (active) active.click();
  } catch (e) {
    toast(e.message, true);
  }
}

async function editTournament(id) {
  const rows = await api("GET", "/tournaments/admin");
  const t = rows.find((x) => x.id === id);
  if (!t) return;
  editingId = id;
  editingType = "tournament";
  document.getElementById("modal-title").textContent = "Edit tournament";
  document.getElementById("modal-body").innerHTML = `
    <div class="form-row"><div><label>Name</label><input id="f-name" value="${esc(t.name)}"></div></div>
    <div class="form-row cols-2">
      <div><label>Start</label><input id="f-start" type="date" value="${esc(t.startDate)}"></div>
      <div><label>End</label><input id="f-end" type="date" value="${esc(t.endDate)}"></div>
    </div>
    <div class="form-row cols-2">
      <div><label>Timezone</label><input id="f-tz" value="${esc(t.timezone)}"></div>
      <div><label>Gender</label><select id="f-gender">
        <option value="girls" ${t.gender === "girls" ? "selected" : ""}>Girls</option>
        <option value="boys" ${t.gender === "boys" ? "selected" : ""}>Boys</option>
        <option value="coed" ${t.gender === "coed" ? "selected" : ""}>Coed</option>
      </select></div>
    </div>
    <div class="form-row cols-2">
      <div><label>City</label><input id="f-city" value="${esc(t.city || "")}"></div>
      <div><label>State</label><input id="f-state" value="${esc(t.state || "")}"></div>
    </div>
    <div class="form-row"><div><label>Location</label><input id="f-location" value="${esc(t.location)}"></div></div>
    <div class="form-row"><div><label>Event URL</label><input id="f-url" value="${esc(t.eventUrl || "")}"></div></div>
    <div class="form-row"><div><label>Image alt / credit</label>
      <input id="f-alt" placeholder="Alt text" value="${esc(t.imageAltText || "")}">
      <input id="f-credit" style="margin-top:8px" placeholder="Credit / attribution" value="${esc(t.imageCredit || "")}">
    </div></div>
    <div class="form-row"><div><label>City image</label>
      <select id="f-city-image"><option value="">— none / placeholder —</option>
        ${cityImages.map((c) => `<option value="${c.id}" ${t.cityImageId === c.id ? "selected" : ""}>${esc(c.city)}, ${esc(c.state)} (${esc(c.attribution || "no attr")})</option>`).join("")}
      </select>
    </div></div>
    <div class="form-footer">
      <button class="btn btn-primary" onclick="saveTournamentEdit()">Save</button>
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
    </div>`;
  document.getElementById("modal").classList.add("open");
}

async function saveTournamentEdit() {
  try {
    const payload = {
      name: v("f-name"),
      startDate: v("f-start"),
      endDate: v("f-end"),
      timezone: v("f-tz"),
      gender: v("f-gender"),
      city: v("f-city") || null,
      state: v("f-state") || null,
      location: v("f-location"),
      eventUrl: v("f-url") || null,
      imageAltText: v("f-alt") || null,
      imageCredit: v("f-credit") || null,
      dates: `${v("f-start")} → ${v("f-end")}`,
      hasDiscrepancy: false,
    };
    await api("PUT", `/tournaments/${editingId}`, payload);
    const cityImageId = v("f-city-image") || null;
    await api("POST", `/tournaments/${editingId}/assign-city-image`, {
      cityImageId,
      imageAltText: payload.imageAltText,
      imageCredit: payload.imageCredit,
    });
    toast("Saved");
    closeModal();
    const active = document.querySelector(".tab.active");
    if (active) active.click();
  } catch (e) {
    toast(e.message, true);
  }
}

function v(id) {
  return document.getElementById(id)?.value?.trim() ?? "";
}

function closeModal() {
  document.getElementById("modal").classList.remove("open");
  editingId = null;
  editingType = null;
}

async function loadSourcesTab() {
  await refreshSetupBanner();
  const sourcesBody = document.getElementById("tbody-sources");
  try {
    const [sources, policy, adapters] = await Promise.all([
      api("GET", "/discovery-sources"),
      api("GET", "/discovery/policy"),
      api("GET", "/discovery/adapters"),
    ]);
    sourcesBody.innerHTML = sources.length
      ? sources
          .map(
            (s) => `<tr>
          <td>${esc(s.name)}<div class="muted">${esc(s.adapterKey)} · ${esc(s.kind)}</div></td>
          <td>${s.enabled ? "on" : "off"}</td>
          <td>${esc(s.healthStatus)}<div class="muted">${esc(s.lastError || "")}</div></td>
          <td class="muted">${s.lastSuccessAt ? esc(new Date(s.lastSuccessAt).toLocaleString()) : "—"}</td>
        </tr>`,
          )
          .join("")
      : `<tr><td colspan="4" class="empty">No discovery sources yet — click “Ensure NCVA + SCVA”.</td></tr>`;
    document.getElementById("policy-json").textContent = JSON.stringify(policy, null, 2);
    document.getElementById("policy-min-clubs").value = String(
      policy.minCaliforniaClubs ?? 1,
    );
    document.getElementById("policy-enabled").value = policy.enabled === false ? "false" : "true";
    document.getElementById("policy-require-reg").checked = !!policy.requireRegistrationConfirmed;
    const accepted = new Set(policy.acceptedEvidenceTypes || []);
    document.querySelectorAll('input[name="policy-ev"]').forEach((el) => {
      el.checked = accepted.has(el.value);
    });
    document.getElementById("adapters-list").innerHTML = adapters
      .map(
        (a) =>
          `<li><strong>${esc(a.key)}</strong> — ${esc(a.label)} ${a.implemented ? "(implemented)" : "(proposed)"}</li>`,
      )
      .join("");
  } catch (e) {
    toast(e.message, true);
  }
}

async function ensureDefaultSources() {
  try {
    const result = await api("POST", "/discovery-sources/ensure-defaults");
    toast(`Sources ready: ${(result.sources || []).map((s) => s.adapterKey).join(", ")}`);
    loadSourcesTab();
  } catch (e) {
    toast(e.message, true);
  }
}

async function savePolicy(ev) {
  ev.preventDefault();
  const accepted = [...document.querySelectorAll('input[name="policy-ev"]:checked')].map(
    (el) => el.value,
  );
  if (!accepted.length) {
    toast("Select at least one evidence type", true);
    return false;
  }
  try {
    const payload = {
      minCaliforniaClubs: Number(document.getElementById("policy-min-clubs").value),
      acceptedEvidenceTypes: accepted,
      requireRegistrationConfirmed: document.getElementById("policy-require-reg").checked,
      enabled: document.getElementById("policy-enabled").value === "true",
    };
    const saved = await api("PUT", "/discovery/policy", payload);
    document.getElementById("policy-json").textContent = JSON.stringify(saved, null, 2);
    toast("Policy saved");
  } catch (e) {
    toast(e.message, true);
  }
  return false;
}

async function addSource() {
  const name = prompt("Source name", "NCVA events");
  if (!name) return;
  const adapterKey = prompt(
    "Adapter key: ncva_calendar | scva_tournaments | manual_json",
    "ncva_calendar",
  );
  if (!adapterKey) return;
  try {
    let kind = "structured_calendar";
    let config = {};
    if (adapterKey === "manual_json") {
      kind = "manual_json";
      const url =
        prompt("HTTPS JSON feed URL (optional — leave blank for empty inline list)") ||
        "";
      config = url ? { url } : { events: [] };
    } else if (adapterKey === "ncva_calendar") {
      kind = "structured_calendar";
      config = {
        baseUrl: "https://ncva.com",
        calendarPageSlug: "events",
        genders: ["boys"],
        includePast: false,
      };
    } else if (adapterKey === "scva_tournaments") {
      kind = "structured_calendar";
      config = {
        url: "https://www.scvavolleyball.org/tournaments",
        includePast: false,
      };
    } else {
      kind = "official_feed";
      config = {};
    }
    await api("POST", "/discovery-sources", {
      name,
      kind,
      adapterKey,
      enabled: true,
      config,
    });
    toast("Source added");
    loadSourcesTab();
  } catch (e) {
    toast(e.message, true);
  }
}

async function runJob(dryRun) {
  try {
    toast(dryRun ? "Preview running…" : "Discovery running…");
    const run = await api("POST", "/jobs/admin-run", {
      jobType: "combined",
      dryRun: !!dryRun,
    });
    document.getElementById("last-job-summary").textContent = JSON.stringify(
      run.summary || run,
      null,
      2,
    );
    toast(run.status === "completed" ? "Job completed" : run.status, run.status === "failed");
    loadJobs();
    await refreshSetupBanner();
  } catch (e) {
    toast(e.message, true);
  }
}

async function loadJobs() {
  const body = document.getElementById("tbody-jobs");
  try {
    const rows = await api("GET", "/jobs/runs?limit=40");
    const latest = rows[0];
    if (latest) {
      document.getElementById("last-job-summary").textContent = JSON.stringify(
        {
          id: latest.id,
          type: latest.jobType,
          status: latest.status,
          dryRun: latest.dryRun,
          startedAt: latest.startedAt,
          completedAt: latest.completedAt,
          summary: latest.summary,
          error: latest.error,
        },
        null,
        2,
      );
    }
    body.innerHTML = rows.length
      ? rows
          .map(
            (r) => `<tr>
          <td>${esc(r.jobType)}</td>
          <td>${esc(r.status)}${r.dryRun ? " · dry-run" : ""}</td>
          <td class="muted">${esc(new Date(r.startedAt).toLocaleString())}</td>
          <td class="muted">${r.completedAt ? esc(new Date(r.completedAt).toLocaleString()) : "—"}</td>
          <td class="muted">${esc(r.triggeredBy)}</td>
        </tr>`,
          )
          .join("")
      : `<tr><td colspan="5" class="empty">No job runs yet.</td></tr>`;
  } catch (e) {
    body.innerHTML = `<tr><td colspan="5" class="empty">${esc(e.message)}</td></tr>`;
  }
}

function renderClubs() {
  const tb = document.getElementById("clubs-body");
  if (!tb) return;
  tb.innerHTML = clubs.length
    ? clubs
        .map(
          (c) => `<tr><td>${esc(c.name)}</td><td>${esc(c.city || "")}</td><td>${esc(c.state || "")}</td>
      <td class="actions"><button class="btn btn-ghost btn-sm" onclick="openClub('${c.id}')">Edit</button></td></tr>`,
        )
        .join("")
    : `<tr><td colspan="4" class="empty">No clubs</td></tr>`;
}

function renderCodes() {
  const tb = document.getElementById("codes-body");
  if (!tb) return;
  tb.innerHTML = codes.length
    ? codes
        .map(
          (c) => `<tr><td><span class="badge badge-published">${esc(c.code)}</span></td>
      <td>${esc(c.teamName)}</td><td>${esc(c.clubName || "")}</td></tr>`,
        )
        .join("")
    : `<tr><td colspan="3" class="empty">No codes</td></tr>`;
}

function openClub(id) {
  const c = id ? clubs.find((x) => x.id === id) : null;
  editingId = id || null;
  editingType = "club";
  document.getElementById("modal-title").textContent = c ? "Edit club" : "Add club";
  document.getElementById("modal-body").innerHTML = `
    <div class="form-row"><div><label>Name</label><input id="f-name" value="${esc(c?.name || "")}"></div></div>
    <div class="form-row cols-2">
      <div><label>City</label><input id="f-city" value="${esc(c?.city || "")}"></div>
      <div><label>State</label><input id="f-state" value="${esc(c?.state || "")}"></div>
    </div>
    <div class="form-footer">
      <button class="btn btn-primary" onclick="saveClub()">Save</button>
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
    </div>`;
  document.getElementById("modal").classList.add("open");
}

async function saveClub() {
  try {
    const payload = { name: v("f-name"), city: v("f-city") || null, state: v("f-state") || null };
    if (editingId) await api("PUT", "/clubs/" + editingId, payload);
    else await api("POST", "/clubs", payload);
    toast("Saved");
    closeModal();
    clubs = await api("GET", "/clubs");
    renderClubs();
  } catch (e) {
    toast(e.message, true);
  }
}

async function loadMetrics() {
  try {
    const m = await api("GET", "/metrics");
    document.getElementById("metrics-cards").innerHTML = `
      <div class="metric-card"><div class="metric-value">${m.familiesSignedUp}</div><div class="metric-label">Families signed up</div></div>
      <div class="metric-card"><div class="metric-value">${m.familiesMatched}</div><div class="metric-label">Families matched</div></div>
      <div class="metric-card"><div class="metric-value">${m.surveys.totalResponses}</div><div class="metric-label">Surveys</div></div>`;
  } catch (e) {
    document.getElementById("metrics-cards").innerHTML = `<div class="empty">${esc(e.message)}</div>`;
  }
}

async function loadFeedback() {
  try {
    const rows = await api("GET", "/feedback");
    document.getElementById("feedback-body").innerHTML = rows.length
      ? rows
          .map(
            (f) => `<tr><td>${esc(f.userName || "")}</td><td>${esc(f.message)}</td>
        <td class="muted">${esc(new Date(f.createdAt).toLocaleString())}</td></tr>`,
          )
          .join("")
      : `<tr><td colspan="3" class="empty">No feedback</td></tr>`;
  } catch (e) {
    toast(e.message, true);
  }
}

window.switchTab = switchTab;
window.loadTournaments = loadTournaments;
window.viewTournament = viewTournament;
window.setStatus = setStatus;
window.toggleHide = toggleHide;
window.editTournament = editTournament;
window.saveTournamentEdit = saveTournamentEdit;
window.closeModal = closeModal;
window.ensureDefaultSources = ensureDefaultSources;
window.addSource = addSource;
window.runJob = runJob;
window.savePolicy = savePolicy;
window.openClub = openClub;
window.saveClub = saveClub;

loadAll();
