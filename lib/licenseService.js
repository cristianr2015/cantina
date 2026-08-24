const crypto = require('crypto');
const { getCompanyLicenseStatus } = require('./companyService');

const LICENSE_PREFIX = 'PENA1';
const LICENSE_TYPES = new Set(['free', 'full']);
const LICENSE_DURATIONS = new Set(['1y', '3y', 'forever']);
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

function isInstallationIdValid(installationId) {
  return UUID_PATTERN.test(String(installationId || ''));
}

function defaultFreeLicenseId(installationId) {
  const chars = crypto.createHash('sha256').update(`default-free:${installationId}`).digest('hex').slice(0, 32).split('');
  chars[12] = '4';
  chars[16] = '8';
  const hex = chars.join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
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

function normalizeLicenseType(type) {
  const normalized = String(type || '').trim().toLowerCase();
  return normalized === 'pro' ? 'full' : normalized;
}

function normalizeLicenseDuration(type, duration) {
  if (type === 'free') return 'forever';
  const normalized = String(duration || '1y').trim().toLowerCase();
  if (!LICENSE_DURATIONS.has(normalized)) throw new Error('La duración debe ser 1y, 3y o forever');
  return normalized;
}

function createLicenseKey({ type, duration, installationId, signingSecret, licenseId = crypto.randomUUID() }) {
  const normalizedType = normalizeLicenseType(type);
  const normalizedDuration = normalizeLicenseDuration(normalizedType, duration);
  const normalizedInstallationId = String(installationId || '').trim().toLowerCase();
  const normalizedLicenseId = String(licenseId || '').trim().toLowerCase();
  if (!LICENSE_TYPES.has(normalizedType)) throw new Error('El tipo de licencia debe ser free o pro');
  if (!UUID_PATTERN.test(normalizedInstallationId)) throw new Error('El identificador de instalación no es válido');
  if (!UUID_PATTERN.test(normalizedLicenseId)) throw new Error('El identificador de licencia no es válido');
  if (String(signingSecret || '').trim().length < 32) throw new Error('LICENSE_SIGNING_SECRET debe tener al menos 32 caracteres');

  const payload = {
    version: 1,
    licenseId: normalizedLicenseId,
    type: normalizedType,
    installationId: normalizedInstallationId,
    duration: normalizedDuration
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

  const normalizedPayloadType = normalizeLicenseType(payload?.type);
  let normalizedDuration;
  try {
    normalizedDuration = normalizeLicenseDuration(normalizedPayloadType, payload?.duration);
  } catch (_error) {
    return { valid: false, reason: 'invalid' };
  }
  if (
    payload?.version !== 1 ||
    !UUID_PATTERN.test(String(payload.licenseId || '')) ||
    !LICENSE_TYPES.has(normalizedPayloadType) ||
    !UUID_PATTERN.test(String(payload.installationId || ''))
  ) {
    return { valid: false, reason: 'invalid' };
  }
  if (payload.installationId.toLowerCase() !== config.installationId) {
    return { valid: false, reason: 'wrong_installation' };
  }
  return {
    valid: true,
    payload: { ...payload, type: normalizedPayloadType, duration: normalizedDuration }
  };
}

function serializeLicenseRow(row, installationId) {
  if (!row) {
    return { configured: true, active: false, state: 'missing', type: null, installationId };
  }
  const hasExpiry = row.expires_at !== null && row.expires_at !== undefined;
  const expiresAt = hasExpiry ? new Date(row.expires_at) : null;
  const active = row.is_active === undefined
    ? !hasExpiry || (Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() > Date.now())
    : Boolean(row.is_active);
  return {
    configured: true,
    active,
    state: active ? 'active' : 'expired',
    type: row.license_type,
    duration: row.license_duration || (hasExpiry ? '1y' : 'forever'),
    activatedAt: row.activated_at,
    expiresAt: hasExpiry ? row.expires_at : null,
    installationId
  };
}

async function getLicenseStatus(db, companyIdOrEnv = process.env) {
  if (Number.isInteger(Number(companyIdOrEnv)) && Number(companyIdOrEnv) > 0) {
    return getCompanyLicenseStatus(db, Number(companyIdOrEnv));
  }
  const env = companyIdOrEnv || process.env;
  const config = getLicenseConfig(env);
  if (!isInstallationIdValid(config.installationId)) {
    return {
      configured: false,
      active: false,
      state: 'misconfigured',
      type: null,
      installationId: null
    };
  }
  const [rows] = await db.query(
    `SELECT license_type, license_duration, activated_at, expires_at,
            (expires_at IS NULL OR expires_at > UTC_TIMESTAMP()) AS is_active
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
    const duration = verification.payload.duration;
    const expiryExpression = duration === 'forever'
      ? 'NULL'
      : duration === '3y'
        ? 'DATE_ADD(UTC_TIMESTAMP(), INTERVAL 3 YEAR)'
        : 'DATE_ADD(UTC_TIMESTAMP(), INTERVAL 1 YEAR)';
    const [result] = await connection.query(
      `INSERT INTO license_activations
        (license_id, installation_id, license_type, license_duration, activated_at, expires_at)
       VALUES (?, ?, ?, ?, UTC_TIMESTAMP(), ${expiryExpression})`,
      [verification.payload.licenseId, config.installationId, verification.payload.type, duration]
    );
    const [rows] = await connection.query(
      `SELECT license_type, license_duration, activated_at, expires_at,
              (expires_at IS NULL OR expires_at > UTC_TIMESTAMP()) AS is_active
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

async function migrateLicenseStorage(db, env = process.env) {
  await db.query(`CREATE TABLE IF NOT EXISTS app_installation (
    id TINYINT UNSIGNED PRIMARY KEY,
    installation_id CHAR(36) NOT NULL UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);

  let installationId = getLicenseConfig(env).installationId;
  if (!isInstallationIdValid(installationId)) {
    const [installationRows] = await db.query('SELECT installation_id FROM app_installation WHERE id = 1 LIMIT 1');
    if (installationRows[0]) {
      installationId = installationRows[0].installation_id;
    } else {
      installationId = crypto.randomUUID();
      await db.query(
        'INSERT IGNORE INTO app_installation (id, installation_id) VALUES (1, ?)',
        [installationId]
      );
      const [savedRows] = await db.query('SELECT installation_id FROM app_installation WHERE id = 1 LIMIT 1');
      installationId = savedRows[0].installation_id;
    }
    if (env === process.env) process.env.LICENSE_INSTALLATION_ID = installationId;
  }

  await db.query(`CREATE TABLE IF NOT EXISTS license_activations (
    activation_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    license_id CHAR(36) NOT NULL UNIQUE,
    installation_id CHAR(36) NOT NULL,
    license_type ENUM('free','full') NOT NULL,
    license_duration ENUM('1y','3y','forever') NOT NULL DEFAULT '1y',
    activated_at DATETIME NOT NULL,
    expires_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_license_installation (installation_id, activation_id),
    INDEX idx_license_expiry (expires_at)
  )`);

  const [licenseColumns] = await db.query(`
    SELECT COLUMN_NAME, IS_NULLABLE
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'license_activations'
      AND COLUMN_NAME IN ('expires_at', 'license_duration')
  `);
  const expiryColumn = licenseColumns.find(column => (column.COLUMN_NAME || column.column_name) === 'expires_at');
  const durationColumn = licenseColumns.find(column => (column.COLUMN_NAME || column.column_name) === 'license_duration');
  if (expiryColumn && (expiryColumn.IS_NULLABLE || expiryColumn.is_nullable) !== 'YES') {
    await db.query('ALTER TABLE license_activations MODIFY COLUMN expires_at DATETIME NULL');
  }
  if (!durationColumn) {
    await db.query("ALTER TABLE license_activations ADD COLUMN license_duration ENUM('1y','3y','forever') NOT NULL DEFAULT '1y' AFTER license_type");
  }
  await db.query("UPDATE license_activations SET expires_at = NULL, license_duration = 'forever' WHERE license_type = 'free'");

  await db.query(
    `INSERT IGNORE INTO license_activations
       (license_id, installation_id, license_type, license_duration, activated_at, expires_at)
     SELECT ?, ?, 'free', 'forever', UTC_TIMESTAMP(), NULL
     WHERE NOT EXISTS (
       SELECT 1 FROM license_activations WHERE installation_id = ?
     )`,
    [defaultFreeLicenseId(installationId), installationId, installationId]
  );
}

module.exports = {
  LICENSE_TYPES,
  LICENSE_DURATIONS,
  defaultFreeLicenseId,
  createLicenseKey,
  verifyLicenseKey,
  getLicenseConfig,
  getLicenseStatus,
  activateLicense,
  migrateLicenseStorage
};
