const assert = require('node:assert/strict');
const test = require('node:test');
const ticketsRouter = require('../routes/tickets');
const eventsRouter = require('../routes/events');
const { buildTicketPdf } = require('../lib/ticketPdf');
const { parseEventId } = require('../middleware/eventContext');

const { parseQuantity, parseTicketIds, priceForType, createQrToken, canSellAdvanceTicket } = ticketsRouter.__test;
const { normalizeEventDate, parsePrice } = eventsRouter.__test;

test('valida cantidades y determina el precio por tipo', () => {
  assert.equal(parseQuantity(1), 1);
  assert.equal(parseQuantity('50'), 50);
  assert.equal(parseQuantity(0), null);
  assert.equal(parseQuantity(51), null);
  assert.equal(priceForType('anticipada', { ticket_price_advance: '15000' }), 15000);
  assert.equal(priceForType('puerta', { ticket_price_door: '18000' }), 18000);
  assert.equal(priceForType('cortesia', {}), 0);
});

test('valida y normaliza los IDs para una eliminación parcial de entradas', () => {
  assert.deepEqual(parseTicketIds([3, '2', 3, 1]), [3, 2, 1]);
  assert.equal(parseTicketIds([]), null);
  assert.equal(parseTicketIds('1'), null);
  assert.equal(parseTicketIds([0, -1, 'x']), null);
  assert.equal(parseTicketIds([1, 'x']), null);
  assert.equal(parseTicketIds(Array.from({ length: 1001 }, (_, index) => index + 1)), null);
});

test('valida el evento activo, su fecha de comienzo y sus precios', () => {
  assert.equal(parseEventId('8'), 8);
  assert.equal(parseEventId(0), null);
  assert.equal(parseEventId('evento'), null);
  assert.equal(normalizeEventDate('2026-09-12T20:30'), '2026-09-12 20:30:00');
  assert.equal(normalizeEventDate('2026-02-30T20:30'), null);
  assert.equal(normalizeEventDate('2026-09-12'), null);
  assert.equal(parsePrice('15000'), 15000);
  assert.equal(parsePrice(-1), null);
  assert.equal(parsePrice('', 12000), 12000);
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

test('cierra la venta anticipada exactamente una hora antes del evento', () => {
  const eventDate = new Date('2026-09-12T20:00:00Z');
  assert.equal(canSellAdvanceTicket(eventDate, new Date('2026-09-12T18:59:59Z')), true);
  assert.equal(canSellAdvanceTicket(eventDate, new Date('2026-09-12T19:00:00Z')), true);
  assert.equal(canSellAdvanceTicket(eventDate, new Date('2026-09-12T19:00:00.001Z')), false);
  assert.equal(canSellAdvanceTicket('fecha-invalida', new Date()), false);
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
