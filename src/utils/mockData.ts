import { Buyer, ScooterUnit, StockLog, BatteryImport, BatterySale, ChargerImport, ChargerSale, WarrantyClaim } from '../types';

export const MOCK_BUYERS: Buyer[] = [
  { id: 'b-mock-1', name: 'Rahul Electric Traders', contact: '9876543210', address: 'Jaipur Industrial Area, Rajasthan', gstNo: '08AAACR1234F1Z1' },
  { id: 'b-mock-2', name: 'Sumit Motors & Logistics', contact: '9123456789', address: 'Okhla Phase 3, New Delhi', gstNo: '07AABCS9876E1Z5' },
  { id: 'b-mock-3', name: 'Apex Green Mobility', contact: '9988776655', address: 'GIDC Naroda, Ahmedabad, Gujarat', gstNo: '24AABCA5544K1Z2' },
  { id: 'b-mock-4', name: 'VoltRider Agencies', contact: '8877665544', address: 'Andheri East, Mumbai, Maharashtra', gstNo: '27AABCV1122M1Z8' },
  { id: 'b-mock-5', name: 'EcoDrive Solutions', contact: '7766554433', address: 'Peenya Industrial Area, Bengaluru', gstNo: '29AABCE3344P1Z0' },
  { id: 'b-mock-6', name: 'Sharma Auto Corp', contact: '9811223344', address: 'Phase 7, Mohali, Punjab', gstNo: '03AABCS4455Q1Z9' }
];

export const MOCK_STOCK_LOGS: StockLog[] = [
  {
    id: 'log-mock-1',
    modelName: 'SENZO ESSENATIAL DISC 12"/10"',
    color: 'Red',
    type: 'in',
    sourceChannel: 'container_freight',
    quantity: 20,
    timestamp: '2026-06-10T10:00:00.000Z',
    operator: 'admin',
    notes: 'Import shipment container C-901',
    billNo: 'INV-2026-001',
    stockInNo: 'STK-9001'
  },
  {
    id: 'log-mock-2',
    modelName: 'SENZO ESSENATIAL DISC 12"/10"',
    color: 'Black',
    type: 'in',
    sourceChannel: 'container_freight',
    quantity: 15,
    timestamp: '2026-06-10T11:00:00.000Z',
    operator: 'admin',
    notes: 'Import shipment container C-901',
    billNo: 'INV-2026-001',
    stockInNo: 'STK-9001'
  },
  {
    id: 'log-mock-3',
    modelName: 'CITY XL 12"/10"',
    color: 'BLACK',
    type: 'in',
    sourceChannel: 'container_freight',
    quantity: 25,
    timestamp: '2026-06-15T09:30:00.000Z',
    operator: 'admin',
    notes: 'Bulk stock arrival from main factory',
    billNo: 'INV-2026-002',
    stockInNo: 'STK-9002'
  },
  {
    id: 'log-mock-4',
    modelName: 'CITY XL 12"/10"',
    color: 'WHITE',
    type: 'in',
    sourceChannel: 'container_freight',
    quantity: 20,
    timestamp: '2026-06-15T10:30:00.000Z',
    operator: 'admin',
    notes: 'Bulk stock arrival from main factory',
    billNo: 'INV-2026-002',
    stockInNo: 'STK-9002'
  },
  {
    id: 'log-mock-5',
    modelName: 'SENZO POWER 12"/12"',
    color: 'WHITE',
    type: 'in',
    sourceChannel: 'local_seller',
    quantity: 30,
    timestamp: '2026-07-01T14:00:00.000Z',
    operator: 'admin',
    notes: 'High speed power edition import batch',
    billNo: 'INV-2026-003',
    stockInNo: 'STK-9003'
  }
];

