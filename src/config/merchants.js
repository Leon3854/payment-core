// В реальном проекте это было бы в БД
const merchants = {
  'merchant_001': { feePercent: 0.03, name: 'Shop A' },
  'merchant_002': { feePercent: 0.05, name: 'Shop B' }
};

const getMerchantConfig = (merchantId) => {
  const config = merchants[merchantId];
  if (!config) throw new Error('Merchant not found');
  return config;
};

module.exports = { getMerchantConfig };