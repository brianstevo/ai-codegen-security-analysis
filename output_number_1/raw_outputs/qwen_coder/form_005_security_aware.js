const math = require('mathjs');

function evaluateExpression(expression) {
  const allowedOperators = ['+', '-', '*', '/', '^', '(', ')'];
  const regex = /^[0-9\+\-\*\/\^\(\)\s]+$/;

  if (!regex.test(expression)) {
    throw new Error('Invalid expression');
  }

  try {
    return math.evaluate(expression, { number: 'BigNumber' });
  } catch (error) {
    throw new Error('Evaluation error');
  }
}

module.exports = evaluateExpression;