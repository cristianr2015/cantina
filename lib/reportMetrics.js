function numeric(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function buildClosingSummary({ event = {}, products = {}, tickets = {}, expenses = {} } = {}) {
  const productRevenue = numeric(products.revenue);
  const ticketRevenue = numeric(tickets.revenue);
  const totalIncome = productRevenue + ticketRevenue;
  const productCost = numeric(products.estimated_cost);
  const paidExpenses = numeric(expenses.paid);
  const pendingExpenses = numeric(expenses.pending);
  const totalExpenses = paidExpenses + pendingExpenses;
  const ticketsSold = numeric(tickets.sold);
  const ticketsEntered = numeric(tickets.entered);

  return {
    event_name: event.name || 'Evento',
    event_date: event.date || null,
    product_revenue: productRevenue,
    ticket_revenue: ticketRevenue,
    total_income: totalIncome,
    product_orders: numeric(products.orders),
    product_items: numeric(products.items),
    estimated_product_cost: productCost,
    estimated_product_margin: productRevenue - productCost,
    paid_expenses: paidExpenses,
    pending_expenses: pendingExpenses,
    total_expenses: totalExpenses,
    cash_result: totalIncome - paidExpenses,
    committed_result: totalIncome - totalExpenses,
    expense_records: numeric(expenses.records),
    tickets_sold: ticketsSold,
    tickets_entered: ticketsEntered,
    tickets_not_entered: Math.max(0, ticketsSold - ticketsEntered),
    courtesy_tickets: numeric(tickets.courtesy),
    attendance_rate: ticketsSold > 0 ? (ticketsEntered / ticketsSold) * 100 : 0
  };
}

module.exports = { buildClosingSummary };
