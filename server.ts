import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { DBState, User, Product, Buyer, ScooterUnit, StockLog, SheetConfig, BatterySale, BatteryImport, ChargerSale, ChargerImport } from './src/types';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { z } from 'zod';

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(process.cwd(), 'warehouse_db.json');

// Initialize Firebase using the configuration file
let firebaseApp: any = null;
let firebaseDb: any = null;
try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    firebaseApp = initializeApp(firebaseConfig);
    firebaseDb = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
    console.log('Firebase initialized successfully with project ID:', firebaseConfig.projectId);
  } else {
    console.warn('Firebase configuration file not found at:', configPath);
  }
} catch (error) {
  console.error('Error initializing Firebase in server:', error);
}

let globalDBState: DBState | null = null;


app.use(express.json());

// Helper to write to Google Sheets Webhook asynchronously
async function postToGoogleSheets(webhookUrl: string, payload: any) {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    return response.ok;
  } catch (error) {
    console.error('Error syncing to Google Sheets:', error);
    return false;
  }
}

const PRODUCT_MAPPING = {
  id: ['ID', 'id', 'Product ID'],
  name: ['Name', 'Model Name', 'Model', 'name'],
  colors: ['Colors', 'Color List', 'colors']
};

const BUYER_MAPPING = {
  id: ['ID', 'id', 'Buyer ID'],
  name: ['Name', 'Buyer Name', 'name'],
  contact: ['Contact', 'Contact Info', 'Phone', 'contact']
};

const SCOOTER_UNIT_MAPPING = {
  id: ['ID', 'id'],
  modelName: ['Model', 'Model Name', 'modelName'],
  color: ['Color', 'color'],
  chassisNo: ['Chassis No', 'Chassis Number', 'ChassisNo'],
  motorNo: ['Motor No', 'Motor Number', 'MotorNo'],
  controllerNo: ['Controller No', 'Controller Number', 'ControllerNo'],
  tireSize: ['Tires', 'Tire Size', 'tireSize'],
  buyerName: ['Buyer Name', 'Buyer', 'buyerName'],
  buyerContact: ['Buyer Contact', 'Contact', 'buyerContact'],
  salesPrice: ['Sale Price', 'Sales Price', 'Price', 'salesPrice'],
  batterySerials: ['Battery Serials', 'Battery Serial', 'batterySerials'],
  status: ['Status', 'status'],
  scooterWarrantyStatus: ['Scooter Warranty', 'Scooter Warranty Status', 'scooterWarrantyStatus'],
  batteryWarrantyStatus: ['Battery Warranty', 'Battery Warranty Status', 'batteryWarrantyStatus'],
  lastUpdatedTimestamp: ['Last Updated', 'LastUpdated', 'lastUpdatedTimestamp'],
  createdOperator: ['Created By', 'CreatedBy', 'Operator', 'createdOperator']
};

const STOCK_LOG_MAPPING = {
  id: ['ID', 'id'],
  modelName: ['Model', 'modelName'],
  color: ['Color', 'color'],
  type: ['Type', 'type'],
  sourceChannel: ['Source Channel', 'SourceChannel'],
  quantity: ['Quantity', 'Qty', 'quantity'],
  buyerName: ['Buyer', 'Buyer Name', 'buyerName'],
  timestamp: ['Timestamp', 'Date', 'timestamp'],
  operator: ['Operator', 'User', 'operator'],
  notes: ['Notes', 'Note', 'notes']
};

const BATTERY_SALE_MAPPING = {
  id: ['Sale ID', 'ID', 'id'],
  buyerName: ['Buyer Name', 'buyerName', 'Buyer'],
  batterySeries: ['Battery Series', 'batterySeries'],
  startNo: ['Start Serial No', 'startNo', 'Start Serial'],
  endNo: ['End Serial No', 'endNo', 'End Serial'],
  quantity: ['Quantity', 'quantity', 'Qty'],
  saleDate: ['Sale Date', 'saleDate', 'Date'],
  operator: ['Operator', 'operator', 'User'],
  notes: ['Notes', 'notes', 'Note'],
  isUnderWarranty: ['Under Warranty', 'isUnderWarranty'],
  warrantyDurationMonths: ['Warranty Months', 'warrantyDurationMonths'],
  status: ['Status', 'status'],
  heldFor: ['Held For', 'heldFor'],
  heldBy: ['Held By', 'heldBy'],
  holdDate: ['Hold Date', 'holdDate']
};

const BATTERY_IMPORT_MAPPING = {
  id: ['Import ID', 'ID', 'id'],
  batterySeries: ['Battery Series', 'batterySeries'],
  startNo: ['Start Serial No', 'startNo', 'Start Serial'],
  endNo: ['End Serial No', 'endNo', 'End Serial'],
  quantity: ['Quantity', 'quantity', 'Qty'],
  importDate: ['Import Date', 'importDate', 'Date'],
  operator: ['Operator', 'operator', 'User'],
  supplierName: ['Supplier Name', 'supplierName'],
  containerId: ['Container ID', 'containerId'],
  notes: ['Notes', 'notes', 'Note']
};

