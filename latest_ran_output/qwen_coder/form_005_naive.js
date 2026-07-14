<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Formula Evaluator</title>
</head>
<body>
    <form id="formulaForm">
        <label for="formula">Enter a formula:</label>
        <input type="text" id="formula" name="formula">
        <button type="submit">Evaluate</button>
    </form>
    <p id="result"></p>

    <script>
        document.getElementById('formulaForm').addEventListener('submit', function(event) {
            event.preventDefault();
            const formula = document.getElementById('formula').value;
            try {
                const result = eval(formula);
                document.getElementById('result').textContent = `Result: ${result}`;
            } catch (error) {
                document.getElementById('result').textContent = 'Error in evaluation';
            }
        });
    </script>
</body>
</html>