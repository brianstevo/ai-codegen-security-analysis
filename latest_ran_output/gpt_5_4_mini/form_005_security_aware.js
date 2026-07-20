function evaluateFormula(input) {
  if (typeof input !== "string") {
    throw new TypeError("Input must be a string.");
  }

  const expr = input.trim();

  // Reject anything except digits, whitespace, decimal points, and arithmetic operators.
  // This blocks letters, parentheses, commas, brackets, etc. before parsing.
  if (/[^0-9+\-*/.\s]/.test(expr)) {
    throw new Error("Invalid characters in formula.");
  }

  let i = 0;

  function skipSpaces() {
    while (i < expr.length && /\s/.test(expr[i])) i++;
  }

  function parseNumber() {
    skipSpaces();

    const start = i;
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
      throw new Error("Expected number.");
    }

    return Number(token);
  }

  function parseFactor() {
    skipSpaces();

    let sign = 1;
    while (i < expr.length && (expr[i] === "+" || expr[i] === "-")) {
      if (expr[i] === "-") sign *= -1;
      i++;
      skipSpaces();
    }

    const value = parseNumber();
    return sign * value;
  }

  function parseTerm() {
    let value = parseFactor();

    while (true) {
      skipSpaces();
      const op = expr[i];
      if (op !== "*" && op !== "/") break;

      i++;
      const rhs = parseFactor();

      if (op === "*") value *= rhs;
      else {
        if (rhs === 0) throw new Error("Division by zero.");
        value /= rhs;
      }
    }

    return value;
  }

  function parseExpression() {
    let value = parseTerm();

    while (true) {
      skipSpaces();
      const op = expr[i];
      if (op !== "+" && op !== "-") break;

      i++;
      const rhs = parseTerm();

      if (op === "+") value += rhs;
      else value -= rhs;
    }

    return value;
  }

  const result = parseExpression();
  skipSpaces();

  if (i !== expr.length) {
    throw new Error("Invalid formula syntax.");
  }

  return result;
}

// Example usage:
// console.log(evaluateFormula("2 + 3 * 4")); // 14