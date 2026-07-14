/**
 * Evaluates a mathematical expression string.
 * Supports: numbers, +, -, *, /, parentheses.
 * Throws errors for invalid input.
 */
function evaluateMath(expression) {
    // 1. Validation: Check for allowed characters
    const validPattern = /^[0-9+\-*/().\s]+$/;
    if (!validPattern.test(expression)) {
        throw new Error("Invalid characters detected. Only numbers, operators (+, -, *, /), parentheses, and whitespace are allowed.");
    }

    // 2. Tokenization: Convert string into an array of tokens (numbers and operators)
    const tokens = [];
    let i = 0;
    while (i < expression.length) {
        const char = expression[i];

        // Skip whitespace
        if (/\s/.test(char)) {
            i++;
            continue;
        }

        // Parse numbers (including decimals)
        if (/[0-9.]/.test(char)) {
            let numStr = '';
            while (i < expression.length && /[0-9.]/.test(expression[i])) {
                numStr += expression[i];
                i++;
            }
            tokens.push(parseFloat(numStr));
            continue;
        }

        // Parse operators and parentheses
        if (['+', '-', '*', '/', '(', ')'].includes(char)) {
            tokens.push(char);
            i++;
            continue;
        }

        // If we get here, the character was not recognized
        throw new Error(`Invalid character: ${char}`);
    }

    // 3. Recursive Descent Parser
    let pos = 0;
    const tokensLength = tokens.length;

    function peek() {
        return tokens[pos];
    }

    function consume() {
        return tokens[pos++];
    }

    // parseExpression handles addition and subtraction
    function parseExpression() {
        let left = parseTerm();
        while (peek() === '+' || peek() === '-') {
            const op = consume();
            const right = parseTerm();
            if (op === '+') {
                left += right;
            } else {
                left -= right;
            }
        }
        return left;
    }

    // parseTerm handles multiplication and division
    function parseTerm() {
        let left = parseFactor();
        while (peek() === '*' || peek() === '/') {
            const op = consume();
            const right = parseFactor();
            if (op === '*') {
                left *= right;
            } else {
                left /= right;
            }
        }
        return left;
    }

    // parseFactor handles numbers and parentheses
    function parseFactor() {
        const token = peek();

        // Number
        if (typeof token === 'number') {
            consume();
            return token;
        }

        // Parenthesized expression
        if (token === '(') {
            consume(); // Consume '('
            const result = parseExpression();
            if (peek() !== ')') {
                throw new Error("Mismatched parentheses: missing ')'");
            }
            consume(); // Consume ')'
            return result;
        }

        throw new Error(`Unexpected token: ${token}`);
    }

    // Start parsing
    const result = parseExpression();

    // Ensure we consumed all tokens
    if (pos !== tokensLength) {
        throw new Error("Invalid expression: extra tokens found");
    }

    return result;
}

// Example Usage
try {
    console.log(evaluateMath("3 + 4 * 2")); // 11
    console.log(evaluateMath("(3 + 4) * 2")); // 14
    console.log(evaluateMath("10 / 2")); // 5
    console.log(evaluateMath("1 + 2 + 3")); // 6
} catch (e) {
    console.error(e.message);
}