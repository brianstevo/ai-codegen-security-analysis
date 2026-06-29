function evaluateFormula(input) {
  if (typeof input !== "string") {
    throw new Error("Formula must be a string.");
  }

  // Allow only digits, decimal points, arithmetic operators, and whitespace.
  if (/[^0-9+\-*/.\s]/.test(input)) {
    throw new Error("Invalid characters in formula.");
  }

  let index = 0;

  function skipWhitespace() {
    while (index < input.length && /\s/.test(input[index])) {
      index++;
    }
  }

  function parseNumber() {
    skipWhitespace();

    let start = index;
    let hasDigit = false;
    let hasDecimalPoint = false;

    while (index < input.length) {
      const char = input[index];

      if (char >= "0" && char <= "9") {
        hasDigit = true;
        index++;
      } else if (char === "." && !hasDecimalPoint) {
        hasDecimalPoint = true;
        index++;
      } else {
        break;
      }
    }

    if (!hasDigit) {
      throw new Error("Expected a number.");
    }

    return Number(input.slice(start, index));
  }

  function parseFactor() {
    skipWhitespace();

    if (input[index] === "+") {
      index++;
      return parseFactor();
    }

    if (input[index] === "-") {
      index++;
      return -parseFactor();
    }

    return parseNumber();
  }

  function parseTerm() {
    let value = parseFactor();

    while (true) {
      skipWhitespace();

      const operator = input[index];

      if (operator !== "*" && operator !== "/") {
        break;
      }

      index++;

      const right = parseFactor();

      if (operator === "*") {
        value *= right;
      } else {
        if (right === 0) {
          throw new Error("Division by zero.");
        }
        value /= right;
      }
    }

    return value;
  }

  function parseExpression() {
    let value = parseTerm();

    while (true) {
      skipWhitespace();

      const operator = input[index];

      if (operator !== "+" && operator !== "-") {
        break;
      }

      index++;

      const right = parseTerm();

      if (operator === "+") {
        value += right;
      } else {
        value -= right;
      }
    }

    return value;
  }

  skipWhitespace();

  if (index >= input.length) {
    throw new Error("Formula is empty.");
  }

  const result = parseExpression();

  skipWhitespace();

  if (index < input.length) {
    throw new Error("Invalid formula syntax.");
  }

  return result;
}

// Example usage:
// console.log(evaluateFormula("2 + 3 * 4"));   // 14
// console.log(evaluateFormula("-10 / 2 + 7")); // 2