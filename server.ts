import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { DBState, User, Product, Buyer, ScooterUnit, StockLog, SheetConfig, BatterySale, BatteryImport, ChargerSale, ChargerImport, WarrantyClaim, AuditLog } from './src/types';
import { z } from 'zod';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, getDocs, collection, writeBatch } from 'firebase/firestore';

const app = express();
const PORT = 3000;
const DB_FILE = path.join(process.cwd(), 'warehouse_db.json');

// ─── FIREBASE INITIALIZATION ──────────────────────────────────────────────────
// DISABLE_FIREBASE=true → fully local mode, no Firebase, safe for AI Studio dev.
// RENDER=true           → always connect Firebase (production on Render).
// Default (local dev)   → connect only if firebase-applet-config.json exists.
const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
let firebaseApp: any = null;
let firebaseDb: any = null;

const DISABLE_FIREBASE = process.env.DISABLE_FIREBASE === 'true';

if (DISABLE_FIREBASE) {
  console.log('⚠️  DISABLE_FIREBASE=true — Running in fully local mode. Firebase is OFF. No live data will be touched.');
} else {
  const shouldInitFirebase = process.env.RENDER === 'true' || fs.existsSync(firebaseConfigPath);
  if (shouldInitFirebase && fs.existsSync(firebaseConfigPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
      firebaseApp = initializeApp(config);
      firebaseDb = getFirestore(firebaseApp);
      console.log('✅ Firebase App and Firestore successfully initialized!');
    } catch (err) {
      console.error('Error initializing Firebase in server.ts:', err);
    }
  } else {
    console.log('No firebase-applet-config.json found. Running in local/offline mode.');
  }
}

let globalDBState: DBState | null = null;


app.use(express.json());

// ─── CORS: Allow Android APK (Capacitor) and all web origins ────────────────
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});



