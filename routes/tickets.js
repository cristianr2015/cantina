const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/authMiddleware');
const ticketRoles = ['admin', 'seller', 'puerta'];

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
  try {
    const { first_name, last_name, dni, payment_method, ticket_type, user_id, entered } = req.body;
    if (!first_name || !last_name || !dni) return res.status(400).json({ error: 'Faltan datos requeridos' });

    // Solo el administrador puede asignar la venta a otra persona. Los demas
    // roles siempre quedan asociados al usuario autenticado.
    const requestedUserId = user_id ? Number.parseInt(user_id, 10) : null;
    const userIdInt = req.user.role === 'admin'
      ? (Number.isInteger(requestedUserId) ? requestedUserId : req.user.id)
      : req.user.id;
    const enteredValue = entered ? 1 : 0;
    const enteredAt = enteredValue ? new Date() : null;

    const [result] = await db.query(
      'INSERT INTO tickets_sold (first_name, last_name, dni, payment_method, ticket_type, user_id, entered, entered_at, sold_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())',
      [first_name, last_name, dni, payment_method || 'cash', ticket_type || 'anticipada', userIdInt, enteredValue, enteredAt]
    );

    const [rows] = await db.query('SELECT t.*, u.username as sold_by FROM tickets_sold t LEFT JOIN users u ON t.user_id = u.id WHERE t.id = ?', [result.insertId]);
    res.json({ ok: true, ...rows[0] });
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
        [first_name, last_name, dni, userIdInt, id]
      );
    } else {
      [update] = await db.query(
        'UPDATE tickets_sold SET first_name = ?, last_name = ?, dni = ? WHERE id = ?',
        [first_name, last_name, dni, id]
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
    const { entered } = req.body;
    const enteredValue = entered ? 1 : 0;
    const enteredAt = entered ? new Date() : null;

    const [update] = await db.query(
      'UPDATE tickets_sold SET entered = ?, entered_at = ? WHERE id = ?',
      [enteredValue, enteredAt, id]
    );

    if (update.affectedRows === 0) return res.status(404).json({ error: 'Entrada no encontrada' });

    const [rows] = await db.query('SELECT * FROM tickets_sold WHERE id = ?', [id]);
    res.json({ ok: true, ...rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', auth(ticketRoles), async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await db.query('DELETE FROM tickets_sold WHERE id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Entrada no encontrada' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
