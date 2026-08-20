[CmdletBinding()]
param(
  [string]$ResourceGroup = 'rg-pena-prod',
  [string]$AksCluster = 'aks-pena-prod',
  [string]$AcrName = 'penacrd03db297',
  [string]$GitHubRepository = 'cristianr2015/pena',
  [string]$AppHost = '',
  [string]$AdminUsername = 'admin'
)

# Azure CLI puede escribir progreso en stderr con exit code 0. Las llamadas
# criticas se validan explicitamente mediante Assert-LastExit.
$ErrorActionPreference = 'Continue'
Set-StrictMode -Version Latest

function Require-Command([string]$Name, [string]$Hint) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "No se encontro '$Name'. $Hint"
  }
}

function Assert-LastExit([string]$Message) {
  if ($LASTEXITCODE -ne 0) {
    throw $Message
  }
}

function Invoke-ExternalProbe([scriptblock]$Command) {
  $previousPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'Continue'
    $probeOutput = & $Command 2>$null
    $probeExitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousPreference
  }

  return [pscustomobject]@{
    Output = ($probeOutput -join [Environment]::NewLine)
    ExitCode = $probeExitCode
  }
}

function New-RandomSecret([int]$ByteLength = 36) {
  $bytes = New-Object byte[] $ByteLength
  $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $generator.GetBytes($bytes)
  } finally {
    $generator.Dispose()
  }

  return [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

function ConvertTo-Base64([string]$Value) {
  return [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($Value))
}

function Sync-GitHubSecret([string]$GhCommand, [string]$Name, [string]$Value) {
  $Value | & $GhCommand secret set $Name `
    --repo $GitHubRepository `
    --env production
  Assert-LastExit "No se pudo sincronizar el secret '$Name' con GitHub."
}

Require-Command 'az' "Instala Azure CLI y ejecuta 'az login'."
Require-Command 'docker' 'Instala e inicia Docker Desktop.'
Require-Command 'git' 'Instala Git para Windows.'

$accountProbe = Invoke-ExternalProbe { az account show --output json --only-show-errors }
if ($accountProbe.ExitCode -ne 0 -or -not $accountProbe.Output) {
  throw "No hay una sesion de Azure activa. Ejecuta 'az login'."
}

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$originalLocation = Get-Location
Set-Location $repositoryRoot

$worktreeChanges = git status --porcelain
Assert-LastExit 'No se pudo consultar el estado de Git.'
if ($worktreeChanges) {
  throw 'El arbol de trabajo tiene cambios sin confirmar. Haz commit antes de desplegar para que la etiqueta de imagen sea trazable.'
}

$toolsDirectory = Join-Path $env:LOCALAPPDATA 'pena-aks-tools'
$localKubectl = Join-Path $toolsDirectory 'kubectl.exe'
$localKubelogin = Join-Path $toolsDirectory 'kubelogin.exe'
$manualKubeconfig = Join-Path $toolsDirectory 'kubeconfig'

if (-not (Get-Command 'kubelogin' -ErrorAction SilentlyContinue)) {
  if (-not (Test-Path -LiteralPath $localKubelogin)) {
    Write-Host 'Instalando kubectl y kubelogin para el acceso temporal a AKS...'
    New-Item -ItemType Directory -Path $toolsDirectory -Force | Out-Null
    az aks install-cli `
      --install-location $localKubectl `
      --kubelogin-install-location $localKubelogin `
      --only-show-errors
    Assert-LastExit 'No se pudieron instalar kubectl y kubelogin.'
  }
  $env:PATH = "$toolsDirectory;$env:PATH"
}

$kubectlCommand = (Get-Command 'kubectl' -ErrorAction Stop).Source
$kubeloginCommand = (Get-Command 'kubelogin' -ErrorAction Stop).Source

$loginServer = az acr show `
  --name $AcrName `
  --resource-group $ResourceGroup `
  --query loginServer `
  --output tsv `
  --only-show-errors
Assert-LastExit "No se encontro ACR '$AcrName'."

$commitSha = git rev-parse HEAD
Assert-LastExit 'No se pudo obtener el commit actual.'
$imageName = "$loginServer/cantina"
$imageReference = "$imageName`:$commitSha"

Write-Host "Construyendo $imageReference..."
docker build --tag $imageReference --tag "$imageName`:latest" .
Assert-LastExit 'Fallo la construccion de la imagen Docker.'

Write-Host "Publicando la imagen en $loginServer..."
az acr login --name $AcrName --only-show-errors
Assert-LastExit 'No se pudo iniciar sesion en ACR.'
docker push $imageReference
Assert-LastExit 'No se pudo publicar la imagen inmutable.'
docker push "$imageName`:latest"
Assert-LastExit 'No se pudo actualizar la etiqueta latest.'

$aksId = az aks show `
  --name $AksCluster `
  --resource-group $ResourceGroup `
  --query id `
  --output tsv `
  --only-show-errors
Assert-LastExit "No se encontro AKS '$AksCluster'."

$currentUserId = az ad signed-in-user show --query id --output tsv --only-show-errors
Assert-LastExit 'No se pudo obtener el usuario conectado a Azure.'

$clusterAdminRole = 'Azure Kubernetes Service RBAC Cluster Admin'
$existingAdminProbe = Invoke-ExternalProbe {
  az role assignment list `
    --assignee-object-id $currentUserId `
    --fill-principal-name false `
    --role $clusterAdminRole `
    --scope $aksId `
    --query '[0].id' `
    --output tsv `
    --only-show-errors
}
$temporaryAdminAssignmentId = $null
$newAdminPassword = $null

try {
  if (-not $existingAdminProbe.Output) {
    Write-Host 'Asignando acceso temporal de despliegue al usuario actual...'
    $temporaryAdminAssignmentId = az role assignment create `
      --assignee-object-id $currentUserId `
      --assignee-principal-type User `
      --role $clusterAdminRole `
      --scope $aksId `
      --query id `
      --output tsv `
      --only-show-errors
    Assert-LastExit 'No se pudo asignar acceso temporal a AKS.'
  }

  az aks get-credentials `
    --name $AksCluster `
    --resource-group $ResourceGroup `
    --file $manualKubeconfig `
    --overwrite-existing `
    --output none `
    --only-show-errors
  Assert-LastExit 'No se pudieron obtener credenciales de AKS.'

  $env:KUBECONFIG = $manualKubeconfig
  & $kubeloginCommand convert-kubeconfig -l azurecli
  Assert-LastExit 'No se pudo configurar kubelogin.'

  $accessReady = $false
  for ($attempt = 1; $attempt -le 20; $attempt++) {
    $accessProbe = Invoke-ExternalProbe {
      & $kubectlCommand auth can-i create secrets --namespace cantina
    }
    if ($accessProbe.ExitCode -eq 0 -and $accessProbe.Output.Trim() -eq 'yes') {
      $accessReady = $true
      break
    }

    if ($attempt -lt 20) {
      Write-Host "Esperando propagacion de Azure RBAC ($attempt/20)..."
      Start-Sleep -Seconds 15
    }
  }
  if (-not $accessReady) {
    throw 'Azure RBAC no habilito el acceso temporal dentro del tiempo esperado.'
  }

  $secretProbe = Invoke-ExternalProbe {
    & $kubectlCommand -n cantina get secret cantina-secrets -o name
  }

  if ($secretProbe.ExitCode -ne 0 -or -not $secretProbe.Output) {
    Write-Host 'Creando secretos iniciales de la aplicacion...'
    $databasePassword = New-RandomSecret
    $rootPassword = New-RandomSecret
    $jwtSecret = New-RandomSecret -ByteLength 48
    $newAdminPassword = New-RandomSecret -ByteLength 24

    $secretDocument = [ordered]@{
      apiVersion = 'v1'
      kind = 'Secret'
      metadata = [ordered]@{
        name = 'cantina-secrets'
        namespace = 'cantina'
      }
      type = 'Opaque'
      stringData = [ordered]@{
        DB_PASSWORD = $databasePassword
        MYSQL_ROOT_PASSWORD = $rootPassword
        JWT_SECRET = $jwtSecret
        ADMIN_USERNAME_B64 = ConvertTo-Base64 $AdminUsername
        ADMIN_PASSWORD_B64 = ConvertTo-Base64 $newAdminPassword
      }
    } | ConvertTo-Json -Depth 5 -Compress

    $secretDocument | & $kubectlCommand apply -f -
    Assert-LastExit 'No se pudo crear el Secret de Kubernetes.'

    $ghCommand = $null
    $ghResolved = Get-Command 'gh' -ErrorAction SilentlyContinue
    if ($ghResolved) {
      $ghCommand = $ghResolved.Source
    } elseif (Test-Path -LiteralPath 'C:\Program Files\GitHub CLI\gh.exe') {
      $ghCommand = 'C:\Program Files\GitHub CLI\gh.exe'
    }

    if ($ghCommand) {
      $ghAuthProbe = Invoke-ExternalProbe { & $ghCommand auth status }
      if ($ghAuthProbe.ExitCode -eq 0) {
        Write-Host 'Sincronizando los secretos con el environment production de GitHub...'
        Sync-GitHubSecret -GhCommand $ghCommand -Name 'DB_PASSWORD' -Value $databasePassword
        Sync-GitHubSecret -GhCommand $ghCommand -Name 'MYSQL_ROOT_PASSWORD' -Value $rootPassword
        Sync-GitHubSecret -GhCommand $ghCommand -Name 'JWT_SECRET' -Value $jwtSecret
        Sync-GitHubSecret -GhCommand $ghCommand -Name 'ADMIN_USERNAME' -Value $AdminUsername
        Sync-GitHubSecret -GhCommand $ghCommand -Name 'ADMIN_PASSWORD' -Value $newAdminPassword
      }
    }
  } else {
    Write-Host 'El Secret de Kubernetes ya existe; no se rotan credenciales de MySQL.'
  }

  Write-Host 'Renderizando y aplicando manifiestos...'
  $renderedManifest = (& $kubectlCommand kustomize 'k8s/overlays/production') -join "`n"
  Assert-LastExit 'No se pudieron renderizar los manifiestos.'
  $renderedManifest = $renderedManifest.Replace('example.azurecr.io/cantina:latest', $imageReference)

  if ($AppHost) {
    if ($AppHost -notmatch '^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$') {
      throw 'AppHost no es un nombre DNS valido.'
    }
    $renderedManifest = [regex]::Replace(
      $renderedManifest,
      '(?m)^  - http:\r?$',
      "  - host: $AppHost`n    http:"
    )
  }

  $renderedManifest | & $kubectlCommand apply -f -
  Assert-LastExit 'No se pudieron aplicar los manifiestos.'

  & $kubectlCommand -n cantina rollout status statefulset/mysql --timeout=10m
  Assert-LastExit 'MySQL no quedo listo.'
  & $kubectlCommand -n cantina rollout status deployment/cantina --timeout=10m
  Assert-LastExit 'La aplicacion no quedo lista.'

  $ingressAddress = ''
  for ($attempt = 1; $attempt -le 30; $attempt++) {
    $ingressAddress = & $kubectlCommand -n cantina get ingress cantina `
      -o "jsonpath={.status.loadBalancer.ingress[0].ip}{.status.loadBalancer.ingress[0].hostname}"
    if ($LASTEXITCODE -eq 0 -and $ingressAddress) {
      break
    }
    Start-Sleep -Seconds 10
  }

  Write-Host ''
  Write-Host 'Despliegue manual completado.' -ForegroundColor Green
  Write-Host "Imagen: $imageReference"
  if ($AppHost) {
    Write-Host "Aplicacion: http://$AppHost"
  } elseif ($ingressAddress) {
    Write-Host "Aplicacion: http://$ingressAddress"
  } else {
    Write-Host "La IP del Ingress aun esta pendiente. Consulta: kubectl -n cantina get ingress"
  }

  if ($newAdminPassword) {
    Set-Clipboard -Value $newAdminPassword
    Write-Host 'La contrasena inicial de admin se copio al portapapeles; guardala en un gestor seguro.' -ForegroundColor Yellow
    Write-Host "Usuario administrador: $AdminUsername"
  }
} finally {
  if ($temporaryAdminAssignmentId) {
    Write-Host 'Retirando acceso temporal de despliegue...'
    az role assignment delete `
      --ids $temporaryAdminAssignmentId `
      --output none `
      --only-show-errors
    Assert-LastExit 'No se pudo retirar el acceso temporal de AKS.'
  }
  Set-Location $originalLocation
}
