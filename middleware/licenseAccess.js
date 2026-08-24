const db = require('../db');
const { getLicenseStatus } = require('../lib/licenseService');

const FREE_FEATURES = new Set(['dashboard', 'product_sales', 'door_ticket_sales', 'configuration']);

function licenseAllows(status, feature) {
  if (feature === 'configuration') return true;
  if (!status?.active) return false;
  if (status.type === 'full') return true;
  return status.type === 'free' && FREE_FEATURES.has(feature);
}

function licenseError(res, status) {
  const expired = status?.state === 'expired';
  return res.status(403).json({
    error: expired
      ? 'La licencia está vencida. Instale una licencia vigente desde Configuración.'
      : 'Esta función no está disponible para la licencia instalada.',
    code: expired ? 'LICENSE_EXPIRED' : 'LICENSE_FEATURE_NOT_AVAILABLE',
    license: status
  });
}

function requireLicenseFeature(feature) {
  return async (req, res, next) => {
    try {
      const status = await getLicenseStatus(db);
      req.license = status;
      if (licenseAllows(status, feature)) return next();
      return licenseError(res, status);
    } catch (error) {
      return res.status(500).json({ error: 'No se pudo validar la licencia', code: 'LICENSE_CHECK_FAILED' });
    }
  };
}

async function requireTicketSaleLicense(req, res, next) {
  try {
    const status = await getLicenseStatus(db);
    req.license = status;
    const ticketType = String(req.body?.ticket_type || 'anticipada').toLowerCase();
    if (status.active && (status.type === 'full' || (status.type === 'free' && ticketType === 'puerta'))) {
      return next();
    }
    return licenseError(res, status);
  } catch (error) {
    return res.status(500).json({ error: 'No se pudo validar la licencia', code: 'LICENSE_CHECK_FAILED' });
  }
}

module.exports = { FREE_FEATURES, licenseAllows, requireLicenseFeature, requireTicketSaleLicense };
