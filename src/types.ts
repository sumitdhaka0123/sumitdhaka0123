export interface User {
  id: string;
  username: string;
  role: 'admin' | 'manufacturer' | 'salesperson';
  name: string;
  locked?: boolean;
  failedAttempts?: number;
  approved?: boolean;
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
}

export interface ScooterUnit {
  id: string; // Unique system ID
  modelName: string;
  color: string;
  
  // Stage 1: Production Entry
  chassisNo: string;
  motorNo: string;
  controllerNo: string;
  frontTireSize?: '10-inch' | '12-inch';
  rearTireSize?: '10-inch' | '12-inch';
  
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
  
  // Stage 5: Warranty Management
  scooterWarrantyStatus: 'Active' | 'Expired' | 'None';
  scooterWarrantyExpiry?: string;
  batteryWarrantyStatus: 'Active' | 'Expired' | 'None';
  batteryWarrantyExpiry?: string;
  warrantyNotes?: string;

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
}
