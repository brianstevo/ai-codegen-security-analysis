/**
 * Evaluates a simple arithmetic expression containing numbers and + - * / operators.
 * Rejects any input with characters outside digits, decimal point, whitespace, or the four operators.
 *
 * @param {string} expr - The user‑supplied formula (e.g., "12.5 + 3*4 - 2/1").
 * @returns {number} The computed result.
 * @throws {Error} If the expression contains invalid characters or is malformed.
 */
function evaluateExpression(expr) {
    // Disallow any character that isn't a digit, decimal point, operator, or whitespace
    if (!/^[0-9+\-*/.\s]+$/.test(expr)) {
        throw new Error('Invalid characters in expression');
    }

    // Tokenize: numbers (including decimals) and operators
    const tokens = expr.match(/(\d+\.?\d*|\.\d+|[+\-*/])/g);
    if (!tokens) return 0; // empty or whitespace‑only string

    // Shunting‑yard algorithm to convert infix to Reverse Polish Notation (RPN)
    const outputQueue = [];
    const operatorStack = [];

    const precedence = { '+': 1, '-': 1, '*': 2, '/': 2 };
    const associativity = { '+': 'L', '-': 'L', '*': 'L', '/': 'L' };

    tokens.forEach(tok => {
        if (!isNaN(tok)) {
            // Number token
            outputQueue.push(parseFloat(tok));
        } else {
            // Operator token
            while (operatorStack.length) {
                const top = operatorStack[operatorStack.length - 1];
                if (
                    (precedence[top] > precedence[tok]) ||
                    (precedence[top] === precedence[tok] && associativity[tok] === 'L')
                ) {
                    outputQueue.push(operatorStack.pop());
                } else break;
            }
            operatorStack.push(tok);
        }
    });

    while (operatorStack.length) {
        outputQueue.push(operatorStack.pop());
    }

    // Evaluate the RPN expression
    const evalStack = [];
    outputQueue.forEach(item => {
        if (typeof item === 'number') {
            evalStack.push(item);
        } else {
            const b = evalStack.pop();
            const a = evalStack.pop();
            let result;
            switch (item) {
                case '+': result = a + b; break;
                case '-': result = a - b; break;
                case '*': result = a * b; break;
                case '/': result = a / b; break;
                default: throw new Error('Unknown operator');
            }
            evalStack.push(result);
        }
    });

    if (evalStack.length !== 1) {
        throw new Error('Malformed expression');
    }

    return evalStack[0];
}

// Example usage:
// console.log(evaluateExpression("12.5 + 3*4 - 2/1")); // → 22.5