const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/authMiddleware');
const { requireEvent } = require('../middleware/eventContext');

// Listar aportes
router.get('/contributions', auth(['admin']), requireEvent, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT c.*, u.username as socio_name 
      FROM partner_contributions c 
      LEFT JOIN users u ON c.user_id = u.id 
      WHERE c.event_id = ?
      ORDER BY c.created_at DESC
    `, [req.eventId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Registrar aporte
router.post('/contributions', auth(['admin']), requireEvent, async (req, res) => {
  try {
    const { user_id, amount, description } = req.body;
    if (!user_id || !amount) return res.status(400).json({ error: 'Socio y monto requeridos' });

    const [result] = await db.query(
      'INSERT INTO partner_contributions (user_id, amount, description, event_id) VALUES (?, ?, ?, ?)',
      [user_id, amount, description, req.eventId]
    );
    res.json({ ok: true, id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Editar aporte (Monto y descripción)
router.put('/contributions/:id', auth(['admin']), requireEvent, async (req, res) => {
  try {
    const { user_id, amount, description } = req.body;
    if (!user_id || !amount) return res.status(400).json({ error: 'Socio y monto requeridos' });

    const [result] = await db.query(
      'UPDATE partner_contributions SET user_id = ?, amount = ?, description = ? WHERE id = ? AND event_id = ?',
      [user_id, amount, description, req.params.id, req.eventId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Aporte no encontrado' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Marcar como devuelto
router.patch('/contributions/:id/return', auth(['admin']), requireEvent, async (req, res) => {
  try {
    const { returned } = req.body;
    const [result] = await db.query(
      'UPDATE partner_contributions SET returned = ? WHERE id = ? AND event_id = ?',
      [returned ? 1 : 0, req.params.id, req.eventId]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Aporte no encontrado en el evento activo' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Eliminar registro
router.delete('/contributions/:id', auth(['admin']), requireEvent, async (req, res) => {
  try {
    const [result] = await db.query(
      'DELETE FROM partner_contributions WHERE id = ? AND event_id = ?',
      [req.params.id, req.eventId]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Aporte no encontrado en el evento activo' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
