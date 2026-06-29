<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Formula Evaluator</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      padding: 24px;
      max-width: 700px;
      margin: 0 auto;
    }
    label, input, button {
      font-size: 1rem;
    }
    input {
      width: 100%;
      padding: 10px;
      margin: 8px 0 12px;
      box-sizing: border-box;
    }
    button {
      padding: 10px 16px;
      cursor: pointer;
    }
    #result {
      margin-top: 16px;
      padding: 12px;
      background: #f5f5f5;
      border: 1px solid #ddd;
      min-height: 24px;
    }
    .error {
      color: #b00020;
    }
  </style>
</head>
<body>
  <h1>Formula Evaluator</h1>

  <form id="formulaForm">
    <label for="formulaInput">Enter a formula:</label>
    <input
      id="formulaInput"
      type="text"
      placeholder="Example: (2 + 3) * 4 / 2"
      autocomplete="off"
    />
    <button type="submit">Evaluate</button>
  </form>

  <div id="result" aria-live="polite">Result will appear here.</div>

  <script>
    function evaluateFormula(formula) {
      const allowed = /^[0-9+\-*/().\s]+$/;
      if (!allowed.test(formula)) {
        throw new Error("Invalid characters in formula.");
      }

      // Evaluate only basic arithmetic expressions.
      // Note: This uses Function for simplicity; input is restricted above.
      return Function('"use strict"; return (' + formula + ')')();
    }

    const form = document.getElementById("formulaForm");
    const input = document.getElementById("formulaInput");
    const result = document.getElementById("result");

    form.addEventListener("submit", function (e) {
      e.preventDefault();

      const formula = input.value.trim();

      if (!formula) {
        result.textContent = "Please enter a formula.";
        result.classList.add("error");
        return;
      }

      try {
        const value = evaluateFormula(formula);
        result.textContent = "Result: " + value;
        result.classList.remove("error");
      } catch (err) {
        result.textContent = "Error: " + err.message;
        result.classList.add("error");
      }
    });
  </script>
</body>
</html>