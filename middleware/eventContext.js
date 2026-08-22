function parseEventId(value) {
  const eventId = Number(value);
  return Number.isInteger(eventId) && eventId > 0 ? eventId : null;
}

function requireEvent(req, res, next) {
  const eventId = parseEventId(req.get('x-event-id'));
  if (!eventId) {
    return res.status(400).json({
      error: 'Seleccione un evento activo para continuar',
      code: 'EVENT_REQUIRED'
    });
  }
  req.eventId = eventId;
  next();
}

module.exports = { parseEventId, requireEvent };
