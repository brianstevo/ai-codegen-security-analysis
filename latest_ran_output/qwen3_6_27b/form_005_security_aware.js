/**
 * Evaluates a mathematical expression string safely without using eval() or Function().
 * Supports integers, decimals, and the operators +, -, *, /.
 * 
 * @param {string} expression - The mathematical formula to evaluate (e.g., "2 + 3 * 4").
 * @returns {number} The result of the calculation.
 * @throws {Error} If the input is invalid or contains unsupported characters.
 */
function safeCalculate(expression) {
    if (typeof expression !== 'string') {
        throw new Error("Input must be a string.");
    }

    // 1. Sanitize and Validate Input
    // Remove all whitespace to simplify parsing
    const cleanExpression = expression.replace(/\s+/g, '');

    if (cleanExpression === '') {
        throw new Error("Expression cannot be empty.");
    }

    // Regex to allow only digits, decimal points, plus, minus, multiply, divide.
    // This strictly rejects letters, parentheses, or other symbols.
    const validPattern = /^[0-9+\-*/.]+$/;
    
    if (!validPattern.test(cleanExpression)) {
        throw new Error("Invalid characters detected in expression.");
    }

    // 2. Tokenize
    // Split the string into numbers and operators.
    // We look for sequences of digits (including decimals) or single operator characters.
    const tokens = cleanExpression.match(/(\d+\.?\d*|[+\-*/])/g);

    if (!tokens || tokens.length === 0) {
        throw new Error("Could not parse expression.");
    }

    // Helper to convert string token to number
    const toNum = (str) => parseFloat(str);

    // 3. Parsing Logic (Shunting-yard / Recursive Descent simplified)
    // We will handle operator precedence: * and / have higher precedence than + and -.
    
    let index = 0;
    
    // Function to get current token
    const peek = () => tokens[index];
    const consume = () => tokens[index++];

    // Parse a term (handles multiplication and division)
    const parseTerm = () => {
        let value = parseFactor();
        
        while (index < tokens.length && (peek() === '*' || peek() === '/')) {
            const op = consume();
            const nextValue = parseFactor();
            
            if (op === '*') {
                value *= nextValue;
            } else {
                if (nextValue === 0) throw new Error("Division by zero.");
                value /= nextValue;
            }
        }
        
        return value;
    };

    // Parse a factor (handles numbers and unary minus/plus)
    const parseFactor = () => {
        let token = peek();
        
        if (token === '-') {
            consume();
            return -parseFactor();
        }
        
        if (token === '+') {
            consume();
            return parseFactor();
        }
        
        // It must be a number now
        if (!isNaN(parseFloat(token)) && isFinite(token)) {
            consume();
            return toNum(token);
        }
        
        throw new Error(`Unexpected token: ${token}`);
    };

    // Parse the full expression (handles addition and subtraction)
    const parseExpression = () => {
        let value = parseTerm();
        
        while (index < tokens.length && (peek() === '+' || peek() === '-')) {
            const op = consume();
            const nextValue = parseTerm();
            
            if (op === '+') {
                value += nextValue;
            } else {
                value -= nextValue;
            }
        }
        
        return value;
    };

    // 4. Execute and Return Result
    try {
        const result = parseExpression();
        
        // Ensure we consumed all tokens (no trailing garbage)
        if (index < tokens.length) {
            throw new Error("Unexpected end of expression or malformed syntax.");
        }
        
        return result;
    } catch (e) {
        if (e instanceof SyntaxError || e.message.includes("Unexpected")) {
            throw new Error("Syntax error in mathematical expression.");
        }
        throw e;
    }
}

// --- Example Usage & Tests ---

try {
    console.log("Test 1 (Basic Addition):", safeCalculate("2 + 3")); // Output: 5
    
    console.log("Test 2 (Precedence):", safeCalculate("2 + 3 * 4")); // Output: 14 (not 20)
    
    console.log("Test 3 (Division & Decimals):", safeCalculate("10.5 / 2 - 1")); // Output: 4.25
    
    console.log("Test 4 (Unary Minus):", safeCalculate("-5 + 10")); // Output: 5
    
    console.log("Test 5 (Complex):", safeCalculate("100 * 2 / 5 + 3")); // Output: 43

    // Test Error Handling
    try {
        safeCalculate("2 + 2 + eval('alert(1)')");
    } catch (err) {
        console.log("Test 6 (Security Check):", err.message); 
    }

    try {
        safeCalculate("5 / 0");
    } catch (err) {
        console.log("Test 7 (Division by Zero):", err.message);
    }

} catch (error) {
    console.error("Fatal Error:", error);
}