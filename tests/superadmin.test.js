const test = require('node:test');
const assert = require('node:assert/strict');

const {
  hashSuperadminPassword,
  verifySuperadminPassword,
  migrateSuperadminStorage,
  authenticateSuperadmin,
  isSuperadminSessionValid,
  changeSuperadminPassword
} = require('../lib/superadminService');

test('protege la contraseña del superadministrador con hash scrypt y salt aleatorio', async () => {
  const first = await hashSuperadminPassword('ClaveInicial!2026');
  const second = await hashSuperadminPassword('ClaveInicial!2026');
  assert.match(first, /^scrypt\$[^$]+\$[^$]+$/);
  assert.notEqual(first, second);
  assert.equal(await verifySuperadminPassword('ClaveInicial!2026', first), true);
  assert.equal(await verifySuperadminPassword('otra-clave', first), false);
  assert.equal(await verifySuperadminPassword('ClaveInicial!2026', 'hash-invalido'), false);
});

test('crea la cuenta inicial desde el entorno sin sobrescribir cambios posteriores', async () => {
  const queries = [];
  const executor = {
    query: async (sql, params = []) => {
      queries.push({ sql, params });
      return [[]];
    }
  };
  await migrateSuperadminStorage(executor, {
    SUPERADMIN_USERNAME: 'superadmin',
    SUPERADMIN_PASSWORD: 'ClaveInicial!2026'
  });
  assert.ok(queries.some(item => item.sql.includes('CREATE TABLE IF NOT EXISTS superadmin_accounts')));
  const seed = queries.find(item => item.sql.includes('INSERT IGNORE INTO superadmin_accounts'));
  assert.ok(seed);
  assert.equal(seed.params[0], 'superadmin');
  assert.equal(await verifySuperadminPassword('ClaveInicial!2026', seed.params[1]), true);
});

test('cambia la contraseña e invalida las sesiones anteriores', async () => {
  let passwordHash = await hashSuperadminPassword('ClaveInicial!2026');
  let credentialVersion = 1;
  const executor = {
    query: async (sql, params = []) => {
      if (sql.includes('SELECT username')) {
        return [[{ username: 'superadmin', password_hash: passwordHash, credential_version: credentialVersion }]];
      }
      if (sql.includes('UPDATE superadmin_accounts')) {
        passwordHash = params[0];
        credentialVersion += 1;
        return [{ affectedRows: 1 }];
      }
      return [[]];
    }
  };

  const authenticated = await authenticateSuperadmin(executor, 'superadmin', 'ClaveInicial!2026');
  assert.deepEqual(authenticated, { username: 'superadmin', credentialVersion: 1 });
  assert.equal(await isSuperadminSessionValid(executor, 'superadmin', 1), true);

  await changeSuperadminPassword(executor, 'superadmin', 'ClaveInicial!2026', 'ClaveNuevaSegura!2026');
  assert.equal(await authenticateSuperadmin(executor, 'superadmin', 'ClaveInicial!2026'), null);
  assert.deepEqual(await authenticateSuperadmin(executor, 'superadmin', 'ClaveNuevaSegura!2026'), {
    username: 'superadmin', credentialVersion: 2
  });
  assert.equal(await isSuperadminSessionValid(executor, 'superadmin', 1), false);
  assert.equal(await isSuperadminSessionValid(executor, 'superadmin', 2), true);
});

test('rechaza contraseña actual incorrecta, claves cortas y reutilizadas', async () => {
  const passwordHash = await hashSuperadminPassword('ClaveInicial!2026');
  const executor = {
    query: async () => [[{ username: 'superadmin', password_hash: passwordHash, credential_version: 1 }]]
  };
  await assert.rejects(
    changeSuperadminPassword(executor, 'superadmin', 'incorrecta', 'ClaveNuevaSegura!2026'),
    /actual no es correcta/
  );
  await assert.rejects(
    changeSuperadminPassword(executor, 'superadmin', 'ClaveInicial!2026', 'corta'),
    /al menos 12 caracteres/
  );
  await assert.rejects(
    changeSuperadminPassword(executor, 'superadmin', 'ClaveInicial!2026', 'ClaveInicial!2026'),
    /debe ser diferente/
  );
});
