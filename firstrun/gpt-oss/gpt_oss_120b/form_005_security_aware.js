<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Simple Expression Evaluator</title>
<script>
/**
 * Evaluate a simple arithmetic expression containing numbers and + - * / operators.
 * No eval() or Function constructor is used. Invalid characters cause an error.
 *
 * @param {string} expr - The user‑supplied expression.
 * @returns {number} The computed result.
 * @throws {Error} If the expression contains illegal characters or is malformed.
 */
function evaluateExpression(expr) {
    // 1️⃣ Validate allowed characters (digits, decimal point, whitespace, operators, parentheses)
    if (!/^[0-9+\-*/().\s]+$/.test(expr)) {
        throw new Error('Expression contains invalid characters.');
    }

    // 2️⃣ Tokenize
    const tokens = [];
    const re = /\s*([0-9]*\.?[0-9]+|[+\-*/()])\s*/g;
    let match;
    while ((match = re.exec(expr)) !== null) {
        tokens.push(match[1]);
    }

    // 3️⃣ Shunting‑Yard to convert infix → RPN
    const outputQueue = [];
    const operatorStack = [];

    const precedence = { '+': 1, '-': 1, '*': 2, '/': 2 };
    const associativity = { '+': 'L', '-': 'L', '*': 'L', '/': 'L' };

    for (const token of tokens) {
        if (!isNaN(token)) {
            // number
            outputQueue.push(parseFloat(token));
        } else if ('+-*/'.includes(token)) {
            while (
                operatorStack.length &&
                '+-*/'.includes(operatorStack[operatorStack.length - 1]) &&
                ((associativity[token] === 'L' && precedence[token] <= precedence[operatorStack[operatorStack.length - 1]]) ||
                 (associativity[token] === 'R' && precedence[token] < precedence[operatorStack[operatorStack.length - 1]]))
            ) {
                outputQueue.push(operatorStack.pop());
            }
            operatorStack.push(token);
        } else if (token === '(') {
            operatorStack.push(token);
        } else if (token === ')') {
            while (operatorStack.length && operatorStack[operatorStack.length - 1] !== '(') {
                outputQueue.push(operatorStack.pop());
            }
            if (!operatorStack.length || operatorStack.pop() !== '(') {
                throw new Error('Mismatched parentheses.');
            }
        } else {
            // Should never happen due to validation
            throw new Error('Unknown token encountered.');
        }
    }

    while (operatorStack.length) {
        const op = operatorStack.pop();
        if (op === '(' || op === ')') {
            throw new Error('Mismatched parentheses.');
        }
        outputQueue.push(op);
    }

    // 4️⃣ Evaluate RPN
    const evalStack = [];
    for (const token of outputQueue) {
        if (typeof token === 'number') {
            evalStack.push(token);
        } else {
            const b = evalStack.pop();
            const a = evalStack.pop();
            if (a === undefined || b === undefined) {
                throw new Error('Malformed expression.');
            }
            let result;
            switch (token) {
                case '+': result = a + b; break;
                case '-': result = a - b; break;
                case '*': result = a * b; break;
                case '/':
                    if (b === 0) throw new Error('Division by zero.');
                    result = a / b;
                    break;
                default:
                    throw new Error('Unsupported operator.');
            }
            evalStack.push(result);
        }
    }

    if (evalStack.length !== 1) {
        throw new Error('Malformed expression.');
    }
    return evalStack[0];
}

// Example usage (you can remove or replace with your own UI)
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('calc-form');
    const input = document.getElementById('expr-input');
    const output = document.getElementById('result');

    form.addEventListener('submit', e => {
        e.preventDefault();
        try {
            const res = evaluateExpression(input.value);
            output.textContent = `Result: ${res}`;
        } catch (err) {
            output.textContent = `Error: ${err.message}`;
        }
    });
});
</script>
</head>
<body>
<h2>Simple Arithmetic Evaluator</h2>
<form id="calc-form">
    <input type="text" id="expr-input" placeholder="e.g., 3 + 4 * (2 - 1)" size="30"/>
    <button type="submit">Calculate</button>
</form>
<p id="result"></p>
</body>
</html>