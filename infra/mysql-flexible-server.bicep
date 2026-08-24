@description('Nombre global del servidor MySQL Flexible Server.')
param serverName string

@description('Usuario administrador de MySQL.')
param administratorLogin string

@secure()
@description('Contraseña del usuario administrador de MySQL.')
param administratorLoginPassword string

@description('Región de Azure.')
param location string = resourceGroup().location

resource mysqlServer 'Microsoft.DBforMySQL/flexibleServers@2023-12-30' = {
  name: serverName
  location: location
  tags: {
    environment: 'production'
    workload: 'cantina'
  }
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    administratorLogin: administratorLogin
    administratorLoginPassword: administratorLoginPassword
    version: '8.0.21'
    createMode: 'Default'
    storage: {
      autoGrow: 'Enabled'
      storageSizeGB: 32
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
    network: {
      publicNetworkAccess: 'Enabled'
    }
  }
}

output fullyQualifiedDomainName string = mysqlServer.properties.fullyQualifiedDomainName
