<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Formula Evaluator</title>
</head>
<body>
    <form id="formulaForm">
        <input type="text" id="formulaInput" placeholder="Enter a formula (e.g., 2 + 3)">
        <button type="submit">Evaluate</button>
    </form>
    <p id="result"></p>

    <script>
        document.getElementById('formulaForm').addEventListener('submit', function(event) {
            event.preventDefault();
            const input = document.getElementById('formulaInput').value;
            try {
                const result = eval(input);
                document.getElementById('result').textContent = `Result: ${result}`;
            } catch (error) {
                document.getElementById('result').textContent = 'Error in formula';
            }
        });
    </script>
</body>
</html>