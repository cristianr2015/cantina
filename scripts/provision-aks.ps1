[CmdletBinding()]
param(
  [string]$GitHubRepository = 'cristianr2015/pena',
  [string]$SubscriptionId = '',
  [string]$Location = 'brazilsouth',
  [string]$ResourceGroup = 'rg-pena-prod',
  [string]$AksCluster = 'aks-pena-prod',
  [string]$AcrName = '',
  [string]$IdentityName = 'id-github-pena-cd',
  [string]$NodeVmSize = 'Standard_D2s_v5',
  [ValidateRange(1, 10)]
  [int]$NodeCount = 1,
  [switch]$ConfigureGitHub,
  [string]$AppHost = '',
  [string]$AzurePrincipalObjectId = ''
)

# Azure CLI puede escribir avisos en stderr incluso con exit code 0. Cada llamada
# critica se valida explicitamente con Assert-LastExit para evitar falsos fallos.
$ErrorActionPreference = 'Continue'
Set-StrictMode -Version Latest

function Require-Command([string]$Name, [string]$InstallHint) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "No se encontro '$Name'. $InstallHint"
  }
}

function Assert-LastExit([string]$Message) {
  if ($LASTEXITCODE -ne 0) {
    throw $Message
  }
}

function Get-CurrentAzurePrincipal([object]$Account, [string]$ObjectIdOverride) {
  $principalType = if ($Account.user.type -eq 'servicePrincipal') { 'ServicePrincipal' } else { 'User' }
  if ($ObjectIdOverride) {
    $parsedId = [Guid]::Empty
    if (-not [Guid]::TryParse($ObjectIdOverride, [ref]$parsedId)) {
      throw 'AzurePrincipalObjectId debe ser un GUID valido.'
    }
    return [pscustomobject]@{ Id = $parsedId.ToString(); Type = $principalType }
  }

  $accessToken = az account get-access-token `
    --resource 'https://management.azure.com/' `
    --query accessToken `
    --output tsv `
    --only-show-errors
  Assert-LastExit 'No se pudo obtener un token ARM para identificar la sesion de Azure.'

  try {
    $parts = $accessToken.Split('.')
    if ($parts.Count -lt 2) {
      throw 'El token ARM no tiene formato JWT.'
    }
    $payload = $parts[1].Replace('-', '+').Replace('_', '/')
    switch ($payload.Length % 4) {
      2 { $payload += '==' }
      3 { $payload += '=' }
      1 { throw 'El payload del token ARM no tiene un formato Base64 valido.' }
    }
    $claimsJson = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($payload))
    $claims = $claimsJson | ConvertFrom-Json
    $parsedId = [Guid]::Empty
    if (-not $claims.oid -or -not [Guid]::TryParse([string]$claims.oid, [ref]$parsedId)) {
      throw "El token ARM no contiene el claim 'oid'. Usa -AzurePrincipalObjectId con el object ID de tu identidad."
    }
    return [pscustomobject]@{ Id = $parsedId.ToString(); Type = $principalType }
  } finally {
    $accessToken = $null
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

function Ensure-RoleAssignment(
  [string]$PrincipalId,
  [string]$Role,
  [string]$Scope
) {
  $existing = az role assignment list `
    --assignee-object-id $PrincipalId `
    --fill-principal-name false `
    --role $Role `
    --scope $Scope `
    --query '[0].id' `
    --output tsv `
    --only-show-errors
  Assert-LastExit "No se pudo consultar la asignacion '$Role'."

  if (-not $existing) {
    Write-Host "Asignando '$Role'..."
    az role assignment create `
      --assignee-object-id $PrincipalId `
      --assignee-principal-type ServicePrincipal `
      --role $Role `
      --scope $Scope `
      --output none `
      --only-show-errors
    Assert-LastExit "No se pudo asignar '$Role'. Tu cuenta necesita Owner o User Access Administrator."
  }
}

function Ensure-AzureProvider([string]$Namespace) {
  $registrationState = az provider show `
    --namespace $Namespace `
    --query registrationState `
    --output tsv `
    --only-show-errors
  Assert-LastExit "No se pudo consultar el proveedor '$Namespace'."

  if ($registrationState -ne 'Registered') {
    Write-Host "Registrando proveedor de Azure '$Namespace'..."
    az provider register `
      --namespace $Namespace `
      --wait `
      --output none `
      --only-show-errors
    Assert-LastExit "No se pudo registrar el proveedor '$Namespace'."
  }
}

Require-Command 'az' 'Instala Azure CLI desde https://aka.ms/installazurecliwindows.'

$accountProbe = Invoke-ExternalProbe { az account show --output json --only-show-errors }
$accountJson = $accountProbe.Output
if ($accountProbe.ExitCode -ne 0 -or -not $accountJson) {
  throw "No hay una sesion de Azure activa. Ejecuta 'az login' y vuelve a correr este script."
}

$account = $accountJson | ConvertFrom-Json
if (-not $SubscriptionId) {
  $SubscriptionId = $account.id
}

az account set --subscription $SubscriptionId --only-show-errors
Assert-LastExit 'No se pudo seleccionar la suscripcion indicada.'

$selectedAccountJson = az account show --output json --only-show-errors
Assert-LastExit 'No se pudo leer la suscripcion seleccionada.'
$account = $selectedAccountJson | ConvertFrom-Json
$TenantId = $account.tenantId
$currentPrincipal = Get-CurrentAzurePrincipal -Account $account -ObjectIdOverride $AzurePrincipalObjectId

foreach ($providerNamespace in @(
  'Microsoft.ContainerRegistry',
  'Microsoft.ContainerService',
  'Microsoft.ManagedIdentity',
  'Microsoft.Network',
  'Microsoft.Compute',
  'Microsoft.Storage'
)) {
  Ensure-AzureProvider -Namespace $providerNamespace
}

if (-not $AcrName) {
  $subscriptionSuffix = ($SubscriptionId -replace '-', '').Substring(0, 8).ToLowerInvariant()
  $AcrName = "penacr$subscriptionSuffix"
}

if ($AcrName -notmatch '^[a-zA-Z0-9]{5,50}$') {
  throw 'AcrName debe contener entre 5 y 50 caracteres alfanumericos, sin guiones.'
}

Write-Host "Suscripcion: $($account.name) ($SubscriptionId)"
Write-Host "Region: $Location"
Write-Host "Resource group: $ResourceGroup"

$groupExists = az group exists --name $ResourceGroup --only-show-errors
Assert-LastExit 'No se pudo comprobar el resource group.'
if ($groupExists -ne 'true') {
  Write-Host 'Creando resource group...'
  az group create `
    --name $ResourceGroup `
    --location $Location `
    --output none `
    --only-show-errors
  Assert-LastExit 'No se pudo crear el resource group.'
}

$acrProbe = Invoke-ExternalProbe {
  az acr show `
    --name $AcrName `
    --resource-group $ResourceGroup `
    --query id `
    --output tsv `
    --only-show-errors
}
$acrId = $acrProbe.Output
if ($acrProbe.ExitCode -ne 0 -or -not $acrId) {
  Write-Host "Creando Azure Container Registry '$AcrName'..."
  az acr create `
    --name $AcrName `
    --resource-group $ResourceGroup `
    --location $Location `
    --sku Basic `
    --role-assignment-mode rbac `
    --admin-enabled false `
    --output none `
    --only-show-errors
  Assert-LastExit 'No se pudo crear ACR. El nombre puede estar ocupado globalmente; usa -AcrName con otro valor.'
  $acrId = az acr show --name $AcrName --resource-group $ResourceGroup --query id --output tsv --only-show-errors
  Assert-LastExit 'No se pudo leer el ACR creado.'
}

$aksProbe = Invoke-ExternalProbe {
  az aks show `
    --name $AksCluster `
    --resource-group $ResourceGroup `
    --output json `
    --only-show-errors
}
$aksJson = $aksProbe.Output

if ($aksProbe.ExitCode -ne 0 -or -not $aksJson) {
  Write-Host "Creando AKS '$AksCluster'. Esto puede tardar varios minutos..."
  az aks create `
    --name $AksCluster `
    --resource-group $ResourceGroup `
    --location $Location `
    --tier free `
    --node-count $NodeCount `
    --node-vm-size $NodeVmSize `
    --enable-cluster-autoscaler `
    --min-count 1 `
    --max-count 3 `
    --enable-managed-identity `
    --enable-aad `
    --enable-azure-rbac `
    --disable-local-accounts `
    --attach-acr $acrId `
    --enable-app-routing `
    --app-routing-default-nginx-controller External `
    --generate-ssh-keys `
    --output none `
    --only-show-errors
  Assert-LastExit 'No se pudo crear AKS. Revisa cuotas, disponibilidad del tamano de VM y permisos de la suscripcion.'
  $aksJson = az aks show --name $AksCluster --resource-group $ResourceGroup --output json --only-show-errors
  Assert-LastExit 'No se pudo leer el AKS creado.'
} else {
  $aks = $aksJson | ConvertFrom-Json
  if (-not $aks.aadProfile.enableAzureRbac) {
    throw "El AKS existente no usa Azure RBAC. No se modifico porque cambiar su autorizacion puede afectar accesos existentes."
  }

  $kubeletPrincipalId = az aks show `
    --name $AksCluster `
    --resource-group $ResourceGroup `
    --query identityProfile.kubeletidentity.objectId `
    --output tsv `
    --only-show-errors
  Assert-LastExit 'No se pudo obtener la identidad kubelet de AKS.'

  $acrPullProbe = Invoke-ExternalProbe {
    az role assignment list `
      --assignee-object-id $kubeletPrincipalId `
      --fill-principal-name false `
      --role AcrPull `
      --scope $acrId `
      --query '[0].id' `
      --output tsv `
      --only-show-errors
  }
  if (-not $acrPullProbe.Output) {
    Write-Host 'Integrando AKS con ACR...'
    az aks update `
      --name $AksCluster `
      --resource-group $ResourceGroup `
      --attach-acr $acrId `
      --output none `
      --only-show-errors
    Assert-LastExit 'No se pudo integrar AKS con ACR.'
  }

  $appRoutingEnabled = az aks show `
    --name $AksCluster `
    --resource-group $ResourceGroup `
    --query ingressProfile.webAppRouting.enabled `
    --output tsv `
    --only-show-errors
  Assert-LastExit 'No se pudo consultar Application Routing.'

  if ($appRoutingEnabled -ne 'true') {
    Write-Host 'Habilitando Application Routing...'
    az aks approuting enable `
      --name $AksCluster `
      --resource-group $ResourceGroup `
      --nginx External `
      --output none `
      --only-show-errors
    Assert-LastExit 'No se pudo habilitar Application Routing.'
  } else {
    $nginxType = az aks show `
      --name $AksCluster `
      --resource-group $ResourceGroup `
      --query ingressProfile.webAppRouting.nginx.defaultIngressControllerType `
      --output tsv `
      --only-show-errors
    Assert-LastExit 'No se pudo consultar el tipo de Ingress administrado.'

    if ($nginxType -ne 'External') {
      Write-Host 'Configurando el Ingress publico administrado...'
      az aks approuting update `
        --name $AksCluster `
        --resource-group $ResourceGroup `
        --nginx External `
        --output none `
        --only-show-errors
      Assert-LastExit 'No se pudo configurar el Ingress publico administrado.'
    }
  }
}

