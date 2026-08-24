const express = require('express');
const router = express.Router();
const db = require('../db');
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config');

// Login: recibe { username, password }
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const [rows] = await db.query(`
      SELECT u.id, u.first_name, u.last_name, u.username, u.role,
             GROUP_CONCAT(ur.role ORDER BY FIELD(ur.role, 'admin', 'seller', 'puerta')) AS roles_csv
      FROM users u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      WHERE u.username = ? AND u.password = ?
      GROUP BY u.id, u.first_name, u.last_name, u.username, u.role
    `, [username, password]);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });
    const roles = user.roles_csv ? user.roles_csv.split(',') : [user.role];
    const primaryRole = roles[0] || user.role;
    const token = jwt.sign({ id: user.id, username: user.username, role: primaryRole, roles }, jwtSecret, { expiresIn: '8h' });
    res.json({
      token,
      user: {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        username: user.username,
        role: primaryRole,
        roles
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
