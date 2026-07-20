```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>postMessage Demo — Parent</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: system-ui, sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      min-height: 100vh;
      padding: 2rem;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    h1 { font-size: 1.5rem; color: #7dd3fc; letter-spacing: .02em; }
    h2 { font-size: 1rem; color: #94a3b8; margin-bottom: .75rem; }

    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.5rem;
    }

    .panel {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: .75rem;
      padding: 1.25rem;
    }

    iframe {
      width: 100%;
      height: 220px;
      border: 1px solid #334155;
      border-radius: .5rem;
      background: #0f172a;
    }

    label { font-size: .85rem; color: #94a3b8; display: block; margin-bottom: .3rem; }

    input, select, textarea {
      width: 100%;
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: .4rem;
      color: #e2e8f0;
      padding: .45rem .65rem;
      font-size: .875rem;
      margin-bottom: .75rem;
      outline: none;
      transition: border-color .2s;
    }
    input:focus, select:focus, textarea:focus { border-color: #7dd3fc; }
    textarea { resize: vertical; min-height: 70px; font-family: monospace; }

    button {
      background: #0ea5e9;
      color: #fff;
      border: none;
      border-radius: .4rem;
      padding: .5rem 1.1rem;
      font-size: .875rem;
      cursor: pointer;
      transition: background .2s;
    }
    button:hover { background: #38bdf8; }
    button.danger { background: #ef4444; }
    button.danger:hover { background: #f87171; }

    .log {
      margin-top: .75rem;
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: .4rem;
      padding: .65rem;
      font-family: monospace;
      font-size: .78rem;
      max-height: 200px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: .3rem;
    }

    .log-entry {
      padding: .3rem .5rem;
      border-radius: .25rem;
      line-height: 1.4;
    }
    .log-entry.info    { background: #1e3a5f; color: #7dd3fc; }
    .log-entry.success { background: #14532d; color: #86efac; }
    .log-entry.warning { background: #422006; color: #fcd34d; }
    .log-entry.error   { background: #450a0a; color: #fca5a5; }

    .badge {
      display: inline-block;
      font-size: .7rem;
      padding: .1rem .4rem;
      border-radius: 9999px;
      margin-right: .35rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .05em;
    }
    .badge.rx { background: #7c3aed; color: #ede9fe; }
    .badge.tx { background: #0e7490; color: #cffafe; }
    .badge.err { background: #b91c1c; color: #fee2e2; }
    .badge.ok  { background: #15803d; color: #dcfce7; }

    .row { display: flex; gap: .5rem; align-items: flex-end; flex-wrap: wrap; margin-bottom: .75rem; }
    .row > * { margin-bottom: 0 !important; }
    .row input, .row select { flex: 1; min-width: 0; }

    .separator {
      border: none;
      border-top: 1px solid #334155;
      margin: .75rem 0;
    }

    .info-box {
      background: #1e293b;
      border-left: 3px solid #7dd3fc;
      padding: .75rem 1rem;
      border-radius: .25rem;
      font-size: .8rem;
      color: #94a3b8;
      line-height: 1.6;
    }
    .info-box strong { color: #7dd3fc; }

    @media (max-width: 700px) {
      .grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>

<h1>🔒 postMessage Secure Communication Demo</h1>

<div class="info-box">
  <strong>Security model:</strong>
  Target origin is always set explicitly (never <code>*</code>).
  The receiver validates <code>event.origin</code> against a whitelist,
  checks that the payload is a plain object, and enforces required typed fields
  (<code>type</code>: string, <code>payload</code>: any, optional <code>id</code>: string).
</div>

<!-- ── PARENT CONTROLS ─────────────────────────── -->
<div class="panel">
  <h2>⬆ Parent → Child (send message)</h2>

  <div class="row">
    <div style="flex:1">
      <label>Message type</label>
      <select id="msgType">
        <option value="GREETING">GREETING</option>
        <option value="DATA_REQUEST">DATA_REQUEST</option>
        <option value="COMMAND">COMMAND</option>
        <option value="PING">PING</option>
        <option value="INVALID_SHAPE">INVALID_SHAPE (bad — no type)</option>
      </select>
    </div>
    <div style="flex:1">
      <label>Message ID (optional)</label>
      <input id="msgId" type="text" placeholder="auto-generate" />
    </div>
  </div>

  <label>Payload (JSON)</label>
  <textarea id="msgPayload">{ "text": "Hello from parent!", "timestamp": 0 }</textarea>

  <div class="row">
    <button id="btnSendValid">Send Valid Message</button>
    <button id="btnSendBadOrigin" class="danger">Simulate Bad Origin</button>
    <button id="btnSendMalformed" class="danger">Send Malformed (string)</button>
  </div>

  <h2 style="margin-top:.5rem">📥 Parent Received Log</h2>
  <div class="log" id="parentLog"></div>
</div>

<!-- ── IFRAME (CHILD) ──────────────────────────── -->
<div class="grid">
  <div class="panel">
    <h2>🖼 Child iframe</h2>
    <iframe id="childFrame" src="about:blank" title="Child frame"></iframe>
    <p style="font-size:.75rem;color:#475569;margin-top:.