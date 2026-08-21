const crypto = require('crypto');
const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/authMiddleware');
const { buildTicketPdf } = require('../lib/ticketPdf');

const ticketRoles = ['admin', 'seller', 'puerta'];
const validTicketTypes = new Set(['anticipada', 'puerta', 'cortesia']);
const validPaymentMethods = new Set(['cash', 'mercadopago']);

function parseQuantity(value) {
  const quantity = Number.parseInt(value ?? 1, 10);
  return Number.isInteger(quantity) && quantity >= 1 && quantity <= 50 ? quantity : null;
}

function priceForType(type, settings) {
  if (type === 'anticipada') return Number(settings.ticket_price_advance || 0);
  if (type === 'puerta') return Number(settings.ticket_price_door || 0);
  return 0;
}

function createQrToken(type) {
  return type === 'anticipada' ? crypto.randomBytes(32).toString('hex') : null;
}

async function loadTicketsByIds(connection, ids) {
  if (!ids.length) return [];
  const placeholders = ids.map(() => '?').join(',');
  const [rows] = await connection.query(
    `SELECT t.*, u.username AS sold_by
     FROM tickets_sold t
     LEFT JOIN users u ON t.user_id = u.id
     WHERE t.id IN (${placeholders})`,
    ids
  );
  const positions = new Map(ids.map((id, index) => [Number(id), index]));
  return rows.sort((a, b) => positions.get(Number(a.id)) - positions.get(Number(b.id)));
}

