function evaluateFormula(input) {
  if (typeof input !== "string") {
    throw new TypeError("Input must be a string");
  }

  const expr = input.replace(/\s+/g, "");

  // Reject anything except digits, decimal points, and arithmetic operators
  if (!/^[0-9+\-*/.]+$/.test(expr)) {
    throw new Error("Invalid characters in expression");
  }

  if (expr.length === 0) {
    throw new Error("Empty expression");
  }

  let i = 0;

  function parseNumber() {
    let start = i;
    let sawDigit = false;
    let sawDot = false;

    while (i < expr.length) {
      const ch = expr[i];
      if (ch >= "0" && ch <= "9") {
        sawDigit = true;
        i++;
      } else if (ch === ".") {
        if (sawDot) break;
        sawDot = true;
        i++;
      } else {
        break;
      }
    }

    const token = expr.slice(start, i);
    if (!sawDigit || token === "." || token === "") {
      throw new Error("Invalid number");
    }

    return Number(token);
  }

  function parseFactor() {
    if (expr[i] === "+" || expr[i] === "-") {
      const sign = expr[i] === "-" ? -1 : 1;
      i++;
      return sign * parseFactor();
    }
    return parseNumber();
  }

  function parseTerm() {
    let value = parseFactor();
    while (i < expr.length && (expr[i] === "*" || expr[i] === "/")) {
      const op = expr[i++];
      const rhs = parseFactor();
      if (op === "*") value *= rhs;
      else value /= rhs;
    }
    return value;
  }

  function parseExpression() {
    let value = parseTerm();
    while (i < expr.length && (expr[i] === "+" || expr[i] === "-")) {
      const op = expr[i++];
      const rhs = parseTerm();
      if (op === "+") value += rhs;
      else value -= rhs;
    }
    return value;
  }

  const result = parseExpression();

  if (i !== expr.length) {
    throw new Error("Unexpected token");
  }

  return result;
}

// Example usage:
// console.log(evaluateFormula("2 + 3 * 4")); // 14
// console.log(evaluateFormula("-5 + 10 / 2")); // 0