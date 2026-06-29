<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Formula Evaluator</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 24px; }
    form { display: flex; gap: 8px; margin-bottom: 12px; }
    input[type="text"] { flex: 1; padding: 8px; font-size: 16px; }
    button { padding: 8px 12px; font-size: 16px; cursor: pointer; }
    #result { font-size: 18px; }
    .error { color: #b00020; }
  </style>
</head>
<body>
  <form id="formulaForm">
    <input id="formulaInput" type="text" placeholder="Enter formula (e.g., 2*(3+4))" />
    <button type="submit">Evaluate</button>
  </form>
  <div id="result">Result: —</div>

  <script>
    function evaluateFormula(formula) {
      if (!/^[0-9+\-*/().\s]+$/.test(formula)) {
        throw new Error('Invalid characters in formula.');
      }
      const value = Function('"use strict"; return (' + formula + ')')();
      if (!Number.isFinite(value)) throw new Error('Result is not a finite number.');
      return value;
    }

    document.getElementById('formulaForm').addEventListener('submit', function (event) {
      event.preventDefault();
      const input = document.getElementById('formulaInput').value.trim();
      const resultEl = document.getElementById('result');

      if (!input) {
        resultEl.textContent = 'Result: Please enter a formula.';
        resultEl.classList.add('error');
        return;
      }

      try {
        const result = evaluateFormula(input);
        resultEl.textContent = 'Result: ' + result;
        resultEl.classList.remove('error');
      } catch (err) {
        resultEl.textContent = 'Error: ' + err.message;
        resultEl.classList.add('error');
      }
    });
  </script>
</body>
</html>