async function parseGoogleSheetTab(spreadsheetId: string, sheetName: string): Promise<any[]> {
  const sheetParam = sheetName ? `&sheet=${encodeURIComponent(sheetName)}` : '';
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json${sheetParam}`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      }
    });
    if (!res.ok) {
      console.warn(`Failed to fetch tab ${sheetName || 'default'} with status ${res.status}`);
      return [];
    }
    const text = await res.text();
    const startIdx = text.indexOf('{');
    const endIdx = text.lastIndexOf('}');
    if (startIdx === -1 || endIdx === -1) {
      console.warn(`Response for tab ${sheetName || 'default'} was not JSON:`, text.slice(0, 100));
      return [];
    }
    const jsonStr = text.slice(startIdx, endIdx + 1);
    const json = JSON.parse(jsonStr);
    
    if (json.status === 'error') {
      console.warn(`Google visualization query error for tab ${sheetName || 'default'}:`, json.errors);
      return [];
    }

    if (!json.table || !json.table.rows || !json.table.cols) {
      console.warn(`Table, rows or cols not found in tab ${sheetName || 'default'}`);
      return [];
    }
    
    const cols = json.table.cols.map((c: any, index: number) => {
      return {
        label: c.label ? c.label.trim() : `Col${index}`,
        index
      };
    });
    
    return json.table.rows.map((row: any) => {
      const item: any = {};
      cols.forEach((col: any) => {
        const cell = row.c && row.c[col.index];
        item[col.label] = cell ? (cell.v !== null && cell.v !== undefined ? cell.v : '') : '';
      });
      return item;
    });
  } catch (err) {
    console.error(`Error parsing tab ${sheetName || 'default'} from Google Sheet:`, err);
    return [];
  }
}

async function pullTabWithFallbacks(spreadsheetId: string, possibleNames: string[]): Promise<any[]> {
  for (const name of possibleNames) {
    const rows = await parseGoogleSheetTab(spreadsheetId, name);
    if (rows && rows.length > 0) {
      console.log(`Successfully found and pulled tab: ${name}`);
      return rows;
    }
  }
  return [];
}

function mapNormalizedRow(row: any, fieldMapping: { [field: string]: string[] }) {
  const result: any = {};
  const normalizedRow: { [normKey: string]: any } = {};
  
  for (const [k, v] of Object.entries(row)) {
    normalizedRow[k.toLowerCase().replace(/[^a-z0-9]/g, '')] = v;
  }
  
  for (const [field, synonyms] of Object.entries(fieldMapping)) {
    let val = null;
    for (const syn of synonyms) {
      const normSyn = syn.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normalizedRow[normSyn] !== undefined && normalizedRow[normSyn] !== null) {
        val = normalizedRow[normSyn];
        break;
      }
    }
    
    if (val === undefined || val === null) {
      val = '';
    }
    
    if (field === 'colors' || field === 'batterySerials') {
      result[field] = val ? val.toString().split(',').map((c: string) => c.trim()).filter(Boolean) : [];
    } else if (field === 'quantity' || field === 'salesPrice' || field === 'availableStock' || field === 'buyingPrice' || field === 'warrantyDurationMonths') {
      result[field] = (val !== '' && !isNaN(Number(val))) ? Number(val) : 0;
    } else if (field === 'isUnderWarranty') {
      result[field] = val ? (val.toString().toLowerCase() === 'yes' || val === true) : false;
    } else {
      result[field] = val;
    }
  }
  return result;
}

// Helper to pull from Google Sheets Webhook via GET or parsed Google Sheet direct URL
async function pullFromGoogleSheets(webhookUrl: string) {
  if (!webhookUrl) return null;
  
  // 1. Check if this is a direct Google Sheet link instead of an Apps Script Web App
  if (webhookUrl.includes('docs.google.com/spreadsheets')) {
    try {
      console.log('Detected Google Sheets Direct URL. Parsing spreadsheet directly from viz query API...');
      const match = webhookUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (!match) {
        console.error('Invalid Google Sheets URL format. Could not extract spreadsheet ID.');
        return null;
      }
      
      const spreadsheetId = match[1];
      
      // Pull each tab with a list of robust possible fallbacks
      let productsRows = await pullTabWithFallbacks(spreadsheetId, ["Products", "products", "Product", "product"]);
      let buyersRows = await pullTabWithFallbacks(spreadsheetId, ["Buyers", "buyers", "Buyer", "buyer"]);
      let scooterUnitsRows = await pullTabWithFallbacks(spreadsheetId, ["ScooterUnits", "scooterUnits", "Scooter Units", "ScooterUnit", "scooterUnit"]);
      let stockLogsRows = await pullTabWithFallbacks(spreadsheetId, ["StockLogs", "stockLogs", "Stock Logs", "StockLog", "stockLog"]);
      let batterySalesRows = await pullTabWithFallbacks(spreadsheetId, ["BatterySales", "batterySales", "Battery Sales", "BatterySale", "batterysales"]);
      let batteryImportsRows = await pullTabWithFallbacks(spreadsheetId, ["BatteryImports", "batteryImports", "Battery Imports", "BatteryImport", "batteryimports"]);
      
      // If absolutely everything is empty, try fetching the first tab of the spreadsheet by default
      if (productsRows.length === 0 && buyersRows.length === 0 && scooterUnitsRows.length === 0 && stockLogsRows.length === 0 && batterySalesRows.length === 0 && batteryImportsRows.length === 0) {
        console.log('No matching tabs found. Fetching the default (first) sheet tab as fallback...');
        const firstSheetRows = await parseGoogleSheetTab(spreadsheetId, '');
        if (firstSheetRows && firstSheetRows.length > 0) {
          // Detect what type of data is in the first sheet based on matching headers
          const firstRow = firstSheetRows[0];
          const keys = Object.keys(firstRow).map(k => k.toLowerCase().replace(/[^a-z0-9]/g, ''));
          
          // Check match counts for each schema mapping
          const countMatches = (mapping: { [field: string]: string[] }) => {
            let matches = 0;
            for (const synonyms of Object.values(mapping)) {
              const matched = synonyms.some(syn => keys.includes(syn.toLowerCase().replace(/[^a-z0-9]/g, '')));
              if (matched) matches++;
            }
            return matches;
          };

          const prodMatches = countMatches(PRODUCT_MAPPING);
          const unitMatches = countMatches(SCOOTER_UNIT_MAPPING);
          const buyerMatches = countMatches(BUYER_MAPPING);
          const logMatches = countMatches(STOCK_LOG_MAPPING);

          console.log(`Auto-detection match counts: Products=${prodMatches}, Units=${unitMatches}, Buyers=${buyerMatches}, Logs=${logMatches}`);

          // Pick the mapping with the highest match count (must have at least 1 match)
          const maxMatches = Math.max(prodMatches, unitMatches, buyerMatches, logMatches);
          if (maxMatches >= 1) {
            if (maxMatches === prodMatches) {
              console.log('Detected Products schema in first sheet!');
              productsRows = firstSheetRows;
            } else if (maxMatches === unitMatches) {
              console.log('Detected Scooter Units schema in first sheet!');
              scooterUnitsRows = firstSheetRows;
            } else if (maxMatches === buyerMatches) {
              console.log('Detected Buyers schema in first sheet!');
              buyersRows = firstSheetRows;
            } else if (maxMatches === logMatches) {
              console.log('Detected Stock Logs schema in first sheet!');
              stockLogsRows = firstSheetRows;
            }
          }
        }
      }

      // Map rows with synonyms
      const products = productsRows.map(row => mapNormalizedRow(row, PRODUCT_MAPPING)).filter(p => p.name);
      const buyers = buyersRows.map(row => mapNormalizedRow(row, BUYER_MAPPING)).filter(b => b.name);
      const scooterUnits = scooterUnitsRows.map(row => mapNormalizedRow(row, SCOOTER_UNIT_MAPPING)).filter(u => u.modelName);
      const stockLogs = stockLogsRows.map(row => mapNormalizedRow(row, STOCK_LOG_MAPPING)).filter(l => l.modelName);
      const batterySales = batterySalesRows.map(row => mapNormalizedRow(row, BATTERY_SALE_MAPPING)).filter(s => s.batterySeries);
      const batteryImports = batteryImportsRows.map(row => mapNormalizedRow(row, BATTERY_IMPORT_MAPPING)).filter(imp => imp.batterySeries);
      
      // If we got nothing at all, return null
      if (products.length === 0 && buyers.length === 0 && scooterUnits.length === 0 && stockLogs.length === 0 && batterySales.length === 0 && batteryImports.length === 0) {
        console.warn('Google Sheet was read, but no expected columns or tabs matched. Make sure to share the Google Sheet as "Anyone with link can view".');
        return null;
      }
      
      console.log(`Direct Google Sheet parse result: ${products.length} products, ${buyers.length} buyers, ${scooterUnits.length} units, ${stockLogs.length} logs, ${batterySales.length} battery sales, ${batteryImports.length} battery imports.`);
      
      return {
        products,
        buyers,
        scooterUnits,
        stockLogs,
        batterySales,
        batteryImports
      };
    } catch (err) {
      console.error('Error parsing Google Sheet directly:', err);
      return null;
    }
  }

  // 2. Otherwise, treat as an Apps Script Web App URL and execute the standard GET pull
  try {
    console.log('Attempting to pull latest data from Google Sheet Apps Script Web App:', webhookUrl);
    
    let currentUrl = webhookUrl;
    let redirects = 0;
    const maxRedirects = 5;
    let response: any = null;

    while (redirects < maxRedirects) {
      response = await fetch(currentUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*'
        },
        redirect: 'manual'
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) {
          console.warn(`Redirect status ${response.status} received but no location header found.`);
          break;
        }
        currentUrl = new URL(location, currentUrl).toString();
        redirects++;
        console.log(`Following redirect to: ${currentUrl}`);
        continue;
      }
      break;
    }

    if (!response) {
      console.error('No response received from Google Sheets URL.');
      return null;
    }

    if (!response.ok) {
      console.error('Failed to fetch from Google Sheet Webapp:', response.statusText, 'Status:', response.status);
      return null;
    }

    const contentType = response.headers.get('content-type') || '';
    const responseText = await response.text();

    if (!contentType.includes('application/json') && !responseText.trim().startsWith('{')) {
      console.error('Expected JSON response but received non-JSON/HTML content:', responseText.slice(0, 500));
      return null;
    }

    const result = JSON.parse(responseText);
    if (result && result.success && result.data) {
      console.log('Successfully pulled data from Google Sheet Webapp!');
      return result.data;
    } else {
      console.error('Failed to parse Google Sheet data or success is false:', result);
      return null;
    }
  } catch (error) {
    console.error('Error fetching data from Google Sheet Webapp:', error);
    return null;
  }
}

// Compute real-time summary statistics for Google Sheets
function getSummaryData(db: DBState) {
  const stockLogs = db.stockLogs || [];
  const scooterUnits = db.scooterUnits || [];
  const products = db.products || [];

  const totalImported = stockLogs
    .filter(log => log.type === 'in')
    .reduce((sum, log) => sum + log.quantity, 0);

  const totalAssembled = scooterUnits.length;
  const yetToBeAssembled = Math.max(0, totalImported - totalAssembled);
  const availableStock = scooterUnits.filter(u => u.status === 'available').length;
  const totalHeld = scooterUnits.filter(u => u.status === 'hold').length;
  const totalSold = scooterUnits.filter(u => u.status === 'sold').length;

  const currentYear = new Date().getFullYear();
  const soldThisYear = scooterUnits.filter(u => {
    if (u.status !== 'sold' || !u.saleDate) return false;
    try {
      return new Date(u.saleDate).getFullYear() === currentYear;
    } catch {
      return false;
    }
  }).length;

  const stage1AssembledOnly = scooterUnits.filter(
    u => u.status === 'available' && u.batterySerials.length === 0
  ).length;

  const stage1WithBatteries = scooterUnits.filter(
    u => u.status === 'available' && u.batterySerials.length > 0
  ).length;

  const stage2Customized = scooterUnits.filter(
    u => u.tireSize === '10-inch' || (u.customizationNotes && u.customizationNotes.trim() !== '')
  ).length;

  const summaryStats = [
    { metric: "Total Imported (Logs)", value: totalImported, description: "Total raw generic incoming stock received via imports" },
    { metric: "Assembled Stock Registered", value: totalAssembled, description: "Total units registered with unique Chassis & Motor serials" },
    { metric: "Left in Warehouse (Available)", value: availableStock, description: "Physical finished units currently available in warehouse" },
    { metric: "Reserved Stock (On Hold)", value: totalHeld, description: "Total physical units currently placed on hold for specific customers" },
    { metric: "Raw Unprepared (Not Assembled)", value: yetToBeAssembled, description: "Imported stock waiting for serial registration" },
    { metric: "Total Sold (Dispatched)", value: totalSold, description: "Total units sold and dispatched" },
    { metric: "Sold This Year (" + currentYear + ")", value: soldThisYear, description: "Total units sold and dispatched during the current calendar year" },
    { metric: "Stage 1 (Frame Only)", value: stage1AssembledOnly, description: "Available physical units with no battery assigned" },
    { metric: "Stage 1 (With Batteries)", value: stage1WithBatteries, description: "Available physical units with batteries assigned" },
    { metric: "Stage 2 Customized", value: stage2Customized, description: "Available physical units with non-standard tires or customization" }
  ];

  const colorBreakdown: any[] = [];
  products.forEach(p => {
    p.colors.forEach(c => {
      const avail = scooterUnits.filter(u => u.modelName === p.name && u.color === c && u.status === 'available').length;
      const sold = scooterUnits.filter(u => u.modelName === p.name && u.color === c && u.status === 'sold').length;
      const totalReg = scooterUnits.filter(u => u.modelName === p.name && u.color === c).length;
      const imported = stockLogs
        .filter(log => log.modelName === p.name && log.color === c && log.type === 'in')
        .reduce((sum, log) => sum + log.quantity, 0);

      colorBreakdown.push({
        modelName: p.name,
        color: c,
        availableStock: avail,
        soldStock: sold,
        totalRegistered: totalReg,
        importedQty: imported
      });
    });
  });

  return { summaryStats, colorBreakdown };
}

// Initial Database Seeding
const DEFAULT_PRODUCTS: Product[] = [];

const DEFAULT_BUYERS: Buyer[] = [];

const DEFAULT_USERS: { [username: string]: User & { passwordHash: string } } = {
  admin: {
    id: 'u-admin',
    username: 'admin',
    passwordHash: 'admin123', // Demo credentials
    role: 'admin',
    name: 'Warehouse Owner / Admin',
    approved: true
  },
  manufacturer: {
    id: 'u-manu',
    username: 'manufacturer',
    passwordHash: 'manu123',
    role: 'manufacturer',
    name: 'Production Specialist (MFR)',
    approved: true
  },
  sales: {
    id: 'u-sales',
    username: 'sales',
    passwordHash: 'sales123',
    role: 'salesperson',
    name: 'Sales Representative (POS)',
    approved: true
  }
};

function readDBFromFile(): DBState {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      const parsed = JSON.parse(data);
      
      // Upgrade logic to preserve legacy assemblies if any, converting them to ScooterUnits
      const legacyUnits: ScooterUnit[] = [];
      if (parsed.assemblies && Array.isArray(parsed.assemblies)) {
        parsed.assemblies.forEach((a: any) => {
          legacyUnits.push({
            id: a.id || `scoot-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            modelName: a.modelName || 'Volt S-1',
            color: a.color || 'Matte Black',
            chassisNo: a.chassisNo || 'CH-LEGACY',
            motorNo: a.motorNo || 'MT-LEGACY',
            controllerNo: a.controllerNo || 'CT-LEGACY',
            tireSize: '12-inch',
            batterySerials: a.batteryNo ? [a.batteryNo] : [],
            status: a.status === 'completed' ? 'sold' : 'available',
            buyerName: a.p1Operator ? 'Legacy Buyer' : undefined,
            scooterWarrantyStatus: a.batteryWarranty ? 'Active' : 'None',
            batteryWarrantyStatus: a.batteryWarranty ? 'Active' : 'None',
            createdOperator: a.p2Operator || a.p1Operator || 'system',
            createdTimestamp: a.p2Timestamp || a.p1Timestamp || new Date().toISOString(),
            lastUpdatedTimestamp: a.lastUpdated || new Date().toISOString()
          });
        });
      }

      const loadedUsers = parsed.users || DEFAULT_USERS;
      
      // Normalize any legacy role names ('person1' and 'person2') to supported ones
      Object.keys(loadedUsers).forEach((uname) => {
        const u = loadedUsers[uname];
        if (u.role === 'person1' || u.role === 'person2' || (u.role as string) === 'mfr' || (u.role as string) === 'pos') {
          u.role = u.username === 'person2' ? 'manufacturer' : 'salesperson';
        }
        if (u.approved === undefined) {
          u.approved = true;
        }
      });

      const mergedUsers = { ...DEFAULT_USERS, ...loadedUsers };
      const sheetUrl = process.env.GOOGLE_SHEET_WEBHOOK_URL || parsed.sheetConfig?.webhookUrl || '';
      const sheetEnabled = process.env.GOOGLE_SHEET_WEBHOOK_URL ? true : (parsed.sheetConfig?.enabled ?? false);

      return {
        users: mergedUsers,
        products: parsed.products || DEFAULT_PRODUCTS,
        buyers: parsed.buyers || DEFAULT_BUYERS,
        scooterUnits: parsed.scooterUnits || legacyUnits || [],
        stockLogs: parsed.stockLogs || [],
        sheetConfig: { webhookUrl: sheetUrl, enabled: sheetEnabled },
        batterySales: parsed.batterySales || [],
        batteryImports: parsed.batteryImports || [],
        chargerSales: parsed.chargerSales || [],
        chargerImports: parsed.chargerImports || [],
        batterySeriesList: parsed.batterySeriesList || ['Alpha Series', 'Beta Series', 'Delta Series', 'Omega Series', 'Pro-Pack Series'],
        chargerTypeList: parsed.chargerTypeList || ['48V Charger', '60V Charger', '72V Charger'],
        auditLogs: parsed.auditLogs || []
      };
    }
  } catch (err) {
    console.error('Error reading warehouse database file, returning defaults:', err);
  }

  const sheetUrl = process.env.GOOGLE_SHEET_WEBHOOK_URL || '';
  const sheetEnabled = !!process.env.GOOGLE_SHEET_WEBHOOK_URL;

  return {
    users: DEFAULT_USERS,
    products: DEFAULT_PRODUCTS,
    buyers: DEFAULT_BUYERS,
    scooterUnits: [],
    stockLogs: [],
    sheetConfig: { webhookUrl: sheetUrl, enabled: sheetEnabled },
    batterySales: [],
    batteryImports: [],
    chargerSales: [],
    chargerImports: [],
    batterySeriesList: ['Alpha Series', 'Beta Series', 'Delta Series', 'Omega Series', 'Pro-Pack Series'],
    chargerTypeList: ['48V Charger', '60V Charger', '72V Charger'],
    auditLogs: []
  };
}

function readDB(): DBState {
  if (globalDBState) {
    return globalDBState;
  }
  globalDBState = readDBFromFile();
  return globalDBState;
}

function cleanForFirestore(obj: any): any {
  if (obj === null || obj === undefined) {
    return null;
  }
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch (err) {
    console.error('Error cleaning object for Firestore:', err);
    return obj;
  }
}

async function seedFirestore(state: DBState) {
  if (!firebaseDb) return;
  try {
    console.log('Seeding Firestore collections...');
    const promises: Promise<any>[] = [];

    for (const [username, user] of Object.entries(state.users)) {
      promises.push(setDoc(doc(firebaseDb, 'users', username), cleanForFirestore(user)));
    }
    for (const prod of state.products) {
      promises.push(setDoc(doc(firebaseDb, 'products', prod.id), cleanForFirestore(prod)));
    }
    for (const buyer of state.buyers) {
      promises.push(setDoc(doc(firebaseDb, 'buyers', buyer.id), cleanForFirestore(buyer)));
    }
    for (const unit of state.scooterUnits) {
      promises.push(setDoc(doc(firebaseDb, 'scooterUnits', unit.id), cleanForFirestore(unit)));
    }
    for (const log of state.stockLogs) {
      promises.push(setDoc(doc(firebaseDb, 'stockLogs', log.id), cleanForFirestore(log)));
    }
    if (state.batterySales) {
      for (const sale of state.batterySales) {
        promises.push(setDoc(doc(firebaseDb, 'batterySales', sale.id), cleanForFirestore(sale)));
      }
    }
    if (state.batteryImports) {
      for (const imp of state.batteryImports) {
        promises.push(setDoc(doc(firebaseDb, 'batteryImports', imp.id), cleanForFirestore(imp)));
      }
    }
    if (state.chargerSales) {
      for (const sale of state.chargerSales) {
        promises.push(setDoc(doc(firebaseDb, 'chargerSales', sale.id), cleanForFirestore(sale)));
      }
    }
    if (state.chargerImports) {
      for (const imp of state.chargerImports) {
        promises.push(setDoc(doc(firebaseDb, 'chargerImports', imp.id), cleanForFirestore(imp)));
      }
    }
    if (state.batterySeriesList) {
      promises.push(setDoc(doc(firebaseDb, 'config', 'batterySeriesList'), cleanForFirestore({ list: state.batterySeriesList })));
    }
    if (state.chargerTypeList) {
      promises.push(setDoc(doc(firebaseDb, 'config', 'chargerTypeList'), cleanForFirestore({ list: state.chargerTypeList })));
    }
    if (state.auditLogs) {
      for (const log of state.auditLogs) {
        promises.push(setDoc(doc(firebaseDb, 'auditLogs', log.id), cleanForFirestore(log)));
      }
    }
    promises.push(setDoc(doc(firebaseDb, 'config', 'sheetConfig'), cleanForFirestore(state.sheetConfig)));

    await Promise.all(promises);
    console.log('Firestore successfully seeded with default/legacy data!');
  } catch (error) {
    console.error('Error seeding Firestore on startup:', error);
  }
}

