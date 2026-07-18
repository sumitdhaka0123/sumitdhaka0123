export interface LocationHistoryEntry {
  latitude: number;
  longitude: number;
  timestamp: string;
}

export interface User {
  id: string;
  username: string;
  role: 'admin' | 'manufacturer' | 'salesperson' | 'manager';
  name: string;
  locked?: boolean;
  failedAttempts?: number;
  approved?: boolean;
  latitude?: number;
  longitude?: number;
  locationTimestamp?: string;
  locationHistory?: LocationHistoryEntry[];
}

export interface Product {
  id: string;
  name: string;
  colors: string[];
}

export interface Buyer {
  id: string;
  name: string;
  contact?: string;
  address?: string;
  gstNo?: string;
  addressProof?: string;
  buyerType?: 'retail' | 'wholesale';
}

export interface ScooterUnit {
  id: string; // Unique system ID
  modelName: string;
  color: string;
  sourceChannel?: 'container_freight' | 'local_seller';
  
  // Purchase Fields
  billNo?: string;
  stockInNo?: string;
  
  // Stage 1: Production Entry
  chassisNo: string;
  motorNo: string;
  controllerNo: string;
  frontTireSize?: '10-inch' | '12-inch';
  rearTireSize?: '10-inch' | '12-inch';
  brakeType?: 'Disk' | 'Drum';
  
  // Stage 2: Customization Logs
  tireSize: '10-inch' | '12-inch';
  customizationNotes?: string;
  
  // Stage 3 & 4: POS & Battery Allocation
  buyerName?: string;
  buyerContact?: string;
  batterySerials: string[]; // Up to 6 slots
  batteryWarrantyFlags?: boolean[]; // Marks which batteries are in warranty
  batteryWarrantyMonths?: number[]; // Warranty duration in months (12 or 13, or 0 for none)
  status: 'available' | 'sold' | 'hold';
  saleDate?: string;
  salesPrice?: number;
  heldFor?: string;
  heldBy?: string;
  holdDate?: string;

  // Integrated Charger options
  chargerIncluded?: boolean;
  chargerType?: string;
  chargerSerial?: string;
  chargerWarrantyActive?: boolean;
  chargerWarrantyMonths?: number;
  chargerWarrantyStatus?: 'Active' | 'None';
  
  // Scooter frame warranty options
  scooterWarrantyMonths?: number;
  scooterWarrantyActive?: boolean;
  
  // Stage 5: Warranty Management
  scooterWarrantyStatus: 'Active' | 'Expired' | 'None';
  scooterWarrantyExpiry?: string;
  batteryWarrantyStatus: 'Active' | 'Expired' | 'None';
  batteryWarrantyExpiry?: string;
  warrantyNotes?: string;

  // Sales Fields
  salesBillNo?: string;
  deliveryChallanNo?: string;

  // Audit Trail Metadata
  createdOperator: string;
  createdTimestamp: string;
  lastUpdatedBy?: string;
  lastUpdatedTimestamp: string;
}

export interface StockLog {
  id: string;
  modelName: string;
  color: string;
  type: 'in' | 'out';
  sourceChannel: 'container_freight' | 'local_seller' | 'customer_sale' | 'adjustment';
  quantity: number;
  buyerName?: string;
  timestamp: string;
  operator: string;
  notes?: string;
  billNo?: string;
  stockInNo?: string;
}

export interface SheetConfig {
  webhookUrl: string;
  enabled: boolean;
}

export interface BatterySale {
  id: string;
  buyerName: string;
  batterySeries: string;
  startNo: string;
  endNo: string;
  quantity: number;
  saleDate: string;
  operator: string;
  notes?: string;
  isUnderWarranty?: boolean;
  warrantyDurationMonths?: number;
  status?: 'sold' | 'hold';
  heldFor?: string;
  heldBy?: string;
  holdDate?: string;
  billNo?: string;
  deliveryChallanNo?: string;
  serialNumbers?: string[];
}

export interface BatteryImport {
  id: string;
  batterySeries: string;
  startNo: string;
  endNo: string;
  quantity: number;
  importDate: string;
  operator: string;
  supplierName?: string;
  containerId?: string;
  notes?: string;
  billNo?: string;
  stockInNo?: string;
  serialNumbers?: string[];
  warrantyDurationMonths?: number;
}

export interface ChargerSale {
  id: string;
  buyerName: string;
  chargerType: string;
  startNo?: string;
  endNo?: string;
  quantity: number;
  saleDate: string;
  operator: string;
  notes?: string;
  isUnderWarranty?: boolean;
  warrantyDurationMonths?: number;
  status?: 'sold' | 'hold';
  heldFor?: string;
  heldBy?: string;
  holdDate?: string;
  billNo?: string;
  deliveryChallanNo?: string;
  serialNumbers?: string[];
}

export interface ChargerImport {
  id: string;
  chargerType: string;
  startNo?: string;
  endNo?: string;
  quantity: number;
  importDate: string;
  operator: string;
  supplierName?: string;
  containerId?: string;
  notes?: string;
  billNo?: string;
  stockInNo?: string;
  serialNumbers?: string[];
  warrantyDurationMonths?: number;
}

export interface AuditLog {
  id: string;
  username: string;
  operatorName: string;
  action: string;
  timestamp: string;
  details?: string;
  operator?: string;
  operatorRole?: string;
}

export interface WarrantyClaim {
  id: string;
  claimDate: string;
  originalSaleId: string; // Refers to scooter unit id, or battery sale id, or charger sale id
  originalSaleType: 'scooter' | 'battery' | 'charger';
  originalSerialNo: string; // chassis number or battery serial or charger serial
  buyerName: string;
  buyerContact?: string;
  saleDate?: string;
  warrantyDurationMonths?: number;
  issueDescription: string;
  status: 'under_repair' | 'repaired' | 'exchanged' | 'rejected';
  actionTaken?: 'repaired' | 'exchanged' | 'rejected' | 'pending';
  newSerialNo?: string; // replacement serial number if exchanged
  operatorName: string;
  notes?: string;
  lastUpdatedTimestamp: string;
  replacementWarrantyMonths?: number;
  isBattery?: boolean;
}

export interface DBState {
  users: { [username: string]: User & { passwordHash: string } };
  products: Product[];
  buyers: Buyer[];
  scooterUnits: ScooterUnit[];
  stockLogs: StockLog[];
  sheetConfig: SheetConfig;
  batterySales?: BatterySale[];
  batteryImports?: BatteryImport[];
  chargerSales?: ChargerSale[];
  chargerImports?: ChargerImport[];
  batterySeriesList?: string[];
  chargerTypeList?: string[];
  auditLogs?: AuditLog[];
  warrantyClaims?: WarrantyClaim[];
}
