const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeRegionalSettings,
  parseTaxIdentifiers,
  formatRegionalMoney,
  taxIdentifierEntries
} = require('../lib/regionalSettings');

test('normaliza una moneda latinoamericana y sus identificadores opcionales', () => {
  const settings = normalizeRegionalSettings({
    region_code: 'br',
    currency_code: 'brl',
    currency_symbol: 'R$',
    tax_identifiers: { CNPJ: '12.345.678/0001-90', CPF: '', CUIT: 'ignorado' }
  });

  assert.deepEqual(settings, {
    region_code: 'BR',
    currency_code: 'BRL',
    currency_symbol: 'R$',
    tax_identifiers: { CNPJ: '12.345.678/0001-90' }
  });
});

test('acepta una moneda personalizada y rechaza configuraciones inválidas', () => {
  const custom = normalizeRegionalSettings({
    region_code: 'UY',
    currency_code: 'FICHA',
    currency_symbol: '¤',
    tax_identifiers: {}
  });
  assert.equal(custom.currency_code, 'FICHA');
  assert.equal(custom.currency_symbol, '¤');
  assert.throws(() => normalizeRegionalSettings({ region_code: 'XX' }), /región válida/);
  assert.throws(() => normalizeRegionalSettings({ region_code: 'AR', currency_code: 'A', currency_symbol: '$' }), /código de moneda/);
});

test('migra el CUIT anterior y conserva los identificadores del país seleccionado', () => {
  assert.deepEqual(parseTaxIdentifiers(null, '20-12345678-9', 'AR'), { CUIT: '20-12345678-9' });
  assert.deepEqual(
    taxIdentifierEntries({ region_code: 'MX', tax_identifiers: JSON.stringify({ RFC: 'ABC010203XX1', CURP: 'CURP123' }) }),
    [['RFC', 'ABC010203XX1'], ['CURP', 'CURP123']]
  );
});

test('formatea importes con el símbolo y la región configurados', () => {
  assert.equal(formatRegionalMoney(1234.5, { region_code: 'AR', currency_symbol: '$' }), '$ 1.234,50');
  assert.equal(formatRegionalMoney(1234.5, { region_code: 'MX', currency_symbol: '$' }), '$ 1,234.50');
  assert.equal(formatRegionalMoney(1234.5, { region_code: 'BR', currency_symbol: 'R$' }), 'R$ 1.234,50');
});
