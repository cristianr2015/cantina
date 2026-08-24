const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { jwtSecret } = require('../config');
const {
  normalizeCompanyCode,
  isCompanyCodeValid,
  normalizeCompanyLicense,
  assignCompanyLicense
} = require('../lib/companyService');
const {
  authenticateSuperadmin,
  isSuperadminSessionValid,
  changeSuperadminPassword
} = require('../lib/superadminService');

const router = express.Router();

async function superadminAuth(req, res, next) {
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) return res.status(401).json({ error: 'No autorizado' });
  try {
    const payload = jwt.verify(authorization.slice(7), jwtSecret);
    if (payload.type !== 'superadmin') return res.status(403).json({ error: 'Acceso exclusivo para superadministración' });
    if (!await isSuperadminSessionValid(db, payload.username, payload.credentialVersion)) {
      return res.status(401).json({ error: 'La sesión de superadministración ya no es válida' });
    }
    req.superadmin = payload;
    next();
  } catch (_error) {
    res.status(401).json({ error: 'La sesión de superadministración no es válida' });
  }
}

function serializeCompany(row) {
  const expiresAt = row.expires_at || null;
  const expired = Boolean(expiresAt && new Date(expiresAt).getTime() <= Date.now());
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    active: Boolean(row.active),
    created_at: row.created_at,
    users_count: Number(row.users_count || 0),
    events_count: Number(row.events_count || 0),
    license: row.license_type ? {
      licenseId: row.license_id,
      type: row.license_type,
      duration: row.license_duration,
      activatedAt: row.activated_at,
      expiresAt,
      active: !expired,
      state: expired ? 'expired' : 'active'
    } : { type: null, active: false, state: 'missing' }
  };
}

async function loadCompanies(executor = db, companyId = null) {
  const where = companyId ? 'WHERE c.id = ?' : '';
  const params = companyId ? [companyId] : [];
  const [rows] = await executor.query(`
    SELECT c.id, c.name, c.code, c.active, c.created_at,
           (SELECT COUNT(*) FROM users u WHERE u.company_id = c.id) AS users_count,
           (SELECT COUNT(*) FROM events e WHERE e.company_id = c.id) AS events_count,
           cl.license_id, cl.license_type, cl.license_duration, cl.activated_at, cl.expires_at
    FROM companies c
    LEFT JOIN company_licenses cl ON cl.activation_id = (
      SELECT MAX(latest.activation_id) FROM company_licenses latest WHERE latest.company_id = c.id
    )
    ${where}
    ORDER BY c.name, c.id
  `, params);
  return rows.map(serializeCompany);
}

