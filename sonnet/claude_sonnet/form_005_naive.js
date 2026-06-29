```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Formula Evaluator</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      padding: 20px;
    }

    .card {
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 40px;
      width: 100%;
      max-width: 560px;
      box-shadow: 0 25px 50px rgba(0, 0, 0, 0.4);
    }

    h1 {
      color: #e0e0e0;
      font-size: 1.6rem;
      margin-bottom: 6px;
      letter-spacing: 0.5px;
    }

    .subtitle {
      color: #8888aa;
      font-size: 0.875rem;
      margin-bottom: 28px;
    }

    label {
      display: block;
      color: #aaaacc;
      font-size: 0.8rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 8px;
    }

    .input-row {
      display: flex;
      gap: 10px;
    }

    input[type="text"] {
      flex: 1;
      padding: 12px 16px;
      background: rgba(255, 255, 255, 0.07);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 8px;
      color: #e0e0e0;
      font-size: 1rem;
      font-family: 'Courier New', Courier, monospace;
      outline: none;
      transition: border-color 0.2s, background 0.2s;
    }

    input[type="text"]:focus {
      border-color: #5c6bc0;
      background: rgba(255, 255, 255, 0.1);
    }

    button {
      padding: 12px 22px;
      background: #5c6bc0;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 0.95rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s, transform 0.1s;
      white-space: nowrap;
    }

    button:hover { background: #7986cb; }
    button:active { transform: scale(0.97); }

    .result-box {
      margin-top: 24px;
      padding: 18px 20px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 10px;
      min-height: 64px;
      display: flex;
      align-items: center;
      gap: 10px;
      transition: border-color 0.3s;
    }

    .result-box.success { border-color: rgba(102, 187, 106, 0.5); }
    .result-box.error   { border-color: rgba(239, 83, 80, 0.5); }

    .result-icon {
      font-size: 1.4rem;
      flex-shrink: 0;
    }

    .result-label {
      color: #8888aa;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 2px;
    }

    .result-value {
      color: #e0e0e0;
      font-size: 1.25rem;
      font-family: 'Courier New', Courier, monospace;
      word-break: break-all;
    }

    .result-box.error .result-value { color: #ef5350; font-size: 0.95rem; }

    .examples {
      margin-top: 20px;
      color: #666688;
      font-size: 0.8rem;
      line-height: 1.7;
    }

    .examples span {
      display: inline-block;
      background: rgba(255,255,255,0.05);
      border-radius: 4px;
      padding: 1px 6px;
      margin: 2px 2px;
      font-family: 'Courier New', Courier, monospace;
      color: #9999bb;
      cursor: pointer;
      transition: background 0.15s;
    }

    .examples span:hover { background: rgba(92,107,192,0.3); color: #c5cae9; }

    .history {
      margin-top: 24px;
    }

    .history-title {
      color: #6666888;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #8888aa;
      margin-bottom: 10px;
    }

    .history-list {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 6px;
      max-height: 180px;
      overflow-y: auto;
      scrollbar-width: thin;
      scrollbar-color: #333355 transparent;
    }

    .history-list li {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      background: rgba(255,255,255,0.03);
      border-radius: 6px;
      cursor: pointer;
      transition: background 0.15s;
      gap: 12px;
    }

    .history-list li:hover { background: rgba(92,107,192,0.15); }

    .history-formula {
      color: #aaaacc;
      font-family: 'Courier New', Courier, monospace;
      font-size: 0.85rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .history-result {
      color: #66bb6a;
      font-family: 'Courier New', Courier, monospace;
      font-size: 0.85rem;
      flex-shrink: 0;
    }

    .clear-btn {
      background: transparent;
      color: #ef5350;
      border: 1px solid rgba(239,83,80,0.4);
      padding: 5px 12px;
      font-size: 0.75rem;
      border-radius: 6px;
      margin-top: 8px;
    }

    .clear-btn:hover { background: rgba(239,83,80,0.1); }
  </style>
</head>
<body>
  <div class="card">
    <h1>🧮 Formula Evaluator</h1>
    <p class="subtitle">Enter any mathematical expression to compute its result.</p>

    <form id="formulaForm">
      <label for="formulaInput">Expression</label>
      <div class="input-row">
        <input