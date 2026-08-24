const PAYMENT_METHODS = new Set(['cash', 'mercadopago', 'transfer']);
const EXPENSE_STATUSES = new Set(['paid', 'pending']);

function normalizeOptionalText(value, maxLength) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
}

function normalizeExpense(body = {}) {
  const description = String(body.description || '').trim().slice(0, 255);
  const category = String(body.category || '').trim().slice(0, 100);
  const amount = Number(body.amount);
  const paymentMethod = String(body.payment_method || 'cash').trim();
  const status = String(body.status || 'pending').trim();
  const expenseDate = String(body.expense_date || '').trim();
  const userId = body.user_id === '' || body.user_id === null || body.user_id === undefined
    ? null
    : Number(body.user_id);

  if (!description) return { error: 'La descripción es obligatoria' };
  if (!category) return { error: 'La categoría es obligatoria' };
  if (!Number.isFinite(amount) || amount <= 0) return { error: 'El importe debe ser mayor a cero' };
  if (!PAYMENT_METHODS.has(paymentMethod)) return { error: 'El medio de pago no es válido' };
  if (!EXPENSE_STATUSES.has(status)) return { error: 'El estado no es válido' };
  const dateParts = expenseDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const parsedDate = dateParts
    ? new Date(Date.UTC(Number(dateParts[1]), Number(dateParts[2]) - 1, Number(dateParts[3])))
    : null;
  const isValidDate = parsedDate
    && parsedDate.getUTCFullYear() === Number(dateParts[1])
    && parsedDate.getUTCMonth() === Number(dateParts[2]) - 1
    && parsedDate.getUTCDate() === Number(dateParts[3]);
  if (!isValidDate) {
    return { error: 'La fecha del gasto no es válida' };
  }
  if (userId !== null && (!Number.isInteger(userId) || userId <= 0)) {
    return { error: 'El responsable no es válido' };
  }

  return {
    value: {
      description,
      category,
      supplier: normalizeOptionalText(body.supplier, 150),
      amount,
      payment_method: paymentMethod,
      status,
      expense_date: expenseDate,
      user_id: userId
    }
  };
}

module.exports = { normalizeExpense, PAYMENT_METHODS, EXPENSE_STATUSES };