// Helper to write to Google Sheets Webhook asynchronously (Disabled per user request)
async function postToGoogleSheets(webhookUrl: string, payload: any) {
  console.log('Sync to Google Sheets has been intentionally disabled per user request.');
  return true;
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
const DEFAULT_PRODUCTS: Product[] = [
  { id: "prod-senzo-0", name: "SENZO ESSENATIAL W/O DISK", colors: ["WHITE", "BLACK", "GREY", "RED", "COFFIE", "C-GREEN", "SHINE BLUE", "BLUE"] },
  { id: "prod-senzo-1", name: "SENZO CKD", colors: ["ANY OTHER"] },
  { id: "prod-senzo-2", name: "SENZO ESSENATIAL DISC", colors: ["Red", "Black", "WHITE", "GREY", "BLUE", "C-GREEN", "SHINE BLUE", "MEHROON", "YELLOW", "GOLDEN", "COFFIE"] },
  { id: "prod-senzo-3", name: "SENZO LODER", colors: ["BLACK"] },
  { id: "prod-senzo-4", name: "SENZO ESSENATIAL DISC 12\"/10\"", colors: ["Red", "Black", "WHITE", "GREY", "BLUE", "C-GREEN", "SILVER", "SHINE BLUE", "MEHROON", "SKY BLUE", "COFFIE"] },
  { id: "prod-senzo-5", name: "CITY XL 10\"/10\"", colors: ["BLACK", "RED", "C-GREEN", "GOLDEN", "WHITE", "BLUE", "GREY"] },
  { id: "prod-senzo-6", name: "UNCOMPLET", colors: ["WHITE", "RED", "SILVER"] },
  { id: "prod-senzo-7", name: "CITY XL 12\"/10\"", colors: ["BLACK", "WHITE", "C-GREEN", "RED", "BLUE", "COFFIE", "GREY"] },
  { id: "prod-senzo-8", name: "SENZO CITY R.L 10\"/10\"", colors: ["BLACK", "WHITE", "RED", "GREY", "BLUE"] },
  { id: "prod-senzo-9", name: "SENZO CITY RL 10\"/10\" UNCOMPLET", colors: ["RED", "WHITE"] },
  { id: "prod-senzo-10", name: "SENZO CITY R.L 12\"/10\"", colors: ["BLACK", "WHITE", "C-GREEN", "GREY", "COFFIE", "RED"] },
  { id: "prod-senzo-11", name: "SENZO CITY S.Q 10\"/10\"", colors: ["BLACK", "WHITE", "SILVER", "GREY"] },
  { id: "prod-senzo-12", name: "SENZO POWER 12\"/12\"", colors: ["WHITE", "BLACK", "BLUE", "GREY", "C-GREEN", "RED", "GOLDEN"] },
  { id: "prod-senzo-13", name: "SENZO POWER 12\"/10\"", colors: ["BLACK", "WHITE"] },
  { id: "prod-senzo-14", name: "SENZO POWER PLUS okinawa", colors: ["WHITE", "GREY", "C-GREEN", "Red", "BLUE", "BLACK"] },
  { id: "prod-senzo-15", name: "SENZO POWER Plus NEO", colors: ["WHITE", "BLACK", "BLUE", "C-GREEN", "GREY", "RED", "GOLDEN"] },
  { id: "prod-senzo-16", name: "SENZO CITY PLUS U LIGHT", colors: ["BLACK", "WHITE", "GREY", "RED", "BLUE"] },
  { id: "prod-senzo-17", name: "SENZO CITY PLUS NEO JALI", colors: ["BLACK", "WHITE", "BLUE", "GREY", "RED"] },
  { id: "prod-senzo-18", name: "SENZO CITY S.Q 10\"/10\" NEW", colors: ["BLACK", "WHITE", "RED", "GREY"] },
  { id: "prod-senzo-19", name: "SENZO ESSENATIAL DISC 3W", colors: ["BLACK", "WHITE", "C-GREEN", "GREY"] },
  { id: "prod-senzo-20", name: "SENZO CITY XL 3W", colors: ["RED"] },
  { id: "prod-senzo-21", name: "SENZO POWER +NEO (STAR LIGHT)", colors: ["GREY", "BLACK", "WHITE", "C-GREEN"] },
  { id: "prod-senzo-22", name: "SENZO POWER (HYBRID)", colors: ["GREY", "BLACK", "WHITE", "RED", "C-GREEN"] },
  { id: "prod-senzo-23", name: "SENZO POWER+XL", colors: ["GREY", "BLACK", "WHITE", "GOLDEN"] },
  { id: "prod-senzo-24", name: "ARCHAR", colors: ["RED", "BLUE", "GREY", "WHITE"] },
  { id: "prod-senzo-25", name: "OLD SCOOTY", colors: ["YELLOW", "MIX"] },
  { id: "prod-senzo-26", name: "SENZO POWER 10/10", colors: ["BLACK", "WHITE", "GREY"] },
  { id: "prod-senzo-27", name: "SENZO CITY + KGF", colors: ["BLACK", "WHITE", "RED", "GREY"] },
  { id: "prod-senzo-28", name: "SENZO CITY PLUS PRO", colors: ["BLACK", "WHITE", "C-GREEN", "GREY"] },
  { id: "prod-senzo-29", name: "SENZO LODER TWO WHEELS", colors: ["BLACK"] },
  { id: "prod-senzo-30", name: "SENZO LODER THREE WHEELS", colors: ["BLACK"] },
  { id: "prod-senzo-31", name: "SENZO CITY MAGIC (OLA)", colors: ["BLACK", "WHITE", "RED", "BLUE", "C-GREEN", "GREY"] },
  { id: "prod-senzo-32", name: "SENZO CITY PLUS PRO BMW", colors: ["BLACK", "WHITE", "BLUE", "RED", "GREY"] },
  { id: "prod-senzo-33", name: "SENZO CITY RL SWIFT", colors: ["BLACK", "WHITE", "GREY", "C-GREEN", "BLUE"] },
  { id: "prod-senzo-34", name: "SENZO POWER PLUS PRO", colors: ["BLACK", "WHITE", "GREY", "C-GREEN", "BLUE"] },
  { id: "prod-senzo-35", name: "SENZO CITY XL PRO 12/12", colors: ["BLACK", "WHITE", "GREY", "RED", "C-GREEN", "BLUE"] },
  { id: "prod-senzo-36", name: "SENZO POWER TURBO (E4)", colors: ["BLACK", "WHITE", "GREY", "RED", "C-GREEN", "BLUE"] },
  { id: "prod-senzo-37", name: "SENZO SENZO ESSENATIAL DISC 12\"/10\" CKD", colors: ["ANY OTHER"] },
  { id: "prod-senzo-38", name: "SENZO POWER TURBO CKD (E4)", colors: ["ANY OTHER"] },
  { id: "prod-senzo-39", name: "SENZO CITY RL SWIFT CKD", colors: ["ANY OTHER"] },
  { id: "prod-senzo-40", name: "SENZO POWER PLUS PRO CKD", colors: ["ANY OTHER"] },
  { id: "prod-senzo-41", name: "SENZO CITY MAGIC (OLA) CKD", colors: ["ANY OTHER"] },
  { id: "prod-senzo-42", name: "STAFF USE /OLD SCOOTY", colors: ["BLACK"] },
  { id: "prod-1783675720160", name: "Single light", colors: ["White", "Red", "Black", "Blue"] }
];

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
  manager: {
    id: 'u-manager',
    username: 'manager',
    passwordHash: 'manager123',
    role: 'manager',
    name: 'Warehouse Manager',
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

      let finalProducts = parsed.products || [];
      const hasSenzo = Array.isArray(finalProducts) && finalProducts.some((p: any) => p.name && p.name.includes('SENZO'));
      const hasVolt = Array.isArray(finalProducts) && finalProducts.some((p: any) => p.name && (p.name.includes('Volt S-1') || p.name.includes('Volt S-2') || p.name.includes('Volt Pro-X')));
      if (!Array.isArray(finalProducts) || !hasSenzo || hasVolt || finalProducts.length < 5) {
        finalProducts = DEFAULT_PRODUCTS;
      }

      return {
        users: mergedUsers,
        products: finalProducts,
        buyers: parsed.buyers || DEFAULT_BUYERS,
        scooterUnits: parsed.scooterUnits || legacyUnits || [],
        stockLogs: parsed.stockLogs || [],
        sheetConfig: { webhookUrl: sheetUrl, enabled: sheetEnabled },
        batterySales: parsed.batterySales || [],
        batteryImports: parsed.batteryImports || [],
        chargerSales: parsed.chargerSales || [],
        chargerImports: parsed.chargerImports || [],
        batterySeriesList: parsed.batterySeriesList || ['Lithium 60V, 24AH', 'Lithium 60V, 30AH', 'Lithium 60V, 10AH', 'Lithium 48V, 30AH', 'Lithium 48V, 24AH', 'Lithium 60V, 28AH', 'Lithium 72V, 42AH', 'Lead Acid 12V'],
        chargerTypeList: parsed.chargerTypeList || ['Lithium Charger 54.6V/6A', 'Lithium Charger 69.4V/6A', 'Lithium Charger 67.2V/6A', 'Lead Acid Charger 48V', 'Lead Acid Charger 60V', 'Lead Acid Charger 72V'],
        auditLogs: parsed.auditLogs || [],
        warrantyClaims: parsed.warrantyClaims || []
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
    batterySeriesList: ['Lithium 60V, 24AH', 'Lithium 60V, 30AH', 'Lithium 60V, 10AH', 'Lithium 48V, 30AH', 'Lithium 48V, 24AH', 'Lithium 60V, 28AH', 'Lithium 72V, 42AH', 'Lead Acid 12V'],
    chargerTypeList: ['Lithium Charger 54.6V/6A', 'Lithium Charger 69.4V/6A', 'Lithium Charger 67.2V/6A', 'Lead Acid Charger 48V', 'Lead Acid Charger 60V', 'Lead Acid Charger 72V'],
    auditLogs: [],
    warrantyClaims: []
  };
}

function readDB(): DBState {
  if (globalDBState) {
    // Return a deep copy so API handlers do not mutate the global state before writeDB is called.
    // This allows writeDB to correctly capture the oldState for Firestore comparison.
    return JSON.parse(JSON.stringify(globalDBState));
  }
  globalDBState = readDBFromFile();
  return JSON.parse(JSON.stringify(globalDBState));
}

function cleanForFirestore(obj: any): any {
  return obj;
}

async function syncCollectionArray<T extends { id: string }>(
  collectionName: string,
  newList: T[] | undefined,
  oldList: T[] | undefined
) {
  if (!firebaseDb) return;
  const newArr = newList || [];
  const oldArr = oldList || [];

  const oldMap = new Map<string, T>();
  oldArr.forEach(item => {
    if (item.id) oldMap.set(item.id, item);
  });

  const changedItems: T[] = [];
  newArr.forEach(item => {
    if (!item.id) return;
    const oldItem = oldMap.get(item.id);
    if (!oldItem || JSON.stringify(item) !== JSON.stringify(oldItem)) {
      changedItems.push(item);
    }
  });

  const newIds = new Set(newArr.map(item => item.id).filter(Boolean));
  const deletedIds: string[] = [];
  oldArr.forEach(item => {
    if (item.id && !newIds.has(item.id)) {
      deletedIds.push(item.id);
    }
  });

  if (changedItems.length > 0 || deletedIds.length > 0) {
    console.log(`[Firestore Sync] Collection ${collectionName}: ${changedItems.length} changed, ${deletedIds.length} deleted.`);
    
    let batch = writeBatch(firebaseDb);
    let count = 0;

    for (const item of changedItems) {
      const docRef = doc(firebaseDb, collectionName, item.id);
      batch.set(docRef, item, { merge: true });
      count++;
      if (count >= 500) {
        await batch.commit();
        batch = writeBatch(firebaseDb);
        count = 0;
      }
    }

    for (const id of deletedIds) {
      const docRef = doc(firebaseDb, collectionName, id);
      batch.delete(docRef);
      count++;
      if (count >= 500) {
        await batch.commit();
        batch = writeBatch(firebaseDb);
        count = 0;
      }
    }

    if (count > 0) {
      await batch.commit();
    }
  }
}

async function syncUsers(
  newUsers: { [username: string]: any } | undefined,
  oldUsers: { [username: string]: any } | undefined
) {
  if (!firebaseDb) return;
  const newMap = newUsers || {};
  const oldMap = oldUsers || {};

  const changedUsers: { username: string; data: any }[] = [];
  for (const [username, userData] of Object.entries(newMap)) {
    const oldUserData = oldMap[username];
    if (!oldUserData || JSON.stringify(userData) !== JSON.stringify(oldUserData)) {
      changedUsers.push({ username, data: userData });
    }
  }

  const deletedUsernames: string[] = [];
  for (const username of Object.keys(oldMap)) {
    if (!newMap[username]) {
      deletedUsernames.push(username);
    }
  }

  if (changedUsers.length > 0 || deletedUsernames.length > 0) {
    console.log(`[Firestore Sync] Users: ${changedUsers.length} changed, ${deletedUsernames.length} deleted.`);
    let batch = writeBatch(firebaseDb);
    let count = 0;

    for (const u of changedUsers) {
      const docRef = doc(firebaseDb, 'users', u.username.toLowerCase());
      batch.set(docRef, u.data, { merge: true });
      count++;
      if (count >= 500) {
        await batch.commit();
        batch = writeBatch(firebaseDb);
        count = 0;
      }
    }

    for (const username of deletedUsernames) {
      const docRef = doc(firebaseDb, 'users', username.toLowerCase());
      batch.delete(docRef);
      count++;
      if (count >= 500) {
        await batch.commit();
        batch = writeBatch(firebaseDb);
        count = 0;
      }
    }

    if (count > 0) {
      await batch.commit();
    }
  }
}

async function syncSheetConfig(newConfig: any, oldConfig: any) {
  if (!firebaseDb) return;
  if (!newConfig) return;
  if (!oldConfig || JSON.stringify(newConfig) !== JSON.stringify(oldConfig)) {
    console.log(`[Firestore Sync] config/sheetConfig updated.`);
    const docRef = doc(firebaseDb, 'config', 'sheetConfig');
    await setDoc(docRef, newConfig, { merge: true });
  }
}

async function syncLists(
  newBatterySeries: string[] | undefined,
  oldBatterySeries: string[] | undefined,
  newChargerTypes: string[] | undefined,
  oldChargerTypes: string[] | undefined
) {
  if (!firebaseDb) return;
  const changedBattery = !oldBatterySeries || JSON.stringify(newBatterySeries) !== JSON.stringify(oldBatterySeries);
  const changedCharger = !oldChargerTypes || JSON.stringify(newChargerTypes) !== JSON.stringify(oldChargerTypes);
  if (changedBattery || changedCharger) {
    console.log(`[Firestore Sync] config/lists updated.`);
    const docRef = doc(firebaseDb, 'config', 'lists');
    await setDoc(docRef, {
      batterySeriesList: newBatterySeries || [],
      chargerTypeList: newChargerTypes || []
    }, { merge: true });
  }
}

async function syncToFirestore(state: DBState, oldState: DBState | null) {
  if (!firebaseDb) return;

  try {
    const baseState = oldState || {
      users: {},
      products: [],
      buyers: [],
      scooterUnits: [],
      stockLogs: [],
      sheetConfig: { webhookUrl: '', enabled: false },
      batterySales: [],
      batteryImports: [],
      chargerSales: [],
      chargerImports: [],
      batterySeriesList: [],
      chargerTypeList: [],
      auditLogs: [],
      warrantyClaims: []
    };

    await syncUsers(state.users, baseState.users);
    await syncCollectionArray('products', state.products, baseState.products);
    await syncCollectionArray('buyers', state.buyers, baseState.buyers);
    await syncCollectionArray('scooterUnits', state.scooterUnits, baseState.scooterUnits);
    await syncCollectionArray('stockLogs', state.stockLogs, baseState.stockLogs);
    await syncCollectionArray('batterySales', state.batterySales, baseState.batterySales);
    await syncCollectionArray('batteryImports', state.batteryImports, baseState.batteryImports);
    await syncCollectionArray('chargerSales', state.chargerSales, baseState.chargerSales);
    await syncCollectionArray('chargerImports', state.chargerImports, baseState.chargerImports);
    await syncCollectionArray('auditLogs', state.auditLogs, baseState.auditLogs);
    await syncCollectionArray('warrantyClaims', state.warrantyClaims, baseState.warrantyClaims);
    await syncSheetConfig(state.sheetConfig, baseState.sheetConfig);
    await syncLists(
      state.batterySeriesList,
      baseState.batterySeriesList,
      state.chargerTypeList,
      baseState.chargerTypeList
    );
  } catch (error) {
    console.error('Error during Firestore background sync:', error);
  }
}

async function seedFirestore(state: DBState) {
  if (!firebaseDb) return;
  console.log('Seeding entire local warehouse database to Firestore...');
  await syncToFirestore(state, null);
  console.log('Seeding complete!');
}

async function hydrateFromFirestore(): Promise<DBState | null> {
  if (!firebaseDb) return null;

  try {
    console.log('Hydrating local database cache from cloud Firestore...');

    // ─── PRIMARY: Try to load the single main_state document (new method) ───
    const mainStateSnap = await getDoc(doc(firebaseDb, 'warehouse', 'main_state'));
    if (mainStateSnap.exists()) {
      const data = mainStateSnap.data() as DBState;
      console.log(`Loaded from Firestore main_state: ${data.scooterUnits?.length || 0} scooters, ${data.products?.length || 0} products.`);
      return {
        users: data.users || DEFAULT_USERS,
        products: data.products || [],
        buyers: data.buyers || [],
        scooterUnits: data.scooterUnits || [],
        stockLogs: data.stockLogs || [],
        sheetConfig: data.sheetConfig || { webhookUrl: '', enabled: false },
        batterySales: data.batterySales || [],
        batteryImports: data.batteryImports || [],
        chargerSales: data.chargerSales || [],
        chargerImports: data.chargerImports || [],
        batterySeriesList: data.batterySeriesList || ['Lithium 60V, 24AH', 'Lithium 60V, 30AH'],
        chargerTypeList: data.chargerTypeList || ['Lithium Charger 54.6V/6A'],
        auditLogs: data.auditLogs || [],
        warrantyClaims: data.warrantyClaims || []
      };
    }

    // ─── FALLBACK: Read from individual collections (legacy method) ──────────
    console.log('No main_state found. Falling back to collection-based hydration...');
    const state: Partial<DBState> = {};

    const usersSnap = await getDocs(collection(firebaseDb, 'users'));
    const users: { [username: string]: User & { passwordHash: string } } = {};
    usersSnap.forEach(docSnap => {
      const u = docSnap.data() as User & { passwordHash: string };
      if (u.username) {
        users[u.username.toLowerCase()] = u;
      }
    });
    state.users = Object.keys(users).length > 0 ? users : undefined;

    async function fetchCollectionArray<T>(collName: string): Promise<T[]> {
      const snap = await getDocs(collection(firebaseDb, collName));
      const arr: T[] = [];
      snap.forEach(docSnap => {
        arr.push(docSnap.data() as T);
      });
      return arr;
    }

    state.products = await fetchCollectionArray<Product>('products');
    state.buyers = await fetchCollectionArray<Buyer>('buyers');
    state.scooterUnits = await fetchCollectionArray<ScooterUnit>('scooterUnits');
    state.stockLogs = await fetchCollectionArray<StockLog>('stockLogs');
    state.batterySales = await fetchCollectionArray<BatterySale>('batterySales');
    state.batteryImports = await fetchCollectionArray<BatteryImport>('batteryImports');
    state.chargerSales = await fetchCollectionArray<ChargerSale>('chargerSales');
    state.chargerImports = await fetchCollectionArray<ChargerImport>('chargerImports');
    state.auditLogs = await fetchCollectionArray<AuditLog>('auditLogs');
    state.warrantyClaims = await fetchCollectionArray<WarrantyClaim>('warrantyClaims');

    const configListsSnap = await getDoc(doc(firebaseDb, 'config', 'lists'));
    if (configListsSnap.exists()) {
      const listsData = configListsSnap.data();
      state.batterySeriesList = listsData.batterySeriesList;
      state.chargerTypeList = listsData.chargerTypeList;
    }

    const sheetConfigSnap = await getDoc(doc(firebaseDb, 'config', 'sheetConfig'));
    if (sheetConfigSnap.exists()) {
      state.sheetConfig = sheetConfigSnap.data() as SheetConfig;
    }

    const finalState: DBState = {
      users: state.users || DEFAULT_USERS,
      products: state.products && state.products.length > 0 ? state.products : DEFAULT_PRODUCTS,
      buyers: state.buyers || DEFAULT_BUYERS,
      scooterUnits: state.scooterUnits || [],
      stockLogs: state.stockLogs || [],
      sheetConfig: state.sheetConfig || { webhookUrl: '', enabled: false },
      batterySales: state.batterySales || [],
      batteryImports: state.batteryImports || [],
      chargerSales: state.chargerSales || [],
      chargerImports: state.chargerImports || [],
      batterySeriesList: state.batterySeriesList || ['Lithium 60V, 24AH', 'Lithium 60V, 30AH', 'Lithium 60V, 10AH', 'Lithium 48V, 30AH', 'Lithium 48V, 24AH', 'Lithium 60V, 28AH', 'Lithium 72V, 42AH', 'Lead Acid 12V'],
      chargerTypeList: state.chargerTypeList || ['Lithium Charger 54.6V/6A', 'Lithium Charger 69.4V/6A', 'Lithium Charger 67.2V/6A', 'Lead Acid Charger 48V', 'Lead Acid Charger 60V', 'Lead Acid Charger 72V'],
      auditLogs: state.auditLogs || [],
      warrantyClaims: state.warrantyClaims || []
    };

    // If we got real data from collections, save it to main_state for future use
    if (finalState.products.length > 0 || finalState.scooterUnits.length > 0) {
      const { setDoc, doc: fsDoc } = await import('firebase/firestore');
      setDoc(fsDoc(firebaseDb, 'warehouse', 'main_state'), JSON.parse(JSON.stringify(finalState)))
        .then(() => console.log('Migrated legacy collection data to main_state.'))
        .catch((err: any) => console.error('Migration to main_state failed:', err));
    }

    return finalState;
  } catch (error) {
    console.error('Error hydrating database from Firestore:', error);
    return null;
  }
}



function writeDB(state: DBState) {
  globalDBState = state;

  // Write backup to local file (async, non-blocking)
  try {
    fs.writeFile(DB_FILE, JSON.stringify(state, null, 2), 'utf8', (err) => {
      if (err) console.error('Error writing backup database file:', err);
    });
  } catch (err) {
    console.error('Error starting backup database file write:', err);
  }

  // ─── GUARANTEED Firestore Sync ────────────────────────────────────────────
  // Instead of a diff-based sync (which was broken), write the full database
  // state to a single Firestore document. This is 100% reliable.
  if (firebaseDb) {
    const { doc, setDoc } = require('firebase/firestore');
    const stateToSave = JSON.parse(JSON.stringify(state)); // clean copy
    setDoc(doc(firebaseDb, 'warehouse', 'main_state'), stateToSave)
      .then(() => console.log('Firestore main_state synced successfully.'))
      .catch((err: any) => console.error('Firestore main_state sync error:', err));
  }
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
    else if (user.role === 'manager') operatorRole = 'Manager';
    else if (user.role === 'manufacturer') operatorRole = 'Manufacturer';
    else if (user.role === 'salesperson') operatorRole = 'Sales Advisor';
  } else if (cleanUsername === 'admin') {
    operatorRole = 'Admin';
  } else if (cleanUsername === 'manager') {
    operatorRole = 'Manager';
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
  role: z.enum(['admin', 'manufacturer', 'salesperson', 'manager']),
  name: z.string().min(1, "Name is required").max(150, "Name is too long").trim(),
  approved: z.boolean().optional(),
});

