const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');
const { migrateEventScoping } = require('./lib/eventMigration');

const productsRouter = require('./routes/products');
const eventsRouter = require('./routes/events');
const ticketsRouter = require('./routes/tickets');
const salesRouter = require('./routes/sales');
const reportsRouter = require('./routes/reports');
const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');
const settingsRouter = require('./routes/settings');
const partnersRouter = require('./routes/partners');
const expensesRouter = require('./routes/expenses');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use(express.static(path.join(__dirname, 'public')));
app.use('/vendor/html5-qrcode', express.static(path.join(__dirname, 'node_modules', 'html5-qrcode')));

app.use('/api/products', productsRouter);
app.use('/api/events', eventsRouter);
app.use('/api/tickets', ticketsRouter);
app.use('/api/sales', salesRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/partners', partnersRouter);
app.use('/api/expenses', expensesRouter);

app.get('/ping', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ ok: true, db: true });
  } catch (err) {
    res.status(500).json({ ok: false, db: false, error: err.message });
  }
});

// Kubernetes: liveness verifica el proceso; readiness verifica también MySQL.
app.get('/health/live', (req, res) => {
  res.json({ ok: true });
});

app.get('/health/ready', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ ok: true, db: true });
  } catch (err) {
    res.status(503).json({ ok: false, db: false });
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

// Migracion idempotente: habilitar el rol limitado a operaciones de entradas.
(async () => {
  try {
    const [rows] = await db.query(`
      SELECT COLUMN_TYPE
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'users'
        AND COLUMN_NAME = 'role'
      LIMIT 1
    `);
    const columnType = rows[0]?.COLUMN_TYPE || '';
    if (!columnType.includes("'puerta'")) {
      await db.query("ALTER TABLE users MODIFY COLUMN role ENUM('admin','seller','puerta') NOT NULL DEFAULT 'seller'");
      console.log("Rol 'puerta' habilitado en la tabla users.");
    }
  } catch (err) {
    console.error("No se pudo habilitar el rol 'puerta':", err.message);
  }
})();

// Migracion idempotente: agregar nombre y apellido a las cuentas existentes.
const userProfileMigration = (async () => {
  const [columns] = await db.query(`
    SELECT COLUMN_NAME
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'users'
      AND COLUMN_NAME IN ('first_name', 'last_name')
  `);
  const existingColumns = new Set(columns.map(column => column.COLUMN_NAME));
  let migrated = false;
  if (!existingColumns.has('first_name')) {
    await db.query("ALTER TABLE users ADD COLUMN first_name VARCHAR(100) NOT NULL DEFAULT '' AFTER id");
    migrated = true;
  }
  if (!existingColumns.has('last_name')) {
    await db.query("ALTER TABLE users ADD COLUMN last_name VARCHAR(100) NOT NULL DEFAULT '' AFTER first_name");
    migrated = true;
  }
  if (migrated) {
    console.log('Nombre y apellido habilitados en la tabla users.');
  }
})();

// Migracion idempotente: convertir el rol unico existente en roles combinables.
const userRolesMigration = userProfileMigration.then(async () => {
  await db.query(`CREATE TABLE IF NOT EXISTS user_roles (
    user_id INT NOT NULL,
    role ENUM('admin','seller','puerta') NOT NULL,
    PRIMARY KEY (user_id, role),
    CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  await db.query('INSERT IGNORE INTO user_roles (user_id, role) SELECT id, role FROM users');
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
const legacyOrdersMigration = (async () => {
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
const orderPaymentMigration = legacyOrdersMigration.then(async () => {
  try {
    await db.query("SELECT payment_method FROM orders LIMIT 1");
  } catch (err) {
    if (err.code === 'ER_BAD_FIELD_ERROR') {
      console.log("⚠️ Detectada falta de columna 'payment_method'. Agregándola...");
      await db.query("ALTER TABLE orders ADD COLUMN payment_method ENUM('cash','mercadopago') DEFAULT 'cash'");
      console.log("✅ Columna 'payment_method' agregada.");
    }
  }
});

// Auto-fix: Crear tabla tickets_sold si falta
const legacyTicketMigration = (async () => {
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
        ticket_type ENUM('anticipada','puerta','cortesia') DEFAULT 'anticipada',
        price_paid DECIMAL(10,2) NOT NULL DEFAULT 0,
        qr_token CHAR(64) UNIQUE,
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
        { name: 'ticket_type', def: "ENUM('anticipada','puerta','cortesia') DEFAULT 'anticipada'" }
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
const legacySettingsMigration = (async () => {
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

// Migración idempotente del sistema de entradas: cortesías, precios y QR seguro.
const ticketingMigration = Promise.all([legacyTicketMigration, legacySettingsMigration]).then(async () => {
  try {
    await db.query(
      "ALTER TABLE tickets_sold MODIFY COLUMN ticket_type ENUM('anticipada','puerta','cortesia') DEFAULT 'anticipada'"
    );

    const ticketColumns = [
      { name: 'price_paid', definition: 'DECIMAL(10,2) NOT NULL DEFAULT 0' },
      { name: 'qr_token', definition: 'CHAR(64) NULL UNIQUE' }
    ];
    let priceColumnAdded = false;
    for (const column of ticketColumns) {
      const [rows] = await db.query(
        `SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tickets_sold' AND COLUMN_NAME = ?`,
        [column.name]
      );
      if (!rows.length) {
        await db.query(`ALTER TABLE tickets_sold ADD COLUMN ${column.name} ${column.definition}`);
        if (column.name === 'price_paid') priceColumnAdded = true;
      }
    }
    const [qrIndexes] = await db.query(
      `SELECT 1 FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tickets_sold'
         AND COLUMN_NAME = 'qr_token' AND NON_UNIQUE = 0`
    );
    if (!qrIndexes.length) {
      await db.query('ALTER TABLE tickets_sold ADD UNIQUE INDEX uq_tickets_qr_token (qr_token)');
    }

    const settingsColumns = [
      { name: 'address', definition: 'VARCHAR(255)' },
      { name: 'phone', definition: 'VARCHAR(100)' },
      { name: 'email', definition: 'VARCHAR(255)' },
      { name: 'ticket_price_advance', definition: 'DECIMAL(10,2) NOT NULL DEFAULT 10000' },
      { name: 'ticket_price_door', definition: 'DECIMAL(10,2) NOT NULL DEFAULT 12000' }
    ];
    for (const column of settingsColumns) {
      const [rows] = await db.query(
        `SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'settings' AND COLUMN_NAME = ?`,
        [column.name]
      );
      if (!rows.length) {
        await db.query(`ALTER TABLE settings ADD COLUMN ${column.name} ${column.definition}`);
      }
    }
    await db.query(
      `INSERT IGNORE INTO settings
        (id, cuit, company_name, logo_path, address, phone, email,
         ticket_price_advance, ticket_price_door)
       VALUES (1, '', 'Mi Empresa', NULL, '', '', '', 10000, 12000)`
    );

    if (priceColumnAdded) {
      await db.query(
        `UPDATE tickets_sold
         SET price_paid = CASE
           WHEN ticket_type = 'anticipada' THEN 10000
           WHEN ticket_type = 'puerta' THEN 12000
           ELSE 0
         END`
      );
    }
    const [withoutTokens] = await db.query(
      "SELECT id FROM tickets_sold WHERE ticket_type = 'anticipada' AND qr_token IS NULL"
    );
    for (const ticket of withoutTokens) {
      await db.query(
        'UPDATE tickets_sold SET qr_token = ? WHERE id = ? AND qr_token IS NULL',
        [crypto.randomBytes(32).toString('hex'), ticket.id]
      );
    }
    console.log('Sistema de entradas, precios y QR configurado.');
  } catch (err) {
    console.error('No se pudo migrar el sistema de entradas:', err.message);
  }
});

