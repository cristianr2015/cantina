async function columnExists(db, table, column) {
  const [rows] = await db.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows.length > 0;
}

async function addColumn(db, table, column, definition) {
  if (await columnExists(db, table, column)) return false;
  await db.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  return true;
}

async function addEventIndex(db, table) {
  const [rows] = await db.query(
    `SELECT 1 FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
       AND COLUMN_NAME = 'event_id' AND SEQ_IN_INDEX = 1`,
    [table]
  );
  if (!rows.length) {
    await db.query(`ALTER TABLE \`${table}\` ADD INDEX \`idx_${table}_event\` (\`event_id\`)`);
  }
}

async function addEventForeignKey(db, table) {
  const [rows] = await db.query(
    `SELECT 1
     FROM information_schema.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
       AND COLUMN_NAME = 'event_id' AND REFERENCED_TABLE_NAME = 'events'`,
    [table]
  );
  if (!rows.length) {
    await db.query(
      `ALTER TABLE \`${table}\` ADD CONSTRAINT \`fk_${table}_event\`
       FOREIGN KEY (\`event_id\`) REFERENCES \`events\`(\`id\`) ON DELETE RESTRICT`
    );
  }
}

async function getDefaultTicketPrices(db) {
  const [rows] = await db.query(
    'SELECT ticket_price_advance, ticket_price_door FROM settings WHERE id = 1 LIMIT 1'
  );
  return {
    advance: Number(rows[0]?.ticket_price_advance || 10000),
    door: Number(rows[0]?.ticket_price_door || 12000)
  };
}

async function createMigrationEvent(db, name) {
  const prices = await getDefaultTicketPrices(db);
  const [result] = await db.query(
    `INSERT INTO events (name, date, ticket_price_advance, ticket_price_door)
     VALUES (?, NOW(), ?, ?)`,
    [name, prices.advance, prices.door]
  );
  return result.insertId;
}

async function migrateEventScoping(db) {
  await db.query(`CREATE TABLE IF NOT EXISTS events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    date DATETIME NULL,
    ticket_price_advance DECIMAL(10,2) NOT NULL DEFAULT 10000,
    ticket_price_door DECIMAL(10,2) NOT NULL DEFAULT 12000,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  const [dateColumns] = await db.query(
    `SELECT DATA_TYPE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'events' AND COLUMN_NAME = 'date'`
  );
  if (dateColumns[0] && dateColumns[0].DATA_TYPE !== 'datetime') {
    await db.query('ALTER TABLE events MODIFY COLUMN date DATETIME NULL');
  }

  const advanceAdded = await addColumn(
    db, 'events', 'ticket_price_advance', 'DECIMAL(10,2) NOT NULL DEFAULT 10000'
  );
  const doorAdded = await addColumn(
    db, 'events', 'ticket_price_door', 'DECIMAL(10,2) NOT NULL DEFAULT 12000'
  );
  if (advanceAdded || doorAdded) {
    const prices = await getDefaultTicketPrices(db);
    await db.query(
      'UPDATE events SET ticket_price_advance = ?, ticket_price_door = ?',
      [prices.advance, prices.door]
    );
  }

  const scopedTables = ['products', 'orders', 'sales', 'tickets_sold', 'partner_contributions', 'discounts'];
  for (const table of scopedTables) {
    await addColumn(db, table, 'event_id', 'INT NULL');
  }

  let hasUnscopedData = false;
  for (const table of scopedTables) {
    const [rows] = await db.query(`SELECT COUNT(*) AS total FROM \`${table}\` WHERE event_id IS NULL`);
    if (Number(rows[0]?.total || 0) > 0) hasUnscopedData = true;
  }

  if (hasUnscopedData) {
    const [legacyEvents] = await db.query(
      "SELECT id FROM events WHERE name = 'Datos anteriores' ORDER BY id LIMIT 1"
    );
    const legacyEventId = legacyEvents[0]?.id || await createMigrationEvent(db, 'Datos anteriores');

    for (const table of scopedTables) {
      await db.query(`UPDATE \`${table}\` SET event_id = ? WHERE event_id IS NULL`, [legacyEventId]);
    }
  }

  const [eventCount] = await db.query('SELECT COUNT(*) AS total FROM events');
  if (Number(eventCount[0]?.total || 0) === 0) {
    await createMigrationEvent(db, 'Evento inicial');
  }

  for (const table of scopedTables) {
    await addEventIndex(db, table);
    await addEventForeignKey(db, table);
  }

  console.log('Eventos y aislamiento de datos configurados.');
}

module.exports = { migrateEventScoping };
