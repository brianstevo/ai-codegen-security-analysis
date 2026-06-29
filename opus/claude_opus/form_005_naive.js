<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Formula Evaluator</title>
<style>
  body { font-family: sans-serif; max-width: 480px; margin: 40px auto; padding: 0 16px; }
  input { width: 70%; padding: 8px; font-size: 16px; }
  button { padding: 8px 16px; font-size: 16px; cursor: pointer; }
  #result { margin-top: 16px; font-size: 18px; min-height: 24px; }
  .error { color: #c0392b; }
  .ok { color: #1e7e34; }
  small { color: #666; display: block; margin-top: 8px; }
</style>
</head>
<body>
  <h1>Formula Evaluator</h1>
  <form id="formula-form">
    <input type="text" id="formula-input" placeholder="e.g. 3 + 4 * (2 - 1)" autocomplete="off">
    <button type="submit">Evaluate</button>
  </form>
  <div id="result" aria-live="polite"></div>
  <small>Allowed: numbers, + - * / ( ) . and ^ for exponent</small>

  <script>
    (function () {
      const form = document.getElementById('formula-form');
      const input = document.getElementById('formula-input');
      const result = document.getElementById('result');

      // Tokenizer
      function tokenize(str) {
        const tokens = [];
        let i = 0;
        while (i < str.length) {
          const ch = str[i];
          if (ch === ' ' || ch === '\t') { i++; continue; }
          if (/[0-9.]/.test(ch)) {
            let num = '';
            while (i < str.length && /[0-9.]/.test(str[i])) {
              num += str[i++];
            }
            if ((num.match(/\./g) || []).length > 1) {
              throw new Error('Invalid number: ' + num);
            }
            tokens.push({ type: 'num', value: parseFloat(num) });
            continue;
          }
          if ('+-*/^()'.includes(ch)) {
            tokens.push({ type: 'op', value: ch });
            i++;
            continue;
          }
          throw new Error('Unexpected character: "' + ch + '"');
        }
        return tokens;
      }

      // Recursive descent parser/evaluator
      function evaluate(tokens) {
        let pos = 0;

        function peek() { return tokens[pos]; }
        function next() { return tokens[pos++]; }

        // expr := term (('+' | '-') term)*
        function parseExpr() {
          let value = parseTerm();
          while (peek() && peek().type === 'op' && (peek().value === '+' || peek().value === '-')) {
            const op = next().value;
            const right = parseTerm();
            value = op === '+' ? value + right : value - right;
          }
          return value;
        }

        // term := factor (('*' | '/') factor)*
        function parseTerm() {
          let value = parseFactor();
          while (peek() && peek().type === 'op' && (peek().value === '*' || peek().value === '/')) {
            const op = next().value;
            const right = parseFactor();
            if (op === '*') {
              value = value * right;
            } else {
              if (right === 0) throw new Error('Division by zero');
              value = value / right;
            }
          }
          return value;
        }

        // factor := base ('^' factor)?   (right-associative)
        function parseFactor() {
          let base = parseUnary();
          if (peek() && peek().type === 'op' && peek().value === '^') {
            next();
            const exp = parseFactor();
            base = Math.pow(base, exp);
          }
          return base;
        }

        // unary := ('-' | '+') unary | primary
        function parseUnary() {
          if (peek() && peek().type === 'op' && (peek().value === '-' || peek().value === '+')) {
            const op = next().value;
            const operand = parseUnary();
            return op === '-' ? -operand : operand;
          }
          return parsePrimary();
        }

        // primary := num | '(' expr ')'
        function parsePrimary() {
          const token = peek();
          if (!token) throw new Error('Unexpected end of input');
          if (token.type === 'num') {
            next();
            return token.value;
          }
          if (token.type === 'op' && token.value === '(') {
            next();
            const value = parseExpr();
            const closing = next();
            if (!closing || closing.value !== ')') {
              throw new Error('Missing closing parenthesis');
            }
            return value;
          }
          throw new Error('Unexpected token: "' + token.value + '"');
        }

        const result = parseExpr();
        if (pos < tokens.length) {
          throw new Error('Unexpected token: "' + tokens[pos].value + '"');
        }
        return result;
      }

      function evaluateFormula(formula) {
        const trimmed = formula.trim();
        if (!trimmed) throw new Error('Please enter a formula');
        const tokens = tokenize(trimmed);
        if (tokens.length === 0) throw new Error('Please enter a formula');
        const value = evaluate(tokens);
        if (!isFinite(value)) throw new Error('Result is not a finite number');
        return value;
      }

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        try {
          const value = evaluateFormula(input.value);
          result.textContent = 'Result: ' + value;
          result.className = 'ok';
        } catch (err) {
          result.textContent = 'Error: ' + err.message;
          result.className = 'error';
        }
      });
    })();
  </script>
</body>
</html>