router.post('/login', async (req, res) => {
  try {
    const account = await authenticateSuperadmin(
      db,
      String(req.body?.username || '').trim(),
      String(req.body?.password || '')
    );
    if (!account) return res.status(401).json({ error: 'Credenciales inválidas' });
    const token = jwt.sign({
      type: 'superadmin',
      username: account.username,
      credentialVersion: account.credentialVersion
    }, jwtSecret, { expiresIn: '4h' });
    res.json({ token, user: { username: account.username } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/session', superadminAuth, (req, res) => {
  res.json({ user: { username: req.superadmin.username } });
});

router.put('/password', superadminAuth, async (req, res) => {
  try {
    const currentPassword = String(req.body?.current_password || '');
    const newPassword = String(req.body?.new_password || '');
    const confirmation = String(req.body?.confirm_password || '');
    if (newPassword !== confirmation) {
      return res.status(400).json({ error: 'La confirmación no coincide con la nueva contraseña' });
    }
    await changeSuperadminPassword(db, req.superadmin.username, currentPassword, newPassword);
    res.json({ ok: true });
  } catch (error) {
    const validationCodes = ['PASSWORD_TOO_SHORT', 'INVALID_CURRENT_PASSWORD', 'PASSWORD_REUSED'];
    res.status(validationCodes.includes(error.code) ? 400 : 500).json({ error: error.message });
  }
});

router.get('/companies', superadminAuth, async (_req, res) => {
  try {
    res.json(await loadCompanies());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/companies', superadminAuth, async (req, res) => {
  let connection;
  try {
    const name = String(req.body?.name || '').trim();
    const code = normalizeCompanyCode(req.body?.code || name);
    const adminFirstName = String(req.body?.admin_first_name || '').trim();
    const adminLastName = String(req.body?.admin_last_name || '').trim();
    const adminUsername = String(req.body?.admin_username || '').trim();
    const adminPassword = String(req.body?.admin_password || '');
    if (!name || !isCompanyCodeValid(code)) {
      return res.status(400).json({ error: 'Ingrese un nombre y un código de empresa de al menos 3 caracteres' });
    }
    if (!adminFirstName || !adminLastName || !adminUsername || !adminPassword) {
      return res.status(400).json({ error: 'Complete los datos del administrador inicial' });
    }
    try {
      normalizeCompanyLicense(req.body);
    } catch (validationError) {
      return res.status(400).json({ error: validationError.message });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();
    const [companyResult] = await connection.query(
      'INSERT INTO companies (name, code, active) VALUES (?, ?, 1)',
      [name, code]
    );
    const companyId = companyResult.insertId;
    await connection.query(
      `INSERT INTO settings
         (id, company_id, cuit, company_name, logo_path, address, phone, email,
          region_code, currency_code, currency_symbol, tax_identifiers,
          ticket_price_advance, ticket_price_door)
       VALUES (?, ?, '', ?, NULL, '', '', '', 'AR', 'ARS', '$', '{}', 10000, 12000)`,
      [companyId, companyId, name]
    );
    const eventDate = new Date();
    eventDate.setDate(eventDate.getDate() + 7);
    eventDate.setHours(20, 0, 0, 0);
    await connection.query(
      `INSERT INTO events (name, date, ticket_price_advance, ticket_price_door, company_id)
       VALUES ('Primer evento', ?, 10000, 12000, ?)`,
      [eventDate, companyId]
    );
    const [userResult] = await connection.query(
      `INSERT INTO users (first_name, last_name, username, password, role, company_id)
       VALUES (?, ?, ?, ?, 'admin', ?)`,
      [adminFirstName, adminLastName, adminUsername, adminPassword, companyId]
    );
    await connection.query('INSERT INTO user_roles (user_id, role) VALUES (?, \'admin\')', [userResult.insertId]);
    await assignCompanyLicense(connection, companyId, req.body, req.superadmin.username);
    await connection.commit();
    const companies = await loadCompanies(db, companyId);
    res.status(201).json(companies[0]);
  } catch (error) {
    if (connection) await connection.rollback();
    if (error?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'El código de empresa o el usuario administrador ya existe en esa empresa' });
    }
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

router.put('/companies/:id', superadminAuth, async (req, res) => {
  try {
    const companyId = Number(req.params.id);
    const name = String(req.body?.name || '').trim();
    const code = normalizeCompanyCode(req.body?.code);
    const active = req.body?.active === true || req.body?.active === 1;
    if (!Number.isInteger(companyId) || !name || !isCompanyCodeValid(code)) {
      return res.status(400).json({ error: 'Datos de empresa inválidos' });
    }
    const [result] = await db.query(
      'UPDATE companies SET name = ?, code = ?, active = ? WHERE id = ?',
      [name, code, active ? 1 : 0, companyId]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Empresa no encontrada' });
    await db.query('UPDATE settings SET company_name = ? WHERE company_id = ?', [name, companyId]);
    const companies = await loadCompanies(db, companyId);
    res.json(companies[0]);
  } catch (error) {
    if (error?.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'El código de empresa ya está en uso' });
    res.status(500).json({ error: error.message });
  }
});

router.post('/companies/:id/license', superadminAuth, async (req, res) => {
  try {
    const companyId = Number(req.params.id);
    const [companies] = await db.query('SELECT id FROM companies WHERE id = ? LIMIT 1', [companyId]);
    if (!companies[0]) return res.status(404).json({ error: 'Empresa no encontrada' });
    await assignCompanyLicense(db, companyId, req.body, req.superadmin.username);
    const updated = await loadCompanies(db, companyId);
    res.status(201).json(updated[0]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
module.exports.__test = { serializeCompany, superadminAuth };
