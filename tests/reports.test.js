const test = require('node:test');
const assert = require('node:assert/strict');
const { buildClosingSummary } = require('../lib/reportMetrics');

test('calcula el cierre financiero y de asistencia del evento', () => {
  const result = buildClosingSummary({
    event: { name: 'Peña agosto', date: '2026-08-24 20:00:00' },
    products: { revenue: '100000', estimated_cost: '40000', orders: 12, items: 30 },
    tickets: { revenue: '50000', sold: 100, entered: 82, courtesy: 10 },
    expenses: { paid: '30000', pending: '5000', records: 6 }
  });

  assert.equal(result.total_income, 150000);
  assert.equal(result.cash_result, 120000);
  assert.equal(result.committed_result, 115000);
  assert.equal(result.estimated_product_margin, 60000);
  assert.equal(result.tickets_not_entered, 18);
  assert.equal(result.attendance_rate, 82);
});

test('devuelve valores seguros cuando el evento no tiene movimientos', () => {
  const result = buildClosingSummary();
  assert.equal(result.total_income, 0);
  assert.equal(result.committed_result, 0);
  assert.equal(result.attendance_rate, 0);
  assert.equal(result.tickets_not_entered, 0);
});
