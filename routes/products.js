const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/authMiddleware');
const { requireEvent } = require('../middleware/eventContext');
const { requireLicenseFeature, licenseUsesStock } = require('../middleware/licenseAccess');

const allowProductSales = requireLicenseFeature('product_sales');
const allowProductManagement = requireLicenseFeature('product_management');
const fs = require('fs');
const path = require('path');

const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

router.get('/', auth(['admin', 'seller']), allowProductSales, requireEvent, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM products WHERE event_id = ? ORDER BY id', [req.eventId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', auth(['admin']), allowProductManagement, requireEvent, async (req, res) => {
  try {
    const { name, price_cost, price_sale, stock, image_name, image_data } = req.body;
    let image_path = null;
    if (image_data) {
      const ext = path.extname(image_name || 'prod.png') || '.png';
      const filename = 'prod_' + Date.now() + '_' + Math.floor(Math.random() * 1000) + ext;
      fs.writeFileSync(path.join(uploadDir, filename), Buffer.from(image_data, 'base64'));
      image_path = '/uploads/' + filename;
    }
    const [result] = await db.query(
      'INSERT INTO products (name, price_cost, price_sale, stock, image_path, event_id) VALUES (?, ?, ?, ?, ?, ?)',
      [name, price_cost, price_sale, licenseUsesStock(req.license) ? Number.parseInt(stock, 10) || 0 : 0, image_path, req.eventId]
    );
    const [rows] = await db.query('SELECT * FROM products WHERE id = ? AND event_id = ?', [result.insertId, req.eventId]);
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    if (err.code === 'ER_BAD_FIELD_ERROR') {
      return res.status(500).json({ error: 'Falta la columna image_path en la BD. Ejecuta: ALTER TABLE products ADD COLUMN image_path VARCHAR(255);' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', auth(['admin']), allowProductManagement, requireEvent, async (req, res) => {
  try {
    const id = req.params.id;
    const { name, price_cost, price_sale, stock, image_name, image_data } = req.body;
    
    let sql = 'UPDATE products SET name = ?, price_cost = ?, price_sale = ?';
    const params = [name, price_cost, price_sale];

    if (licenseUsesStock(req.license)) {
      sql += ', stock = ?';
      params.push(Number.parseInt(stock, 10) || 0);
    }

    if (image_data) {
      const ext = path.extname(image_name || 'prod.png') || '.png';
      const filename = 'prod_' + Date.now() + '_' + Math.floor(Math.random() * 1000) + ext;
      fs.writeFileSync(path.join(uploadDir, filename), Buffer.from(image_data, 'base64'));
      sql += ', image_path = ?';
      params.push('/uploads/' + filename);
    }
    sql += ' WHERE id = ? AND event_id = ?';
    params.push(id, req.eventId);

    const [result] = await db.query(sql, params);
    if (!result.affectedRows) return res.status(404).json({ error: 'Producto no encontrado en el evento activo' });
    const [rows] = await db.query('SELECT * FROM products WHERE id = ? AND event_id = ?', [id, req.eventId]);
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    if (err.code === 'ER_BAD_FIELD_ERROR') {
      return res.status(500).json({ error: 'Falta la columna image_path en la BD. Ejecuta: ALTER TABLE products ADD COLUMN image_path VARCHAR(255);' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', auth(['admin']), allowProductManagement, requireEvent, async (req, res) => {
  try {
    const id = req.params.id;
    const [result] = await db.query('DELETE FROM products WHERE id = ? AND event_id = ?', [id, req.eventId]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Producto no encontrado en el evento activo' });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
