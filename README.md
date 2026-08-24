### SI TE RESULTA ÚTIL PODÉS APOYAR EL DESARROLLO Y LA CONTINUIDAD DE ESTE PROYECTO MEDIANTE GITHUB SPONSORS

# EventGes

Aplicación Node.js/Express para administrar eventos, productos, ventas, entradas, gastos y reportes. Usa MySQL y sirve el frontend desde `public/`.

## Desarrollo local

Requisitos: Node.js 24 y MySQL 8.

```powershell
Copy-Item .env.example .env
npm ci
mysql -u root -p < schema.sql
npm start
```

La aplicación queda disponible en `http://localhost:3000`. El proyecto no carga `.env` automáticamente: las variables deben exportarse o inyectarse desde el entorno de ejecución.

Variables principales:

| Variable | Descripción |
|---|---|
| `NODE_ENV` | Usar `production` en Azure. |
| `PORT` | Puerto HTTP; App Service lo proporciona durante la ejecución. |
| `DB_HOST` | Host de MySQL. |
| `DB_PORT` | Puerto de MySQL, normalmente `3306`. |
| `DB_NAME` | Nombre de la base, por defecto `cantina_db`. |
| `DB_USER` | Usuario de MySQL. |
| `DB_PASSWORD` | Contraseña de MySQL. |
| `DB_SSL` | Establecer `true` cuando MySQL requiera TLS. |
| `DB_SSL_CA_BASE64` | Certificado CA en Base64, si corresponde. |
| `JWT_SECRET` | Secreto largo y aleatorio; es obligatorio en producción. |
| `LICENSE_INSTALLATION_ID` | UUID único de la instalación o slot al que se vinculan las licencias. |
| `LICENSE_SIGNING_SECRET` | Secreto aleatorio de al menos 32 caracteres usado para firmar y validar licencias. |

Endpoints operativos:

- `GET /health/live`: confirma que el proceso está activo.
- `GET /health/ready`: confirma que la aplicación puede consultar MySQL.
- `GET /ping`: endpoint de compatibilidad con comprobación de base de datos.

## Funcionalidad principal

Roles de la aplicación:

- `admin`: acceso completo y administración de usuarios.
- `seller`: ventas de cantina, entradas y consultas operativas.
- `puerta`: operaciones de entradas y control de ingreso.

Entradas y control de ingreso:

- Tipos disponibles: anticipada, en puerta y cortesía.
- Los precios de anticipada y puerta se administran por evento desde Configuración; cortesía siempre vale cero.
- Cada venta conserva su valor histórico aunque luego cambien los precios.
- Las anticipadas generan un PDF con un QR único por entrada.
- El primer escaneo registra el ingreso y los intentos posteriores se rechazan.
- El comprobante usa el nombre, CUIT, dirección, teléfono, correo y logo configurados para la peña.

Licencias:

- `free`: habilita Dashboard, Registrar venta, venta de entradas en puerta, Configuración y la pantalla para solicitar Pro.
- `pro` (almacenada internamente como `full`): habilita todas las funciones de la aplicación.
- Una instalación nueva activa automáticamente su licencia `free` sin vencimiento.
- Cada clave está vinculada a un `LICENSE_INSTALLATION_ID` y puede activarse una sola vez.
- Las licencias Pro pueden emitirse por un año (`1y`), tres años (`3y`) o sin vencimiento (`forever`).
- Sin una licencia vigente, un administrador solamente puede ingresar a Configuración para instalar una nueva clave.

Para emitir una licencia desde un entorno seguro que tenga el secreto de firma:

```powershell
$env:LICENSE_SIGNING_SECRET = '<secreto-seguro>'
npm run license:create -- --type pro --duration 1y --installation <uuid-de-la-instalacion>
npm run license:create -- --type pro --duration 3y --installation <uuid-de-la-instalacion>
npm run license:create -- --type pro --duration forever --installation <uuid-de-la-instalacion>
```

La clave generada se instala en `Configuración > Licencia de la aplicación`. El secreto de firma nunca debe entregarse al cliente ni guardarse en el repositorio.

## Despliegue en Azure App Service

La aplicación se publica exclusivamente en Azure App Service mediante dos flujos separados:

- `.github/workflows/main_app-pena.yml`: `main` publica en el slot `Production`.
- `.github/workflows/testing_app-pena.yml`: `testing` publica en el slot `testing`.

Cada push a cualquiera de esas ramas ejecuta este proceso en su slot correspondiente:

1. Instala Node.js 24 y las dependencias.
2. Ejecuta la compilación, si existe, y todas las pruebas.
3. Genera el artefacto de la aplicación.
4. Inicia sesión en Azure mediante OpenID Connect.
5. Publica el artefacto en la aplicación `APP-Pena`, slot `Production`.

El workflow utiliza estos secretos del repositorio, generados para la conexión federada de App Service:

- `AZUREAPPSERVICE_CLIENTID_98FF59D384B946B186988DCCCFC0A473`
- `AZUREAPPSERVICE_TENANTID_DF18F91A28354D2A97D89B9E38DC1A5B`
- `AZUREAPPSERVICE_SUBSCRIPTIONID_2820691C02AD494A823B83EB733556FF`

Las variables de la aplicación y de MySQL deben configurarse en Azure Portal, dentro de `APP-Pena > Configuración > Variables de entorno`. No deben guardarse contraseñas reales en el repositorio.

El trabajo diario se realiza en `testing`. Para publicar una actualización de prueba:

```powershell
git add <archivos>
git commit -m "Descripción del cambio"
git push origin testing
```

El estado de la publicación se consulta en GitHub Actions. Una vez finalizada, conviene verificar `/health/live` y `/health/ready` en la URL del slot. La rama `main` y Producción sólo deben actualizarse mediante una promoción deliberada desde `testing`.

## Base de datos en Azure

`infra/mysql-flexible-server.bicep` contiene una plantilla para Azure Database for MySQL Flexible Server. `infra/mysql-vm.bicep` y `scripts/configure-mysql-vm.sh` permiten la alternativa existente basada en una VM con integración privada hacia App Service.

La estructura inicial se encuentra en `schema.sql` y los datos iniciales en `seeds.sql`. Antes de cambiar la infraestructura de datos se debe conservar una copia de seguridad verificable.

## Contenedor opcional

El `Dockerfile` se conserva para desarrollo, pruebas o un posible App Service basado en contenedor. No forma parte del workflow de publicación actual.

```powershell
docker build -t cantina:local .
docker run --rm -p 3000:3000 `
  -e NODE_ENV=production `
  -e DB_HOST=host.docker.internal `
  -e DB_USER=root `
  -e DB_PASSWORD=secret `
  -e DB_NAME=cantina_db `
  -e JWT_SECRET=un-valor-largo-y-aleatorio `
  cantina:local
```

La imagen usa Node.js 24, instala sólo dependencias de producción y se ejecuta como usuario sin privilegios.

## Seguridad y operación

- Mantener `JWT_SECRET` y las credenciales de MySQL exclusivamente en las variables seguras de App Service.
- Configurar HTTPS obligatorio en App Service.
- Respaldar MySQL y probar periódicamente la restauración.
- Los archivos subidos deben almacenarse en un volumen persistente o en Azure Blob Storage antes de escalar a varias instancias.
- El modelo heredado de contraseñas de usuarios debe migrarse a Argon2 o bcrypt antes de exponer datos sensibles.
