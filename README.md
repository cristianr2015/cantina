# Cantina / Bufet

Aplicacion Node.js/Express para administrar productos, ventas, entradas, socios y eventos. Usa MySQL y sirve el frontend desde `public/`.

## Desarrollo local

Requisitos: Node.js 24 y MySQL 8.

```powershell
Copy-Item .env.example .env
npm ci
mysql -u root -p < schema.sql
npm start
```

La aplicacion queda disponible en `http://localhost:3000`. El proyecto no carga `.env` automaticamente: hay que exportar esas variables o inyectarlas desde el entorno de ejecucion.

Endpoints operativos:

- `GET /health/live`: confirma que el proceso esta vivo.
- `GET /health/ready`: confirma que la aplicacion puede consultar MySQL.
- `GET /ping`: endpoint de compatibilidad con chequeo de base de datos.

Roles de la aplicacion:

- `admin`: acceso completo y administracion de usuarios.
- `seller`: ventas de cantina, entradas y consultas operativas.
- `puerta`: acceso exclusivo a las operaciones de entradas; las ventas quedan asociadas automaticamente a su usuario.

## Entradas y control de ingreso

- Tipos disponibles: anticipada, en puerta y cortesia.
- Los precios de anticipada y puerta se administran en `Configuracion > Precios de Entradas`; cortesia siempre vale cero.
- El valor queda guardado en cada venta para que los reportes historicos no cambien al actualizar precios.
- Al registrar anticipadas, el sistema genera un PDF imprimible con una pagina y un QR unico por entrada.
- El lector de puerta valida el token en el servidor. El primer escaneo registra el ingreso y cualquier intento posterior se rechaza como entrada ya utilizada.
- Nombre, CUIT, direccion, telefono, correo y logo de la pena se toman de Configuracion para armar el PDF.

## Contenedor

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

La imagen usa Node.js 24, instala solo dependencias de produccion y se ejecuta como usuario sin privilegios.

## Arquitectura en Azure

El despliegue automatizado crea y usa:

- AKS con identidad administrada, Microsoft Entra ID, Azure RBAC y cuentas locales deshabilitadas.
- Azure Container Registry (ACR) privado para las imagenes.
- Application Routing de AKS como Ingress NGINX administrado.
- Identidad administrada dedicada a GitHub Actions con federacion OIDC, sin client secret ni kubeconfig permanente.
- Rol `AcrPush` sobre ACR, acceso de usuario al AKS y rol `AKS RBAC Writer` limitado al namespace `cantina`.
- Azure Disk mediante PVC para MySQL y uploads.

El script usa por defecto el tier gratuito de administracion de AKS, un nodo `Standard_D2s_v5`, autoscaling de 1 a 3 nodos y ACR Basic. Los nodos, discos, IP publica y ACR generan cargos en Azure.

## Aprovisionar AKS y conectar GitHub

Requisitos en Windows:

- Azure CLI.
- GitHub CLI (`winget install --id GitHub.cli`).
- Permisos de Azure para crear recursos y asignar roles, normalmente `Owner` o `Contributor` junto con `User Access Administrator`.

Iniciar sesion y ejecutar el aprovisionamiento idempotente:

```powershell
az login
gh auth login
.\scripts\provision-aks.ps1 -ConfigureGitHub
```

Valores predeterminados:

| Recurso | Valor |
|---|---|
| Repositorio | `cristianr2015/pena` |
| Region | `brazilsouth` |
| Resource group | `rg-pena-prod` |
| AKS | `aks-pena-prod` |
| Identidad de CI/CD | `id-github-pena-cd` |
| GitHub environment | `production` |

Se pueden sobrescribir, por ejemplo:

```powershell
.\scripts\provision-aks.ps1 `
  -GitHubRepository 'cristianr2015/pena' `
  -SubscriptionId '<subscription-id>' `
  -Location 'brazilsouth' `
  -ResourceGroup 'rg-pena-prod' `
  -AksCluster 'aks-pena-prod' `
  -AcrName 'un-nombre-globalmente-unico' `
  -NodeVmSize 'Standard_D2s_v5' `
  -ConfigureGitHub
```

`-ConfigureGitHub` crea el environment, configura los identificadores de Azure, genera secretos de aplicacion aleatorios solo si todavia no existen y copia la contrasena inicial del administrador al portapapeles sin imprimirla. Volver a ejecutar el script no rota secretos existentes ni recrea los recursos.

Si se omite `-ConfigureGitHub`, el script muestra los valores que deben cargarse en GitHub. Tambien se puede ejecutar `scripts/configure-github.ps1` por separado con esos valores.

## CI/CD

El unico workflow es `.github/workflows/ci-cd.yml`:

