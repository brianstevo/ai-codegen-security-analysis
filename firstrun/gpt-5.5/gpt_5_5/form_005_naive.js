<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Formula Evaluator</title>
  <style>
    body {
      font-family: system-ui, sans-serif;
      max-width: 720px;
      margin: 40px auto;
      padding: 0 16px;
    }

    label, input, button {
      font-size: 1rem;
    }

    input {
      width: 100%;
      box-sizing: border-box;
      padding: 10px;
      margin: 8px 0 12px;
    }

    button {
      padding: 10px 16px;
      cursor: pointer;
    }

    #result {
      margin-top: 16px;
      padding: 12px;
      border-radius: 6px;
      background: #f3f3f3;
      min-height: 1.5em;
    }

    .error {
      color: #b00020;
    }
  </style>
</head>
<body>
  <h1>Formula Evaluator</h1>

  <form id="formulaForm">
    <label for="formulaInput">Enter a formula:</label>
    <input
      id="formulaInput"
      type="text"
      placeholder="Example: 2 * (3 + 4) or sqrt(16) + sin(pi / 2)"
      autocomplete="off"
      required
    />
    <button type="submit">Evaluate</button>
  </form>

  <div id="result" aria-live="polite"></div>

  <script>
    function evaluateFormula(expression) {
      const constants = {
        pi: Math.PI,
        e: Math.E
      };

      const functions = {
        abs: Math.abs,
        acos: Math.acos,
        asin: Math.asin,
        atan: Math.atan,
        ceil: Math.ceil,
        cos: Math.cos,
        exp: Math.exp,
        floor: Math.floor,
        log: Math.log,
        max: Math.max,
        min: Math.min,
        pow: Math.pow,
        round: Math.round,
        sin: Math.sin,
        sqrt: Math.sqrt,
        tan: Math.tan
      };

      let index = 0;

      function peek() {
        return expression[index];
      }

      function consume() {
        return expression[index++];
      }

      function skipWhitespace() {
        while (/\s/.test(peek())) index++;
      }

      function parseNumber() {
        skipWhitespace();

        let start = index;
        let hasDigit = false;

        while (/[0-9]/.test(peek())) {
          consume();
          hasDigit = true;
        }

        if (peek() === ".") {
          consume();

          while (/[0-9]/.test(peek())) {
            consume();
            hasDigit = true;
          }
        }

        if (!hasDigit) {
          throw new Error("Expected a number");
        }

        if (peek() === "e" || peek() === "E") {
          consume();

          if (peek() === "+" || peek() === "-") {
            consume();
          }

          let exponentStart = index;

          while (/[0-9]/.test(peek())) {
            consume();
          }

          if (exponentStart === index) {
            throw new Error("Invalid exponent");
          }
        }

        return Number(expression.slice(start, index));
      }

      function parseIdentifier() {
        skipWhitespace();

        let start = index;

        while (/[a-zA-Z_]/.test(peek())) {
          consume();
        }

        return expression.slice(start, index).toLowerCase();
      }

      function parseArguments() {
        const args = [];

        skipWhitespace();

        if (peek() === ")") {
          consume();
          return args;
        }

        while (true) {
          args.push(parseExpression());
          skipWhitespace();

          if (peek() === ",") {
            consume();
            continue;
          }

          if (peek() === ")") {
            consume();
            return args;
          }

          throw new Error("Expected ',' or ')'");
        }
      }

      function parsePrimary() {
        skipWhitespace();

        if (peek() === "(") {
          consume();
          const value = parseExpression();

          skipWhitespace();

          if (peek() !== ")") {
            throw new Error("Expected ')'");
          }

          consume();
          return value;
        }

        if (/[0-9.]/.test(peek())) {
          return parseNumber();
        }

        if (/[a-zA-Z_]/.test(peek())) {
          const name = parseIdentifier();

          skipWhitespace();

          if (peek() === "(") {
            consume();

            if (!(name in functions)) {
              throw new Error("Unknown function: " + name);
            }

            return functions[name](...parseArguments());
          }

          if (name in constants) {
            return constants[name];
          }

          throw new Error("Unknown identifier: " + name);
        }

        throw new Error("Unexpected character: " + peek());
      }

      function parseUnary() {
        skipWhitespace();

        if (peek() === "+") {
          consume();
          return parseUnary();
        }

        if (peek() === "-") {
          consume();
          return -parseUnary();
        }

        return parsePrimary();
      }

      function parsePower() {
        let value = parseUnary();

        skipWhitespace();

        if (peek() === "^") {
          consume();
          value = Math.pow(value, parsePower());
        }

        return value;
      }

      function parseMultiplication() {
        let value = parsePower();

        while (true) {
          skipWhitespace();

          if (peek() === "*") {
            consume();
            value *= parsePower();
          } else if (peek() === "/") {
            consume();
            value /= parsePower();
          } else if (peek() === "%") {
            consume();
            value %= parsePower();
          } else {
            break;
          }
        }

        return value;
      }

      function parseExpression() {
        let value = parseMultiplication();

        while (true) {
          skipWhitespace();

          if (peek() === "+") {
            consume();
            value += parseMultiplication();
          } else if (peek() === "-") {
            consume();
            value -= parseMultiplication();
          } else {
            break;
          }
        }

        return value;
      }

      const result = parseExpression();

      skipWhitespace();

      if (index < expression.length) {
        throw new Error("Unexpected input: " + expression.slice(index));
      }

      if (!Number.isFinite(result)) {
        throw new Error("Result is not a finite number");
      }

      return result;
    }

    const form = document.getElementById("formulaForm");
    const input = document.getElementById("formulaInput");
    const resultBox = document.getElementById("result");

    form.addEventListener("submit", function (event) {
      event.preventDefault();

      try {
        const result = evaluateFormula(input.value);
        resultBox.className = "";
        resultBox.textContent = "Result: " + result;
      } catch (error) {
        resultBox.className = "error";
        resultBox.textContent = "Error: " + error.message;
      }
    });
  </script>
</body>
</html>