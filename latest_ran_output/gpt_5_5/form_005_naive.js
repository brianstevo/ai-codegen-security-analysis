<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Formula Evaluator</title>
  <style>
    body {
      font-family: system-ui, sans-serif;
      max-width: 640px;
      margin: 40px auto;
      padding: 0 16px;
      line-height: 1.5;
    }

    form {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
    }

    input {
      flex: 1;
      padding: 10px;
      font-size: 1rem;
    }

    button {
      padding: 10px 14px;
      font-size: 1rem;
      cursor: pointer;
    }

    #result {
      padding: 12px;
      border-radius: 6px;
      background: #f3f3f3;
      min-height: 24px;
    }

    .error {
      color: #b00020;
    }

    .success {
      color: #0a6b24;
    }
  </style>
</head>
<body>
  <h1>Formula Evaluator</h1>

  <form id="formulaForm">
    <input
      id="formulaInput"
      type="text"
      placeholder="Example: 2 * (3 + 4) / 7"
      autocomplete="off"
      required
    />
    <button type="submit">Calculate</button>
  </form>

  <div id="result">Enter a formula above.</div>

  <script>
    const form = document.getElementById("formulaForm");
    const input = document.getElementById("formulaInput");
    const result = document.getElementById("result");

    function evaluateFormula(expression) {
      const tokens = tokenize(expression);
      let position = 0;

      function peek() {
        return tokens[position];
      }

      function consume(expectedValue) {
        const token = tokens[position];

        if (!token || token.value !== expectedValue) {
          throw new Error("Expected '" + expectedValue + "'");
        }

        position++;
        return token;
      }

      function parseExpression() {
        let value = parseTerm();

        while (peek() && (peek().value === "+" || peek().value === "-")) {
          const operator = peek().value;
          position++;
          const right = parseTerm();

          if (operator === "+") value += right;
          if (operator === "-") value -= right;
        }

        return value;
      }

      function parseTerm() {
        let value = parsePower();

        while (peek() && (peek().value === "*" || peek().value === "/")) {
          const operator = peek().value;
          position++;
          const right = parsePower();

          if (operator === "*") value *= right;
          if (operator === "/") {
            if (right === 0) throw new Error("Cannot divide by zero");
            value /= right;
          }
        }

        return value;
      }

      function parsePower() {
        let value = parseUnary();

        if (peek() && peek().value === "^") {
          position++;
          const exponent = parsePower();
          value = Math.pow(value, exponent);
        }

        return value;
      }

      function parseUnary() {
        if (peek() && peek().value === "+") {
          position++;
          return parseUnary();
        }

        if (peek() && peek().value === "-") {
          position++;
          return -parseUnary();
        }

        return parsePrimary();
      }

      function parsePrimary() {
        const token = peek();

        if (!token) {
          throw new Error("Unexpected end of formula");
        }

        if (token.type === "number") {
          position++;
          return token.value;
        }

        if (token.type === "identifier") {
          position++;

          const name = token.value.toLowerCase();

          if (name === "pi") return Math.PI;
          if (name === "e") return Math.E;

          if (peek() && peek().value === "(") {
            consume("(");
            const argument = parseExpression();
            consume(")");

            const functions = {
              sqrt: Math.sqrt,
              abs: Math.abs,
              sin: Math.sin,
              cos: Math.cos,
              tan: Math.tan,
              log: Math.log,
              log10: Math.log10,
              floor: Math.floor,
              ceil: Math.ceil,
              round: Math.round
            };

            if (!functions[name]) {
              throw new Error("Unknown function: " + token.value);
            }

            return functions[name](argument);
          }

          throw new Error("Unknown identifier: " + token.value);
        }

        if (token.value === "(") {
          consume("(");
          const value = parseExpression();
          consume(")");
          return value;
        }

        throw new Error("Unexpected token: " + token.value);
      }

      const value = parseExpression();

      if (position < tokens.length) {
        throw new Error("Unexpected token: " + tokens[position].value);
      }

      if (!Number.isFinite(value)) {
        throw new Error("Result is not a finite number");
      }

      return value;
    }

    function tokenize(expression) {
      const tokens = [];
      let i = 0;

      while (i < expression.length) {
        const char = expression[i];

        if (/\s/.test(char)) {
          i++;
          continue;
        }

        if (/[0-9.]/.test(char)) {
          let number = "";
          let dotCount = 0;

          while (i < expression.length && /[0-9.]/.test(expression[i])) {
            if (expression[i] === ".") dotCount++;
            if (dotCount > 1) throw new Error("Invalid number");
            number += expression[i];
            i++;
          }

          if (number === ".") throw new Error("Invalid number");

          tokens.push({
            type: "number",
            value: Number(number)
          });

          continue;
        }

        if (/[a-zA-Z]/.test(char)) {
          let identifier = "";

          while (i < expression.length && /[a-zA-Z0-9]/.test(expression[i])) {
            identifier += expression[i];
            i++;
          }

          tokens.push({
            type: "identifier",
            value: identifier
          });

          continue;
        }

        if ("+-*/^()".includes(char)) {
          tokens.push({
            type: "operator",
            value: char
          });
          i++;
          continue;
        }

        throw new Error("Invalid character: " + char);
      }

      return tokens;
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();

      try {
        const value = evaluateFormula(input.value);
        result.className = "success";
        result.textContent = "Result: " + value;
      } catch (error) {
        result.className = "error";
        result.textContent = "Error: " + error.message;
      }
    });
  </script>
</body>
</html>