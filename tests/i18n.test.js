const assert = require('node:assert/strict');
const test = require('node:test');
const { localeFor, normalizeLanguage, translate } = require('../public/i18n');

test('normaliza los tres idiomas soportados y usa español como alternativa segura', () => {
  assert.equal(normalizeLanguage('es-AR'), 'es');
  assert.equal(normalizeLanguage('pt-BR'), 'pt');
  assert.equal(normalizeLanguage('en-US'), 'en');
  assert.equal(normalizeLanguage('fr'), 'es');
});

test('traduce textos centrales de la interfaz al portugués y al inglés', () => {
  assert.equal(translate('Configuración', 'pt'), 'Configurações');
  assert.equal(translate('Configuración', 'en'), 'Settings');
  assert.equal(translate('Registrar venta', 'pt'), 'Registrar venda');
  assert.equal(translate('Registrar venta', 'en'), 'Register sale');
  assert.equal(translate('Configuración', 'es'), 'Configuración');
});

test('traduce mensajes dinámicos sin modificar nombres, cantidades ni valores', () => {
  assert.equal(translate('Evento activo: Peña Octubre', 'pt'), 'Evento ativo: Peña Octubre');
  assert.equal(translate('Evento activo: Peña Octubre', 'en'), 'Active event: Peña Octubre');
  assert.equal(translate('Stock insuficiente para Empanada (Disponible: 3)', 'pt'), 'Estoque insuficiente para Empanada (Disponível: 3)');
  assert.equal(translate('Stock insuficiente para Empanada (Disponible: 3)', 'en'), 'Insufficient stock for Empanada (Available: 3)');
  assert.equal(translate('2 usuarios', 'en'), '2 users');
});

test('expone la configuración regional correcta para fechas y moneda', () => {
  assert.equal(localeFor('es'), 'es-AR');
  assert.equal(localeFor('pt'), 'pt-BR');
  assert.equal(localeFor('en'), 'en-US');
});