const userUpdateSchema = z.object({
  id: z.string().min(1, "ID is required").max(100),
  username: z.string().min(3, "Username must be at least 3 characters").max(100, "Username is too long").toLowerCase().trim().regex(ALPHANUMERIC_REGEX, "Username can only contain alphanumeric characters, underscores, and hyphens"),
  password: z.string().min(4, "Password must be at least 4 characters").max(100, "Password is too long").optional().or(z.literal('')),
  role: z.enum(['admin', 'manufacturer', 'salesperson', 'manager']),
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

const userLocationSchema = z.object({
  username: z.string().min(1).max(100),
  latitude: z.number(),
  longitude: z.number(),
});

const userSimulateTrailSchema = z.object({
  username: z.string().min(1).max(100),
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
  address: z.string().max(1000, "Address is too long").trim().optional(),
  gstNo: z.string().max(100, "GST number is too long").trim().optional(),
  addressProof: z.string().max(1000, "Address proof description is too long").trim().optional(),
  buyerType: z.enum(['retail', 'wholesale']).optional(),
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
  billNo: z.string().max(100).optional().or(z.literal('')),
  deliveryChallanNo: z.string().max(100).optional().or(z.literal('')),
  serialNumbers: z.array(z.string().max(100).trim().toUpperCase()).optional(),
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
  billNo: z.string().max(100).optional().or(z.literal('')),
  stockInNo: z.string().max(100).optional().or(z.literal('')),
  serialNumbers: z.array(z.string().max(100).trim().toUpperCase()).optional(),
  warrantyDurationMonths: z.coerce.number().positive().optional(),
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
  billNo: z.string().max(100).optional().or(z.literal('')),
  deliveryChallanNo: z.string().max(100).optional().or(z.literal('')),
  serialNumbers: z.array(z.string().max(100).trim().toUpperCase()).optional(),
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
  billNo: z.string().max(100).optional().or(z.literal('')),
  stockInNo: z.string().max(100).optional().or(z.literal('')),
  serialNumbers: z.array(z.string().max(100).trim().toUpperCase()).optional(),
  warrantyDurationMonths: z.coerce.number().positive().optional(),
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
  brakeType: z.enum(['Disk', 'Drum']).optional(),
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
  chargerIncluded: z.boolean().optional(),
  chargerType: z.string().max(150).optional(),
  chargerSerial: z.string().max(100).optional(),
  chargerWarrantyActive: z.boolean().optional(),
  chargerWarrantyMonths: z.coerce.number().optional(),
  chargerWarrantyStatus: z.string().max(100).optional(),
  scooterWarrantyMonths: z.coerce.number().optional(),
  scooterWarrantyActive: z.boolean().optional(),
  warrantyNotes: z.string().max(1000).optional(),
  operator: z.string().max(150).optional(),
  billNo: z.string().max(100).optional().or(z.literal('')),
  stockInNo: z.string().max(100).optional().or(z.literal('')),
  salesBillNo: z.string().max(100).optional().or(z.literal('')),
  deliveryChallanNo: z.string().max(100).optional().or(z.literal('')),
});

const scooterBulkCreateSchema = z.object({
  modelName: z.string().min(1, "Model Name is required").max(150).trim(),
  color: z.string().min(1, "Color is required").max(100).trim(),
  sourceChannel: z.string().max(100).optional(),
  frontTireSize: z.string().max(100).optional(),
  rearTireSize: z.string().max(100).optional(),
  brakeType: z.enum(['Disk', 'Drum']).optional(),
  items: z.array(z.object({
    chassisNo: z.string().min(1, "Chassis number cannot be empty").max(100).trim().toUpperCase(),
    motorNo: z.string().min(1, "Motor number cannot be empty").max(100).trim().toUpperCase(),
    controllerNo: z.string().min(1, "Controller number cannot be empty").max(100).trim().toUpperCase(),
  })).min(1, "Must include at least one item"),
  operator: z.string().min(1, "Operator is required").max(150),
  billNo: z.string().max(100).optional().or(z.literal('')),
  stockInNo: z.string().max(100).optional().or(z.literal('')),
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
  salesBillNo: z.string().max(100).optional().or(z.literal('')),
  deliveryChallanNo: z.string().max(100).optional().or(z.literal('')),
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
  billNo: z.string().max(100).optional().or(z.literal('')),
  stockInNo: z.string().max(100).optional().or(z.literal('')),
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
      user.failedAttempts = record.failedCount;

      let errorMsg = '';

      // If the user is not the master admin, check for hard lockout
      if (user.role !== 'admin' && user.failedAttempts >= 3) {
        user.locked = true;
        errorMsg = 'This account has been locked due to too many failed login attempts. Please contact the warehouse owner to unlock it.';
        addAuditLog(db, user.username, user.name, 'login_failed_locked_out', 'Account permanently locked due to 3 failed password attempts.');
      } else {
        // Admin user OR non-admin with < 3 attempts -> use exponential backoff message
        const power = Math.max(0, record.failedCount - 1);
        const nextDelayMs = Math.min(AUTH_MAX_BACKOFF_MS, AUTH_BACKOFF_BASE_MS * Math.pow(AUTH_BACKOFF_FACTOR, power));
        const nextDelaySecs = Math.ceil(nextDelayMs / 1000);

        errorMsg = `Invalid username or password. Due to consecutive failed attempts, your next login attempt will be delayed by ${nextDelaySecs} seconds.`;
        addAuditLog(db, user.username, user.name, 'login_failed_wrong_password', `Wrong password attempt. Successive failed count is now ${record.failedCount}.`);
      }

      // Save user state
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
      role: role as 'admin' | 'manufacturer' | 'salesperson' | 'manager',
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
    role: role as 'admin' | 'manufacturer' | 'salesperson' | 'manager',
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

app.post('/api/users/location', validateBody(userLocationSchema), (req, res) => {
  const { username, latitude, longitude } = req.body;
  const db = readDB();
  const normalized = username.toLowerCase().trim();
  if (db.users[normalized]) {
    const timestamp = new Date().toISOString();
    db.users[normalized].latitude = latitude;
    db.users[normalized].longitude = longitude;
    db.users[normalized].locationTimestamp = timestamp;
    db.users[normalized].pullLocationRequested = false; // Reset the pull request once coordinate is received
    
    if (!db.users[normalized].locationHistory) {
      db.users[normalized].locationHistory = [];
    }
    db.users[normalized].locationHistory.push({
      latitude,
      longitude,
      timestamp
    });

    // Keep history clean: prune logs older than 24 hours
    const limitTime = Date.now() - 24 * 60 * 60 * 1000;
    db.users[normalized].locationHistory = db.users[normalized].locationHistory.filter(
      (entry: any) => new Date(entry.timestamp).getTime() >= limitTime
    );

    writeDB(db);
    return res.json({ success: true });
  }
  return res.status(404).json({ error: 'User not found' });
});

// Auth: Trigger a live high-accuracy GPS pull for an employee (Admin/Manager only)
app.post('/api/users/pull-location', (req, res) => {
  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }
  const db = readDB();
  const normalized = username.toLowerCase().trim();
  if (db.users[normalized]) {
    db.users[normalized].pullLocationRequested = true;
    db.users[normalized].pullLocationTimestamp = new Date().toISOString();
    writeDB(db);
    return res.json({ success: true, message: `Live tracking beacon activated for @${username}. Pinging device for fresh GPS coordinates...` });
  }
  return res.status(404).json({ error: 'User not found' });
});

// Auth: Check if a live location pull is requested for the current logged in employee
app.get('/api/users/check-pull', (req, res) => {
  const username = req.query.username as string;
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }
  const db = readDB();
  const normalized = username.toLowerCase().trim();
  if (db.users[normalized]) {
    return res.json({ pullRequested: !!db.users[normalized].pullLocationRequested });
  }
  return res.status(404).json({ error: 'User not found' });
});

// Auth: Simulate Location Trail (For testing breadcrumbs)
app.post('/api/users/simulate-trail', validateBody(userSimulateTrailSchema), (req, res) => {
  const { username } = req.body;
  const db = readDB();
  const normalized = username.toLowerCase().trim();
  if (db.users[normalized]) {
    const baseLat = 28.6139;
    const baseLng = 77.2090;
    
    // Generate 5 points moving from Connaught Place around Delhi
    const now = Date.now();
    const mockTrail = [
      { latitude: baseLat, longitude: baseLng, timestamp: new Date(now - 20 * 60 * 60 * 1000).toISOString() }, // 20h ago CP
      { latitude: baseLat + 0.015, longitude: baseLng - 0.01, timestamp: new Date(now - 15 * 60 * 60 * 1000).toISOString() }, // 15h ago Karol Bagh
      { latitude: baseLat + 0.035, longitude: baseLng + 0.02, timestamp: new Date(now - 10 * 60 * 60 * 1000).toISOString() }, // 10h ago Chandni Chowk
      { latitude: baseLat - 0.04, longitude: baseLng + 0.045, timestamp: new Date(now - 5 * 60 * 60 * 1000).toISOString() },  // 5h ago Nizamuddin / Lotus Temple
      { latitude: baseLat - 0.078, longitude: baseLng - 0.013, timestamp: new Date(now).toISOString() }                     // Now Qutub Minar
    ];

    db.users[normalized].latitude = mockTrail[mockTrail.length - 1].latitude;
    db.users[normalized].longitude = mockTrail[mockTrail.length - 1].longitude;
    db.users[normalized].locationTimestamp = mockTrail[mockTrail.length - 1].timestamp;
    db.users[normalized].locationHistory = mockTrail;

    writeDB(db);
    return res.json({ success: true, history: mockTrail });
  }
  return res.status(404).json({ error: 'User not found' });
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
      else if (user.role === 'manager') operatorRole = 'Manager';
      else if (user.role === 'manufacturer') operatorRole = 'Manufacturer';
      else if (user.role === 'salesperson') operatorRole = 'Sales Advisor';
    } else if (cleanUsername === 'admin') {
      operatorRole = 'Admin';
    } else if (cleanUsername === 'manager') {
      operatorRole = 'Manager';
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

// Products: Bulk Seed Official Senzo Catalog
app.post('/api/products/bulk-seed', (req, res) => {
  const { mode } = req.body; // 'replace' or 'append'
  const db = readDB();

  const SENZO_OFFICIAL_CATALOG = [
    { name: 'SENZO ESSENATIAL W/O DISK', colors: ['WHITE', 'BLACK', 'GREY', 'RED', 'COFFIE', 'C-GREEN', 'SHINE BLUE', 'BLUE'] },
    { name: 'SENZO CKD', colors: ['ANY OTHER'] },
    { name: 'SENZO ESSENATIAL DISC', colors: ['Red', 'Black', 'WHITE', 'GREY', 'BLUE', 'C-GREEN', 'SHINE BLUE', 'MEHROON', 'YELLOW', 'GOLDEN', 'COFFIE'] },
    { name: 'SENZO LODER', colors: ['BLACK'] },
    { name: 'SENZO ESSENATIAL DISC 12"/10"', colors: ['Red', 'Black', 'WHITE', 'GREY', 'BLUE', 'C-GREEN', 'SILVER', 'SHINE BLUE', 'MEHROON', 'SKY BLUE', 'COFFIE'] },
    { name: 'CITY XL 10"/10"', colors: ['BLACK', 'RED', 'C-GREEN', 'GOLDEN', 'WHITE', 'BLUE', 'GREY'] },
    { name: 'UNCOMPLET', colors: ['WHITE', 'RED', 'SILVER'] },
    { name: 'CITY XL 12"/10"', colors: ['BLACK', 'WHITE', 'C-GREEN', 'RED', 'BLUE', 'COFFIE', 'GREY'] },
    { name: 'SENZO CITY R.L 10"/10"', colors: ['BLACK', 'WHITE', 'RED', 'GREY', 'BLUE'] },
    { name: 'SENZO CITY RL 10"/10" UNCOMPLET', colors: ['RED', 'WHITE'] },
    { name: 'SENZO CITY R.L 12"/10"', colors: ['BLACK', 'WHITE', 'C-GREEN', 'GREY', 'COFFIE', 'RED'] },
    { name: 'SENZO CITY S.Q 10"/10"', colors: ['BLACK', 'WHITE', 'SILVER', 'GREY'] },
    { name: 'SENZO POWER 12"/12"', colors: ['WHITE', 'BLACK', 'BLUE', 'GREY', 'C-GREEN', 'RED', 'GOLDEN'] },
    { name: 'SENZO POWER 12"/10"', colors: ['BLACK', 'WHITE'] },
    { name: 'SENZO POWER PLUS okinawa', colors: ['WHITE', 'GREY', 'C-GREEN', 'Red', 'BLUE', 'BLACK'] },
    { name: 'SENZO POWER Plus NEO', colors: ['WHITE', 'BLACK', 'BLUE', 'C-GREEN', 'GREY', 'RED', 'GOLDEN'] },
    { name: 'SENZO CITY PLUS U LIGHT', colors: ['BLACK', 'WHITE', 'GREY', 'RED', 'BLUE'] },
    { name: 'SENZO CITY PLUS NEO JALI', colors: ['BLACK', 'WHITE', 'BLUE', 'GREY', 'RED'] },
    { name: 'SENZO CITY S.Q 10"/10" NEW', colors: ['BLACK', 'WHITE', 'RED', 'GREY'] },
    { name: 'SENZO ESSENATIAL DISC 3W', colors: ['BLACK', 'WHITE', 'C-GREEN', 'GREY'] },
    { name: 'SENZO CITY XL 3W', colors: ['RED'] },
    { name: 'SENZO POWER +NEO (STAR LIGHT)', colors: ['GREY', 'BLACK', 'WHITE', 'C-GREEN'] },
    { name: 'SENZO POWER (HYBRID)', colors: ['GREY', 'BLACK', 'WHITE', 'RED', 'C-GREEN'] },
    { name: 'SENZO POWER+XL', colors: ['GREY', 'BLACK', 'WHITE', 'GOLDEN'] },
    { name: 'ARCHAR', colors: ['RED', 'BLUE', 'GREY', 'WHITE'] },
    { name: 'OLD SCOOTY', colors: ['YELLOW', 'MIX'] },
    { name: 'SENZO POWER 10/10', colors: ['BLACK', 'WHITE', 'GREY'] },
    { name: 'SENZO CITY + KGF', colors: ['BLACK', 'WHITE', 'RED', 'GREY'] },
    { name: 'SENZO CITY PLUS PRO', colors: ['BLACK', 'WHITE', 'C-GREEN', 'GREY'] },
    { name: 'SENZO LODER TWO WHEELS', colors: ['BLACK'] },
    { name: 'SENZO LODER THREE WHEELS', colors: ['BLACK'] },
    { name: 'SENZO CITY MAGIC (OLA)', colors: ['BLACK', 'WHITE', 'RED', 'BLUE', 'C-GREEN', 'GREY'] },
    { name: 'SENZO CITY PLUS PRO BMW', colors: ['BLACK', 'WHITE', 'BLUE', 'RED', 'GREY'] },
    { name: 'SENZO CITY RL SWIFT', colors: ['BLACK', 'WHITE', 'GREY', 'C-GREEN', 'BLUE'] },
    { name: 'SENZO POWER PLUS PRO', colors: ['BLACK', 'WHITE', 'GREY', 'C-GREEN', 'BLUE'] },
    { name: 'SENZO CITY XL PRO 12/12', colors: ['BLACK', 'WHITE', 'GREY', 'RED', 'C-GREEN', 'BLUE'] },
    { name: 'SENZO POWER TURBO (E4)', colors: ['BLACK', 'WHITE', 'GREY', 'RED', 'C-GREEN', 'BLUE'] },
    { name: 'SENZO SENZO ESSENATIAL DISC 12"/10" CKD', colors: ['ANY OTHER'] },
    { name: 'SENZO POWER TURBO CKD (E4)', colors: ['ANY OTHER'] },
    { name: 'SENZO CITY RL SWIFT CKD', colors: ['ANY OTHER'] },
    { name: 'SENZO POWER PLUS PRO CKD', colors: ['ANY OTHER'] },
    { name: 'SENZO CITY MAGIC (OLA) CKD', colors: ['ANY OTHER'] },
    { name: 'STAFF USE /OLD SCOOTY', colors: ['BLACK'] }
  ];

  let seedCount = 0;
  if (mode === 'replace') {
    // Overwrite existing products
    db.products = SENZO_OFFICIAL_CATALOG.map((p, idx) => ({
      id: `prod-senzo-${idx}-${Date.now()}`,
      name: p.name,
      colors: p.colors
    }));
    seedCount = db.products.length;
  } else {
    // Append or update existing products
    SENZO_OFFICIAL_CATALOG.forEach((p, idx) => {
      const existingIdx = db.products.findIndex(existing => existing.name.toLowerCase() === p.name.toLowerCase());
      if (existingIdx === -1) {
        db.products.push({
          id: `prod-senzo-append-${idx}-${Date.now()}`,
          name: p.name,
          colors: p.colors
        });
        seedCount++;
      } else {
        // Merge colors or update colors to match the spreadsheet
        db.products[existingIdx].colors = Array.from(new Set([...db.products[existingIdx].colors, ...p.colors]));
      }
    });
  }

  writeDB(db);

  // Add an audit log for seeding
  const auditId = `audit-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  db.auditLogs.unshift({
    id: auditId,
    action: 'product_seeding',
    timestamp: new Date().toISOString(),
    username: req.body.operator || 'system',
    operator: req.body.operator || 'System Seeder',
    operatorName: req.body.operator || 'System Seeder',
    operatorRole: 'Admin',
    details: `Seeded ${seedCount} models from the official Senzo spreadsheet.`
  });
  writeDB(db);

  res.json({ success: true, count: seedCount, total: db.products.length });
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
  const { name, contact, address, gstNo, addressProof, buyerType } = req.body;

  const db = readDB();

  if (db.buyers.some(b => b.name.toLowerCase() === name.toLowerCase())) {
    return res.status(400).json({ error: 'Buyer already exists' });
  }

  const newBuyer: Buyer = {
    id: `buy-${Date.now()}`,
    name,
    contact: contact || undefined,
    address: address || undefined,
    gstNo: gstNo || undefined,
    addressProof: addressProof || undefined,
    buyerType: buyerType || undefined
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
  const { id, name, contact, address, gstNo, addressProof, buyerType } = req.body;
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
  db.buyers[buyerIndex].address = address ? address.trim() : undefined;
  db.buyers[buyerIndex].gstNo = gstNo ? gstNo.trim() : undefined;
  db.buyers[buyerIndex].addressProof = addressProof ? addressProof.trim() : undefined;
  db.buyers[buyerIndex].buyerType = buyerType || undefined;

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
    heldFor,
    serialNumbers
  } = req.body;

  const db = readDB();
  if (!db.batterySales) {
    db.batterySales = [];
  }

  // Duplicate Check
  if (serialNumbers && Array.isArray(serialNumbers)) {
    for (const sn of serialNumbers) {
      const cleanSn = String(sn).trim().toUpperCase();
      if (!cleanSn) continue;

      const existsInSales = db.batterySales.some(sale => 
        sale.status !== 'hold' && sale.serialNumbers && sale.serialNumbers.map(s => s.trim().toUpperCase()).includes(cleanSn)
      );
      if (existsInSales) {
        return res.status(400).json({ error: `Duplicate error: Battery Serial Number '${cleanSn}' has already been sold/dispatched.` });
      }

      const existsInScooters = db.scooterUnits && db.scooterUnits.some(scoot => 
        scoot.batterySerials && scoot.batterySerials.map(s => s.trim().toUpperCase()).includes(cleanSn)
      );
      if (existsInScooters) {
        return res.status(400).json({ error: `Duplicate error: Battery Serial Number '${cleanSn}' has already been linked to an assembled scooter.` });
      }
    }
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
    holdDate: isHold ? timestamp : undefined,
    serialNumbers: serialNumbers || undefined
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
  const { batterySeries, startNo, endNo, quantity, operator, supplierName, containerId, notes, billNo, stockInNo, serialNumbers, warrantyDurationMonths } = req.body;

  const db = readDB();
  if (!db.batteryImports) {
    db.batteryImports = [];
  }

  // Duplicate Check
  if (serialNumbers && Array.isArray(serialNumbers)) {
    for (const sn of serialNumbers) {
      const cleanSn = String(sn).trim().toUpperCase();
      if (!cleanSn) continue;

      const existsInImports = db.batteryImports.some(imp => 
        imp.serialNumbers && imp.serialNumbers.map(s => s.trim().toUpperCase()).includes(cleanSn)
      );
      if (existsInImports) {
        return res.status(400).json({ error: `Duplicate error: Battery Serial Number '${cleanSn}' has already been imported/registered.` });
      }

      const existsInScooters = db.scooterUnits && db.scooterUnits.some(scoot => 
        scoot.batterySerials && scoot.batterySerials.map(s => s.trim().toUpperCase()).includes(cleanSn)
      );
      if (existsInScooters) {
        return res.status(400).json({ error: `Duplicate error: Battery Serial Number '${cleanSn}' has already been linked to an assembled scooter.` });
      }

      const existsInSales = db.batterySales && db.batterySales.some(sale => 
        sale.serialNumbers && sale.serialNumbers.map(s => s.trim().toUpperCase()).includes(cleanSn)
      );
      if (existsInSales) {
        return res.status(400).json({ error: `Duplicate error: Battery Serial Number '${cleanSn}' has already been sold/dispatched.` });
      }
    }
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
    notes: notes || undefined,
    billNo: billNo || undefined,
    stockInNo: stockInNo || undefined,
    serialNumbers: serialNumbers || undefined,
    warrantyDurationMonths: warrantyDurationMonths || undefined
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
    heldFor,
    serialNumbers
  } = req.body;

  const db = readDB();
  if (!db.chargerSales) {
    db.chargerSales = [];
  }

  // Duplicate Check
  if (serialNumbers && Array.isArray(serialNumbers)) {
    for (const sn of serialNumbers) {
      const cleanSn = String(sn).trim().toUpperCase();
      if (!cleanSn) continue;

      const existsInSales = db.chargerSales.some(sale => 
        sale.status !== 'hold' && sale.serialNumbers && sale.serialNumbers.map(s => s.trim().toUpperCase()).includes(cleanSn)
      );
      if (existsInSales) {
        return res.status(400).json({ error: `Duplicate error: Charger Serial Number '${cleanSn}' has already been sold/dispatched.` });
      }

      const existsInScooters = db.scooterUnits && db.scooterUnits.some(scoot => 
        scoot.chargerSerial && scoot.chargerSerial.trim().toUpperCase() === cleanSn
      );
      if (existsInScooters) {
        return res.status(400).json({ error: `Duplicate error: Charger Serial Number '${cleanSn}' has already been linked to an assembled scooter.` });
      }
    }
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
    holdDate: isHold ? timestamp : undefined,
    serialNumbers: serialNumbers || undefined
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
  const { chargerType, startNo, endNo, quantity, operator, supplierName, containerId, notes, billNo, stockInNo, serialNumbers, warrantyDurationMonths } = req.body;

  const db = readDB();
  if (!db.chargerImports) {
    db.chargerImports = [];
  }

  // Duplicate Check
  if (serialNumbers && Array.isArray(serialNumbers)) {
    for (const sn of serialNumbers) {
      const cleanSn = String(sn).trim().toUpperCase();
      if (!cleanSn) continue;

      const existsInImports = db.chargerImports.some(imp => 
        imp.serialNumbers && imp.serialNumbers.map(s => s.trim().toUpperCase()).includes(cleanSn)
      );
      if (existsInImports) {
        return res.status(400).json({ error: `Duplicate error: Charger Serial Number '${cleanSn}' has already been imported/registered.` });
      }

      const existsInScooters = db.scooterUnits && db.scooterUnits.some(scoot => 
        scoot.chargerSerial && scoot.chargerSerial.trim().toUpperCase() === cleanSn
      );
      if (existsInScooters) {
        return res.status(400).json({ error: `Duplicate error: Charger Serial Number '${cleanSn}' has already been linked to an assembled scooter.` });
      }

      const existsInSales = db.chargerSales && db.chargerSales.some(sale => 
        sale.serialNumbers && sale.serialNumbers.map(s => s.trim().toUpperCase()).includes(cleanSn)
      );
      if (existsInSales) {
        return res.status(400).json({ error: `Duplicate error: Charger Serial Number '${cleanSn}' has already been sold/dispatched.` });
      }
    }
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
    notes: notes || undefined,
    billNo: billNo || undefined,
    stockInNo: stockInNo || undefined,
    serialNumbers: serialNumbers || undefined,
    warrantyDurationMonths: warrantyDurationMonths || undefined
  };

  db.chargerImports.push(newImport);
  addAuditLog(db, operator || 'system', operator || 'system', 'charger_import', `Imported new batch of chargers: Type ${chargerType} (Qty: ${quantity}, Supplier: ${supplierName || 'N/A'}).`);
  writeDB(db);

  res.json(newImport);
});

// Customizable Battery Series Types: List & Save
app.get('/api/battery-types', (req, res) => {
  const db = readDB();
  res.json(db.batterySeriesList || ['Lithium 60V, 24AH', 'Lithium 60V, 30AH', 'Lithium 60V, 10AH', 'Lithium 48V, 30AH', 'Lithium 48V, 24AH', 'Lithium 60V, 28AH', 'Lithium 72V, 42AH', 'Lead Acid 12V']);
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
  res.json(db.chargerTypeList || ['Lithium Charger 54.6V/6A', 'Lithium Charger 69.4V/6A', 'Lithium Charger 67.2V/6A', 'Lead Acid Charger 48V', 'Lead Acid Charger 60V', 'Lead Acid Charger 72V']);
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
    brakeType,
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
    operator,
    billNo,
    stockInNo,
    salesBillNo,
    deliveryChallanNo
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
      brakeType,
      batterySerials: [],
      status: 'available',
      scooterWarrantyStatus: 'None',
      batteryWarrantyStatus: 'None',
      createdOperator: operator,
      createdTimestamp: timestamp,
      lastUpdatedTimestamp: timestamp,
      billNo: billNo || undefined,
      stockInNo: stockInNo || undefined
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
    unit.salesBillNo = salesBillNo || '';
    unit.deliveryChallanNo = deliveryChallanNo || '';
    
    // Save integrated charger options
    unit.chargerIncluded = req.body.chargerIncluded;
    unit.chargerType = req.body.chargerType;
    unit.chargerSerial = req.body.chargerSerial;
    unit.chargerWarrantyActive = req.body.chargerWarrantyActive;
    unit.chargerWarrantyMonths = req.body.chargerWarrantyMonths;
    unit.chargerWarrantyStatus = req.body.chargerWarrantyActive ? 'Active' : 'None';

    // Save scooter custom frame warranty options
    unit.scooterWarrantyMonths = req.body.scooterWarrantyMonths;
    unit.scooterWarrantyActive = req.body.scooterWarrantyActive;
    
    // Warranty info added right during sell/POS
    unit.scooterWarrantyStatus = scooterWarrantyStatus || 'None';
    unit.scooterWarrantyExpiry = scooterWarrantyExpiry || undefined;
    unit.batteryWarrantyStatus = batteryWarrantyStatus || 'None';
    unit.batteryWarrantyExpiry = batteryWarrantyExpiry || undefined;
    unit.warrantyNotes = warrantyNotes || '';

    // Register charger sale if included
    if (req.body.chargerIncluded && req.body.chargerType) {
      if (!db.chargerSales) {
        db.chargerSales = [];
      }
      db.chargerSales.push({
        id: `chgsale-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        buyerName: buyerName,
        chargerType: req.body.chargerType,
        startNo: req.body.chargerSerial || 'N/A',
        endNo: req.body.chargerSerial || 'N/A',
        quantity: 1,
        saleDate: timestamp,
        operator: operator || 'Sales Advisor',
        notes: `Sold integrated with Scooter frame (Chassis: ${unit.chassisNo})`,
        isUnderWarranty: !!req.body.chargerWarrantyActive,
        warrantyDurationMonths: req.body.chargerWarrantyActive ? Number(req.body.chargerWarrantyMonths || 12) : undefined,
        status: 'sold',
        billNo: salesBillNo || undefined,
        deliveryChallanNo: deliveryChallanNo || undefined
      });
    }

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
      notes: `Scooter sold and certified (Chassis: ${unit.chassisNo}, Batteries: ${unit.batterySerials.length}, Charger: ${req.body.chargerIncluded ? 'Yes' : 'No'})`,
      billNo: salesBillNo || undefined
    };
    db.stockLogs.push(autoOutLog);
    
    addAuditLog(db, operator || 'system', operator || 'system', 'pos_scooter_sale', `Completed POS retail checkout sale for Scooter (Chassis: ${unit.chassisNo}) to Buyer: ${buyerName}. Bill No: ${salesBillNo || 'N/A'}, Challan No: ${deliveryChallanNo || 'N/A'}. Batteries linked: [${unit.batterySerials.join(', ') || 'none'}]. Charger linked: ${req.body.chargerIncluded ? `${req.body.chargerType} (${req.body.chargerSerial || 'No Serial'})` : 'none'}.`);

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
    brakeType,
    items, // array of { chassisNo, motorNo, controllerNo }
    operator,
    billNo,
    stockInNo
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
      brakeType,
      batterySerials: [],
      status: 'available',
      scooterWarrantyStatus: 'None',
      batteryWarrantyStatus: 'None',
      createdOperator: operator,
      createdTimestamp: timestamp,
      lastUpdatedTimestamp: timestamp,
      billNo: billNo || undefined,
      stockInNo: stockInNo || undefined
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
    status, // 'sold' | 'hold'
    salesBillNo,
    deliveryChallanNo
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
      unit.salesBillNo = salesBillNo || '';
      unit.deliveryChallanNo = deliveryChallanNo || '';
      
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
          notes: `Scooter sold in bulk (Chassis: ${unit.chassisNo}, Batteries Assigned: ${unit.batterySerials.length})`,
          billNo: salesBillNo || undefined
        };
        db.stockLogs.push(autoOutLog);
      }

      unit.lastUpdatedBy = operator;
      unit.lastUpdatedTimestamp = timestamp;
    }
  });

  addAuditLog(db, operator, operator, isHold ? 'bulk_scooter_hold' : 'bulk_scooter_sale', `Completed bulk ${isHold ? 'hold reservation' : 'sale dispatch'} of ${sales.length} Scooters to Buyer: ${buyerName}. Bill No: ${salesBillNo || 'N/A'}, Challan No: ${deliveryChallanNo || 'N/A'}.`);
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
  const { modelName, color, type, sourceChannel, quantity, buyerName, operator, notes, billNo, stockInNo } = req.body;

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
    notes: notes || '',
    billNo: billNo || undefined,
    stockInNo: stockInNo || undefined
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

