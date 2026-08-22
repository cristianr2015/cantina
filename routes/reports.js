const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/authMiddleware');
const { requireEvent } = require('../middleware/eventContext');

// Reporte: ventas por medio de pago (reemplaza usuario)
router.get('/sales-by-payment', auth(['admin', 'seller']), requireEvent, async (req, res) => {
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
router.get('/dashboard-stats', auth(['admin', 'seller']), requireEvent, async (req, res) => {
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
router.get('/sales-detail', auth(['admin', 'seller']), requireEvent, async (req, res) => {
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
        (s.quantity * s.sale_price * (1 - IFNULL(d.percentage, 0) / 100)) as subtotal,
        (s.quantity * (s.sale_price * (1 - IFNULL(d.percentage, 0) / 100) - IFNULL(p.price_cost, 0))) as ganancia
      FROM sales s
      INNER JOIN orders o ON s.order_id = o.id
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
router.get('/tickets-detail', auth(['admin', 'seller']), requireEvent, async (req, res) => {
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
router.get('/attendance-summary', auth(['admin', 'seller']), requireEvent, async (req, res) => {
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
router.get('/tickets-by-payment', auth(['admin', 'seller']), requireEvent, async (req, res) => {
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

// Reporte: Detalle de Aportes de Socios
router.get('/partners-detail', auth(['admin', 'seller']), requireEvent, async (req, res) => {
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
