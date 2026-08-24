const crypto = require('crypto');

const COMPANY_CODE_PATTERN = /^[a-z0-9][a-z0-9-]{2,39}$/;
const COMPANY_LICENSE_TYPES = new Set(['free', 'full']);
const COMPANY_LICENSE_DURATIONS = new Set(['1y', '3y', 'forever', 'custom']);

function normalizeCompanyCode(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function isCompanyCodeValid(value) {
  return COMPANY_CODE_PATTERN.test(String(value || ''));
}

function normalizeCompanyLicense(input = {}, now = new Date()) {
  const type = String(input.license_type || input.type || 'free').trim().toLowerCase() === 'pro' ? 'full' :
    String(input.license_type || input.type || 'free').trim().toLowerCase();
  if (!COMPANY_LICENSE_TYPES.has(type)) throw new Error('El tipo de licencia debe ser Free o Pro');
  const duration = type === 'free' ? 'forever' : String(input.license_duration || input.duration || '1y').trim().toLowerCase();
  if (!COMPANY_LICENSE_DURATIONS.has(duration)) {
    throw new Error('La duración debe ser 1 año, 3 años, personalizada o para siempre');
  }

  let expiresAt = null;
  if (duration === '1y' || duration === '3y') {
    expiresAt = new Date(now);
    expiresAt.setUTCFullYear(expiresAt.getUTCFullYear() + (duration === '3y' ? 3 : 1));
  } else if (duration === 'custom') {
    expiresAt = new Date(input.expires_at || input.expiresAt || '');
    if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= now.getTime()) {
      throw new Error('La fecha de vencimiento personalizada debe ser futura');
    }
  }

  return { type, duration, expiresAt };
}

function serializeCompanyLicense(row, companyId) {
  if (!row) {
    return { configured: true, active: false, state: 'missing', type: null, companyId };
  }
  const expiresAt = row.expires_at ? new Date(row.expires_at) : null;
  const active = !expiresAt || (Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() > Date.now());
  return {
    configured: true,
    active,
    state: active ? 'active' : 'expired',
    type: row.license_type,
    duration: row.license_duration || (expiresAt ? 'custom' : 'forever'),
    activatedAt: row.activated_at,
    expiresAt: row.expires_at || null,
    companyId,
    licenseId: row.license_id || null
  };
}

async function getCompanyLicenseStatus(db, companyId) {
  const normalizedCompanyId = Number(companyId);
  if (!Number.isInteger(normalizedCompanyId) || normalizedCompanyId <= 0) {
    return { configured: true, active: false, state: 'missing', type: null, companyId: null };
  }
  const [rows] = await db.query(
    `SELECT license_id, license_type, license_duration, activated_at, expires_at
     FROM company_licenses
     WHERE company_id = ?
     ORDER BY activation_id DESC
     LIMIT 1`,
    [normalizedCompanyId]
  );
  return serializeCompanyLicense(rows[0], normalizedCompanyId);
}

async function assignCompanyLicense(db, companyId, input, createdBy = 'superadmin') {
  const normalizedCompanyId = Number(companyId);
  if (!Number.isInteger(normalizedCompanyId) || normalizedCompanyId <= 0) throw new Error('Empresa inválida');
  const license = normalizeCompanyLicense(input);
  const licenseId = crypto.randomUUID();
  await db.query(
    `INSERT INTO company_licenses
       (license_id, company_id, license_type, license_duration, activated_at, expires_at, created_by)
     VALUES (?, ?, ?, ?, UTC_TIMESTAMP(), ?, ?)`,
    [licenseId, normalizedCompanyId, license.type, license.duration, license.expiresAt, String(createdBy || 'superadmin').slice(0, 100)]
  );
  return getCompanyLicenseStatus(db, normalizedCompanyId);
}

async function columnExists(db, table, column) {
  const [rows] = await db.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [table, column]
  );
  return rows.length > 0;
}

async function indexExists(db, table, indexName) {
  const [rows] = await db.query(
    `SELECT 1 FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1`,
    [table, indexName]
  );
  return rows.length > 0;
}

