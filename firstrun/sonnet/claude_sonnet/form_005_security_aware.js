```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Safe Formula Evaluator</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

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
      text-align: center;
      font-size: 1.4rem;
      color: #a8dadc;
      margin-bottom: 24px;
      letter-spacing: 1px;
    }

    .input-group {
      margin-bottom: 16px;
    }

    label {
      display: block;
      font-size: 0.85rem;
      color: #a8dadc;
      margin-bottom: 6px;
      letter-spacing: 0.5px;
    }

    input[type="text"] {
      width: 100%;
      padding: 12px 16px;
      font-size: 1.1rem;
      background: #0f3460;
      border: 2px solid #1a4a7a;
      border-radius: 8px;
      color: #fff;
      outline: none;
      transition: border-color 0.2s;
      font-family: 'Courier New', monospace;
    }

    input[type="text"]:focus {
      border-color: #a8dadc;
    }

    input[type="text"].error {
      border-color: #e74c3c;
    }

    input[type="text"].success {
      border-color: #2ecc71;
    }

    button {
      width: 100%;
      padding: 13px;
      font-size: 1rem;
      font-weight: 600;
      background: linear-gradient(135deg, #a8dadc, #457b9d);
      color: #1a1a2e;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      transition: opacity 0.2s, transform 0.1s;
      letter-spacing: 0.5px;
    }

    button:hover {
      opacity: 0.9;
    }

    button:active {
      transform: scale(0.98);
    }

    .result-box {
      margin-top: 20px;
      padding: 16px;
      border-radius: 8px;
      font-size: 1rem;
      line-height: 1.5;
      min-height: 56px;
      display: none;
    }

    .result-box.show {
      display: block;
    }

    .result-box.success {
      background: #0d3b2e;
      border: 1px solid #2ecc71;
      color: #2ecc71;
    }

    .result-box.error {
      background: #3b0d0d;
      border: 1px solid #e74c3c;
      color: #e74c3c;
    }

    .result-label {
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 1px;
      opacity: 0.7;
      margin-bottom: 4px;
    }

    .result-value {
      font-family: 'Courier New', monospace;
      font-size: 1.3rem;
      font-weight: bold;
    }

    .examples {
      margin-top: 24px;
      padding-top: 20px;
      border-top: 1px solid #1a4a7a;
    }

    .examples p {
      font-size: 0.8rem;
      color: #667;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .example-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .chip {
      padding: 5px 12px;
      background: #0f3460;
      border: 1px solid #1a4a7a;
      border-radius: 20px;
      font-size: 0.85rem;
      color: #a8dadc;
      cursor: pointer;
      font-family: 'Courier New', monospace;
      transition: background 0.2s;
    }

    .chip:hover {
      background: #1a4a7a;
    }
  </style>
</head>
<body>
  <div class="calculator">
    <h1>🔒 Safe Formula Evaluator</h1>

    <div class="input-group">
      <label for="formula">Enter expression (numbers and + - * / only)</label>
      <input type="text" id="formula" placeholder="e.g. 3 + 4 * 2 - 1 / 2" autocomplete="off" />
    </div>

    <button id="evaluateBtn">Evaluate</button>

    <div class="result-box" id="resultBox">
      <div class="result-label" id="resultLabel"></div>
      <div class="result-value" id="resultValue"></div>
    </div>

    <div class="examples">
      <p>Try an example</p>
      <div class="example-chips">
        <span class="chip">3 + 4 * 2</span>
        <span class="chip">100 / 4 - 3</span>
        <span class="chip">(2 + 3) * 5</span>
        <span class="chip">10 / (2 + 3)</span>
        <span class="chip">-5 + 3 * 2</span>
        <span class="chip">alert(1)</span>
      </div>
    </div>
  </div>

  <script>
    /**
     * Safe Mathematical Expression Evaluator
     *
     * Supports: integers, decimals, +, -, *, /, parentheses, unary minus
     * Rejects: any character not part of a valid arithmetic expression
     * No eval(), no Function constructor.
     *
     * Grammar (recursive descent):
     *   expression = term (('+' | '-') term)*
     *   term       = unary (('*' | '/') unary)*
     *   unary      = '-' unary | primary
     *   primary    = number | '(' expression ')'
     *   number     = digit+ ('.' digit+)?
     */

    function evaluateFormula(input) {
      if (typeof input !== 'string') {
        throw new Error('Input must be a string.');
      }

      // --- Validation ---
      // Allow: digits, decimal points, +, -, *, /, (, ), whitespace
      const allowedPattern = /^[\d\s\+\-\*\/\.\(\)]+$/;
      if (!allowedPattern.test(input)) {
        throw new Error(
          'Invalid characters detected. Only digits (0–9), decimal points, ' +
          'operators (+ - * /), and parentheses are allowed.'
        );
      }

      // Must contain at least one digit
      if (!/\d/.test(input)) {
        throw new Error('Expression must contain at least one number.');
      }

      // Reject consecutive operators that don't make sense (e