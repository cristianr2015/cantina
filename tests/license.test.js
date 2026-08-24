const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const {
  createLicenseKey,
  verifyLicenseKey,
  getLicenseConfig,
  getLicenseStatus,
  activateLicense,
  defaultFreeLicenseId,
  migrateLicenseStorage
} = require('../lib/licenseService');
const { licenseAllows, licenseAllowsUserRoles } = require('../middleware/licenseAccess');

const signingSecret = 'test-secret-with-more-than-thirty-two-characters';
const installationId = '5a80418f-aa50-4d3f-9293-fc0d13084c87';
const otherInstallationId = '32280602-050f-4cc7-92c8-6d126ba9ace3';
const env = { LICENSE_SIGNING_SECRET: signingSecret, LICENSE_INSTALLATION_ID: installationId };

test('genera y valida licencias firmadas para una instalación', () => {
  const key = createLicenseKey({ type: 'free', installationId, signingSecret });
  const result = verifyLicenseKey(key, getLicenseConfig(env));
  assert.equal(result.valid, true);
  assert.equal(result.payload.type, 'free');
  assert.equal(result.payload.duration, 'forever');
  assert.equal(result.payload.installationId, installationId);
  assert.match(result.payload.licenseId, /^[0-9a-f-]{36}$/);
});

test('rechaza claves alteradas y licencias emitidas para otra instalación', () => {
  const key = createLicenseKey({ type: 'pro', duration: '3y', installationId, signingSecret });
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

test('la licencia free solamente permite nuevos usuarios administradores', () => {
  const free = { active: true, type: 'free' };
  const full = { active: true, type: 'full' };
  assert.equal(licenseAllowsUserRoles(free, ['admin']), true);
  assert.equal(licenseAllowsUserRoles(free, ['seller']), false);
  assert.equal(licenseAllowsUserRoles(free, ['admin', 'puerta']), false);
  assert.equal(licenseAllowsUserRoles(full, ['seller']), true);
  assert.equal(licenseAllowsUserRoles(free, ['seller'], ['seller']), true);
  assert.equal(licenseAllowsUserRoles(free, ['puerta'], ['seller']), false);
});

test('genera un identificador estable para la licencia free predeterminada', () => {
  const first = defaultFreeLicenseId(installationId);
  assert.equal(first, defaultFreeLicenseId(installationId));
  assert.notEqual(first, defaultFreeLicenseId(otherInstallationId));
  assert.match(first, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/);
});

test('instala una licencia free sin vencimiento cuando la instalación todavía no tiene licencias', async () => {
  const queries = [];
  const db = {
    query: async (sql, params = []) => {
      queries.push({ sql, params });
      return [[]];
    }
  };
  await migrateLicenseStorage(db, env);
  const insert = queries.find(query => query.sql.includes('INSERT IGNORE INTO license_activations'));
  const freeMigration = queries.find(query => query.sql.includes("SET expires_at = NULL, license_duration = 'forever'"));
  assert.ok(insert);
  assert.ok(freeMigration);
  assert.deepEqual(insert.params, [defaultFreeLicenseId(installationId), installationId, installationId]);
  assert.match(insert.sql, /WHERE NOT EXISTS/);
  assert.match(insert.sql, /'forever'/);
  assert.doesNotMatch(insert.sql, /INTERVAL .* YEAR/);
});

test('genera licencias Pro por uno, tres años o sin vencimiento', () => {
  for (const duration of ['1y', '3y', 'forever']) {
    const key = createLicenseKey({ type: 'pro', duration, installationId, signingSecret });
    const result = verifyLicenseKey(key, getLicenseConfig(env));
    assert.equal(result.valid, true);
    assert.equal(result.payload.type, 'full');
    assert.equal(result.payload.duration, duration);
  }
  assert.throws(
    () => createLicenseKey({ type: 'pro', duration: '2y', installationId, signingSecret }),
    /1y, 3y o forever/
  );
});

test('mantiene las claves Pro anteriores como licencias de un año', () => {
  const legacyPayload = Buffer.from(JSON.stringify({
    version: 1,
    licenseId: crypto.randomUUID(),
    type: 'full',
    installationId
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', signingSecret)
    .update(`PENA1.${legacyPayload}`)
    .digest('base64url');
  const result = verifyLicenseKey(`PENA1.${legacyPayload}.${signature}`, getLicenseConfig(env));
  assert.equal(result.valid, true);
  assert.equal(result.payload.duration, '1y');
});

test('consulta el estado activo y detecta el vencimiento', async () => {
  const activeDb = {
    query: async () => [[{
      license_type: 'free',
      license_duration: 'forever',
      activated_at: new Date(Date.now() - 1000),
      expires_at: null
    }]]
  };
  const active = await getLicenseStatus(activeDb, env);
  assert.equal(active.active, true);
  assert.equal(active.state, 'active');
  assert.equal(active.type, 'free');
  assert.equal(active.duration, 'forever');
  assert.equal(active.expiresAt, null);

  const expiredDb = {
    query: async () => [[{
      license_type: 'full',
      license_duration: '1y',
      activated_at: new Date(Date.now() - 120_000),
      expires_at: new Date(Date.now() - 60_000)
    }]]
  };
  const expired = await getLicenseStatus(expiredDb, env);
  assert.equal(expired.active, false);
  assert.equal(expired.state, 'expired');
  assert.equal(expired.type, 'full');
});

test('activa una licencia Pro por tres años y rechaza su reutilización', async () => {
  const licenseId = crypto.randomUUID();
  const key = createLicenseKey({ type: 'pro', duration: '3y', installationId, signingSecret, licenseId });
  const queries = [];
  const connection = {
    query: async (sql, params) => {
      queries.push({ sql, params });
      if (sql.includes('INSERT INTO')) return [{ insertId: 17 }];
      return [[{
        license_type: 'full',
        license_duration: '3y',
        activated_at: new Date('2026-08-24T12:00:00Z'),
        expires_at: new Date('2029-08-24T12:00:00Z')
      }]];
    },
    release() {}
  };
  const db = { getConnection: async () => connection };
  const activated = await activateLicense(db, key, env);
  assert.equal(activated.active, true);
  assert.equal(activated.type, 'full');
  assert.equal(activated.duration, '3y');
  assert.deepEqual(queries[0].params, [licenseId, installationId, 'full', '3y']);
  assert.match(queries[0].sql, /DATE_ADD\(UTC_TIMESTAMP\(\), INTERVAL 3 YEAR\)/);

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

test('las licencias Free activadas manualmente tampoco tienen vencimiento', async () => {
  const key = createLicenseKey({ type: 'free', installationId, signingSecret });
  let insertQuery;
  const connection = {
    query: async (sql) => {
      if (sql.includes('INSERT INTO')) {
        insertQuery = sql;
        return [{ insertId: 21 }];
      }
      return [[{
        license_type: 'free',
        license_duration: 'forever',
        activated_at: new Date('2026-08-24T12:00:00Z'),
        expires_at: null,
        is_active: 1
      }]];
    },
    release() {}
  };
  const activated = await activateLicense({ getConnection: async () => connection }, key, env);
  assert.equal(activated.active, true);
  assert.equal(activated.duration, 'forever');
  assert.equal(activated.expiresAt, null);
  assert.match(insertQuery, /UTC_TIMESTAMP\(\), NULL\)/);
});
