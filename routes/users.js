const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/authMiddleware');
const allowedRoles = new Set(['admin', 'seller', 'puerta']);

function isValidRole(role) {
  return allowedRoles.has(role);
}

const userFields = 'id, first_name, last_name, username, role, created_at';

function normalizeRequiredText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

// Listar usuarios (solo admin)
router.get('/', auth(['admin']), async (req, res) => {
  try {
    const [rows] = await db.query(`SELECT ${userFields} FROM users ORDER BY first_name, last_name, username`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Crear usuario (admin)
router.post('/', auth(['admin']), async (req, res) => {
  try {
    const { password, role } = req.body;
    const firstName = normalizeRequiredText(req.body.first_name);
    const lastName = normalizeRequiredText(req.body.last_name);
    const username = normalizeRequiredText(req.body.username);
    if (!firstName || !lastName || !username || !password) {
      return res.status(400).json({ error: 'Nombre, apellido, usuario y contraseña son requeridos' });
    }
    const selectedRole = role || 'seller';
    if (!isValidRole(selectedRole)) return res.status(400).json({ error: 'Rol invalido' });
    const [result] = await db.query(
      'INSERT INTO users (first_name, last_name, username, password, role) VALUES (?, ?, ?, ?, ?)',
      [firstName, lastName, username, password, selectedRole]
    );
    const [rows] = await db.query(`SELECT ${userFields} FROM users WHERE id = ?`, [result.insertId]);
    res.json(rows[0]);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'El usuario para iniciar sesión ya existe' });
    res.status(500).json({ error: err.message });
  }
});

// Actualizar usuario (admin)
router.put('/:id', auth(['admin']), async (req, res) => {
  try {
    const id = req.params.id;
    const { password, role } = req.body;
    const firstName = normalizeRequiredText(req.body.first_name);
    const lastName = normalizeRequiredText(req.body.last_name);
    const username = normalizeRequiredText(req.body.username);
    if (!firstName || !lastName || !username || !isValidRole(role)) {
      return res.status(400).json({ error: 'Nombre, apellido, usuario o rol inválido' });
    }
    if (password) {
      await db.query(
        'UPDATE users SET first_name = ?, last_name = ?, username = ?, password = ?, role = ? WHERE id = ?',
        [firstName, lastName, username, password, role, id]
      );
    } else {
      await db.query(
        'UPDATE users SET first_name = ?, last_name = ?, username = ?, role = ? WHERE id = ?',
        [firstName, lastName, username, role, id]
      );
    }
    const [rows] = await db.query(`SELECT ${userFields} FROM users WHERE id = ?`, [id]);
    res.json(rows[0]);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'El usuario para iniciar sesión ya existe' });
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
