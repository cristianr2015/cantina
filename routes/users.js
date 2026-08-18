const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/authMiddleware');

// Listar usuarios (solo admin)
router.get('/', auth(['admin']), async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, username, role, created_at FROM users ORDER BY username');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Crear usuario (admin)
router.post('/', auth(['admin']), async (req, res) => {
  try {
    const { username, password, role } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'username y password requeridos' });
    const [result] = await db.query('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [username, password, role || 'seller']);
    const [rows] = await db.query('SELECT id, username, role, created_at FROM users WHERE id = ?', [result.insertId]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Actualizar usuario (admin)
router.put('/:id', auth(['admin']), async (req, res) => {
  try {
    const id = req.params.id;
    const { username, password, role } = req.body;
    await db.query('UPDATE users SET username = ?, password = ?, role = ? WHERE id = ?', [username, password, role, id]);
    const [rows] = await db.query('SELECT id, username, role, created_at FROM users WHERE id = ?', [id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Eliminar usuario (admin)
router.delete('/:id', auth(['admin']), async (req, res) => {
  try {
    const id = req.params.id;
    await db.query('DELETE FROM users WHERE id = ?', [id]);
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
