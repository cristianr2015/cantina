const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/authMiddleware');
const { requireEvent } = require('../middleware/eventContext');
const { normalizeExpense } = require('../lib/expenseValidation');

router.get('/', auth(['admin']), requireEvent, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT e.*,
             u.username,
             u.first_name,
             u.last_name
      FROM expenses e
      LEFT JOIN users u ON u.id = e.user_id
      WHERE e.event_id = ?
      ORDER BY e.expense_date DESC, e.id DESC
    `, [req.eventId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', auth(['admin']), requireEvent, async (req, res) => {
  try {
    const normalized = normalizeExpense(req.body);
    if (normalized.error) return res.status(400).json({ error: normalized.error });
    const expense = normalized.value;
    const [result] = await db.query(`
      INSERT INTO expenses
        (description, category, supplier, amount, payment_method, status, expense_date, user_id, event_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      expense.description, expense.category, expense.supplier, expense.amount,
      expense.payment_method, expense.status, expense.expense_date, expense.user_id, req.eventId
    ]);
    res.status(201).json({ ok: true, id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', auth(['admin']), requireEvent, async (req, res) => {
  try {
    const normalized = normalizeExpense(req.body);
    if (normalized.error) return res.status(400).json({ error: normalized.error });
    const expense = normalized.value;
    const [result] = await db.query(`
      UPDATE expenses
      SET description = ?, category = ?, supplier = ?, amount = ?, payment_method = ?,
          status = ?, expense_date = ?, user_id = ?
      WHERE id = ? AND event_id = ?
    `, [
      expense.description, expense.category, expense.supplier, expense.amount,
      expense.payment_method, expense.status, expense.expense_date, expense.user_id,
      req.params.id, req.eventId
    ]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Gasto no encontrado en el evento activo' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/pay', auth(['admin']), requireEvent, async (req, res) => {
  try {
    const [result] = await db.query(
      "UPDATE expenses SET status = 'paid' WHERE id = ? AND event_id = ? AND status <> 'paid'",
      [req.params.id, req.eventId]
    );
    if (!result.affectedRows) {
      const [rows] = await db.query('SELECT status FROM expenses WHERE id = ? AND event_id = ? LIMIT 1', [req.params.id, req.eventId]);
      if (!rows.length) return res.status(404).json({ error: 'Gasto no encontrado en el evento activo' });
      return res.json({ ok: true, alreadyPaid: true });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', auth(['admin']), requireEvent, async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM expenses WHERE id = ? AND event_id = ?', [req.params.id, req.eventId]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Gasto no encontrado en el evento activo' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
