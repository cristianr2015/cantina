const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/authMiddleware');

// Reporte: ventas por medio de pago (reemplaza usuario)
router.get('/sales-by-payment', auth(['admin', 'seller']), async (req, res) => {
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
      LEFT JOIN discounts d ON o.discount_id = d.id`;

    const params = [];
    if (start || end) {
      sql += ' WHERE 1=1 ';
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
router.get('/dashboard-stats', auth(['admin', 'seller']), async (req, res) => {
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
    `);

    // Top 5 productos más vendidos
    const [topProducts] = await db.query(`
      SELECT p.name, SUM(s.quantity) as total_qty
      FROM sales s
      INNER JOIN orders o ON s.order_id = o.id
      LEFT JOIN products p ON s.product_id = p.id
      GROUP BY p.id
      ORDER BY total_qty DESC
      LIMIT 5
    `);

    // Productos con stock bajo (ej. < 5)
    const [lowStockItems] = await db.query(`
      SELECT name, stock FROM products WHERE stock < 5
    `);

    // Personas que ingresaron hoy
    const [entriesToday] = await db.query(`
      SELECT COUNT(*) as count FROM tickets_sold 
      WHERE entered = 1 AND DATE(entered_at) = CURDATE()
    `);

    res.json({
      revenue: totals[0].total_revenue || 0,
      profit: totals[0].total_profit || 0,
      orders: totals[0].total_orders || 0,
      top_products: topProducts,
      low_stock_count: lowStockItems.length,
      low_stock_items: lowStockItems,
      entries_today: entriesToday[0].count
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reporte: Detalle completo de ventas (para exportación y auditoría)
router.get('/sales-detail', auth(['admin', 'seller']), async (req, res) => {
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
      WHERE 1=1`;

    const params = [];
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
router.get('/tickets-detail', auth(['admin', 'seller']), async (req, res) => {
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
      WHERE 1=1`;

    const params = [];
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
router.get('/attendance-summary', auth(['admin', 'seller']), async (req, res) => {
  try {
    const { start, end } = req.query;
    let sql = `SELECT 
        COALESCE(SUM(CASE WHEN ticket_type = 'anticipada' THEN 1 ELSE 0 END), 0) as anticipadas,
        COALESCE(SUM(CASE WHEN ticket_type = 'puerta' THEN 1 ELSE 0 END), 0) as puerta,
        COALESCE(SUM(CASE WHEN ticket_type = 'cortesia' THEN 1 ELSE 0 END), 0) as cortesias,
        COUNT(*) as total
      FROM tickets_sold 
      WHERE entered = 1`;
    const params = [];
    if (start) { sql += ' AND entered_at >= ?'; params.push(start + ' 00:00:00'); }
    if (end) { sql += ' AND entered_at <= ?'; params.push(end + ' 23:59:59'); }

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reporte: Arqueo de caja de Entradas (Agrupado por medio de pago)
router.get('/tickets-by-payment', auth(['admin', 'seller']), async (req, res) => {
  try {
    const { start, end } = req.query;
    let sql = `SELECT payment_method,
        SUM(price_paid) as total_revenue,
        COUNT(*) as total_count
      FROM tickets_sold WHERE 1=1`;
    const params = [];
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
router.get('/partners-detail', auth(['admin', 'seller']), async (req, res) => {
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
      WHERE 1=1`;

    const params = [];
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
