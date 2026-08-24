const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config');

function requireAdminApproval(action) {
  return (req, res, next) => {
    if (req.user?.roles?.includes('admin')) return next();

    const approvalToken = req.headers['x-admin-approval'];
    if (!approvalToken) return res.status(403).json({ error: 'Se requiere autorización de un administrador' });

    try {
      const approval = jwt.verify(approvalToken, jwtSecret);
      const isValid = approval.type === 'admin-approval'
        && approval.action === action
        && Number(approval.requesterId) === Number(req.user.id)
        && Number.isInteger(Number(approval.adminId));
      if (!isValid) return res.status(403).json({ error: 'La autorización administrativa no es válida' });
      req.adminApproval = approval;
      next();
    } catch (_err) {
      res.status(403).json({ error: 'La autorización administrativa venció o no es válida' });
    }
  };
}

module.exports = { requireAdminApproval };