$aksId = az aks show `
  --name $AksCluster `
  --resource-group $ResourceGroup `
  --query id `
  --output tsv `
  --only-show-errors
Assert-LastExit 'No se pudo obtener el ID de AKS.'

$identityProbe = Invoke-ExternalProbe {
  az identity show `
    --name $IdentityName `
    --resource-group $ResourceGroup `
    --output json `
    --only-show-errors
}
$identityJson = $identityProbe.Output
if ($identityProbe.ExitCode -ne 0 -or -not $identityJson) {
  Write-Host "Creando identidad administrada '$IdentityName'..."
  $identityJson = az identity create `
    --name $IdentityName `
    --resource-group $ResourceGroup `
    --location $Location `
    --output json `
    --only-show-errors
  Assert-LastExit 'No se pudo crear la identidad administrada.'
}

$identity = $identityJson | ConvertFrom-Json
$namespaceScope = "$aksId/namespaces/cantina"

Ensure-RoleAssignment -PrincipalId $identity.principalId -Role 'AcrPush' -Scope $acrId
Ensure-RoleAssignment -PrincipalId $identity.principalId -Role 'Azure Kubernetes Service Cluster User Role' -Scope $aksId
Ensure-RoleAssignment -PrincipalId $identity.principalId -Role 'Azure Kubernetes Service RBAC Writer' -Scope $namespaceScope

