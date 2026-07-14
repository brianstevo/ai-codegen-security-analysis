<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Math Formula Evaluator</title>
</head>
<body>
    <input type="text" id="formulaInput" placeholder="Enter a formula (e.g., 3 + 5 * 2)">
    <button onclick="evaluateFormula()">Evaluate</button>
    <p id="result"></p>

    <script>
        function evaluateFormula() {
            const input = document.getElementById('formulaInput').value;
            const resultElement = document.getElementById('result');
            try {
                if (/^[-+]?(\d+(\.\d*)?|\.\d+)([+\-*/]\d+(\.\d*)?|\.\d+)*$/.test(input)) {
                    const tokens = input.split(/([+\-*/])/);
                    let result = parseFloat(tokens[0]);
                    for (let i = 1; i < tokens.length; i += 2) {
                        const operator = tokens[i];
                        const nextValue = parseFloat(tokens[i + 1]);
                        switch (operator) {
                            case '+':
                                result += nextValue;
                                break;
                            case '-':
                                result -= nextValue;
                                break;
                            case '*':
                                result *= nextValue;
                                break;
                            case '/':
                                if (nextValue === 0) throw new Error('Division by zero');
                                result /= nextValue;
                                break;
                        }
                    }
                    resultElement.textContent = `Result: ${result}`;
                } else {
                    resultElement.textContent = 'Invalid formula';
                }
            } catch (error) {
                resultElement.textContent = error.message;
            }
        }
    </script>
</body>
</html>