function safeEvaluate(expression) {
    // Remove whitespace
    expression = expression.replace(/\s+/g, '');
    
    // Check for empty input
    if (expression.length === 0) {
        return null;
    }
    
    // Validate the expression contains only allowed characters
    // Allowed: digits, decimal points, +, -, *, /, and parentheses
    const validPattern = /^[\d\.\+\-\*\/\(\)]+$/;
    if (!validPattern.test(expression)) {
        throw new Error("Invalid characters in expression. Only numbers, +, -, *, /, and () are allowed.");
    }
    
    // Check for balanced parentheses
    let parenCount = 0;
    for (let char of expression) {
        if (char === '(') parenCount++;
        else if (char === ')') parenCount--;
        if (parenCount < 0) throw new Error("Unbalanced parentheses");
    }
    if (parenCount !== 0) throw new Error("Unbalanced parentheses");
    
    // Check for invalid patterns like consecutive operators or empty parentheses
    const invalidPatterns = [
        /\+\+/, /--/, /\*\*/, /\/\//, 
        /\+\-/, /\-\+/, 
        /\(\)/, /^[\+\*\/]/, /[\+\-\*\/]$/
    ];
    
    for (let pattern of invalidPatterns) {
        if (pattern.test(expression)) {
            throw new Error("Invalid expression format");
        }
    }
    
    // Tokenize the expression
    const tokens = [];
    let currentNumber = '';
    
    for (let i = 0; i < expression.length; i++) {
        const char = expression[i];
        
        if (/\d/.test(char) || char === '.') {
            currentNumber += char;
        } else {
            if (currentNumber !== '') {
                tokens.push(parseFloat(currentNumber));
                currentNumber = '';
            }
            tokens.push(char);
        }
    }
    
    // Add the last number
    if (currentNumber !== '') {
        tokens.push(parseFloat(currentNumber));
    }
    
    // Parse and evaluate using recursive descent parser
    let tokenIndex = 0;
    
    function parseExpression() {
        let left = parseTerm();
        
        while (tokenIndex < tokens.length && 
               (tokens[tokenIndex] === '+' || tokens[tokenIndex] === '-')) {
            const operator = tokens[tokenIndex];
            tokenIndex++;
            const right = parseTerm();
            
            if (operator === '+') {
                left = left + right;
            } else {
                left = left - right;
            }
        }
        
        return left;
    }
    
    function parseTerm() {
        let left = parseFactor();
        
        while (tokenIndex < tokens.length && 
               (tokens[tokenIndex] === '*' || tokens[tokenIndex] === '/')) {
            const operator = tokens[tokenIndex];
            tokenIndex++;
            const right = parseFactor();
            
            if (operator === '*') {
                left = left * right;
            } else {
                if (right === 0) {
                    throw new Error("Division by zero");
                }
                left = left / right;
            }
        }
        
        return left;
    }
    
    function parseFactor() {
        // Handle negative numbers
        if (tokens[tokenIndex] === '-') {
            tokenIndex++;
            return -parseFactor();
        }
        
        // Handle positive sign
        if (tokens[tokenIndex] === '+') {
            tokenIndex++;
            return parseFactor();
        }
        
        // Handle parentheses
        if (tokens[tokenIndex] === '(') {
            tokenIndex++; // Skip '('
            const result = parseExpression();
            if (tokenIndex < tokens.length && tokens[tokenIndex] === ')') {
                tokenIndex++; // Skip ')'
            } else {
                throw new Error("Missing closing parenthesis");
            }
            return result;
        }
        
        // Handle numbers
        if (typeof tokens[tokenIndex] === 'number') {
            return tokens[tokenIndex++];
        }
        
        throw new Error("Unexpected token in expression");
    }
    
    try {
        const result = parseExpression();
        
        // Check for invalid results like NaN or Infinity
        if (isNaN(result) || !isFinite(result)) {
            throw new Error("Invalid calculation result");
        }
        
        return result;
    } catch (error) {
        throw error;
    }
}