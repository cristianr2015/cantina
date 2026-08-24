const assert = require('node:assert/strict');
const test = require('node:test');
const jwt = require('jsonwebtoken');
const auth = require('../middleware/authMiddleware');
const { requireAdminApproval } = require('../middleware/adminApproval');
const { jwtSecret } = require('../config');

function authorize(requiredRoles, payload) {
  const token = jwt.sign(payload, jwtSecret);
  const req = { headers: { authorization: `Bearer ${token}` } };
  const response = { statusCode: 200, body: null };
  const res = {
    status(code) {
      response.statusCode = code;
      return this;
    },
    json(body) {
      response.body = body;
      return this;
    }
  };
  let allowed = false;
  auth(requiredRoles)(req, res, () => { allowed = true; });
  return { allowed, req, response };
}

test('autoriza cuando cualquiera de los roles del usuario coincide', () => {
  const result = authorize(['admin'], { id: 1, role: 'seller', roles: ['seller', 'admin'] });
  assert.equal(result.allowed, true);
  assert.deepEqual(result.req.user.roles, ['seller', 'admin']);
});

test('mantiene compatibilidad con tokens antiguos de un solo rol', () => {
  const result = authorize(['seller'], { id: 2, role: 'seller' });
  assert.equal(result.allowed, true);
  assert.deepEqual(result.req.user.roles, ['seller']);
});

test('rechaza el acceso cuando ningun rol coincide', () => {
  const result = authorize(['admin'], { id: 3, role: 'puerta', roles: ['puerta'] });
  assert.equal(result.allowed, false);
  assert.equal(result.response.statusCode, 403);
});

function approve(action, user, approvalPayload = null) {
  const req = {
    user,
    headers: approvalPayload ? { 'x-admin-approval': jwt.sign(approvalPayload, jwtSecret) } : {}
  };
  const response = { statusCode: 200, body: null };
  const res = {
    status(code) {
      response.statusCode = code;
      return this;
    },
    json(body) {
      response.body = body;
      return this;
    }
  };
  let allowed = false;
  requireAdminApproval(action)(req, res, () => { allowed = true; });
  return { allowed, response };
}

test('un administrador no necesita una aprobacion adicional para eliminar', () => {
  const result = approve('delete:sale', { id: 1, roles: ['admin'] });
  assert.equal(result.allowed, true);
});

test('un vendedor necesita una aprobacion administrativa valida y vinculada a la accion', () => {
  const user = { id: 7, roles: ['seller'] };
  const missing = approve('delete:sale', user);
  assert.equal(missing.allowed, false);
  assert.equal(missing.response.statusCode, 403);

  const valid = approve('delete:sale', user, {
    type: 'admin-approval', action: 'delete:sale', adminId: 1, requesterId: 7
  });
  assert.equal(valid.allowed, true);

  const wrongAction = approve('delete:sale', user, {
    type: 'admin-approval', action: 'delete:ticket', adminId: 1, requesterId: 7
  });
  assert.equal(wrongAction.allowed, false);
  assert.equal(wrongAction.response.statusCode, 403);
});
