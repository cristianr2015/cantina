-- Esquema para la aplicación Cantina/Bufet
CREATE DATABASE IF NOT EXISTS cantina_db;
USE cantina_db;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL DEFAULT '',
  last_name VARCHAR(100) NOT NULL DEFAULT '',
  username VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin','seller','puerta') NOT NULL DEFAULT 'seller',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id INT NOT NULL,
  role ENUM('admin','seller','puerta') NOT NULL,
  PRIMARY KEY (user_id, role),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  date DATETIME,
  ticket_price_advance DECIMAL(10,2) NOT NULL DEFAULT 10000,
  ticket_price_door DECIMAL(10,2) NOT NULL DEFAULT 12000,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  price_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  price_sale DECIMAL(10,2) NOT NULL DEFAULT 0,
  profit_pct DECIMAL(6,2) DEFAULT 0,
  stock INT NOT NULL DEFAULT 0,
  image_path VARCHAR(255),
  event_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS tickets_sold (
  id INT AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  dni VARCHAR(50) NOT NULL,
  payment_method ENUM('cash','mercadopago') DEFAULT 'cash',
  ticket_type ENUM('anticipada','puerta','cortesia') DEFAULT 'anticipada',
  price_paid DECIMAL(10,2) NOT NULL DEFAULT 0,
  qr_token CHAR(64) UNIQUE,
  user_id INT,
  event_id INT,
  entered TINYINT(1) NOT NULL DEFAULT 0,
  sold_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  entered_at TIMESTAMP NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS discounts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
  event_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  payment_method ENUM('cash','mercadopago') DEFAULT 'cash',
  discount_id INT,
  event_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (discount_id) REFERENCES discounts(id) ON DELETE SET NULL,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS sales (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT,
  product_id INT NOT NULL,
  user_id INT,
  event_id INT,
  quantity INT NOT NULL DEFAULT 1,
  sale_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE RESTRICT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS partner_contributions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  amount DECIMAL(10,2) NOT NULL,
  description TEXT,
  returned TINYINT(1) DEFAULT 0,
  event_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS expenses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  description VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL DEFAULT 'Otros',
  supplier VARCHAR(150),
  amount DECIMAL(10,2) NOT NULL,
  payment_method ENUM('cash','mercadopago','transfer') NOT NULL DEFAULT 'cash',
  status ENUM('paid','pending') NOT NULL DEFAULT 'pending',
  expense_date DATE NOT NULL,
  user_id INT,
  event_id INT NOT NULL,
  source_contribution_id INT UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS license_activations (
  activation_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  license_id CHAR(36) NOT NULL UNIQUE,
  installation_id CHAR(36) NOT NULL,
  license_type ENUM('free','full') NOT NULL,
  activated_at DATETIME NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_license_installation (installation_id, activation_id),
  INDEX idx_license_expiry (expires_at)
);

-- Datos de ejemplo
INSERT INTO events (name, date) VALUES
('Partido vs Rival', TIMESTAMP(CURDATE(), '20:00:00')),
('Evento Corporativo', TIMESTAMP(DATE_ADD(CURDATE(), INTERVAL 7 DAY), '20:00:00'));

INSERT INTO products (name, price_cost, price_sale, profit_pct, event_id) VALUES
('Bebida Cola 500ml', 0.80, 1.50, ((1.50-0.80)/0.80)*100, 1),
('Choripán', 1.50, 3.50, ((3.50-1.50)/1.50)*100, 1),
('Sándwich de jamón', 1.00, 2.50, ((2.50-1.00)/1.00)*100, 1);

-- Tabla de configuración global (un solo registro)
CREATE TABLE IF NOT EXISTS settings (
  id INT PRIMARY KEY DEFAULT 1,
  cuit VARCHAR(50),
  company_name VARCHAR(255),
  logo_path VARCHAR(255),
  address VARCHAR(255),
  phone VARCHAR(100),
  email VARCHAR(255),
  ticket_price_advance DECIMAL(10,2) NOT NULL DEFAULT 10000,
  ticket_price_door DECIMAL(10,2) NOT NULL DEFAULT 12000,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO settings (
  id, cuit, company_name, logo_path, address, phone, email,
  ticket_price_advance, ticket_price_door
) VALUES (1, '', 'Mi Empresa', NULL, '', '', '', 10000, 12000);
