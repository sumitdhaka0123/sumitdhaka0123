export interface LocationHistoryEntry {
  latitude: number;
  longitude: number;
  timestamp: string;
}

export interface User {
  id: string;
  username: string;
  role: 'admin' | 'manufacturer' | 'salesperson' | 'manager' | 'dispatcher';
  name: string;
  locked?: boolean;
  failedAttempts?: number;
  approved?: boolean;
  latitude?: number;
  longitude?: number;
  locationTimestamp?: string;
  locationHistory?: LocationHistoryEntry[];
  pullLocationRequested?: boolean;
  pullLocationTimestamp?: string;
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
  brakeType?: string;
  
  // Stage 2: Customization Logs
  tireSize: '10-inch' | '12-inch';
  customizationNotes?: string;
  
  // Stage 3 & 4: POS & Battery Allocation
  buyerName?: string;
  buyerContact?: string;
  batterySerials: string[]; // Up to 6 slots
  batteryWarrantyFlags?: boolean[]; // Marks which batteries are in warranty
  batteryWarrantyMonths?: number[]; // Warranty duration in months (12 or 13, or 0 for none)
  status: 'available' | 'sold' | 'hold' | 'incomplete';
  missingParts?: string; // Specific parts or items missing to complete unit
  flaggedIncompleteBy?: string;
  flaggedIncompleteTimestamp?: string;
  preparedTimestamp?: string;
  preparedBy?: string;
  saleDate?: string;
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
  
  // Scooter warranty options
  scooterWarrantyMonths?: number;
  scooterWarrantyActive?: boolean;
  
  // Stage 5: Warranty Management
  scooterWarrantyStatus: 'Active' | 'Expired' | 'None';
  scooterWarrantyExpiry?: string;
  batteryWarrantyStatus: 'Active' | 'Expired' | 'None';
  batteryWarrantyExpiry?: string;
  warrantyNotes?: string;

  // Sales Fields
  salesPrice?: number;
  salesBillNo?: string;
  deliveryChallanNo?: string;
  challanStatus?: 'pending' | 'finished';
  challanFinishedBy?: string;
  challanFinishedTimestamp?: string;

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
  buyerContact?: string;
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
  challanStatus?: 'pending' | 'finished';
  challanFinishedBy?: string;
  challanFinishedTimestamp?: string;
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
  buyerContact?: string;
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
  challanStatus?: 'pending' | 'finished';
  challanFinishedBy?: string;
  challanFinishedTimestamp?: string;
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
  claimedComponent?: 'controller' | 'motor' | 'scooter_frame' | 'battery' | 'charger';
  modelName?: string;
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
  collectedDate?: string;
  specialistNotes?: string;
  supplierName?: string;
  containerId?: string;
  sourceBillNo?: string;
  stockInNo?: string;
  supplierWarrantyStatus?: string;
}

export interface SalesOrderItem {
  id: string;
  itemType: 'scooter' | 'battery' | 'charger';
  
  // Scooter details:
  productName?: string; // e.g., "City XL", "BMW"
  color?: string;       // e.g., "Matte Black", "Red"
  
  // Battery details:
  batteryType?: string; // e.g., "60V 28Ah Lithium"
  
  // Charger details:
  chargerType?: string; // e.g., "60V 5A Charger"

  quantity: number;
  
  // Fulfillment & Dispatch state:
  chassisNumbers?: string[]; // Chassis numbers assigned during dispatch
  isUnderWarranty?: boolean;  // Battery / Charger warranty flag
  warrantyMonths?: number;    // Warranty duration in months
  serialNumbers?: string[];   // Battery / Charger serial numbers if under warranty
  startNo?: string;           // Start serial number of series
  endNo?: string;             // End serial number of series
  
  preparedQuantity?: number;
}

export interface SalesOrder {
  id: string;
  orderNo: string; // e.g., ORD-1001
  buyerName: string;
  buyerContact?: string;
  deliveryLocation?: string; // Delivery address/destination for truck dispatch
  salespersonName: string;
  salespersonUsername: string;
  createdTimestamp: string;
  
  items: SalesOrderItem[];
  
  status: 'pending' | 'prepared' | 'dispatched' | 'challan_generated' | 'cancelled';
  
  preparedTimestamp?: string;
  preparedBy?: string;
  dispatchedTimestamp?: string;
  dispatchedBy?: string;
  cancelledBy?: string;
  cancelledTimestamp?: string;
  
  // Manager / Challan verification
  challanNo?: string; // MANDATORY for Manager verification
  salesBillNo?: string;
  challanFinishedBy?: string;
  challanFinishedTimestamp?: string;
  challanLocked?: boolean; // Locked for Manager once saved; only Owner can unlock
  
  notes?: string;
}

export interface DriveConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  connectedEmail: string;
  autoSync: boolean;
  folderId: string;
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
  salesOrders?: SalesOrder[];
  unassembledBoxedStock?: number;
  driveConfig?: DriveConfig;
}
