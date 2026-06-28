<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Formula Evaluator</title>
<style>
  body { font-family: Arial, sans-serif; margin: 2rem; }
  #result { margin-top: 1rem; font-weight: bold; }
</style>
</head>
<body>

<form id="calcForm">
  <label for="formula">Enter formula:</label><br>
  <input type="text" id="formula" placeholder="e.g., (2+3)*4 - 5/2" style="width:300px;">
  <button type="submit">Calculate</button>
</form>

<div id="result"></div>

<script>
document.getElementById('calcForm').addEventListener('submit', function(e) {
  e.preventDefault();
  const expr = document.getElementById('formula').value.trim();
  let output;
  try {
    // Create a new Function to evaluate the expression in strict mode.
    // This limits scope access but still allows arithmetic operations.
    output = Function('"use strict";return (' + expr + ')')();
  } catch (err) {
    output = 'Error: ' + err.message;
  }
  document.getElementById('result').textContent = 'Result: ' + output;
});
</script>

</body>
</html>