```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>LocalStorage API Cache Demo</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 40px 20px;
    }

    h1 {
      font-size: 1.8rem;
      margin-bottom: 8px;
      color: #38bdf8;
    }

    p.subtitle {
      color: #94a3b8;
      margin-bottom: 32px;
      text-align: center;
    }

    .card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 24px;
      width: 100%;
      max-width: 680px;
      margin-bottom: 24px;
    }

    .card h2 {
      font-size: 1rem;
      color: #7dd3fc;
      margin-bottom: 16px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .controls {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-bottom: 16px;
    }

    input[type="text"] {
      flex: 1;
      min-width: 180px;
      padding: 10px 14px;
      border-radius: 8px;
      border: 1px solid #475569;
      background: #0f172a;
      color: #e2e8f0;
      font-size: 0.9rem;
      outline: none;
      transition: border-color 0.2s;
    }

    input[type="text"]:focus { border-color: #38bdf8; }

    button {
      padding: 10px 18px;
      border-radius: 8px;
      border: none;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.2s, transform 0.1s;
    }

    button:active { transform: scale(0.97); }
    button:disabled { opacity: 0.5; cursor: not-allowed; }

    .btn-primary  { background: #0ea5e9; color: #fff; }
    .btn-danger   { background: #ef4444; color: #fff; }
    .btn-warning  { background: #f59e0b; color: #0f172a; }
    .btn-neutral  { background: #334155; color: #e2e8f0; }

    .status-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.85rem;
      margin-bottom: 14px;
      padding: 10px 14px;
      border-radius: 8px;
      background: #0f172a;
      border: 1px solid #334155;
    }

    .badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
    }

    .badge-hit    { background: #14532d; color: #4ade80; }
    .badge-miss   { background: #1e3a5f; color: #60a5fa; }
    .badge-error  { background: #450a0a; color: #f87171; }
    .badge-idle   { background: #1e293b; color: #64748b; }

    .result-box {
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 8px;
      padding: 14px;
      font-size: 0.82rem;
      color: #94a3b8;
      white-space: pre-wrap;
      word-break: break-all;
      max-height: 260px;
      overflow-y: auto;
      line-height: 1.6;
    }

    .result-box .key   { color: #7dd3fc; }
    .result-box .str   { color: #86efac; }
    .result-box .num   { color: #fda4af; }
    .result-box .bool  { color: #fbbf24; }
    .result-box .null  { color: #c084fc; }

    .cache-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 280px;
      overflow-y: auto;
    }

    .cache-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 8px;
      font-size: 0.82rem;
    }

    .cache-item .cache-key {
      flex: 1;
      color: #7dd3fc;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .cache-item .cache-meta {
      color: #64748b;
      white-space: nowrap;
    }

    .cache-item .cache-expired { color: #ef4444; }

    .progress {
      height: 3px;
      background: #334155;
      border-radius: 3px;
      overflow: hidden;
      margin-bottom: 14px;
    }

    .progress-bar {
      height: 100%;
      background: #38bdf8;
      width: 0%;
      transition: width 0.3s;
    }

    .empty-state {
      text-align: center;
      color: #475569;
      padding: 20px;
      font-size: 0.9rem;
    }

    .ttl-row {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 14px;
      font-size: 0.85rem;
      color: #94a3b8;
    }

    .ttl-row label { white-space: nowrap; }

    input[type="range"] {
      flex: 1;
      accent-color: #38bdf8;
    }

    #ttlDisplay {
      min-width: 60px;
      text-align: right;
      color: #38bdf8;
      font-weight: 600;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-bottom: 14px;
    }

    .stat-box {
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 8px;
      padding: 12px;
      text-align: center;
    }

    .stat-box .stat-val {
      font-size: 1.5rem;
      font-weight: 700;
      color: #38bdf8;
    }

    .stat-box .stat-label {
      font-size: 0.72rem;
      color: #64748b;
      text-transform: uppercase;
      margin-top: 2px;
    }

    ::-webkit-scrollbar { width: 6px; }