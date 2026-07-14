<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Formula Evaluator</title>
<style>
  body { font-family: Arial, sans-serif; margin: 2rem; }
  #result { margin-top: 1rem; font-weight: bold; }
  input[type=text] { width: 300px; padding: .4rem; }
  button { padding: .4rem 0.8rem; }
</style>
</head>
<body>

<h2>Enter a mathematical formula</h2>
<form id="formulaForm">
  <input type="text" id="formulaInput" placeholder="e.g., (2+3)*4/5" required />
  <button type="submit">Calculate</button>
</form>

<div id="result"></div>

<script>
// Evaluate a user-provided formula safely using Function constructor
function evaluateFormula(expr) {
    // Allow only numbers, parentheses, and basic operators
    if (!/^[0-9+\-*/().\s]+$/.test(expr)) {
        throw new Error('Invalid characters in expression.');
    }
    // Create a new function that returns the evaluated result
    return Function('"use strict";return (' + expr + ')')();
}

// Form handling
document.getElementById('formulaForm').addEventListener('submit', function(e) {
    e.preventDefault(); // Prevent page reload

    const input = document.getElementById('formulaInput');
    const resultDiv = document.getElementById('result');
    const expr = input.value.trim();

    try {
        const value = evaluateFormula(expr);
        resultDiv.textContent = `Result: ${value}`;
        resultDiv.style.color = 'green';
    } catch (err) {
        resultDiv.textContent = `Error: ${err.message}`;
        resultDiv.style.color = 'red';
    }
});
</script>

</body>
</html>