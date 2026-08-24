const assert = require('node:assert/strict');
const test = require('node:test');
const jwt = require('jsonwebtoken');
const auth = require('../middleware/authMiddleware');
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
