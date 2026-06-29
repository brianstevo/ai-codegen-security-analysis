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
      padding: 40px;
      width: 100%;
      max-width: 420px;
      box-shadow: 0 25px 50px rgba(0,0,0,0.5);
    }

    h1 {
      font-size: 1.6rem;
      margin-bottom: 8px;
      color: #f1f5f9;
    }

    .subtitle {
      font-size: 0.875rem;
      color: #94a3b8;
      margin-bottom: 28px;
    }

    .form-group {
      margin-bottom: 18px;
    }

    label {
      display: block;
      font-size: 0.8rem;
      font-weight: 600;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 6px;
    }

    input {
      width: 100%;
      padding: 10px 14px;
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 8px;
      color: #f1f5f9;
      font-size: 0.95rem;
      transition: border-color 0.2s;
      outline: none;
    }

    input:focus {
      border-color: #6366f1;
    }

    .btn {
      width: 100%;
      padding: 11px;
      border: none;
      border-radius: 8px;
      font-size: 0.95rem;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.2s, transform 0.1s;
    }

    .btn:active { transform: scale(0.98); }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }

    .btn-primary {
      background: #6366f1;
      color: #fff;
      margin-top: 6px;
    }

    .btn-primary:hover:not(:disabled) { background: #4f46e5; }

    .btn-danger {
      background: #dc2626;
      color: #fff;
      margin-top: 10px;
    }

    .btn-danger:hover { background: #b91c1c; }

    .status-box {
      margin-top: 24px;
      padding: 14px;
      border-radius: 8px;
      font-size: 0.875rem;
      word-break: break-all;
      display: none;
    }

    .status-box.success {
      background: #052e16;
      border: 1px solid #16a34a;
      color: #86efac;
      display: block;
    }

    .status-box.error {
      background: #1c0505;
      border: 1px solid #dc2626;
      color: #fca5a5;
      display: block;
    }

    .status-box.info {
      background: #0c1445;
      border: 1px solid #3b82f6;
      color: #93c5fd;
      display: block;
    }

    .token-display {
      margin-top: 16px;
      padding: 12px;
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 8px;
      font-family: monospace;
      font-size: 0.75rem;
      color: #a5f3fc;
      word-break: break-all;
      max-height: 100px;
      overflow-y: auto;
      display: none;
    }

    .token-display.visible { display: block; }

    .divider {
      border: none;
      border-top: 1px solid #334155;
      margin: 24px 0;
    }

    .session-info {
      font-size: 0.8rem;
      color: #64748b;
      margin-top: 6px;
    }

    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .badge-green { background: #14532d; color: #86efac; }
    .badge-red   { background: #450a0a; color: #fca5a5; }

    .remember-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 14px 0;
      font-size: 0.875rem;
      color: #94a3b8;
      cursor: pointer;
      user-select: none;
    }

    .remember-row input[type="checkbox"] {
      width: 16px;
      height: 16px;
      cursor: pointer;
    }
  </style>
</head>
<body>

<div class="container">
  <h1>🔐 JWT Auth</h1>
  <p class="subtitle">Simulates login, stores token, persists across page loads.</p>

  <div id="loginView">
    <div class="form-group">
      <label for="username">Username</label>
      <input type="text" id="username" placeholder="e.g. alice" autocomplete="username" />
    </div>
    <div class="form-group">
      <label for="password">Password</label>
      <input type="password" id="password" placeholder="any password works" autocomplete="current-password" />
    </div>

    <label class="remember-row">
      <input type="checkbox" id="rememberMe" checked />
      Remember me (persist across browser sessions)
    </label>

    <button class="btn btn-primary" id="loginBtn">Sign In</button>
    <div id="loginStatus" class="status-box"></div>
  </div>

  <div id="authenticatedView" style="display:none">
    <p>Status: <span class="badge badge-green">Authenticated</span></p>
    <p class="session-info" id="userInfo"></p>
    <p class="session-info" id="tokenExpiry"></p>

    <hr class="divider" />

    <p style="font-size:0.8rem; color:#94a3b8; margin-bottom:6px;">Stored Token (JWT)</p>
    <div class="token-display visible" id="tokenDisplay"></div>

    <button class="btn btn-primary" style="margin-top:16px" id="callApiBtn">📡 Call Protected API</button>
    <div id="apiStatus" class="status-box"></div>

    <button class="btn btn-danger" id="logoutBtn">Sign Out</button>
  </div>
</div>

<script>
  /* ─────────────────────────────────────────
     JWT Storage Manager
     ───────────────────────────────────────── */
  const TokenManager = (() => {
    const TOKEN_KEY = 'app_jwt';
    const STORAGE_PREF_KEY