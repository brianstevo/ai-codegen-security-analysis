```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>postMessage Parent → iframe Demo</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: system-ui, sans-serif;
      background: #f0f2f5;
      display: flex;
      flex-direction: column;
      align-items: center;
      min-height: 100vh;
      padding: 2rem;
      gap: 1.5rem;
    }

    h1 { color: #1a1a2e; font-size: 1.6rem; }

    .card {
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 4px 16px rgba(0,0,0,.1);
      padding: 1.5rem;
      width: 100%;
      max-width: 640px;
    }

    .card h2 { font-size: 1rem; color: #555; margin-bottom: 1rem; text-transform: uppercase; letter-spacing: .05em; }

    .controls { display: flex; flex-direction: column; gap: .75rem; }

    label { font-size: .9rem; color: #333; display: flex; flex-direction: column; gap: .3rem; }

    input, select, textarea {
      padding: .5rem .75rem;
      border: 1px solid #ccc;
      border-radius: 8px;
      font-size: .95rem;
      outline: none;
      transition: border-color .2s;
    }
    input:focus, select:focus, textarea:focus { border-color: #4f46e5; }
    textarea { resize: vertical; min-height: 80px; }

    button {
      padding: .6rem 1.4rem;
      background: #4f46e5;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: .95rem;
      cursor: pointer;
      transition: background .2s, transform .1s;
      align-self: flex-start;
    }
    button:hover  { background: #4338ca; }
    button:active { transform: scale(.97); }

    .log {
      background: #1e1e2e;
      color: #cdd6f4;
      border-radius: 8px;
      padding: 1rem;
      font-family: monospace;
      font-size: .85rem;
      min-height: 80px;
      max-height: 160px;
      overflow-y: auto;
    }
    .log .entry { padding: .15rem 0; border-bottom: 1px solid #313244; }
    .log .entry:last-child { border: none; }
    .log .ts { color: #a6e3a1; margin-right: .5rem; }
    .log .dir-out { color: #89dceb; }
    .log .dir-in  { color: #f38ba8; }

    iframe {
      width: 100%;
      border: 2px solid #4f46e5;
      border-radius: 8px;
      min-height: 260px;
    }
  </style>
</head>
<body>

<h1>postMessage: Parent → iframe</h1>

<!-- ── PARENT CONTROLS ───────────────────────────────────────── -->
<div class="card">
  <h2>Parent Window</h2>
  <div class="controls">

    <label>
      Message type
      <select id="msgType">
        <option value="greeting">greeting</option>
        <option value="update">update</option>
        <option value="alert">alert</option>
        <option value="custom">custom</option>
      </select>
    </label>

    <label>
      Payload (JSON or plain text)
      <textarea id="msgPayload">{ "text": "Hello from parent!", "timestamp": "" }</textarea>
    </label>

    <label>
      Target origin
      <input id="targetOrigin" type="text" value="*" placeholder="e.g. https://example.com or *" />
    </label>

    <button id="sendBtn">Send message to iframe</button>
  </div>
</div>

<!-- ── PARENT LOG ────────────────────────────────────────────── -->
<div class="card">
  <h2>Parent log</h2>
  <div class="log" id="parentLog"><div class="entry" style="color:#6c7086">Waiting for messages…</div></div>
</div>

<!-- ── EMBEDDED IFRAME ───────────────────────────────────────── -->
<div class="card">
  <h2>Embedded iframe (srcdoc)</h2>
  <iframe id="childFrame" srcdoc="PLACEHOLDER"></iframe>
</div>

<script>
/* ─────────────────────────────────────────────────────────────
   Utility helpers
───────────────────────────────────────────────────────────── */
function timestamp() {
  return new Date().toLocaleTimeString([], { hour12: false });
}

function appendLog(logEl, direction, content) {
  // Remove initial placeholder text on first real entry
  if (logEl.firstChild && logEl.firstChild.style && logEl.firstChild.style.color === 'rgb(108, 112, 134)') {
    logEl.innerHTML = '';
  }
  const entry = document.createElement('div');
  entry.className = 'entry';
  entry.innerHTML =
    `<span class="ts">[${timestamp()}]</span>` +
    `<span class="${direction === 'out' ? 'dir-out' : 'dir-in'}">${direction === 'out' ? '▶ SENT' : '◀ RECV'}</span> ` +
    `<span>${escapeHtml(content)}</span>`;
  logEl.appendChild(entry);
  logEl.scrollTop = logEl.scrollHeight;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ─────────────────────────────────────────────────────────────
   Build the iframe's srcdoc content
   (The iframe lives in the same origin, but the pattern works
    identically with a cross-origin src URL.)
───────────────────────────────────────────────────────────── */
const iframeSrcdoc = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <style>
    body {
      font-family: system-ui, sans-serif;
      background: #1e1e2e;
      color: #cdd6f4;
      margin: 0;
      padding: 1rem;
    }
    h2 { font-size: .95rem; color: #89b4fa; margin-bottom: .75rem; text-transform: uppercase; letter-spacing:.05em; }
    #inbox {
      background: #181825;
      border-radius: 8px;
      padding: .75rem;
      font-family: monospace;
      font-size: .82rem;
      min-height: 120px;
      max-height: 200px;
      overflow-y: auto;
    }
    .msg { padding: .2rem 0; border-bottom: 1px solid #313244; }
    .msg:last-child { border: none; }
    .type { color: #a6e3a1; margin-right: .4rem; }
    .reply-btn {
      margin-top: .75rem;
      padding: .45rem