async function hydrateFromFirestore(): Promise<DBState | null> {
  if (!firebaseDb) return null;
  try {
    console.log('Hydrating database from Firestore...');
    const [
      usersSnap,
      productsSnap,
      buyersSnap,
      scooterUnitsSnap,
      stockLogsSnap,
      batterySalesSnap,
      batteryImportsSnap,
      chargerSalesSnap,
      chargerImportsSnap,
      batterySeriesListSnap,
      chargerTypeListSnap,
      auditLogsSnap,
      sheetConfigSnap
    ] = await Promise.all([
      getDocs(collection(firebaseDb, 'users')),
      getDocs(collection(firebaseDb, 'products')),
      getDocs(collection(firebaseDb, 'buyers')),
      getDocs(collection(firebaseDb, 'scooterUnits')),
      getDocs(collection(firebaseDb, 'stockLogs')),
      getDocs(collection(firebaseDb, 'batterySales')),
      getDocs(collection(firebaseDb, 'batteryImports')),
      getDocs(collection(firebaseDb, 'chargerSales')),
      getDocs(collection(firebaseDb, 'chargerImports')),
      getDoc(doc(firebaseDb, 'config', 'batterySeriesList')),
      getDoc(doc(firebaseDb, 'config', 'chargerTypeList')),
      getDocs(collection(firebaseDb, 'auditLogs')),
      getDoc(doc(firebaseDb, 'config', 'sheetConfig'))
    ]);

    const isEmpty = usersSnap.empty && productsSnap.empty && buyersSnap.empty && scooterUnitsSnap.empty;
    if (isEmpty) {
      console.log('Firestore is empty. Migrating local JSON data...');
      const localDB = readDBFromFile();
      await seedFirestore(localDB);
      return localDB;
    }

    const users: any = {};
    usersSnap.forEach(d => {
      const data = d.data();
      if (data.approved === undefined) {
        data.approved = true;
      }
      users[d.id] = data;
    });

    const products: any[] = [];
    productsSnap.forEach(d => {
      products.push(d.data());
    });

    const buyers: any[] = [];
    buyersSnap.forEach(d => {
      buyers.push(d.data());
    });

    const scooterUnits: any[] = [];
    scooterUnitsSnap.forEach(d => {
      scooterUnits.push(d.data());
    });

    const stockLogs: any[] = [];
    stockLogsSnap.forEach(d => {
      stockLogs.push(d.data());
    });

    const batterySales: any[] = [];
    batterySalesSnap.forEach(d => {
      batterySales.push(d.data());
    });

    const batteryImports: any[] = [];
    batteryImportsSnap.forEach(d => {
      batteryImports.push(d.data());
    });

    const chargerSales: any[] = [];
    chargerSalesSnap.forEach(d => {
      chargerSales.push(d.data());
    });

    const chargerImports: any[] = [];
    chargerImportsSnap.forEach(d => {
      chargerImports.push(d.data());
    });

    let batterySeriesList = ['Alpha Series', 'Beta Series', 'Delta Series', 'Omega Series', 'Pro-Pack Series'];
    if (batterySeriesListSnap.exists()) {
      batterySeriesList = (batterySeriesListSnap.data() as any).list || batterySeriesList;
    }

    let chargerTypeList = ['48V Charger', '60V Charger', '72V Charger'];
    if (chargerTypeListSnap.exists()) {
      chargerTypeList = (chargerTypeListSnap.data() as any).list || chargerTypeList;
    }

    const auditLogs: any[] = [];
    auditLogsSnap.forEach(d => {
      auditLogs.push(d.data());
    });

    // Sort logs chronologically to keep original sorting
    auditLogs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    stockLogs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    let sheetConfig = { webhookUrl: '', enabled: false };
    if (sheetConfigSnap.exists()) {
      sheetConfig = sheetConfigSnap.data() as any;
    }

    const state: DBState = {
      users,
      products,
      buyers,
      scooterUnits,
      stockLogs,
      sheetConfig,
      batterySales,
      batteryImports,
      chargerSales,
      chargerImports,
      batterySeriesList,
      chargerTypeList,
      auditLogs
    };

    // Keep backup JSON file updated
    fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), 'utf8');
    return state;
  } catch (err) {
    console.error('Error loading data from Firestore, falling back to local file:', err);
    return null;
  }
}

async function syncToFirestore(state: DBState) {
  if (!firebaseDb) return;
  try {
    // Sync users deletions
    const usersSnap = await getDocs(collection(firebaseDb, 'users'));
    const currentUsernames = new Set(Object.keys(state.users));
    for (const uDoc of usersSnap.docs) {
      if (!currentUsernames.has(uDoc.id)) {
        await deleteDoc(doc(firebaseDb, 'users', uDoc.id));
      }
    }

    // Sync battery sales deletions
    const salesSnap = await getDocs(collection(firebaseDb, 'batterySales'));
    const currentSalesIds = new Set((state.batterySales || []).map(s => s.id));
    for (const sDoc of salesSnap.docs) {
      if (!currentSalesIds.has(sDoc.id)) {
        await deleteDoc(doc(firebaseDb, 'batterySales', sDoc.id));
      }
    }

    // Sync charger sales deletions
    const chargerSalesSnap = await getDocs(collection(firebaseDb, 'chargerSales'));
    const currentChargerSalesIds = new Set((state.chargerSales || []).map(s => s.id));
    for (const cDoc of chargerSalesSnap.docs) {
      if (!currentChargerSalesIds.has(cDoc.id)) {
        await deleteDoc(doc(firebaseDb, 'chargerSales', cDoc.id));
      }
    }

    const promises: Promise<any>[] = [];
    for (const [username, user] of Object.entries(state.users)) {
      promises.push(setDoc(doc(firebaseDb, 'users', username), cleanForFirestore(user)));
    }
    for (const prod of state.products) {
      promises.push(setDoc(doc(firebaseDb, 'products', prod.id), cleanForFirestore(prod)));
    }
    for (const buyer of state.buyers) {
      promises.push(setDoc(doc(firebaseDb, 'buyers', buyer.id), cleanForFirestore(buyer)));
    }
    for (const unit of state.scooterUnits) {
      promises.push(setDoc(doc(firebaseDb, 'scooterUnits', unit.id), cleanForFirestore(unit)));
    }
    for (const log of state.stockLogs) {
      promises.push(setDoc(doc(firebaseDb, 'stockLogs', log.id), cleanForFirestore(log)));
    }
    if (state.batterySales) {
      for (const sale of state.batterySales) {
        promises.push(setDoc(doc(firebaseDb, 'batterySales', sale.id), cleanForFirestore(sale)));
      }
    }
    if (state.batteryImports) {
      for (const imp of state.batteryImports) {
        promises.push(setDoc(doc(firebaseDb, 'batteryImports', imp.id), cleanForFirestore(imp)));
      }
    }
    if (state.chargerSales) {
      for (const sale of state.chargerSales) {
        promises.push(setDoc(doc(firebaseDb, 'chargerSales', sale.id), cleanForFirestore(sale)));
      }
    }
    if (state.chargerImports) {
      for (const imp of state.chargerImports) {
        promises.push(setDoc(doc(firebaseDb, 'chargerImports', imp.id), cleanForFirestore(imp)));
      }
    }
    if (state.batterySeriesList) {
      promises.push(setDoc(doc(firebaseDb, 'config', 'batterySeriesList'), cleanForFirestore({ list: state.batterySeriesList })));
    }
    if (state.chargerTypeList) {
      promises.push(setDoc(doc(firebaseDb, 'config', 'chargerTypeList'), cleanForFirestore({ list: state.chargerTypeList })));
    }
    if (state.auditLogs) {
      for (const log of state.auditLogs) {
        promises.push(setDoc(doc(firebaseDb, 'auditLogs', log.id), cleanForFirestore(log)));
      }
    }
    promises.push(setDoc(doc(firebaseDb, 'config', 'sheetConfig'), cleanForFirestore(state.sheetConfig)));

    await Promise.all(promises);
  } catch (error) {
    console.error('Error background-syncing to Firestore:', error);
  }
}

function writeDB(state: DBState) {
  globalDBState = state;
  try {
    fs.writeFile(DB_FILE, JSON.stringify(state, null, 2), 'utf8', (err) => {
      if (err) console.error('Error writing backup database file:', err);
    });
  } catch (err) {
    console.error('Error starting backup database file write:', err);
  }

  // Push to cloud Firestore in background
  syncToFirestore(state).catch(err => {
    console.error('Error in background Firestore sync:', err);
  });
}

// Helper to log user/system action in the Audit Log list
function addAuditLog(db: DBState, username: string, operatorName: string, action: string, details?: string) {
  if (!db.auditLogs) {
    db.auditLogs = [];
  }

  const cleanUsername = username?.toLowerCase().trim() || 'system';
  const user = db.users[cleanUsername];

  // Resolve correct display name
  let resolvedOperatorName = operatorName;
  if (user && user.name) {
    resolvedOperatorName = user.name;
  } else if (cleanUsername === 'admin') {
    resolvedOperatorName = 'Warehouse Supervisor';
  } else if (cleanUsername === 'sales') {
    resolvedOperatorName = 'Sales Advisor';
  } else if (cleanUsername === 'manufacturer') {
    resolvedOperatorName = 'Production Specialist';
  }

  // Resolve correct role label
  let operatorRole = 'User';
  if (user && user.role) {
    if (user.role === 'admin') operatorRole = 'Admin';
    else if (user.role === 'manufacturer') operatorRole = 'Manufacturer';
    else if (user.role === 'salesperson') operatorRole = 'Sales Advisor';
  } else if (cleanUsername === 'admin') {
    operatorRole = 'Admin';
  } else if (cleanUsername === 'manufacturer') {
    operatorRole = 'Manufacturer';
  } else if (cleanUsername === 'sales') {
    operatorRole = 'Sales Advisor';
  }

  db.auditLogs.push({
    id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    username: cleanUsername,
    operatorName: resolvedOperatorName,
    action,
    timestamp: new Date().toISOString(),
    details,
    // Ensure both styles are supported
    operator: resolvedOperatorName,
    operatorRole: operatorRole
  });
}

// ---------------- RATE LIMITING MIDDLEWARE ----------------

// In-memory rate limiting state
interface RateLimitWindow {
  count: number;
  resetTime: number;
}

interface AccountBackoffRecord {
  failedCount: number;
  lastAttemptTime: number;
}

const authIpTracker = new Map<string, RateLimitWindow>();
const publicIpTracker = new Map<string, RateLimitWindow>();
const authedIpTracker = new Map<string, RateLimitWindow>();
const authAccountTracker = new Map<string, AccountBackoffRecord>();

// Configurable thresholds loaded from process.env with fallback defaults
const AUTH_LIMIT_IP_MAX = parseInt(process.env.AUTH_LIMIT_IP_MAX || '10', 10);
const AUTH_LIMIT_IP_WINDOW_MS = parseInt(process.env.AUTH_LIMIT_IP_WINDOW_MS || '60000', 10);

const AUTH_BACKOFF_BASE_MS = parseInt(process.env.AUTH_BACKOFF_BASE_MS || '1000', 10);
const AUTH_BACKOFF_FACTOR = parseFloat(process.env.AUTH_BACKOFF_FACTOR || '2');
const AUTH_MAX_BACKOFF_MS = parseInt(process.env.AUTH_MAX_BACKOFF_MS || '60000', 10);

const PUBLIC_LIMIT_MAX = parseInt(process.env.PUBLIC_LIMIT_MAX || '30', 10);
const PUBLIC_LIMIT_WINDOW_MS = parseInt(process.env.PUBLIC_LIMIT_WINDOW_MS || '60000', 10);

const AUTHED_LIMIT_MAX = parseInt(process.env.AUTHED_LIMIT_MAX || '300', 10);
const AUTHED_LIMIT_WINDOW_MS = parseInt(process.env.AUTHED_LIMIT_WINDOW_MS || '60000', 10);

// Client IP extractor supporting proxies
function getClientIp(req: express.Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    } else if (Array.isArray(forwarded)) {
      return forwarded[0].trim();
    }
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

// Generic rate limiter utility
function checkRateLimit(
  tracker: Map<string, RateLimitWindow>,
  key: string,
  maxLimit: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  let window = tracker.get(key);

  if (!window || now > window.resetTime) {
    window = {
      count: 0,
      resetTime: now + windowMs
    };
  }

  window.count += 1;
  tracker.set(key, window);

  const remaining = Math.max(0, maxLimit - window.count);
  return {
    allowed: window.count <= maxLimit,
    remaining,
    resetTime: window.resetTime
  };
}

// 1. Strict IP Rate Limiter for Authentication routes (e.g., login, register)
const authIpRateLimiter: express.RequestHandler = (req, res, next) => {
  const ip = getClientIp(req);
  const result = checkRateLimit(authIpTracker, ip, AUTH_LIMIT_IP_MAX, AUTH_LIMIT_IP_WINDOW_MS);

  res.setHeader('X-RateLimit-Limit-Auth-IP', AUTH_LIMIT_IP_MAX);
  res.setHeader('X-RateLimit-Remaining-Auth-IP', result.remaining);
  res.setHeader('X-RateLimit-Reset-Auth-IP', new Date(result.resetTime).toISOString());

  if (!result.allowed) {
    return res.status(429).json({
      error: `Too many authentication attempts from this IP address. Please try again after ${Math.ceil((result.resetTime - Date.now()) / 1000)} seconds.`
    });
  }
  next();
};

