<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Safe Formula Evaluator</title>
</head>
<body>
<h1>Formula Evaluator</h1>
<input type="text" id="formula" placeholder="e.g. 2 + 3 * 4 - 1" size="40">
<button id="evalBtn">Evaluate</button>
<p id="result"></p>

<script>
(function () {
  'use strict';

  // Tokenizer: converts a validated string into tokens.
  function tokenize(input) {
    const tokens = [];
    let i = 0;
    const len = input.length;

    while (i < len) {
      const ch = input[i];

      if (ch === ' ' || ch === '\t') {
        i++;
        continue;
      }

      if (ch === '+' || ch === '-' || ch === '*' || ch === '/' ||
          ch === '(' || ch === ')') {
        tokens.push({ type: 'op', value: ch });
        i++;
        continue;
      }

      // Number: digits with optional single decimal point.
      if ((ch >= '0' && ch <= '9') || ch === '.') {
        let numStr = '';
        let dotSeen = false;
        while (i < len) {
          const c = input[i];
          if (c >= '0' && c <= '9') {
            numStr += c;
            i++;
          } else if (c === '.' && !dotSeen) {
            dotSeen = true;
            numStr += c;
            i++;
          } else {
            break;
          }
        }
        if (numStr === '' || numStr === '.') {
          throw new Error('Invalid number in expression.');
        }
        tokens.push({ type: 'num', value: parseFloat(numStr) });
        continue;
      }

      throw new Error('Unexpected character: "' + ch + '"');
    }

    return tokens;
  }

  // Recursive descent parser.
  // Grammar:
  //   expr   -> term (('+' | '-') term)*
  //   term   -> factor (('*' | '/') factor)*
  //   factor -> number | '(' expr ')' | ('+' | '-') factor
  function parseAndEvaluate(tokens) {
    let pos = 0;

    function peek() {
      return tokens[pos];
    }

    function next() {
      return tokens[pos++];
    }

    function expectValue(v) {
      const t = next();
      if (!t || t.value !== v) {
        throw new Error('Expected "' + v + '".');
      }
    }

    function parseExpr() {
      let value = parseTerm();
      while (peek() && (peek().value === '+' || peek().value === '-')) {
        const op = next().value;
        const right = parseTerm();
        value = op === '+' ? value + right : value - right;
      }
      return value;
    }

    function parseTerm() {
      let value = parseFactor();
      while (peek() && (peek().value === '*' || peek().value === '/')) {
        const op = next().value;
        const right = parseFactor();
        if (op === '*') {
          value = value * right;
        } else {
          if (right === 0) {
            throw new Error('Division by zero.');
          }
          value = value / right;
        }
      }
      return value;
    }

    function parseFactor() {
      const t = peek();
      if (!t) {
        throw new Error('Unexpected end of expression.');
      }
      if (t.value === '+' || t.value === '-') {
        next();
        const val = parseFactor();
        return t.value === '-' ? -val : val;
      }
      if (t.value === '(') {
        next();
        const val = parseExpr();
        expectValue(')');
        return val;
      }
      if (t.type === 'num') {
        next();
        return t.value;
      }
      throw new Error('Unexpected token: "' + t.value + '".');
    }

    const result = parseExpr();
    if (pos !== tokens.length) {
      throw new Error('Unexpected trailing tokens.');
    }
    return result;
  }

  // Public entry point.
  function evaluateFormula(input) {
    if (typeof input !== 'string') {
      throw new Error('Input must be a string.');
    }

    // Reject anything that is not a digit, operator, dot, parens or whitespace.
    if (!/^[0-9+\-*/().\s]+$/.test(input)) {
      throw new Error('Input contains invalid characters.');
    }

    const tokens = tokenize(input);
    if (tokens.length === 0) {
      throw new Error('Empty expression.');
    }

    const result = parseAndEvaluate(tokens);

    if (!isFinite(result)) {
      throw new Error('Result is not a finite number.');
    }
    return result;
  }

  // Expose for reuse if needed.
  window.evaluateFormula = evaluateFormula;

  // Wire up the demo UI.
  const btn = document.getElementById('evalBtn');
  const inputEl = document.getElementById('formula');
  const resultEl = document.getElementById('result');

  function run() {
    const value = inputEl.value;
    try {
      const out = evaluateFormula(value);
      resultEl.textContent = 'Result: ' + out;
      resultEl.style.color = 'green';
    } catch (err) {
      resultEl.textContent = 'Error: ' + err.message;
      resultEl.style.color = 'red';
    }
  }

  btn.addEventListener('click', run);
  inputEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') run();
  });
})();
</script>
</body>
</html>