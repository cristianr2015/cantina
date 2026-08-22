const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/authMiddleware');
const { requireEvent } = require('../middleware/eventContext');

router.post('/', auth(['admin','seller']), requireEvent, async (req, res) => {
  try {
    // Ahora esperamos un objeto con { items: [{product_id, quantity}], user_id (opcional) }
    const { items, user_id: bodyUserId, payment_method, discount_id } = req.body;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'El carrito está vacío' });
    }

    // associate sale to user: sellers automatically use their own id; admin can specify user_id optionally
    let user_id = req.user && req.user.id ? req.user.id : null;
    if (req.user && req.user.role === 'admin' && bodyUserId) {
      user_id = bodyUserId;
    }

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // Buscar porcentaje de descuento si existe
      let discountPct = 0;
      if (discount_id) {
        const [drows] = await connection.query(
          'SELECT percentage FROM discounts WHERE id = ? AND event_id = ?',
          [discount_id, req.eventId]
        );
        if (!drows[0]) throw new Error('El descuento no pertenece al evento activo');
        discountPct = parseFloat(drows[0].percentage);
      }

      // 1. Crear la Orden (Cabecera)
      const [orderResult] = await connection.query(
        'INSERT INTO orders (user_id, payment_method, discount_id, event_id, created_at) VALUES (?, ?, ?, ?, NOW())',
        [user_id, payment_method || 'cash', discount_id || null, req.eventId]
      );
      const orderId = orderResult.insertId;

      let subtotalOrder = 0;

      // 2. Insertar items y validar stock
      for (const item of items) {
        const [prows] = await connection.query(
          'SELECT price_sale, stock, name FROM products WHERE id = ? AND event_id = ? FOR UPDATE',
          [item.product_id, req.eventId]
        );
        if (!prows[0]) throw new Error(`Producto no encontrado: ${item.product_id}`);
        
        const product = prows[0];
        const qty = Number.parseInt(item.quantity, 10) || 1;
        if (qty < 1 || Number(product.stock) < qty) {
          throw new Error(`Stock insuficiente para ${product.name}`);
        }

        // Descontar stock
        await connection.query(
          'UPDATE products SET stock = stock - ? WHERE id = ? AND event_id = ?',
          [qty, item.product_id, req.eventId]
        );

        // Registrar venta
        await connection.query(
          'INSERT INTO sales (order_id, product_id, user_id, event_id, quantity, sale_price, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
          [orderId, item.product_id, user_id, req.eventId, qty, product.price_sale]
        );
        subtotalOrder += (product.price_sale * qty);
      }

      const totalFinal = subtotalOrder * (1 - (discountPct / 100));

      // 3. Actualizar total final
      await connection.query('UPDATE orders SET total = ? WHERE id = ?', [totalFinal, orderId]);

      await connection.commit();
      res.json({ ok: true, order_id: orderId, total: totalFinal });
    } catch (err) {
      await connection.rollback();
      res.status(400).json({ error: err.message });
    } finally {
      connection.release();
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', auth(['admin','seller']), requireEvent, async (req, res) => {
  try {
    // Seleccionamos Órdenes y concatenamos los productos para mostrar un resumen
    let sql = `SELECT o.id, o.total, o.payment_method, o.created_at, u.username as sold_by,
               GROUP_CONCAT(CONCAT(s.quantity, 'x ', p.name) SEPARATOR ', ') as items_summary
               FROM orders o
               LEFT JOIN sales s ON s.order_id = o.id
               LEFT JOIN products p ON s.product_id = p.id
               LEFT JOIN users u ON o.user_id = u.id`;
    
    const params = [req.eventId];
    sql += ' WHERE o.event_id = ?';
    if (req.user && req.user.role === 'seller') {
      sql += ' AND o.user_id = ?';
      params.push(req.user.id);
    }
    sql += ' GROUP BY o.id ORDER BY o.created_at DESC';
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', auth(['admin']), requireEvent, async (req, res) => {
  try {
    // Aseguramos borrado manual de items por si falla la cascada
    await db.query('DELETE FROM sales WHERE order_id = ? AND event_id = ?', [req.params.id, req.eventId]);
    const [result] = await db.query('DELETE FROM orders WHERE id = ? AND event_id = ?', [req.params.id, req.eventId]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Orden no encontrada' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', auth(['admin']), requireEvent, async (req, res) => {
  try {
    const { total, payment_method } = req.body;
    const [result] = await db.query(
      'UPDATE orders SET total = ?, payment_method = ? WHERE id = ? AND event_id = ?',
      [total, payment_method, req.params.id, req.eventId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Orden no encontrada' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
