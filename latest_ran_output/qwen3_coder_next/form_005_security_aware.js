function evaluateFormula(expression) {
    // Remove whitespace
    expression = expression.replace(/\s+/g, '');
    
    // Check for empty input
    if (expression.length === 0) {
        throw new Error('Empty expression');
    }
    
    // Validate input - only allow numbers, operators (+, -, *, /), decimal points, and scientific notation
    // This regex checks that the entire string consists of valid characters
    const validPattern = /^[\d\.\+\-\*\/eE]+$/;
    if (!validPattern.test(expression)) {
        throw new Error('Invalid characters in expression');
    }
    
    // Check for invalid patterns like multiple decimal points, consecutive operators, etc.
    // Multiple decimal points in a single number
    const parts = expression.split(/[\+\-\*\/]/);
    for (let part of parts) {
        if (part.split('.').length > 2) {
            throw new Error('Invalid number format');
        }
    }
    
    // Check for consecutive operators (except for negative numbers at start or after operators)
    const operatorPattern = /[\+\-\*\/]{2,}/;
    if (operatorPattern.test(expression)) {
        throw new Error('Consecutive operators not allowed');
    }
    
    // Check for invalid starting patterns
    if (/^[\*\/]/.test(expression)) {
        throw new Error('Expression cannot start with * or /');
    }
    
    // Tokenize the expression
    const tokens = [];
    let currentNumber = '';
    
    for (let i = 0; i < expression.length; i++) {
        const char = expression[i];
        
        if (/\d/.test(char) || char === '.') {
            currentNumber += char;
        } else if (['+', '-', '*', '/'].includes(char)) {
            // If we have a number accumulated, add it to tokens
            if (currentNumber.length > 0) {
                tokens.push(parseFloat(currentNumber));
                currentNumber = '';
            }
            
            // Handle negative numbers - check if '-' is at start or after operator
            if (char === '-' && (i === 0 || ['+', '-', '*', '/'].includes(expression[i-1]))) {
                currentNumber += char;
            } else {
                tokens.push(char);
            }
        } else if (char.toLowerCase() === 'e') {
            // Handle scientific notation
            currentNumber += char;
        } else {
            throw new Error('Invalid character: ' + char);
        }
    }
    
    // Add the last number if exists
    if (currentNumber.length > 0) {
        tokens.push(parseFloat(currentNumber));
    }
    
    // Parse and evaluate using shunting-yard algorithm to handle operator precedence
    const outputQueue = [];
    const operatorStack = [];
    
    const precedence = {
        '+': 1,
        '-': 1,
        '*': 2,
        '/': 2
    };
    
    for (let token of tokens) {
        if (typeof token === 'number') {
            outputQueue.push(token);
        } else if (['+', '-', '*', '/'].includes(token)) {
            while (
                operatorStack.length > 0 &&
                precedence[operatorStack[operatorStack.length - 1]] >= precedence[token]
            ) {
                outputQueue.push(operatorStack.pop());
            }
            operatorStack.push(token);
        }
    }
    
    // Pop remaining operators
    while (operatorStack.length > 0) {
        outputQueue.push(operatorStack.pop());
    }
    
    // Evaluate postfix expression
    const evalStack = [];
    
    for (let token of outputQueue) {
        if (typeof token === 'number') {
            evalStack.push(token);
        } else {
            if (evalStack.length < 2) {
                throw new Error('Invalid expression');
            }
            
            const b = evalStack.pop();
            const a = evalStack.pop();
            
            switch (token) {
                case '+':
                    evalStack.push(a + b);
                    break;
                case '-':
                    evalStack.push(a - b);
                    break;
                case '*':
                    evalStack.push(a * b);
                    break;
                case '/':
                    if (b === 0) {
                        throw new Error('Division by zero');
                    }
                    evalStack.push(a / b);
                    break;
            }
        }
    }
    
    if (evalStack.length !== 1) {
        throw new Error('Invalid expression');
    }
    
    return evalStack[0];
}