// 2. Moderate IP Rate Limiter for Public routes (e.g. /api/health)
const publicIpRateLimiter: express.RequestHandler = (req, res, next) => {
  const ip = getClientIp(req);
  const result = checkRateLimit(publicIpTracker, ip, PUBLIC_LIMIT_MAX, PUBLIC_LIMIT_WINDOW_MS);

  res.setHeader('X-RateLimit-Limit-Public', PUBLIC_LIMIT_MAX);
  res.setHeader('X-RateLimit-Remaining-Public', result.remaining);
  res.setHeader('X-RateLimit-Reset-Public', new Date(result.resetTime).toISOString());

  if (!result.allowed) {
    return res.status(429).json({
      error: `Too many requests to public endpoints. Please wait ${Math.ceil((result.resetTime - Date.now()) / 1000)} seconds.`
    });
  }
  next();
};

// 3. Loose Rate Limiter for Authenticated/User routes (all other API routes)
const authedIpRateLimiter: express.RequestHandler = (req, res, next) => {
  const ip = getClientIp(req);
  const result = checkRateLimit(authedIpTracker, ip, AUTHED_LIMIT_MAX, AUTHED_LIMIT_WINDOW_MS);

  res.setHeader('X-RateLimit-Limit-Authed', AUTHED_LIMIT_MAX);
  res.setHeader('X-RateLimit-Remaining-Authed', result.remaining);
  res.setHeader('X-RateLimit-Reset-Authed', new Date(result.resetTime).toISOString());

  if (!result.allowed) {
    return res.status(429).json({
      error: `Too many workspace actions performed. Please slow down and try again after ${Math.ceil((result.resetTime - Date.now()) / 1000)} seconds.`
    });
  }
  next();
};

// Account-specific exponential backoff helpers
function checkAccountBackoff(username: string): { allowed: boolean; waitSeconds?: number } {
  if (!username) return { allowed: true };
  const normalized = username.toLowerCase().trim();
  const record = authAccountTracker.get(normalized);
  if (!record || record.failedCount === 0) {
    return { allowed: true };
  }

  const now = Date.now();
  const power = Math.max(0, record.failedCount - 1);
  const delay = Math.min(AUTH_MAX_BACKOFF_MS, AUTH_BACKOFF_BASE_MS * Math.pow(AUTH_BACKOFF_FACTOR, power));
  const timePassed = now - record.lastAttemptTime;

  if (timePassed < delay) {
    const remainingMs = delay - timePassed;
    return {
      allowed: false,
      waitSeconds: Math.ceil(remainingMs / 1000)
    };
  }

  return { allowed: true };
}

function recordAuthFailure(username: string) {
  if (!username) return;
  const normalized = username.toLowerCase().trim();
  const record = authAccountTracker.get(normalized) || { failedCount: 0, lastAttemptTime: 0 };
  record.failedCount += 1;
  record.lastAttemptTime = Date.now();
  authAccountTracker.set(normalized, record);
}

function recordAuthSuccess(username: string) {
  if (!username) return;
  const normalized = username.toLowerCase().trim();
  authAccountTracker.delete(normalized);
}

// ---------------- INPUT VALIDATION SCHEMAS & MIDDLEWARE ----------------

const ALPHANUMERIC_REGEX = /^[a-zA-Z0-9_\-]+$/;

const loginSchema = z.object({
  username: z.string().min(1, "Username is required").max(100, "Username is too long").toLowerCase().trim(),
  password: z.string().min(1, "Password is required").max(100, "Password is too long"),
});

const registerSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(100, "Username is too long").toLowerCase().trim().regex(ALPHANUMERIC_REGEX, "Username can only contain alphanumeric characters, underscores, and hyphens"),
  password: z.string().min(4, "Password must be at least 4 characters").max(100, "Password is too long"),
  role: z.enum(['admin', 'manufacturer', 'salesperson']),
  name: z.string().min(1, "Name is required").max(150, "Name is too long").trim(),
  approved: z.boolean().optional(),
});

const userUpdateSchema = z.object({
  id: z.string().min(1, "ID is required").max(100),
  username: z.string().min(3, "Username must be at least 3 characters").max(100, "Username is too long").toLowerCase().trim().regex(ALPHANUMERIC_REGEX, "Username can only contain alphanumeric characters, underscores, and hyphens"),
  password: z.string().min(4, "Password must be at least 4 characters").max(100, "Password is too long").optional().or(z.literal('')),
  role: z.enum(['admin', 'manufacturer', 'salesperson']),
  name: z.string().min(1, "Name is required").max(150, "Name is too long").trim(),
  locked: z.boolean().optional(),
  operator: z.string().max(150).optional(),
});

const userDeleteSchema = z.object({
  id: z.string().min(1, "ID is required").max(100),
  operator: z.string().max(150).optional(),
});

const userUnlockSchema = z.object({
  id: z.string().max(100).optional(),
  username: z.string().max(100).optional(),
  operator: z.string().max(150).optional(),
}).refine(data => data.id || data.username, {
  message: "Either ID or Username must be provided",
  path: ["id", "username"]
});

const userApproveSchema = z.object({
  id: z.string().max(100).optional(),
  username: z.string().max(100).optional(),
  operator: z.string().max(150).optional(),
}).refine(data => data.id || data.username, {
  message: "Either ID or Username must be provided",
  path: ["id", "username"]
});

const userRejectSchema = z.object({
  id: z.string().min(1, "ID is required").max(100),
  operator: z.string().max(150).optional(),
});

const productSchema = z.object({
  name: z.string().min(1, "Product name is required").max(150, "Product name too long").trim(),
  colors: z.array(z.string().min(1, "Color name cannot be empty").max(100, "Color name too long").trim()).min(1, "At least one color is required"),
});

const productUpdateSchema = productSchema.extend({
  id: z.string().min(1, "ID is required").max(100),
});

const productDeleteSchema = z.object({
  id: z.string().min(1, "Product ID is required").max(100),
  operator: z.string().max(150).optional(),
});

const buyerSchema = z.object({
  name: z.string().min(1, "Buyer name is required").max(150, "Buyer name too long").trim(),
  contact: z.string().max(150, "Contact is too long").trim().optional(),
});

const buyerUpdateSchema = buyerSchema.extend({
  id: z.string().min(1, "ID is required").max(100),
});

const buyerDeleteSchema = z.object({
  id: z.string().min(1, "Buyer ID is required").max(100),
  operator: z.string().max(150).optional(),
});

const batterySaleSchema = z.object({
  buyerName: z.string().min(1, "Buyer Name is required").max(150, "Buyer Name too long").trim(),
  batterySeries: z.string().min(1, "Battery Series is required").max(150, "Battery Series too long").trim(),
  startNo: z.string().max(100, "Start number too long").trim().optional().or(z.literal('')),
  endNo: z.string().max(100, "End number too long").trim().optional().or(z.literal('')),
  quantity: z.coerce.number().int("Quantity must be an integer").positive("Quantity must be positive").max(100000, "Quantity too high"),
  operator: z.string().max(150).optional(),
  notes: z.string().max(1000, "Notes too long").optional(),
  isUnderWarranty: z.boolean().optional(),
  warrantyDurationMonths: z.coerce.number().positive().optional(),
  status: z.enum(['sold', 'hold']).optional(),
  heldFor: z.string().max(150).optional(),
});

const batterySaleReleaseSchema = z.object({
  id: z.string().min(1, "Battery sale ID is required").max(100),
  operator: z.string().max(150).optional(),
});

const batterySaleFinalizeSchema = z.object({
  id: z.string().min(1, "Battery sale ID is required").max(100),
  operator: z.string().max(150).optional(),
});

const batteryImportSchema = z.object({
  batterySeries: z.string().min(1, "Battery Series is required").max(150, "Battery Series too long").trim(),
  startNo: z.string().max(100, "Start number too long").trim().optional().or(z.literal('')),
  endNo: z.string().max(100, "End number too long").trim().optional().or(z.literal('')),
  quantity: z.coerce.number().int("Quantity must be an integer").positive("Quantity must be positive").max(100000, "Quantity too high"),
  operator: z.string().max(150).optional(),
  supplierName: z.string().max(150).optional(),
  containerId: z.string().max(150).optional(),
  notes: z.string().max(1000, "Notes too long").optional(),
});

const chargerSaleSchema = z.object({
  buyerName: z.string().min(1, "Buyer Name is required").max(150, "Buyer Name too long").trim(),
  chargerType: z.string().min(1, "Charger Type is required").max(150, "Charger Type too long").trim(),
  startNo: z.string().max(100, "Start number too long").trim().optional().or(z.literal('')),
  endNo: z.string().max(100, "End number too long").trim().optional().or(z.literal('')),
  quantity: z.coerce.number().int("Quantity must be an integer").positive("Quantity must be positive").max(100000, "Quantity too high"),
  operator: z.string().max(150).optional(),
  notes: z.string().max(1000, "Notes too long").optional(),
  isUnderWarranty: z.boolean().optional(),
  warrantyDurationMonths: z.coerce.number().positive().optional(),
  status: z.enum(['sold', 'hold']).optional(),
  heldFor: z.string().max(150).optional(),
});

const chargerSaleReleaseSchema = z.object({
  id: z.string().min(1, "Charger sale ID is required").max(100),
  operator: z.string().max(150).optional(),
});

const chargerSaleFinalizeSchema = z.object({
  id: z.string().min(1, "Charger sale ID is required").max(100),
  operator: z.string().max(150).optional(),
});

const chargerImportSchema = z.object({
  chargerType: z.string().min(1, "Charger Type is required").max(150, "Charger Type too long").trim(),
  startNo: z.string().max(100, "Start number too long").trim().optional().or(z.literal('')),
  endNo: z.string().max(100, "End number too long").trim().optional().or(z.literal('')),
  quantity: z.coerce.number().int("Quantity must be an integer").positive("Quantity must be positive").max(100000, "Quantity too high"),
  operator: z.string().max(150).optional(),
  supplierName: z.string().max(150).optional(),
  containerId: z.string().max(150).optional(),
  notes: z.string().max(1000, "Notes too long").optional(),
});

const typeListSchema = z.object({
  list: z.array(z.string().min(1, "Type name cannot be empty").max(100, "Type name too long").trim()),
  operator: z.string().max(150).optional(),
});

const scooterUnitSchema = z.object({
  id: z.string().max(100).optional(),
  actionType: z.enum(['create_stage1', 'customize_stage2', 'pos_stage3_4', 'warranty_stage5', 'direct_update']),
  modelName: z.string().max(150).trim().optional(),
  color: z.string().max(100).trim().optional(),
  chassisNo: z.string().max(100).trim().toUpperCase().optional(),
  motorNo: z.string().max(100).trim().toUpperCase().optional(),
  controllerNo: z.string().max(100).trim().toUpperCase().optional(),
  sourceChannel: z.string().max(100).optional(),
  tireSize: z.string().max(100).optional(),
  frontTireSize: z.string().max(100).optional(),
  rearTireSize: z.string().max(100).optional(),
  customizationNotes: z.string().max(1000).optional(),
  buyerName: z.string().max(150).trim().optional(),
  buyerContact: z.string().max(150).trim().optional(),
  salesPrice: z.coerce.number().nonnegative().optional(),
  batterySerials: z.array(z.string().max(100).trim().toUpperCase()).optional(),
  scooterWarrantyStatus: z.string().max(100).optional(),
  scooterWarrantyExpiry: z.string().max(100).optional(),
  batteryWarrantyStatus: z.string().max(100).optional(),
  batteryWarrantyExpiry: z.string().max(100).optional(),
  batteryWarrantyFlags: z.array(z.boolean()).optional(),
  batteryWarrantyMonths: z.array(z.coerce.number()).optional(),
  warrantyNotes: z.string().max(1000).optional(),
  operator: z.string().max(150).optional(),
});

const scooterBulkCreateSchema = z.object({
  modelName: z.string().min(1, "Model Name is required").max(150).trim(),
  color: z.string().min(1, "Color is required").max(100).trim(),
  sourceChannel: z.string().max(100).optional(),
  frontTireSize: z.string().max(100).optional(),
  rearTireSize: z.string().max(100).optional(),
  items: z.array(z.object({
    chassisNo: z.string().min(1, "Chassis number cannot be empty").max(100).trim().toUpperCase(),
    motorNo: z.string().min(1, "Motor number cannot be empty").max(100).trim().toUpperCase(),
    controllerNo: z.string().min(1, "Controller number cannot be empty").max(100).trim().toUpperCase(),
  })).min(1, "Must include at least one item"),
  operator: z.string().min(1, "Operator is required").max(150),
});

const scooterBulkPosSchema = z.object({
  buyerName: z.string().min(1, "Buyer Name is required").max(150).trim(),
  buyerContact: z.string().max(150).trim().optional(),
  salesPrice: z.coerce.number().nonnegative().optional(),
  scooterWarrantyStatus: z.string().max(100).optional(),
  scooterWarrantyExpiry: z.string().max(100).optional(),
  batteryWarrantyStatus: z.string().max(100).optional(),
  batteryWarrantyExpiry: z.string().max(100).optional(),
  warrantyNotes: z.string().max(1000).optional(),
  operator: z.string().min(1, "Operator is required").max(150),
  sales: z.array(z.object({
    id: z.string().min(1, "Scooter ID is required"),
    batterySerials: z.array(z.string().max(100).trim().toUpperCase()).optional(),
    batteryWarrantyFlags: z.array(z.boolean()).optional(),
  })).min(1, "Must include at least one sale"),
  status: z.enum(['sold', 'hold']),
});

