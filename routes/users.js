const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/authMiddleware');
const { requireLicenseFeature, licenseAllowsUserRoles } = require('../middleware/licenseAccess');

const rolePriority = ['admin', 'seller', 'puerta'];
const allowedRoles = new Set(rolePriority);
const loadConfigurationLicense = requireLicenseFeature('configuration');

function freeRoleError(res, license) {
  return res.status(403).json({
    error: 'La licencia Free solamente permite asignar el rol Administrador a usuarios nuevos',
    code: 'LICENSE_USER_ROLE_NOT_AVAILABLE',
    license
  });
}

function normalizeRequiredText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeRoles(roles, legacyRole) {
  const requestedRoles = Array.isArray(roles) ? roles : (legacyRole ? [legacyRole] : []);
  const uniqueRoles = new Set(requestedRoles.filter(role => allowedRoles.has(role)));
  return rolePriority.filter(role => uniqueRoles.has(role));
}

function serializeUser(row) {
  const roles = row.roles_csv ? row.roles_csv.split(',') : (row.role ? [row.role] : []);
  const { roles_csv: _rolesCsv, ...user } = row;
  return { ...user, role: roles[0] || row.role, roles };
}

async function loadUsers(executor = db, userId = null) {
  const where = userId === null ? '' : 'WHERE u.id = ?';
  const params = userId === null ? [] : [userId];
  const [rows] = await executor.query(`
    SELECT u.id, u.first_name, u.last_name, u.username, u.role, u.created_at,
           GROUP_CONCAT(ur.role ORDER BY FIELD(ur.role, 'admin', 'seller', 'puerta')) AS roles_csv
    FROM users u
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    ${where}
    GROUP BY u.id, u.first_name, u.last_name, u.username, u.role, u.created_at
    ORDER BY u.first_name, u.last_name, u.username
  `, params);
  return rows.map(serializeUser);
}

async function replaceUserRoles(connection, userId, roles) {
  await connection.query('DELETE FROM user_roles WHERE user_id = ?', [userId]);
  for (const role of roles) {
    await connection.query('INSERT INTO user_roles (user_id, role) VALUES (?, ?)', [userId, role]);
  }
}

router.get('/', auth(['admin']), async (_req, res) => {
  try {
    res.json(await loadUsers());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', auth(['admin']), loadConfigurationLicense, async (req, res) => {
  let connection;
  try {
    const firstName = normalizeRequiredText(req.body.first_name);
    const lastName = normalizeRequiredText(req.body.last_name);
    const username = normalizeRequiredText(req.body.username);
    const password = req.body.password;
    const roles = normalizeRoles(req.body.roles, req.body.role);
    if (!firstName || !lastName || !username || !password) {
      return res.status(400).json({ error: 'Nombre, apellido, usuario y contraseña son requeridos' });
    }
    if (!roles.length) return res.status(400).json({ error: 'Seleccione al menos un rol' });
    if (!licenseAllowsUserRoles(req.license, roles)) return freeRoleError(res, req.license);

    connection = await db.getConnection();
    await connection.beginTransaction();
    const [result] = await connection.query(
      'INSERT INTO users (first_name, last_name, username, password, role) VALUES (?, ?, ?, ?, ?)',
      [firstName, lastName, username, password, roles[0]]
    );
    await replaceUserRoles(connection, result.insertId, roles);
    await connection.commit();
    const users = await loadUsers(db, result.insertId);
    res.status(201).json(users[0]);
  } catch (err) {
    if (connection) await connection.rollback();
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'El usuario para iniciar sesión ya existe' });
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) connection.release();
  }
});

router.put('/:id', auth(['admin']), loadConfigurationLicense, async (req, res) => {
  let connection;
  try {
    const id = Number.parseInt(req.params.id, 10);
    const firstName = normalizeRequiredText(req.body.first_name);
    const lastName = normalizeRequiredText(req.body.last_name);
    const username = normalizeRequiredText(req.body.username);
    const password = req.body.password;
    const roles = normalizeRoles(req.body.roles, req.body.role);
    if (!Number.isInteger(id) || !firstName || !lastName || !username) {
      return res.status(400).json({ error: 'Nombre, apellido o usuario inválido' });
    }
    if (!roles.length) return res.status(400).json({ error: 'Seleccione al menos un rol' });

    connection = await db.getConnection();
    await connection.beginTransaction();
    const existingUsers = await loadUsers(connection, id);
    if (!existingUsers[0]) {
      await connection.rollback();
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    if (!licenseAllowsUserRoles(req.license, roles, existingUsers[0].roles)) {
      await connection.rollback();
      return freeRoleError(res, req.license);
    }
    const params = [firstName, lastName, username];
    let sql = 'UPDATE users SET first_name = ?, last_name = ?, username = ?';
    if (password) {
      sql += ', password = ?';
      params.push(password);
    }
    sql += ', role = ? WHERE id = ?';
    params.push(roles[0], id);
    const [result] = await connection.query(sql, params);
    if (!result.affectedRows) {
      await connection.rollback();
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    await replaceUserRoles(connection, id, roles);
    await connection.commit();
    const users = await loadUsers(db, id);
    res.json(users[0]);
  } catch (err) {
    if (connection) await connection.rollback();
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'El usuario para iniciar sesión ya existe' });
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) connection.release();
  }
});

router.delete('/:id', auth(['admin']), async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM users WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
