-- Seeds para usuarios (USO: INSERTAR contraseñas en texto plano tal como solicitaste)
USE cantina_db;

INSERT INTO users (first_name, last_name, username, password, role) VALUES
('Administrador', 'Sistema', 'admin', 'admin123', 'admin')
ON DUPLICATE KEY UPDATE
  first_name = VALUES(first_name),
  last_name = VALUES(last_name),
  role = VALUES(role);

-- También puedes insertar más datos de ejemplo si lo deseas
