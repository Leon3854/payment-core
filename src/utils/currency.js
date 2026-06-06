// Работаем ТОЛЬКО с целыми числами (копейки/центы)
const toCents = (amount) => {
  if (typeof amount !== 'number' || isNaN(amount)) {
    throw new Error('Amount must be a number');
  }
  return Math.round(amount * 100);
};

const toCurrency = (cents) => {
  return Number((cents / 100).toFixed(2));
};

module.exports = { toCents, toCurrency };