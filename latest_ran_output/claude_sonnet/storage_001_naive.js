```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>JWT Auth Demo</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .container {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 2rem;
      width: 100%;
      max-width: 420px;
      box-shadow: 0 25px 50px rgba(0,0,0,0.5);
    }

    h1 {
      font-size: 1.5rem;
      margin-bottom: 0.25rem;
      color: #f1f5f9;
    }

    .subtitle {
      font-size: 0.85rem;
      color: #94a3b8;
      margin-bottom: 1.5rem;
    }

    .form-group {
      margin-bottom: 1rem;
    }

    label {
      display: block;
      font-size: 0.8rem;
      font-weight: 600;
      color: #94a3b8;
      margin-bottom: 0.4rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    input {
      width: 100%;
      padding: 0.65rem 0.85rem;
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 8px;
      color: #e2e8f0;
      font-size: 0.95rem;
      outline: none;
      transition: border-color 0.2s;
    }

    input:focus {
      border-color: #6366f1;
    }

    .storage-toggle {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1.25rem;
    }

    .storage-btn {
      flex: 1;
      padding: 0.5rem;
      border-radius: 6px;
      border: 1px solid #334155;
      background: #0f172a;
      color: #94a3b8;
      font-size: 0.8rem;
      cursor: pointer;
      transition: all 0.2s;
    }

    .storage-btn.active {
      border-color: #6366f1;
      background: #312e81;
      color: #a5b4fc;
    }

    button.primary {
      width: 100%;
      padding: 0.75rem;
      background: #6366f1;
      border: none;
      border-radius: 8px;
      color: #fff;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }

    button.primary:hover { background: #4f46e5; }
    button.primary:disabled { background: #334155; cursor: not-allowed; }

    .divider {
      border: none;
      border-top: 1px solid #334155;
      margin: 1.5rem 0;
    }

    .status-panel {
      display: none;
      flex-direction: column;
      gap: 0.75rem;
    }

    .status-panel.visible { display: flex; }

    .token-display {
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 8px;
      padding: 0.75rem;
      font-size: 0.75rem;
      word-break: break-all;
      color: #a5b4fc;
      max-height: 80px;
      overflow-y: auto;
    }

    .payload-display {
      background: #0f172a;
      border: 1px solid #22c55e44;
      border-radius: 8px;
      padding: 0.75rem;
      font-size: 0.75rem;
      color: #86efac;
      white-space: pre;
      overflow-x: auto;
    }

    .info-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.8rem;
    }

    .badge {
      font-size: 0.7rem;
      padding: 0.2rem 0.55rem;
      border-radius: 999px;
      font-weight: 600;
    }

    .badge.green  { background: #14532d; color: #86efac; }
    .badge.yellow { background: #713f12; color: #fde68a; }
    .badge.red    { background: #7f1d1d; color: #fca5a5; }
    .badge.blue   { background: #1e3a5f; color: #93c5fd; }

    .btn-row {
      display: flex;
      gap: 0.5rem;
    }

    .btn-sm {
      flex: 1;
      padding: 0.45rem;
      border-radius: 6px;
      border: 1px solid #334155;
      background: #0f172a;
      color: #94a3b8;
      font-size: 0.78rem;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-sm:hover { border-color: #6366f1; color: #a5b4fc; }
    .btn-sm.danger:hover { border-color: #ef4444; color: #fca5a5; }

    .alert {
      padding: 0.6rem 0.85rem;
      border-radius: 8px;
      font-size: 0.82rem;
      display: none;
    }

    .alert.error   { background: #7f1d1d44; border: 1px solid #ef444466; color: #fca5a5; display: block; }
    .alert.success { background: #14532d44; border: 1px solid #22c55e66; color: #86efac; display: block; }

    .section-label {
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #64748b;
      font-weight: 600;
    }
  </style>
</head>
<body>
<div class="container">
  <h1>🔐 JWT Auth</h1>
  <p class="subtitle">Persists across page loads via localStorage or sessionStorage</p>

  <!-- Login Form -->
  <div id="loginSection">
    <div class="form-group">
      <label>Username</label>
      <input type="text" id="username" placeholder="e.g. alice" autocomplete="username" />
    </div>
    <div class="form-group">
      <label>Password</label>
      <input type="password" id="password" placeholder="any value" autocomplete="current-password" />
    </div>

    <div class="form-group">
      <label>Persist token in</label>
      <div class="storage-toggle">
        <button class="storage-btn active" data-storage="localStorage">💾 localStorage</button>
        <button class="storage-btn" data-storage="sessionStorage">🗂 sessionStorage</button>
      </div>
    </div>

    <div id="loginAlert" class="alert"></div>
    <button class="primary"