router.get('/', auth(ticketRoles), async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
    let sql = 'SELECT t.*, u.username as sold_by FROM tickets_sold t LEFT JOIN users u ON t.user_id = u.id';
    const params = [];
    if (search) {
      sql += ' WHERE t.first_name LIKE ? OR t.last_name LIKE ? OR t.dni LIKE ?';
      const term = '%' + search + '%';
      params.push(term, term, term);
    }
    sql += ' ORDER BY t.sold_at DESC';
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', auth(ticketRoles), async (req, res) => {
  let connection;
  try {
    connection = await db.getConnection();
    const { first_name, last_name, dni, user_id, entered } = req.body;
    const ticketType = String(req.body.ticket_type || 'anticipada');
    const paymentMethod = String(req.body.payment_method || 'cash');
    const quantity = parseQuantity(req.body.quantity);

    if (!first_name || !last_name || !dni) {
      return res.status(400).json({ error: 'Faltan datos requeridos' });
    }
    if (!validTicketTypes.has(ticketType)) {
      return res.status(400).json({ error: 'Tipo de entrada inválido' });
    }
    if (!validPaymentMethods.has(paymentMethod)) {
      return res.status(400).json({ error: 'Forma de pago inválida' });
    }
    if (!quantity) {
      return res.status(400).json({ error: 'La cantidad debe estar entre 1 y 50' });
    }

    const requestedUserId = user_id ? Number.parseInt(user_id, 10) : null;
    const userId = req.user.role === 'admin' && Number.isInteger(requestedUserId)
      ? requestedUserId
      : req.user.id;

    await connection.beginTransaction();
    const [settingRows] = await connection.query(
      'SELECT ticket_price_advance, ticket_price_door FROM settings WHERE id = 1 LIMIT 1 FOR SHARE'
    );
    const settings = settingRows[0] || {};
    const pricePaid = priceForType(ticketType, settings);
    const enteredValue = ticketType === 'puerta' && entered ? 1 : 0;
    const enteredAt = enteredValue ? new Date() : null;
    const ids = [];

    for (let index = 0; index < quantity; index += 1) {
      const [result] = await connection.query(
        `INSERT INTO tickets_sold
          (first_name, last_name, dni, payment_method, ticket_type, price_paid, qr_token,
           user_id, entered, entered_at, sold_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          String(first_name).trim(), String(last_name).trim(), String(dni).trim(),
          paymentMethod, ticketType, pricePaid, createQrToken(ticketType), userId,
          enteredValue, enteredAt
        ]
      );
      ids.push(result.insertId);
    }

    const tickets = await loadTicketsByIds(connection, ids);
    await connection.commit();
    res.status(201).json({ ok: true, quantity: tickets.length, tickets, ...tickets[0] });
  } catch (err) {
    if (connection) await connection.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) connection.release();
  }
});

router.post('/pdf', auth(ticketRoles), async (req, res) => {
  try {
    const ids = Array.from(new Set((req.body.ids || [])
      .map(id => Number.parseInt(id, 10))
      .filter(Number.isInteger)));
    if (!ids.length || ids.length > 50) {
      return res.status(400).json({ error: 'Se requieren entre 1 y 50 entradas' });
    }

    const tickets = await loadTicketsByIds(db, ids);
    if (tickets.length !== ids.length || tickets.some(ticket => ticket.ticket_type !== 'anticipada')) {
      return res.status(400).json({ error: 'Solo se pueden imprimir entradas anticipadas válidas' });
    }
    const [settingsRows] = await db.query('SELECT * FROM settings WHERE id = 1 LIMIT 1');
    const pdf = await buildTicketPdf(tickets, settingsRows[0] || {});

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Length': pdf.length,
      'Content-Disposition': `inline; filename="entradas-anticipadas-${ids[0]}.pdf"`,
      'Cache-Control': 'private, no-store'
    });
    res.end(pdf);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', auth(ticketRoles), async (req, res) => {
  try {
    const { first_name, last_name, dni, user_id } = req.body;
    const { id } = req.params;
    if (!first_name || !last_name || !dni) return res.status(400).json({ error: 'Faltan datos requeridos' });

    let update;
    if (req.user.role === 'admin') {
      const requestedUserId = user_id ? Number.parseInt(user_id, 10) : null;
      const userIdInt = Number.isInteger(requestedUserId) ? requestedUserId : req.user.id;
      [update] = await db.query(
        'UPDATE tickets_sold SET first_name = ?, last_name = ?, dni = ?, user_id = ? WHERE id = ?',
        [String(first_name).trim(), String(last_name).trim(), String(dni).trim(), userIdInt, id]
      );
    } else {
      [update] = await db.query(
        'UPDATE tickets_sold SET first_name = ?, last_name = ?, dni = ? WHERE id = ?',
        [String(first_name).trim(), String(last_name).trim(), String(dni).trim(), id]
      );
    }

    if (update.affectedRows === 0) return res.status(404).json({ error: 'Entrada no encontrada' });
    const [rows] = await db.query('SELECT * FROM tickets_sold WHERE id = ?', [id]);
    res.json({ ok: true, ...rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/enter', auth(ticketRoles), async (req, res) => {
  try {
    const { id } = req.params;
    if (req.body.entered !== true) {
      return res.status(400).json({ error: 'Un ingreso registrado no puede desmarcarse' });
    }
    const [update] = await db.query(
      'UPDATE tickets_sold SET entered = 1, entered_at = NOW() WHERE id = ? AND entered = 0',
      [id]
    );
    if (update.affectedRows === 0) {
      const [rows] = await db.query('SELECT entered, entered_at FROM tickets_sold WHERE id = ?', [id]);
      if (!rows[0]) return res.status(404).json({ error: 'Entrada no encontrada' });
      return res.status(409).json({ error: 'Esta entrada ya fue utilizada', entered_at: rows[0].entered_at });
    }
    const [rows] = await db.query('SELECT * FROM tickets_sold WHERE id = ?', [id]);
    res.json({ ok: true, ...rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/validate', auth(ticketRoles), async (req, res) => {
  try {
    const token = String(req.body.token || '').trim();
    if (!/^[a-f0-9]{64}$/.test(token)) {
      return res.status(400).json({ error: 'Código QR inválido' });
    }
    const [update] = await db.query(
      `UPDATE tickets_sold
       SET entered = 1, entered_at = NOW()
       WHERE qr_token = ? AND ticket_type = 'anticipada' AND entered = 0`,
      [token]
    );
    if (update.affectedRows === 0) {
      const [rows] = await db.query(
        'SELECT id, first_name, last_name, entered, entered_at FROM tickets_sold WHERE qr_token = ? LIMIT 1',
        [token]
      );
      if (!rows[0]) return res.status(404).json({ error: 'Entrada inexistente o QR inválido' });
      return res.status(409).json({
        error: 'Esta entrada ya fue utilizada',
        entered_at: rows[0].entered_at,
        ticket: rows[0]
      });
    }
    const [rows] = await db.query(
      'SELECT id, first_name, last_name, dni, ticket_type, entered, entered_at FROM tickets_sold WHERE qr_token = ? LIMIT 1',
      [token]
    );
    res.json({ ok: true, message: 'Ingreso registrado', ticket: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', auth(ticketRoles), async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM tickets_sold WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Entrada no encontrada' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
module.exports.__test = { parseQuantity, priceForType, createQrToken };
