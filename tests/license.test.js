const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const {
  createLicenseKey,
  verifyLicenseKey,
  getLicenseConfig,
  getLicenseStatus,
  activateLicense
} = require('../lib/licenseService');
const { licenseAllows } = require('../middleware/licenseAccess');

const signingSecret = 'test-secret-with-more-than-thirty-two-characters';
const installationId = '5a80418f-aa50-4d3f-9293-fc0d13084c87';
const otherInstallationId = '32280602-050f-4cc7-92c8-6d126ba9ace3';
const env = { LICENSE_SIGNING_SECRET: signingSecret, LICENSE_INSTALLATION_ID: installationId };

test('genera y valida licencias firmadas para una instalación', () => {
  const key = createLicenseKey({ type: 'free', installationId, signingSecret });
  const result = verifyLicenseKey(key, getLicenseConfig(env));
  assert.equal(result.valid, true);
  assert.equal(result.payload.type, 'free');
  assert.equal(result.payload.installationId, installationId);
  assert.match(result.payload.licenseId, /^[0-9a-f-]{36}$/);
});

test('rechaza claves alteradas y licencias emitidas para otra instalación', () => {
  const key = createLicenseKey({ type: 'full', installationId, signingSecret });
  const altered = `${key.slice(0, -1)}${key.endsWith('a') ? 'b' : 'a'}`;
  assert.deepEqual(verifyLicenseKey(altered, getLicenseConfig(env)), { valid: false, reason: 'invalid' });

  const foreignKey = createLicenseKey({ type: 'free', installationId: otherInstallationId, signingSecret });
  assert.deepEqual(verifyLicenseKey(foreignKey, getLicenseConfig(env)), { valid: false, reason: 'wrong_installation' });
});

test('la licencia free habilita solo las funciones solicitadas', () => {
  const free = { active: true, type: 'free' };
  assert.equal(licenseAllows(free, 'dashboard'), true);
  assert.equal(licenseAllows(free, 'product_sales'), true);
  assert.equal(licenseAllows(free, 'door_ticket_sales'), true);
  assert.equal(licenseAllows(free, 'configuration'), true);
  assert.equal(licenseAllows(free, 'full'), false);
  assert.equal(licenseAllows({ active: false, type: 'free' }, 'dashboard'), false);
  assert.equal(licenseAllows({ active: false, type: null }, 'configuration'), true);
});

test('consulta el estado activo y detecta el vencimiento', async () => {
  const activeDb = {
    query: async () => [[{
      license_type: 'free',
      activated_at: new Date(Date.now() - 1000),
      expires_at: new Date(Date.now() + 60_000)
    }]]
  };
  const active = await getLicenseStatus(activeDb, env);
  assert.equal(active.active, true);
  assert.equal(active.state, 'active');
  assert.equal(active.type, 'free');

  const expiredDb = {
    query: async () => [[{
      license_type: 'full',
      activated_at: new Date(Date.now() - 120_000),
      expires_at: new Date(Date.now() - 60_000)
    }]]
  };
  const expired = await getLicenseStatus(expiredDb, env);
  assert.equal(expired.active, false);
  assert.equal(expired.state, 'expired');
  assert.equal(expired.type, 'full');
});

test('activa por un año y rechaza la reutilización de una clave', async () => {
  const licenseId = crypto.randomUUID();
  const key = createLicenseKey({ type: 'free', installationId, signingSecret, licenseId });
  const queries = [];
  const connection = {
    query: async (sql, params) => {
      queries.push({ sql, params });
      if (sql.includes('INSERT INTO')) return [{ insertId: 17 }];
      return [[{
        license_type: 'free',
        activated_at: new Date('2026-08-24T12:00:00Z'),
        expires_at: new Date('2027-08-24T12:00:00Z')
      }]];
    },
    release() {}
  };
  const db = { getConnection: async () => connection };
  const activated = await activateLicense(db, key, env);
  assert.equal(activated.active, true);
  assert.equal(activated.type, 'free');
  assert.deepEqual(queries[0].params, [licenseId, installationId, 'free']);
  assert.match(queries[0].sql, /DATE_ADD\(UTC_TIMESTAMP\(\), INTERVAL 1 YEAR\)/);

  const duplicateDb = {
    getConnection: async () => ({
      query: async () => {
        const error = new Error('duplicate');
        error.code = 'ER_DUP_ENTRY';
        throw error;
      },
      release() {}
    })
  };
  await assert.rejects(() => activateLicense(duplicateDb, key, env), error => error.code === 'used');
});