export const MOCK_SCOOTER_UNITS: ScooterUnit[] = [
  {
    id: 'scoot-mock-1',
    modelName: 'SENZO ESSENATIAL DISC 12"/10"',
    color: 'Red',
    chassisNo: 'CH-88201',
    motorNo: 'MT-77101',
    controllerNo: 'CT-99001',
    tireSize: '10-inch',
    buyerName: 'Rahul Electric Traders',
    buyerContact: '9876543210',
    billNo: 'INV-2026-001',
    stockInNo: 'STK-9001',
    batterySerials: ['BAT-60V-1001', 'BAT-60V-1002'],
    chargerSerial: 'CHG-54V-2001',
    status: 'sold',
    scooterWarrantyStatus: 'Active',
    batteryWarrantyStatus: 'Active',
    createdOperator: 'manufacturer',
    createdTimestamp: '2026-06-11T12:00:00.000Z',
    lastUpdatedTimestamp: '2026-07-05T15:30:00.000Z',
    saleDate: '2026-07-05T15:30:00.000Z',
    scooterWarrantyMonths: 12,
    customizationNotes: 'Dual battery kit equipped'
  },
  {
    id: 'scoot-mock-2',
    modelName: 'CITY XL 12"/10"',
    color: 'BLACK',
    chassisNo: 'CH-88202',
    motorNo: 'MT-77102',
    controllerNo: 'CT-99002',
    tireSize: '12-inch',
    buyerName: 'Sumit Motors & Logistics',
    buyerContact: '9123456789',
    billNo: 'INV-2026-002',
    stockInNo: 'STK-9002',
    batterySerials: ['BAT-60V-1003'],
    chargerSerial: 'CHG-54V-2002',
    status: 'sold',
    scooterWarrantyStatus: 'Active',
    batteryWarrantyStatus: 'Active',
    createdOperator: 'manufacturer',
    createdTimestamp: '2026-06-16T11:00:00.000Z',
    lastUpdatedTimestamp: '2026-07-12T10:15:00.000Z',
    saleDate: '2026-07-12T10:15:00.000Z',
    scooterWarrantyMonths: 24,
    customizationNotes: 'Heavy duty rear carrier installed'
  },
  {
    id: 'scoot-mock-3',
    modelName: 'SENZO ESSENATIAL DISC 12"/10"',
    color: 'Black',
    chassisNo: 'CH-88203',
    motorNo: 'MT-77103',
    controllerNo: 'CT-99003',
    tireSize: '10-inch',
    billNo: 'INV-2026-001',
    stockInNo: 'STK-9001',
    batterySerials: ['BAT-60V-1004'],
    chargerSerial: 'CHG-54V-2003',
    status: 'available',
    scooterWarrantyStatus: 'Active',
    batteryWarrantyStatus: 'Active',
    createdOperator: 'manufacturer',
    createdTimestamp: '2026-06-12T09:00:00.000Z',
    lastUpdatedTimestamp: '2026-06-12T09:00:00.000Z'
  },
  {
    id: 'scoot-mock-4',
    modelName: 'CITY XL 12"/10"',
    color: 'WHITE',
    chassisNo: 'CH-88204',
    motorNo: 'MT-77104',
    controllerNo: 'CT-99004',
    tireSize: '12-inch',
    billNo: 'INV-2026-002',
    stockInNo: 'STK-9002',
    batterySerials: [],
    status: 'available',
    scooterWarrantyStatus: 'Active',
    batteryWarrantyStatus: 'None',
    createdOperator: 'manufacturer',
    createdTimestamp: '2026-06-17T14:20:00.000Z',
    lastUpdatedTimestamp: '2026-06-17T14:20:00.000Z'
  },
  {
    id: 'scoot-mock-5',
    modelName: 'SENZO POWER 12"/12"',
    color: 'WHITE',
    chassisNo: 'CH-88205',
    motorNo: 'MT-77105',
    controllerNo: 'CT-99005',
    tireSize: '12-inch',
    buyerName: 'Apex Green Mobility',
    buyerContact: '9988776655',
    billNo: 'INV-2026-003',
    stockInNo: 'STK-9003',
    batterySerials: ['BAT-60V-3001'],
    chargerSerial: 'CHG-69V-4001',
    status: 'hold',
    scooterWarrantyStatus: 'Active',
    batteryWarrantyStatus: 'Active',
    createdOperator: 'manufacturer',
    createdTimestamp: '2026-07-02T10:00:00.000Z',
    lastUpdatedTimestamp: '2026-07-20T16:00:00.000Z'
  }
];

export const MOCK_BATTERY_IMPORTS: BatteryImport[] = [
  {
    id: 'bat-imp-mock-1',
    batterySeries: 'Lithium 60V, 24AH',
    startNo: 'BAT-60V-1001',
    endNo: 'BAT-60V-1050',
    quantity: 50,
    importDate: '2026-06-01T10:00:00.000Z',
    operator: 'admin',
    supplierName: 'GigaCell Energy Systems',
    containerId: 'CONT-BAT-901',
    notes: '60V 24AH Lithium Pack Batch A',
    billNo: 'BAT-BILL-801',
    stockInNo: 'STK-BAT-101'
  },
  {
    id: 'bat-imp-mock-2',
    batterySeries: 'Lithium 60V, 30AH',
    startNo: 'BAT-60V-3001',
    endNo: 'BAT-60V-3030',
    quantity: 30,
    importDate: '2026-06-15T11:00:00.000Z',
    operator: 'admin',
    supplierName: 'PowerTech Global',
    containerId: 'CONT-BAT-902',
    notes: 'High capacity 30AH packs',
    billNo: 'BAT-BILL-802',
    stockInNo: 'STK-BAT-102'
  }
];

export const MOCK_BATTERY_SALES: BatterySale[] = [
  {
    id: 'bat-sale-mock-1',
    buyerName: 'Rahul Electric Traders',
    buyerContact: '9876543210',
    batterySeries: 'Lithium 60V, 24AH',
    startNo: 'BAT-60V-1001',
    endNo: 'BAT-60V-1010',
    quantity: 10,
    saleDate: '2026-06-20T14:00:00.000Z',
    operator: 'sales',
    notes: 'Bulk battery sale for fleet upgrade',
    isUnderWarranty: true,
    warrantyDurationMonths: 12,
    status: 'sold',
    billNo: 'BAT-INV-501'
  },
  {
    id: 'bat-sale-mock-2',
    buyerName: 'VoltRider Agencies',
    buyerContact: '8877665544',
    batterySeries: 'Lithium 60V, 30AH',
    startNo: 'BAT-60V-3001',
    endNo: 'BAT-60V-3005',
    quantity: 5,
    saleDate: '2026-07-01T16:30:00.000Z',
    operator: 'sales',
    notes: 'Direct customer replacement batteries',
    isUnderWarranty: true,
    warrantyDurationMonths: 24,
    status: 'sold',
    billNo: 'BAT-INV-502'
  }
];