$credentialName = 'github-production'
$subject = "repo:$GitHubRepository`:environment:production"
$credentialProbe = Invoke-ExternalProbe {
  az identity federated-credential show `
    --name $credentialName `
    --identity-name $IdentityName `
    --resource-group $ResourceGroup `
    --query id `
    --output tsv `
    --only-show-errors
}
$credentialId = $credentialProbe.Output

if ($credentialProbe.ExitCode -ne 0 -or -not $credentialId) {
  Write-Host 'Creando credencial federada para GitHub Actions...'
  az identity federated-credential create `
    --name $credentialName `
    --identity-name $IdentityName `
    --resource-group $ResourceGroup `
    --issuer 'https://token.actions.githubusercontent.com' `
    --subject $subject `
    --audiences 'api://AzureADTokenExchange' `
    --output none `
    --only-show-errors
  Assert-LastExit 'No se pudo crear la credencial federada.'
} else {
  az identity federated-credential update `
    --name $credentialName `
    --identity-name $IdentityName `
    --resource-group $ResourceGroup `
    --issuer 'https://token.actions.githubusercontent.com' `
    --subject $subject `
    --audiences 'api://AzureADTokenExchange' `
    --output none `
    --only-show-errors
  Assert-LastExit 'No se pudo actualizar la credencial federada.'
}

