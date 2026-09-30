import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Router } from "express";
import { requireAdminAuth } from "../middlewares/adminAuth";

const router = Router();

/**
 * Resolve public/admin for CSS/JS. Prefer dist/public (copied at build) so a
 * Replit deploy of dist/ alone still serves a working admin SPA.
 */
function resolveAdminAssetDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(process.cwd(), "public", "admin"),
    path.join(here, "public", "admin"),
    path.join(here, "..", "public", "admin"),
  ];
  for (const dir of candidates) {
    if (
      fs.existsSync(path.join(dir, "admin.js")) &&
      fs.existsSync(path.join(dir, "admin.css"))
    ) {
      return dir;
    }
  }
  return candidates[0]!;
}

function readAdminAssets(): { css: string; js: string; logoDataUri: string } {
  const dir = resolveAdminAssetDir();
  const markPath = path.join(dir, "rovo-mark.png");
  const logoPath = fs.existsSync(markPath)
    ? markPath
    : path.join(dir, "rovo-logo.png");
  const logoDataUri = fs.existsSync(logoPath)
    ? `data:image/png;base64,${fs.readFileSync(logoPath).toString("base64")}`
    : "";
  return {
    css: fs.readFileSync(path.join(dir, "admin.css"), "utf8"),
    js: fs.readFileSync(path.join(dir, "admin.js"), "utf8"),
    logoDataUri,
  };
}

