<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Math Expression Evaluator</title>
</head>
<body>
    <h1>Math Expression Evaluator</h1>
    <input type="text" id="expression" placeholder="Enter expression (e.g., 2 + 3 * 4)">
    <button onclick="evaluateExpression()">Evaluate</button>
    <p id="result"></p>

    <script>
        function evaluateExpression() {
            const input = document.getElementById('expression').value.trim();
            const resultElement = document.getElementById('result');

            // Validate input
            if (!isValidExpression(input)) {
                resultElement.textContent = "Invalid expression. Only numbers and +, -, *, / operators are allowed.";
                return;
            }

            try {
                const value = parseAndEvaluate(input);
                resultElement.textContent = `Result: ${value}`;
            } catch (e) {
                resultElement.textContent = "Error evaluating expression.";
            }
        }

        function isValidExpression(expr) {
            // Check for invalid characters
            if (!/^[\d+\-*/. ]+$/.test(expr)) return false;

            // Check for consecutive operators or invalid patterns
            const tokens = expr.match(/(\d+\.?\d*|[+\-*/])/g);
            if (!tokens) return false;

            // Check first and last token are numbers
            if (isNaN(parseFloat(tokens[0])) || isNaN(parseFloat(tokens[tokens.length - 1]))) {
                return false;
            }

            // Check for consecutive operators or invalid operator patterns
            for (let i = 0; i < tokens.length - 1; i++) {
                const current = tokens[i];
                const next = tokens[i + 1];

                if (isNaN(parseFloat(current)) && isNaN(parseFloat(next))) {
                    return false;
                }
            }

            return true;
        }

        function parseAndEvaluate(expr) {
            // Tokenize the expression
            const tokens = expr.match(/(\d+\.?\d*|[+\-*/])/g);

            // Convert to postfix notation (Reverse Polish Notation)
            const output = [];
            const operators = [];

            for (const token of tokens) {
                if (!isNaN(parseFloat(token))) {
                    output.push(parseFloat(token));
                } else {
                    while (operators.length > 0 &&
                          getPrecedence(operators[operators.length - 1]) >= getPrecedence(token)) {
                        output.push(operators.pop());
                    }
                    operators.push(token);
                }
            }

            while (operators.length > 0) {
                output.push(operators.pop());
            }

            // Evaluate postfix expression
            const stack = [];
            for (const token of output) {
                if (typeof token === 'number') {
                    stack.push(token);
                } else {
                    const b = stack.pop();
                    const a = stack.pop();
                    switch (token) {
                        case '+': stack.push(a + b); break;
                        case '-': stack.push(a - b); break;
                        case '*': stack.push(a * b); break;
                        case '/': stack.push(a / b); break;
                    }
                }
            }

            return stack[0];
        }

        function getPrecedence(operator) {
            switch (operator) {
                case '+': case '-': return 1;
                case '*': case '/': return 2;
                default: return 0;
            }
        }
    </script>
</body>
</html>