Write-Host "Creando y verificando el namespace 'cantina'..."

$clusterAdminRole = 'Azure Kubernetes Service RBAC Cluster Admin'
$existingAdminProbe = Invoke-ExternalProbe {
  az role assignment list `
    --assignee-object-id $currentPrincipal.Id `
    --fill-principal-name false `
    --role $clusterAdminRole `
    --scope $aksId `
    --query '[0].id' `
    --output tsv `
    --only-show-errors
}
$temporaryAdminAssignmentId = $null

if (-not $existingAdminProbe.Output) {
  Write-Host 'Asignando acceso Kubernetes temporal al usuario que aprovisiona...'
  $temporaryAdminAssignmentId = az role assignment create `
    --assignee-object-id $currentPrincipal.Id `
    --assignee-principal-type $currentPrincipal.Type `
    --role $clusterAdminRole `
    --scope $aksId `
    --query id `
    --output tsv `
    --only-show-errors
  Assert-LastExit 'No se pudo asignar acceso temporal para crear el namespace.'
}

$namespaceReady = $false
try {
  for ($attempt = 1; $attempt -le 20; $attempt++) {
    $namespaceProbe = Invoke-ExternalProbe {
      az aks command invoke `
        --name $AksCluster `
        --resource-group $ResourceGroup `
        --command 'kubectl create namespace cantina --dry-run=client -o yaml | kubectl apply -f -' `
        --output json `
        --only-show-errors
    }

    if ($namespaceProbe.ExitCode -eq 0 -and $namespaceProbe.Output) {
      $namespaceResult = $namespaceProbe.Output | ConvertFrom-Json
      if ($namespaceResult.logs -match 'namespace/cantina (created|unchanged)') {
        $namespaceReady = $true
        break
      }
    }

    if ($attempt -lt 20) {
      Write-Host "Esperando propagacion de Azure RBAC para crear el namespace ($attempt/20)..."
      Start-Sleep -Seconds 15
    }
  }
} finally {
  if ($temporaryAdminAssignmentId) {
    Write-Host 'Retirando acceso Kubernetes temporal...'
    az role assignment delete `
      --ids $temporaryAdminAssignmentId `
      --output none `
      --only-show-errors
    Assert-LastExit 'No se pudo retirar la asignacion temporal de administrador.'
  }
}

if (-not $namespaceReady) {
  throw "No se pudo crear o verificar el namespace 'cantina' despues de esperar la propagacion de Azure RBAC."
}

Write-Host ''
Write-Host 'Infraestructura de Azure lista.' -ForegroundColor Green
Write-Host "AZURE_CLIENT_ID=$($identity.clientId)"
Write-Host "AZURE_TENANT_ID=$TenantId"
Write-Host "AZURE_SUBSCRIPTION_ID=$SubscriptionId"
Write-Host "AZURE_RESOURCE_GROUP=$ResourceGroup"
Write-Host "AZURE_AKS_CLUSTER=$AksCluster"
Write-Host "AZURE_ACR_NAME=$AcrName"

if ($ConfigureGitHub) {
  & "$PSScriptRoot/configure-github.ps1" `
    -GitHubRepository $GitHubRepository `
    -AzureClientId $identity.clientId `
    -AzureTenantId $TenantId `
    -AzureSubscriptionId $SubscriptionId `
    -AzureResourceGroup $ResourceGroup `
    -AzureAksCluster $AksCluster `
    -AzureAcrName $AcrName `
    -AppHost $AppHost
}
