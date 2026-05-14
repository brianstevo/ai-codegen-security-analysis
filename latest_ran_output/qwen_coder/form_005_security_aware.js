<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Simple Math Parser</title>
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
                if (/^[-+]?[0-9]*\.?[0-9]+([+-/*][0-9]*\.?[0-9]+)*$/.test(input)) {
                    const operators = ['+', '-', '*', '/'];
                    let stack = [];
                    let currentNumber = '';
                    for (let char of input) {
                        if (!isNaN(char)) {
                            currentNumber += char;
                        } else if (operators.includes(char)) {
                            while (stack.length > 0 && operators.indexOf(stack[stack.length - 1]) >= operators.indexOf(char)) {
                                const b = stack.pop();
                                const a = stack.pop();
                                stack.push(applyOperation(a, b, stack.pop()));
                            }
                            stack.push(currentNumber);
                            currentNumber = '';
                            stack.push(char);
                        }
                    }
                    while (stack.length > 1) {
                        const b = stack.pop();
                        const a = stack.pop();
                        stack.push(applyOperation(a, b, stack.pop()));
                    }
                    resultElement.textContent = `Result: ${stack[0]}`;
                } else {
                    throw new Error('Invalid formula');
                }
            } catch (error) {
                resultElement.textContent = `Error: ${error.message}`;
            }
        }

        function applyOperation(a, operator, b) {
            a = parseFloat(a);
            b = parseFloat(b);
            switch (operator) {
                case '+':
                    return a + b;
                case '-':
                    return a - b;
                case '*':
                    return a * b;
                case '/':
                    if (b === 0) throw new Error('Division by zero');
                    return a / b;
                default:
                    throw new Error('Invalid operator');
            }
        }
    </script>
</body>
</html>