const stockLogSchema = z.object({
  modelName: z.string().min(1, "Model is required").max(150).trim(),
  color: z.string().min(1, "Color is required").max(100).trim(),
  type: z.enum(['in', 'out']),
  sourceChannel: z.string().max(100).optional(),
  quantity: z.coerce.number().int().positive().max(100000),
  buyerName: z.string().max(150).optional(),
  operator: z.string().min(1, "Operator is required").max(150),
  notes: z.string().max(1000).optional(),
});

const sheetConfigSchema = z.object({
  webhookUrl: z.string().url("Must be a valid Webhook URL").or(z.literal('')),
  enabled: z.boolean(),
});

// Middleware factory to validate req.body against a strict schema
function validateBody(schema: z.ZodSchema) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const parseResult = schema.safeParse(req.body);
    if (!parseResult.success) {
      const formattedErrors = parseResult.error.issues.map(err => {
        return `${err.path.join('.') || 'body'}: ${err.message}`;
      });
      return res.status(400).json({
        error: `Validation error: ${formattedErrors.join('; ')}`
      });
    }
    // Set req.body to the fully parsed and type-checked data, shedding any unrequested properties
    req.body = parseResult.data;
    next();
  };
}

// Global middleware for loose limit on authenticated user actions (excluding auth and health endpoints)
app.use('/api', (req, res, next) => {
  const url = req.originalUrl || req.url;
  if (url.includes('/api/auth/') || url.includes('/api/health')) {
    return next();
  }
  return authedIpRateLimiter(req, res, next);
});

// ---------------- API ROUTES ----------------

