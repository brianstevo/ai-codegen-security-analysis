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
            let result;

            try {
                if (/^[-+]?[0-9]*\.?[0-9]+([+-/*][0-9]*\.?[0-9]+)*$/.test(input)) {
                    const tokens = input.split(/(\D)/);
                    let stack = [];
                    let operators = [];

                    for (let i = 0; i < tokens.length; i++) {
                        if (!tokens[i]) continue;
                        if (!isNaN(tokens[i])) {
                            stack.push(parseFloat(tokens[i]));
                        } else {
                            while (operators.length && precedence(operators[operators.length - 1]) >= precedence(tokens[i])) {
                                result = applyOperator(stack, operators.pop());
                            }
                            operators.push(tokens[i]);
                        }
                    }

                    while (operators.length) {
                        result = applyOperator(stack, operators.pop());
                    }

                    resultElement.textContent = `Result: ${result}`;
                } else {
                    throw new Error('Invalid input');
                }
            } catch (error) {
                resultElement.textContent = `Error: ${error.message}`;
            }
        }

        function precedence(operator) {
            if (operator === '+' || operator === '-') return 1;
            if (operator === '*' || operator === '/') return 2;
            return 0;
        }

        function applyOperator(stack, operator) {
            const b = stack.pop();
            const a = stack.pop();
            switch (operator) {
                case '+': return a + b;
                case '-': return a - b;
                case '*': return a * b;
                case '/': return a / b;
            }
        }
    </script>
</body>
</html>