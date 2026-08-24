const express = require('express');
const router = express.Router();
const db = require('../db');
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config');
const auth = require('../middleware/authMiddleware');

const approvalActions = new Set(['delete:sale', 'delete:ticket', 'create:courtesy']);

// Login: recibe { username, password }
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const companyCode = String(req.body.company || req.body.company_code || '').trim().toLowerCase();
    const [rows] = await db.query(`
      SELECT u.id, u.first_name, u.last_name, u.username, u.role,
             c.id AS company_id, c.name AS company_name, c.code AS company_code, c.active AS company_active,
             GROUP_CONCAT(ur.role ORDER BY FIELD(ur.role, 'admin', 'seller', 'puerta')) AS roles_csv
      FROM users u
      INNER JOIN companies c ON c.id = u.company_id
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      WHERE u.username = ? AND u.password = ? AND (? = '' OR c.code = ?)
      GROUP BY u.id, u.first_name, u.last_name, u.username, u.role,
               c.id, c.name, c.code, c.active
      LIMIT 2
    `, [username, password, companyCode, companyCode]);
    if (rows.length > 1 && !companyCode) {
      return res.status(400).json({ error: 'Ingrese el código de empresa para iniciar sesión' });
    }
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });
    if (!user.company_active) return res.status(403).json({ error: 'La empresa se encuentra suspendida' });
    const roles = user.roles_csv ? user.roles_csv.split(',') : [user.role];
    const primaryRole = roles[0] || user.role;
    const company = { id: user.company_id, name: user.company_name, code: user.company_code };
    const token = jwt.sign({
      id: user.id, username: user.username, role: primaryRole, roles,
      companyId: company.id, companyCode: company.code, companyName: company.name
    }, jwtSecret, { expiresIn: '8h' });
    res.json({
      token,
      user: {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        username: user.username,
        role: primaryRole,
        roles,
        company
      },
      company
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Valida el token antes de mostrar la interfaz privada en el navegador.
router.get('/session', auth(), async (req, res) => {
  try {
    const [companies] = await db.query('SELECT id, name, code, active FROM companies WHERE id = ? LIMIT 1', [req.user.companyId]);
    const company = companies[0];
    if (!company || !company.active) return res.status(403).json({ error: 'La empresa se encuentra suspendida' });
    const serializedCompany = { id: company.id, name: company.name, code: company.code };
    res.json({
      user: {
        id: req.user.id,
        username: req.user.username,
        role: req.user.role,
        roles: req.user.roles,
        company: serializedCompany
      },
      company: serializedCompany
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/admin-approval', auth(['admin', 'seller', 'puerta']), async (req, res) => {
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');
    const action = String(req.body.action || '');
    if (!username || !password || !approvalActions.has(action)) {
      return res.status(400).json({ error: 'Solicitud de autorización inválida' });
    }
    const [rows] = await db.query(`
      SELECT u.id
      FROM users u
      INNER JOIN user_roles ur ON ur.user_id = u.id AND ur.role = 'admin'
      WHERE u.username = ? AND u.password = ? AND u.company_id = ?
      LIMIT 1
    `, [username, password, req.user.companyId]);
    const admin = rows[0];
    if (!admin) return res.status(403).json({ error: 'Las credenciales administrativas no son válidas' });

    const approvalToken = jwt.sign({
      type: 'admin-approval',
      action,
      adminId: admin.id,
      requesterId: req.user.id
    }, jwtSecret, { expiresIn: '2m' });
    res.json({ approvalToken, expiresIn: 120 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
