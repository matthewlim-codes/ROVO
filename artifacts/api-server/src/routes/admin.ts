import { Router } from "express";
import { requireAdminAuth } from "../middlewares/adminAuth";

const router = Router();

/**
 * Admin SPA shell. Styles/scripts live in public/admin/ (maintainable files).
 * Served at GET /api/admin with Basic Auth.
 */
const ADMIN_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Rovo Admin</title>
<link rel="stylesheet" href="/api/static/admin/admin.css" />
</head>
<body>
<header>
  <div class="logo">R</div>
  <div><h1>Rovo Admin</h1></div>
  <span style="margin-left:auto">Tournaments · discovery · clubs</span>
</header>

<div class="tabs">
  <div class="tab active" onclick="switchTab('published')">Published</div>
  <div class="tab" onclick="switchTab('scheduled')">Scheduled</div>
  <div class="tab" onclick="switchTab('pending')">Pending review</div>
  <div class="tab" onclick="switchTab('archived')">Archived</div>
  <div class="tab" onclick="switchTab('sources')">Sources &amp; CA clubs</div>
  <div class="tab" onclick="switchTab('jobs')">Job history</div>
  <div class="tab" onclick="switchTab('clubs')">Clubs</div>
  <div class="tab" onclick="switchTab('codes')">Club Codes</div>
  <div class="tab" onclick="switchTab('metrics')">Metrics</div>
  <div class="tab" onclick="switchTab('feedback')">Feedback</div>
</div>

<div class="container">
  <div id="setup-banner" class="setup-banner" style="display:none"></div>

  ${["published", "scheduled", "pending", "archived"]
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
    .join("")}

  <div id="tab-sources" class="section">
    <div class="card">
      <div class="card-header">
        <h2>California clubs</h2>
        <button class="btn btn-primary btn-sm" onclick="addCaClub()">+ Add CA club</button>
      </div>
      <table>
        <thead><tr><th>Name</th><th>City</th><th>Status</th><th>Site</th></tr></thead>
        <tbody id="tbody-ca-clubs"></tbody>
      </table>
    </div>
    <div class="card">
      <div class="card-header">
        <h2>Discovery sources</h2>
        <div class="toolbar">
          <button class="btn btn-ghost btn-sm" onclick="runJob(true)">Preview changes</button>
          <button class="btn btn-primary btn-sm" onclick="runJob(false)">Run discovery</button>
          <button class="btn btn-ghost btn-sm" onclick="addSource()">+ Add source</button>
        </div>
      </div>
      <table>
        <thead><tr><th>Source</th><th>Enabled</th><th>Health</th><th>Last success</th></tr></thead>
        <tbody id="tbody-sources"></tbody>
      </table>
    </div>
    <div class="card">
      <div class="card-header"><h2>Auto-approve policy</h2></div>
      <div style="padding:16px">
        <pre id="policy-json" class="json"></pre>
        <p class="muted" style="margin-top:10px">Edit via PUT /api/discovery/policy. Ambiguous events stay in pending review.</p>
        <h3 style="margin:16px 0 8px;font-size:14px">Adapters</h3>
        <ul id="adapters-list" class="muted" style="padding-left:18px;line-height:1.6"></ul>
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
<script src="/api/static/admin/admin.js"></script>
</body>
</html>`;

router.get("/admin", requireAdminAuth, (_req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.send(ADMIN_HTML);
});

export default router;
