$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$AdminUsername = 'admin'
$AdminPassword = 'admin123'
$databasePassword = 'cantina-local-db-password'
$rootPassword = 'cantina-local-root-password'
$jwtSecret = 'cantina-local-jwt-secret-not-for-production'

function Require-Command([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "No se encontró '$Name'. Instalá y arrancá Docker Desktop con Kubernetes habilitado."
  }
}

$repositoryRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repositoryRoot

Require-Command 'docker'
Require-Command 'kubectl'

docker info | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Docker Desktop no está iniciado.' }

$context = kubectl config current-context
if ($LASTEXITCODE -ne 0 -or -not $context) { throw 'No hay un contexto de Kubernetes activo.' }
Write-Host "Contexto Kubernetes: $context"

Write-Host 'Construyendo imagen local...'
docker build -t cantina-app:local .
if ($LASTEXITCODE -ne 0) { throw 'Falló la construcción de la imagen.' }

$adminUsernameB64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($AdminUsername))
$adminPasswordB64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($AdminPassword))

kubectl apply -f k8s/base/namespace.yaml
if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear el namespace.' }

kubectl -n cantina create secret generic cantina-secrets `
  "--from-literal=DB_PASSWORD=$databasePassword" `
  "--from-literal=MYSQL_ROOT_PASSWORD=$rootPassword" `
  "--from-literal=JWT_SECRET=$jwtSecret" `
  "--from-literal=ADMIN_USERNAME_B64=$adminUsernameB64" `
  "--from-literal=ADMIN_PASSWORD_B64=$adminPasswordB64" `
  --dry-run=client -o yaml | kubectl apply -f -
if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear el Secret local.' }

kubectl apply -k k8s/overlays/local
if ($LASTEXITCODE -ne 0) { throw 'No se pudieron aplicar los manifiestos.' }

kubectl -n cantina rollout status statefulset/mysql --timeout=5m
if ($LASTEXITCODE -ne 0) { throw 'MySQL no quedó listo.' }

kubectl -n cantina rollout status deployment/cantina --timeout=5m
if ($LASTEXITCODE -ne 0) { throw 'La aplicación no quedó lista.' }

Write-Host ''
Write-Host 'Despliegue local listo.' -ForegroundColor Green
Write-Host "Usuario: $AdminUsername"
Write-Host "Contraseña: $AdminPassword"
Write-Host 'Aplicación: http://localhost:3000'
Write-Host 'MySQL: 127.0.0.1:3307 (base: cantina_db, usuario: cantina)'
Write-Host "Contraseña de MySQL: $databasePassword"
Write-Host 'Los puertos permanecen publicados mientras Kubernetes de Docker Desktop esté activo.'
