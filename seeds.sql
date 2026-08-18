-- Seeds para usuarios (USO: INSERTAR contraseñas en texto plano tal como solicitaste)
USE cantina_db;

INSERT INTO users (username, password, role) VALUES
('admin', 'admin123', 'admin'),
('vendedor1', 'venta123', 'seller'),
('vendedor2', 'venta456', 'seller');

-- También puedes insertar más datos de ejemplo si lo deseas
