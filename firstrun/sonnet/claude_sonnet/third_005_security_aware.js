```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Secure postMessage Demo</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      min-height: 100vh;
      padding: 24px;
    }

    h1 {
      text-align: center;
      margin-bottom: 24px;
      color: #38bdf8;
      font-size: 1.6rem;
    }

    .layout {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      max-width: 1100px;
      margin: 0 auto;
    }

    .panel {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .panel h2 {
      font-size: 1rem;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      border-bottom: 1px solid #334155;
      padding-bottom: 10px;
    }

    label {
      display: block;
      font-size: 0.78rem;
      color: #94a3b8;
      margin-bottom: 4px;
    }

    input, select, textarea {
      width: 100%;
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 6px;
      color: #e2e8f0;
      padding: 8px 10px;
      font-size: 0.88rem;
      outline: none;
      transition: border-color 0.2s;
    }

    input:focus, select:focus, textarea:focus {
      border-color: #38bdf8;
    }

    textarea { resize: vertical; min-height: 70px; }

    button {
      width: 100%;
      padding: 10px;
      border: none;
      border-radius: 8px;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.2s, transform 0.1s;
    }

    button:active { transform: scale(0.98); }

    .btn-send {
      background: #0284c7;
      color: #fff;
    }

    .btn-send:hover { opacity: 0.88; }

    .btn-danger {
      background: #be123c;
      color: #fff;
    }

    .btn-danger:hover { opacity: 0.88; }

    .btn-clear {
      background: #334155;
      color: #94a3b8;
      font-size: 0.78rem;
      padding: 6px;
    }

    .log-area {
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 8px;
      padding: 12px;
      font-size: 0.8rem;
      font-family: 'Courier New', monospace;
      min-height: 220px;
      max-height: 340px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .log-entry {
      padding: 6px 10px;
      border-radius: 4px;
      line-height: 1.4;
      word-break: break-all;
    }

    .log-success { background: #14532d55; border-left: 3px solid #22c55e; color: #86efac; }
    .log-error   { background: #4c000055; border-left: 3px solid #ef4444; color: #fca5a5; }
    .log-warn    { background: #78350f55; border-left: 3px solid #f59e0b; color: #fcd34d; }
    .log-info    { background: #1e3a5f55; border-left: 3px solid #38bdf8; color: #7dd3fc; }

    .timestamp { opacity: 0.6; font-size: 0.75em; }

    .iframe-wrapper {
      grid-column: 1 / -1;
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 16px;
    }

    .iframe-wrapper h2 {
      font-size: 1rem;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 12px;
      border-bottom: 1px solid #334155;
      padding-bottom: 10px;
    }

    iframe {
      width: 100%;
      height: 220px;
      border: 1px solid #334155;
      border-radius: 8px;
      background: #0f172a;
    }

    .origin-badge {
      display: inline-block;
      background: #0f172a;
      border: 1px solid #475569;
      border-radius: 20px;
      padding: 2px 10px;
      font-size: 0.75rem;
      color: #94a3b8;
      margin-top: 4px;
    }

    .schema-hint {
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 6px;
      padding: 10px;
      font-size: 0.75rem;
      color: #64748b;
      font-family: monospace;
    }

    @media (max-width: 700px) {
      .layout { grid-template-columns: 1fr; }
      .iframe-wrapper { grid-column: 1; }
    }
  </style>
</head>
<body>

<h1>🔒 Secure postMessage Communication</h1>

<div class="layout">

  <!-- SENDER PANEL -->
  <div class="panel">
    <h2>📤 Sender (Parent Frame)</h2>

    <div>
      <label>Message Type</label>
      <select id="msgType">
        <option value="USER_ACTION">USER_ACTION</option>
        <option value="DATA_REQUEST">DATA_REQUEST</option>
        <option value="CONFIG_UPDATE">CONFIG_UPDATE</option>
        <option value="INVALID_TYPE">INVALID_TYPE (will fail validation)</option>
      </select>
    </div>

    <div>
      <label>Payload (JSON)</label>
      <textarea id="msgPayload">{"action": "login", "userId": 42}</textarea>
    </div>

    <div>
      <label>Request ID (auto-filled)</label>
      <input id="msgRequestId" type="text" value="" readonly>
    </div>

    <button class="btn-send" id="btnSend">Send to Child iframe ✉️</button>
    <button class="btn-danger" id="btnSendBad">Send Malformed Message 💣</button>
    <button class="btn-danger" id="btnSendWrongOrigin">Simulate Wrong-Origin Attack 🚫</button>

    <div>
      <label>Parent Origin</label>
      <span class="origin-badge" id="parentOriginBadge">loading…</span>
    </div>

    <h2 style="margin-top:4px;">