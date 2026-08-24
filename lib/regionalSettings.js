const REGIONS = Object.freeze({
  AR: { name: 'Argentina', locale: 'es-AR', taxIds: ['CUIT', 'CUIL', 'CDI'] },
  BO: { name: 'Bolivia', locale: 'es-BO', taxIds: ['NIT', 'CI'] },
  BR: { name: 'Brasil', locale: 'pt-BR', taxIds: ['CNPJ', 'CPF'] },
  CL: { name: 'Chile', locale: 'es-CL', taxIds: ['RUT'] },
  CO: { name: 'Colombia', locale: 'es-CO', taxIds: ['NIT', 'CC'] },
  CR: { name: 'Costa Rica', locale: 'es-CR', taxIds: ['Cédula jurídica', 'Cédula física'] },
  DO: { name: 'República Dominicana', locale: 'es-DO', taxIds: ['RNC', 'Cédula'] },
  EC: { name: 'Ecuador', locale: 'es-EC', taxIds: ['RUC', 'Cédula'] },
  SV: { name: 'El Salvador', locale: 'es-SV', taxIds: ['NIT', 'NRC'] },
  GT: { name: 'Guatemala', locale: 'es-GT', taxIds: ['NIT'] },
  HN: { name: 'Honduras', locale: 'es-HN', taxIds: ['RTN'] },
  MX: { name: 'México', locale: 'es-MX', taxIds: ['RFC', 'CURP'] },
  NI: { name: 'Nicaragua', locale: 'es-NI', taxIds: ['RUC'] },
  PA: { name: 'Panamá', locale: 'es-PA', taxIds: ['RUC', 'DV'] },
  PY: { name: 'Paraguay', locale: 'es-PY', taxIds: ['RUC'] },
  PE: { name: 'Perú', locale: 'es-PE', taxIds: ['RUC', 'DNI'] },
  UY: { name: 'Uruguay', locale: 'es-UY', taxIds: ['RUT', 'CI'] },
  VE: { name: 'Venezuela', locale: 'es-VE', taxIds: ['RIF'] }
});

const CURRENCIES = Object.freeze({
  ARS: { name: 'Peso argentino', symbol: '$' },
  BOB: { name: 'Boliviano', symbol: 'Bs' },
  BRL: { name: 'Real brasileño', symbol: 'R$' },
  CLP: { name: 'Peso chileno', symbol: '$' },
  COP: { name: 'Peso colombiano', symbol: '$' },
  CRC: { name: 'Colón costarricense', symbol: '₡' },
  DOP: { name: 'Peso dominicano', symbol: 'RD$' },
  USD: { name: 'Dólar estadounidense', symbol: 'US$' },
  GTQ: { name: 'Quetzal', symbol: 'Q' },
  HNL: { name: 'Lempira', symbol: 'L' },
  MXN: { name: 'Peso mexicano', symbol: '$' },
  NIO: { name: 'Córdoba', symbol: 'C$' },
  PAB: { name: 'Balboa', symbol: 'B/.' },
  PYG: { name: 'Guaraní', symbol: '₲' },
  PEN: { name: 'Sol peruano', symbol: 'S/' },
  UYU: { name: 'Peso uruguayo', symbol: '$U' },
  VES: { name: 'Bolívar', symbol: 'Bs.' }
});

function parseTaxIdentifiers(value, legacyCuit = '', regionCode = 'AR') {
  let parsed = value;
  if (Buffer.isBuffer(parsed)) parsed = parsed.toString('utf8');
  if (typeof parsed === 'string') {
    try {
      parsed = parsed.trim() ? JSON.parse(parsed) : {};
    } catch (_) {
      parsed = {};
    }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) parsed = {};

  const region = REGIONS[regionCode] || REGIONS.AR;
  const normalized = {};
  region.taxIds.forEach(identifier => {
    const text = String(parsed[identifier] || '').trim();
    if (text) normalized[identifier] = text.slice(0, 100);
  });
  if (regionCode === 'AR' && !normalized.CUIT && String(legacyCuit || '').trim()) {
    normalized.CUIT = String(legacyCuit).trim().slice(0, 100);
  }
  return normalized;
}

function normalizeRegionalSettings(input = {}) {
  const regionCode = String(input.region_code || 'AR').trim().toUpperCase();
  if (!REGIONS[regionCode]) throw new RangeError('Seleccioná una región válida');

  const currencyCode = String(input.currency_code || 'ARS').trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9._/-]{1,9}$/.test(currencyCode)) {
    throw new RangeError('El código de moneda debe tener entre 2 y 10 caracteres');
  }
  const defaultSymbol = CURRENCIES[currencyCode]?.symbol || '';
  const currencySymbol = String(input.currency_symbol || defaultSymbol).trim();
  if (!currencySymbol || currencySymbol.length > 10) {
    throw new RangeError('El símbolo de moneda debe tener entre 1 y 10 caracteres');
  }

  const taxIdentifiers = parseTaxIdentifiers(input.tax_identifiers, input.cuit, regionCode);
  return {
    region_code: regionCode,
    currency_code: currencyCode,
    currency_symbol: currencySymbol,
    tax_identifiers: taxIdentifiers
  };
}

function localeForRegion(regionCode) {
  return REGIONS[String(regionCode || '').toUpperCase()]?.locale || REGIONS.AR.locale;
}

function formatRegionalMoney(value, settings = {}) {
  const amount = Number(value || 0);
  const symbol = String(settings.currency_symbol || '$').trim() || '$';
  const formattedAmount = (Number.isFinite(amount) ? amount : 0).toLocaleString(
    localeForRegion(settings.region_code),
    { minimumFractionDigits: 2, maximumFractionDigits: 2 }
  );
  return `${symbol} ${formattedAmount}`;
}

function taxIdentifierEntries(settings = {}) {
  const regionCode = String(settings.region_code || 'AR').toUpperCase();
  const values = parseTaxIdentifiers(settings.tax_identifiers, settings.cuit, regionCode);
  return Object.entries(values);
}

module.exports = {
  REGIONS,
  CURRENCIES,
  parseTaxIdentifiers,
  normalizeRegionalSettings,
  localeForRegion,
  formatRegionalMoney,
  taxIdentifierEntries
};
