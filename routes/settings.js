const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/authMiddleware');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Obtener settings (any authenticated user can read)
router.get('/', auth(['admin']), async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM settings WHERE id = 1 LIMIT 1');
    res.json(rows[0] || { id:1, cuit:'', logo_path: null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Actualizar cuit
router.put('/', auth(['admin']), async (req, res) => {
  try {
    const { cuit, company_name } = req.body;
    await db.query('UPDATE settings SET cuit = ?, company_name = ? WHERE id = 1', [cuit, company_name]);
    const [rows] = await db.query('SELECT * FROM settings WHERE id = 1');
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
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
router.get('/discounts', auth(['admin', 'seller']), async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM discounts ORDER BY percentage ASC');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/discounts', auth(['admin']), async (req, res) => {
  try {
    const { name, percentage } = req.body;
    if (!name || percentage === undefined) return res.status(400).json({ error: 'Nombre y porcentaje requeridos' });
    const [result] = await db.query('INSERT INTO discounts (name, percentage) VALUES (?, ?)', [name, percentage]);
    res.json({ id: result.insertId, name, percentage });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/discounts/:id', auth(['admin']), async (req, res) => {
  try {
    await db.query('DELETE FROM discounts WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
