import express from 'express';
import cors from 'cors';
import { google } from 'googleapis';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { DBState, User, Product, Buyer, ScooterUnit, StockLog, SheetConfig, BatterySale, BatteryImport, ChargerSale, ChargerImport, WarrantyClaim, AuditLog, SalesOrder, SalesOrderItem } from './src/types';
import { z } from 'zod';
import * as crypto from 'crypto';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, getDocs, collection, writeBatch } from 'firebase/firestore/lite';


function hashPassword(password: string): string {
  if (!password) return '';
  // If it's already a 64-char hex string (sha256 hash), don't double hash it (for migration)
  if (/^[a-f0-9]{64}$/.test(password)) return password;
  return crypto.createHash('sha256').update(password).digest('hex');
}

const app = express();
const PORT = 3000;
const DB_FILE = path.join(process.cwd(), 'warehouse_db.json');

// Initialize Firebase using the config file
const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
let firebaseApp: any = null;
let firebaseDb: any = null;

if (fs.existsSync(firebaseConfigPath)) {
  try {
    const config = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
    firebaseApp = initializeApp(config);
    if (config.firestoreDatabaseId && config.firestoreDatabaseId !== '(default)') {
      firebaseDb = getFirestore(firebaseApp, config.firestoreDatabaseId);
    } else {
      firebaseDb = getFirestore(firebaseApp);
    }
    console.log('Firebase App and Firestore successfully initialized!');
  } catch (err) {
    console.error('Error initializing Firebase in server.ts:', err);
  }
} else {
  console.log('No firebase-applet-config.json found. Running in local/offline mode.');
}

let globalDBState: DBState | null = null;


