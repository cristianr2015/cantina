const assert = require('node:assert/strict');
const test = require('node:test');
const ticketsRouter = require('../routes/tickets');
const { buildTicketPdf } = require('../lib/ticketPdf');

const { parseQuantity, priceForType, createQrToken } = ticketsRouter.__test;

test('valida cantidades y determina el precio por tipo', () => {
  assert.equal(parseQuantity(1), 1);
  assert.equal(parseQuantity('50'), 50);
  assert.equal(parseQuantity(0), null);
  assert.equal(parseQuantity(51), null);
  assert.equal(priceForType('anticipada', { ticket_price_advance: '15000' }), 15000);
  assert.equal(priceForType('puerta', { ticket_price_door: '18000' }), 18000);
  assert.equal(priceForType('cortesia', {}), 0);
});

test('genera tokens QR aleatorios solo para entradas anticipadas', () => {
  const first = createQrToken('anticipada');
  const second = createQrToken('anticipada');
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.match(second, /^[a-f0-9]{64}$/);
  assert.notEqual(first, second);
  assert.equal(createQrToken('puerta'), null);
  assert.equal(createQrToken('cortesia'), null);
});

test('genera un PDF imprimible con una página por entrada', async () => {
  const tickets = [1, 2].map(id => ({
    id,
    first_name: 'Maria',
    last_name: 'Fernandez',
    dni: '12345678',
    ticket_type: 'anticipada',
    price_paid: 15000,
    qr_token: String(id).repeat(64),
    sold_at: new Date('2026-08-21T12:00:00Z')
  }));
  const pdf = await buildTicketPdf(tickets, {
    company_name: 'Pena Los Amigos',
    cuit: '30-12345678-9',
    address: 'Calle 123',
    phone: '11 5555-5555',
    email: 'contacto@example.com'
  });

  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  assert.ok(pdf.length > 5000);
  assert.match(pdf.subarray(-20).toString(), /%%EOF/);
});
