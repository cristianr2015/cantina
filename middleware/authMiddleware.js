const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config');

function authMiddleware(requiredRoles = []){
  return (req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'No autorizado' });
    const token = auth.slice(7);
    try {
      const payload = jwt.verify(token, jwtSecret);
      const roles = Array.isArray(payload.roles) && payload.roles.length
        ? payload.roles
        : (payload.role ? [payload.role] : []);
      payload.roles = roles;
      payload.role = payload.role || roles[0];
      payload.companyId = Number(payload.companyId || 1);
      req.user = payload;
      if (requiredRoles.length && !roles.some(role => requiredRoles.includes(role))) {
        return res.status(403).json({ error: 'Acceso denegado' });
      }
      next();
    } catch (err) {
      res.status(401).json({ error: 'Token inválido' });
    }
  };
}

module.exports = authMiddleware;
