function parseOptionalUserId(value) {
  if (value === null || value === undefined || value === '') return null;
  const userId = Number(value);
  return Number.isInteger(userId) && userId > 0 ? userId : null;
}

async function userBelongsToCompany(executor, userId, companyId) {
  const normalizedUserId = parseOptionalUserId(userId);
  if (!normalizedUserId) return false;
  const [rows] = await executor.query(
    'SELECT id FROM users WHERE id = ? AND company_id = ? LIMIT 1',
    [normalizedUserId, companyId]
  );
  return Boolean(rows[0]);
}

module.exports = { parseOptionalUserId, userBelongsToCompany };