1. En cada pull request y push ejecuta `npm ci`, tests, auditoria de dependencias, render de Kustomize y build de Docker sin publicar.
2. En `main`, GitHub obtiene un token temporal de Azure mediante OIDC.
3. Publica `cantina:<commit-sha>` y `cantina:latest` en ACR.
4. Obtiene credenciales temporales de AKS, aplica los secretos y manifiestos, y espera los rollouts de MySQL y la aplicacion.

El environment `production` contiene:

| Nombre | Tipo |
|---|---|
| `AZURE_CLIENT_ID` | Secret |
| `AZURE_TENANT_ID` | Secret |
| `AZURE_SUBSCRIPTION_ID` | Secret |
| `DB_PASSWORD` | Secret |
| `MYSQL_ROOT_PASSWORD` | Secret |
| `JWT_SECRET` | Secret |
| `ADMIN_USERNAME` | Secret |
| `ADMIN_PASSWORD` | Secret |
| `AZURE_RESOURCE_GROUP` | Variable |
| `AZURE_AKS_CLUSTER` | Variable |
| `AZURE_ACR_NAME` | Variable |
| `APP_HOST` | Variable opcional |

## Despliegue y actualizaciones manuales

Si GitHub Actions no esta disponible, se puede desplegar directamente desde una terminal autenticada. El script construye la imagen local, la publica en ACR con el SHA del commit, obtiene acceso temporal a AKS, aplica Kubernetes, espera los rollouts y retira el acceso temporal.

Requisitos:

```powershell
az login
docker version
```

Confirmar primero los cambios para que la imagen sea trazable y ejecutar:

```powershell
git add <archivos>
git commit -m "Descripcion del cambio"
git push origin main
.\scripts\deploy-aks-manual.ps1
```

En la primera ejecucion genera los secretos, los guarda en Kubernetes y sincroniza GitHub si `gh` esta autenticado. La contrasena inicial de `admin` se copia al portapapeles sin imprimirse. En actualizaciones posteriores reutiliza el Secret existente y no rota la clave de MySQL.

Con un dominio configurado:

```powershell
.\scripts\deploy-aks-manual.ps1 -AppHost 'cantina.midominio.com'
```

El despliegue identifica al usuario desde el claim `oid` del token ARM de Azure CLI, sin consultar Microsoft Graph. Esto evita que una politica de Acceso Condicional o CAE interrumpa el proceso con `InteractionRequired` despues de publicar la imagen. Si la identidad usada no emite ese claim, se puede indicar explicitamente:

```powershell
.\scripts\deploy-aks-manual.ps1 `
  -AppHost 'cantina.midominio.com' `
  -AzurePrincipalObjectId '<object-id-de-la-identidad>'
```

Aunque el deployment sea manual, conviene conservar `.github/workflows/ci-cd.yml` deshabilitado para poder reactivarlo cuando la facturacion de GitHub vuelva a estar disponible.

Cuando GitHub vuelva a estar habilitado, reactivar y disparar CI/CD manualmente:

```powershell
gh workflow enable ci-cd.yml --repo cristianr2015/pena
gh workflow run ci-cd.yml --repo cristianr2015/pena --ref main
```

Sin `APP_HOST`, el Ingress acepta cualquier host y se puede probar por la IP publica. Con dominio, pasar `-AppHost 'cantina.midominio.com'` y crear un registro DNS `A` hacia la IP del Ingress.

## Kubernetes local

`k8s/base` contiene la aplicacion, MySQL 8.4, almacenamiento persistente, probes y servicios. `k8s/overlays/production` agrega el Ingress de AKS; `k8s/overlays/local` publica la app y MySQL solo para Docker Desktop.

Con Kubernetes de Docker Desktop habilitado:

```powershell
.\scripts\deploy-local-k8s.ps1
```

La aplicacion queda en `http://localhost:3000` y MySQL en `127.0.0.1:3307`. Las credenciales incluidas en ese script son exclusivamente locales.

## Limites de esta primera topologia

- MySQL tiene una replica y un Azure Disk. El disco persiste ante reinicios de Pod, pero no reemplaza backups ni alta disponibilidad.
- Los uploads usan `ReadWriteOnce`, por eso la aplicacion tiene una replica. Para escalar horizontalmente conviene moverlos a Azure Blob Storage.
- El Ingress inicial usa HTTP. Antes de ingresar credenciales reales por Internet hay que configurar un dominio y TLS.
- El modelo heredado guarda contrasenas de usuarios de la aplicacion en texto plano. Antes de uso productivo debe migrarse a Argon2 o bcrypt.
- Los secretos de MySQL no deben rotarse solo en GitHub: tambien hay que cambiar los usuarios dentro de MySQL de forma coordinada.