app.use(cors());
app.use(express.json());

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
    } else if (field === 'quantity' || field === 'availableStock' || field === 'buyingPrice' || field === 'warrantyDurationMonths') {
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
    console.log('Attempting to pull latest data from Google Sheet Web App:', webhookUrl);
    
    let response: any = null;
    try {
      response = await fetch(webhookUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json, text/plain, */*'
        },
        redirect: 'follow'
      });
    } catch (err) {
      console.warn('Direct fetch with redirect follow failed:', err);
    }

    if (!response || !response.ok) {
      if (response && response.status === 404) {
        console.warn(`Google Sheet Webapp URL returned 404 (Not Found): ${webhookUrl}. The web app deployment may be inactive or un-deployed.`);
      } else if (response) {
        console.warn(`Google Sheet Webapp responded with HTTP status ${response.status} (${response.statusText}).`);
      } else {
        console.warn('No response received from Google Sheet Webapp.');
      }
      return null;
    }

    const contentType = response.headers.get('content-type') || '';
    const responseText = await response.text();

    if (!contentType.includes('application/json') && !responseText.trim().startsWith('{')) {
      console.warn('Expected JSON response from Google Sheet Webapp but received non-JSON/HTML content.');
      return null;
    }

    let result: any = null;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      console.warn('Could not parse JSON response from Google Sheet Webapp.');
      return null;
    }

    if (result && result.success && result.data) {
      console.log('Successfully pulled data from Google Sheet Webapp!');
      return result.data;
    } else {
      console.warn('Google Sheet Webapp payload missing success or data:', result);
      return null;
    }
  } catch (error) {
    console.warn('Error fetching data from Google Sheet Webapp:', error);
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
    passwordHash: hashPassword('admin123'), // Demo credentials
    role: 'admin',
    name: 'Warehouse Owner / Admin',
    approved: true
  },
  manager: {
    id: 'u-manager',
    username: 'manager',
    passwordHash: hashPassword('manager123'),
    role: 'manager',
    name: 'Warehouse Manager',
    approved: true
  },
  manufacturer: {
    id: 'u-manu',
    username: 'manufacturer',
    passwordHash: hashPassword('manu123'),
    role: 'manufacturer',
    name: 'Production Specialist (MFR)',
    approved: true
  },
  sales: {
    id: 'u-sales',
    username: 'sales',
    passwordHash: hashPassword('sales123'),
    role: 'salesperson',
    name: 'Sales Representative (POS)',
    approved: true
  },
  dispatcher: {
    id: 'u-dispatcher',
    username: 'dispatcher',
    passwordHash: hashPassword('dispatch123'),
    role: 'dispatcher',
    name: 'Dispatch Person',
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
        buyers: parsed.buyers || [],
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
        warrantyClaims: parsed.warrantyClaims || [],
        salesOrders: parsed.salesOrders || [],
        unassembledBoxedStock: parsed.unassembledBoxedStock !== undefined ? parsed.unassembledBoxedStock : 0
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
    buyers: [],
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
    warrantyClaims: [],
    salesOrders: [],
    unassembledBoxedStock: 0
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
  return obj;
}

async function syncCollectionArray<T extends { id: string }>(
  collectionName: string,
  newList: T[] | undefined,
  oldList: T[] | undefined
) {
  if (!firebaseDb) return;
  try {
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
  } catch (err: any) {
    if (err && (String(err).includes('does not exist') || String(err).includes('NOT_FOUND') || String(err).includes('setup'))) {
      console.warn(`Firestore collection sync failed (${collectionName}): database does not exist. Disabling Firestore sync.`);
      firebaseDb = null;
    } else {
      console.warn(`Firestore collection sync warning (${collectionName}):`, err?.message || err);
    }
  }
}

async function syncUsers(
  newUsers: { [username: string]: any } | undefined,
  oldUsers: { [username: string]: any } | undefined
) {
  if (!firebaseDb) return;
  try {
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
  } catch (err: any) {
    if (err && (String(err).includes('does not exist') || String(err).includes('NOT_FOUND') || String(err).includes('setup'))) {
      console.warn('Firestore users sync failed: database does not exist. Disabling Firestore sync.');
      firebaseDb = null;
    } else {
      console.warn('Firestore users sync warning:', err?.message || err);
    }
  }
}

async function syncSheetConfig(newConfig: any, oldConfig: any) {
  if (!firebaseDb) return;
  if (!newConfig) return;
  try {
    if (!oldConfig || JSON.stringify(newConfig) !== JSON.stringify(oldConfig)) {
      console.log(`[Firestore Sync] config/sheetConfig updated.`);
      const docRef = doc(firebaseDb, 'config', 'sheetConfig');
      await setDoc(docRef, newConfig, { merge: true });
    }
  } catch (err: any) {
    if (err && (String(err).includes('does not exist') || String(err).includes('NOT_FOUND') || String(err).includes('setup'))) {
      console.warn('Firestore sheetConfig sync failed: database does not exist. Disabling Firestore sync.');
      firebaseDb = null;
    }
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
    try {
      console.log(`[Firestore Sync] config/lists updated.`);
      const docRef = doc(firebaseDb, 'config', 'lists');
      await setDoc(docRef, {
        batterySeriesList: newBatterySeries || [],
        chargerTypeList: newChargerTypes || []
      }, { merge: true });
    } catch (err: any) {
      if (err && (String(err).includes('does not exist') || String(err).includes('NOT_FOUND') || String(err).includes('setup'))) {
        console.warn('Firestore lists sync failed: database does not exist. Disabling Firestore sync.');
        firebaseDb = null;
      }
    }
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
      driveConfig: { clientId: '', clientSecret: '', refreshToken: '', connectedEmail: '', autoSync: false, folderId: '' },
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
    if (!firebaseDb) return;
    await syncCollectionArray('products', state.products, baseState.products);
    if (!firebaseDb) return;
    await syncCollectionArray('buyers', state.buyers, baseState.buyers);
    if (!firebaseDb) return;
    await syncCollectionArray('scooterUnits', state.scooterUnits, baseState.scooterUnits);
    if (!firebaseDb) return;
    await syncCollectionArray('stockLogs', state.stockLogs, baseState.stockLogs);
    if (!firebaseDb) return;
    await syncCollectionArray('batterySales', state.batterySales, baseState.batterySales);
    if (!firebaseDb) return;
    await syncCollectionArray('batteryImports', state.batteryImports, baseState.batteryImports);
    if (!firebaseDb) return;
    await syncCollectionArray('chargerSales', state.chargerSales, baseState.chargerSales);
    if (!firebaseDb) return;
    await syncCollectionArray('chargerImports', state.chargerImports, baseState.chargerImports);
    if (!firebaseDb) return;
    await syncCollectionArray('auditLogs', state.auditLogs, baseState.auditLogs);
    if (!firebaseDb) return;
    await syncCollectionArray('warrantyClaims', state.warrantyClaims, baseState.warrantyClaims);
    if (!firebaseDb) return;
    await syncSheetConfig(state.sheetConfig, baseState.sheetConfig);
    if (!firebaseDb) return;
    await syncLists(
      state.batterySeriesList,
      baseState.batterySeriesList,
      state.chargerTypeList,
      baseState.chargerTypeList
    );
  } catch (error: any) {
    if (error && (String(error).includes('does not exist') || String(error).includes('NOT_FOUND') || String(error).includes('setup'))) {
      console.warn('Firestore sync failed because database does not exist. Disabling Firestore sync.');
      firebaseDb = null;
    } else {
      console.error('Error during Firestore background sync:', error?.message || error);
    }
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

    const isEmpty = (!state.users || Object.keys(state.users).length === 0) &&
                    (!state.products || state.products.length === 0) &&
                    (!state.scooterUnits || state.scooterUnits.length === 0);

    if (isEmpty) {
      console.log('Cloud Firestore database appears empty. Seeding with local backup file contents...');
      const localState = readDBFromFile();
      await seedFirestore(localState);
      return localState;
    }

    const finalState: DBState = {
      users: state.users || DEFAULT_USERS,
      products: state.products && state.products.length > 0 ? state.products : DEFAULT_PRODUCTS,
      buyers: state.buyers || DEFAULT_BUYERS,
      scooterUnits: state.scooterUnits || [],
      stockLogs: state.stockLogs || [],
      sheetConfig: state.sheetConfig || { webhookUrl: '', enabled: false },
      driveConfig: state.driveConfig || { clientId: '', clientSecret: '', refreshToken: '', connectedEmail: '', autoSync: false, folderId: '' },
      batterySales: state.batterySales || [],
      batteryImports: state.batteryImports || [],
      chargerSales: state.chargerSales || [],
      chargerImports: state.chargerImports || [],
      batterySeriesList: state.batterySeriesList || ['Lithium 60V, 24AH', 'Lithium 60V, 30AH', 'Lithium 60V, 10AH', 'Lithium 48V, 30AH', 'Lithium 48V, 24AH', 'Lithium 60V, 28AH', 'Lithium 72V, 42AH', 'Lead Acid 12V'],
      chargerTypeList: state.chargerTypeList || ['Lithium Charger 54.6V/6A', 'Lithium Charger 69.4V/6A', 'Lithium Charger 67.2V/6A', 'Lead Acid Charger 48V', 'Lead Acid Charger 60V', 'Lead Acid Charger 72V'],
      auditLogs: state.auditLogs || [],
      warrantyClaims: state.warrantyClaims || []
    };

    return finalState;
  } catch (error: any) {
    if (error && (String(error).includes('does not exist') || String(error).includes('NOT_FOUND') || String(error).includes('setup'))) {
      console.warn('Firestore database does not exist for this project. Disabling Firestore sync and continuing with local storage mode.');
      firebaseDb = null;
    } else {
      console.warn('Firestore hydration failed or unavailable, continuing with local storage mode:', error?.message || error);
    }
    return null;
  }
}

// --- AUTOMATED 14-DAY ROLLING BACKUP SYSTEM ---
const BACKUP_DIR = path.join(process.cwd(), 'backups');
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

const RETENTION_DAYS = 14;
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;

function cleanupOldBackups() {
  try {
    if (!fs.existsSync(BACKUP_DIR)) return;
    const files = fs.readdirSync(BACKUP_DIR);
    const now = Date.now();
    let deletedCount = 0;
    files.forEach(file => {
      if (file.endsWith('.json')) {
        const filePath = path.join(BACKUP_DIR, file);
        const stats = fs.statSync(filePath);
        if (now - stats.mtimeMs > RETENTION_MS) {
          console.log(`[Backup Retention] Auto-purging backup snapshot older than 14 days: ${file}`);
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      }
    });
    if (deletedCount > 0) {
      console.log(`[Backup Retention] Successfully purged ${deletedCount} backup snapshot(s) older than 14 days.`);
    }
  } catch (err) {
    console.error('Error during 14-day backup retention cleanup:', err);
  }
}

function createBackupSnapshot(db: DBState, isAuto = false, customLabel = ''): { filename: string; filePath: string; uploadPromise?: Promise<boolean> } {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    const now = new Date();
    const dateStr = now.toISOString().replace(/[:.]/g, '-');
    const labelTag = customLabel ? `-${customLabel.replace(/[^a-zA-Z0-9]/g, '_')}` : '';
    const filename = `backup-${isAuto ? 'auto' : 'manual'}${labelTag}-${dateStr}.json`;
    const filePath = path.join(BACKUP_DIR, filename);

    const snapshotPayload = {
      _backupMetadata: {
        createdTimestamp: now.toISOString(),
        isAuto,
        customLabel: customLabel || (isAuto ? 'Automated Rolling Snapshot' : 'Manual User Snapshot'),
        retentionDays: 14,
        appVersion: '1.0.0'
      },
      ...db
    };

    fs.writeFileSync(filePath, JSON.stringify(snapshotPayload, null, 2), 'utf8');
    cleanupOldBackups();
    console.log(`[Backup System] Created snapshot: ${filename}`);

    let uploadPromise: Promise<boolean> | undefined;

    if (db.driveConfig?.autoSync && db.driveConfig?.refreshToken) {
      const stats = fs.statSync(filePath);
      const backupItem = {
        filename,
        createdTimestamp: now.toISOString(),
        sizeBytes: stats.size,
        isAuto,
        label: customLabel || (isAuto ? 'Automated Rolling Snapshot' : 'Manual User Snapshot'),
        counts: { scooterUnits: db.scooterUnits?.length || 0, salesOrders: db.salesOrders?.length || 0, buyers: db.buyers?.length || 0, products: db.products?.length || 0, warrantyClaims: db.warrantyClaims?.length || 0, batterySales: db.batterySales?.length || 0, chargerSales: db.chargerSales?.length || 0, stockLogs: db.stockLogs?.length || 0 }
      };
      
      // Execute upload and attach listeners, but also export the promise for callers who need to wait
      uploadPromise = uploadToDrive(db, backupItem, filePath);
      uploadPromise.then(success => {
        if (success) console.log(`[Backup System] Successfully synced ${filename} to Google Drive.`);
        else console.warn(`[Backup System] Failed to sync ${filename} to Google Drive. Check logs for missing folderId or permissions.`);
      }).catch(err => {
        console.error(`[Backup System] Exception during Drive sync for ${filename}:`, err);
      });
    }

    return { filename, filePath, uploadPromise };
  } catch (err: any) {
    console.error('Error creating backup snapshot:', err);
    return { filename: '', filePath: '' };
  }
}

let lastAutoBackupTime = 0;

function checkAutoBackupTrigger(db: DBState) {
  const now = Date.now();
  // Trigger auto snapshot at most once every 4 hours, or when no snapshot exists
  if (now - lastAutoBackupTime > 4 * 60 * 60 * 1000) {
    lastAutoBackupTime = now;
    createBackupSnapshot(db, true, 'Auto-Daily-Snapshot');
  }
}

function writeDB(state: DBState) {
  const oldState = globalDBState ? JSON.parse(JSON.stringify(globalDBState)) : null;
  globalDBState = state;
  try {
    fs.writeFile(DB_FILE, JSON.stringify(state, null, 2), 'utf8', (err) => {
      if (err) console.error('Error writing backup database file:', err);
    });
    // Trigger automated rolling 14-day backup check
    checkAutoBackupTrigger(state);
  } catch (err) {
    console.error('Error starting backup database file write:', err);
  }

  // Push to cloud Firestore in background
  syncToFirestore(state, oldState).catch(err => {
    console.error('Error in background Firestore sync:', err);
  });
}

function seedMockDataToDB(db: DBState) {
  writeDB(db);
}

function clearMockDataFromDB(db: DBState) {
  db.buyers = [];
  db.stockLogs = [];
  db.scooterUnits = [];
  db.batteryImports = [];
  db.batterySales = [];
  db.chargerImports = [];
  db.chargerSales = [];
  db.warrantyClaims = [];
  db.salesOrders = [];
  db.auditLogs = [];
  db.unassembledBoxedStock = 0;
  writeDB(db);
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
  password: z.string().min(1, "Password is required").max(100, "Password is too long").trim(),
});

const registerSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(100, "Username is too long").toLowerCase().trim().regex(ALPHANUMERIC_REGEX, "Username can only contain alphanumeric characters, underscores, and hyphens"),
  password: z.string().min(4, "Password must be at least 4 characters").max(100, "Password is too long").trim(),
  role: z.enum(['admin', 'manufacturer', 'salesperson', 'manager', 'dispatcher']),
  name: z.string().min(1, "Name is required").max(150, "Name is too long").trim(),
  approved: z.boolean().optional(),
});

const userUpdateSchema = z.object({
  id: z.string().min(1, "ID is required").max(100),
  username: z.string().min(3, "Username must be at least 3 characters").max(100, "Username is too long").toLowerCase().trim().regex(ALPHANUMERIC_REGEX, "Username can only contain alphanumeric characters, underscores, and hyphens"),
  password: z.string().min(4, "Password must be at least 4 characters").max(100, "Password is too long").optional().or(z.literal('')),
  role: z.enum(['admin', 'manufacturer', 'salesperson', 'manager', 'dispatcher']),
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
  buyerName: z.string().max(150).optional(),
  buyerContact: z.string().max(150).optional(),
  billNo: z.string().max(100).optional().or(z.literal('')),
  deliveryChallanNo: z.string().max(100).optional().or(z.literal('')),
  notes: z.string().max(1000).optional(),
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
  buyerName: z.string().max(150).optional(),
  buyerContact: z.string().max(150).optional(),
  billNo: z.string().max(100).optional().or(z.literal('')),
  deliveryChallanNo: z.string().max(100).optional().or(z.literal('')),
  notes: z.string().max(1000).optional(),
});

const wholesalePackageReleaseSchema = z.object({
  customerName: z.string().min(1, "Customer Name is required").max(150),
  scooterIds: z.array(z.string()).optional(),
  batteryIds: z.array(z.string()).optional(),
  chargerIds: z.array(z.string()).optional(),
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
  brakeType: z.string().optional(),
  customizationNotes: z.string().max(1000).optional(),
  buyerName: z.string().max(150).trim().optional(),
  buyerContact: z.string().max(150).trim().optional(),
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
  status: z.string().optional(),
  heldFor: z.string().nullable().optional(),
  heldBy: z.string().nullable().optional(),
  holdDate: z.string().nullable().optional(),
  salePrice: z.coerce.number().optional(),
  billingNo: z.string().optional().or(z.literal('')),
  notes: z.string().optional(),
  saleDate: z.string().optional(),
});

const scooterBulkCreateSchema = z.object({
  modelName: z.string().min(1, "Model Name is required").max(150).trim(),
  color: z.string().min(1, "Color is required").max(100).trim(),
  sourceChannel: z.string().max(100).optional(),
  frontTireSize: z.string().max(100).optional(),
  rearTireSize: z.string().max(100).optional(),
  brakeType: z.string().optional(),
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
  type: z.enum(['in', 'out', 'adjustment']),
  sourceChannel: z.string().max(100).optional(),
  quantity: z.coerce.number().int().positive().max(100000),
  buyerName: z.string().max(150).optional(),
  supplierName: z.string().max(150).optional().or(z.literal('')),
  operator: z.string().min(1, "Operator is required").max(150),
  notes: z.string().max(1000).optional(),
  billNo: z.string().max(100).optional().or(z.literal('')),
  stockInNo: z.string().max(100).optional().or(z.literal('')),
});

const sheetConfigSchema = z.object({
  webhookUrl: z.string().url("Must be a valid Webhook URL").or(z.literal('')),
  enabled: z.boolean(),
});

const emptySchema = z.object({}).strict();

const clearAuditLogsSchema = z.object({
  operator: z.string().max(100).optional(),
});

const userPullLocationSchema = z.object({
  username: z.string().min(1, "Username is required").max(100, "Username too long").toLowerCase().trim(),
});

const scooterReleaseHoldSchema = z.object({
  id: z.string().min(1, "Scooter ID is required").max(100),
  operator: z.string().max(100).optional(),
});

const scooterFinalizeHoldSchema = z.object({
  id: z.string().min(1, "ID is required").max(100),
  buyerName: z.string().min(1, "Buyer Name is required").max(200, "Buyer Name is too long"),
  buyerContact: z.string().min(1, "Buyer Contact is required").max(50, "Buyer Contact is too long"),
  salePrice: z.coerce.number().positive("Sale Price must be positive"),
  billingNo: z.string().min(1, "Billing Number is required").max(100, "Billing Number too long"),
  deliveryChallanNo: z.string().min(1, "Delivery Challan Number is required").max(100, "Challan Number too long"),
  notes: z.string().max(1000).optional(),
  operator: z.string().max(100).optional(),
});

const batteryUpdateHoldSchema = z.object({
  id: z.string().min(1, "Record ID is required").max(100),
  quantity: z.coerce.number().int("Quantity must be an integer").positive("Quantity must be positive"),
  heldFor: z.string().max(100).optional(),
  buyerName: z.string().min(1, "Buyer Name is required").max(200, "Buyer Name is too long"),
  notes: z.string().max(1000).optional(),
  batterySeries: z.string().min(1, "Battery Series is required").max(200, "Battery Series is too long"),
  operator: z.string().max(100).optional(),
});

const chargerUpdateHoldSchema = z.object({
  id: z.string().min(1, "Record ID is required").max(100),
  quantity: z.coerce.number().int("Quantity must be an integer").positive("Quantity must be positive"),
  heldFor: z.string().max(100).optional(),
  buyerName: z.string().min(1, "Buyer Name is required").max(200, "Buyer Name is too long"),
  notes: z.string().max(1000).optional(),
  chargerType: z.string().min(1, "Charger Type is required").max(200, "Charger Type is too long"),
  operator: z.string().max(100).optional(),
});

const validateDocumentNumbersSchema = z.object({
  billNo: z.string().max(100).optional(),
  deliveryChallanNo: z.string().max(100).optional(),
  excludeId: z.string().max(100).optional(),
  excludeIds: z.array(z.string().max(100)).optional(),
});

const challanRemoveItemSchema = z.object({
  deliveryChallanNo: z.string().min(1, "Challan Number is required").max(100),
  itemType: z.enum(['scooter', 'battery', 'charger']),
  itemId: z.string().min(1, "Item ID is required").max(100),
  operator: z.string().max(100).optional(),
  userRole: z.string().max(100).optional(),
});

const challanAttachItemSchema = z.object({
  deliveryChallanNo: z.string().min(1, "Challan Number is required").max(100),
  itemType: z.enum(['scooter', 'battery', 'charger']),
  itemId: z.string().min(1, "Item ID is required").max(100),
  operator: z.string().max(100).optional(),
  userRole: z.string().max(100).optional(),
  buyerName: z.string().max(200).optional(),
  buyerContact: z.string().max(100).optional(),
  salesBillNo: z.string().max(100).optional(),
});

const challanFinishSchema = z.object({
  deliveryChallanNo: z.string().min(1, "Challan Number is required").max(100),
  operator: z.string().max(100).optional(),
});

const challanUpdateSchema = z.object({
  deliveryChallanNo: z.string().min(1, "Challan Number is required").max(100),
  newChallanNo: z.string().max(100).optional(),
  buyerName: z.string().max(200).optional(),
  buyerContact: z.string().max(100).optional(),
  billNo: z.string().max(100).optional(),
  operator: z.string().max(100).optional(),
  userRole: z.string().max(100).optional(),
});

const challanDeleteEntireSchema = z.object({
  deliveryChallanNo: z.string().min(1, "Challan Number is required").max(100),
  operator: z.string().max(100).optional(),
  userRole: z.string().max(100).optional(),
});

const warrantyClaimSchema = z.object({
  id: z.string().max(100).optional(),
  originalSaleId: z.string().min(1, "Original Sale ID is required").max(100),
  originalSaleType: z.enum(['scooter', 'battery', 'charger']),
  originalSerialNo: z.string().min(1, "Original Serial Number is required").max(100),
  buyerName: z.string().min(1, "Buyer Name is required").max(200),
  buyerContact: z.string().max(100).optional(),
  saleDate: z.string().max(50).optional(),
  warrantyDurationMonths: z.coerce.number().int().nonnegative().optional(),
  issueDescription: z.string().min(1, "Issue description is required").max(2000),
  status: z.enum(['under_repair', 'repaired', 'exchanged', 'rejected', 'pending_mfr', 'pending_parts', 'resolved', 'investigating']),
  actionTaken: z.string().max(2000).optional(),
  newSerialNo: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
  operatorName: z.string().max(100).optional(),
  operatorUsername: z.string().max(100).optional(),
  replacementWarrantyMonths: z.coerce.number().int().nonnegative().optional(),
  isBattery: z.boolean().optional(),
  claimDate: z.string().max(50).optional(),
  
  // Extra fields sent by frontend
  claimedComponent: z.string().max(200).optional(),
  modelName: z.string().max(200).optional(),
  collectedDate: z.string().max(100).optional(),
  supplierName: z.string().max(200).optional(),
  containerId: z.string().max(100).optional(),
  sourceBillNo: z.string().max(100).optional(),
  stockInNo: z.string().max(100).optional(),
  supplierWarrantyStatus: z.string().max(200).optional(),
  specialistNotes: z.string().max(2000).optional()
});

const bulkSeedSchema = z.object({
  mode: z.enum(['replace', 'append']).optional(),
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

// Mock Data Management Routes (for testing & reset)
app.post('/api/seed-mock-data', validateBody(emptySchema), (req, res) => {
  try {
    const db = readDB();
    seedMockDataToDB(db);
    addAuditLog(db, 'system', 'System Administrator', 'mock_data_seeded', 'Seeded test dataset into warehouse database.');
    res.json({ success: true, message: 'Mock data seeded successfully.' });
  } catch (err: any) {
    console.error('Error during mock data seeding:', err);
    res.status(500).json({ error: 'Failed to seed mock data. Please contact the administrator.' });
  }
});

app.post('/api/clear-mock-data', validateBody(emptySchema), (req, res) => {
  try {
    const db = readDB();
    clearMockDataFromDB(db);
    addAuditLog(db, 'system', 'System Administrator', 'mock_data_cleared', 'Cleared test dataset from warehouse database.');
    res.json({ success: true, message: 'Mock data removed successfully.' });
  } catch (err: any) {
    console.error('Error during mock data clearing:', err);
    res.status(500).json({ error: 'Failed to clear mock data. Please contact the administrator.' });
  }
});

// Auth: Login
app.post('/api/auth/login', authIpRateLimiter, validateBody(loginSchema), (req, res) => {
  try {
    const { username, password } = req.body;

    const db = readDB();
    const cleanInputUsername = username ? username.toLowerCase().trim() : '';
    
    let normalizedUserKey = cleanInputUsername; // Already normalized by the schema normally, but enforcing here
    let user = db.users[normalizedUserKey];
    
    if (!user) {
      // Search case-insensitively in db.users keys and u.username as a fallback
      const entry = Object.entries(db.users).find(([k, u]) => 
        k.toLowerCase().trim() === cleanInputUsername || 
        (u.username && u.username.toLowerCase().trim() === cleanInputUsername)
      );
      if (entry) {
        normalizedUserKey = entry[0];
        user = entry[1];
      }
    }

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

    const hashedPasswordInput = hashPassword(password);
    if (user.passwordHash !== password && user.passwordHash !== hashedPasswordInput) {
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
      passwordHash: hashPassword(password),
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
    failedAttempts: 0
  };

  // Always reset backoff tracker when admin modifies user or changes password
  recordAuthSuccess(oldKey);
  recordAuthSuccess(newNormalizedUsername);
  if (oldUser.username) recordAuthSuccess(oldUser.username);

  if (locked === false) {
    recordAuthSuccess(newNormalizedUsername);
  }

  if (password && password.trim() !== '') {
    updatedUser.passwordHash = hashPassword(password);
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
  const limitTime = Date.now() - 24 * 60 * 60 * 1000;
  let dbChanged = false;

  const safeUsers = Object.values(db.users).map(({ passwordHash, ...user }) => {
    let history = user.locationHistory || [];
    const prunedHistory = history.filter(
      (entry: any) => new Date(entry.timestamp).getTime() >= limitTime
    );
    
    if (prunedHistory.length !== history.length) {
      if (db.users[user.username]) {
        db.users[user.username].locationHistory = prunedHistory;
        dbChanged = true;
      }
    }

    return {
      ...user,
      locationHistory: prunedHistory,
      passwordText: passwordHash
    };
  });

  if (dbChanged) {
    writeDB(db);
  }

  res.json(safeUsers);
});

// Auth: Update User Location (For silent employee geolocation updates)
app.post('/api/users/location', validateBody(userLocationSchema), (req, res) => {
  const { username, latitude, longitude } = req.body;
  const db = readDB();
  const normalized = username.toLowerCase().trim();
  if (db.users[normalized]) {
    const timestamp = new Date().toISOString();
    db.users[normalized].latitude = latitude;
    db.users[normalized].longitude = longitude;
    db.users[normalized].locationTimestamp = timestamp;
    db.users[normalized].pullLocationRequested = false;
    
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

// Auth: Request live location pull from an employee's device
app.post('/api/users/pull-location', validateBody(userPullLocationSchema), (req, res) => {
  const { username } = req.body;
  const db = readDB();
  const normalized = username; // Already normalized lower/trim by schema
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
  user.failedAttempts = 0;
  recordAuthSuccess(key);
  if (user.username) recordAuthSuccess(user.username);
  
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

// Audit Logs: Clear (Admin/Owner only)
app.post('/api/audit-logs/clear', validateBody(clearAuditLogsSchema), (req, res) => {
  const db = readDB();
  const operator = req.body.operator || 'system';
  db.auditLogs = [];
  addAuditLog(db, 'admin', operator, 'audit_logs_cleared', `Cleared system audit log history by ${operator}.`);
  writeDB(db);
  res.json({ success: true, message: 'System audit logs cleared successfully.' });
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
app.post('/api/products/bulk-seed', validateBody(bulkSeedSchema), (req, res) => {
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
    buyerContact,
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
    billNo,
    deliveryChallanNo,
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

  let cleanStart = startNo ? String(startNo).trim() : 'N/A';
  let cleanEnd = endNo ? String(endNo).trim() : 'N/A';

  let finalSerials = serialNumbers && Array.isArray(serialNumbers) && serialNumbers.length > 0 ? serialNumbers.map(s => String(s).trim()).filter(Boolean) : undefined;
  
  const requestedQty = Math.max(1, Number(quantity) || (finalSerials ? finalSerials.length : 1));

  if ((!finalSerials || finalSerials.length < requestedQty) && cleanStart !== 'N/A') {
    const startMatch = cleanStart.match(/^(.*?[\s\-_/\\#]*?)(\d+)$/i);
    const endMatch = cleanEnd !== 'N/A' ? cleanEnd.match(/^(.*?[\s\-_/\\#]*?)(\d+)$/i) : null;
    
    if (startMatch) {
      const prefix = startMatch[1] !== undefined ? startMatch[1] : `${batterySeries} `;
      const startNum = parseInt(startMatch[2], 10);
      const paddingLength = startMatch[2].length;
      let countToGen = requestedQty;

      if (endMatch) {
        const endNum = parseInt(endMatch[2], 10);
        if (!isNaN(endNum) && endNum >= startNum) {
          countToGen = Math.max(requestedQty, endNum - startNum + 1);
        }
      }

      const list: string[] = [];
      for (let i = 0; i < countToGen; i++) {
        const numStr = String(startNum + i).padStart(paddingLength, '0');
        list.push(`${prefix}${numStr}`);
      }
      finalSerials = list;
    } else {
      if (requestedQty > 1) {
        const list: string[] = [];
        for (let i = 1; i <= requestedQty; i++) {
          list.push(`${cleanStart}-${i}`);
        }
        finalSerials = list;
      } else {
        finalSerials = [cleanStart];
      }
    }
  }

  if (!finalSerials || finalSerials.length === 0) {
    const tag = (batterySeries || 'BAT').trim();
    const list: string[] = [];
    for (let i = 1; i <= requestedQty; i++) {
      list.push(`${tag} ${String(i).padStart(3, '0')}`);
    }
    finalSerials = list;
  }

  const finalQty = Math.max(requestedQty, finalSerials.length);

  if (finalSerials && finalSerials.length > 0) {
    cleanStart = finalSerials[0];
    cleanEnd = finalSerials[finalSerials.length - 1];
  }

  const hasWarranty = isUnderWarranty !== undefined ? !!isUnderWarranty : (Boolean(warrantyDurationMonths) && Number(warrantyDurationMonths) > 0);
  const finalWarrantyMonths = hasWarranty ? Number(warrantyDurationMonths || 12) : undefined;

  const newSale: BatterySale = {
    id: `batsale-${Date.now()}`,
    buyerName,
    buyerContact: buyerContact || undefined,
    batterySeries,
    startNo: cleanStart,
    endNo: cleanEnd,
    quantity: finalQty,
    saleDate: timestamp,
    operator: operator || 'system',
    notes: notes || undefined,
    isUnderWarranty: hasWarranty,
    warrantyDurationMonths: finalWarrantyMonths,
    status: isHold ? 'hold' : 'sold',
    heldFor: isHold ? (heldFor || buyerName) : undefined,
    heldBy: isHold ? (operator || 'Operator') : undefined,
    holdDate: isHold ? timestamp : undefined,
    billNo: billNo || undefined,
    deliveryChallanNo: deliveryChallanNo || undefined,
    serialNumbers: finalSerials
  };

  db.batterySales.push(newSale);

  if (!isHold) {
    db.stockLogs.push({
      id: `stocklog-${Date.now()}`,
      modelName: `${batterySeries} Battery Pack`,
      color: 'Standard',
      type: 'out',
      sourceChannel: 'customer_sale',
      quantity: finalQty,
      buyerName,
      timestamp,
      operator: operator || 'system',
      notes: `Wholesale Battery Sale: ${cleanStart} to ${cleanEnd} (${finalQty} Batteries)`,
      billNo: billNo || undefined
    });
  }
  addAuditLog(db, operator || 'system', operator || 'system', isHold ? 'battery_hold' : 'battery_sale', `Registered battery ${isHold ? 'hold/reservation' : 'sale/dispatch'} for Series ${batterySeries} (Qty: ${finalQty} Batteries, Buyer: ${buyerName}).`);
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
  const { id, operator, buyerName, buyerContact, billNo, deliveryChallanNo, notes } = req.body;

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
  if (buyerName) record.buyerName = buyerName;
  if (buyerContact) record.buyerContact = buyerContact;
  if (billNo) record.billNo = billNo;
  if (deliveryChallanNo) record.deliveryChallanNo = deliveryChallanNo;
  if (notes) record.notes = notes;
  record.heldFor = undefined;
  record.heldBy = undefined;
  
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
    buyerContact,
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
    billNo,
    deliveryChallanNo,
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

  let cleanStart = startNo ? String(startNo).trim().toUpperCase() : 'N/A';
  let cleanEnd = endNo ? String(endNo).trim().toUpperCase() : 'N/A';

  let finalSerials = serialNumbers && Array.isArray(serialNumbers) && serialNumbers.length > 0 ? serialNumbers.map(s => String(s).trim().toUpperCase()).filter(Boolean) : undefined;

  const requestedQty = Math.max(1, Number(quantity) || (finalSerials ? finalSerials.length : 1));

  if ((!finalSerials || finalSerials.length < requestedQty) && cleanStart !== 'N/A') {
    const startMatch = cleanStart.match(/^(.*?[\s\-_/\\#]*?)(\d+)$/i);
    const endMatch = cleanEnd !== 'N/A' ? cleanEnd.match(/^(.*?[\s\-_/\\#]*?)(\d+)$/i) : null;
    
    if (startMatch) {
      const prefix = startMatch[1] !== undefined ? startMatch[1] : '';
      const startNum = parseInt(startMatch[2], 10);
      const paddingLength = startMatch[2].length;
      let countToGen = requestedQty;

      if (endMatch) {
        const endNum = parseInt(endMatch[2], 10);
        if (!isNaN(endNum) && endNum >= startNum) {
          countToGen = Math.max(requestedQty, endNum - startNum + 1);
        }
      }

      const list: string[] = [];
      for (let i = 0; i < countToGen; i++) {
        const numStr = String(startNum + i).padStart(paddingLength, '0');
        list.push(`${prefix}${numStr}`);
      }
      finalSerials = list;
    } else {
      if (requestedQty > 1) {
        const list: string[] = [];
        for (let i = 1; i <= requestedQty; i++) {
          list.push(`${cleanStart}-${i}`);
        }
        finalSerials = list;
      } else {
        finalSerials = [cleanStart];
      }
    }
  }

  if (!finalSerials || finalSerials.length === 0) {
    const rawTag = (chargerType || 'CHG').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const cleanTag = rawTag.slice(0, 8) || 'CHG';
    const list: string[] = [];
    for (let i = 1; i <= requestedQty; i++) {
      list.push(`${cleanTag}-${1000 + i}`);
    }
    finalSerials = list;
  }

  const finalQty = Math.max(requestedQty, finalSerials.length);

  if (finalSerials && finalSerials.length > 0) {
    cleanStart = finalSerials[0];
    cleanEnd = finalSerials[finalSerials.length - 1];
  }

  const hasWarranty = isUnderWarranty !== undefined ? !!isUnderWarranty : (Boolean(warrantyDurationMonths) && Number(warrantyDurationMonths) > 0);
  const finalWarrantyMonths = hasWarranty ? Number(warrantyDurationMonths || 6) : undefined;

  const newSale: ChargerSale = {
    id: `chgsale-${Date.now()}`,
    buyerName,
    buyerContact: buyerContact || undefined,
    chargerType,
    startNo: cleanStart,
    endNo: cleanEnd,
    quantity: finalQty,
    saleDate: timestamp,
    operator: operator || 'system',
    notes: notes || undefined,
    isUnderWarranty: hasWarranty,
    warrantyDurationMonths: finalWarrantyMonths,
    status: isHold ? 'hold' : 'sold',
    heldFor: isHold ? (heldFor || buyerName) : undefined,
    heldBy: isHold ? (operator || 'Operator') : undefined,
    holdDate: isHold ? timestamp : undefined,
    billNo: billNo || undefined,
    deliveryChallanNo: deliveryChallanNo || undefined,
    serialNumbers: finalSerials
  };

  db.chargerSales.push(newSale);

  if (!isHold) {
    db.stockLogs.push({
      id: `stocklog-${Date.now()}`,
      modelName: `${chargerType} Charger`,
      color: 'Standard',
      type: 'out',
      sourceChannel: 'customer_sale',
      quantity: finalQty,
      buyerName,
      timestamp,
      operator: operator || 'system',
      notes: `Standalone Wholesale Charger Sale: ${cleanStart} to ${cleanEnd} (${finalQty} Units)`,
      billNo: billNo || undefined
    });
  }
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
  const { id, operator, buyerName, buyerContact, billNo, deliveryChallanNo, notes } = req.body;

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
  if (buyerName) record.buyerName = buyerName;
  if (buyerContact) record.buyerContact = buyerContact;
  if (billNo) record.billNo = billNo;
  if (deliveryChallanNo) record.deliveryChallanNo = deliveryChallanNo;
  if (notes) record.notes = notes;
  record.heldFor = undefined;
  record.heldBy = undefined;
  
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

// Scooter Units: Release Hold
app.post('/api/scooter-units/release-hold', validateBody(scooterReleaseHoldSchema), (req, res) => {
  const { id, operator } = req.body;
  const db = readDB();
  const unit = db.scooterUnits.find(u => u.id === id);
  if (!unit) {
    return res.status(404).json({ error: 'Scooter unit not found.' });
  }
  unit.status = 'available';
  unit.heldFor = undefined;
  unit.heldBy = undefined;
  unit.holdDate = undefined;
  unit.lastUpdatedTimestamp = new Date().toISOString();
  unit.lastUpdatedBy = operator || 'system';

  addAuditLog(db, operator || 'system', operator || 'system', 'scooter_hold_released', `Released hold reservation for Scooter (Chassis: ${unit.chassisNo}). Unit returned to available warehouse stock.`);
  writeDB(db);
  res.json({ success: true, scooterUnit: unit });
});

// Unassembled Boxed Stock (Kits) - Get & Update
app.get('/api/unassembled-boxed-stock', (req, res) => {
  const db = readDB();
  res.json({ count: db.unassembledBoxedStock !== undefined ? db.unassembledBoxedStock : 0 });
});

app.post('/api/unassembled-boxed-stock', (req, res) => {
  const { count, operator } = req.body;
  if (count === undefined || typeof count !== 'number' || count < 0) {
    return res.status(400).json({ error: 'Valid positive boxed stock count is required' });
  }
  const db = readDB();
  db.unassembledBoxedStock = count;
  addAuditLog(db, operator || 'Manager', operator || 'Manager', 'update_boxed_stock', `Updated Unassembled Boxed Stock count to ${count} units.`);
  writeDB(db);
  res.json({ success: true, count: db.unassembledBoxedStock });
});

// Scooter Units: Mark Incomplete / Unprepared (Manager Role)
app.post('/api/scooter-units/mark-incomplete', (req, res) => {
  const { chassisNo, missingParts, modelName, color, operator } = req.body;

  if (!chassisNo || !chassisNo.trim()) {
    return res.status(400).json({ error: 'Chassis Number is required.' });
  }
  if (!missingParts || !missingParts.trim()) {
    return res.status(400).json({ error: 'Please specify exactly what part or thing is missing to complete the unit.' });
  }

  const db = readDB();
  const cleanChassis = chassisNo.trim().toUpperCase();
  const timestamp = new Date().toISOString();

  let unit = db.scooterUnits.find(u => String(u.chassisNo || '').toUpperCase() === cleanChassis);

  if (unit) {
    unit.status = 'incomplete';
    unit.missingParts = missingParts.trim();
    unit.flaggedIncompleteBy = operator || 'Manager';
    unit.flaggedIncompleteTimestamp = timestamp;
    unit.lastUpdatedBy = operator || 'Manager';
    unit.lastUpdatedTimestamp = timestamp;
  } else {
    // Create new incomplete unit entry if chassis not registered yet
    unit = {
      id: `scoot-${Date.now()}`,
      modelName: modelName || 'SENZO ESSENATIAL DISC 12"/10"',
      color: color || 'Black',
      chassisNo: cleanChassis,
      motorNo: `MT-${cleanChassis.replace(/[^0-9]/g, '') || Math.floor(10000 + Math.random() * 90000)}`,
      controllerNo: `CT-${cleanChassis.replace(/[^0-9]/g, '') || Math.floor(10000 + Math.random() * 90000)}`,
      tireSize: '12-inch',
      batterySerials: [],
      status: 'incomplete',
      missingParts: missingParts.trim(),
      flaggedIncompleteBy: operator || 'Manager',
      flaggedIncompleteTimestamp: timestamp,
      scooterWarrantyStatus: 'None',
      batteryWarrantyStatus: 'None',
      createdOperator: operator || 'Manager',
      createdTimestamp: timestamp,
      lastUpdatedTimestamp: timestamp
    };
    db.scooterUnits.push(unit);
  }

  addAuditLog(db, operator || 'Manager', operator || 'Manager', 'mark_unit_incomplete', `Moved Chassis ${cleanChassis} to Unprepared/Incomplete list. Missing parts specified: "${missingParts.trim()}".`);
  writeDB(db);

  res.json({ success: true, scooterUnit: unit });
});

// Scooter Units: Prepare It (Restock into "Built and Ready" stock)
app.post('/api/scooter-units/prepare-incomplete', (req, res) => {
  const { id, chassisNo, operator } = req.body;
  const db = readDB();
  
  let unit: ScooterUnit | undefined;
  if (id) {
    unit = db.scooterUnits.find(u => u.id === id);
  } else if (chassisNo) {
    unit = db.scooterUnits.find(u => String(u.chassisNo || '').toUpperCase() === String(chassisNo).trim().toUpperCase());
  }

  if (!unit) {
    return res.status(404).json({ error: 'Scooter unit not found.' });
  }

  const timestamp = new Date().toISOString();
  const oldMissingParts = unit.missingParts || 'Unspecified parts';

  unit.status = 'available'; // RESTOCKED into Built and Ready stock!
  unit.preparedBy = operator || 'Manager';
  unit.preparedTimestamp = timestamp;
  unit.lastUpdatedBy = operator || 'Manager';
  unit.lastUpdatedTimestamp = timestamp;

  addAuditLog(db, operator || 'Manager', operator || 'Manager', 'prepare_incomplete_unit', `Confirmed missing parts added for Chassis ${unit.chassisNo} (Parts: "${oldMissingParts}"). Unit restocked into Built and Ready stock.`);
  writeDB(db);

  res.json({ success: true, scooterUnit: unit, message: `Chassis ${unit.chassisNo} has been completed and restocked into Built and Ready stock!` });
});

// Wholesale Package: Release Entire Package
app.post('/api/wholesale-package/release', validateBody(wholesalePackageReleaseSchema), (req, res) => {
  const { customerName, scooterIds = [], batteryIds = [], chargerIds = [], operator } = req.body;
  const db = readDB();
  const timestamp = new Date().toISOString();
  let releasedScooters = 0;
  let releasedBatteries = 0;
  let releasedChargers = 0;

  // 1. Release Scooter Holds
  if (scooterIds && scooterIds.length > 0 && db.scooterUnits) {
    for (const sid of scooterIds) {
      const u = db.scooterUnits.find(unit => unit.id === sid);
      if (u) {
        u.status = 'available';
        u.heldFor = undefined;
        u.heldBy = undefined;
        u.holdDate = undefined;
        u.lastUpdatedTimestamp = timestamp;
        u.lastUpdatedBy = operator || 'system';
        releasedScooters++;
      }
    }
  }

  // 2. Release Battery Holds
  if (batteryIds && batteryIds.length > 0 && db.batterySales) {
    for (const bid of batteryIds) {
      const idx = db.batterySales.findIndex(b => b.id === bid);
      if (idx !== -1) {
        db.batterySales.splice(idx, 1);
        releasedBatteries++;
      }
    }
  }

  // 3. Release Charger Holds
  if (chargerIds && chargerIds.length > 0 && db.chargerSales) {
    for (const cid of chargerIds) {
      const idx = db.chargerSales.findIndex(c => c.id === cid);
      if (idx !== -1) {
        db.chargerSales.splice(idx, 1);
        releasedChargers++;
      }
    }
  }

  const totalReleased = releasedScooters + releasedBatteries + releasedChargers;
  addAuditLog(db, operator || 'system', operator || 'system', 'wholesale_package_released', `Released entire wholesale reservation package for customer "${customerName}" (${releasedScooters} scooters, ${releasedBatteries} battery holds, ${releasedChargers} charger holds returned to inventory).`);
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
        chargerSales: db.chargerSales || [],
        ...getSummaryData(db)
      }
    });
  }

  res.json({ success: true, releasedCount: totalReleased, customerName });
});

// Scooter Units: Finalize Hold (Sale)
app.post('/api/scooter-units/finalize-hold', validateBody(scooterFinalizeHoldSchema), (req, res) => {
  const { id, buyerName, buyerContact, salePrice, billingNo, deliveryChallanNo, notes, operator } = req.body;
  const db = readDB();
  const unit = db.scooterUnits.find(u => u.id === id);
  if (!unit) {
    return res.status(404).json({ error: 'Scooter unit not found.' });
  }
  const timestamp = new Date().toISOString();
  unit.status = 'sold';
  unit.buyerName = buyerName || unit.heldFor || 'Customer';
  unit.buyerContact = buyerContact || unit.buyerContact || '';
  unit.salesBillNo = billingNo || unit.salesBillNo || '';
  unit.deliveryChallanNo = deliveryChallanNo || unit.deliveryChallanNo || '';
  unit.customizationNotes = notes || unit.customizationNotes || '';
  unit.saleDate = timestamp;
  unit.heldFor = undefined;
  unit.heldBy = undefined;
  unit.holdDate = undefined;
  unit.lastUpdatedTimestamp = timestamp;
  unit.lastUpdatedBy = operator || 'system';

  const autoOutLog: StockLog = {
    id: `log-out-${Date.now()}`,
    modelName: unit.modelName,
    color: unit.color,
    type: 'out',
    sourceChannel: 'customer_sale',
    quantity: 1,
    buyerName: unit.buyerName,
    timestamp,
    operator: operator || 'system',
    notes: `Scooter hold converted to sale (Chassis: ${unit.chassisNo})`,
    billNo: billingNo || undefined
  };
  db.stockLogs.push(autoOutLog);

  addAuditLog(db, operator || 'system', operator || 'system', 'scooter_hold_finalized', `Finalized hold reservation and dispatched Scooter (Chassis: ${unit.chassisNo}) to Buyer: ${unit.buyerName}. Bill No: ${billingNo || 'N/A'}, Challan No: ${deliveryChallanNo || 'N/A'}.`);
  writeDB(db);
  res.json({ success: true, scooterUnit: unit });
});

// Update Hold quantity & details before dispatch (Batteries)
app.post('/api/battery-sales/update-hold', validateBody(batteryUpdateHoldSchema), (req, res) => {
  const { id, quantity, heldFor, buyerName, notes, batterySeries, operator } = req.body;
  const db = readDB();
  if (!db.batterySales) db.batterySales = [];
  const record = db.batterySales.find(s => s.id === id);
  if (!record) return res.status(404).json({ error: 'Battery hold record not found' });
  if (record.status !== 'hold') return res.status(400).json({ error: 'Record is not on hold' });

  const newQty = Math.max(1, Number(quantity) || 1);
  record.quantity = newQty;
  if (heldFor !== undefined) record.heldFor = heldFor;
  if (buyerName !== undefined) record.buyerName = buyerName;
  if (notes !== undefined) record.notes = notes;
  if (batterySeries !== undefined) record.batterySeries = batterySeries;

  const tag = (record.batterySeries || 'BAT').trim();
  const list: string[] = [];
  for (let i = 1; i <= newQty; i++) {
    list.push(`${tag} ${String(i).padStart(3, '0')}`);
  }
  record.serialNumbers = list;
  record.startNo = list[0];
  record.endNo = list[list.length - 1];

  addAuditLog(db, operator || 'system', operator || 'system', 'battery_hold_updated', `Updated battery hold reservation details (Series: ${record.batterySeries}, New Qty: ${newQty}, Customer: ${record.heldFor}).`);
  writeDB(db);
  res.json({ success: true, batterySale: record });
});

// Update Hold quantity & details before dispatch (Chargers)
app.post('/api/charger-sales/update-hold', validateBody(chargerUpdateHoldSchema), (req, res) => {
  const { id, quantity, heldFor, buyerName, notes, chargerType, operator } = req.body;
  const db = readDB();
  if (!db.chargerSales) db.chargerSales = [];
  const record = db.chargerSales.find(s => s.id === id);
  if (!record) return res.status(404).json({ error: 'Charger hold record not found' });
  if (record.status !== 'hold') return res.status(400).json({ error: 'Record is not on hold' });

  const newQty = Math.max(1, Number(quantity) || 1);
  record.quantity = newQty;
  if (heldFor !== undefined) record.heldFor = heldFor;
  if (buyerName !== undefined) record.buyerName = buyerName;
  if (notes !== undefined) record.notes = notes;
  if (chargerType !== undefined) record.chargerType = chargerType;

  addAuditLog(db, operator || 'system', operator || 'system', 'charger_hold_updated', `Updated charger hold reservation details (Type: ${record.chargerType}, New Qty: ${newQty}, Customer: ${record.heldFor}).`);
  writeDB(db);
  res.json({ success: true, chargerSale: record });
});

// Validate Document Numbers (Bill / Invoice No & Delivery Challan No)
app.post('/api/validate-document-numbers', validateBody(validateDocumentNumbersSchema), (req, res) => {
  const { billNo, deliveryChallanNo, excludeId, excludeIds } = req.body;
  const db = readDB();
  
  let billExists = false;
  let billFoundIn = '';
  let challanExists = false;
  let challanFoundIn = '';

  const cleanBill = billNo ? String(billNo).trim().toLowerCase() : '';
  const cleanChallan = deliveryChallanNo ? String(deliveryChallanNo).trim().toLowerCase() : '';

  const isExcluded = (id: string) => {
    if (!id) return false;
    if (excludeId && id === excludeId) return true;
    if (Array.isArray(excludeIds) && excludeIds.includes(id)) return true;
    return false;
  };

  if (cleanBill) {
    const sMatch = db.scooterUnits.find(u => !isExcluded(u.id) && (
      (u.salesBillNo && u.salesBillNo.trim().toLowerCase() === cleanBill) ||
      (u.billNo && u.billNo.trim().toLowerCase() === cleanBill)
    ));
    if (sMatch) {
      billExists = true;
      billFoundIn = `Scooter Unit (Chassis: ${sMatch.chassisNo})`;
    }

    if (!billExists && db.batterySales) {
      const bMatch = db.batterySales.find(b => !isExcluded(b.id) && b.billNo && b.billNo.trim().toLowerCase() === cleanBill);
      if (bMatch) {
        billExists = true;
        billFoundIn = `Battery Sale (${bMatch.batterySeries})`;
      }
    }

    if (!billExists && db.chargerSales) {
      const cMatch = db.chargerSales.find(c => !isExcluded(c.id) && c.billNo && c.billNo.trim().toLowerCase() === cleanBill);
      if (cMatch) {
        billExists = true;
        billFoundIn = `Charger Sale (${cMatch.chargerType})`;
      }
    }

    if (!billExists && db.stockLogs) {
      const lMatch = db.stockLogs.find(l => !isExcluded(l.id) && l.billNo && l.billNo.trim().toLowerCase() === cleanBill);
      if (lMatch) {
        billExists = true;
        billFoundIn = `Stock Ledger (${lMatch.modelName})`;
      }
    }
  }

  if (cleanChallan) {
    const sMatch = db.scooterUnits.find(u => !isExcluded(u.id) && (
      (u.deliveryChallanNo && u.deliveryChallanNo.trim().toLowerCase() === cleanChallan) ||
      ((u as any).salesChallanNo && (u as any).salesChallanNo.trim().toLowerCase() === cleanChallan)
    ));
    if (sMatch) {
      challanExists = true;
      challanFoundIn = `Scooter Unit (Chassis: ${sMatch.chassisNo})`;
    }

    if (!challanExists && db.batterySales) {
      const bMatch = db.batterySales.find(b => !isExcluded(b.id) && b.deliveryChallanNo && b.deliveryChallanNo.trim().toLowerCase() === cleanChallan);
      if (bMatch) {
        challanExists = true;
        challanFoundIn = `Battery Sale (${bMatch.batterySeries})`;
      }
    }

    if (!challanExists && db.chargerSales) {
      const cMatch = db.chargerSales.find(c => !isExcluded(c.id) && c.deliveryChallanNo && c.deliveryChallanNo.trim().toLowerCase() === cleanChallan);
      if (cMatch) {
        challanExists = true;
        challanFoundIn = `Charger Sale (${cMatch.chargerType})`;
      }
    }

    if (!challanExists && db.stockLogs) {
      const lMatch = db.stockLogs.find(l => !isExcluded(l.id) && (l as any).deliveryChallanNo && (l as any).deliveryChallanNo.trim().toLowerCase() === cleanChallan);
      if (lMatch) {
        challanExists = true;
        challanFoundIn = `Stock Ledger (${lMatch.modelName})`;
      }
    }
  }

  res.json({
    billExists,
    billFoundIn,
    challanExists,
    challanFoundIn
  });
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
  const { modelName, color, type, sourceChannel, quantity, buyerName, supplierName, operator, notes, billNo, stockInNo } = req.body;

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
    supplierName: type === 'in' ? (supplierName || undefined) : undefined,
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

// Delivery Challan Verification & Edit Endpoints
app.post('/api/challans/remove-item', validateBody(challanRemoveItemSchema), (req, res) => {
  const { deliveryChallanNo, itemType, itemId, operator, userRole } = req.body;
  const db = readDB();
  const cleanChallan = String(deliveryChallanNo).trim().toUpperCase();

  let itemDetail = `${itemType} #${itemId}`;
  if (itemType === 'scooter') {
    const scoot = db.scooterUnits.find(s => s.id === itemId);
    if (scoot) {
      if (scoot.challanStatus === 'finished' && userRole !== 'admin') {
        return res.status(403).json({ error: 'Cannot remove items from a finished & verified challan.' });
      }
      itemDetail = `Scooter (${scoot.modelName}, Color: ${scoot.color}, Chassis: ${scoot.chassisNo})`;
      scoot.deliveryChallanNo = '';
      scoot.status = 'available';
      scoot.buyerName = '';
      scoot.buyerContact = '';
      scoot.salesBillNo = '';
      scoot.saleDate = '';
      scoot.holdDate = '';
      scoot.challanStatus = 'pending';
    }
  } else if (itemType === 'battery') {
    const batIdx = (db.batterySales || []).findIndex(s => s.id === itemId);
    if (batIdx !== -1) {
      const sale = db.batterySales[batIdx];
      if (sale.challanStatus === 'finished' && userRole !== 'admin') {
        return res.status(403).json({ error: 'Cannot remove items from a finished & verified challan.' });
      }
      itemDetail = `Battery Pack (${sale.batterySeries}, Qty: ${sale.quantity})`;
      sale.deliveryChallanNo = '';
    }
  } else if (itemType === 'charger') {
    const chgIdx = (db.chargerSales || []).findIndex(s => s.id === itemId);
    if (chgIdx !== -1) {
      const sale = db.chargerSales[chgIdx];
      if (sale.challanStatus === 'finished' && userRole !== 'admin') {
        return res.status(403).json({ error: 'Cannot remove items from a finished & verified challan.' });
      }
      itemDetail = `Charger (${sale.chargerType}, Qty: ${sale.quantity})`;
      sale.deliveryChallanNo = '';
    }
  }

  addAuditLog(db, operator || 'system', operator || 'system', 'challan_remove_item', `Removed item [${itemDetail}] from Delivery Challan #${cleanChallan}.`);
  writeDB(db);
  return res.json({ success: true, message: `Item removed from Delivery Challan #${cleanChallan}.` });
});

app.post('/api/challans/attach-item', validateBody(challanAttachItemSchema), (req, res) => {
  const { deliveryChallanNo, itemType, itemId, operator, userRole, buyerName, buyerContact, salesBillNo } = req.body;
  const db = readDB();
  const cleanChallan = String(deliveryChallanNo).trim().toUpperCase();

  let itemDetail = `${itemType} #${itemId}`;
  if (itemType === 'scooter') {
    const scoot = db.scooterUnits.find(s => s.id === itemId || s.chassisNo === itemId);
    if (!scoot) {
      return res.status(404).json({ error: 'Scooter unit not found.' });
    }
    itemDetail = `Scooter (${scoot.modelName}, Color: ${scoot.color}, Chassis: ${scoot.chassisNo})`;
    scoot.deliveryChallanNo = cleanChallan;
    if (buyerName) scoot.buyerName = buyerName;
    if (buyerContact) scoot.buyerContact = buyerContact;
    if (salesBillNo) scoot.salesBillNo = salesBillNo;
    scoot.status = 'sold';
    if (!scoot.saleDate) scoot.saleDate = new Date().toISOString();
    scoot.challanStatus = 'pending';
  } else if (itemType === 'battery') {
    const batSale = (db.batterySales || []).find(s => s.id === itemId);
    if (batSale) {
      itemDetail = `Battery Pack (${batSale.batterySeries}, Qty: ${batSale.quantity})`;
      batSale.deliveryChallanNo = cleanChallan;
      if (buyerName) batSale.buyerName = buyerName;
      if (buyerContact) batSale.buyerContact = buyerContact;
      if (salesBillNo) batSale.billNo = salesBillNo;
    }
  } else if (itemType === 'charger') {
    const chgSale = (db.chargerSales || []).find(s => s.id === itemId);
    if (chgSale) {
      itemDetail = `Charger (${chgSale.chargerType}, Qty: ${chgSale.quantity})`;
      chgSale.deliveryChallanNo = cleanChallan;
      if (buyerName) chgSale.buyerName = buyerName;
      if (buyerContact) chgSale.buyerContact = buyerContact;
      if (salesBillNo) chgSale.billNo = salesBillNo;
    }
  }

  addAuditLog(db, operator || 'system', operator || 'system', 'challan_attach_item', `Attached item [${itemDetail}] to Delivery Challan #${cleanChallan}.`);
  writeDB(db);
  return res.json({ success: true, message: `Item attached to Delivery Challan #${cleanChallan}.` });
});

app.post('/api/challans/finish', validateBody(challanFinishSchema), (req, res) => {
  const { deliveryChallanNo, operator } = req.body;

  const db = readDB();
  const timestamp = new Date().toISOString();
  const cleanChallan = String(deliveryChallanNo).trim().toUpperCase();

  let count = 0;

  // Mark matching scooters as finished
  db.scooterUnits.forEach(unit => {
    if (unit.deliveryChallanNo && unit.deliveryChallanNo.trim().toUpperCase() === cleanChallan) {
      unit.challanStatus = 'finished';
      unit.challanFinishedBy = operator || 'system';
      unit.challanFinishedTimestamp = timestamp;
      count++;
    }
  });

  // Mark matching battery sales as finished
  if (db.batterySales) {
    db.batterySales.forEach(sale => {
      if (sale.deliveryChallanNo && sale.deliveryChallanNo.trim().toUpperCase() === cleanChallan) {
        sale.challanStatus = 'finished';
        sale.challanFinishedBy = operator || 'system';
        sale.challanFinishedTimestamp = timestamp;
        count++;
      }
    });
  }

  // Mark matching charger sales as finished
  if (db.chargerSales) {
    db.chargerSales.forEach(sale => {
      if (sale.deliveryChallanNo && sale.deliveryChallanNo.trim().toUpperCase() === cleanChallan) {
        sale.challanStatus = 'finished';
        sale.challanFinishedBy = operator || 'system';
        sale.challanFinishedTimestamp = timestamp;
        count++;
      }
    });
  }

  addAuditLog(db, operator || 'system', operator || 'system', 'challan_finish', `Marked Delivery Challan #${cleanChallan} as Finished & Verified (${count} total items verified).`);
  writeDB(db);

  return res.json({ success: true, count, message: `Challan #${cleanChallan} marked as Finished & Verified.` });
});

app.post('/api/challans/update', validateBody(challanUpdateSchema), (req, res) => {
  const { deliveryChallanNo, newChallanNo, buyerName, buyerContact, billNo, operator, userRole } = req.body;

  const db = readDB();
  const cleanChallan = String(deliveryChallanNo).trim().toUpperCase();
  const targetChallanNo = newChallanNo ? String(newChallanNo).trim().toUpperCase() : cleanChallan;

  // Check if challan is already finished and user is not admin
  let isFinished = false;
  db.scooterUnits.forEach(u => {
    if (u.deliveryChallanNo && u.deliveryChallanNo.trim().toUpperCase() === cleanChallan && u.challanStatus === 'finished') {
      isFinished = true;
    }
  });
  if (!isFinished && db.batterySales) {
    db.batterySales.forEach(s => {
      if (s.deliveryChallanNo && s.deliveryChallanNo.trim().toUpperCase() === cleanChallan && s.challanStatus === 'finished') {
        isFinished = true;
      }
    });
  }
  if (!isFinished && db.chargerSales) {
    db.chargerSales.forEach(s => {
      if (s.deliveryChallanNo && s.deliveryChallanNo.trim().toUpperCase() === cleanChallan && s.challanStatus === 'finished') {
        isFinished = true;
      }
    });
  }

  if (isFinished && userRole !== 'admin') {
    return res.status(403).json({ error: 'This Challan is already Finished & Verified. Only Admin/Owner can edit verified finished sales.' });
  }

  // Apply updates to matching scooters, battery sales, charger sales
  db.scooterUnits.forEach(unit => {
    if (unit.deliveryChallanNo && unit.deliveryChallanNo.trim().toUpperCase() === cleanChallan) {
      if (targetChallanNo) unit.deliveryChallanNo = targetChallanNo;
      if (buyerName !== undefined) unit.buyerName = buyerName;
      if (buyerContact !== undefined) unit.buyerContact = buyerContact;
      if (billNo !== undefined) unit.salesBillNo = billNo;
      unit.lastUpdatedBy = operator || 'system';
      unit.lastUpdatedTimestamp = new Date().toISOString();
    }
  });

  if (db.batterySales) {
    db.batterySales.forEach(sale => {
      if (sale.deliveryChallanNo && sale.deliveryChallanNo.trim().toUpperCase() === cleanChallan) {
        if (targetChallanNo) sale.deliveryChallanNo = targetChallanNo;
        if (buyerName !== undefined) sale.buyerName = buyerName;
        if (buyerContact !== undefined) sale.buyerContact = buyerContact;
        if (billNo !== undefined) sale.billNo = billNo;
      }
    });
  }

  if (db.chargerSales) {
    db.chargerSales.forEach(sale => {
      if (sale.deliveryChallanNo && sale.deliveryChallanNo.trim().toUpperCase() === cleanChallan) {
        if (targetChallanNo) sale.deliveryChallanNo = targetChallanNo;
        if (buyerName !== undefined) sale.buyerName = buyerName;
        if (buyerContact !== undefined) sale.buyerContact = buyerContact;
        if (billNo !== undefined) sale.billNo = billNo;
      }
    });
  }

  addAuditLog(db, operator || 'system', operator || 'system', 'challan_update', `Updated details for Delivery Challan #${cleanChallan}.`);
  writeDB(db);

  return res.json({ success: true, message: `Challan updated successfully.` });
});

app.post('/api/challans/delete-entire', validateBody(challanDeleteEntireSchema), (req, res) => {
  const { deliveryChallanNo, operator, userRole } = req.body;
  const db = readDB();
  const cleanChallan = String(deliveryChallanNo).trim().toUpperCase();

  let isFinished = false;
  db.scooterUnits.forEach(u => {
    if (u.deliveryChallanNo && u.deliveryChallanNo.trim().toUpperCase() === cleanChallan && u.challanStatus === 'finished') {
      isFinished = true;
    }
  });
  if (!isFinished && db.batterySales) {
    db.batterySales.forEach(s => {
      if (s.deliveryChallanNo && s.deliveryChallanNo.trim().toUpperCase() === cleanChallan && s.challanStatus === 'finished') {
        isFinished = true;
      }
    });
  }
  if (!isFinished && db.chargerSales) {
    db.chargerSales.forEach(s => {
      if (s.deliveryChallanNo && s.deliveryChallanNo.trim().toUpperCase() === cleanChallan && s.challanStatus === 'finished') {
        isFinished = true;
      }
    });
  }

  if (isFinished && userRole !== 'admin') {
    return res.status(403).json({ error: 'Cannot delete a Finished & Verified Delivery Challan. Only Admin can delete verified sales.' });
  }

  let deletedCount = 0;

  // Reset scooters attached to this challan back to available
  db.scooterUnits.forEach(scoot => {
    if (scoot.deliveryChallanNo && scoot.deliveryChallanNo.trim().toUpperCase() === cleanChallan) {
      scoot.deliveryChallanNo = '';
      scoot.status = 'available';
      scoot.buyerName = '';
      scoot.buyerContact = '';
      scoot.salesBillNo = '';
      scoot.saleDate = '';
      scoot.holdDate = '';
      scoot.challanStatus = 'pending';
      deletedCount++;
    }
  });

  // Remove standalone battery sales associated with this challan
  if (db.batterySales) {
    db.batterySales = db.batterySales.filter(sale => {
      if (sale.deliveryChallanNo && sale.deliveryChallanNo.trim().toUpperCase() === cleanChallan) {
        deletedCount++;
        return false;
      }
      return true;
    });
  }

  // Remove standalone charger sales associated with this challan
  if (db.chargerSales) {
    db.chargerSales = db.chargerSales.filter(sale => {
      if (sale.deliveryChallanNo && sale.deliveryChallanNo.trim().toUpperCase() === cleanChallan) {
        deletedCount++;
        return false;
      }
      return true;
    });
  }

  addAuditLog(db, operator || 'system', operator || 'system', 'challan_delete_entire', `Deleted entire Delivery Challan #${cleanChallan} (${deletedCount} items reset/removed).`);
  writeDB(db);

  return res.json({ success: true, message: `Delivery Challan #${cleanChallan} deleted successfully.` });
});

// Warranty Claims: Get All
app.get('/api/warranty-claims', (req, res) => {
  const db = readDB();
  res.json(db.warrantyClaims || []);
});

// Warranty Claims: Create/Update claim
app.post('/api/warranty-claims', validateBody(warrantyClaimSchema), (req, res) => {
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
    isBattery,
    claimedComponent,
    modelName,
    collectedDate,
    supplierName,
    containerId,
    sourceBillNo,
    stockInNo,
    supplierWarrantyStatus,
    specialistNotes
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
      isBattery: isBattery !== undefined ? Boolean(isBattery) : oldClaim.isBattery,
      specialistNotes: specialistNotes !== undefined ? specialistNotes : oldClaim.specialistNotes,
      // preserve or update other extra fields if passed
      claimedComponent: claimedComponent !== undefined ? claimedComponent : oldClaim.claimedComponent,
      modelName: modelName !== undefined ? modelName : oldClaim.modelName,
      collectedDate: collectedDate !== undefined ? collectedDate : oldClaim.collectedDate,
      supplierName: supplierName !== undefined ? supplierName : oldClaim.supplierName,
      containerId: containerId !== undefined ? containerId : oldClaim.containerId,
      sourceBillNo: sourceBillNo !== undefined ? sourceBillNo : oldClaim.sourceBillNo,
      stockInNo: stockInNo !== undefined ? stockInNo : oldClaim.stockInNo,
      supplierWarrantyStatus: supplierWarrantyStatus !== undefined ? supplierWarrantyStatus : oldClaim.supplierWarrantyStatus
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
      isBattery: isBattery !== undefined ? Boolean(isBattery) : undefined,
      claimedComponent,
      modelName,
      collectedDate,
      supplierName,
      containerId,
      sourceBillNo,
      stockInNo,
      supplierWarrantyStatus,
      specialistNotes
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
app.post('/api/sheet-config/sync-all', validateBody(emptySchema), async (req, res) => {
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
      salesOrders: db.salesOrders || [],
      batterySales: db.batterySales || [],
      batteryImports: db.batteryImports || [],
      chargerSales: db.chargerSales || [],
      chargerImports: db.chargerImports || [],
      warrantyClaims: db.warrantyClaims || [],
      auditLogs: db.auditLogs || [],
      users: (db.users ? Object.values(db.users) : []).map((u: any) => ({
        username: u.username,
        name: u.name,
        role: u.role,
        approved: u.approved
      })),
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
app.post('/api/sheet-config/pull-all', validateBody(emptySchema), async (req, res) => {
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
    if (data.scooterUnits && Array.isArray(data.scooterUnits) && data.scooterUnits.length > 0) {
      db.scooterUnits = data.scooterUnits;
    }
    if (data.stockLogs && Array.isArray(data.stockLogs) && data.stockLogs.length > 0) {
      db.stockLogs = data.stockLogs;
    }
    if (data.batterySales && Array.isArray(data.batterySales) && data.batterySales.length > 0) {
      db.batterySales = data.batterySales;
    }
    if (data.batteryImports && Array.isArray(data.batteryImports) && data.batteryImports.length > 0) {
      db.batteryImports = data.batteryImports;
    }
    if (data.salesOrders && Array.isArray(data.salesOrders) && data.salesOrders.length > 0) {
      db.salesOrders = data.salesOrders;
    }
    if (data.chargerSales && Array.isArray(data.chargerSales) && data.chargerSales.length > 0) {
      db.chargerSales = data.chargerSales;
    }
    if (data.chargerImports && Array.isArray(data.chargerImports) && data.chargerImports.length > 0) {
      db.chargerImports = data.chargerImports;
    }
    if (data.warrantyClaims && Array.isArray(data.warrantyClaims) && data.warrantyClaims.length > 0) {
      db.warrantyClaims = data.warrantyClaims;
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

// --- Sales Orders Management Endpoints ---

function syncSalesOrderBatteryAndChargerSales(db: DBState, order: SalesOrder, operator: string) {
  if (!order || !order.items) return;
  db.batterySales = db.batterySales || [];
  db.chargerSales = db.chargerSales || [];

  if (order.status === 'cancelled') {
    db.batterySales = db.batterySales.filter(s => !s.id.startsWith(`batsale-so-${order.id}-`));
    db.chargerSales = db.chargerSales.filter(s => !s.id.startsWith(`chgsale-so-${order.id}-`));
    return;
  }

  order.items.forEach(it => {
    if (it.itemType === 'battery') {
      const saleId = `batsale-so-${order.id}-${it.id}`;
      const qty = Math.max(1, Number(it.quantity) || (it.serialNumbers?.length) || 1);
      const series = (it.batteryType || it.productName || 'Standard Series').trim();
      const startN = it.startNo || (it.serialNumbers?.[0]) || 'N/A';
      const endN = it.endNo || (it.serialNumbers?.[it.serialNumbers.length - 1]) || 'N/A';

      const existingIdx = db.batterySales.findIndex(s => s.id === saleId || (s.deliveryChallanNo && order.challanNo && s.deliveryChallanNo === order.challanNo && s.batterySeries === series));

      if (existingIdx !== -1) {
        db.batterySales[existingIdx].buyerName = order.buyerName;
        db.batterySales[existingIdx].buyerContact = order.buyerContact;
        db.batterySales[existingIdx].batterySeries = series;
        db.batterySales[existingIdx].quantity = qty;
        db.batterySales[existingIdx].startNo = startN;
        db.batterySales[existingIdx].endNo = endN;
        db.batterySales[existingIdx].billNo = order.salesBillNo || db.batterySales[existingIdx].billNo;
        db.batterySales[existingIdx].deliveryChallanNo = order.challanNo || db.batterySales[existingIdx].deliveryChallanNo;
        db.batterySales[existingIdx].status = order.status === 'pending' ? 'hold' : 'sold';
        if (it.serialNumbers && it.serialNumbers.length > 0) {
          db.batterySales[existingIdx].serialNumbers = it.serialNumbers;
        }
      } else {
        db.batterySales.push({
          id: saleId,
          buyerName: order.buyerName,
          buyerContact: order.buyerContact,
          batterySeries: series,
          startNo: startN,
          endNo: endN,
          quantity: qty,
          saleDate: order.dispatchedTimestamp || order.createdTimestamp || new Date().toISOString(),
          operator: operator || order.salespersonName || 'system',
          notes: `Sales Order #${order.orderNo} (${order.status})`,
          isUnderWarranty: Boolean(it.isUnderWarranty),
          warrantyDurationMonths: Number(it.warrantyMonths) || 12,
          status: order.status === 'pending' ? 'hold' : 'sold',
          billNo: order.salesBillNo,
          deliveryChallanNo: order.challanNo,
          serialNumbers: it.serialNumbers && it.serialNumbers.length > 0 ? it.serialNumbers : undefined
        });
      }
    } else if (it.itemType === 'charger') {
      const saleId = `chgsale-so-${order.id}-${it.id}`;
      const qty = Math.max(1, Number(it.quantity) || (it.serialNumbers?.length) || 1);
      const cType = (it.chargerType || it.productName || 'Standard Charger').trim();
      const startN = it.startNo || (it.serialNumbers?.[0]) || 'N/A';
      const endN = it.endNo || (it.serialNumbers?.[it.serialNumbers.length - 1]) || 'N/A';

      const existingIdx = db.chargerSales.findIndex(s => s.id === saleId || (s.deliveryChallanNo && order.challanNo && s.chargerType === cType));

      if (existingIdx !== -1) {
        db.chargerSales[existingIdx].buyerName = order.buyerName;
        db.chargerSales[existingIdx].buyerContact = order.buyerContact;
        db.chargerSales[existingIdx].chargerType = cType;
        db.chargerSales[existingIdx].quantity = qty;
        db.chargerSales[existingIdx].startNo = startN;
        db.chargerSales[existingIdx].endNo = endN;
        db.chargerSales[existingIdx].billNo = order.salesBillNo || db.chargerSales[existingIdx].billNo;
        db.chargerSales[existingIdx].deliveryChallanNo = order.challanNo || db.chargerSales[existingIdx].deliveryChallanNo;
        db.chargerSales[existingIdx].status = order.status === 'pending' ? 'hold' : 'sold';
        if (it.serialNumbers && it.serialNumbers.length > 0) {
          db.chargerSales[existingIdx].serialNumbers = it.serialNumbers;
        }
      } else {
        db.chargerSales.push({
          id: saleId,
          buyerName: order.buyerName,
          buyerContact: order.buyerContact,
          chargerType: cType,
          startNo: startN,
          endNo: endN,
          quantity: qty,
          saleDate: order.dispatchedTimestamp || order.createdTimestamp || new Date().toISOString(),
          operator: operator || order.salespersonName || 'system',
          notes: `Sales Order #${order.orderNo} (${order.status})`,
          isUnderWarranty: Boolean(it.isUnderWarranty),
          warrantyDurationMonths: Number(it.warrantyMonths) || 6,
          status: order.status === 'pending' ? 'hold' : 'sold',
          billNo: order.salesBillNo,
          deliveryChallanNo: order.challanNo,
          serialNumbers: it.serialNumbers && it.serialNumbers.length > 0 ? it.serialNumbers : undefined
        });
      }
    }
  });
}

// 1. Get all sales orders
app.get('/api/sales-orders', (req, res) => {
  const db = readDB();
  res.json(db.salesOrders || []);
});

// 2. Create a new sales order (Salesman Place Order)
app.post('/api/sales-orders', (req, res) => {
  try {
    const { buyerName, buyerContact, deliveryLocation, salespersonName, salespersonUsername, items, notes } = req.body;

    if (!buyerName || !buyerName.trim()) {
      return res.status(400).json({ error: 'Customer / Buyer Name is required to place an order.' });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Order must contain at least one item.' });
    }

    const db = readDB();
    db.salesOrders = db.salesOrders || [];

    const orderNo = `ORD-${Date.now().toString().slice(-6)}`;
    const newOrder: SalesOrder = {
      id: `so-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      orderNo,
      buyerName: buyerName.trim(),
      buyerContact: buyerContact ? buyerContact.trim() : '',
      deliveryLocation: deliveryLocation ? deliveryLocation.trim() : '',
      salespersonName: salespersonName || 'Sales Representative',
      salespersonUsername: salespersonUsername || 'sales',
      createdTimestamp: new Date().toISOString(),
      items: items.map((it: any) => ({
        id: `soi-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        itemType: it.itemType || 'scooter',
        productName: it.productName,
        color: it.color,
        batteryType: it.batteryType,
        chargerType: it.chargerType,
        quantity: Math.max(1, Number(it.quantity) || 1),
        chassisNumbers: it.chassisNumbers || [],
        serialNumbers: it.serialNumbers || [],
        startNo: it.startNo || '',
        endNo: it.endNo || '',
        isUnderWarranty: Boolean(it.isUnderWarranty),
        warrantyMonths: Number(it.warrantyMonths) || 0
      })),
      status: 'pending',
      notes: notes || ''
    };

    db.salesOrders.unshift(newOrder);

    // Save buyer if not exists
    db.buyers = db.buyers || [];
    if (!db.buyers.some(b => b.name.toLowerCase() === newOrder.buyerName.toLowerCase())) {
      db.buyers.push({
        id: `buyer-${Date.now()}`,
        name: newOrder.buyerName,
        contact: newOrder.buyerContact,
        address: newOrder.deliveryLocation
      });
    }

    syncSalesOrderBatteryAndChargerSales(db, newOrder, salespersonUsername || 'sales');
    addAuditLog(db, salespersonUsername || 'sales', salespersonName || 'Sales Representative', 'order_created', `Placed customer order #${orderNo} for ${newOrder.buyerName} (Delivery: ${newOrder.deliveryLocation || 'N/A'}).`);
    writeDB(db);

    res.status(201).json({ success: true, message: `Order #${orderNo} placed successfully! Forwarded to Dispatch Person.`, order: newOrder });
  } catch (err: any) {
    console.error('Error creating sales order:', err);
    res.status(500).json({ error: 'Failed to create sales order.' });
  }
});

// 2b. Cancel Sales Order (Salesperson who created it or Owner/Admin)
app.put('/api/sales-orders/:id/cancel', (req, res) => {
  try {
    const { id } = req.params;
    const { operator, operatorUsername, operatorRole } = req.body;

    const db = readDB();
    db.salesOrders = db.salesOrders || [];
    const idx = db.salesOrders.findIndex(o => o.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Sales order not found.' });
    }

    const order = db.salesOrders[idx];

    // Authorization check: Must be the salesperson who placed the order OR owner/admin
    const isOwner = operatorRole === 'admin' || operatorRole === 'Admin';
    const isCreator = order.salespersonUsername && operatorUsername && order.salespersonUsername.toLowerCase() === operatorUsername.toLowerCase();

    if (!isOwner && !isCreator) {
      return res.status(403).json({ error: 'Access Denied: Only the Salesperson who created this order or the Owner can cancel it.' });
    }

    if (order.status === 'cancelled') {
      return res.status(400).json({ error: 'Order is already cancelled.' });
    }

    // Revert scooter stock if previously marked sold during dispatch
    if (order.status === 'dispatched' || order.status === 'prepared' || order.status === 'challan_generated') {
      order.items.forEach(it => {
        if (it.itemType === 'scooter' && it.chassisNumbers) {
          it.chassisNumbers.forEach(chassis => {
            const uIdx = db.scooterUnits.findIndex(u => u.chassisNo === chassis);
            if (uIdx !== -1) {
              db.scooterUnits[uIdx].status = 'available';
              db.scooterUnits[uIdx].buyerName = undefined;
              db.scooterUnits[uIdx].buyerContact = undefined;
              db.scooterUnits[uIdx].deliveryChallanNo = undefined;
              db.scooterUnits[uIdx].salesBillNo = undefined;
            }
          });
        }
      });
    }

    order.status = 'cancelled';
    order.cancelledBy = operator || operatorUsername || 'User';
    order.cancelledTimestamp = new Date().toISOString();

    syncSalesOrderBatteryAndChargerSales(db, order, operator || operatorUsername || 'User');
    addAuditLog(db, operatorUsername || 'user', operator || 'User', 'order_cancelled', `Cancelled Sales Order #${order.orderNo} for ${order.buyerName}.`);
    writeDB(db);

    res.json({ success: true, message: `Order #${order.orderNo} has been cancelled successfully.`, order });
  } catch (err: any) {
    console.error('Error cancelling sales order:', err);
    res.status(500).json({ error: 'Failed to cancel sales order.' });
  }
});

// 3. Mark order as prepared (Dispatch Button 1)
app.put('/api/sales-orders/:id/prepare', (req, res) => {
  try {
    const { id } = req.params;
    const { operator, operatorRole } = req.body;

    const db = readDB();
    db.salesOrders = db.salesOrders || [];
    const idx = db.salesOrders.findIndex(o => o.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Sales order not found.' });
    }

    const order = db.salesOrders[idx];
    order.status = 'prepared';
    order.preparedBy = operator || 'dispatcher';
    order.preparedTimestamp = new Date().toISOString();
    
    syncSalesOrderBatteryAndChargerSales(db, order, operator || 'dispatcher');

    addAuditLog(db, operator || 'dispatcher', operator || 'Dispatch Person', 'order_prepared', `Marked order #${order.orderNo} as Prepared.`);
    writeDB(db);

    res.json({ success: true, message: `Order #${order.orderNo} marked as Prepared!`, order });
  } catch (err: any) {
    console.error('Error preparing sales order:', err);
    res.status(500).json({ error: 'Failed to mark order as prepared.' });
  }
});

// 4. Dispatch Order / Loading Complete (Dispatch Button 2)
app.put('/api/sales-orders/:id/dispatch', (req, res) => {
  try {
    const { id } = req.params;
    const { operator, operatorRole, items } = req.body;

    const db = readDB();
    db.salesOrders = db.salesOrders || [];
    const idx = db.salesOrders.findIndex(o => o.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Sales order not found.' });
    }

    const order = db.salesOrders[idx];

    if (items && Array.isArray(items)) {
      order.items = items;
    }

    // Process real-time stock deduction and assignment
    order.items.forEach(it => {
      if (it.itemType === 'scooter' && it.chassisNumbers && it.chassisNumbers.length > 0) {
        it.chassisNumbers.forEach(chassis => {
          const uIdx = db.scooterUnits.findIndex(u => u.chassisNo === chassis);
          if (uIdx !== -1) {
            db.scooterUnits[uIdx].status = 'sold';
            db.scooterUnits[uIdx].buyerName = order.buyerName;
            db.scooterUnits[uIdx].buyerContact = order.buyerContact;
            db.scooterUnits[uIdx].saleDate = new Date().toISOString().split('T')[0];
            db.scooterUnits[uIdx].lastUpdatedBy = operator;
            db.scooterUnits[uIdx].lastUpdatedTimestamp = new Date().toISOString();
          }
        });
      }
    });

    order.status = 'dispatched';
    order.dispatchedBy = operator || 'dispatcher';
    order.dispatchedTimestamp = new Date().toISOString();

    syncSalesOrderBatteryAndChargerSales(db, order, operator || 'dispatcher');
    addAuditLog(db, operator || 'dispatcher', operator || 'Dispatch Person', 'order_dispatched', `Completed loading & dispatched order #${order.orderNo} for ${order.buyerName}.`);
    writeDB(db);

    res.json({ success: true, message: `Order #${order.orderNo} successfully loaded & dispatched! Moved to Manager Challan section.`, order });
  } catch (err: any) {
    console.error('Error dispatching sales order:', err);
    res.status(500).json({ error: 'Failed to dispatch sales order.' });
  }
});

// 5. Manager Challan Verification & Finalize
app.put('/api/sales-orders/:id/verify-challan', (req, res) => {
  try {
    const { id } = req.params;
    const { challanNo, salesBillNo, items, operator, operatorRole } = req.body;

    // MANDATORY CHECK: Never sell without a Challan Number!
    if (!challanNo || !challanNo.trim()) {
      return res.status(400).json({ error: 'Challan Number is required. Never sell without a Challan Number!' });
    }

    const db = readDB();
    db.salesOrders = db.salesOrders || [];
    const idx = db.salesOrders.findIndex(o => o.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Sales order not found.' });
    }

    const order = db.salesOrders[idx];

    // Check if locked and caller is NOT admin (Owner)
    if (order.challanLocked && (operatorRole !== 'admin' && operatorRole !== 'Admin')) {
      return res.status(403).json({ error: 'This document is locked by Manager verification. Only the Owner profile can unlock and edit this order.' });
    }

    // Verify Chassis Numbers against available stock
    const updatedItems = items || order.items;
    for (const it of updatedItems) {
      if (it.itemType === 'scooter' && it.chassisNumbers && Array.isArray(it.chassisNumbers)) {
        for (const chassis of it.chassisNumbers) {
          if (!chassis) continue;
          const u = db.scooterUnits.find(unit => unit.chassisNo === chassis);
          if (!u) {
            return res.status(400).json({ error: `Chassis Number "${chassis}" was not found in system stock!` });
          }
          // Must be available OR already assigned to this buyer / order
          const isBelongsToThisOrder = u.deliveryChallanNo === challanNo.trim().toUpperCase() || u.buyerName === order.buyerName;
          if (u.status !== 'available' && !isBelongsToThisOrder) {
            return res.status(400).json({ error: `Chassis Number "${chassis}" is not available in current stock (Status: ${u.status})!` });
          }
        }
      }
    }

    const cleanChallanNo = challanNo.trim().toUpperCase();
    const cleanBillNo = salesBillNo ? salesBillNo.trim().toUpperCase() : '';

    order.challanNo = cleanChallanNo;
    order.salesBillNo = cleanBillNo;
    order.items = updatedItems;
    order.status = 'challan_generated';
    order.challanFinishedBy = operator || 'manager';
    order.challanFinishedTimestamp = new Date().toISOString();
    order.challanLocked = true; // Lock document for Manager

    // Assign deliveryChallanNo and salesBillNo to matching scooter units
    updatedItems.forEach((it: SalesOrderItem) => {
      if (it.itemType === 'scooter' && it.chassisNumbers) {
        it.chassisNumbers.forEach(chassis => {
          const uIdx = db.scooterUnits.findIndex(u => u.chassisNo === chassis);
          if (uIdx !== -1) {
            db.scooterUnits[uIdx].deliveryChallanNo = cleanChallanNo;
            if (cleanBillNo) db.scooterUnits[uIdx].salesBillNo = cleanBillNo;
            db.scooterUnits[uIdx].challanStatus = 'finished';
            db.scooterUnits[uIdx].challanFinishedBy = operator;
            db.scooterUnits[uIdx].challanFinishedTimestamp = new Date().toISOString();
            db.scooterUnits[uIdx].status = 'sold';
            db.scooterUnits[uIdx].buyerName = order.buyerName;
            db.scooterUnits[uIdx].buyerContact = order.buyerContact;
          }
        });
      }
    });

    syncSalesOrderBatteryAndChargerSales(db, order, operator || 'manager');
    addAuditLog(db, operator || 'manager', operator || 'Manager', 'challan_verified', `Verified and finalized Challan #${cleanChallanNo} for Order #${order.orderNo}. Document is locked.`);
    writeDB(db);

    res.json({ success: true, message: `Challan #${cleanChallanNo} verified and saved successfully! Document is now locked.`, order });
  } catch (err: any) {
    console.error('Error verifying challan:', err);
    res.status(500).json({ error: 'Failed to verify and save challan.' });
  }
});

// 5b. Manager Full Edit & Save Endpoint (Allow editing quantities, items, chassis/serials, challanNo, billNo)
app.put('/api/sales-orders/:id/manager-update', (req, res) => {
  try {
    const { id } = req.params;
    const { 
      buyerName, 
      buyerContact, 
      deliveryLocation, 
      notes, 
      challanNo, 
      salesBillNo, 
      items, 
      finalizeSale, 
      operator, 
      operatorRole 
    } = req.body;

    const db = readDB();
    db.salesOrders = db.salesOrders || [];
    const idx = db.salesOrders.findIndex(o => o.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Sales order not found.' });
    }

    const order = db.salesOrders[idx];

    // Check lock
    if (order.challanLocked && (operatorRole !== 'admin' && operatorRole !== 'Admin')) {
      return res.status(403).json({ error: 'This order is locked after finalization. Only Owner profile can unlock and edit.' });
    }

    // Update details
    if (buyerName !== undefined) order.buyerName = buyerName.trim();
    if (buyerContact !== undefined) order.buyerContact = buyerContact.trim();
    if (deliveryLocation !== undefined) order.deliveryLocation = deliveryLocation.trim();
    if (notes !== undefined) order.notes = notes;

    const cleanChallan = challanNo ? challanNo.trim().toUpperCase() : (order.challanNo || '');
    const cleanBill = salesBillNo ? salesBillNo.trim().toUpperCase() : (order.salesBillNo || '');

    if (cleanChallan) order.challanNo = cleanChallan;
    if (cleanBill) order.salesBillNo = cleanBill;

    // Find old chassis numbers to revert if they are removed
    const oldChassis = [];
    if (order.items) {
      order.items.forEach(it => {
        if (it.itemType === 'scooter' && it.chassisNumbers) {
          oldChassis.push(...it.chassisNumbers.filter(Boolean));
        }
      });
    }

    // Update items if provided
    if (items && Array.isArray(items)) {
      order.items = items.map((it: any) => ({
        id: it.id || `soi-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        itemType: it.itemType || 'scooter',
        productName: it.productName,
        color: it.color,
        batteryType: it.batteryType,
        chargerType: it.chargerType,
        quantity: Math.max(1, Number(it.quantity) || 1),
        chassisNumbers: Array.isArray(it.chassisNumbers) ? it.chassisNumbers.filter(Boolean) : [],
        serialNumbers: Array.isArray(it.serialNumbers) ? it.serialNumbers.filter(Boolean) : [],
        startNo: it.startNo || '',
        endNo: it.endNo || '',
        isUnderWarranty: Boolean(it.isUnderWarranty),
        warrantyMonths: Number(it.warrantyMonths) || 0
      }));
    }

    const newChassis = [];
    if (order.items) {
      order.items.forEach(it => {
        if (it.itemType === 'scooter' && it.chassisNumbers) {
          newChassis.push(...it.chassisNumbers.filter(Boolean));
        }
      });
    }

    // Revert chassis that are no longer in the order
    const removedChassis = oldChassis.filter(c => !newChassis.includes(c));
    removedChassis.forEach(chassis => {
      const uIdx = db.scooterUnits.findIndex(u => u.chassisNo === chassis);
      if (uIdx !== -1) {
        db.scooterUnits[uIdx].status = 'available';
        db.scooterUnits[uIdx].buyerName = '';
        db.scooterUnits[uIdx].buyerContact = '';
        db.scooterUnits[uIdx].deliveryChallanNo = undefined;
        db.scooterUnits[uIdx].salesBillNo = undefined;
        db.scooterUnits[uIdx].challanStatus = undefined;
        db.scooterUnits[uIdx].saleDate = undefined;
      }
    });

    // If finalization requested or both challan and bill numbers are being set
    if (finalizeSale) {
      if (!cleanChallan || !cleanChallan.trim()) {
        return res.status(400).json({ error: 'Challan Number is required to finalize sale. Never sell without a Challan Number!' });
      }
      if (!cleanBill || !cleanBill.trim()) {
        return res.status(400).json({ error: 'Bill / Invoice Number is required to finalize sale.' });
      }

      order.status = 'challan_generated';
      order.challanFinishedBy = operator || 'manager';
      order.challanFinishedTimestamp = new Date().toISOString();
      order.challanLocked = true; // Lock document for Manager
    }

    // Sync underlying Scooter Units
    order.items.forEach((it: SalesOrderItem) => {
      if (it.itemType === 'scooter' && it.chassisNumbers) {
        it.chassisNumbers.forEach(chassis => {
          if (!chassis) return;
          let uIdx = db.scooterUnits.findIndex(u => u.chassisNo === chassis);
          if (uIdx !== -1) {
            if (cleanChallan) db.scooterUnits[uIdx].deliveryChallanNo = cleanChallan;
            if (cleanBill) db.scooterUnits[uIdx].salesBillNo = cleanBill;
            db.scooterUnits[uIdx].buyerName = order.buyerName;
            db.scooterUnits[uIdx].buyerContact = order.buyerContact;
            if (order.status === 'challan_generated') {
              db.scooterUnits[uIdx].status = 'sold';
              db.scooterUnits[uIdx].challanStatus = 'finished';
              db.scooterUnits[uIdx].challanFinishedBy = operator;
              db.scooterUnits[uIdx].challanFinishedTimestamp = new Date().toISOString();
            }
          }
        });
      }
    });

    syncSalesOrderBatteryAndChargerSales(db, order, operator || 'manager');
    addAuditLog(db, operator || 'manager', operator || 'Manager', 'order_manager_updated', `Manager updated Order #${order.orderNo} for ${order.buyerName} (Challan: ${cleanChallan || 'Pending'}, Bill: ${cleanBill || 'Pending'}, Status: ${order.status}).`);
    writeDB(db);

    res.json({ success: true, message: `Order #${order.orderNo} updated successfully!`, order });
  } catch (err: any) {
    console.error('Error updating sales order:', err);
    res.status(500).json({ error: 'Failed to update sales order.' });
  }
});

// 6. Owner Final Override Unlock
app.put('/api/sales-orders/:id/unlock', (req, res) => {
  try {
    const { id } = req.params;
    const { operator, operatorRole } = req.body;

    if (operatorRole !== 'admin' && operatorRole !== 'Admin') {
      return res.status(403).json({ error: 'Access Denied: Only the Owner profile has authority to unlock a finished Challan!' });
    }

    const db = readDB();
    db.salesOrders = db.salesOrders || [];
    const idx = db.salesOrders.findIndex(o => o.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Sales order not found.' });
    }

    const order = db.salesOrders[idx];
    order.challanLocked = false;

    addAuditLog(db, operator || 'admin', operator || 'Owner / Admin', 'challan_unlocked', `Owner unlocked finished Challan #${order.challanNo || order.orderNo} for editing.`);
    writeDB(db);

    res.json({ success: true, message: `Challan / Order #${order.orderNo} unlocked for editing by Owner.`, order });
  } catch (err: any) {
    console.error('Error unlocking sales order:', err);
    res.status(500).json({ error: 'Failed to unlock sales order.' });
  }
});

// --- 14-DAY AUTOMATED ROLLING BACKUP API ENDPOINTS ---

// 1. GET /api/backups - List all available backups from the last 14 days
app.get('/api/backups', (req, res) => {
  try {
    cleanupOldBackups();
    if (!fs.existsSync(BACKUP_DIR)) {
      return res.json([]);
    }
    const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.json'));
    const list = files.map(file => {
      const filePath = path.join(BACKUP_DIR, file);
      const stats = fs.statSync(filePath);
      let meta: any = {};
      let counts: any = {};
      try {
        const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        meta = content._backupMetadata || {};
        counts = {
          scooterUnits: content.scooterUnits?.length || 0,
          salesOrders: content.salesOrders?.length || 0,
          buyers: content.buyers?.length || 0,
          products: content.products?.length || 0,
          warrantyClaims: content.warrantyClaims?.length || 0,
          batterySales: content.batterySales?.length || 0,
          chargerSales: content.chargerSales?.length || 0,
          stockLogs: content.stockLogs?.length || 0
        };
      } catch (e) {
        console.warn(`Could not parse metadata for backup file ${file}`);
      }

      const createdTime = meta.createdTimestamp || stats.mtime.toISOString();
      const ageDays = (Date.now() - new Date(createdTime).getTime()) / (1000 * 60 * 60 * 24);
      const expiresDays = Math.max(0, 14 - ageDays);

      return {
        filename: file,
        createdTimestamp: createdTime,
        sizeBytes: stats.size,
        isAuto: file.includes('-auto-') || meta.isAuto === true,
        label: meta.customLabel || (file.includes('-auto-') ? 'Automated Daily Snapshot' : 'Manual User Snapshot'),
        ageDays: Number(ageDays.toFixed(2)),
        expiresDays: Number(expiresDays.toFixed(1)),
        counts
      };
    });

    // Sort newest first
    list.sort((a, b) => new Date(b.createdTimestamp).getTime() - new Date(a.createdTimestamp).getTime());

    res.json(list);
  } catch (err: any) {
    console.error('Error fetching backups list:', err);
    res.status(500).json({ error: 'Failed to retrieve backups list.' });
  }
});


// 2. POST /api/backups/create - Create an instant manual snapshot right now
app.post('/api/backups/create', (req, res) => {
  try {
    const { operator, label } = req.body || {};
    const db = readDB();
    const result = createBackupSnapshot(db, false, label || 'Manual User Snapshot');
    addAuditLog(db, operator || 'user', operator || 'User', 'backup_created', `Created manual system backup snapshot: ${result.filename}`);
    writeDB(db);
    
    // Auto-sync to Drive if configured
    if (db.driveConfig?.autoSync && db.driveConfig?.refreshToken) {
      const backupPath = path.join(process.cwd(), 'backups', result.filename);
      const stats = fs.statSync(backupPath);
      const backupItem = {
        filename: result.filename,
        createdTimestamp: new Date().toISOString(),
        sizeBytes: stats.size,
        isAuto: false,
        label: label || 'Manual User Snapshot',
        counts: { scooterUnits: db.scooterUnits?.length || 0, salesOrders: db.salesOrders?.length || 0, buyers: db.buyers?.length || 0, products: db.products?.length || 0, warrantyClaims: db.warrantyClaims?.length || 0, batterySales: db.batterySales?.length || 0, chargerSales: db.chargerSales?.length || 0, stockLogs: db.stockLogs?.length || 0 }
      };
      // actually call uploadToDrive
      uploadToDrive(db, backupItem, backupPath).catch(err => console.error("Drive upload failed in create backup endpoint", err));
    }
    
    res.json({ success: true, message: 'Backup snapshot created successfully!', filename: result.filename });
  } catch (err: any) {

    console.error('Error creating backup:', err);
    res.status(500).json({ error: 'Failed to create backup snapshot.' });
  }
});

// 3. POST /api/backups/restore - Restore data from a specific snapshot file on the server
app.post('/api/backups/restore', (req, res) => {
  try {
    const { filename, operator } = req.body;
    if (!filename) {
      return res.status(400).json({ error: 'Filename is required for restore.' });
    }

    const safeFilename = path.basename(filename);
    const filePath = path.join(BACKUP_DIR, safeFilename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Backup snapshot file not found on server.' });
    }

    const currentDb = readDB();
    // Safety copy of current state before overwrite
    createBackupSnapshot(currentDb, false, 'Pre-Restore-Safety-Copy');

    const fileContent = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    delete fileContent._backupMetadata;

    if (!fileContent.users || !fileContent.products) {
      return res.status(400).json({ error: 'Invalid backup file structure.' });
    }

    globalDBState = fileContent as DBState;
    addAuditLog(globalDBState, operator || 'admin', operator || 'Owner / Admin', 'backup_restored', `Restored entire system database from snapshot: ${safeFilename}`);
    writeDB(globalDBState);

    if (firebaseDb) {
      seedFirestore(globalDBState).catch(e => console.error('Error re-seeding Firestore after restore:', e));
    }

    res.json({ success: true, message: `Database successfully restored from ${safeFilename}!` });
  } catch (err: any) {
    console.error('Error restoring backup:', err);
    res.status(500).json({ error: 'Failed to restore database from backup.' });
  }
});

// 4. GET /api/backups/download/:filename - Download offline backup file to local machine
app.get('/api/backups/download/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const safeFilename = path.basename(filename);
    const filePath = path.join(BACKUP_DIR, safeFilename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).send('Backup file not found.');
    }

    res.download(filePath, safeFilename);
  } catch (err: any) {
    console.error('Error downloading backup file:', err);
    res.status(500).send('Error downloading backup file.');
  }
});

// 5. POST /api/backups/upload-restore - Restore database from an uploaded JSON file payload
app.post('/api/backups/upload-restore', (req, res) => {
  try {
    const { backupData, operator } = req.body;
    if (!backupData || typeof backupData !== 'object') {
      return res.status(400).json({ error: 'Invalid or missing backup JSON payload.' });
    }

    const cleanData = { ...backupData };
    delete cleanData._backupMetadata;

    if (!cleanData.users || !cleanData.products) {
      return res.status(400).json({ error: 'Invalid backup file structure. Missing required collections.' });
    }

    const currentDb = readDB();
    createBackupSnapshot(currentDb, false, 'Pre-Offline-Import-Safety');

    globalDBState = cleanData as DBState;
    addAuditLog(globalDBState, operator || 'admin', operator || 'Owner / Admin', 'backup_offline_imported', `Imported offline JSON file backup.`);
    writeDB(globalDBState);

    if (firebaseDb) {
      seedFirestore(globalDBState).catch(e => console.error('Error re-seeding Firestore after offline import:', e));
    }

    res.json({ success: true, message: 'Offline JSON backup file successfully imported & database recovered!' });
  } catch (err: any) {
    console.error('Error uploading/restoring backup:', err);
    res.status(500).json({ error: 'Failed to restore from offline backup payload.' });
  }
});

// --- LOCAL BACKUP & DISASTER RECOVERY SYSTEM ---
app.get('/api/gdrive/status', (req, res) => {
  res.json({ connected: false, disabled: true });
});

// Vite Middleware & Static Serving setup
async function startServer() {
  // Initialize local DB cache synchronously first so server is instantly ready
  globalDBState = readDBFromFile();


// ==========================================
// GOOGLE DRIVE CLOUD BACKUP ROUTES
// ==========================================

const getDriveAuth = (db) => {
  const config = db.driveConfig || {};
  return new google.auth.OAuth2(
    config.clientId,
    config.clientSecret,
    (process.env.APP_URL || 'http://localhost:3000') + '/api/drive/callback'
  );
};

app.get('/api/drive-config', (req, res) => {
  const db = readDB();
  const config = db.driveConfig || { clientId: '', clientSecret: '', refreshToken: '', connectedEmail: '', autoSync: false, folderId: '' };
  res.json({
    clientId: config.clientId,
    connectedEmail: config.connectedEmail,
    autoSync: config.autoSync
  });
});

app.post('/api/drive-config', (req, res) => {
  const db = readDB();
  const { clientId, clientSecret, autoSync } = req.body;
  if (!db.driveConfig) db.driveConfig = { clientId: '', clientSecret: '', refreshToken: '', connectedEmail: '', autoSync: false, folderId: '' };
  
  if (clientId !== undefined) db.driveConfig.clientId = clientId.trim();
  if (clientSecret !== undefined) db.driveConfig.clientSecret = clientSecret.trim();
  if (autoSync !== undefined) db.driveConfig.autoSync = !!autoSync;
  
  writeDB(db);
  res.json({ success: true });
});

app.get('/api/drive/auth-url', (req, res) => {
  const db = readDB();
  if (!db.driveConfig?.clientId || !db.driveConfig?.clientSecret) {
    return res.status(400).json({ error: 'Please configure Google OAuth Client ID and Secret first.' });
  }
  const oauth2Client = getDriveAuth(db);
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent select_account',
    scope: ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/userinfo.email']
  });
  res.json({ url });
});

app.get('/api/drive/callback', async (req, res) => {
  const { code } = req.query;
  const db = readDB();
  try {
    const oauth2Client = getDriveAuth(db);
    const { tokens } = await oauth2Client.getToken(code as string);
    oauth2Client.setCredentials(tokens);
    
    const oauth2 = google.oauth2({ auth: oauth2Client, version: 'v2' });
    const userInfo = await oauth2.userinfo.get();
    
    if (!db.driveConfig) db.driveConfig = { clientId: '', clientSecret: '', refreshToken: '', connectedEmail: '', autoSync: false, folderId: '' };
    db.driveConfig.refreshToken = tokens.refresh_token || db.driveConfig.refreshToken;
    db.driveConfig.connectedEmail = userInfo.data.email || 'Unknown Email';
    
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    const q = "mimeType='application/vnd.google-apps.folder' and name='Inventory_Database_Backups' and trashed=false";
    const { data: { files } } = await drive.files.list({ q, fields: 'files(id, name)' });
    
    if (files && files.length > 0) {
      db.driveConfig.folderId = files[0].id;
    } else {
      const folderMetadata = { name: 'Inventory_Database_Backups', mimeType: 'application/vnd.google-apps.folder' };
      const folder = await drive.files.create({ requestBody: folderMetadata, fields: 'id' });
      db.driveConfig.folderId = folder.data.id;
    }
    
    writeDB(db);
    res.redirect('/');
  } catch (error) {
    console.error('OAuth Callback Error:', error);
    res.redirect('/?error=AuthenticationFailed');
  }
});

app.post('/api/drive/disconnect', (req, res) => {
  const db = readDB();
  if (db.driveConfig) {
    db.driveConfig.refreshToken = '';
    db.driveConfig.connectedEmail = '';
    writeDB(db);
  }
  res.json({ success: true });
});

async function uploadToDrive(db: any, backupItem: any, filePath: string) {
  if (!db.driveConfig?.refreshToken) {
    console.warn('[Drive Upload] Aborted: No refresh token.');
    return false;
  }
  if (!db.driveConfig?.folderId) {
    console.warn('[Drive Upload] Aborted: No destination folderId set in driveConfig. The user must select a folder in the Settings UI.');
    return false;
  }
  
  try {
    const oauth2Client = getDriveAuth(db);
    oauth2Client.setCredentials({ refresh_token: db.driveConfig.refreshToken });
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    const fileMetadata = { name: backupItem.filename, parents: [db.driveConfig.folderId] };
    const media = { mimeType: 'application/json', body: fs.createReadStream(filePath) };
    
    await drive.files.create({ requestBody: fileMetadata, media: media, fields: 'id' });
    return true;
  } catch (error) {
    console.error('[Drive Upload Error]:', error);
    return false;
  }
}

// Modify existing create backup to hook into uploadToDrive if autoSync is enabled
app.post('/api/backups/drive/sync', async (req, res) => {
  const db = readDB();
  if (!db.driveConfig?.refreshToken) return res.status(400).json({ error: 'Google Drive is not connected.' });
  
  const timestamp = new Date();
  const safeDateString = timestamp.toISOString().replace(/[:.]/g, '-');
  const filename = `backup-manual-${safeDateString}.json`;
  const backupPath = path.join(process.cwd(), 'backups', filename);
  
  if (!fs.existsSync(path.join(process.cwd(), 'backups'))) fs.mkdirSync(path.join(process.cwd(), 'backups'), { recursive: true });
  fs.writeFileSync(backupPath, JSON.stringify(db, null, 2), 'utf8');
  
  const stats = fs.statSync(backupPath);
  const backupItem = {
    filename,
    createdTimestamp: timestamp.toISOString(),
    sizeBytes: stats.size,
    isAuto: false,
    label: 'Manual Drive Sync',
    counts: { scooterUnits: db.scooterUnits?.length || 0, salesOrders: db.salesOrders?.length || 0, buyers: db.buyers?.length || 0, products: db.products?.length || 0, warrantyClaims: db.warrantyClaims?.length || 0, batterySales: db.batterySales?.length || 0, chargerSales: db.chargerSales?.length || 0, stockLogs: db.stockLogs?.length || 0 }
  };
  
  const success = await uploadToDrive(db, backupItem, backupPath);
  if (success) {
    res.json({ success: true, message: 'Snapshot created and synced to Google Drive.' });
  } else {
    res.status(500).json({ error: 'Failed to upload to Google Drive.' });
  }
});

app.get('/api/backups/drive/list', async (req, res) => {
  const db = readDB();
  if (!db.driveConfig?.refreshToken || !db.driveConfig?.folderId) return res.status(400).json({ error: 'Google Drive is not connected.' });
  
  try {
    const oauth2Client = getDriveAuth(db);
    oauth2Client.setCredentials({ refresh_token: db.driveConfig.refreshToken });
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    const response = await drive.files.list({
      q: `'${db.driveConfig.folderId}' in parents and trashed=false`,
      fields: 'files(id, name, createdTime, size, webViewLink)',
      orderBy: 'createdTime desc'
    });
    
    res.json({ files: response.data.files });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/backups/drive/restore', async (req, res) => {
  const { fileId } = req.body;
  const db = readDB();
  
  if (!db.driveConfig?.refreshToken) return res.status(400).json({ error: 'Google Drive is not connected.' });
  
  try {
    const oauth2Client = getDriveAuth(db);
    oauth2Client.setCredentials({ refresh_token: db.driveConfig.refreshToken });
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    const timestamp = new Date();
    const safeDateString = timestamp.toISOString().replace(/[:.]/g, '-');
    const safetyFilename = `backup-safety-pre-restore-${safeDateString}.json`;
    const safetyPath = path.join(process.cwd(), 'backups', safetyFilename);
    if (!fs.existsSync(path.join(process.cwd(), 'backups'))) fs.mkdirSync(path.join(process.cwd(), 'backups'), { recursive: true });
    fs.writeFileSync(safetyPath, JSON.stringify(db, null, 2), 'utf8');
    
    const response = await drive.files.get({ fileId: fileId, alt: 'media' }, { responseType: 'stream' });
    
    let dbData = '';
    response.data.on('data', chunk => dbData += chunk);
    response.data.on('end', () => {
      try {
        const parsed = JSON.parse(dbData);
        parsed.driveConfig = db.driveConfig;
        parsed.sheetConfig = db.sheetConfig;
        writeDB(parsed);
        res.json({ success: true, message: 'Database successfully restored from Google Drive.' });
      } catch (e) {
        res.status(500).json({ error: 'Downloaded file was not valid JSON.' });
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

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

  // Hydrate from cloud Firestore asynchronously with 2-second timeout so it never delays server start
  if (firebaseDb) {
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000));
    Promise.race([hydrateFromFirestore(), timeoutPromise])
      .then((firestoreState) => {
        if (firestoreState) {
          globalDBState = firestoreState;
          console.log('Successfully loaded single source of truth from Firestore database!');
        }
      })
      .catch((err) => {
        console.warn('Firestore hydration failed or timed out, continuing with local cache:', err?.message || err);
      });
  }

  const dbOnBoot = readDB();
  const startupSheetUrl = process.env.GOOGLE_SHEET_WEBHOOK_URL || dbOnBoot.sheetConfig.webhookUrl;
  if (startupSheetUrl && (process.env.GOOGLE_SHEET_WEBHOOK_URL || dbOnBoot.sheetConfig.enabled)) {
    console.log('Detected Google Sheets URL on startup. Hydrating database from Sheets...');
    pullFromGoogleSheets(startupSheetUrl).then(data => {
      if (data) {
        const db = readDB();
        if (data.products && Array.isArray(data.products) && data.products.length > 0) db.products = data.products;
        if (data.buyers && Array.isArray(data.buyers) && data.buyers.length > 0) db.buyers = data.buyers;
        if (data.scooterUnits && Array.isArray(data.scooterUnits) && data.scooterUnits.length > 0) db.scooterUnits = data.scooterUnits;
        if (data.stockLogs && Array.isArray(data.stockLogs) && data.stockLogs.length > 0) db.stockLogs = data.stockLogs;
        
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
}

async function cleanupDriveBackups(db: any) {
  if (!db.driveConfig?.refreshToken || !db.driveConfig?.folderId) return;
  try {
    const oauth2Client = getDriveAuth(db);
    oauth2Client.setCredentials({ refresh_token: db.driveConfig.refreshToken });
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    const q = `'${db.driveConfig.folderId}' in parents and trashed=false`;
    const response = await drive.files.list({ q, fields: 'files(id, name, createdTime)' });
    const files = response.data.files;
    if (!files || files.length === 0) return;
    
    const now = Date.now();
    const RETENTION_MS = 14 * 24 * 60 * 60 * 1000;
    
    for (const file of files) {
      if (file.createdTime) {
        const fileTime = new Date(file.createdTime).getTime();
        if (now - fileTime > RETENTION_MS) {
          console.log(`[Drive Retention] Auto-purging Drive backup older than 14 days: ${file.name}`);
          await drive.files.delete({ fileId: file.id as string });
        }
      }
    }
  } catch (err) {
    console.error('[Drive Retention] Error cleaning up old Drive backups:', err);
  }
}

app.all('/api/backups/drive/webhook-cron', async (req, res) => {
  console.log(`[Cron Webhook] External trigger received for Google Drive backup.`);
  try {
    const db = readDB();
    if (db.driveConfig?.autoSync && db.driveConfig?.refreshToken) {
       if (!db.driveConfig?.folderId) {
          console.warn('[Cron Webhook] Missing Google Drive folder ID.');
          return res.status(200).json({ success: false, message: 'Google Drive connected, but no destination folder is set. Please go to Settings in the app and select a backup folder.' });
       }
       
       // createBackupSnapshot is synchronous but returns an upload promise we must await
       const result = createBackupSnapshot(db, true, 'Auto-Webhook-Snapshot');
       
       if (result.uploadPromise) {
           const uploadSuccess = await result.uploadPromise;
           if (!uploadSuccess) {
               return res.status(200).json({ success: false, message: 'Backup file created, but upload to Google Drive failed. Check server logs.' });
           }
       }
       
       // Clean up old drive backups
       await cleanupDriveBackups(db);
       return res.json({ success: true, message: 'Cron backup completed successfully and uploaded to Google Drive.' });
    } else {
       // Return 200 OK instead of 400 so external cron services don't mark the job as failed
       return res.status(200).json({ success: true, message: 'Drive auto-sync is currently disabled or not configured. Backup skipped.' });
    }
  } catch (err) {
    console.error('[Cron Webhook] Error running webhook background backup:', err);
    return res.status(500).json({ error: 'Internal server error during backup.' });
  }
});

// Internal setInterval removed to save Render server costs.
// Use an external free service (like cron-job.org) to ping /api/backups/drive/webhook-cron daily.
startServer();
