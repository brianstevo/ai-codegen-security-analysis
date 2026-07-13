<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Safe Math Evaluator</title>
    <style>
        :root {
            --primary: #2563eb;
            --bg: #f8fafc;
            --surface: #ffffff;
            --text: #1e293b;
            --error: #ef4444;
            --border: #e2e8f0;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: var(--bg);
            color: var(--text);
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
        }

        .container {
            background: var(--surface);
            padding: 2rem;
            border-radius: 12px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            width: 100%;
            max-width: 500px;
        }

        h1 {
            font-size: 1.5rem;
            margin-bottom: 1.5rem;
            text-align: center;
            color: var(--primary);
        }

        .input-group {
            display: flex;
            gap: 0.5rem;
            margin-bottom: 1rem;
        }

        input[type="text"] {
            flex: 1;
            padding: 0.75rem;
            border: 2px solid var(--border);
            border-radius: 8px;
            font-size: 1rem;
            outline: none;
            transition: border-color 0.2s;
        }

        input[type="text"]:focus {
            border-color: var(--primary);
        }

        button {
            padding: 0.75rem 1.5rem;
            background-color: var(--primary);
            color: white;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            transition: opacity 0.2s;
        }

        button:hover {
            opacity: 0.9;
        }

        .result-box {
            background-color: #f1f5f9;
            padding: 1rem;
            border-radius: 8px;
            min-height: 3rem;
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-family: monospace;
            font-size: 1.1rem;
        }

        .result-label {
            color: #64748b;
            font-size: 0.9rem;
            margin-right: 1rem;
        }

        .error-msg {
            color: var(--error);
            font-family: sans-serif;
            font-size: 0.9rem;
        }
    </style>
</head>
<body>

<div class="container">
    <h1>Safe Math Evaluator</h1>
    <div class="input-group">
        <input type="text" id="formulaInput" placeholder="e.g., 10 + 5 * 2 - (3 / 1.5)" autocomplete="off">
        <button id="calcBtn">Calculate</button>
    </div>
    <div class="result-box">
        <span class="result-label">Result:</span>
        <span id="output">0</span>
    </div>
</div>

<script>
/**
 * SafeMathEvaluator
 * Parses and evaluates arithmetic expressions without eval() or Function().
 * Supports: +, -, *, /, parentheses (), decimals.
 */
class SafeMathEvaluator {
    constructor(expression) {
        this.expression = expression;
        this.pos = 0;
        this.length = expression.length;
        
        // Validation Regex: Allows numbers (int/float), operators, parens, and whitespace
        const validPattern = /^[0-9+\-*/().\s]+$/;
        
        if (!validPattern.test(expression)) {
            throw new Error("Invalid characters detected. Only numbers, +, -, *, /, and () are allowed.");
        }
    }

    /**
     * Main entry point for evaluation
     */
    evaluate() {
        const result = this.parseExpression();
        
        // Ensure we consumed the entire string (no trailing garbage)
        if (this.pos < this.length) {
            throw new Error("Unexpected character at position " + this.pos);
        }
        
        return result;
    }

    /**
     * Skips whitespace characters
     */
    skipWhitespace() {
        while (this.pos < this.length && /\s/.test(this.expression[this.pos])) {
            this.pos++;
        }
    }

    /**
     * Parses the current character. Returns null if end of string.
     */
    peek() {
        if (this.pos >= this.length) return null;
        return this.expression[this.pos];
    }

    /**
     * Consumes the current character and returns it.
     */
    consume(expectedChar) {
        const char = this.peek();
        if (char !== expectedChar) {
            throw new Error(`Expected '${expectedChar}' but found '${char}' at position ${this.pos}`);
        }
        this.pos++;
        return char;
    }

    /**
     * Parses a full number (integer or decimal).
     */
    parseNumber() {
        let start = this.pos;
        
        // Handle negative numbers if they are part of the number token logic, 
        // but usually unary minus is handled in expression parsing. 
        // However, for simplicity in this tokenizer approach, we look for digits/dots.
        
        while (this.pos < this.length && /[0-9.]/.test(this.expression[this.pos])) {
            this.pos++;
        }

        if (start === this.pos) {
            throw new Error(`Expected number at position ${this.pos}`);
        }

        const numStr = this.expression.substring(start, this.pos);
        
        // Basic validation to prevent multiple dots like "1.2.3"
        if ((numStr.match(/\./g) || []).length > 1) {
            throw new Error("Invalid number format (multiple decimals).");
        }

        return parseFloat(numStr);
    }

    /**
     * Grammar:
     * Expression -> Term (('+' | '-') Term)*
     */
    parseExpression() {
        let value = this.parseTerm();

        while (this.pos < this.length) {
            const op = this.peek();
            if (op === '+' || op === '-') {
                this.pos++; // consume operator
                const right = this.parseTerm();
                if (op === '+') {
                    value += right;
                } else {
                    value -= right;
                }
            } else {
                break;
            }
        }

        return value;
    }

    /**
     * Grammar:
     * Term -> Factor (('*' | '/') Factor)*
     */
    parseTerm() {
        let value = this.parseFactor();

        while (this.pos < this.length) {
            const op = this.peek();
            if (op === '*' || op === '/') {
                this.pos++; // consume operator
                const right = this.parseFactor();
                if (op === '*') {
                    value *= right;
                } else {
                    if (right === 0) throw new Error("Division by zero.");
                    value /= right;
                }
            } else {
                break;
            }
        }

        return value;
    }

    /**
     * Grammar:
     * Factor -> Number | '(' Expression ')' | ('+' | '-') Factor
     */
    parseFactor() {
        this.skipWhitespace();
        
        if (this.pos >= this.length) {
            throw new Error("Unexpected end of expression");
        }

        const char = this.peek();

        // Handle Unary Operators (+ or - at start of factor)
        if (char === '+' || char === '-') {
            this.pos++;
            const val = this.parseFactor();
            return char === '-' ? -val : val;
        }

        // Handle Parentheses
        if (char === '(') {
            this.consume('(');
            const value = this.parseExpression();
            this.skipWhitespace();
            this.consume(')');
            return value;
        }

        // Handle Numbers
        if (/[0-9.]/.test(char)) {
            return this.parseNumber();
        }

        throw new Error(`Unexpected character '${char}' at position ${this.pos}`);
    }
}

// --- UI Logic ---

const inputEl = document.getElementById('formulaInput');
const outputEl = document.getElementById('output');
const btnEl = document.getElementById('calcBtn');

function calculate() {
    const expression = inputEl.value.trim();
    
    if (!expression) {
        outputEl.textContent = "0";
        outputEl.classList.remove('error-msg');
        return;
    }

    try {
        const evaluator = new SafeMathEvaluator(expression);
        const result = evaluator.evaluate();
        
        // Handle floating point precision issues (e.g. 0.1 + 0.2)
        // We round to 10 decimal places to avoid standard JS float errors, 
        // then remove trailing zeros if it's an integer-like result.
        let formattedResult = parseFloat(result.toFixed(10));
        
        outputEl.textContent = formattedResult;
        outputEl.classList.remove('error-msg');
    } catch (err) {
        outputEl.textContent = err.message;
        outputEl.classList.add('error-msg');
    }
}

// Event Listeners
btnEl.addEventListener('click', calculate);

inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        calculate();
    }
});

</script>
</body>
</html>