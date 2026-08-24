const express = require('express');
const db = require('../db');
const auth = require('../middleware/authMiddleware');
const { getLicenseStatus, activateLicense } = require('../lib/licenseService');

const router = express.Router();

router.get('/status', auth(['admin', 'seller', 'puerta']), async (_req, res) => {
  try {
    res.json(await getLicenseStatus(db));
  } catch (_error) {
    res.status(500).json({ error: 'No se pudo consultar la licencia', code: 'LICENSE_CHECK_FAILED' });
  }
});

router.post('/activate', auth(['admin']), async (req, res) => {
  try {
    const key = String(req.body?.key || '').trim();
    if (!key) return res.status(400).json({ error: 'Ingrese una clave de licencia' });
    const status = await activateLicense(db, key);
    res.status(201).json({ ok: true, license: status });
  } catch (error) {
    const responses = {
      invalid: [400, 'La clave de licencia no es válida'],
      wrong_installation: [400, 'La licencia pertenece a otra instalación'],
      used: [409, 'Esta licencia ya fue utilizada y no puede volver a activarse'],
      misconfigured: [503, 'El servidor no tiene configurado el sistema de licencias']
    };
    const response = responses[error?.code];
    if (response) return res.status(response[0]).json({ error: response[1], code: `LICENSE_${error.code.toUpperCase()}` });
    res.status(500).json({ error: 'No se pudo activar la licencia', code: 'LICENSE_ACTIVATION_FAILED' });
  }
});

module.exports = router;
