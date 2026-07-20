```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Formula Evaluator</title>
<style>
  body { font-family: sans-serif; max-width: 480px; margin: 40px auto; padding: 0 16px; }
  input { width: 100%; padding: 8px; font-size: 16px; box-sizing: border-box; }
  button { margin-top: 10px; padding: 8px 16px; font-size: 16px; cursor: pointer; }
  #result { margin-top: 16px; font-size: 18px; min-height: 24px; }
  .error { color: #c00; }
  .ok { color: #060; }
</style>
</head>
<body>
  <h1>Formula Evaluator</h1>
  <form id="formula-form">
    <label for="formula">Enter a formula (e.g. 3 + 4 * (2 - 1)):</label>
    <input type="text" id="formula" name="formula" autocomplete="off" placeholder="3 + 4 * 2">
    <button type="submit">Evaluate</button>
  </form>
  <div id="result"></div>

  <script>
    (function () {
      const form = document.getElementById('formula-form');
      const input = document.getElementById('formula');
      const result = document.getElementById('result');

      // Safe tokenizer + shunting-yard evaluator for arithmetic expressions.
      // Supports + - * / % ^, parentheses, decimals, and unary minus.
      function evaluateFormula(expr) {
        const tokens = tokenize(expr);
        const rpn = toRPN(tokens);
        return evalRPN(rpn);
      }

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
          if ('+-*/%^()'.includes(ch)) {
            tokens.push({ type: 'op', value: ch });
            i++;
            continue;
          }
          throw new Error('Unexpected character: "' + ch + '"');
        }
        return tokens;
      }

      const PRECEDENCE = { '+': 1, '-': 1, '*': 2, '/': 2, '%': 2, '^': 3, 'u-': 4 };
      const RIGHT_ASSOC = { '^': true, 'u-': true };

      function toRPN(tokens) {
        const output = [];
        const stack = [];
        let prev = null;

        for (const tok of tokens) {
          if (tok.type === 'num') {
            output.push(tok);
          } else if (tok.value === '(') {
            stack.push(tok);
          } else if (tok.value === ')') {
            while (stack.length && stack[stack.length - 1].value !== '(') {
              output.push(stack.pop());
            }
            if (!stack.length) throw new Error('Mismatched parentheses');
            stack.pop();
          } else {
            let op = tok.value;
            // Detect unary minus
            if (op === '-' && (prev === null || (prev.type === 'op' && prev.value !== ')'))) {
              op = 'u-';
            }
            while (
              stack.length &&
              stack[stack.length - 1].value !== '(' &&
              (PRECEDENCE[stack[stack.length - 1].value] > PRECEDENCE[op] ||
                (PRECEDENCE[stack[stack.length - 1].value] === PRECEDENCE[op] && !RIGHT_ASSOC[op]))
            ) {
              output.push(stack.pop());
            }
            stack.push({ type: 'op', value: op });
          }
          prev = tok;
        }

        while (stack.length) {
          const t = stack.pop();
          if (t.value === '(' || t.value === ')') throw new Error('Mismatched parentheses');
          output.push(t);
        }
        return output;
      }

      function evalRPN(rpn) {
        const stack = [];
        for (const tok of rpn) {
          if (tok.type === 'num') {
            stack.push(tok.value);
          } else if (tok.value === 'u-') {
            if (stack.length < 1) throw new Error('Invalid expression');
            stack.push(-stack.pop());
          } else {
            if (stack.length < 2) throw new Error('Invalid expression');
            const b = stack.pop();
            const a = stack.pop();
            switch (tok.value) {
              case '+': stack.push(a + b); break;
              case '-': stack.push(a - b); break;
              case '*': stack.push(a * b); break;
              case '/':
                if (b === 0) throw new Error('Division by zero');
                stack.push(a / b); break;
              case '%':
                if (b === 0) throw new Error('Modulo by zero');
                stack.push(a % b); break;
              case '^': stack.push(Math.pow(a, b)); break;
              default: throw new Error('Unknown operator: ' + tok.value);
            }
          }
        }
        if (stack.length !== 1) throw new Error('Invalid expression');
        return stack[0];
      }

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        const expr = input.value.trim();
        if (!expr) {
          result.textContent = 'Please enter a formula.';
          result.className = 'error';
          return;
        }
        try {
          const value = evaluateFormula(expr);
          if (!isFinite(value)) throw new Error('Result is not a finite