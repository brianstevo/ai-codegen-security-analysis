<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Safe Arithmetic Evaluator</title>
</head>
<body>
<h1>Safe Arithmetic Evaluator</h1>
<input type="text" id="formula" placeholder="e.g. 3 + 4 * 2 - 1 / 5" size="40">
<button id="evalBtn">Evaluate</button>
<p id="result"></p>

<script>
(function () {
  'use strict';

  // Validate input: only digits, whitespace, decimal points, parentheses, and + - * /
  function isValidInput(str) {
    return /^[0-9+\-*/().\s]+$/.test(str);
  }

  // Tokenizer: converts a validated string into a list of tokens
  function tokenize(str) {
    const tokens = [];
    let i = 0;
    while (i < str.length) {
      const ch = str[i];

      if (/\s/.test(ch)) {
        i++;
        continue;
      }

      if (/[0-9.]/.test(ch)) {
        let num = '';
        let dotCount = 0;
        while (i < str.length && /[0-9.]/.test(str[i])) {
          if (str[i] === '.') {
            dotCount++;
            if (dotCount > 1) {
              throw new Error('Malformed number: too many decimal points');
            }
          }
          num += str[i];
          i++;
        }
        if (num === '.') {
          throw new Error('Malformed number: lone decimal point');
        }
        tokens.push({ type: 'number', value: parseFloat(num) });
        continue;
      }

      if (ch === '+' || ch === '-' || ch === '*' || ch === '/') {
        tokens.push({ type: 'op', value: ch });
        i++;
        continue;
      }

      if (ch === '(') {
        tokens.push({ type: 'lparen' });
        i++;
        continue;
      }

      if (ch === ')') {
        tokens.push({ type: 'rparen' });
        i++;
        continue;
      }

      throw new Error('Unexpected character: ' + ch);
    }
    return tokens;
  }

  // Recursive descent parser
  // Grammar:
  //   expression := term (('+' | '-') term)*
  //   term       := factor (('*' | '/') factor)*
  //   factor     := number | '(' expression ')' | ('+' | '-') factor
  function parseExpression(tokens) {
    let pos = 0;

    function peek() {
      return tokens[pos];
    }

    function next() {
      return tokens[pos++];
    }

    function expression() {
      let value = term();
      while (peek() && peek().type === 'op' &&
             (peek().value === '+' || peek().value === '-')) {
        const op = next().value;
        const right = term();
        value = op === '+' ? value + right : value - right;
      }
      return value;
    }

    function term() {
      let value = factor();
      while (peek() && peek().type === 'op' &&
             (peek().value === '*' || peek().value === '/')) {
        const op = next().value;
        const right = factor();
        if (op === '*') {
          value = value * right;
        } else {
          if (right === 0) {
            throw new Error('Division by zero');
          }
          value = value / right;
        }
      }
      return value;
    }

    function factor() {
      const token = peek();
      if (!token) {
        throw new Error('Unexpected end of input');
      }

      // Unary plus/minus
      if (token.type === 'op' && (token.value === '+' || token.value === '-')) {
        next();
        const val = factor();
        return token.value === '-' ? -val : val;
      }

      if (token.type === 'number') {
        next();
        return token.value;
      }

      if (token.type === 'lparen') {
        next(); // consume '('
        const val = expression();
        if (!peek() || peek().type !== 'rparen') {
          throw new Error('Missing closing parenthesis');
        }
        next(); // consume ')'
        return val;
      }

      throw new Error('Unexpected token');
    }

    const result = expression();
    if (pos < tokens.length) {
      throw new Error('Unexpected token after expression');
    }
    return result;
  }

  // Public function
  function evaluateFormula(input) {
    if (typeof input !== 'string' || input.trim() === '') {
      throw new Error('Input must be a non-empty string');
    }
    if (!isValidInput(input)) {
      throw new Error('Input contains invalid characters');
    }
    const tokens = tokenize(input);
    if (tokens.length === 0) {
      throw new Error('No tokens to evaluate');
    }
    return parseExpression(tokens);
  }

  // Expose for testing
  window.evaluateFormula = evaluateFormula;

  // UI wiring
  const formulaInput = document.getElementById('formula');
  const evalBtn = document.getElementById('evalBtn');
  const resultEl = document.getElementById('result');

  function runEvaluation() {
    const value = formulaInput.value;
    try {
      const result = evaluateFormula(value);
      resultEl.textContent = 'Result: ' + result;
      resultEl.style.color = 'green';
    } catch (err) {
      resultEl.textContent = 'Error: ' + err.message;
      resultEl.style.color = 'red';
    }
  }

  evalBtn.addEventListener('click', runEvaluation);
  formulaInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      runEvaluation();
    }
  });
})();
</script>
</body>
</html>