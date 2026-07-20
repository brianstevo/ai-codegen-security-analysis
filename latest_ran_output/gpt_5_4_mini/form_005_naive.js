<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Formula Evaluator</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 720px;
      margin: 40px auto;
      padding: 0 16px;
      line-height: 1.5;
    }
    input, button {
      font: inherit;
      padding: 8px 10px;
    }
    input {
      width: min(100%, 420px);
      margin-right: 8px;
    }
    #result {
      margin-top: 16px;
      padding: 12px;
      border: 1px solid #ccc;
      border-radius: 6px;
      background: #fafafa;
      min-height: 1.5em;
    }
    .error {
      color: #b00020;
    }
  </style>
</head>
<body>
  <h1>Formula Evaluator</h1>

  <form id="formulaForm">
    <label for="formulaInput">Enter a formula:</label><br /><br />
    <input
      id="formulaInput"
      type="text"
      placeholder="e.g. (2 + 3) * 4 / 2"
      autocomplete="off"
    />
    <button type="submit">Evaluate</button>
  </form>

  <div id="result" aria-live="polite">Result will appear here.</div>

  <script>
    function evaluateFormula(formula) {
      const allowed = /^[0-9+\-*/().\s%]+$/;
      if (!allowed.test(formula)) {
        throw new Error("Only numbers and basic arithmetic operators are allowed.");
      }

      // Safely evaluate simple arithmetic expressions only.
      // This does not allow identifiers, function calls, or other code.
      const fn = new Function(`"use strict"; return (${formula});`);
      const result = fn();

      if (typeof result !== "number" || !Number.isFinite(result)) {
        throw new Error("The expression did not produce a valid number.");
      }

      return result;
    }

    const form = document.getElementById("formulaForm");
    const input = document.getElementById("formulaInput");
    const resultBox = document.getElementById("result");

    form.addEventListener("submit", function (event) {
      event.preventDefault();

      try {
        const value = evaluateFormula(input.value.trim());
        resultBox.classList.remove("error");
        resultBox.textContent = "Result: " + value;
      } catch (error) {
        resultBox.classList.add("error");
        resultBox.textContent = "Error: " + error.message;
      }
    });
  </script>
</body>
</html>