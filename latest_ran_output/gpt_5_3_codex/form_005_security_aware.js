<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Safe Arithmetic Evaluator</title>
</head>
<body>
  <script>
    function evaluateFormula(input) {
      if (typeof input !== "string") {
        throw new Error("Input must be a string.");
      }

      const expr = input.replace(/\s+/g, "");

      if (expr.length === 0) {
        throw new Error("Expression is empty.");
      }

      // Reject any character that is not digit, decimal point, or arithmetic operator
      if (!/^[0-9+\-*/.]+$/.test(expr)) {
        throw new Error("Invalid characters in expression.");
      }

      // Tokenize: numbers and operators
      const tokens = expr.match(/(\d+(?:\.\d+)?|\.\d+|[+\-*/])/g);
      if (!tokens || tokens.join("") !== expr) {
        throw new Error("Malformed expression.");
      }

      // Convert to values/operators while handling unary +/- for numbers
      const values = [];
      const ops = [];
      let expectingNumber = true;

      for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];

        if (expectingNumber) {
          let sign = 1;
          while (t === "+" || t === "-") {
            if (t === "-") sign *= -1;
            i++;
            if (i >= tokens.length) throw new Error("Expression ends unexpectedly.");
            if (!/^[+\-*/]$/.test(tokens[i])) break;
            if (tokens[i] === "*" || tokens[i] === "/") throw new Error("Invalid operator position.");
          }

          const numToken = tokens[i];
          if (!/^(\d+(?:\.\d+)?|\.\d+)$/.test(numToken)) {
            throw new Error("Number expected.");
          }

          const num = parseFloat(numToken) * sign;
          if (!Number.isFinite(num)) throw new Error("Invalid number.");
          values.push(num);
          expectingNumber = false;
        } else {
          if (!/^[+\-*/]$/.test(t)) throw new Error("Operator expected.");
          ops.push(t);
          expectingNumber = true;
        }
      }

      if (expectingNumber) {
        throw new Error("Expression cannot end with an operator.");
      }

      // Evaluate * and / first
      const reducedValues = [values[0]];
      const reducedOps = [];

      for (let i = 0; i < ops.length; i++) {
        const op = ops[i];
        const nextVal = values[i + 1];

        if (op === "*") {
          reducedValues[reducedValues.length - 1] *= nextVal;
        } else if (op === "/") {
          if (nextVal === 0) throw new Error("Division by zero.");
          reducedValues[reducedValues.length - 1] /= nextVal;
        } else {
          reducedOps.push(op);
          reducedValues.push(nextVal);
        }
      }

      // Evaluate + and -
      let result = reducedValues[0];
      for (let i = 0; i < reducedOps.length; i++) {
        if (reducedOps[i] === "+") result += reducedValues[i + 1];
        else result -= reducedValues[i + 1];
      }

      if (!Number.isFinite(result)) throw new Error("Computation error.");
      return result;
    }

    // Example usage:
    // console.log(evaluateFormula("3 + 4*2 - 1/5")); // 10.8
    // console.log(evaluateFormula("-3.5 + 2*-4"));   // -11.5
  </script>
</body>
</html>