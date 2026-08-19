const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config');

function authMiddleware(requiredRoles = []){
  return (req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'No autorizado' });
    const token = auth.slice(7);
    try {
      const payload = jwt.verify(token, jwtSecret);
      req.user = payload;
      if (requiredRoles.length && !requiredRoles.includes(payload.role)) return res.status(403).json({ error: 'Acceso denegado' });
      next();
    } catch (err) {
      res.status(401).json({ error: 'Token inválido' });
    }
  };
}

module.exports = authMiddleware;
