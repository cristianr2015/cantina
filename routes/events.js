const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/authMiddleware');

router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM events ORDER BY date DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', auth(['admin']), async (req, res) => {
  try {
    const { name, date } = req.body;
    const [result] = await db.query('INSERT INTO events (name, date) VALUES (?, ?)', [name, date]);
    const [rows] = await db.query('SELECT * FROM events WHERE id = ?', [result.insertId]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', auth(['admin']), async (req, res) => {
  try {
    const id = req.params.id;
    const { name, date } = req.body;
    await db.query('UPDATE events SET name = ?, date = ? WHERE id = ?', [name, date, id]);
    const [rows] = await db.query('SELECT * FROM events WHERE id = ?', [id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', auth(['admin']), async (req, res) => {
  try {
    const id = req.params.id;
    await db.query('DELETE FROM events WHERE id = ?', [id]);
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