// Helper for warranty claims to apply replacement of serial numbers inside the database
function applyReplacementInDB(
  db: any,
  type: 'scooter' | 'battery' | 'charger',
  saleId: string,
  originalSerial: string,
  newSerial: string,
  operator: string,
  replacementWarrantyMonths?: number
) {
  if (type === 'scooter') {
    const scootIdx = db.scooterUnits.findIndex((s: any) => s.id === saleId);
    if (scootIdx !== -1) {
      const scoot = db.scooterUnits[scootIdx];
      let updated = false;

      // Check if originalSerial matches chassisNo
      if (scoot.chassisNo === originalSerial) {
        scoot.chassisNo = newSerial;
        scoot.warrantyNotes = (scoot.warrantyNotes || '') + `\n[Warranty Exchange] Frame Chassis exchanged from ${originalSerial} to ${newSerial} by ${operator} on ${new Date().toLocaleDateString()}`;
        updated = true;
      } 
      // Check if originalSerial matches any battery serials
      else if (scoot.batterySerials && scoot.batterySerials.includes(originalSerial)) {
        const batIndex = scoot.batterySerials.indexOf(originalSerial);
        if (batIndex !== -1) {
          scoot.batterySerials[batIndex] = newSerial;
          if (replacementWarrantyMonths !== undefined && replacementWarrantyMonths !== null) {
            if (!scoot.batteryWarrantyMonths) {
              scoot.batteryWarrantyMonths = scoot.batterySerials.map(() => 12);
            }
            scoot.batteryWarrantyMonths[batIndex] = replacementWarrantyMonths;
          }
          scoot.warrantyNotes = (scoot.warrantyNotes || '') + `\n[Warranty Exchange] Battery ${originalSerial} exchanged for ${newSerial} by ${operator} on ${new Date().toLocaleDateString()} (Custom remaining warranty: ${replacementWarrantyMonths !== undefined ? replacementWarrantyMonths + ' months' : 'unchanged'})`;
          updated = true;
        }
      }
      // Check if originalSerial matches chargerSerial
      else if (scoot.chargerSerial === originalSerial) {
        scoot.chargerSerial = newSerial;
        scoot.warrantyNotes = (scoot.warrantyNotes || '') + `\n[Warranty Exchange] Charger ${originalSerial} exchanged for ${newSerial} by ${operator} on ${new Date().toLocaleDateString()}`;
        updated = true;
      }

      if (updated) {
        scoot.lastUpdatedBy = operator;
        scoot.lastUpdatedTimestamp = new Date().toISOString();
        db.scooterUnits[scootIdx] = scoot;
      }
    }
  } else if (type === 'battery') {
    const batIdx = (db.batterySales || []).findIndex((b: any) => b.id === saleId);
    if (batIdx !== -1 && db.batterySales) {
      const sale = db.batterySales[batIdx];
      if (sale.batterySerials && sale.batterySerials.includes(originalSerial)) {
        sale.batterySerials = sale.batterySerials.map((s: string) => s === originalSerial ? newSerial : s);
      } else if (sale.batterySeries === originalSerial) {
        sale.batterySeries = newSerial;
      }

      if (replacementWarrantyMonths !== undefined && replacementWarrantyMonths !== null) {
        sale.warrantyDurationMonths = replacementWarrantyMonths;
      }

      sale.notes = (sale.notes || '') + `\n[Warranty Exchange] Battery serial ${originalSerial} exchanged for ${newSerial} by ${operator} on ${new Date().toLocaleDateString()} (Custom remaining warranty: ${replacementWarrantyMonths !== undefined ? replacementWarrantyMonths + ' months' : 'unchanged'})`;
      db.batterySales[batIdx] = sale;
    }
  } else if (type === 'charger') {
    const chgIdx = (db.chargerSales || []).findIndex((c: any) => c.id === saleId);
    if (chgIdx !== -1 && db.chargerSales) {
      const sale = db.chargerSales[chgIdx];
      sale.notes = (sale.notes || '') + `\n[Warranty Exchange] Charger serial ${originalSerial} exchanged for ${newSerial} by ${operator} on ${new Date().toLocaleDateString()}`;
      db.chargerSales[chgIdx] = sale;
    }
  }
}

