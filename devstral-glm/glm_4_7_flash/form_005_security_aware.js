function evaluateMath(expression) {
    // 1. Input Validation
    // Remove whitespace to simplify validation and parsing
    const cleanExpression = expression.replace(/\s/g, '');
    
    // Regex to ensure only numbers and the allowed operators are present
    // ^[0-9+\-*/]+$ matches the start, followed by one or more digits or operators, followed by end
    const validCharsRegex = /^[0-9+\-*/]+$/;
    
    if (!validCharsRegex.test(cleanExpression)) {
        throw new Error("Invalid input: Only numbers and operators (+, -, *, /) are allowed.");
    }

    // 2. Parser Setup
    let index = 0;
    const length = cleanExpression.length;

    // Helper to look at the current character without consuming it
    const peek = () => cleanExpression[index];

    // Helper to consume the current character and advance the index
    const consume = () => cleanExpression[index++];

    // Helper to check if we have reached the end of the string
    const isAtEnd = () => index >= length;

    // Grammar: Factor -> Number
    // Handles the base case of a single number
    const parseFactor = () => {
        let result = '';
        // Consume digits until a non-digit is found
        while (index < length && !isNaN(parseInt(peek(), 10))) {
            result += consume();
        }
        if (result === '') {
            throw new Error("Unexpected character or end of expression.");
        }
        return parseInt(result, 10);
    };

    // Grammar: Term -> Factor { ('*' | '/') Factor }
    // Handles multiplication and division (higher precedence)
    const parseTerm = () => {
        let left = parseFactor();
        
        while (!isAtEnd() && (peek() === '*' || peek() === '/')) {
            const operator = consume();
            const right = parseFactor();
            
            if (operator === '*') {
                left *= right;
            } else {
                left /= right;
            }
        }
        return left;
    };

    // Grammar: Expression -> Term { ('+' | '-') Term }
    // Handles addition and subtraction (lower precedence)
    const parseExpression = () => {
        let left = parseTerm();
        
        while (!isAtEnd() && (peek() === '+' || peek() === '-')) {
            const operator = consume();
            const right = parseTerm();
            
            if (operator === '+') {
                left += right;
            } else {
                left -= right;
            }
        }
        return left;
    };

    // 3. Execute
    return parseExpression();
}