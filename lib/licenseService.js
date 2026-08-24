const crypto = require('crypto');

const LICENSE_PREFIX = 'PENA1';
const LICENSE_TYPES = new Set(['free', 'full']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getLicenseConfig(env = process.env) {
  return {
    signingSecret: String(env.LICENSE_SIGNING_SECRET || '').trim(),
    installationId: String(env.LICENSE_INSTALLATION_ID || '').trim().toLowerCase()
  };
}

function isLicenseConfigValid(config) {
  return config.signingSecret.length >= 32 && UUID_PATTERN.test(config.installationId);
}

function encodePayload(payload) {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function signEncodedPayload(encodedPayload, signingSecret) {
  return crypto
    .createHmac('sha256', signingSecret)
    .update(`${LICENSE_PREFIX}.${encodedPayload}`)
    .digest('base64url');
}

function createLicenseKey({ type, installationId, signingSecret, licenseId = crypto.randomUUID() }) {
  const normalizedType = String(type || '').trim().toLowerCase();
  const normalizedInstallationId = String(installationId || '').trim().toLowerCase();
  const normalizedLicenseId = String(licenseId || '').trim().toLowerCase();
  if (!LICENSE_TYPES.has(normalizedType)) throw new Error('El tipo de licencia debe ser free o full');
  if (!UUID_PATTERN.test(normalizedInstallationId)) throw new Error('El identificador de instalación no es válido');
  if (!UUID_PATTERN.test(normalizedLicenseId)) throw new Error('El identificador de licencia no es válido');
  if (String(signingSecret || '').trim().length < 32) throw new Error('LICENSE_SIGNING_SECRET debe tener al menos 32 caracteres');

  const payload = {
    version: 1,
    licenseId: normalizedLicenseId,
    type: normalizedType,
    installationId: normalizedInstallationId
  };
  const encodedPayload = encodePayload(payload);
  const signature = signEncodedPayload(encodedPayload, String(signingSecret).trim());
  return `${LICENSE_PREFIX}.${encodedPayload}.${signature}`;
}

function verifyLicenseKey(key, config = getLicenseConfig()) {
  if (!isLicenseConfigValid(config)) {
    return { valid: false, reason: 'misconfigured' };
  }
  const parts = String(key || '').trim().split('.');
  if (parts.length !== 3 || parts[0] !== LICENSE_PREFIX) {
    return { valid: false, reason: 'invalid' };
  }

  const expectedSignature = signEncodedPayload(parts[1], config.signingSecret);
  const receivedBuffer = Buffer.from(parts[2]);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (receivedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(receivedBuffer, expectedBuffer)) {
    return { valid: false, reason: 'invalid' };
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch (_error) {
    return { valid: false, reason: 'invalid' };
  }

  if (
    payload?.version !== 1 ||
    !UUID_PATTERN.test(String(payload.licenseId || '')) ||
    !LICENSE_TYPES.has(payload.type) ||
    !UUID_PATTERN.test(String(payload.installationId || ''))
  ) {
    return { valid: false, reason: 'invalid' };
  }
  if (payload.installationId.toLowerCase() !== config.installationId) {
    return { valid: false, reason: 'wrong_installation' };
  }
  return { valid: true, payload };
}

function serializeLicenseRow(row, installationId) {
  if (!row) {
    return { configured: true, active: false, state: 'missing', type: null, installationId };
  }
  const expiresAt = new Date(row.expires_at);
  const active = row.is_active === undefined
    ? Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() > Date.now()
    : Boolean(row.is_active);
  return {
    configured: true,
    active,
    state: active ? 'active' : 'expired',
    type: row.license_type,
    activatedAt: row.activated_at,
    expiresAt: row.expires_at,
    installationId
  };
}

async function getLicenseStatus(db, env = process.env) {
  const config = getLicenseConfig(env);
  if (!isLicenseConfigValid(config)) {
    return {
      configured: false,
      active: false,
      state: 'misconfigured',
      type: null,
      installationId: UUID_PATTERN.test(config.installationId) ? config.installationId : null
    };
  }
  const [rows] = await db.query(
    `SELECT license_type, activated_at, expires_at,
            (expires_at > UTC_TIMESTAMP()) AS is_active
     FROM license_activations
     WHERE installation_id = ?
     ORDER BY activation_id DESC
     LIMIT 1`,
    [config.installationId]
  );
  return serializeLicenseRow(rows[0], config.installationId);
}

async function activateLicense(db, key, env = process.env) {
  const config = getLicenseConfig(env);
  const verification = verifyLicenseKey(key, config);
  if (!verification.valid) {
    const error = new Error(verification.reason);
    error.code = verification.reason;
    throw error;
  }

  let connection;
  try {
    connection = typeof db.getConnection === 'function' ? await db.getConnection() : db;
    const [result] = await connection.query(
      `INSERT INTO license_activations
        (license_id, installation_id, license_type, activated_at, expires_at)
       VALUES (?, ?, ?, UTC_TIMESTAMP(), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 1 YEAR))`,
      [verification.payload.licenseId, config.installationId, verification.payload.type]
    );
    const [rows] = await connection.query(
      `SELECT license_type, activated_at, expires_at,
              (expires_at > UTC_TIMESTAMP()) AS is_active
       FROM license_activations WHERE activation_id = ? LIMIT 1`,
      [result.insertId]
    );
    return serializeLicenseRow(rows[0], config.installationId);
  } catch (error) {
    if (error?.code === 'ER_DUP_ENTRY') {
      const usedError = new Error('used');
      usedError.code = 'used';
      throw usedError;
    }
    throw error;
  } finally {
    if (connection && connection !== db && typeof connection.release === 'function') connection.release();
  }
}

async function migrateLicenseStorage(db) {
  await db.query(`CREATE TABLE IF NOT EXISTS license_activations (
    activation_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    license_id CHAR(36) NOT NULL UNIQUE,
    installation_id CHAR(36) NOT NULL,
    license_type ENUM('free','full') NOT NULL,
    activated_at DATETIME NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_license_installation (installation_id, activation_id),
    INDEX idx_license_expiry (expires_at)
  )`);
}

module.exports = {
  LICENSE_TYPES,
  createLicenseKey,
  verifyLicenseKey,
  getLicenseConfig,
  getLicenseStatus,
  activateLicense,
  migrateLicenseStorage
};