async function migrateCompanyStorage(db) {
  await db.query(`CREATE TABLE IF NOT EXISTS companies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(40) NOT NULL UNIQUE,
    active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`);

  const [settingsRows] = await db.query('SELECT company_name FROM settings WHERE id = 1 LIMIT 1');
  const legacyName = String(settingsRows[0]?.company_name || 'Empresa principal').trim();
  await db.query(
    `INSERT IGNORE INTO companies (id, name, code, active)
     VALUES (1, ?, 'principal', 1)`,
    [legacyName]
  );

  for (const table of ['users', 'events', 'settings']) {
    if (!await columnExists(db, table, 'company_id')) {
      await db.query(`ALTER TABLE \`${table}\` ADD COLUMN company_id INT NULL`);
    }
    await db.query(`UPDATE \`${table}\` SET company_id = 1 WHERE company_id IS NULL`);
    const indexName = `idx_${table}_company`;
    if (!await indexExists(db, table, indexName)) {
      await db.query(`ALTER TABLE \`${table}\` ADD INDEX \`${indexName}\` (company_id)`);
    }
  }

  if (!await indexExists(db, 'settings', 'uq_settings_company')) {
    await db.query('ALTER TABLE settings ADD UNIQUE INDEX uq_settings_company (company_id)');
  }

  const [usernameIndexes] = await db.query(`
    SELECT INDEX_NAME, COUNT(*) AS column_count
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND NON_UNIQUE = 0
    GROUP BY INDEX_NAME
  `);
  const [usernameIndexRows] = await db.query(`
    SELECT INDEX_NAME
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'username' AND NON_UNIQUE = 0
  `);
  const singleUsernameIndex = usernameIndexRows.find(row => {
    const indexName = row.INDEX_NAME || row.index_name;
    const definition = usernameIndexes.find(index => (index.INDEX_NAME || index.index_name) === indexName);
    return Number(definition?.column_count || definition?.COLUMN_COUNT) === 1 && indexName !== 'PRIMARY';
  });
  if (singleUsernameIndex) {
    const indexName = singleUsernameIndex.INDEX_NAME || singleUsernameIndex.index_name;
    await db.query(`ALTER TABLE users DROP INDEX \`${String(indexName).replace(/`/g, '')}\``);
  }
  if (!await indexExists(db, 'users', 'uq_users_company_username')) {
    await db.query('ALTER TABLE users ADD UNIQUE INDEX uq_users_company_username (company_id, username)');
  }

  await db.query(`CREATE TABLE IF NOT EXISTS company_licenses (
    activation_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    license_id CHAR(36) NOT NULL UNIQUE,
    company_id INT NOT NULL,
    license_type ENUM('free','full') NOT NULL,
    license_duration VARCHAR(20) NOT NULL DEFAULT 'forever',
    activated_at DATETIME NOT NULL,
    expires_at DATETIME NULL,
    created_by VARCHAR(100),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_company_license (company_id, activation_id),
    INDEX idx_company_license_expiry (expires_at),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT
  )`);

  const [companies] = await db.query('SELECT id FROM companies');
  for (const company of companies) {
    const [existing] = await db.query('SELECT 1 FROM company_licenses WHERE company_id = ? LIMIT 1', [company.id]);
    if (existing.length) continue;
    let legacyLicense = null;
    if (Number(company.id) === 1) {
      const [legacyRows] = await db.query(
        `SELECT license_type, license_duration, activated_at, expires_at
         FROM license_activations ORDER BY activation_id DESC LIMIT 1`
      );
      legacyLicense = legacyRows[0] || null;
    }
    await db.query(
      `INSERT INTO company_licenses
         (license_id, company_id, license_type, license_duration, activated_at, expires_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, 'migration')`,
      [
        crypto.randomUUID(), company.id, legacyLicense?.license_type || 'free',
        legacyLicense?.license_duration || 'forever', legacyLicense?.activated_at || new Date(),
        legacyLicense?.expires_at || null
      ]
    );
  }
}

module.exports = {
  COMPANY_LICENSE_TYPES,
  COMPANY_LICENSE_DURATIONS,
  normalizeCompanyCode,
  isCompanyCodeValid,
  normalizeCompanyLicense,
  serializeCompanyLicense,
  getCompanyLicenseStatus,
  assignCompanyLicense,
  migrateCompanyStorage
};
