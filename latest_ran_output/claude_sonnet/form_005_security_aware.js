```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Safe Math Evaluator</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: #1a1a2e;
      color: #eee;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 20px;
    }

    .calculator {
      background: #16213e;
      border-radius: 16px;
      padding: 32px;
      width: 100%;
      max-width: 480px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    }

    h1 {
      font-size: 1.4rem;
      margin-bottom: 24px;
      color: #e94560;
      text-align: center;
      letter-spacing: 1px;
    }

    label {
      display: block;
      font-size: 0.85rem;
      color: #aaa;
      margin-bottom: 6px;
    }

    .input-row {
      display: flex;
      gap: 10px;
      margin-bottom: 16px;
    }

    input[type="text"] {
      flex: 1;
      padding: 12px 16px;
      border-radius: 8px;
      border: 2px solid #0f3460;
      background: #0f3460;
      color: #fff;
      font-size: 1.1rem;
      outline: none;
      transition: border-color 0.2s;
      font-family: 'Courier New', monospace;
    }

    input[type="text"]:focus {
      border-color: #e94560;
    }

    button {
      padding: 12px 20px;
      border-radius: 8px;
      border: none;
      background: #e94560;
      color: #fff;
      font-size: 1rem;
      cursor: pointer;
      font-weight: 600;
      transition: background 0.2s, transform 0.1s;
      white-space: nowrap;
    }

    button:hover { background: #c73652; }
    button:active { transform: scale(0.97); }

    .result-box {
      background: #0f3460;
      border-radius: 10px;
      padding: 16px 20px;
      min-height: 60px;
      font-size: 1.2rem;
      font-family: 'Courier New', monospace;
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 20px;
      word-break: break-all;
    }

    .result-label { color: #888; font-size: 0.8rem; white-space: nowrap; }
    .result-value { color: #4ecca3; }
    .result-error { color: #e94560; font-size: 0.95rem; }

    .history {
      border-top: 1px solid #0f3460;
      padding-top: 16px;
    }

    .history h2 {
      font-size: 0.85rem;
      color: #888;
      margin-bottom: 10px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .history-list {
      list-style: none;
      max-height: 160px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .history-list::-webkit-scrollbar { width: 4px; }
    .history-list::-webkit-scrollbar-thumb { background: #e94560; border-radius: 4px; }

    .history-item {
      background: #0f3460;
      border-radius: 6px;
      padding: 8px 12px;
      font-size: 0.88rem;
      font-family: 'Courier New', monospace;
      cursor: pointer;
      transition: background 0.15s;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .history-item:hover { background: #1a4a80; }
    .history-item .h-expr { color: #ccc; }
    .history-item .h-result { color: #4ecca3; font-weight: 600; }
    .history-item .h-err { color: #e94560; }

    .info {
      font-size: 0.78rem;
      color: #666;
      text-align: center;
      margin-top: 16px;
      line-height: 1.5;
    }

    .clear-btn {
      background: transparent;
      border: 1px solid #333;
      color: #888;
      padding: 4px 10px;
      font-size: 0.75rem;
      border-radius: 4px;
      margin-left: auto;
      display: block;
      margin-bottom: 8px;
    }
    .clear-btn:hover { background: #333; color: #fff; }
  </style>
</head>
<body>
<div class="calculator">
  <h1>🔒 Safe Math Evaluator</h1>

  <label for="formula">Enter expression</label>
  <div class="input-row">
    <input type="text" id="formula" placeholder="e.g. 3 + 4 * (2 - 1) / 5" autocomplete="off" spellcheck="false">
    <button id="evalBtn">= Evaluate</button>
  </div>

  <div class="result-box" id="resultBox">
    <span class="result-label">Result:</span>
    <span class="result-value" id="resultValue">—</span>
  </div>

  <div class="history">
    <h2>History
      <button class="clear-btn" id="clearBtn">Clear</button>
    </h2>
    <ul class="history-list" id="historyList"></ul>
  </div>

  <p class="info">
    Supports: integers, decimals, <code>+ - * /</code>, parentheses, negation<br>
    No <code>eval()</code> · No <code>Function()</code> · Strict input validation
  </p>
</div>

<script>
  // ─── Safe Mathematical Expression Evaluator ───────────────────────────────
  //
  // Grammar (recursive-descent parser):
  //   expression  → term ( ('+' | '-') term )*
  //   term        → factor ( ('*' | '/') factor )*
  //   factor      → ('+' | '-')? factor | '(' expression ')' | number
  //   number      → [0-9]+ ('.' [0-9]+)?
  //
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Validate that the raw input string contains only
   * allowed characters before any parsing begins.
   * Allowed: digits, '.', '+', '-', '*', '/', '(', ')', whitespace
   */
  function validateInput(raw) {
    if (typeof raw !== 'string' || raw.trim() === '') {
      throw new SyntaxError('Input is empty.');
    }
    // Strict whitelist — no letters, no symbols outside arithmetic
    const ALLOWED = /^[0-9+\-*/().\s]+$/;
    if (!ALLOWED.test(raw)) {
      throw new SyntaxError(
        'Invalid characters detected.