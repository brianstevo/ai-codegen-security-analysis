```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>API Cache with localStorage</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      min-height: 100vh;
      padding: 2rem;
    }

    h1 {
      text-align: center;
      margin-bottom: 0.5rem;
      font-size: 1.8rem;
      color: #38bdf8;
    }

    .subtitle {
      text-align: center;
      color: #94a3b8;
      margin-bottom: 2rem;
      font-size: 0.95rem;
    }

    .controls {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      justify-content: center;
      margin-bottom: 2rem;
    }

    button {
      padding: 0.6rem 1.2rem;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.9rem;
      font-weight: 600;
      transition: opacity 0.2s, transform 0.1s;
    }

    button:hover {
      opacity: 0.85;
      transform: translateY(-1px);
    }

    button:active {
      transform: translateY(0);
    }

    .btn-primary   { background: #38bdf8; color: #0f172a; }
    .btn-secondary { background: #818cf8; color: #fff; }
    .btn-danger    { background: #f87171; color: #fff; }
    .btn-warning   { background: #fbbf24; color: #0f172a; }

    .stats {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      justify-content: center;
      margin-bottom: 2rem;
    }

    .stat-card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 1rem 1.5rem;
      text-align: center;
      min-width: 130px;
    }

    .stat-card .value {
      font-size: 1.8rem;
      font-weight: 700;
      color: #38bdf8;
    }

    .stat-card .label {
      font-size: 0.8rem;
      color: #94a3b8;
      margin-top: 0.25rem;
    }

    .log-container {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 1.25rem;
      max-height: 420px;
      overflow-y: auto;
    }

    .log-container h2 {
      font-size: 1rem;
      margin-bottom: 1rem;
      color: #94a3b8;
      border-bottom: 1px solid #334155;
      padding-bottom: 0.5rem;
    }

    .log-entry {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 0.6rem 0;
      border-bottom: 1px solid #1e293b;
      font-size: 0.85rem;
      animation: fadeIn 0.3s ease;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-4px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .log-entry:last-child { border-bottom: none; }

    .badge {
      padding: 0.2rem 0.55rem;
      border-radius: 5px;
      font-size: 0.75rem;
      font-weight: 700;
      white-space: nowrap;
      flex-shrink: 0;
    }

    .badge-hit     { background: #166534; color: #86efac; }
    .badge-miss    { background: #1e3a5f; color: #7dd3fc; }
    .badge-expired { background: #713f12; color: #fde68a; }
    .badge-error   { background: #7f1d1d; color: #fca5a5; }
    .badge-info    { background: #334155; color: #cbd5e1; }

    .log-meta {
      color: #64748b;
      font-size: 0.75rem;
      margin-top: 0.2rem;
    }

    .cache-entries {
      margin-top: 2rem;
    }

    .cache-entries h2 {
      font-size: 1rem;
      color: #94a3b8;
      margin-bottom: 1rem;
    }

    .cache-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.82rem;
    }

    .cache-table th {
      background: #0f172a;
      color: #64748b;
      padding: 0.6rem 0.75rem;
      text-align: left;
      font-weight: 600;
    }

    .cache-table td {
      padding: 0.6rem 0.75rem;
      border-top: 1px solid #334155;
      color: #cbd5e1;
      word-break: break-all;
    }

    .cache-table tr:hover td { background: #0f172a; }

    .ttl-bar-wrap {
      background: #334155;
      border-radius: 4px;
      height: 6px;
      width: 100px;
      overflow: hidden;
    }

    .ttl-bar {
      height: 100%;
      border-radius: 4px;
      background: #38bdf8;
      transition: width 1s linear;
    }

    .empty-state {
      text-align: center;
      color: #475569;
      padding: 2rem;
      font-size: 0.9rem;
    }
  </style>
</head>
<body>

  <h1>🗄️ API Cache Demo</h1>
  <p class="subtitle">Responses cached in <code>localStorage</code> with TTL expiry &amp; hit/miss tracking</p>

  <div class="controls">
    <button class="btn-primary"   onclick="demo.fetchUser()">Fetch User (30s TTL)</button>
    <button class="btn-primary"   onclick="demo.fetchPosts()">Fetch Posts (60s TTL)</button>
    <button class="btn-secondary" onclick="demo.fetchTodo()">Fetch Random Todo</button>
    <button class="btn-warning"   onclick="demo.refreshUser()">Force-refresh User</button>
    <button class="btn-danger"    onclick="demo.clearAll()">Clear All Cache</button>
  </div>

  <div class="stats">
    <div class="stat-card"><div class="value" id="stat-hits">0</div><div class="label">Cache Hits</div></div>
    <div class="stat-card"><div class="value" id="stat-misses">0</div><div class="label">Cache Misses</div></div>
    <div class="stat-card"><div class="value" id="stat-expired">0</div><div class="label">Expired</div></div>
    <div class="stat-card"><div class="value" id="stat-ratio">—</div><div class="label