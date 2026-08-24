@description('Nombre de la máquina virtual que ejecuta MySQL.')
param vmName string = 'vm-app-pena-mysql'

@description('Usuario administrador local de la VM.')
param administratorUsername string = 'azureadmin'

@description('Clave pública SSH para recuperación administrativa.')
param administratorSshPublicKey string

@description('Región de Azure para la red y la VM.')
param location string = resourceGroup().location

@description('Tamaño de la VM. D2als v6 es el menor SKU con capacidad disponible en Brazil South.')
param vmSize string = 'Standard_D2als_v6'

var vnetName = 'vnet-app-pena'
var integrationSubnetName = 'snet-appservice-integration'
var databaseSubnetName = 'snet-mysql-vm'
var databasePrivateIp = '10.40.2.4'

resource databaseNsg 'Microsoft.Network/networkSecurityGroups@2024-05-01' = {
  name: 'nsg-app-pena-mysql'
  location: location
  properties: {
    securityRules: [
      {
        name: 'AllowMySqlFromAppService'
        properties: {
          priority: 100
          access: 'Allow'
          direction: 'Inbound'
          protocol: 'Tcp'
          sourceAddressPrefix: '10.40.1.0/24'
          sourcePortRange: '*'
          destinationAddressPrefix: databasePrivateIp
          destinationPortRange: '3306'
        }
      }
      {
        name: 'DenyOtherVnetInbound'
        properties: {
          priority: 200
          access: 'Deny'
          direction: 'Inbound'
          protocol: '*'
          sourceAddressPrefix: 'VirtualNetwork'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '*'
        }
      }
    ]
  }
}

resource vnet 'Microsoft.Network/virtualNetworks@2024-05-01' = {
  name: vnetName
  location: location
  properties: {
    addressSpace: {
      addressPrefixes: [
        '10.40.0.0/16'
      ]
    }
    subnets: [
      {
        name: integrationSubnetName
        properties: {
          addressPrefix: '10.40.1.0/24'
          delegations: [
            {
              name: 'appServiceDelegation'
              properties: {
                serviceName: 'Microsoft.Web/serverFarms'
              }
            }
          ]
        }
      }
      {
        name: databaseSubnetName
        properties: {
          addressPrefix: '10.40.2.0/24'
          networkSecurityGroup: {
            id: databaseNsg.id
          }
        }
      }
    ]
  }
}

resource databaseNic 'Microsoft.Network/networkInterfaces@2024-05-01' = {
  name: '${vmName}-nic'
  location: location
  properties: {
    ipConfigurations: [
      {
        name: 'private'
        properties: {
          privateIPAllocationMethod: 'Static'
          privateIPAddress: databasePrivateIp
          subnet: {
            id: resourceId('Microsoft.Network/virtualNetworks/subnets', vnet.name, databaseSubnetName)
          }
        }
      }
    ]
  }
}

resource databaseVm 'Microsoft.Compute/virtualMachines@2024-07-01' = {
  name: vmName
  location: location
  tags: {
    environment: 'production'
    workload: 'cantina-mysql'
  }
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    hardwareProfile: {
      vmSize: vmSize
    }
    osProfile: {
      computerName: 'cantina-mysql'
      adminUsername: administratorUsername
      linuxConfiguration: {
        disablePasswordAuthentication: true
        provisionVMAgent: true
        ssh: {
          publicKeys: [
            {
              path: '/home/${administratorUsername}/.ssh/authorized_keys'
              keyData: administratorSshPublicKey
            }
          ]
        }
      }
    }
    storageProfile: {
      imageReference: {
        publisher: 'Canonical'
        offer: 'ubuntu-24_04-lts'
        sku: 'server'
        version: 'latest'
      }
      osDisk: {
        createOption: 'FromImage'
        caching: 'ReadWrite'
        diskSizeGB: 32
        managedDisk: {
          storageAccountType: 'StandardSSD_LRS'
        }
      }
      dataDisks: [
        {
          lun: 0
          createOption: 'Empty'
          caching: 'None'
          diskSizeGB: 32
          managedDisk: {
            storageAccountType: 'StandardSSD_LRS'
          }
        }
      ]
    }
    networkProfile: {
      networkInterfaces: [
        {
          id: databaseNic.id
          properties: {
            primary: true
          }
        }
      ]
    }
    diagnosticsProfile: {
      bootDiagnostics: {
        enabled: true
      }
    }
  }
}

output vmName string = databaseVm.name
output vnetName string = vnet.name
output integrationSubnetName string = integrationSubnetName
output databasePrivateIp string = databasePrivateIp
