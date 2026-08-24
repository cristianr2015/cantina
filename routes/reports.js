const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/authMiddleware');
const { requireEvent } = require('../middleware/eventContext');
const { buildClosingSummary } = require('../lib/reportMetrics');

function dateRange(field, start, end, dateOnly = false) {
  let sql = '';
  const params = [];
  if (start) {
    sql += ` AND ${field} >= ?`;
    params.push(dateOnly ? start : `${start} 00:00:00`);
  }
  if (end) {
    sql += ` AND ${field} <= ?`;
    params.push(dateOnly ? end : `${end} 23:59:59`);
  }
  return { sql, params };
}

// Cierre consolidado: la primera pantalla que un administrador necesita al terminar el evento.
router.get('/event-closing', auth(['admin']), requireEvent, async (req, res) => {
  try {
    const { start, end } = req.query;
    const ordersRange = dateRange('o.created_at', start, end);
    const ticketsRange = dateRange('t.sold_at', start, end);
    const expensesRange = dateRange('e.expense_date', start, end, true);

    const [
      [eventRows], [productRows], [productCostRows], [ticketRows], [expenseRows]
    ] = await Promise.all([
      db.query("SELECT name, DATE_FORMAT(date, '%Y-%m-%d %H:%i') AS date FROM events WHERE id = ? LIMIT 1", [req.eventId]),
      db.query(`SELECT COALESCE(SUM(o.total), 0) AS revenue, COUNT(*) AS orders
        FROM orders o WHERE o.event_id = ?${ordersRange.sql}`, [req.eventId, ...ordersRange.params]),
      db.query(`SELECT COALESCE(SUM(s.quantity * IFNULL(p.price_cost, 0)), 0) AS estimated_cost,
                       COALESCE(SUM(s.quantity), 0) AS items
        FROM sales s
        INNER JOIN orders o ON o.id = s.order_id
        LEFT JOIN products p ON p.id = s.product_id
        WHERE o.event_id = ?${ordersRange.sql}`, [req.eventId, ...ordersRange.params]),
      db.query(`SELECT COALESCE(SUM(t.price_paid), 0) AS revenue,
                       COUNT(*) AS sold,
                       COALESCE(SUM(CASE WHEN t.entered = 1 THEN 1 ELSE 0 END), 0) AS entered,
                       COALESCE(SUM(CASE WHEN t.ticket_type = 'cortesia' THEN 1 ELSE 0 END), 0) AS courtesy
        FROM tickets_sold t WHERE t.event_id = ?${ticketsRange.sql}`, [req.eventId, ...ticketsRange.params]),
      db.query(`SELECT COALESCE(SUM(CASE WHEN e.status = 'paid' THEN e.amount ELSE 0 END), 0) AS paid,
                       COALESCE(SUM(CASE WHEN e.status = 'pending' THEN e.amount ELSE 0 END), 0) AS pending,
                       COUNT(*) AS records
        FROM expenses e WHERE e.event_id = ?${expensesRange.sql}`, [req.eventId, ...expensesRange.params])
    ]);

    res.json([buildClosingSummary({
      event: eventRows[0],
      products: { ...productRows[0], ...productCostRows[0] },
      tickets: ticketRows[0],
      expenses: expenseRows[0]
    })]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/cash-summary', auth(['admin']), requireEvent, async (req, res) => {
  try {
    const { start, end } = req.query;
    const ordersRange = dateRange('created_at', start, end);
    const ticketsRange = dateRange('sold_at', start, end);
    const expensesRange = dateRange('expense_date', start, end, true);
    const [rows] = await db.query(`
      SELECT payment_method,
             SUM(product_income) AS product_income,
             SUM(ticket_income) AS ticket_income,
             SUM(paid_expenses) AS paid_expenses,
             SUM(product_income + ticket_income - paid_expenses) AS theoretical_balance
      FROM (
        SELECT payment_method, COALESCE(SUM(total), 0) AS product_income, 0 AS ticket_income, 0 AS paid_expenses
        FROM orders WHERE event_id = ?${ordersRange.sql} GROUP BY payment_method
        UNION ALL
        SELECT payment_method, 0, COALESCE(SUM(price_paid), 0), 0
        FROM tickets_sold WHERE event_id = ?${ticketsRange.sql} GROUP BY payment_method
        UNION ALL
        SELECT payment_method, 0, 0, COALESCE(SUM(amount), 0)
        FROM expenses WHERE event_id = ? AND status = 'paid'${expensesRange.sql} GROUP BY payment_method
      ) movements
      GROUP BY payment_method
      ORDER BY FIELD(payment_method, 'cash', 'mercadopago', 'transfer')
    `, [
      req.eventId, ...ordersRange.params,
      req.eventId, ...ticketsRange.params,
      req.eventId, ...expensesRange.params
    ]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/products-summary', auth(['admin']), requireEvent, async (req, res) => {
  try {
    const { start, end } = req.query;
    const range = dateRange('o.created_at', start, end);
    const [rows] = await db.query(`
      SELECT p.name AS product,
             SUM(s.quantity) AS units,
             SUM(CASE WHEN order_gross.gross > 0
                 THEN o.total * (s.quantity * s.sale_price) / order_gross.gross ELSE 0 END) AS revenue,
             SUM(s.quantity * IFNULL(p.price_cost, 0)) AS estimated_cost,
             SUM(CASE WHEN order_gross.gross > 0
                 THEN o.total * (s.quantity * s.sale_price) / order_gross.gross ELSE 0 END)
                 - SUM(s.quantity * IFNULL(p.price_cost, 0)) AS estimated_margin,
             p.stock AS ending_stock
      FROM sales s
      INNER JOIN orders o ON o.id = s.order_id
      INNER JOIN (
        SELECT order_id, SUM(quantity * sale_price) AS gross
        FROM sales GROUP BY order_id
      ) order_gross ON order_gross.order_id = o.id
      LEFT JOIN products p ON p.id = s.product_id
      WHERE o.event_id = ?${range.sql}
      GROUP BY p.id, p.name, p.stock
      ORDER BY units DESC, revenue DESC
    `, [req.eventId, ...range.params]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/tickets-summary', auth(['admin']), requireEvent, async (req, res) => {
  try {
    const { start, end } = req.query;
    const range = dateRange('t.sold_at', start, end);
    const [rows] = await db.query(`
      SELECT t.ticket_type,
             COUNT(*) AS sold,
             SUM(CASE WHEN t.entered = 1 THEN 1 ELSE 0 END) AS entered,
             SUM(CASE WHEN t.entered = 0 THEN 1 ELSE 0 END) AS not_entered,
             COALESCE(SUM(t.price_paid), 0) AS revenue,
             ROUND(100 * SUM(CASE WHEN t.entered = 1 THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) AS attendance_rate
      FROM tickets_sold t
      WHERE t.event_id = ?${range.sql}
      GROUP BY t.ticket_type
      ORDER BY FIELD(t.ticket_type, 'anticipada', 'puerta', 'cortesia')
    `, [req.eventId, ...range.params]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/expenses-summary', auth(['admin']), requireEvent, async (req, res) => {
  try {
    const { start, end } = req.query;
    const range = dateRange('e.expense_date', start, end, true);
    const [rows] = await db.query(`
      SELECT e.category,
             COUNT(*) AS records,
             SUM(CASE WHEN e.status = 'paid' THEN e.amount ELSE 0 END) AS paid_amount,
             SUM(CASE WHEN e.status = 'pending' THEN e.amount ELSE 0 END) AS pending_amount,
             SUM(e.amount) AS total_amount
      FROM expenses e
      WHERE e.event_id = ?${range.sql}
      GROUP BY e.category
      ORDER BY total_amount DESC, e.category
    `, [req.eventId, ...range.params]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/sellers-summary', auth(['admin']), requireEvent, async (req, res) => {
  try {
    const { start, end } = req.query;
    const ordersRange = dateRange('created_at', start, end);
    const ticketsRange = dateRange('sold_at', start, end);
    const [rows] = await db.query(`
      SELECT movements.user_id,
             u.username, u.first_name, u.last_name,
             SUM(movements.product_operations) AS product_operations,
             SUM(movements.product_income) AS product_income,
             SUM(movements.tickets_sold) AS tickets_sold,
             SUM(movements.ticket_income) AS ticket_income,
             SUM(movements.product_income + movements.ticket_income) AS total_collected
      FROM (
        SELECT user_id, COUNT(*) AS product_operations, COALESCE(SUM(total), 0) AS product_income,
               0 AS tickets_sold, 0 AS ticket_income
        FROM orders WHERE event_id = ?${ordersRange.sql} GROUP BY user_id
        UNION ALL
        SELECT user_id, 0, 0, COUNT(*), COALESCE(SUM(price_paid), 0)
        FROM tickets_sold WHERE event_id = ?${ticketsRange.sql} GROUP BY user_id
      ) movements
      LEFT JOIN users u ON u.id = movements.user_id
      GROUP BY movements.user_id, u.username, u.first_name, u.last_name
      ORDER BY total_collected DESC
    `, [req.eventId, ...ordersRange.params, req.eventId, ...ticketsRange.params]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reporte: ventas por medio de pago (reemplaza usuario)
router.get('/sales-by-payment', auth(['admin']), requireEvent, async (req, res) => {
  try {
    const { start, end } = req.query; // fechas opcionales
    let sql = `SELECT o.payment_method,
      SUM(s.quantity * s.sale_price * (1 - IFNULL(d.percentage, 0) / 100)) as total_revenue,
      SUM(s.quantity * p.price_cost) as total_cost,
      SUM(s.quantity) as total_items_sold,
      (SUM(s.quantity * s.sale_price * (1 - IFNULL(d.percentage, 0) / 100)) - SUM(s.quantity * p.price_cost)) as profit
      FROM sales s
      INNER JOIN orders o ON s.order_id = o.id
      LEFT JOIN products p ON s.product_id = p.id
      LEFT JOIN discounts d ON o.discount_id = d.id
      WHERE o.event_id = ?`;

    const params = [req.eventId];
    if (start || end) {
      if (start) {
        sql += ' AND o.created_at >= ?';
        params.push(start + ' 00:00:00');
      }
      if (end) {
        sql += ' AND o.created_at <= ?';
        params.push(end + ' 23:59:59');
      }
    }

    sql += ' GROUP BY o.payment_method ORDER BY total_revenue DESC';
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Dashboard Stats: Totales históricos y Top Productos
router.get('/dashboard-stats', auth(['admin']), requireEvent, async (req, res) => {
  try {
    // Totales históricos
    const [totals] = await db.query(`
      SELECT 
        SUM(s.quantity * s.sale_price * (1 - IFNULL(d.percentage, 0) / 100)) as total_revenue,
        SUM(s.quantity * (s.sale_price * (1 - IFNULL(d.percentage, 0) / 100) - IFNULL(p.price_cost, 0))) as total_profit,
        COUNT(DISTINCT o.id) as total_orders
      FROM sales s
      INNER JOIN orders o ON s.order_id = o.id
      LEFT JOIN products p ON s.product_id = p.id
      LEFT JOIN discounts d ON o.discount_id = d.id
      WHERE o.event_id = ?
    `, [req.eventId]);

    // Top 5 productos más vendidos
    const [topProducts] = await db.query(`
      SELECT p.name, SUM(s.quantity) as total_qty
      FROM sales s
      INNER JOIN orders o ON s.order_id = o.id
      LEFT JOIN products p ON s.product_id = p.id
      WHERE o.event_id = ?
      GROUP BY p.id
      ORDER BY total_qty DESC
      LIMIT 5
    `, [req.eventId]);

    // Productos con stock bajo (ej. < 5)
    const [lowStockItems] = await db.query(`
      SELECT name, stock FROM products
      WHERE event_id = ? AND stock < 5
      ORDER BY stock ASC, name ASC
    `, [req.eventId]);

    // Personas que ingresaron hoy
    const [entriesToday] = await db.query(`
      SELECT COUNT(*) as count FROM tickets_sold 
      WHERE event_id = ? AND entered = 1
    `, [req.eventId]);

    // Ingresos por medio de pago: ventas de productos + entradas del evento.
    const [paymentIncomeRows] = await db.query(`
      SELECT payment_method,
             COALESCE(SUM(amount), 0) AS amount,
             COALESCE(SUM(operations), 0) AS operations
      FROM (
        SELECT payment_method, COALESCE(SUM(total), 0) AS amount, COUNT(*) AS operations
        FROM orders
        WHERE event_id = ?
        GROUP BY payment_method
        UNION ALL
        SELECT payment_method, COALESCE(SUM(price_paid), 0) AS amount, COUNT(*) AS operations
        FROM tickets_sold
        WHERE event_id = ? AND price_paid > 0
        GROUP BY payment_method
      ) AS event_income
      GROUP BY payment_method
    `, [req.eventId, req.eventId]);

    const paymentIncome = {
      cash: { amount: 0, operations: 0 },
      mercadopago: { amount: 0, operations: 0 }
    };
    paymentIncomeRows.forEach(row => {
      if (!paymentIncome[row.payment_method]) return;
      paymentIncome[row.payment_method] = {
        amount: Number(row.amount || 0),
        operations: Number(row.operations || 0)
      };
    });

    res.json({
      revenue: totals[0].total_revenue || 0,
      profit: totals[0].total_profit || 0,
      orders: totals[0].total_orders || 0,
      top_products: topProducts,
      low_stock_count: lowStockItems.length,
      low_stock_items: lowStockItems,
      entries_today: Number(entriesToday[0].count || 0),
      people_entered: Number(entriesToday[0].count || 0),
      payment_income: paymentIncome
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reporte: Detalle completo de ventas (para exportación y auditoría)
router.get('/sales-detail', auth(['admin']), requireEvent, async (req, res) => {
  try {
    const { start, end } = req.query;
    let sql = `SELECT 
        DATE_FORMAT(o.created_at, '%Y-%m-%d %H:%i') as fecha,
        o.id as orden_id,
        u.username as vendedor,
        o.payment_method as metodo_pago,
        p.name as producto,
        s.quantity as cantidad,
        p.price_cost as costo_unitario,
        s.sale_price as precio_unitario,
        IFNULL(d.percentage, 0) as descuento_porcentaje,
        IFNULL(d.name, '-') as descuento_detalle,
        (CASE WHEN order_gross.gross > 0
          THEN o.total * (s.quantity * s.sale_price) / order_gross.gross ELSE 0 END) as subtotal,
        (CASE WHEN order_gross.gross > 0
          THEN o.total * (s.quantity * s.sale_price) / order_gross.gross ELSE 0 END)
          - (s.quantity * IFNULL(p.price_cost, 0)) as ganancia
      FROM sales s
      INNER JOIN orders o ON s.order_id = o.id
      INNER JOIN (
        SELECT order_id, SUM(quantity * sale_price) AS gross
        FROM sales GROUP BY order_id
      ) order_gross ON order_gross.order_id = o.id
      LEFT JOIN products p ON s.product_id = p.id
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN discounts d ON o.discount_id = d.id
      WHERE o.event_id = ?`;

    const params = [req.eventId];
    if (start) { sql += ' AND o.created_at >= ?'; params.push(start + ' 00:00:00'); }
    if (end) { sql += ' AND o.created_at <= ?'; params.push(end + ' 23:59:59'); }

    sql += ' ORDER BY o.created_at DESC';

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reporte: Detalle de entradas (con vendedor)
router.get('/tickets-detail', auth(['admin']), requireEvent, async (req, res) => {
  try {
    const { start, end } = req.query;
    let sql = `SELECT 
        DATE_FORMAT(t.sold_at, '%Y-%m-%d %H:%i') as fecha,
        t.first_name, t.last_name, t.dni,
        u.username as vendedor,
        t.ticket_type,
        t.payment_method,
        t.price_paid,
        t.entered
      FROM tickets_sold t
      LEFT JOIN users u ON t.user_id = u.id
      WHERE t.event_id = ?`;

    const params = [req.eventId];
    if (start) { sql += ' AND t.sold_at >= ?'; params.push(start + ' 00:00:00'); }
    if (end) { sql += ' AND t.sold_at <= ?'; params.push(end + ' 23:59:59'); }

    sql += ' ORDER BY t.sold_at DESC';

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reporte: Resumen de Asistencia (Personas adentro)
router.get('/attendance-summary', auth(['admin']), requireEvent, async (req, res) => {
  try {
    const { start, end } = req.query;
    let sql = `SELECT 
        COALESCE(SUM(CASE WHEN ticket_type = 'anticipada' THEN 1 ELSE 0 END), 0) as anticipadas,
        COALESCE(SUM(CASE WHEN ticket_type = 'puerta' THEN 1 ELSE 0 END), 0) as puerta,
        COALESCE(SUM(CASE WHEN ticket_type = 'cortesia' THEN 1 ELSE 0 END), 0) as cortesias,
        COUNT(*) as total
      FROM tickets_sold 
      WHERE event_id = ? AND entered = 1`;
    const params = [req.eventId];
    if (start) { sql += ' AND entered_at >= ?'; params.push(start + ' 00:00:00'); }
    if (end) { sql += ' AND entered_at <= ?'; params.push(end + ' 23:59:59'); }

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reporte: Arqueo de caja de Entradas (Agrupado por medio de pago)
router.get('/tickets-by-payment', auth(['admin']), requireEvent, async (req, res) => {
  try {
    const { start, end } = req.query;
    let sql = `SELECT payment_method,
        SUM(price_paid) as total_revenue,
        COUNT(*) as total_count
      FROM tickets_sold WHERE event_id = ?`;
    const params = [req.eventId];
    if (start) { sql += ' AND sold_at >= ?'; params.push(start + ' 00:00:00'); }
    if (end) { sql += ' AND sold_at <= ?'; params.push(end + ' 23:59:59'); }

    sql += ' GROUP BY payment_method';
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reporte: Detalle de gastos del evento activo
router.get('/expenses-detail', auth(['admin']), requireEvent, async (req, res) => {
  try {
    const { start, end } = req.query;
    let sql = `SELECT
        DATE_FORMAT(e.expense_date, '%Y-%m-%d') AS fecha,
        e.description,
        e.category,
        e.supplier,
        e.amount,
        e.payment_method,
        e.status,
        u.username,
        u.first_name,
        u.last_name
      FROM expenses e
      LEFT JOIN users u ON e.user_id = u.id
      WHERE e.event_id = ?`;
    const params = [req.eventId];
    if (start) { sql += ' AND e.expense_date >= ?'; params.push(start); }
    if (end) { sql += ' AND e.expense_date <= ?'; params.push(end); }
    sql += ' ORDER BY e.expense_date DESC, e.id DESC';
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Compatibilidad: reporte histórico de aportes de socios
router.get('/partners-detail', auth(['admin']), requireEvent, async (req, res) => {
  try {
    const { start, end } = req.query;
    let sql = `SELECT 
        DATE_FORMAT(c.created_at, '%Y-%m-%d %H:%i') as fecha,
        u.username as socio,
        c.amount,
        c.description,
        c.returned
      FROM partner_contributions c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.event_id = ?`;

    const params = [req.eventId];
    if (start) { sql += ' AND c.created_at >= ?'; params.push(start + ' 00:00:00'); }
    if (end) { sql += ' AND c.created_at <= ?'; params.push(end + ' 23:59:59'); }

    sql += ' ORDER BY c.created_at DESC';
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
