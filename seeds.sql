-- Seeds para usuarios (USO: INSERTAR contraseñas en texto plano tal como solicitaste)
USE cantina_db;

INSERT INTO users (first_name, last_name, username, password, role, company_id) VALUES
('Administrador', 'Sistema', 'admin', 'admin123', 'admin', 1)
ON DUPLICATE KEY UPDATE
  first_name = VALUES(first_name),
  last_name = VALUES(last_name),
  role = VALUES(role);

INSERT IGNORE INTO user_roles (user_id, role)
SELECT id, 'admin' FROM users WHERE username = 'admin' AND company_id = 1;

-- También puedes insertar más datos de ejemplo si lo deseas
