const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeExpense } = require('../lib/expenseValidation');

test('normaliza un gasto válido', () => {
  const result = normalizeExpense({
    description: '  Compra de bebidas  ',
    category: 'Mercadería',
    supplier: ' Proveedor Uno ',
    amount: '12500.50',
    payment_method: 'transfer',
    status: 'paid',
    expense_date: '2026-08-24',
    user_id: '3'
  });
  assert.equal(result.value.description, 'Compra de bebidas');
  assert.equal(result.value.amount, 12500.5);
  assert.equal(result.value.user_id, 3);
  assert.equal(result.value.supplier, 'Proveedor Uno');
});

test('rechaza importes no positivos y fechas inválidas', () => {
  assert.match(normalizeExpense({ description: 'X', category: 'Otros', amount: 0, expense_date: '2026-08-24' }).error, /importe/i);
  assert.match(normalizeExpense({ description: 'X', category: 'Otros', amount: 10, expense_date: '24-08-2026' }).error, /fecha/i);
  assert.match(normalizeExpense({ description: 'X', category: 'Otros', amount: 10, expense_date: '2026-02-30' }).error, /fecha/i);
});

test('rechaza estados y medios de pago desconocidos', () => {
  const base = { description: 'X', category: 'Otros', amount: 10, expense_date: '2026-08-24' };
  assert.match(normalizeExpense({ ...base, payment_method: 'crypto' }).error, /medio de pago/i);
  assert.match(normalizeExpense({ ...base, status: 'cancelled' }).error, /estado/i);
});
