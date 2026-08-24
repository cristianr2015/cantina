const crypto = require('crypto');
const { promisify } = require('util');

const scrypt = promisify(crypto.scrypt);
const PASSWORD_MIN_LENGTH = 12;

function validateNewPassword(password) {
  if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH) {
    const error = new Error(`La nueva contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`);
    error.code = 'PASSWORD_TOO_SHORT';
    throw error;
  }
}

async function hashSuperadminPassword(password) {
  if (typeof password !== 'string' || !password.length) throw new Error('La contraseña no puede estar vacía');
  const salt = crypto.randomBytes(16);
  const derivedKey = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('base64url')}$${derivedKey.toString('base64url')}`;
}

async function verifySuperadminPassword(password, storedHash) {
  if (typeof password !== 'string' || typeof storedHash !== 'string') return false;
  const [algorithm, saltValue, hashValue, extra] = storedHash.split('$');
  if (algorithm !== 'scrypt' || !saltValue || !hashValue || extra !== undefined) return false;
  try {
    const salt = Buffer.from(saltValue, 'base64url');
    const expected = Buffer.from(hashValue, 'base64url');
    if (!salt.length || !expected.length) return false;
    const actual = await scrypt(password, salt, expected.length);
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch (_error) {
    return false;
  }
}

async function migrateSuperadminStorage(executor, env = process.env) {
  await executor.query(`
    CREATE TABLE IF NOT EXISTS superadmin_accounts (
      username VARCHAR(100) PRIMARY KEY,
      password_hash VARCHAR(255) NOT NULL,
      credential_version INT UNSIGNED NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  const username = String(env.SUPERADMIN_USERNAME || '').trim();
  const password = String(env.SUPERADMIN_PASSWORD || '');
  if (!username || !password) return;
  const passwordHash = await hashSuperadminPassword(password);
  await executor.query(
    'INSERT IGNORE INTO superadmin_accounts (username, password_hash) VALUES (?, ?)',
    [username, passwordHash]
  );
}

async function findSuperadmin(executor, username) {
  const [rows] = await executor.query(
    'SELECT username, password_hash, credential_version FROM superadmin_accounts WHERE username = ? LIMIT 1',
    [String(username || '').trim()]
  );
  return rows[0] || null;
}

async function authenticateSuperadmin(executor, username, password) {
  const account = await findSuperadmin(executor, username);
  if (!account || !await verifySuperadminPassword(password, account.password_hash)) return null;
  return { username: account.username, credentialVersion: Number(account.credential_version) };
}

async function isSuperadminSessionValid(executor, username, credentialVersion) {
  const account = await findSuperadmin(executor, username);
  return Boolean(account && Number(account.credential_version) === Number(credentialVersion));
}

async function changeSuperadminPassword(executor, username, currentPassword, newPassword) {
  validateNewPassword(newPassword);
  const account = await findSuperadmin(executor, username);
  if (!account || !await verifySuperadminPassword(currentPassword, account.password_hash)) {
    const error = new Error('La contraseña actual no es correcta');
    error.code = 'INVALID_CURRENT_PASSWORD';
    throw error;
  }
  if (await verifySuperadminPassword(newPassword, account.password_hash)) {
    const error = new Error('La nueva contraseña debe ser diferente de la actual');
    error.code = 'PASSWORD_REUSED';
    throw error;
  }
  const passwordHash = await hashSuperadminPassword(newPassword);
  await executor.query(
    'UPDATE superadmin_accounts SET password_hash = ?, credential_version = credential_version + 1 WHERE username = ?',
    [passwordHash, account.username]
  );
}

module.exports = {
  PASSWORD_MIN_LENGTH,
  hashSuperadminPassword,
  verifySuperadminPassword,
  migrateSuperadminStorage,
  authenticateSuperadmin,
  isSuperadminSessionValid,
  changeSuperadminPassword
};