// Auto-fix: Crear tabla partner_contributions si falta
const legacyPartnerMigration = (async () => {
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
const legacyDiscountMigration = (async () => {
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
const orderDiscountMigration = Promise.all([legacyOrdersMigration, legacyDiscountMigration]).then(async () => {
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
});

// Auto-fix: Agregar columna stock a productos si falta
const productStockMigration = (async () => {
  try {
    await db.query("SELECT stock FROM products LIMIT 1");
  } catch (err) {
    if (err.code === 'ER_BAD_FIELD_ERROR') {
      await db.query("ALTER TABLE products ADD COLUMN stock INT DEFAULT 0");
    }
  }
})();

const baseEventScopingMigration = Promise.all([
  userRolesMigration,
  ticketingMigration,
  orderPaymentMigration,
  legacyPartnerMigration,
  orderDiscountMigration,
  productStockMigration
]).then(() => migrateEventScoping(db));

// La nueva gestión de gastos conserva los aportes históricos sin modificar su tabla original.
const eventScopingMigration = baseEventScopingMigration.then(async () => {
  await db.query(`CREATE TABLE IF NOT EXISTS expenses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    description VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL DEFAULT 'Otros',
    supplier VARCHAR(150),
    amount DECIMAL(10,2) NOT NULL,
    payment_method ENUM('cash','mercadopago','transfer') NOT NULL DEFAULT 'cash',
    status ENUM('paid','pending') NOT NULL DEFAULT 'paid',
    expense_date DATE NOT NULL,
    user_id INT,
    event_id INT NOT NULL,
    source_contribution_id INT UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE RESTRICT
  )`);

  await db.query(`
    INSERT IGNORE INTO expenses
      (description, category, amount, payment_method, status, expense_date,
       user_id, event_id, source_contribution_id, created_at)
    SELECT COALESCE(NULLIF(TRIM(description), ''), 'Registro histórico'),
           'Otros', amount, 'cash', IF(returned = 1, 'paid', 'pending'),
           DATE(created_at), user_id, event_id, id, created_at
    FROM partner_contributions
    WHERE event_id IS NOT NULL
  `);
  console.log('Gestión de gastos configurada y aportes históricos preservados.');
});

let server;
eventScopingMigration.then(() => {
  server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('No se pudo configurar el aislamiento por eventos:', err.message);
  process.exitCode = 1;
  setTimeout(() => process.exit(1), 1000).unref();
});

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} recibido; cerrando conexiones...`);
  if (!server) {
    try {
      await db.end();
    } finally {
      process.exit(0);
    }
    return;
  }
  server.close(async () => {
    try {
      await db.end();
    } finally {
      process.exit(0);
    }
  });
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
