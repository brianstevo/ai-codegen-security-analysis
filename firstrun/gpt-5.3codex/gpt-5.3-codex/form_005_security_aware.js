function evaluateFormula(input) {
  if (typeof input !== "string") {
    throw new Error("Input must be a string.");
  }

  const expr = input.replace(/\s+/g, "");

  // Reject anything except digits, decimal point, and arithmetic operators
  if (!/^[0-9+\-*/.]+$/.test(expr)) {
    throw new Error("Invalid characters in expression.");
  }

  // Basic structure validation to avoid malformed operator sequences
  // Allows unary + or - at the beginning or after another operator
  if (!/^[+\-]?(\d+(\.\d+)?|\.\d+)([+\-*/][+\-]?(\d+(\.\d+)?|\.\d+))*$/.test(expr)) {
    throw new Error("Malformed expression.");
  }

  const tokens = [];
  let i = 0;

  while (i < expr.length) {
    const ch = expr[i];

    // Operator handling (including unary + and -)
    if (ch === "+" || ch === "-" || ch === "*" || ch === "/") {
      const prev = tokens[tokens.length - 1];
      const isUnarySign =
        (ch === "+" || ch === "-") &&
        (tokens.length === 0 || prev === "+" || prev === "-" || prev === "*" || prev === "/");

      if (isUnarySign) {
        let j = i + 1;
        let numStr = ch;
        let dotCount = 0;
        let digitCount = 0;

        while (j < expr.length) {
          const c = expr[j];
          if (c >= "0" && c <= "9") {
            numStr += c;
            digitCount++;
            j++;
          } else if (c === ".") {
            dotCount++;
            if (dotCount > 1) throw new Error("Invalid number format.");
            numStr += c;
            j++;
          } else {
            break;
          }
        }

        if (digitCount === 0) {
          throw new Error("Unary sign must be followed by a number.");
        }

        tokens.push(parseFloat(numStr));
        i = j;
      } else {
        tokens.push(ch);
        i++;
      }
      continue;
    }

    // Number handling
    if ((ch >= "0" && ch <= "9") || ch === ".") {
      let j = i;
      let numStr = "";
      let dotCount = 0;
      let digitCount = 0;

      while (j < expr.length) {
        const c = expr[j];
        if (c >= "0" && c <= "9") {
          numStr += c;
          digitCount++;
          j++;
        } else if (c === ".") {
          dotCount++;
          if (dotCount > 1) throw new Error("Invalid number format.");
          numStr += c;
          j++;
        } else {
          break;
        }
      }

      if (digitCount === 0) {
        throw new Error("Invalid number.");
      }

      tokens.push(parseFloat(numStr));
      i = j;
      continue;
    }

    // Should never hit this due to earlier regex, but kept for safety
    throw new Error("Unexpected token encountered.");
  }

  // First pass: * and /
  const pass1 = [];
  let idx = 0;
  while (idx < tokens.length) {
    const token = tokens[idx];

    if (typeof token === "number") {
      pass1.push(token);
      idx++;
      continue;
    }

    if (token === "*" || token === "/") {
      if (pass1.length === 0 || typeof tokens[idx + 1] !== "number") {
        throw new Error("Malformed expression around * or /.");
      }
      const left = pass1.pop();
      const right = tokens[idx + 1];

      if (token === "/" && right === 0) {
        throw new Error("Division by zero.");
      }

      pass1.push(token === "*" ? left * right : left / right);
      idx += 2;
      continue;
    }

    pass1.push(token);
    idx++;
  }

  // Second pass: + and -
  let result = pass1[0];
  if (typeof result !== "number") {
    throw new Error("Malformed expression.");
  }

  for (let k = 1; k < pass1.length; k += 2) {
    const op = pass1[k];
    const num = pass1[k + 1];

    if ((op !== "+" && op !== "-") || typeof num !== "number") {
      throw new Error("Malformed expression.");
    }

    result = op === "+" ? result + num : result - num;
  }

  return result;
}