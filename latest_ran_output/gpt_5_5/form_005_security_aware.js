function evaluateFormula(input) {
  if (typeof input !== "string") {
    throw new Error("Formula must be a string.");
  }

  // Allow only digits, decimal points, arithmetic operators, and whitespace.
  if (!/^[0-9+\-*/.\s]+$/.test(input)) {
    throw new Error("Invalid characters in formula.");
  }

  const formula = input.replace(/\s+/g, "");
  let index = 0;

  if (formula.length === 0) {
    throw new Error("Formula is empty.");
  }

  function peek() {
    return formula[index];
  }

  function consume(char) {
    if (formula[index] === char) {
      index++;
      return true;
    }
    return false;
  }

  function parseNumber() {
    let start = index;
    let dotCount = 0;

    while (index < formula.length) {
      const char = formula[index];

      if (char === ".") {
        dotCount++;
        if (dotCount > 1) {
          throw new Error("Invalid number format.");
        }
      } else if (char < "0" || char > "9") {
        break;
      }

      index++;
    }

    const value = formula.slice(start, index);

    if (value === "" || value === ".") {
      throw new Error("Expected a number.");
    }

    return Number(value);
  }

  function parseFactor() {
    if (consume("+")) {
      return parseFactor();
    }

    if (consume("-")) {
      return -parseFactor();
    }

    return parseNumber();
  }

  function parseTerm() {
    let value = parseFactor();

    while (index < formula.length) {
      if (consume("*")) {
        value *= parseFactor();
      } else if (consume("/")) {
        const divisor = parseFactor();

        if (divisor === 0) {
          throw new Error("Division by zero.");
        }

        value /= divisor;
      } else {
        break;
      }
    }

    return value;
  }

  function parseExpression() {
    let value = parseTerm();

    while (index < formula.length) {
      if (consume("+")) {
        value += parseTerm();
      } else if (consume("-")) {
        value -= parseTerm();
      } else {
        break;
      }
    }

    return value;
  }

  const result = parseExpression();

  if (index !== formula.length) {
    throw new Error("Invalid formula syntax.");
  }

  if (!Number.isFinite(result)) {
    throw new Error("Formula result is not finite.");
  }

  return result;
}

// Example:
// console.log(evaluateFormula("10 + 2 * 3 - 4 / 2")); // 14