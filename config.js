const isProduction = process.env.NODE_ENV === 'production';

function requiredInProduction(name, developmentValue) {
  const value = process.env[name];
  if (value) return value;
  if (isProduction) {
    throw new Error(`${name} es obligatoria cuando NODE_ENV=production`);
  }
  return developmentValue;
}

module.exports = {
  jwtSecret: requiredInProduction('JWT_SECRET', 'secret_dev_change_this')
};
