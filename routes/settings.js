const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/authMiddleware');
const { requireEvent } = require('../middleware/eventContext');
const path = require('path');
const fs = require('fs');
const { normalizeRegionalSettings, parseTaxIdentifiers } = require('../lib/regionalSettings');

const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

function serializeSettings(row) {
  if (!row) return row;
  return {
    ...row,
    tax_identifiers: parseTaxIdentifiers(row.tax_identifiers, row.cuit, row.region_code || 'AR')
  };
}

// Obtener settings (any authenticated user can read)
router.get('/', auth(['admin', 'seller', 'puerta']), requireEvent, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT s.id, s.cuit, s.company_name, s.logo_path, s.address, s.phone, s.email,
              s.region_code, s.currency_code, s.currency_symbol, s.tax_identifiers,
              e.ticket_price_advance, e.ticket_price_door,
              e.id AS event_id, e.name AS event_name,
              DATE_FORMAT(e.date, '%Y-%m-%dT%H:%i:%s') AS event_date
       FROM settings s
       INNER JOIN events e ON e.id = ?
       WHERE s.id = 1 LIMIT 1`,
      [req.eventId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'El evento activo ya no existe' });
    res.json(serializeSettings(rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Actualizar datos de la peña y precios vigentes de entradas.
router.put('/', auth(['admin']), requireEvent, async (req, res) => {
  let connection;
  try {
    const {
      cuit, company_name, address, phone, email,
      region_code, currency_code, currency_symbol, tax_identifiers,
      ticket_price_advance, ticket_price_door
    } = req.body;
    const advancePrice = Number(ticket_price_advance);
    const doorPrice = Number(ticket_price_door);
    if (!company_name || !Number.isFinite(advancePrice) || advancePrice < 0 ||
        !Number.isFinite(doorPrice) || doorPrice < 0) {
      return res.status(400).json({ error: 'Nombre y precios válidos son requeridos' });
    }
    let regional;
    try {
      regional = normalizeRegionalSettings({
        cuit, region_code, currency_code, currency_symbol, tax_identifiers
      });
    } catch (validationError) {
      return res.status(400).json({ error: validationError.message });
    }
    const legacyCuit = regional.region_code === 'AR' ? (regional.tax_identifiers.CUIT || '') : '';
    connection = await db.getConnection();
    await connection.beginTransaction();
    await connection.query(
      `UPDATE settings
       SET cuit = ?, company_name = ?, address = ?, phone = ?, email = ?,
           region_code = ?, currency_code = ?, currency_symbol = ?, tax_identifiers = ?,
           ticket_price_advance = ?, ticket_price_door = ?
       WHERE id = 1`,
      [
        legacyCuit, String(company_name).trim(), String(address || '').trim(),
        String(phone || '').trim(), String(email || '').trim(),
        regional.region_code, regional.currency_code, regional.currency_symbol,
        JSON.stringify(regional.tax_identifiers), advancePrice, doorPrice
      ]
    );
    const [eventUpdate] = await connection.query(
      `UPDATE events SET ticket_price_advance = ?, ticket_price_door = ? WHERE id = ?`,
      [advancePrice, doorPrice, req.eventId]
    );
    if (!eventUpdate.affectedRows) {
      await connection.rollback();
      return res.status(404).json({ error: 'El evento activo ya no existe' });
    }
    await connection.commit();
    const [rows] = await db.query(
      `SELECT s.*, e.ticket_price_advance, e.ticket_price_door, e.name AS event_name
       FROM settings s INNER JOIN events e ON e.id = ? WHERE s.id = 1`,
      [req.eventId]
    );
    res.json(serializeSettings(rows[0]));
  } catch (err) {
    if (connection) await connection.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) connection.release();
  }
});

// Subir logo (recibe JSON { filename, data } donde data es base64 sin prefijo)
router.post('/logo', auth(['admin']), async (req, res) => {
  try {
    const { filename, data } = req.body;
    if (!data) return res.status(400).json({ error: 'data base64 requerida' });
    const ext = path.extname(filename || 'logo.png') || '.png';
    const name = 'logo_' + Date.now() + ext;
    const filePath = path.join(uploadDir, name);
    const buffer = Buffer.from(data, 'base64');
    fs.writeFileSync(filePath, buffer);
    const relPath = '/uploads/' + name;
    await db.query('UPDATE settings SET logo_path = ? WHERE id = 1', [relPath]);
    const [rows] = await db.query('SELECT * FROM settings WHERE id = 1');
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Gestión de Descuentos ---
router.get('/discounts', auth(['admin', 'seller']), requireEvent, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM discounts WHERE event_id = ? ORDER BY percentage ASC',
      [req.eventId]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/discounts', auth(['admin']), requireEvent, async (req, res) => {
  try {
    const { name, percentage } = req.body;
    if (!name || percentage === undefined) return res.status(400).json({ error: 'Nombre y porcentaje requeridos' });
    const [result] = await db.query(
      'INSERT INTO discounts (name, percentage, event_id) VALUES (?, ?, ?)',
      [name, percentage, req.eventId]
    );
    res.json({ id: result.insertId, name, percentage });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/discounts/:id', auth(['admin']), requireEvent, async (req, res) => {
  try {
    const [result] = await db.query(
      'DELETE FROM discounts WHERE id = ? AND event_id = ?',
      [req.params.id, req.eventId]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Descuento no encontrado en el evento activo' });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
