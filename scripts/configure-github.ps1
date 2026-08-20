[CmdletBinding()]
param(
  [Parameter(Mandatory)]
  [string]$GitHubRepository,
  [Parameter(Mandatory)]
  [string]$AzureClientId,
  [Parameter(Mandatory)]
  [string]$AzureTenantId,
  [Parameter(Mandatory)]
  [string]$AzureSubscriptionId,
  [Parameter(Mandatory)]
  [string]$AzureResourceGroup,
  [Parameter(Mandatory)]
  [string]$AzureAksCluster,
  [Parameter(Mandatory)]
  [string]$AzureAcrName,
  [string]$AppHost = '',
  [string]$AdminUsername = 'admin',
  [switch]$RotateRuntimeSecrets
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$environmentName = 'production'

function Require-Gh {
  if (-not (Get-Command 'gh' -ErrorAction SilentlyContinue)) {
    throw "No se encontro GitHub CLI. Instalala con 'winget install --id GitHub.cli' y ejecuta 'gh auth login'."
  }

  $previousPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'Continue'
    gh auth status 2>$null
    $authExitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousPreference
  }

  if ($authExitCode -ne 0) {
    throw "GitHub CLI no tiene una sesion activa. Ejecuta 'gh auth login'."
  }
}

function Assert-Gh([string]$Message) {
  if ($LASTEXITCODE -ne 0) {
    throw $Message
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

function Set-EnvironmentSecret([string]$Name, [string]$Value) {
  $Value | gh secret set $Name `
    --repo $GitHubRepository `
    --env $environmentName
  Assert-Gh "No se pudo configurar el secret '$Name'."
}

function Set-EnvironmentVariable([string]$Name, [string]$Value) {
  gh variable set $Name `
    --repo $GitHubRepository `
    --env $environmentName `
    --body $Value
  Assert-Gh "No se pudo configurar la variable '$Name'."
}

Require-Gh

Write-Host "Configurando GitHub environment '$environmentName' en $GitHubRepository..."
gh api `
  --method PUT `
  -H 'Accept: application/vnd.github+json' `
  "repos/$GitHubRepository/environments/$environmentName" `
  --silent
Assert-Gh "No se pudo crear o actualizar el environment '$environmentName'."

Set-EnvironmentSecret -Name 'AZURE_CLIENT_ID' -Value $AzureClientId
Set-EnvironmentSecret -Name 'AZURE_TENANT_ID' -Value $AzureTenantId
Set-EnvironmentSecret -Name 'AZURE_SUBSCRIPTION_ID' -Value $AzureSubscriptionId

Set-EnvironmentVariable -Name 'AZURE_RESOURCE_GROUP' -Value $AzureResourceGroup
Set-EnvironmentVariable -Name 'AZURE_AKS_CLUSTER' -Value $AzureAksCluster
Set-EnvironmentVariable -Name 'AZURE_ACR_NAME' -Value $AzureAcrName

if ($AppHost) {
  Set-EnvironmentVariable -Name 'APP_HOST' -Value $AppHost
}

$existingSecretsJson = gh secret list `
  --repo $GitHubRepository `
  --env $environmentName `
  --json name
Assert-Gh 'No se pudo consultar la lista de secrets del environment.'
$existingSecrets = @($existingSecretsJson | ConvertFrom-Json | ForEach-Object { $_.name })

$newAdminPassword = $null
$runtimeSecrets = [ordered]@{
  DB_PASSWORD = New-RandomSecret
  MYSQL_ROOT_PASSWORD = New-RandomSecret
  JWT_SECRET = New-RandomSecret -ByteLength 48
  ADMIN_USERNAME = $AdminUsername
  ADMIN_PASSWORD = New-RandomSecret -ByteLength 24
}

foreach ($entry in $runtimeSecrets.GetEnumerator()) {
  if (-not $RotateRuntimeSecrets -and $existingSecrets -contains $entry.Key) {
    Write-Host "Secret '$($entry.Key)' ya existe; no se rota."
    continue
  }

  Set-EnvironmentSecret -Name $entry.Key -Value $entry.Value
  if ($entry.Key -eq 'ADMIN_PASSWORD') {
    $newAdminPassword = $entry.Value
  }
}

Write-Host ''
Write-Host 'Environment de GitHub configurado.' -ForegroundColor Green
if ($newAdminPassword) {
  Set-Clipboard -Value $newAdminPassword
  Write-Host 'La nueva contrasena de administrador se copio al portapapeles; guardala ahora en un gestor seguro.' -ForegroundColor Yellow
  Write-Host "Usuario administrador: $AdminUsername"
}
