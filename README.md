# Cantina / Bufet — Aplicación mínima

Pequeña app para administrar productos, ventas y eventos, y generar reportes de ventas por evento.

Requisitos
- Node.js 16+
- MySQL

Instalación

1. Clonar/abrir el proyecto y entrar en la carpeta del repo.
2. Instalar dependencias:

```bash
npm install
```

3. Crear la base de datos y tablas ejecutando `schema.sql` en tu servidor MySQL (por ejemplo con `mysql -u root -p < schema.sql`).

4. Configurar variables de entorno opcionales (o usar los valores por defecto):

- `DB_HOST` (por defecto `localhost`)
- `DB_USER` (por defecto `root`)
- `DB_PASSWORD` (por defecto ``)
- `DB_NAME` (por defecto `cantina_db`)
- `DB_PORT` (por defecto `3306`)

Puedes crear un archivo `.env` y usar `dotenv` si lo deseas (no incluido por defecto).

Ejecutar

```bash
npm start
# o en desarrollo
npm run dev
```

Abrir en el navegador: `http://localhost:3000`.

Archivos importantes
- [server.js](server.js#L1) : punto de entrada del servidor.
- [db.js](db.js#L1) : conexión con MySQL.
- [routes/products.js](routes/products.js#L1) : API productos.
- [routes/events.js](routes/events.js#L1) : API eventos.
- [routes/sales.js](routes/sales.js#L1) : API ventas.
- [routes/reports.js](routes/reports.js#L1) : Reportes (ventas por evento).
- [schema.sql](schema.sql#L1) : esquema y datos de ejemplo.
- [public/index.html](public/index.html#L1) : interfaz mínima.

Autenticación
- Endpoint de login: `POST /api/auth/login` con body `{ "username": "...", "password": "..." }`.
- Responde `{ token, user }` donde `token` es un JWT que debes enviar en el header `Authorization: Bearer <token>` para proteger rutas.

Seeds
- Archivo `seeds.sql` añade usuarios de ejemplo (contraseñas almacenadas en texto plano como solicitaste). Ejecuta:

```bash
mysql -u root -p < seeds.sql
```

Seguridad importante: almacenar contraseñas en texto plano es inseguro. Considerá usar hashing (bcrypt) en producción.

Frontend protegido
- La interfaz web ahora requiere login. Abre `http://localhost:3000` y autenticate con los usuarios del seed.
- El `admin` puede crear productos, eventos, asignar ventas a usuarios y ver reportes por evento y por usuario.
- Los `seller` pueden registrar ventas y ver sólo sus propias ventas.

Nuevo endpoint de reportes:
- `GET /api/reports/sales-by-user` (solo `admin`) — acepta `start` y `end` como query params YYYY-MM-DD y devuelve ventas agregadas por usuario.

Configuración
- Página de configuración en la interfaz (visible solo para `admin`): permite subir el logo de la empresa, guardar el `CUIT`, y crear/editar/eliminar usuarios.
- Endpoints:
	- `GET /api/settings` (admin) — obtener CUIT y logo.
	- `PUT /api/settings` (admin) — actualizar `{ cuit }`.
	- `POST /api/settings/logo` (admin) — subir archivo `logo` (multipart/form-data).



Siguientes pasos posibles
- Añadir autenticación/roles
- Control de stock
- Exportar reportes a CSV/PDF
- Mejorar UI/UX
