```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Logout Demo</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 2.5rem;
      width: 100%;
      max-width: 440px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }

    h1 {
      font-size: 1.5rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
      color: #f1f5f9;
    }

    p.subtitle {
      font-size: 0.875rem;
      color: #94a3b8;
      margin-bottom: 2rem;
    }

    .state-display {
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 8px;
      padding: 1rem;
      margin-bottom: 1.5rem;
      font-family: 'Courier New', monospace;
      font-size: 0.8rem;
    }

    .state-display h3 {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #64748b;
      margin-bottom: 0.75rem;
      font-family: system-ui, sans-serif;
    }

    .state-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.25rem 0;
      border-bottom: 1px solid #1e293b;
      gap: 1rem;
    }

    .state-item:last-child { border-bottom: none; }

    .state-key { color: #7dd3fc; }
    .state-value { color: #86efac; word-break: break-all; text-align: right; }
    .state-value.empty { color: #475569; font-style: italic; }

    .log-container {
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 8px;
      padding: 1rem;
      margin-bottom: 1.5rem;
      min-height: 120px;
      max-height: 200px;
      overflow-y: auto;
    }

    .log-container h3 {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #64748b;
      margin-bottom: 0.75rem;
    }

    .log-entry {
      font-family: 'Courier New', monospace;
      font-size: 0.78rem;
      padding: 0.2rem 0;
      display: flex;
      gap: 0.75rem;
      align-items: flex-start;
      animation: fadeIn 0.2s ease;
    }

    @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }

    .log-time { color: #475569; white-space: nowrap; flex-shrink: 0; }
    .log-info    { color: #7dd3fc; }
    .log-success { color: #86efac; }
    .log-warning { color: #fde68a; }
    .log-error   { color: #fca5a5; }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      width: 100%;
      padding: 0.75rem 1.5rem;
      border: none;
      border-radius: 8px;
      font-size: 0.95rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
      position: relative;
      overflow: hidden;
    }

    .btn-logout {
      background: linear-gradient(135deg, #ef4444, #dc2626);
      color: white;
    }

    .btn-logout:hover:not(:disabled) {
      background: linear-gradient(135deg, #f87171, #ef4444);
      transform: translateY(-1px);
      box-shadow: 0 8px 20px rgba(239, 68, 68, 0.4);
    }

    .btn-logout:active:not(:disabled) { transform: translateY(0); }

    .btn-logout:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }

    .btn-seed {
      background: #334155;
      color: #cbd5e1;
      margin-bottom: 0.75rem;
      font-size: 0.85rem;
      padding: 0.6rem 1.5rem;
    }

    .btn-seed:hover:not(:disabled) {
      background: #475569;
      transform: translateY(-1px);
    }

    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
      display: none;
    }

    .btn-logout.loading .spinner { display: block; }
    .btn-logout.loading .btn-label { opacity: 0.7; }

    @keyframes spin { to { transform: rotate(360deg); } }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
      margin-bottom: 1.5rem;
    }

    .status-active { background: rgba(134, 239, 172, 0.15); color: #86efac; border: 1px solid rgba(134, 239, 172, 0.3); }
    .status-processing { background: rgba(251, 191, 36, 0.15); color: #fbbf24; border: 1px solid rgba(251, 191, 36, 0.3); }
    .status-done { background: rgba(148, 163, 184, 0.15); color: #94a3b8; border: 1px solid rgba(148, 163, 184, 0.3); }

    .dot {
      width: 6px; height: 6px;
      border-radius: 50%;
      background: currentColor;
    }

    .dot.pulse { animation: pulse 1.5s ease infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }

    .note {
      font-size: 0.75rem;
      color: #475569;
      text-align: center;
      margin-top: 1rem;
      line-height: 1.5;
    }
  </style>
</head>
<body>

<div class="card">
  <h1>Session