# Cantina / Bufet

Aplicación Node.js/Express para administrar productos, ventas, entradas, socios y eventos. Usa MySQL y sirve el frontend desde `public/`.

## Desarrollo local

Requisitos: Node.js 24 y MySQL 8.

```bash
cp .env.example .env
npm ci
mysql -u root -p < schema.sql
npm start
```

La app queda disponible en `http://localhost:3000`. Las variables soportadas están documentadas en `.env.example`; el proyecto no carga `.env` automáticamente, por lo que deben exportarse en la terminal o inyectarse con el entorno de ejecución.

Endpoints de operación:

- `GET /health/live`: confirma que el proceso está vivo.
- `GET /health/ready`: confirma que la app puede consultar MySQL.
- `GET /ping`: endpoint de compatibilidad con chequeo de base de datos.

## Imagen Docker

```bash
docker build -t cantina:local .
docker run --rm -p 3000:3000 \
  -e NODE_ENV=production \
  -e DB_HOST=host.docker.internal \
  -e DB_USER=root \
  -e DB_PASSWORD=secret \
  -e DB_NAME=cantina_db \
  -e JWT_SECRET=un-valor-largo-y-aleatorio \
  cantina:local
```

La imagen usa Node.js 24 LTS, instala solo dependencias de producción y se ejecuta como usuario sin privilegios.

## Kubernetes

`k8s/base` contiene la app, MySQL 8.4, almacenamiento persistente, probes y servicios. `k8s/overlays/production` agrega el Ingress y la imagen de GHCR.

Para un despliegue manual:

```bash
kubectl apply -f k8s/base/namespace.yaml
kubectl apply -f k8s/secret.example.yaml  # editar antes; nunca confirmar valores reales
kubectl apply -k k8s/overlays/production
kubectl -n cantina rollout status statefulset/mysql
kubectl -n cantina rollout status deployment/cantina
```

Antes de aplicar:

1. Cambiar `cantina.example.com` en `k8s/overlays/production/ingress.yaml`.
2. Cambiar la imagen de GHCR en `k8s/overlays/production/kustomization.yaml` si el repositorio cambia.
3. Configurar un Ingress Controller compatible con la clase `nginx`.
4. Ajustar almacenamiento y recursos a las StorageClasses/cuotas del clúster.

MySQL ejecuta `schema.sql` y crea el primer administrador solo cuando el volumen de datos está vacío. Las imágenes subidas viven en un PVC separado. Como ese PVC usa `ReadWriteOnce`, la app queda deliberadamente en una réplica; para escalar horizontalmente hay que mover uploads a almacenamiento de objetos o usar un volumen `ReadWriteMany`.

## CI/CD con GitHub Actions

El workflow `.github/workflows/ci-cd.yml` hace lo siguiente:

1. En pull requests: instala con `npm ci`, ejecuta chequeos, renderiza Kustomize y construye la imagen sin publicarla.
2. En `main`: publica `ghcr.io/<owner>/<repo>:<commit>` y `:latest` en GHCR.
3. Si `K8S_DEPLOY_ENABLED=true`: actualiza secretos, aplica Kubernetes y espera ambos rollouts.

Configurar en **Settings > Environments > production** (o como secretos del repositorio):

| Nombre | Tipo | Uso |
|---|---|---|
| `KUBE_CONFIG_B64` | Secret | kubeconfig codificado con `base64 -w0` |
| `DB_PASSWORD` | Secret | usuario MySQL `cantina` |
| `MYSQL_ROOT_PASSWORD` | Secret | administración del MySQL incluido |
| `JWT_SECRET` | Secret | firma de tokens; usar un valor aleatorio largo |
| `ADMIN_USERNAME` | Secret | administrador inicial |
| `ADMIN_PASSWORD` | Secret | contraseña del administrador inicial |
| `K8S_DEPLOY_ENABLED` | Variable | debe valer `true` para habilitar CD |
| `APP_HOST` | Variable | dominio del Ingress, por ejemplo `cantina.midominio.com` |

Ejemplo para generar valores:

```bash
openssl rand -base64 48                  # JWT_SECRET
base64 -w0 ~/.kube/config                # KUBE_CONFIG_B64 en Linux
```

El paquete GHCR debe ser público para que Kubernetes lo descargue sin credenciales. Si se mantiene privado, crear un `imagePullSecret` de larga duración en el namespace `cantina` y referenciarlo desde el Pod.

## Base de datos y seguridad

`schema.sql` crea las tablas para una instalación nueva. Las contraseñas de usuarios de la aplicación siguen el modelo heredado y se almacenan en texto plano; antes de exponer el servicio a Internet se recomienda migrarlas a hashes con Argon2 o bcrypt. Los secretos de infraestructura y JWT ya no tienen valores productivos embebidos en el código.

El dump `cantina.sql` fue saneado en el árbol de trabajo porque contenía credenciales y datos personales. Si una versión anterior ya fue subida a un remoto, hay que rotar esas credenciales y limpiar el historial de Git; borrarlas en un commit nuevo no las elimina de commits anteriores.
