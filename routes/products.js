const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/authMiddleware');
const fs = require('fs');
const path = require('path');

const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM products ORDER BY id');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', auth(['admin']), async (req, res) => {
  try {
    const { name, price_cost, price_sale, image_name, image_data } = req.body;
    let image_path = null;
    if (image_data) {
      const ext = path.extname(image_name || 'prod.png') || '.png';
      const filename = 'prod_' + Date.now() + '_' + Math.floor(Math.random() * 1000) + ext;
      fs.writeFileSync(path.join(uploadDir, filename), Buffer.from(image_data, 'base64'));
      image_path = '/uploads/' + filename;
    }
    const [result] = await db.query(
      'INSERT INTO products (name, price_cost, price_sale, image_path) VALUES (?, ?, ?, ?)',
      [name, price_cost, price_sale, image_path]
    );
    const [rows] = await db.query('SELECT * FROM products WHERE id = ?', [result.insertId]);
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    if (err.code === 'ER_BAD_FIELD_ERROR') {
      return res.status(500).json({ error: 'Falta la columna image_path en la BD. Ejecuta: ALTER TABLE products ADD COLUMN image_path VARCHAR(255);' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', auth(['admin']), async (req, res) => {
  try {
    const id = req.params.id;
    const { name, price_cost, price_sale, image_name, image_data } = req.body;
    
    let sql = 'UPDATE products SET name = ?, price_cost = ?, price_sale = ?';
    const params = [name, price_cost, price_sale];

    if (image_data) {
      const ext = path.extname(image_name || 'prod.png') || '.png';
      const filename = 'prod_' + Date.now() + '_' + Math.floor(Math.random() * 1000) + ext;
      fs.writeFileSync(path.join(uploadDir, filename), Buffer.from(image_data, 'base64'));
      sql += ', image_path = ?';
      params.push('/uploads/' + filename);
    }
    sql += ' WHERE id = ?';
    params.push(id);

    await db.query(sql, params);
    const [rows] = await db.query('SELECT * FROM products WHERE id = ?', [id]);
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    if (err.code === 'ER_BAD_FIELD_ERROR') {
      return res.status(500).json({ error: 'Falta la columna image_path en la BD. Ejecuta: ALTER TABLE products ADD COLUMN image_path VARCHAR(255);' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', auth(['admin']), async (req, res) => {
  try {
    const id = req.params.id;
    await db.query('DELETE FROM products WHERE id = ?', [id]);
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