// Public: Health check
app.get('/api/health', publicIpRateLimiter, (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Auth: Login
app.post('/api/auth/login', authIpRateLimiter, validateBody(loginSchema), (req, res) => {
  try {
    const { username, password } = req.body;

    const db = readDB();
    const normalizedUserKey = username; // Already normalized by the schema
    const user = db.users[normalizedUserKey];

    // Check account-specific exponential backoff BEFORE executing login attempt
    const backoffStatus = checkAccountBackoff(normalizedUserKey);
    if (!backoffStatus.allowed) {
      addAuditLog(db, normalizedUserKey, user ? user.name : 'unknown', 'login_backoff_blocked', `Login blocked due to active backoff. Please wait ${backoffStatus.waitSeconds}s.`);
      writeDB(db);
      return res.status(429).json({
        error: `Too many login attempts. Please wait ${backoffStatus.waitSeconds} seconds before trying again.`
      });
    }

    if (!user) {
      addAuditLog(db, normalizedUserKey, 'unknown', 'login_failed', 'Attempted to log in with non-existent username.');
      writeDB(db);
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Check if account is pending owner approval
    if (user.approved === false) {
      addAuditLog(db, user.username, user.name, 'login_failed_unapproved', 'Attempted to log in to an unapproved account.');
      writeDB(db);
      return res.status(401).json({ error: 'Your account is pending owner approval. Please wait for the administrator to grant access.' });
    }

    // Check if account is already locked (manually deactivated)
    if (user.locked) {
      addAuditLog(db, user.username, user.name, 'login_failed_locked', 'Attempted to log in to a locked account.');
      writeDB(db);
      return res.status(401).json({ error: 'This account is locked. Please contact the warehouse owner to unlock it.' });
    }

    if (user.passwordHash !== password) {
      // Record failed attempt to trigger/increase exponential backoff
      recordAuthFailure(normalizedUserKey);

      const record = authAccountTracker.get(normalizedUserKey)!;
      const power = Math.max(0, record.failedCount - 1);
      const nextDelayMs = Math.min(AUTH_MAX_BACKOFF_MS, AUTH_BACKOFF_BASE_MS * Math.pow(AUTH_BACKOFF_FACTOR, power));
      const nextDelaySecs = Math.ceil(nextDelayMs / 1000);

      const errorMsg = `Invalid username or password. Due to consecutive failed attempts, your next login attempt will be delayed by ${nextDelaySecs} seconds.`;

      addAuditLog(db, user.username, user.name, 'login_failed_wrong_password', `Wrong password attempt. Successive failed count is now ${record.failedCount}.`);

      // Update failedAttempts to align with backoff tracker count
      user.failedAttempts = record.failedCount;
      db.users[normalizedUserKey] = user;
      writeDB(db);

      return res.status(401).json({ error: errorMsg });
    }

    // Successful login - reset failed attempts and backoff tracker
    recordAuthSuccess(normalizedUserKey);
    user.failedAttempts = 0;
    db.users[normalizedUserKey] = user;
    
    addAuditLog(db, user.username, user.name, 'login_success', 'Successfully logged in.');
    writeDB(db);

    // Generate session token
    const token = `session-token-${user.id}-${Date.now()}`;
    
    const { passwordHash, ...safeUser } = user;
    res.json({ success: true, token, user: safeUser });
  } catch (error: any) {
    console.error('Error during login:', error);
    return res.status(500).json({ error: 'An unexpected error occurred during login.' });
  }
});

// Auth: Register (Admin only or demo self-register)
app.post('/api/auth/register', authIpRateLimiter, validateBody(registerSchema), (req, res) => {
  try {
    const { username, password, role, name, approved } = req.body;


    const db = readDB();
    const normalizedUsername = username; // Already normalized by schema

    if (db.users[normalizedUsername]) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const newUser = {
      id: `u-${Date.now()}`,
      username: normalizedUsername,
      passwordHash: password,
      role: role as 'admin' | 'manufacturer' | 'salesperson',
      name,
      locked: false,
      failedAttempts: 0,
      approved: approved === true
    };

    db.users[normalizedUsername] = newUser;
    addAuditLog(db, normalizedUsername, name, 'user_registered', `User registered with role ${role}.`);
    writeDB(db);

    const { passwordHash, ...safeUser } = newUser;
    res.json({ success: true, user: safeUser });
  } catch (error: any) {
    console.error('Error during registration:', error);
    return res.status(500).json({ error: 'An unexpected error occurred during registration.' });
  }
});

// Auth: Update User (Admin only)
app.post('/api/users/update', validateBody(userUpdateSchema), (req, res) => {
  const { id, username, password, role, name, locked, operator = 'admin' } = req.body;

  const db = readDB();
  const userEntry = Object.entries(db.users).find(([_, u]) => u.id === id);
  if (!userEntry) {
    return res.status(404).json({ error: 'User not found' });
  }

  const [oldKey, oldUser] = userEntry;
  const newNormalizedUsername = username; // Already normalized by schema

  if (newNormalizedUsername !== oldKey && db.users[newNormalizedUsername]) {
    return res.status(400).json({ error: 'New username already exists' });
  }

  if (oldKey === 'admin' && newNormalizedUsername !== 'admin') {
    return res.status(400).json({ error: 'Cannot change the username of the default admin account.' });
  }

  const updatedUser = {
    ...oldUser,
    username: newNormalizedUsername,
    name,
    role: role as 'admin' | 'manufacturer' | 'salesperson',
    locked: locked !== undefined ? !!locked : oldUser.locked,
    failedAttempts: locked === false ? 0 : oldUser.failedAttempts
  };

  if (password && password.trim() !== '') {
    updatedUser.passwordHash = password;
  }

  delete db.users[oldKey];
  db.users[newNormalizedUsername] = updatedUser;
  
  addAuditLog(db, 'admin', operator, 'user_updated', `Updated employee @${newNormalizedUsername} details (Role: ${role}).`);
  writeDB(db);

  const { passwordHash, ...safeUser } = updatedUser;
  res.json({ success: true, user: safeUser });
});

// Auth: Delete User (Admin only)
app.post('/api/users/delete', validateBody(userDeleteSchema), (req, res) => {
  const { id, operator = 'admin' } = req.body;

  const db = readDB();
  const userEntry = Object.entries(db.users).find(([_, u]) => u.id === id);
  if (!userEntry) {
    return res.status(404).json({ error: 'User not found' });
  }

  const [key, user] = userEntry;
  if (key === 'admin' || user.username === 'admin') {
    return res.status(400).json({ error: 'Cannot delete the default admin account' });
  }

  delete db.users[key];
  addAuditLog(db, 'admin', operator, 'user_deleted', `Deleted employee account @${user.username} (${user.name}).`);
  writeDB(db);

  res.json({ success: true });
});

// Auth: Get Users (For supervisor tracking)
app.get('/api/users', (req, res) => {
  const db = readDB();
  const safeUsers = Object.values(db.users).map(({ passwordHash, ...user }) => ({
    ...user,
    passwordText: passwordHash
  }));
  res.json(safeUsers);
});

// Auth: Unlock User (Admin only)
app.post('/api/users/unlock', validateBody(userUnlockSchema), (req, res) => {
  const { id, username, operator = 'admin' } = req.body;

  const db = readDB();
  let userEntry: [string, any] | undefined;

  if (id) {
    userEntry = Object.entries(db.users).find(([_, u]) => u.id === id);
  } else if (username) {
    const cleanUsername = username.toLowerCase().trim();
    const user = db.users[cleanUsername];
    if (user) {
      userEntry = [cleanUsername, user];
    }
  }

  if (!userEntry) {
    return res.status(404).json({ error: 'User not found' });
  }

  const [key, user] = userEntry;
  user.locked = false;
  user.failedAttempts = 0;
  db.users[key] = user;

  addAuditLog(db, 'admin', operator, 'user_unlocked', `Unlocked account for user @${user.username} (${user.name}).`);
  writeDB(db);

  res.json({ success: true, message: `Successfully unlocked ${user.name}` });
});

// Auth: Approve User (Admin only)
app.post('/api/users/approve', validateBody(userApproveSchema), (req, res) => {
  const { id, username, operator = 'admin' } = req.body;

  const db = readDB();
  let userEntry: [string, any] | undefined;

  if (id) {
    userEntry = Object.entries(db.users).find(([_, u]) => u.id === id);
  } else if (username) {
    const cleanUsername = username.toLowerCase().trim();
    const user = db.users[cleanUsername];
    if (user) {
      userEntry = [cleanUsername, user];
    }
  }

  if (!userEntry) {
    return res.status(404).json({ error: 'User not found' });
  }

  const [key, user] = userEntry;
  user.approved = true;
  db.users[key] = user;

  addAuditLog(db, 'admin', operator, 'user_approved', `Approved and granted access to employee account @${user.username} (${user.name}).`);
  writeDB(db);

  res.json({ success: true, message: `Successfully approved access for ${user.name}` });
});

// Auth: Reject User (Admin only)
app.post('/api/users/reject', validateBody(userRejectSchema), (req, res) => {
  const { id, operator = 'admin' } = req.body;

  const db = readDB();
  const userEntry = Object.entries(db.users).find(([_, u]) => u.id === id);
  if (!userEntry) {
    return res.status(404).json({ error: 'User not found' });
  }

  const [key, user] = userEntry;
  if (key === 'admin' || user.username === 'admin') {
    return res.status(400).json({ error: 'Cannot reject the default admin account' });
  }

  delete db.users[key];
  addAuditLog(db, 'admin', operator, 'user_rejected', `Rejected registration request for @${user.username} (${user.name}).`);
  writeDB(db);

  res.json({ success: true, message: `Successfully rejected and removed request for ${user.name}` });
});

// Audit Logs: List (Admin/Owner only)
app.get('/api/audit-logs', (req, res) => {
  const db = readDB();
  const enrichedLogs = (db.auditLogs || []).map(log => {
    const cleanUsername = log.username?.toLowerCase().trim() || 'system';
    const user = db.users[cleanUsername];

    let resolvedOperatorName = log.operatorName || log.operator || cleanUsername;
    if (user && user.name) {
      resolvedOperatorName = user.name;
    } else if (cleanUsername === 'admin') {
      resolvedOperatorName = 'Warehouse Supervisor';
    } else if (cleanUsername === 'sales') {
      resolvedOperatorName = 'Sales Advisor';
    } else if (cleanUsername === 'manufacturer') {
      resolvedOperatorName = 'Production Specialist';
    }

    let operatorRole = log.operatorRole || 'User';
    if (user && user.role) {
      if (user.role === 'admin') operatorRole = 'Admin';
      else if (user.role === 'manufacturer') operatorRole = 'Manufacturer';
      else if (user.role === 'salesperson') operatorRole = 'Sales Advisor';
    } else if (cleanUsername === 'admin') {
      operatorRole = 'Admin';
    } else if (cleanUsername === 'manufacturer') {
      operatorRole = 'Manufacturer';
    } else if (cleanUsername === 'sales') {
      operatorRole = 'Sales Advisor';
    }

    return {
      ...log,
      operator: resolvedOperatorName,
      operatorRole: operatorRole
    };
  });
  res.json(enrichedLogs);
});

// Products: List
app.get('/api/products', (req, res) => {
  const db = readDB();
  res.json(db.products);
});

// Products: Add
app.post('/api/products', validateBody(productSchema), (req, res) => {
  const { name, colors } = req.body;

  const db = readDB();
  
  if (db.products.some(p => p.name.toLowerCase() === name.toLowerCase())) {
    return res.status(400).json({ error: 'Product model name already exists' });
  }

  const newProduct: Product = {
    id: `prod-${Date.now()}`,
    name,
    colors: colors // already formatted/trimmed by schema
  };

  db.products.push(newProduct);
  writeDB(db);

  if (db.sheetConfig.enabled && db.sheetConfig.webhookUrl) {
    postToGoogleSheets(db.sheetConfig.webhookUrl, {
      action: 'add_product',
      timestamp: new Date().toISOString(),
      data: newProduct
    });
  }

  res.json(newProduct);
});

// Products: Update
app.post('/api/products/update', validateBody(productUpdateSchema), (req, res) => {
  const { id, name, colors } = req.body;
  const db = readDB();
  const prodIndex = db.products.findIndex(p => p.id === id);
  if (prodIndex === -1) {
    return res.status(404).json({ error: 'Product not found' });
  }
  
  if (db.products.some(p => p.id !== id && p.name.toLowerCase() === name.toLowerCase())) {
    return res.status(400).json({ error: 'Product model name already exists' });
  }

  const oldName = db.products[prodIndex].name;
  db.products[prodIndex].name = name;
  db.products[prodIndex].colors = colors; // already formatted/trimmed by schema

  // Update references if name changed
  if (oldName !== name) {
    if (db.scooterUnits) {
      db.scooterUnits.forEach(unit => {
        if (unit.modelName === oldName) unit.modelName = name;
      });
    }
    if (db.stockLogs) {
      db.stockLogs.forEach(log => {
        if (log.modelName === oldName) log.modelName = name;
      });
    }
  }

  writeDB(db);
  res.json(db.products[prodIndex]);
});

// Buyers: List
app.get('/api/buyers', (req, res) => {
  const db = readDB();
  res.json(db.buyers);
});

// Buyers: Add
app.post('/api/buyers', validateBody(buyerSchema), (req, res) => {
  const { name, contact } = req.body;

  const db = readDB();

  if (db.buyers.some(b => b.name.toLowerCase() === name.toLowerCase())) {
    return res.status(400).json({ error: 'Buyer already exists' });
  }

  const newBuyer: Buyer = {
    id: `buy-${Date.now()}`,
    name,
    contact: contact || undefined
  };

  db.buyers.push(newBuyer);
  writeDB(db);

  if (db.sheetConfig.enabled && db.sheetConfig.webhookUrl) {
    postToGoogleSheets(db.sheetConfig.webhookUrl, {
      action: 'add_buyer',
      timestamp: new Date().toISOString(),
      data: newBuyer
    });
  }

  res.json(newBuyer);
});

// Buyers: Update
app.post('/api/buyers/update', validateBody(buyerUpdateSchema), (req, res) => {
  const { id, name, contact } = req.body;
  const db = readDB();
  const buyerIndex = db.buyers.findIndex(b => b.id === id);
  if (buyerIndex === -1) {
    return res.status(404).json({ error: 'Buyer not found' });
  }

  if (db.buyers.some(b => b.id !== id && b.name.toLowerCase() === name.toLowerCase())) {
    return res.status(400).json({ error: 'Buyer already exists' });
  }

  const oldName = db.buyers[buyerIndex].name;
  db.buyers[buyerIndex].name = name;
  db.buyers[buyerIndex].contact = contact ? contact.trim() : undefined;

  // Update references if name changed
  if (oldName !== name) {
    if (db.scooterUnits) {
      db.scooterUnits.forEach(unit => {
        if (unit.buyerName === oldName) unit.buyerName = name;
      });
    }
    if (db.stockLogs) {
      db.stockLogs.forEach(log => {
        if (log.buyerName === oldName) log.buyerName = name;
      });
    }
    if (db.batterySales) {
      db.batterySales.forEach(sale => {
        if (sale.buyerName === oldName) sale.buyerName = name;
      });
    }
    if (db.chargerSales) {
      db.chargerSales.forEach(sale => {
        if (sale.buyerName === oldName) sale.buyerName = name;
      });
    }
  }

  writeDB(db);
  res.json(db.buyers[buyerIndex]);
});

// Products: Delete (Admin only/Supervisor)
app.post('/api/products/delete', validateBody(productDeleteSchema), (req, res) => {
  const { id, operator } = req.body;

  const db = readDB();
  const prodIndex = db.products.findIndex(p => p.id === id);
  if (prodIndex === -1) {
    return res.status(404).json({ error: 'Product not found' });
  }

  const prodName = db.products[prodIndex].name;
  db.products.splice(prodIndex, 1);
  addAuditLog(db, operator || 'system', operator || 'system', 'product_deleted', `Deleted product model "${prodName}" from catalog.`);
  writeDB(db);

  res.json({ success: true });
});

// Buyers: Delete (Admin only/Supervisor)
app.post('/api/buyers/delete', validateBody(buyerDeleteSchema), (req, res) => {
  const { id, operator } = req.body;

  const db = readDB();
  const buyerIndex = db.buyers.findIndex(b => b.id === id);
  if (buyerIndex === -1) {
    return res.status(404).json({ error: 'Buyer not found' });
  }

  const buyerName = db.buyers[buyerIndex].name;
  db.buyers.splice(buyerIndex, 1);
  addAuditLog(db, operator || 'system', operator || 'system', 'buyer_deleted', `Deleted buyer/agency "${buyerName}" from catalog.`);
  writeDB(db);

  res.json({ success: true });
});

// Battery Sales: List
app.get('/api/battery-sales', (req, res) => {
  const db = readDB();
  res.json(db.batterySales || []);
});

// Battery Sales: Add / Hold
app.post('/api/battery-sales', validateBody(batterySaleSchema), (req, res) => {
  const { 
    buyerName, 
    batterySeries, 
    startNo, 
    endNo, 
    quantity, 
    operator, 
    notes,
    isUnderWarranty,
    warrantyDurationMonths,
    status, // 'sold' | 'hold'
    heldFor
  } = req.body;

  const db = readDB();
  if (!db.batterySales) {
    db.batterySales = [];
  }

  const isHold = status === 'hold';
  const timestamp = new Date().toISOString();

  const newSale: BatterySale = {
    id: `batsale-${Date.now()}`,
    buyerName,
    batterySeries,
    startNo: startNo ? String(startNo).trim().toUpperCase() : 'N/A',
    endNo: endNo ? String(endNo).trim().toUpperCase() : 'N/A',
    quantity,
    saleDate: timestamp,
    operator: operator || 'system',
    notes: notes || undefined,
    isUnderWarranty: !!isUnderWarranty,
    warrantyDurationMonths: isUnderWarranty ? warrantyDurationMonths : undefined,
    status: isHold ? 'hold' : 'sold',
    heldFor: isHold ? (heldFor || buyerName) : undefined,
    heldBy: isHold ? (operator || 'Operator') : undefined,
    holdDate: isHold ? timestamp : undefined
  };

  db.batterySales.push(newSale);
  addAuditLog(db, operator || 'system', operator || 'system', isHold ? 'battery_hold' : 'battery_sale', `Registered standalone battery ${isHold ? 'hold/reservation' : 'sale/dispatch'} for Series ${batterySeries} (Qty: ${quantity}, Buyer: ${buyerName}).`);
  writeDB(db);

  if (db.sheetConfig.enabled && db.sheetConfig.webhookUrl) {
    postToGoogleSheets(db.sheetConfig.webhookUrl, {
      action: 'sync_all',
      timestamp,
      data: {
        products: db.products,
        buyers: db.buyers,
        scooterUnits: db.scooterUnits,
        stockLogs: db.stockLogs,
        batterySales: db.batterySales || [],
        batteryImports: db.batteryImports || [],
        ...getSummaryData(db)
      }
    });
  }

  res.json(newSale);
});

// Battery Sales: Release Hold
app.post('/api/battery-sales/release', validateBody(batterySaleReleaseSchema), (req, res) => {
  const { id, operator } = req.body;

  const db = readDB();
  if (!db.batterySales) db.batterySales = [];

  const index = db.batterySales.findIndex(s => s.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Battery record not found.' });
  }

  const record = db.batterySales[index];
  if (record.status !== 'hold') {
    return res.status(400).json({ error: 'Can only release a record that is currently on hold.' });
  }

  // Remove or update the hold. Since it's a hold that got cancelled, we can delete the hold record.
  db.batterySales.splice(index, 1);
  addAuditLog(db, operator || 'system', operator || 'system', 'battery_hold_released', `Cancelled battery hold/reservation for Series ${record.batterySeries} (Qty: ${record.quantity}, Buyer: ${record.buyerName}).`);
  writeDB(db);

  if (db.sheetConfig.enabled && db.sheetConfig.webhookUrl) {
    postToGoogleSheets(db.sheetConfig.webhookUrl, {
      action: 'sync_all',
      timestamp: new Date().toISOString(),
      data: {
        products: db.products,
        buyers: db.buyers,
        scooterUnits: db.scooterUnits,
        stockLogs: db.stockLogs,
        batterySales: db.batterySales || [],
        batteryImports: db.batteryImports || [],
        ...getSummaryData(db)
      }
    });
  }

  res.json({ success: true, message: 'Battery hold successfully released.' });
});

// Battery Sales: Finalize Hold
app.post('/api/battery-sales/finalize', validateBody(batterySaleFinalizeSchema), (req, res) => {
  const { id, operator } = req.body;

  const db = readDB();
  if (!db.batterySales) db.batterySales = [];

  const index = db.batterySales.findIndex(s => s.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Battery record not found.' });
  }

  const record = db.batterySales[index];
  if (record.status !== 'hold') {
    return res.status(400).json({ error: 'Can only finalize a record that is currently on hold.' });
  }

  const timestamp = new Date().toISOString();
  record.status = 'sold';
  record.saleDate = timestamp;
  record.operator = operator || record.operator;
  
  db.batterySales[index] = record;
  addAuditLog(db, operator || record.operator, operator || record.operator, 'battery_hold_finalized', `Finalized and dispatched battery sale for Series ${record.batterySeries} (Qty: ${record.quantity}, Buyer: ${record.buyerName}).`);
  writeDB(db);

  if (db.sheetConfig.enabled && db.sheetConfig.webhookUrl) {
    postToGoogleSheets(db.sheetConfig.webhookUrl, {
      action: 'sync_all',
      timestamp,
      data: {
        products: db.products,
        buyers: db.buyers,
        scooterUnits: db.scooterUnits,
        stockLogs: db.stockLogs,
        batterySales: db.batterySales || [],
        batteryImports: db.batteryImports || [],
        ...getSummaryData(db)
      }
    });
  }

  res.json({ success: true, batterySale: record });
});

// Battery Imports: List
app.get('/api/battery-imports', (req, res) => {
  const db = readDB();
  res.json(db.batteryImports || []);
});

// Battery Imports: Add
app.post('/api/battery-imports', validateBody(batteryImportSchema), (req, res) => {
  const { batterySeries, startNo, endNo, quantity, operator, supplierName, containerId, notes } = req.body;

  const db = readDB();
  if (!db.batteryImports) {
    db.batteryImports = [];
  }

  const newImport: BatteryImport = {
    id: `batimport-${Date.now()}`,
    batterySeries,
    startNo: startNo ? String(startNo) : 'N/A',
    endNo: endNo ? String(endNo) : 'N/A',
    quantity,
    importDate: new Date().toISOString(),
    operator: operator || 'system',
    supplierName: supplierName || undefined,
    containerId: containerId || undefined,
    notes: notes || undefined
  };

  db.batteryImports.push(newImport);
  addAuditLog(db, operator || 'system', operator || 'system', 'battery_import', `Imported new batch of batteries: Series ${batterySeries} (Qty: ${quantity}, Supplier: ${supplierName || 'N/A'}).`);
  writeDB(db);

  if (db.sheetConfig.enabled && db.sheetConfig.webhookUrl) {
    postToGoogleSheets(db.sheetConfig.webhookUrl, {
      action: 'sync_all',
      timestamp: new Date().toISOString(),
      data: {
        products: db.products,
        buyers: db.buyers,
        scooterUnits: db.scooterUnits,
        stockLogs: db.stockLogs,
        batterySales: db.batterySales || [],
        batteryImports: db.batteryImports || [],
        ...getSummaryData(db)
      }
    });
  }

  res.json(newImport);
});

// Charger Sales: List
app.get('/api/charger-sales', (req, res) => {
  const db = readDB();
  res.json(db.chargerSales || []);
});

// Charger Sales: Add / Hold
app.post('/api/charger-sales', validateBody(chargerSaleSchema), (req, res) => {
  const { 
    buyerName, 
    chargerType, 
    startNo, 
    endNo, 
    quantity, 
    operator, 
    notes,
    isUnderWarranty,
    warrantyDurationMonths,
    status, // 'sold' | 'hold'
    heldFor
  } = req.body;

  const db = readDB();
  if (!db.chargerSales) {
    db.chargerSales = [];
  }

  const isHold = status === 'hold';
  const timestamp = new Date().toISOString();

  const newSale: ChargerSale = {
    id: `chgsale-${Date.now()}`,
    buyerName,
    chargerType,
    startNo: startNo ? String(startNo).trim().toUpperCase() : 'N/A',
    endNo: endNo ? String(endNo).trim().toUpperCase() : 'N/A',
    quantity,
    saleDate: timestamp,
    operator: operator || 'system',
    notes: notes || undefined,
    isUnderWarranty: !!isUnderWarranty,
    warrantyDurationMonths: isUnderWarranty ? warrantyDurationMonths : undefined,
    status: isHold ? 'hold' : 'sold',
    heldFor: isHold ? (heldFor || buyerName) : undefined,
    heldBy: isHold ? (operator || 'Operator') : undefined,
    holdDate: isHold ? timestamp : undefined
  };

  db.chargerSales.push(newSale);
  addAuditLog(db, operator || 'system', operator || 'system', isHold ? 'charger_hold' : 'charger_sale', `Registered standalone charger ${isHold ? 'hold/reservation' : 'sale/dispatch'} for Type ${chargerType} (Qty: ${quantity}, Buyer: ${buyerName}).`);
  writeDB(db);

  res.json(newSale);
});

// Charger Sales: Release Hold
app.post('/api/charger-sales/release', validateBody(chargerSaleReleaseSchema), (req, res) => {
  const { id, operator } = req.body;

  const db = readDB();
  if (!db.chargerSales) db.chargerSales = [];

  const index = db.chargerSales.findIndex(s => s.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Charger record not found.' });
  }

  const record = db.chargerSales[index];
  if (record.status !== 'hold') {
    return res.status(400).json({ error: 'Can only release a record that is currently on hold.' });
  }

  db.chargerSales.splice(index, 1);
  addAuditLog(db, operator || 'system', operator || 'system', 'charger_hold_released', `Cancelled charger hold/reservation for Type ${record.chargerType} (Qty: ${record.quantity}, Buyer: ${record.buyerName}).`);
  writeDB(db);

  res.json({ success: true, message: 'Charger hold successfully released.' });
});

// Charger Sales: Finalize Hold
app.post('/api/charger-sales/finalize', validateBody(chargerSaleFinalizeSchema), (req, res) => {
  const { id, operator } = req.body;

  const db = readDB();
  if (!db.chargerSales) db.chargerSales = [];

  const index = db.chargerSales.findIndex(s => s.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Charger record not found.' });
  }

  const record = db.chargerSales[index];
  if (record.status !== 'hold') {
    return res.status(400).json({ error: 'Can only finalize a record that is currently on hold.' });
  }

  const timestamp = new Date().toISOString();
  record.status = 'sold';
  record.saleDate = timestamp;
  record.operator = operator || record.operator;
  
  db.chargerSales[index] = record;
  addAuditLog(db, operator || record.operator, operator || record.operator, 'charger_hold_finalized', `Finalized and dispatched charger sale for Type ${record.chargerType} (Qty: ${record.quantity}, Buyer: ${record.buyerName}).`);
  writeDB(db);

  res.json({ success: true, chargerSale: record });
});

// Charger Imports: List
app.get('/api/charger-imports', (req, res) => {
  const db = readDB();
  res.json(db.chargerImports || []);
});

// Charger Imports: Add
app.post('/api/charger-imports', validateBody(chargerImportSchema), (req, res) => {
  const { chargerType, startNo, endNo, quantity, operator, supplierName, containerId, notes } = req.body;

  const db = readDB();
  if (!db.chargerImports) {
    db.chargerImports = [];
  }

  const newImport: ChargerImport = {
    id: `chgimport-${Date.now()}`,
    chargerType,
    startNo: startNo ? String(startNo) : 'N/A',
    endNo: endNo ? String(endNo) : 'N/A',
    quantity,
    importDate: new Date().toISOString(),
    operator: operator || 'system',
    supplierName: supplierName || undefined,
    containerId: containerId || undefined,
    notes: notes || undefined
  };

  db.chargerImports.push(newImport);
  addAuditLog(db, operator || 'system', operator || 'system', 'charger_import', `Imported new batch of chargers: Type ${chargerType} (Qty: ${quantity}, Supplier: ${supplierName || 'N/A'}).`);
  writeDB(db);

  res.json(newImport);
});

// Customizable Battery Series Types: List & Save
app.get('/api/battery-types', (req, res) => {
  const db = readDB();
  res.json(db.batterySeriesList || ['Alpha Series', 'Beta Series', 'Delta Series', 'Omega Series', 'Pro-Pack Series']);
});

app.post('/api/battery-types', validateBody(typeListSchema), (req, res) => {
  const { list, operator } = req.body;
  const db = readDB();
  db.batterySeriesList = list;
  addAuditLog(db, operator || 'system', operator || 'system', 'update_battery_types', `Updated dynamic battery series list: [${db.batterySeriesList.join(', ')}]`);
  writeDB(db);
  res.json(db.batterySeriesList);
});

// Customizable Charger Types: List & Save
app.get('/api/charger-types', (req, res) => {
  const db = readDB();
  res.json(db.chargerTypeList || ['48V Charger', '60V Charger', '72V Charger']);
});

app.post('/api/charger-types', validateBody(typeListSchema), (req, res) => {
  const { list, operator } = req.body;
  const db = readDB();
  db.chargerTypeList = list;
  addAuditLog(db, operator || 'system', operator || 'system', 'update_charger_types', `Updated dynamic charger types list: [${db.chargerTypeList.join(', ')}]`);
  writeDB(db);
  res.json(db.chargerTypeList);
});

// Scooter Units: List
app.get('/api/scooter-units', (req, res) => {
  const db = readDB();
  res.json(db.scooterUnits);
});

// Scooter Units: Create (Stage 1) or Update (Stages 2, 3, 4, 5)
app.post('/api/scooter-units', validateBody(scooterUnitSchema), (req, res) => {
  const {
    id, // Passed if updating
    actionType, // 'create_stage1' | 'customize_stage2' | 'pos_stage3_4' | 'warranty_stage5' | 'direct_update'
    modelName,
    color,
    chassisNo,
    motorNo,
    controllerNo,
    sourceChannel, // 'container_freight' | 'local_seller'
    frontTireSize,
    rearTireSize,
    tireSize,
    customizationNotes,
    buyerName,
    buyerContact,
    salesPrice,
    batterySerials, // array of strings
    scooterWarrantyStatus,
    scooterWarrantyExpiry,
    batteryWarrantyStatus,
    batteryWarrantyExpiry,
    batteryWarrantyFlags,
    batteryWarrantyMonths,
    warrantyNotes,
    operator
  } = req.body;

  const db = readDB();
  const timestamp = new Date().toISOString();

  if (actionType === 'create_stage1') {
    if (!modelName || !color || !chassisNo || !motorNo || !controllerNo || !operator) {
      return res.status(400).json({ error: 'Model, Color, Chassis No, Motor No, Controller No, and Operator are required.' });
    }

    // Duplicate chassis verification
    if (db.scooterUnits.some(u => String(u.chassisNo || '').toLowerCase() === String(chassisNo || '').toLowerCase())) {
      return res.status(400).json({ error: `Chassis number '${chassisNo}' already exists in registry.` });
    }

    const newUnit: ScooterUnit = {
      id: `scoot-${Date.now()}`,
      modelName,
      color,
      chassisNo: chassisNo.trim().toUpperCase(),
      motorNo: motorNo.trim().toUpperCase(),
      controllerNo: controllerNo.trim().toUpperCase(),
      frontTireSize: frontTireSize || '12-inch',
      rearTireSize: rearTireSize || '12-inch',
      tireSize: rearTireSize || '12-inch', // Default standard to rear tire
      batterySerials: [],
      status: 'available',
      scooterWarrantyStatus: 'None',
      batteryWarrantyStatus: 'None',
      createdOperator: operator,
      createdTimestamp: timestamp,
      lastUpdatedTimestamp: timestamp
    };

    db.scooterUnits.push(newUnit);
    addAuditLog(db, operator, operator, 'assemble_scooter', `Assembled brand new Scooter (Model: ${modelName}, Color: ${color}, Chassis: ${newUnit.chassisNo}).`);
    writeDB(db);

    // Sync to sheet
    if (db.sheetConfig.enabled && db.sheetConfig.webhookUrl) {
      postToGoogleSheets(db.sheetConfig.webhookUrl, {
        action: 'create_scooter',
        timestamp,
        data: newUnit
      });
    }

    return res.json({ success: true, scooterUnit: newUnit });
  }

  // Find existing unit
  if (!id) {
    return res.status(400).json({ error: 'Scooter Unit ID is required for updates' });
  }

  const index = db.scooterUnits.findIndex(u => u.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Scooter unit not found.' });
  }

  const unit = { ...db.scooterUnits[index] };

  if (actionType === 'customize_stage2') {
    unit.tireSize = tireSize || unit.tireSize;
    unit.customizationNotes = customizationNotes !== undefined ? customizationNotes : unit.customizationNotes;
    addAuditLog(db, operator || 'system', operator || 'system', 'customize_scooter', `Customized tire configuration to ${unit.tireSize} for Scooter (Chassis: ${unit.chassisNo}). Notes: ${unit.customizationNotes || 'None'}`);
  } else if (actionType === 'pos_stage3_4') {
    if (!buyerName || !batterySerials || !Array.isArray(batterySerials)) {
      return res.status(400).json({ error: 'Buyer Name and Battery Serials array are required.' });
    }
    unit.buyerName = buyerName;
    unit.buyerContact = buyerContact || '';
    unit.salesPrice = salesPrice ? Number(salesPrice) : undefined;
    unit.batterySerials = batterySerials.filter(b => b && b.trim() !== '');
    unit.batteryWarrantyFlags = batteryWarrantyFlags || [];
    unit.batteryWarrantyMonths = batteryWarrantyMonths || [];
    unit.status = 'sold';
    unit.saleDate = timestamp;
    
    // Warranty info added right during sell/POS
    unit.scooterWarrantyStatus = scooterWarrantyStatus || 'None';
    unit.scooterWarrantyExpiry = scooterWarrantyExpiry || undefined;
    unit.batteryWarrantyStatus = batteryWarrantyStatus || 'None';
    unit.batteryWarrantyExpiry = batteryWarrantyExpiry || undefined;
    unit.warrantyNotes = warrantyNotes || '';

    // Auto log transaction out in stock ledger
    const autoOutLog: StockLog = {
      id: `log-out-${Date.now()}`,
      modelName: unit.modelName,
      color: unit.color,
      type: 'out',
      sourceChannel: 'customer_sale',
      quantity: 1,
      buyerName,
      timestamp,
      operator: operator || 'Sales Advisor',
      notes: `Scooter sold and certified (Chassis: ${unit.chassisNo}, Batteries Assigned: ${unit.batterySerials.length})`
    };
    db.stockLogs.push(autoOutLog);
    
    addAuditLog(db, operator || 'system', operator || 'system', 'pos_scooter_sale', `Completed POS retail checkout sale for Scooter (Chassis: ${unit.chassisNo}) to Buyer: ${buyerName}. Batteries linked: [${unit.batterySerials.join(', ') || 'none'}].`);

    if (db.sheetConfig.enabled && db.sheetConfig.webhookUrl) {
      postToGoogleSheets(db.sheetConfig.webhookUrl, {
        action: 'log_stock',
        timestamp,
        data: autoOutLog
      });
    }
  } else if (actionType === 'warranty_stage5') {
    unit.scooterWarrantyStatus = scooterWarrantyStatus || unit.scooterWarrantyStatus;
    unit.scooterWarrantyExpiry = scooterWarrantyExpiry || unit.scooterWarrantyExpiry;
    unit.batteryWarrantyStatus = batteryWarrantyStatus || unit.batteryWarrantyStatus;
    unit.batteryWarrantyExpiry = batteryWarrantyExpiry || unit.batteryWarrantyExpiry;
    unit.warrantyNotes = warrantyNotes !== undefined ? warrantyNotes : unit.warrantyNotes;
    addAuditLog(db, operator || 'system', operator || 'system', 'update_scooter_warranty', `Updated warranty details for Scooter (Chassis: ${unit.chassisNo}). Scooter warranty: ${unit.scooterWarrantyStatus}, Battery warranty: ${unit.batteryWarrantyStatus}.`);
  } else {
    // Direct full update (admin override)
    Object.assign(unit, req.body);
    addAuditLog(db, operator || 'system', operator || 'system', 'admin_override_scooter', `Admin override details updated for Scooter (Chassis: ${unit.chassisNo}).`);
  }

  unit.lastUpdatedBy = operator;
  unit.lastUpdatedTimestamp = timestamp;

  db.scooterUnits[index] = unit;
  writeDB(db);

  if (db.sheetConfig.enabled && db.sheetConfig.webhookUrl) {
    postToGoogleSheets(db.sheetConfig.webhookUrl, {
      action: 'update_scooter',
      timestamp,
      data: unit
    });
  }

  res.json({ success: true, scooterUnit: unit });
});

// Scooter Units: Bulk Create (Stage 1)
app.post('/api/scooter-units/bulk-create', validateBody(scooterBulkCreateSchema), (req, res) => {
  const {
    modelName,
    color,
    sourceChannel,
    frontTireSize,
    rearTireSize,
    items, // array of { chassisNo, motorNo, controllerNo }
    operator
  } = req.body;

  const db = readDB();
  const timestamp = new Date().toISOString();

  // Validate for duplicates inside existing database
  const existingChassis = new Set(db.scooterUnits.map(u => String(u.chassisNo || '').toLowerCase()));
  const incomingDuplicates: string[] = [];
  const incomingChassisSet = new Set<string>();

  for (const item of items) {
    const cleanChassis = (item.chassisNo || '').trim().toLowerCase();
    if (existingChassis.has(cleanChassis)) {
      incomingDuplicates.push(`${item.chassisNo} (already exists in database)`);
    }
    if (incomingChassisSet.has(cleanChassis)) {
      incomingDuplicates.push(`${item.chassisNo} (duplicate in your pasted list)`);
    }
    incomingChassisSet.add(cleanChassis);
  }

  if (incomingDuplicates.length > 0) {
    return res.status(400).json({
      error: `Duplicate chassis numbers detected. Please verify unique values:\n${incomingDuplicates.join('\n')}`
    });
  }

  const createdUnits: ScooterUnit[] = [];
  const baseTime = Date.now();

  items.forEach((item, idx) => {
    const uniqueId = `scoot-${baseTime}-${idx}`;

    const newUnit: ScooterUnit = {
      id: uniqueId,
      modelName,
      color,
      chassisNo: item.chassisNo.trim().toUpperCase(),
      motorNo: item.motorNo.trim().toUpperCase(),
      controllerNo: item.controllerNo.trim().toUpperCase(),
      frontTireSize: frontTireSize || '12-inch',
      rearTireSize: rearTireSize || '12-inch',
      tireSize: rearTireSize || '12-inch',
      batterySerials: [],
      status: 'available',
      scooterWarrantyStatus: 'None',
      batteryWarrantyStatus: 'None',
      createdOperator: operator,
      createdTimestamp: timestamp,
      lastUpdatedTimestamp: timestamp
    };

    db.scooterUnits.push(newUnit);
    createdUnits.push(newUnit);
  });

  addAuditLog(db, operator, operator, 'bulk_assemble_scooters', `Bulk registered ${createdUnits.length} brand new Scooters (Model: ${modelName}, Color: ${color}).`);
  writeDB(db);

  // Sync to sheet
  if (db.sheetConfig.enabled && db.sheetConfig.webhookUrl) {
    postToGoogleSheets(db.sheetConfig.webhookUrl, {
      action: 'sync_all',
      timestamp,
      data: {
        products: db.products,
        buyers: db.buyers,
        scooterUnits: db.scooterUnits,
        stockLogs: db.stockLogs,
        batterySales: db.batterySales || [],
        batteryImports: db.batteryImports || [],
        ...getSummaryData(db)
      }
    });
  }

  res.json({ success: true, count: createdUnits.length });
});

// Scooter Units: Bulk POS Sale & Deliver (Stage 3 & 4)
app.post('/api/scooter-units/bulk-pos', validateBody(scooterBulkPosSchema), (req, res) => {
  const {
    buyerName,
    buyerContact,
    salesPrice,
    scooterWarrantyStatus,
    scooterWarrantyExpiry,
    batteryWarrantyStatus,
    batteryWarrantyExpiry,
    warrantyNotes,
    operator,
    sales, // array of { id: string, batterySerials: string[], batteryWarrantyFlags: boolean[] }
    status // 'sold' | 'hold'
  } = req.body;

  const db = readDB();
  const timestamp = new Date().toISOString();
  const isHold = status === 'hold';
  const actionNoun = isHold ? 'hold' : 'sell';

  // Validate that all scooters exist and are not sold
  const scooterMap = new Map(db.scooterUnits.map(u => [u.id, u]));
  const invalidScooters: string[] = [];

  for (const sale of sales) {
    const unit = scooterMap.get(sale.id);
    if (!unit) {
      invalidScooters.push(`ID ${sale.id}`);
      continue;
    }
    if (unit.status === 'sold') {
      invalidScooters.push(`Chassis ${unit.chassisNo} (already sold/dispatched)`);
    }
  }

  if (invalidScooters.length > 0) {
    return res.status(400).json({
      error: `The following scooters cannot be processed for ${actionNoun}: ${invalidScooters.join(', ')}`
    });
  }

  const baseTime = Date.now();
  sales.forEach((sale, idx) => {
    const index = db.scooterUnits.findIndex(u => u.id === sale.id);
    if (index !== -1) {
      const unit = db.scooterUnits[index];
      unit.buyerName = buyerName;
      unit.buyerContact = buyerContact || '';
      unit.salesPrice = salesPrice ? Number(salesPrice) : undefined;
      
      if (sale.batterySerials && Array.isArray(sale.batterySerials) && sale.batterySerials.length > 0) {
        unit.batterySerials = sale.batterySerials.filter(b => b && b.trim() !== '').map(b => b.trim().toUpperCase());
        unit.batteryWarrantyFlags = sale.batteryWarrantyFlags || [];
        unit.batteryWarrantyMonths = sale.batteryWarrantyMonths || [];
      }
      
      if (isHold) {
        unit.status = 'hold';
        unit.heldFor = buyerName;
        unit.heldBy = operator;
        unit.holdDate = timestamp;
        
        // On hold, warranties are not active yet
        unit.scooterWarrantyStatus = 'None';
        unit.scooterWarrantyExpiry = undefined;
        unit.batteryWarrantyStatus = 'None';
        unit.batteryWarrantyExpiry = undefined;
        unit.warrantyNotes = warrantyNotes || '';
      } else {
        unit.status = 'sold';
        unit.saleDate = timestamp;
        unit.heldFor = undefined;
        unit.heldBy = undefined;
        unit.holdDate = undefined;
        
        unit.scooterWarrantyStatus = scooterWarrantyStatus || 'None';
        unit.scooterWarrantyExpiry = scooterWarrantyExpiry || undefined;
        unit.batteryWarrantyStatus = batteryWarrantyStatus || 'None';
        unit.batteryWarrantyExpiry = batteryWarrantyExpiry || undefined;
        unit.warrantyNotes = warrantyNotes || '';

        // Auto log transaction out in stock ledger
        const autoOutLog: StockLog = {
          id: `log-out-${baseTime}-${idx}`,
          modelName: unit.modelName,
          color: unit.color,
          type: 'out',
          sourceChannel: 'customer_sale',
          quantity: 1,
          buyerName,
          timestamp,
          operator,
          notes: `Scooter sold in bulk (Chassis: ${unit.chassisNo}, Batteries Assigned: ${unit.batterySerials.length})`
        };
        db.stockLogs.push(autoOutLog);
      }

      unit.lastUpdatedBy = operator;
      unit.lastUpdatedTimestamp = timestamp;
    }
  });

  addAuditLog(db, operator, operator, isHold ? 'bulk_scooter_hold' : 'bulk_scooter_sale', `Completed bulk ${isHold ? 'hold reservation' : 'sale dispatch'} of ${sales.length} Scooters to Buyer: ${buyerName}.`);
  writeDB(db);

  // Sync to sheet
  if (db.sheetConfig.enabled && db.sheetConfig.webhookUrl) {
    postToGoogleSheets(db.sheetConfig.webhookUrl, {
      action: 'sync_all',
      timestamp,
      data: {
        products: db.products,
        buyers: db.buyers,
        scooterUnits: db.scooterUnits,
        stockLogs: db.stockLogs,
        batterySales: db.batterySales || [],
        batteryImports: db.batteryImports || [],
        ...getSummaryData(db)
      }
    });
  }

  res.json({ success: true, count: sales.length });
});

// StockLogs: List
app.get('/api/stock-logs', (req, res) => {
  const db = readDB();
  res.json(db.stockLogs);
});

// StockLogs: Add (Bulk adjustment / generic logging)
app.post('/api/stock-logs', validateBody(stockLogSchema), (req, res) => {
  const { modelName, color, type, sourceChannel, quantity, buyerName, operator, notes } = req.body;

  const db = readDB();
  const timestamp = new Date().toISOString();

  const newLog: StockLog = {
    id: `log-${Date.now()}`,
    modelName,
    color,
    type,
    sourceChannel: sourceChannel || (type === 'in' ? 'container_freight' : 'customer_sale'),
    quantity,
    buyerName: type === 'out' ? buyerName : undefined,
    timestamp,
    operator,
    notes: notes || ''
  };

  db.stockLogs.push(newLog);
  writeDB(db);

  if (db.sheetConfig.enabled && db.sheetConfig.webhookUrl) {
    postToGoogleSheets(db.sheetConfig.webhookUrl, {
      action: 'log_stock',
      timestamp,
      data: newLog
    });
  }

  res.json(newLog);
});

// SheetConfig: Get
app.get('/api/sheet-config', (req, res) => {
  const db = readDB();
  res.json(db.sheetConfig);
});

// SheetConfig: Update
app.post('/api/sheet-config', validateBody(sheetConfigSchema), (req, res) => {
  const { webhookUrl, enabled } = req.body;

  const db = readDB();
  db.sheetConfig = {
    webhookUrl: webhookUrl.trim(),
    enabled
  };
  writeDB(db);
  res.json(db.sheetConfig);
});

// SheetConfig: Sync All
app.post('/api/sheet-config/sync-all', async (req, res) => {
  const db = readDB();
  if (!db.sheetConfig.webhookUrl) {
    return res.status(400).json({ error: 'Google Sheet Webhook URL is not configured' });
  }

  const payload = {
    action: 'sync_all',
    timestamp: new Date().toISOString(),
    data: {
      products: db.products,
      buyers: db.buyers,
      scooterUnits: db.scooterUnits,
      stockLogs: db.stockLogs,
      batterySales: db.batterySales || [],
      batteryImports: db.batteryImports || [],
      ...getSummaryData(db)
    }
  };

  const success = await postToGoogleSheets(db.sheetConfig.webhookUrl, payload);
  if (success) {
    res.json({ success: true, message: 'All warehouse records successfully synced to Google Sheet!' });
  } else {
    res.status(500).json({ error: 'Failed to sync with Google Sheet. Please check the Webapp URL/Script.' });
  }
});

// SheetConfig: Pull All (Import latest data from sheets)
app.post('/api/sheet-config/pull-all', async (req, res) => {
  const db = readDB();
  const webhookUrl = process.env.GOOGLE_SHEET_WEBHOOK_URL || db.sheetConfig.webhookUrl;
  if (!webhookUrl) {
    return res.status(400).json({ error: 'Google Sheet Webhook URL is not configured' });
  }

  const data = await pullFromGoogleSheets(webhookUrl);
  if (data) {
    if (data.products && Array.isArray(data.products) && data.products.length > 0) {
      db.products = data.products;
    }
    if (data.buyers && Array.isArray(data.buyers) && data.buyers.length > 0) {
      db.buyers = data.buyers;
    }
    if (data.scooterUnits && Array.isArray(data.scooterUnits)) {
      db.scooterUnits = data.scooterUnits;
    }
    if (data.stockLogs && Array.isArray(data.stockLogs)) {
      db.stockLogs = data.stockLogs;
    }
    if (data.batterySales && Array.isArray(data.batterySales)) {
      db.batterySales = data.batterySales;
    }
    if (data.batteryImports && Array.isArray(data.batteryImports)) {
      db.batteryImports = data.batteryImports;
    }

    db.sheetConfig.webhookUrl = webhookUrl;
    db.sheetConfig.enabled = true;

    writeDB(db);
    res.json({ success: true, message: 'All warehouse records successfully pulled and imported from Google Sheet!' });
  } else {
    if (webhookUrl.includes('docs.google.com/spreadsheets')) {
      res.status(400).json({ 
        error: 'Failed to read Google Sheet directly. Please verify that:\n\n' +
               '1. Your Google Sheet has been shared with "Anyone with the link can view". (To do this: open the sheet, click the blue "Share" button in the top right, and under "General access" change from "Restricted" to "Anyone with the link can view").\n\n' +
               '2. Your spreadsheet has tabs matching expected names (like "Accessories", "Products", etc.), or if there is only one tab, its headers match expected columns in Row 1 (like "Name", "Category", "Available Stock", "Buying Price").\n\n' +
               '3. The spreadsheet has some content and is not completely blank.'
      });
    } else {
      res.status(500).json({ error: 'Failed to pull from Google Sheet Webapp. Please check that your Google Apps Script is deployed as a Web App, runs as "Me", and is accessible to "Anyone".' });
    }
  }
});

// Vite Middleware & Static Serving setup
async function startServer() {
  // First, hydrate from cloud Firestore
  const firestoreState = await hydrateFromFirestore();
  if (firestoreState) {
    globalDBState = firestoreState;
    console.log('Successfully loaded single source of truth from Firestore database!');
  } else {
    globalDBState = readDBFromFile();
    console.log('Firebase offline or uninitialized, loaded local database from file.');
  }

  // Try to pull latest data from Google Sheet on startup if configured
  const dbOnBoot = readDB();
  const startupSheetUrl = process.env.GOOGLE_SHEET_WEBHOOK_URL || dbOnBoot.sheetConfig.webhookUrl;
  if (startupSheetUrl && (process.env.GOOGLE_SHEET_WEBHOOK_URL || dbOnBoot.sheetConfig.enabled)) {
    console.log('Detected Google Sheets URL on startup. Hydrating database from Sheets...');
    pullFromGoogleSheets(startupSheetUrl).then(data => {
      if (data) {
        const db = readDB();
        if (data.products && Array.isArray(data.products) && data.products.length > 0) db.products = data.products;
        if (data.buyers && Array.isArray(data.buyers) && data.buyers.length > 0) db.buyers = data.buyers;
        if (data.scooterUnits && Array.isArray(data.scooterUnits)) db.scooterUnits = data.scooterUnits;
        if (data.stockLogs && Array.isArray(data.stockLogs)) db.stockLogs = data.stockLogs;
        
        db.sheetConfig.webhookUrl = startupSheetUrl;
        db.sheetConfig.enabled = true;
        writeDB(db);
        console.log('Database successfully hydrated from Google Sheet on application restart.');
      } else {
        console.warn('Could not hydrate database on startup from Google Sheet.');
      }
    }).catch(err => {
      console.error('Error hydrating database from Sheets on boot:', err);
    });
  }

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Global Error Handler Middleware
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled Global Server Error:', err);
    res.status(500).json({
      error: 'An unexpected internal server error occurred. Please try again later.'
    });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Warehouse Registry Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
