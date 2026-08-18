const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/authMiddleware');

// Listar aportes
router.get('/contributions', auth(['admin', 'seller']), async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT c.*, u.username as socio_name 
      FROM partner_contributions c 
      LEFT JOIN users u ON c.user_id = u.id 
      ORDER BY c.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Registrar aporte
router.post('/contributions', auth(['admin']), async (req, res) => {
  try {
    const { user_id, amount, description } = req.body;
    if (!user_id || !amount) return res.status(400).json({ error: 'Socio y monto requeridos' });

    const [result] = await db.query(
      'INSERT INTO partner_contributions (user_id, amount, description) VALUES (?, ?, ?)',
      [user_id, amount, description]
    );
    res.json({ ok: true, id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Editar aporte (Monto y descripción)
router.put('/contributions/:id', auth(['admin']), async (req, res) => {
  try {
    const { user_id, amount, description } = req.body;
    if (!user_id || !amount) return res.status(400).json({ error: 'Socio y monto requeridos' });

    const [result] = await db.query(
      'UPDATE partner_contributions SET user_id = ?, amount = ?, description = ? WHERE id = ?',
      [user_id, amount, description, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Aporte no encontrado' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Marcar como devuelto
router.patch('/contributions/:id/return', auth(['admin']), async (req, res) => {
  try {
    const { returned } = req.body;
    await db.query('UPDATE partner_contributions SET returned = ? WHERE id = ?', [returned ? 1 : 0, req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Eliminar registro
router.delete('/contributions/:id', auth(['admin']), async (req, res) => {
  try {
    await db.query('DELETE FROM partner_contributions WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;