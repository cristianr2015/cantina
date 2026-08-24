const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/authMiddleware');

function normalizeEventDate(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  const [, year, month, day, hour, minute, second = '00'] = match;
  const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
  if (Number.isNaN(date.getTime()) ||
      date.getFullYear() !== Number(year) || date.getMonth() + 1 !== Number(month) ||
      date.getDate() !== Number(day) || date.getHours() !== Number(hour) ||
      date.getMinutes() !== Number(minute)) return null;
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

function parsePrice(value, fallback = null) {
  if (value === undefined || value === null || value === '') return fallback;
  const price = Number(value);
  return Number.isFinite(price) && price >= 0 ? price : null;
}

async function loadEvent(id) {
  const [rows] = await db.query(
    `SELECT id, name, DATE_FORMAT(date, '%Y-%m-%dT%H:%i:%s') AS date,
            ticket_price_advance, ticket_price_door, created_at
     FROM events WHERE id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

router.get('/', auth(['admin', 'seller', 'puerta']), async (_req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, name, DATE_FORMAT(date, '%Y-%m-%dT%H:%i:%s') AS date,
              ticket_price_advance, ticket_price_door, created_at
       FROM events ORDER BY date DESC, id DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', auth(['admin']), async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const date = normalizeEventDate(req.body.date);
    if (!name || !date) {
      return res.status(400).json({ error: 'Nombre, fecha y hora de inicio son requeridos' });
    }

    const [settingsRows] = await db.query(
      'SELECT ticket_price_advance, ticket_price_door FROM settings WHERE id = 1 LIMIT 1'
    );
    const defaults = settingsRows[0] || {};
    const advancePrice = parsePrice(req.body.ticket_price_advance, Number(defaults.ticket_price_advance || 0));
    const doorPrice = parsePrice(req.body.ticket_price_door, Number(defaults.ticket_price_door || 0));
    if (advancePrice === null || doorPrice === null) {
      return res.status(400).json({ error: 'Los precios de entradas deben ser valores positivos o cero' });
    }

    const [result] = await db.query(
      `INSERT INTO events (name, date, ticket_price_advance, ticket_price_door)
       VALUES (?, ?, ?, ?)`,
      [name, date, advancePrice, doorPrice]
    );
    res.status(201).json(await loadEvent(result.insertId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', auth(['admin']), async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const date = normalizeEventDate(req.body.date);
    const advancePrice = parsePrice(req.body.ticket_price_advance);
    const doorPrice = parsePrice(req.body.ticket_price_door);
    if (!name || !date || advancePrice === null || doorPrice === null) {
      return res.status(400).json({ error: 'Ingrese nombre, fecha, hora y precios válidos' });
    }
    const [result] = await db.query(
      `UPDATE events SET name = ?, date = ?, ticket_price_advance = ?, ticket_price_door = ?
       WHERE id = ?`,
      [name, date, advancePrice, doorPrice, req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Evento no encontrado' });
    res.json(await loadEvent(req.params.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', auth(['admin']), async (req, res) => {
  try {
    const [eventCountRows] = await db.query('SELECT COUNT(*) AS total FROM events');
    if (Number(eventCountRows[0]?.total || 0) <= 1) {
      return res.status(409).json({ error: 'Debe existir al menos un evento en la aplicación' });
    }
    const tables = ['products', 'orders', 'sales', 'tickets_sold', 'partner_contributions', 'expenses', 'discounts'];
    let relatedRecords = 0;
    for (const table of tables) {
      const [rows] = await db.query(`SELECT COUNT(*) AS total FROM \`${table}\` WHERE event_id = ?`, [req.params.id]);
      relatedRecords += Number(rows[0]?.total || 0);
    }
    if (relatedRecords > 0) {
      return res.status(409).json({
        error: 'El evento contiene datos y no puede eliminarse. Puede conservarlo para consultar su historial.'
      });
    }
    const [result] = await db.query('DELETE FROM events WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Evento no encontrado' });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
module.exports.__test = { normalizeEventDate, parsePrice };
