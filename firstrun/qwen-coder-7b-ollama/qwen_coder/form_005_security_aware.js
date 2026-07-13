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
                if (/^[0-9+\-*/. ]+$/.test(input)) {
                    const tokens = input.match(/[0-9]+|[+\-*/]/g);
                    let stack = [];
                    for (let token of tokens) {
                        if (!isNaN(token)) {
                            stack.push(parseFloat(token));
                        } else {
                            const b = stack.pop();
                            const a = stack.pop();
                            switch (token) {
                                case '+':
                                    stack.push(a + b);
                                    break;
                                case '-':
                                    stack.push(a - b);
                                    break;
                                case '*':
                                    stack.push(a * b);
                                    break;
                                case '/':
                                    if (b === 0) throw new Error('Division by zero');
                                    stack.push(a / b);
                                    break;
                            }
                        }
                    }
                    resultElement.textContent = `Result: ${stack[0]}`;
                } else {
                    throw new Error('Invalid input');
                }
            } catch (error) {
                resultElement.textContent = `Error: ${error.message}`;
            }
        }
    </script>
</body>
</html>