function buildAdminHtml(): string {
  const { css, js, logoDataUri } = readAdminAssets();
  const tournamentTabs = ["published", "scheduled", "pending", "archived"]
    .map(
      (key, i) => `
  <div id="tab-${key}" class="section${i === 0 ? " active" : ""}">
    <div class="card">
      <div class="card-header">
        <h2>${key === "scheduled" ? "Approved / scheduled" : key.charAt(0).toUpperCase() + key.slice(1)} tournaments</h2>
        <div class="toolbar">
          <input id="search-${key === "scheduled" ? "approved" : key === "pending" ? "pending_review" : key}" placeholder="Search…" style="width:180px" onkeydown="if(event.key==='Enter')loadTournaments('${key === "scheduled" ? "approved" : key === "pending" ? "pending_review" : key}')">
          <button class="btn btn-ghost btn-sm" onclick="loadTournaments('${key === "scheduled" ? "approved" : key === "pending" ? "pending_review" : key}')">Search</button>
        </div>
      </div>
      <table>
        <thead><tr><th>Name</th><th>Location</th><th>Dates</th><th>Status</th><th>Gender</th><th></th></tr></thead>
        <tbody id="tbody-${key}"></tbody>
      </table>
    </div>
  </div>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Rovo Admin</title>
<style>
${css}
</style>
</head>
<body>
<header>
  ${
    logoDataUri
      ? `<img class="logo" src="${logoDataUri}" alt="Rovo" width="32" height="32" />`
      : `<div class="logo" aria-hidden="true"></div>`
  }
  <div><h1>Rovo Admin</h1></div>
  <span style="margin-left:auto">Tournaments · discovery · clubs</span>
</header>

<div class="tabs">
  <div class="tab active" onclick="switchTab('published')">Published</div>
  <div class="tab" onclick="switchTab('scheduled')">Scheduled</div>
  <div class="tab" onclick="switchTab('pending')">Pending review</div>
  <div class="tab" onclick="switchTab('archived')">Archived</div>
  <div class="tab" onclick="switchTab('sources')">Sources</div>
  <div class="tab" onclick="switchTab('jobs')">Job history</div>
  <div class="tab" onclick="switchTab('clubs')">Clubs</div>
  <div class="tab" onclick="switchTab('codes')">Club Codes</div>
  <div class="tab" onclick="switchTab('metrics')">Metrics</div>
  <div class="tab" onclick="switchTab('feedback')">Feedback</div>
</div>

<div class="container">
  <div id="setup-banner" class="setup-banner" style="display:none"></div>
  ${tournamentTabs}

  <div id="tab-sources" class="section">
    <div class="card">
      <div class="card-header">
        <h2>Discovery sources</h2>
        <div class="toolbar">
          <button class="btn btn-ghost btn-sm" onclick="ensureDefaultSources()">Ensure NCVA + SCVA</button>
          <button class="btn btn-ghost btn-sm" onclick="runJob(true)">Preview changes</button>
          <button class="btn btn-primary btn-sm" onclick="runJob(false)">Run discovery</button>
          <button class="btn btn-ghost btn-sm" onclick="addSource()">+ Add source</button>
        </div>
      </div>
      <p class="muted" style="padding:0 20px 12px">Tournaments are pulled from <a href="https://ncva.com/events/" target="_blank" rel="noopener">ncva.com/events</a> and <a href="https://www.scvavolleyball.org/tournaments" target="_blank" rel="noopener">scvavolleyball.org/tournaments</a>. Same event from both sources is kept once.</p>
      <table>
        <thead><tr><th>Source</th><th>Enabled</th><th>Health</th><th>Last success</th></tr></thead>
        <tbody id="tbody-sources"></tbody>
      </table>
    </div>
    <div class="card">
      <div class="card-header"><h2>Auto-approve policy</h2></div>
      <div style="padding:16px">
        <form id="policy-form" onsubmit="return savePolicy(event)">
          <div class="form-row cols-2">
            <div>
              <label>Minimum distinct clubs with attendance evidence</label>
              <input id="policy-min-clubs" type="number" min="1" max="50" required />
            </div>
            <div>
              <label>Policy enabled</label>
              <select id="policy-enabled">
                <option value="true">Enabled</option>
                <option value="false">Disabled (all pending review)</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div>
              <label>Accepted evidence types</label>
              <label class="check"><input type="checkbox" name="policy-ev" value="planned_schedule" /> planned_schedule (club schedule)</label>
              <label class="check"><input type="checkbox" name="policy-ev" value="registration_confirmed" /> registration_confirmed</label>
              <label class="check"><input type="checkbox" name="policy-ev" value="organizer_team_list" /> organizer_team_list</label>
              <label class="check"><input type="checkbox" name="policy-ev" value="admin_verified" /> admin_verified</label>
            </div>
          </div>
          <div class="form-row">
            <label class="check">
              <input type="checkbox" id="policy-require-reg" />
              Require at least one registration_confirmed evidence
            </label>
          </div>
          <div class="form-footer" style="padding:0;margin-top:12px">
            <button type="submit" class="btn btn-primary btn-sm">Save policy</button>
          </div>
        </form>
        <p class="muted" style="margin-top:12px">Without attendance evidence, discovered tournaments stay in Pending review. Proximity alone never counts.</p>
        <h3 style="margin:16px 0 8px;font-size:14px">Adapters</h3>
        <ul id="adapters-list" class="muted" style="padding-left:18px;line-height:1.6"></ul>
        <details style="margin-top:12px">
          <summary class="muted">Raw policy JSON</summary>
          <pre id="policy-json" class="json"></pre>
        </details>
      </div>
    </div>
  </div>

  <div id="tab-jobs" class="section">
    <div class="card">
      <div class="card-header">
        <h2>Job history</h2>
        <div class="toolbar">
          <button class="btn btn-ghost btn-sm" onclick="runJob(true)">Preview</button>
          <button class="btn btn-primary btn-sm" onclick="runJob(false)">Run discovery + lifecycle</button>
        </div>
      </div>
      <div style="padding:16px">
        <h3 style="font-size:13px;margin-bottom:8px">Most recent run</h3>
        <pre id="last-job-summary" class="json">No runs yet.</pre>
      </div>
      <table>
        <thead><tr><th>Type</th><th>Status</th><th>Started</th><th>Completed</th><th>Triggered by</th></tr></thead>
        <tbody id="tbody-jobs"></tbody>
      </table>
    </div>
  </div>

  <div id="tab-clubs" class="section">
    <div class="card">
      <div class="card-header"><h2>Clubs</h2>
        <button class="btn btn-primary btn-sm" onclick="editingId=null;editingType='club';openClub('')">+ Add</button>
      </div>
      <table><thead><tr><th>Name</th><th>City</th><th>State</th><th></th></tr></thead><tbody id="clubs-body"></tbody></table>
    </div>
  </div>

  <div id="tab-codes" class="section">
    <div class="card">
      <div class="card-header"><h2>Club codes</h2></div>
      <table><thead><tr><th>Code</th><th>Team</th><th>Club</th></tr></thead><tbody id="codes-body"></tbody></table>
    </div>
  </div>

  <div id="tab-metrics" class="section">
    <div id="metrics-cards" class="metrics-grid"></div>
  </div>

  <div id="tab-feedback" class="section">
    <div class="card">
      <div class="card-header"><h2>Feedback</h2></div>
      <table><thead><tr><th>User</th><th>Message</th><th>When</th></tr></thead><tbody id="feedback-body"></tbody></table>
    </div>
  </div>
</div>

<div id="modal" class="modal-backdrop" onclick="if(event.target===this)closeModal()">
  <div class="modal wide">
    <h3 id="modal-title">Details</h3>
    <div id="modal-body"></div>
  </div>
</div>
<div id="toast" class="toast"></div>
<script>
${js}
</script>
</body>
</html>`;
}

/**
 * Admin SPA at GET /api/admin (Basic Auth).
 * CSS/JS are inlined so Profile → Manage club codes works even when
 * /api/static/admin/* is missing from an older deploy layout.
 */
router.get("/admin", requireAdminAuth, (_req, res) => {
  try {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.send(buildAdminHtml());
  } catch (err) {
    res
      .status(500)
      .type("text/plain")
      .send(
        `Admin UI assets missing. Rebuild the API so dist/public/admin is present. (${
          err instanceof Error ? err.message : "unknown error"
        })`,
      );
  }
});

export default router;
