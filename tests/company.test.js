const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeCompanyCode,
  isCompanyCodeValid,
  normalizeCompanyLicense,
  serializeCompanyLicense,
  getCompanyLicenseStatus
} = require('../lib/companyService');
const { parseOptionalUserId, userBelongsToCompany } = require('../lib/companyAccess');

test('normaliza y valida el código de acceso de una empresa', () => {
  assert.equal(normalizeCompanyCode(' Peña Los Amigos '), 'pena-los-amigos');
  assert.equal(isCompanyCodeValid('pena-los-amigos'), true);
  assert.equal(isCompanyCodeValid('a'), false);
});

test('las licencias Free son permanentes y las Pro admiten vencimientos configurables', () => {
  const now = new Date('2026-08-25T12:00:00Z');
  assert.deepEqual(normalizeCompanyLicense({ license_type: 'free', license_duration: '1y' }, now), {
    type: 'free', duration: 'forever', expiresAt: null
  });
  const pro = normalizeCompanyLicense({ license_type: 'full', license_duration: '3y' }, now);
  assert.equal(pro.type, 'full');
  assert.equal(pro.duration, '3y');
  assert.equal(pro.expiresAt.toISOString(), '2029-08-25T12:00:00.000Z');
  const custom = normalizeCompanyLicense({ license_type: 'pro', license_duration: 'custom', expires_at: '2027-01-10' }, now);
  assert.equal(custom.type, 'full');
  assert.equal(custom.duration, 'custom');
  assert.throws(
    () => normalizeCompanyLicense({ license_type: 'full', license_duration: 'custom', expires_at: '2025-01-01' }, now),
    /debe ser futura/
  );
});

test('serializa el vencimiento de una licencia empresarial', () => {
  const active = serializeCompanyLicense({
    license_id: 'license-id', license_type: 'full', license_duration: 'forever',
    activated_at: new Date(), expires_at: null
  }, 9);
  assert.equal(active.active, true);
  assert.equal(active.companyId, 9);
  assert.equal(active.type, 'full');

  const expired = serializeCompanyLicense({
    license_type: 'full', license_duration: 'custom',
    activated_at: new Date('2020-01-01'), expires_at: new Date('2020-02-01')
  }, 9);
  assert.equal(expired.active, false);
  assert.equal(expired.state, 'expired');
});

test('consulta la licencia correspondiente a la empresa autenticada', async () => {
  let params;
  const status = await getCompanyLicenseStatus({
    query: async (_sql, queryParams) => {
      params = queryParams;
      return [[{ license_type: 'free', license_duration: 'forever', activated_at: new Date(), expires_at: null }]];
    }
  }, 22);
  assert.deepEqual(params, [22]);
  assert.equal(status.companyId, 22);
  assert.equal(status.type, 'free');
  assert.equal(status.active, true);
});

test('valida que los usuarios seleccionados pertenezcan a la empresa', async () => {
  assert.equal(parseOptionalUserId('12'), 12);
  assert.equal(parseOptionalUserId('usuario'), null);
  const executor = {
    query: async (_sql, params) => [params[0] === 12 && params[1] === 4 ? [{ id: 12 }] : []]
  };
  assert.equal(await userBelongsToCompany(executor, 12, 4), true);
  assert.equal(await userBelongsToCompany(executor, 12, 5), false);
});
