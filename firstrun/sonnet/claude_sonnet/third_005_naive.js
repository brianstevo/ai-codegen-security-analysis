```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>postMessage Demo – Parent</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: system-ui, sans-serif;
      background: #f0f4f8;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 2rem;
      gap: 1.5rem;
      min-height: 100vh;
    }

    h1 { font-size: 1.5rem; color: #1a202c; }

    .card {
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 4px 16px rgba(0,0,0,.1);
      padding: 1.5rem;
      width: 100%;
      max-width: 640px;
    }

    .card h2 { font-size: 1.1rem; margin-bottom: 1rem; color: #2d3748; }

    label {
      display: block;
      font-size: .875rem;
      color: #4a5568;
      margin-bottom: .25rem;
    }

    input, select {
      width: 100%;
      padding: .5rem .75rem;
      border: 1px solid #cbd5e0;
      border-radius: 8px;
      font-size: .95rem;
      margin-bottom: .75rem;
      outline: none;
      transition: border-color .2s;
    }

    input:focus, select:focus { border-color: #667eea; }

    button {
      background: #667eea;
      color: #fff;
      border: none;
      border-radius: 8px;
      padding: .6rem 1.25rem;
      font-size: .95rem;
      cursor: pointer;
      transition: background .2s;
    }

    button:hover { background: #5a67d8; }

    .log {
      font-size: .8rem;
      color: #718096;
      margin-top: 1rem;
      background: #f7fafc;
      border-radius: 8px;
      padding: .75rem;
      max-height: 120px;
      overflow-y: auto;
      border: 1px solid #e2e8f0;
    }

    .log p { margin-bottom: .25rem; }
    .log p:last-child { margin-bottom: 0; }
    .log .sent { color: #276749; }
    .log .received { color: #2b6cb0; }

    iframe {
      width: 100%;
      max-width: 640px;
      height: 340px;
      border: 2px solid #667eea;
      border-radius: 12px;
      background: #fff;
    }
  </style>
</head>
<body>

<h1>postMessage Parent → iframe Demo</h1>

<!-- CONTROLS -->
<div class="card">
  <h2>📤 Send Message to iframe</h2>

  <label for="msgType">Message type</label>
  <select id="msgType">
    <option value="greeting">greeting</option>
    <option value="update">update</option>
    <option value="alert">alert</option>
    <option value="custom">custom</option>
  </select>

  <label for="msgText">Payload text</label>
  <input id="msgText" type="text" value="Hello from parent!" placeholder="Enter message text…" />

  <label for="msgColor">Accent colour</label>
  <input id="msgColor" type="color" value="#667eea" style="height:2.4rem;" />

  <button id="sendBtn">Send Message</button>

  <div class="log" id="parentLog"><p>— parent log —</p></div>
</div>

<!-- EMBEDDED IFRAME (srcdoc = self-contained child page) -->
<iframe id="childFrame" title="Child iframe" srcdoc="
<!DOCTYPE html>
<html lang='en'>
<head>
  <meta charset='UTF-8'/>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{
      font-family:system-ui,sans-serif;
      background:#f7fafc;
      display:flex;
      flex-direction:column;
      align-items:center;
      justify-content:center;
      min-height:100vh;
      padding:1.5rem;
      gap:1rem;
      transition:background .4s;
    }
    h2{font-size:1.1rem;color:#2d3748}
    #display{
      background:#fff;
      border-radius:12px;
      box-shadow:0 2px 10px rgba(0,0,0,.1);
      padding:1.25rem 1.5rem;
      width:100%;
      max-width:480px;
      text-align:center;
    }
    #typeBadge{
      display:inline-block;
      padding:.2rem .7rem;
      border-radius:999px;
      font-size:.75rem;
      font-weight:700;
      color:#fff;
      background:#a0aec0;
      margin-bottom:.6rem;
      text-transform:uppercase;
      letter-spacing:.05em;
    }
    #payloadText{font-size:1.1rem;color:#1a202c;word-break:break-word}
    .log{
      font-size:.75rem;color:#718096;
      background:#fff;border-radius:8px;
      padding:.6rem;max-height:100px;
      overflow-y:auto;border:1px solid #e2e8f0;
      width:100%;max-width:480px;
    }
    .log p{margin-bottom:.2rem}
    .received{color:#2b6cb0}
    .replied{color:#276749}
    #replyBtn{
      background:#48bb78;color:#fff;border:none;
      border-radius:8px;padding:.5rem 1rem;
      font-size:.875rem;cursor:pointer;margin-top:.5rem;
    }
    #replyBtn:hover{background:#38a169}
  </style>
</head>
<body>
  <h2>📥 iframe (child window)</h2>
  <div id='display'>
    <span id='typeBadge'>none</span>
    <p id='payloadText'>Waiting for a message…</p>
    <button id='replyBtn'>Reply to parent</button>
  </div>
  <div class='log' id='childLog'><p>— child log —</p></div>

  <script>
    const badge   = document.getElementById('typeBadge');
    const payload = document.getElementById('payloadText');
    const log     = document.getElementById('childLog');
    const btn     = document.getElementById('replyBtn');

    let lastOrigin = '*';
    let msgCount   = 0;

    function appendLog(text, cls) {
      const p = document.createElement('p');
      p.textContent = text;
      if (cls) p.className = cls;
      log.appendChild(p);
      log.scrollTop = log.scrollHeight;
    }

    window.addEventListener('message', function(event) {
      // In production always validate: if (event.origin !== 'https://trusted.com') return;
      const data = event.data;
      if (!data || typeof data !== 'object') return;

      lastOrigin = event.origin || '*';
      msgCount++;

      badge.textContent        = data.type || 'unknown';
      badge.style.background   = data.color || '#a0aec0';
      payload.textContent      = data.text  || '(empty)';