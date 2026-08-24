function parseEventId(value) {
  const eventId = Number(value);
  return Number.isInteger(eventId) && eventId > 0 ? eventId : null;
}

async function requireEvent(req, res, next) {
  const eventId = parseEventId(req.get('x-event-id'));
  if (!eventId) {
    return res.status(400).json({
      error: 'Seleccione un evento activo para continuar',
      code: 'EVENT_REQUIRED'
    });
  }
  try {
    const [rows] = await db.query(
      'SELECT id FROM events WHERE id = ? AND company_id = ? LIMIT 1',
      [eventId, req.user.companyId]
    );
    if (!rows[0]) {
      return res.status(404).json({ error: 'El evento no pertenece a la empresa activa', code: 'EVENT_NOT_FOUND' });
    }
    req.eventId = eventId;
    next();
  } catch (_error) {
    return res.status(500).json({ error: 'No se pudo validar el evento activo' });
  }
}

module.exports = { parseEventId, requireEvent };
const db = require('../db');
