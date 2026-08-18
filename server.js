const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const productsRouter = require('./routes/products');
const eventsRouter = require('./routes/events');
const ticketsRouter = require('./routes/tickets');
const salesRouter = require('./routes/sales');
const reportsRouter = require('./routes/reports');
const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');
const settingsRouter = require('./routes/settings');
const partnersRouter = require('./routes/partners');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/products', productsRouter);
app.use('/api/events', eventsRouter);
app.use('/api/tickets', ticketsRouter);
app.use('/api/sales', salesRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/partners', partnersRouter);

app.get('/ping', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ ok: true, db: true });
  } catch (err) {
    res.status(500).json({ ok: false, db: false, error: err.message });
  }
});

app.get('/api/public-settings', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT company_name, logo_path FROM settings WHERE id = 1 LIMIT 1');
    res.json(rows[0] || { company_name: 'Mi Empresa', logo_path: null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Auto-fix: Verificar y crear columna image_path si falta
(async () => {
  try {
    await db.query("SELECT image_path FROM products LIMIT 1");
  } catch (err) {
    if (err.code === 'ER_BAD_FIELD_ERROR') {
      console.log("⚠️ Detectada falta de columna 'image_path'. Agregándola automáticamente...");
      await db.query("ALTER TABLE products ADD COLUMN image_path VARCHAR(255)");
      console.log("✅ Columna 'image_path' agregada con éxito.");
    }
  }
})();

// Auto-fix: Crear tabla orders y columna order_id si faltan (Migración a sistema de Carrito)
(async () => {
  try {
    await db.query("SELECT 1 FROM orders LIMIT 1");
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') {
      console.log("⚠️ Migrando a sistema de Órdenes...");
      await db.query(`CREATE TABLE IF NOT EXISTS orders (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT, total DECIMAL(10,2) NOT NULL DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
      await db.query(`ALTER TABLE sales ADD COLUMN order_id INT`);
      await db.query(`ALTER TABLE sales ADD FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE`);
      console.log("✅ Sistema de Órdenes configurado.");
    }
  }
})();

// Auto-fix: Agregar columna payment_method a orders
(async () => {
  try {
    await db.query("SELECT payment_method FROM orders LIMIT 1");
  } catch (err) {
    if (err.code === 'ER_BAD_FIELD_ERROR') {
      console.log("⚠️ Detectada falta de columna 'payment_method'. Agregándola...");
      await db.query("ALTER TABLE orders ADD COLUMN payment_method ENUM('cash','mercadopago') DEFAULT 'cash'");
      console.log("✅ Columna 'payment_method' agregada.");
    }
  }
})();

// Auto-fix: Crear tabla tickets_sold si falta
(async () => {
  try {
    await db.query("SELECT 1 FROM tickets_sold LIMIT 1");
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') {
      console.log("⚠️ Tabla 'tickets_sold' no existe. Creándola...");
      await db.query(`CREATE TABLE IF NOT EXISTS tickets_sold (
        id INT AUTO_INCREMENT PRIMARY KEY,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        dni VARCHAR(50) NOT NULL,
        payment_method ENUM('cash','mercadopago') DEFAULT 'cash',
        ticket_type ENUM('anticipada','puerta') DEFAULT 'anticipada',
        user_id INT,
        entered TINYINT(1) NOT NULL DEFAULT 0,
        sold_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        entered_at TIMESTAMP NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      )`);
      console.log("✅ Tabla 'tickets_sold' creada.");
    } else {
      // Si la tabla ya existe, verificamos si faltan las columnas nuevas
      try {
        await db.query("SELECT user_id FROM tickets_sold LIMIT 1");
      } catch (errCol) {
        if (errCol.code === 'ER_BAD_FIELD_ERROR') {
          console.log("⚠️ Agregando columna 'user_id' a 'tickets_sold'...");
          try {
            await db.query("ALTER TABLE tickets_sold ADD COLUMN user_id INT");
            await db.query("ALTER TABLE tickets_sold ADD CONSTRAINT fk_ticket_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL");
            console.log("✅ Columna 'user_id' y relación creadas con éxito.");
          } catch (e) {
            console.error("❌ Error al migrar 'user_id':", e.message);
          }
        }
      }
      // Asegurar también payment_method y ticket_type para tablas antiguas
      const cols = [
        { name: 'payment_method', def: "ENUM('cash','mercadopago') DEFAULT 'cash'" },
        { name: 'ticket_type', def: "ENUM('anticipada','puerta') DEFAULT 'anticipada'" }
      ];
      for (const col of cols) {
        try {
          await db.query(`SELECT ${col.name} FROM tickets_sold LIMIT 1`);
        } catch (err) {
          if (err.code === 'ER_BAD_FIELD_ERROR') {
            await db.query(`ALTER TABLE tickets_sold ADD COLUMN ${col.name} ${col.def}`);
            console.log(`✅ Columna '${col.name}' agregada a tickets_sold.`);
          }
        }
      }
    }
  }
})();

// Auto-fix: Agregar columna company_name a settings si falta
(async () => {
  try {
    await db.query("SELECT company_name FROM settings LIMIT 1");
  } catch (err) {
    if (err.code === 'ER_BAD_FIELD_ERROR') {
      console.log("⚠️ Detectada falta de columna 'company_name'. Agregándola...");
      await db.query("ALTER TABLE settings ADD COLUMN company_name VARCHAR(255)");
      console.log("✅ Columna 'company_name' agregada.");
    }
  }
})();

// Auto-fix: Crear tabla partner_contributions si falta
(async () => {
  try {
    await db.query("SELECT 1 FROM partner_contributions LIMIT 1");
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') {
      console.log("⚠️ Tabla 'partner_contributions' no existe. Creándola...");
      await db.query(`CREATE TABLE IF NOT EXISTS partner_contributions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        amount DECIMAL(10,2) NOT NULL,
        description TEXT,
        returned TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`);
      console.log("✅ Tabla 'partner_contributions' creada.");
    }
  }
})();

// Auto-fix: Crear tabla discounts si falta
(async () => {
  try {
    await db.query("SELECT 1 FROM discounts LIMIT 1");
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') {
      console.log("⚠️ Tabla 'discounts' no existe. Creándola...");
      await db.query(`CREATE TABLE IF NOT EXISTS discounts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);
      console.log("✅ Tabla 'discounts' creada.");
    }
  }
})();

// Auto-fix: Agregar columna discount_id a orders
(async () => {
  try {
    await db.query("SELECT discount_id FROM orders LIMIT 1");
  } catch (err) {
    if (err.code === 'ER_BAD_FIELD_ERROR') {
      console.log("⚠️ Agregando columna 'discount_id' a 'orders'...");
      await db.query("ALTER TABLE orders ADD COLUMN discount_id INT");
      await db.query("ALTER TABLE orders ADD CONSTRAINT fk_order_discount FOREIGN KEY (discount_id) REFERENCES discounts(id) ON DELETE SET NULL");
      console.log("✅ Columna 'discount_id' agregada.");
    }
  }
})();

// Auto-fix: Agregar columna stock a productos si falta
(async () => {
  try {
    await db.query("SELECT stock FROM products LIMIT 1");
  } catch (err) {
    if (err.code === 'ER_BAD_FIELD_ERROR') {
      await db.query("ALTER TABLE products ADD COLUMN stock INT DEFAULT 0");
    }
  }
})();

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