// Warranty Claims: Get All
app.get('/api/warranty-claims', (req, res) => {
  const db = readDB();
  res.json(db.warrantyClaims || []);
});

// Warranty Claims: Create/Update claim
app.post('/api/warranty-claims', (req, res) => {
  const db = readDB();
  if (!db.warrantyClaims) {
    db.warrantyClaims = [];
  }

  const {
    id,
    originalSaleId,
    originalSaleType,
    originalSerialNo,
    buyerName,
    buyerContact,
    saleDate,
    warrantyDurationMonths,
    issueDescription,
    status,
    actionTaken,
    newSerialNo,
    notes,
    operatorName,
    operatorUsername,
    replacementWarrantyMonths,
    isBattery
  } = req.body;

  if (!originalSaleId || !originalSaleType || !originalSerialNo || !buyerName || !issueDescription || !status) {
    return res.status(400).json({ error: 'Missing required warranty claim fields.' });
  }

  const claimDate = req.body.claimDate || new Date().toISOString().split('T')[0];
  const lastUpdatedTimestamp = new Date().toISOString();

  if (id) {
    // Update existing
    const idx = db.warrantyClaims.findIndex((c: any) => c.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Warranty claim not found.' });
    }

    const oldClaim = db.warrantyClaims[idx];
    const updatedClaim = {
      ...oldClaim,
      issueDescription,
      status,
      actionTaken,
      newSerialNo,
      notes,
      operatorName,
      lastUpdatedTimestamp,
      replacementWarrantyMonths: replacementWarrantyMonths !== undefined ? Number(replacementWarrantyMonths) : oldClaim.replacementWarrantyMonths,
      isBattery: isBattery !== undefined ? Boolean(isBattery) : oldClaim.isBattery
    };

    db.warrantyClaims[idx] = updatedClaim;

    addAuditLog(
      db,
      operatorUsername || 'system',
      operatorName,
      'WARRANTY_CLAIM_UPDATE',
      `Updated warranty claim ${id} for ${originalSaleType} (${originalSerialNo}) to status: ${status}.`
    );

    if (status === 'exchanged' && newSerialNo) {
      applyReplacementInDB(
        db,
        originalSaleType,
        originalSaleId,
        originalSerialNo,
        newSerialNo,
        operatorName,
        replacementWarrantyMonths !== undefined ? Number(replacementWarrantyMonths) : undefined
      );
    }

    writeDB(db);
    res.json(updatedClaim);
  } else {
    // Create new
    const newId = `WC-${Date.now().toString().slice(-6)}`;
    const newClaim = {
      id: newId,
      claimDate,
      originalSaleId,
      originalSaleType,
      originalSerialNo,
      buyerName,
      buyerContact,
      saleDate,
      warrantyDurationMonths,
      issueDescription,
      status,
      actionTaken,
      newSerialNo,
      operatorName,
      notes,
      lastUpdatedTimestamp,
      replacementWarrantyMonths: replacementWarrantyMonths !== undefined ? Number(replacementWarrantyMonths) : undefined,
      isBattery: isBattery !== undefined ? Boolean(isBattery) : undefined
    };

    db.warrantyClaims.push(newClaim);

    addAuditLog(
      db,
      operatorUsername || 'system',
      operatorName,
      'WARRANTY_CLAIM_CREATE',
      `Created warranty claim ${newId} for ${originalSaleType} (${originalSerialNo}).`
    );

    if (status === 'exchanged' && newSerialNo) {
      applyReplacementInDB(
        db,
        originalSaleType,
        originalSaleId,
        originalSerialNo,
        newSerialNo,
        operatorName,
        replacementWarrantyMonths !== undefined ? Number(replacementWarrantyMonths) : undefined
      );
    }

    writeDB(db);
    res.json(newClaim);
  }
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


// ─── APK Auto-Updater: Version Check Endpoint ──────────────────────────────
// When you build a new APK, bump the version number here.
// Upload the new app-release.apk to the public/ folder and push to GitHub.
app.get('/api/version', (req, res) => {
  res.json({
    version: "1.0.9",
    apkUrl: "https://sumitdhaka0123.onrender.com/app-release.apk"
  });
});

// ─── Vite Middleware & Static Serving setup ──────────────────────────────────
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
    // Serve the public/ folder for APK downloads and other static assets
    const publicPath = path.join(process.cwd(), 'public');
    if (fs.existsSync(publicPath)) {
      app.use(express.static(publicPath));
    }
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
