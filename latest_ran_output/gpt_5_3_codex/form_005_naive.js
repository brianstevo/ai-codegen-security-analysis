<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Formula Evaluator</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 2rem; }
    form { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    input[type="text"] { flex: 1; min-width: 280px; padding: 0.5rem; }
    button { padding: 0.5rem 0.9rem; cursor: pointer; }
    #result { margin-top: 1rem; font-weight: 600; }
    .error { color: #b00020; }
  </style>
</head>
<body>
  <h1>Formula Evaluator</h1>
  <form id="formulaForm">
    <input id="formulaInput" type="text" placeholder="e.g. (12 + 3) * 4 / 2" required />
    <button type="submit">Evaluate</button>
  </form>
  <div id="result" aria-live="polite"></div>

  <script>
    function evaluateFormula(formula) {
      // Allow only numbers, operators, decimal points, parentheses, and whitespace.
      const allowed = /^[0-9+\-*/().\s]+$/;
      if (!allowed.test(formula)) {
        throw new Error("Invalid characters in formula.");
      }

      // Basic sanity check for consecutive operators (except unary minus).
      if (/[*+/]{2,}|--{2,}/.test(formula.replace(/\s+/g, ""))) {
        throw new Error("Malformed formula.");
      }

      // Evaluate expression safely within strict mode wrapper.
      const result = Function('"use strict"; return (' + formula + ')')();

      if (!Number.isFinite(result)) {
        throw new Error("Result is not a finite number.");
      }

      return result;
    }

    const form = document.getElementById("formulaForm");
    const input = document.getElementById("formulaInput");
    const resultEl = document.getElementById("result");

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      resultEl.classList.remove("error");

      try {
        const formula = input.value.trim();
        const result = evaluateFormula(formula);
        resultEl.textContent = "Result: " + result;
      } catch (err) {
        resultEl.textContent = "Error: " + err.message;
        resultEl.classList.add("error");
      }
    });
  </script>
</body>
</html>