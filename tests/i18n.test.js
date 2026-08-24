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
  assert.equal(translate('Cambiar de empresa', 'pt'), 'Trocar de empresa');
  assert.equal(translate('Cambiar de empresa', 'en'), 'Change company');
  assert.equal(translate('Gestión simple para eventos reales', 'pt'), 'Gestão simples para eventos reais');
  assert.equal(translate('Todo tu evento,', 'en'), 'Your entire event,');
  assert.equal(translate('Región y moneda', 'pt'), 'Região e moeda');
  assert.equal(translate('Identificación tributaria', 'en'), 'Tax identification');
  assert.equal(translate('Guardar configuración', 'en'), 'Save settings');
  assert.equal(translate('Desarrollado por Cristian Ramirez © 2026', 'pt'), 'Desenvolvido por Cristian Ramirez © 2026');
  assert.equal(translate('Desarrollado por Cristian Ramirez © 2026', 'en'), 'Developed by Cristian Ramirez © 2026');
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