export const MOCK_CHARGER_IMPORTS: ChargerImport[] = [
  {
    id: 'chg-imp-mock-1',
    chargerType: 'Lithium Charger 54.6V/6A',
    startNo: 'CHG-54V-2001',
    endNo: 'CHG-54V-2050',
    quantity: 50,
    importDate: '2026-06-01T10:00:00.000Z',
    operator: 'admin',
    supplierName: 'OptiCharge Electronics',
    containerId: 'CONT-CHG-101',
    notes: 'Standard 54.6V fast charger batch',
    billNo: 'CHG-BILL-901',
    stockInNo: 'STK-CHG-201'
  },
  {
    id: 'chg-imp-mock-2',
    chargerType: 'Lithium Charger 69.4V/6A',
    startNo: 'CHG-69V-4001',
    endNo: 'CHG-69V-4030',
    quantity: 30,
    importDate: '2026-06-15T11:00:00.000Z',
    operator: 'admin',
    supplierName: 'OptiCharge Electronics',
    containerId: 'CONT-CHG-102',
    notes: 'Heavy duty 69.4V chargers',
    billNo: 'CHG-BILL-902',
    stockInNo: 'STK-CHG-202'
  }
];

export const MOCK_CHARGER_SALES: ChargerSale[] = [
  {
    id: 'chg-sale-mock-1',
    buyerName: 'Rahul Electric Traders',
    buyerContact: '9876543210',
    chargerType: 'Lithium Charger 54.6V/6A',
    startNo: 'CHG-54V-2001',
    endNo: 'CHG-54V-2010',
    quantity: 10,
    saleDate: '2026-06-20T14:00:00.000Z',
    operator: 'sales',
    notes: 'Bulk charger consignment',
    isUnderWarranty: true,
    warrantyDurationMonths: 12,
    status: 'sold',
    billNo: 'CHG-INV-601'
  },
  {
    id: 'chg-sale-mock-2',
    buyerName: 'EcoDrive Solutions',
    buyerContact: '7766554433',
    chargerType: 'Lithium Charger 69.4V/6A',
    startNo: 'CHG-69V-4001',
    endNo: 'CHG-69V-4005',
    quantity: 5,
    saleDate: '2026-07-05T12:00:00.000Z',
    operator: 'sales',
    notes: 'Fast chargers for service station',
    isUnderWarranty: true,
    warrantyDurationMonths: 12,
    status: 'sold',
    billNo: 'CHG-INV-602'
  }
];

export const MOCK_WARRANTY_CLAIMS: WarrantyClaim[] = [
  {
    id: 'CLM-2026-101',
    originalSaleId: 'scoot-mock-1',
    originalSaleType: 'scooter',
    originalSerialNo: 'CH-88201',
    newSerialNo: 'CT-99099',
    buyerName: 'Rahul Electric Traders',
    buyerContact: '9876543210',
    issueDescription: 'Controller fault - vehicle non-responsive during high speed acceleration',
    status: 'exchanged',
    actionTaken: 'exchanged',
    claimDate: '2026-07-15T10:00:00.000Z',
    operatorName: 'Warehouse Supervisor',
    notes: 'Verified warranty under 12-month active coverage window.',
    lastUpdatedTimestamp: '2026-07-18T14:00:00.000Z'
  },
  {
    id: 'CLM-2026-102',
    originalSaleId: 'bat-sale-mock-1',
    originalSaleType: 'battery',
    originalSerialNo: 'BAT-60V-1005',
    newSerialNo: 'BAT-60V-1049',
    buyerName: 'Rahul Electric Traders',
    buyerContact: '9876543210',
    issueDescription: 'BMS thermal shutdown under high load',
    status: 'exchanged',
    actionTaken: 'exchanged',
    claimDate: '2026-07-20T09:30:00.000Z',
    operatorName: 'Warehouse Supervisor',
    notes: 'Defective cell bank swapped.',
    lastUpdatedTimestamp: '2026-07-21T11:00:00.000Z'
  },
  {
    id: 'CLM-2026-103',
    originalSaleId: 'chg-sale-mock-2',
    originalSaleType: 'charger',
    originalSerialNo: 'CHG-54V-2003',
    newSerialNo: 'CHG-54V-2048',
    buyerName: 'EcoDrive Solutions',
    buyerContact: '7766554433',
    issueDescription: 'No voltage output LED blinking red',
    status: 'under_repair',
    actionTaken: 'pending',
    claimDate: '2026-07-24T16:00:00.000Z',
    operatorName: 'Manager',
    notes: 'Approved for replacement dispatch.',
    lastUpdatedTimestamp: '2026-07-24T16:00:00.000Z'
  }
];
