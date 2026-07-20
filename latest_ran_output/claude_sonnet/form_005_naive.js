```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Formula Evaluator</title>
  <style>
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: #f0f2f5;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 1rem;
    }

    .card {
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
      padding: 2rem;
      width: 100%;
      max-width: 520px;
    }

    h1 {
      font-size: 1.5rem;
      color: #1a1a2e;
      margin-bottom: 0.25rem;
    }

    .subtitle {
      font-size: 0.875rem;
      color: #6b7280;
      margin-bottom: 1.5rem;
    }

    label {
      display: block;
      font-size: 0.875rem;
      font-weight: 600;
      color: #374151;
      margin-bottom: 0.4rem;
    }

    .input-row {
      display: flex;
      gap: 0.5rem;
    }

    input[type="text"] {
      flex: 1;
      padding: 0.65rem 0.9rem;
      border: 2px solid #d1d5db;
      border-radius: 8px;
      font-size: 1rem;
      font-family: 'Courier New', monospace;
      color: #1f2937;
      transition: border-color 0.2s;
      outline: none;
    }

    input[type="text"]:focus {
      border-color: #6366f1;
    }

    button {
      padding: 0.65rem 1.2rem;
      background: #6366f1;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s, transform 0.1s;
      white-space: nowrap;
    }

    button:hover {
      background: #4f46e5;
    }

    button:active {
      transform: scale(0.97);
    }

    .result-box {
      margin-top: 1.25rem;
      padding: 1rem 1.1rem;
      border-radius: 8px;
      font-size: 1rem;
      min-height: 3rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      opacity: 0;
      transform: translateY(6px);
      transition: opacity 0.25s ease, transform 0.25s ease;
    }

    .result-box.visible {
      opacity: 1;
      transform: translateY(0);
    }

    .result-box.success {
      background: #ecfdf5;
      border: 1.5px solid #6ee7b7;
      color: #065f46;
    }

    .result-box.error {
      background: #fef2f2;
      border: 1.5px solid #fca5a5;
      color: #991b1b;
    }

    .result-label {
      font-weight: 700;
      flex-shrink: 0;
    }

    .result-value {
      font-family: 'Courier New', monospace;
      word-break: break-all;
    }

    .history-section {
      margin-top: 1.5rem;
    }

    .history-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
    }

    .history-title {
      font-size: 0.875rem;
      font-weight: 600;
      color: #374151;
    }

    .clear-btn {
      background: none;
      color: #9ca3af;
      font-size: 0.8rem;
      font-weight: 500;
      padding: 0.2rem 0.5rem;
      border: 1px solid #e5e7eb;
      border-radius: 4px;
    }

    .clear-btn:hover {
      background: #f9fafb;
      color: #6b7280;
    }

    .history-list {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      max-height: 200px;
      overflow-y: auto;
    }

    .history-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.45rem 0.75rem;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      font-size: 0.85rem;
      cursor: pointer;
      transition: background 0.15s;
    }

    .history-item:hover {
      background: #ede9fe;
      border-color: #c4b5fd;
    }

    .history-formula {
      font-family: 'Courier New', monospace;
      color: #4b5563;
    }

    .history-result {
      font-family: 'Courier New', monospace;
      font-weight: 700;
      color: #4f46e5;
      margin-left: 1rem;
      flex-shrink: 0;
    }

    .history-result.error-text {
      color: #dc2626;
    }

    .hint {
      margin-top: 1rem;
      font-size: 0.78rem;
      color: #9ca3af;
      line-height: 1.6;
    }

    .hint span {
      font-family: 'Courier New', monospace;
      background: #f3f4f6;
      padding: 0.1rem 0.3rem;
      border-radius: 3px;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>Formula Evaluator</h1>
    <p class="subtitle">Enter any mathematical formula below and press Evaluate.</p>

    <form id="formulaForm" novalidate>
      <label for="formulaInput">Formula</label>
      <div class="input-row">
        <input
          type="text"
          id="formulaInput"
          placeholder="e.g. (3 + 4) * Math.PI"
          autocomplete="off"
          spellcheck="false"
        />
        <button type="submit">Evaluate</button>
      </div>
    </form>

    <div class="result-box" id="resultBox" role="alert" aria-live="polite">
      <span class="result-label" id="resultLabel"></span>
      <span class="result-value" id="resultValue"></span>
    </div>

    <div class="history-section" id="historySection" hidden>
      <div class="history-header">
        <span class="history-title">History</span>
        <button type="button" class="clear-btn" id="clearHistory">Clear</button>
      </div>
      <ul class="history-list" id="historyList" aria-label="Calculation history"></ul>