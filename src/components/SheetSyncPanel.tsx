import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Cloud, HelpCircle, Code, Check, Save, Play, ExternalLink, Info } from 'lucide-react';
import { SheetConfig } from '../types';

interface SheetSyncPanelProps {
  sheetConfig: SheetConfig;
  onSaveConfig: (url: string, enabled: boolean) => Promise<boolean>;
  onTriggerSyncAll: () => Promise<{ success: boolean; message?: string; error?: string }>;
  onTriggerPullAll?: () => Promise<{ success: boolean; message?: string; error?: string }>;
}

export default function SheetSyncPanel({ sheetConfig, onSaveConfig, onTriggerSyncAll, onTriggerPullAll }: SheetSyncPanelProps) {
  const [webhookUrl, setWebhookUrl] = useState(sheetConfig.webhookUrl);
  const [enabled, setEnabled] = useState(sheetConfig.enabled);
  const [loading, setLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [pullLoading, setPullLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);

  // The updated, bullet-proof Google Apps Script code to copy paste matching our 5-stage registry schema
  const appsScriptCode = `/**
 * Google Apps Script for Executive Warehouse Registry, Sales & Employee Performance Sync
 * 
 * DESIGN CONCEPTS:
 * - Designed for Warehouse Owners, Managers, and Operations Directors.
 * - Cohesive professional slate/indigo palette, clean typography, custom row heights, and auto-resizable layouts.
 * - Automated native Data Filters on every single tab for instant sorting and filtering.
 * - Comprehensive Owner Reports:
 *     1. "SalesPerformance" ("Who Sold How Much" - Breakdown per Salesperson)
 *     2. "EmployeePerformance" ("Worker Productivity & Operations" - Assemblies, Dispatches & Logs per Worker)
 *     3. "SalesOrders" (Complete Customer Orders Ledger)
 *     4. "ScooterUnits" (Full Chassis / Motor / Controller / Battery / Warranty Serial Ledger)
 *     5. "StockLogs", "BatterySales", "BatteryImports", "ChargerSales", "ChargerImports", "WarrantyClaims", "AuditLogs"
 * 
 * Instructions:
 * 1. Open your Google Sheet.
 * 2. Click "Extensions" > "Apps Script".
 * 3. Delete any default code and paste this entire script.
 * 4. Click "Deploy" > "New deployment".
 * 5. Select "Web app" as deployment type.
 * 6. Set "Execute as" to "Me (your email)".
 * 7. Set "Who has access" to "Anyone".
 * 8. Click "Deploy", approve permissions, and COPY the Web App URL!
 * 9. Paste that Web App URL into the Senzo Control Panel.
 */

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var action = payload.action;
    var data = payload.data;
    
    var doc = SpreadsheetApp.getActiveSpreadsheet();
    
    // Create tabs if they do not exist (with human-readable proper headers)
    getOrCreateSheet(doc, "SalesOrders", ["Order No", "Buyer Name", "Buyer Contact", "Salesperson Name", "Salesperson Username", "Status", "Delivery Location", "Challan No", "Bill No", "Items Summary", "Created Date", "Dispatched Date", "Notes"]);
    getOrCreateSheet(doc, "SalesPerformance", ["Salesperson Name", "Username", "Orders Placed", "Scooters Sold", "Battery Packs Sold", "Chargers Sold", "Total Items Sold", "Latest Sale Date"]);
    getOrCreateSheet(doc, "EmployeePerformance", ["Worker / Operator Name", "System Username", "Stage 1 Assemblies", "Stage 2 Customizations", "Dispatches Handled", "Battery/Charger Ops", "Warranty Claims", "Total Audit Actions", "Total Work Output", "Last Active Date"]);
    getOrCreateSheet(doc, "ScooterUnits", ["Scooter ID", "Model Name", "Color", "Chassis No", "Motor No", "Controller No", "Front Tire", "Rear Tire", "Buyer Name", "Buyer Contact", "Bill No", "Challan No", "Battery Serials", "Status", "Scooter Warranty", "Battery Warranty", "Assembly Worker", "Last Updated By", "Last Updated"]);
    getOrCreateSheet(doc, "StockLogs", ["Log ID", "Model Name", "Color", "Type (IN/OUT)", "Source Channel", "Quantity", "Buyer", "Bill No", "Challan No", "Timestamp", "Operator / Worker", "Notes"]);
    getOrCreateSheet(doc, "BatterySales", ["Sale ID", "Buyer Name", "Buyer Contact", "Battery Series", "Start Serial No", "End Serial No", "Quantity", "Status", "Bill No", "Challan No", "Sale Date", "Operator / Worker", "Warranty Months", "Held For", "Notes"]);
    getOrCreateSheet(doc, "BatteryImports", ["Import ID", "Battery Series", "Start Serial No", "End Serial No", "Quantity", "Import Date", "Operator / Worker", "Supplier Name", "Container ID", "Notes"]);
    getOrCreateSheet(doc, "ChargerSales", ["Sale ID", "Buyer Name", "Charger Type", "Start Serial No", "End Serial No", "Quantity", "Status", "Bill No", "Challan No", "Sale Date", "Operator / Worker", "Notes"]);
    getOrCreateSheet(doc, "ChargerImports", ["Import ID", "Charger Type", "Start Serial No", "End Serial No", "Quantity", "Import Date", "Operator / Worker", "Supplier Name", "Notes"]);
    getOrCreateSheet(doc, "WarrantyClaims", ["Claim ID", "Buyer Name", "Buyer Contact", "Component / Serial", "Issue Description", "Status", "Action Taken", "Replacement Serial", "Claim Date", "Processed By", "Notes"]);
    getOrCreateSheet(doc, "AuditLogs", ["Log ID", "Action", "Timestamp", "Username", "Operator Name", "Role", "Details"]);
    getOrCreateSheet(doc, "Buyers", ["Buyer ID", "Buyer Name", "Contact Details", "Address", "GST No", "Buyer Type"]);
    getOrCreateSheet(doc, "Products", ["Product ID", "Model Name", "Available Colors"]);
    
    if (action === "log_stock") {
      var sheet = doc.getSheetByName("StockLogs");
      sheet.appendRow([data.id, data.modelName, data.color, (data.type || "").toUpperCase(), data.sourceChannel || "", data.quantity, data.buyerName || "", data.billNo || "", data.deliveryChallanNo || "", data.timestamp, data.operator, data.notes || ""]);
      applyProfessionalFormatting(sheet, true, 4);
    } 
    else if (action === "create_scooter" || action === "update_scooter") {
      updateOrAddScooter(doc, data);
    }
    else if (action === "add_product") {
      var sheet = doc.getSheetByName("Products");
      sheet.appendRow([data.id, data.name, (data.colors || []).join(", ")]);
      applyProfessionalFormatting(sheet, true, 0);
    }
    else if (action === "add_buyer") {
      var sheet = doc.getSheetByName("Buyers");
      sheet.appendRow([data.id, data.name, data.contact || "", data.address || "", data.gstNo || "", data.buyerType || ""]);
      applyProfessionalFormatting(sheet, true, 0);
    }
    else if (action === "sync_all") {
      syncAllData(doc, data);
    }
    
    // Automatically rebuild the executive control panel dashboard and owner performance sheets
    rebuildExecutiveDashboard(doc, data);
    
    return ContentService.createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    var doc = SpreadsheetApp.getActiveSpreadsheet();
    var synonymsMap = {
      id: ["id", "scooter id", "log id", "sale id", "import id", "product id", "buyer id", "claim id"],
      name: ["name", "model name", "buyer name", "product name"],
      colors: ["colors", "available colors"],
      contact: ["contact", "buyer contact", "contact details", "phone"],
      modelName: ["model", "model name"],
      color: ["color"],
      chassisNo: ["chassis no", "chassis number", "chassisno"],
      motorNo: ["motor no", "motor number", "motorno"],
      controllerNo: ["controller no", "controller number", "controllerno"],
      frontTireSize: ["front tire", "front tire size"],
      rearTireSize: ["rear tire", "rear tire size", "tires"],
      buyerName: ["buyer name", "buyer"],
      buyerContact: ["buyer contact", "contact"],
      batterySerials: ["battery serials", "battery serial"],
      status: ["status"],
      scooterWarrantyStatus: ["scooter warranty", "scooter warranty status"],
      batteryWarrantyStatus: ["battery warranty", "battery warranty status"],
      lastUpdatedTimestamp: ["last updated", "lastupdated"],
      createdOperator: ["created by", "assembly worker", "operator"],
      lastUpdatedBy: ["last updated by", "updated by"],
      type: ["type", "type (in/out)"],
      sourceChannel: ["source channel", "sourcechannel"],
      quantity: ["quantity", "qty"],
      timestamp: ["timestamp", "date", "created date"],
      operator: ["operator", "operator / worker", "user", "processed by"],
      notes: ["notes", "note"],
      billNo: ["bill no", "sales bill no", "bill"],
      deliveryChallanNo: ["challan no", "delivery challan no", "challan"]
    };

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      data: {
        products: getSheetDataAsJson(doc, "Products", ["id", "name", "colors"], synonymsMap),
        buyers: getSheetDataAsJson(doc, "Buyers", ["id", "name", "contact"], synonymsMap),
        scooterUnits: getSheetDataAsJson(doc, "ScooterUnits", [
          "id", "modelName", "color", "chassisNo", "motorNo", "controllerNo", 
          "frontTireSize", "rearTireSize", "buyerName", "buyerContact", "billNo", "deliveryChallanNo", "batterySerials", 
          "status", "scooterWarrantyStatus", "batteryWarrantyStatus", "createdOperator", "lastUpdatedBy", "lastUpdatedTimestamp"
        ], synonymsMap),
        stockLogs: getSheetDataAsJson(doc, "StockLogs", [
          "id", "modelName", "color", "type", "sourceChannel", "quantity", "buyerName", "billNo", "deliveryChallanNo", "timestamp", "operator", "notes"
        ], synonymsMap),
        salesOrders: getSheetDataAsJson(doc, "SalesOrders", [
          "orderNo", "buyerName", "buyerContact", "salespersonName", "salespersonUsername", "status", "deliveryLocation", "challanNo", "salesBillNo", "notes", "createdTimestamp", "dispatchedTimestamp"
        ], synonymsMap),
        batterySales: getSheetDataAsJson(doc, "BatterySales", [
          "id", "buyerName", "buyerContact", "batterySeries", "startNo", "endNo", "quantity", "status", "billNo", "deliveryChallanNo", "saleDate", "operator", "warrantyDurationMonths", "heldFor", "notes"
        ], synonymsMap),
        batteryImports: getSheetDataAsJson(doc, "BatteryImports", [
          "id", "batterySeries", "startNo", "endNo", "quantity", "importDate", "operator", "supplierName", "containerId", "notes"
        ], synonymsMap),
        chargerSales: getSheetDataAsJson(doc, "ChargerSales", [
          "id", "buyerName", "chargerType", "startNo", "endNo", "quantity", "status", "billNo", "deliveryChallanNo", "saleDate", "operator", "notes"
        ], synonymsMap),
        chargerImports: getSheetDataAsJson(doc, "ChargerImports", [
          "id", "chargerType", "startNo", "endNo", "quantity", "importDate", "operator", "supplierName", "notes"
        ], synonymsMap),
        warrantyClaims: getSheetDataAsJson(doc, "WarrantyClaims", [
          "id", "buyerName", "buyerContact", "originalSerialNo", "issueDescription", "status", "actionTaken", "newSerialNo", "claimDate", "operatorName", "notes"
        ], synonymsMap)
      }
    }))
    .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
    .setMimeType(ContentService.MimeType.JSON);
  }
}

function getSheetDataAsJson(doc, sheetName, fields, synonymsMap) {
  var sheet = doc.getSheetByName(sheetName);
  if (!sheet) return [];
  
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return []; // Header only
  
  var headers = data[0].map(function(h) { 
    return h ? h.toString().toLowerCase().replace(/[^a-z0-9]/g, "") : ""; 
  });
  
  var list = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var obj = {};
    var hasValue = false;
    
    for (var f = 0; f < fields.length; f++) {
      var fieldName = fields[f];
      var synonyms = synonymsMap[fieldName] || [fieldName];
      var colIdx = -1;
      
      for (var s = 0; s < synonyms.length; s++) {
        var normSyn = synonyms[s].toLowerCase().replace(/[^a-z0-9]/g, "");
        var idx = headers.indexOf(normSyn);
        if (idx !== -1) {
          colIdx = idx;
          break;
        }
      }
      
      if (colIdx === -1 && f < row.length) {
        colIdx = f;
      }
      
      var val = (colIdx !== -1 && colIdx < row.length) ? row[colIdx] : "";
      if (val === undefined || val === null) {
        val = "";
      }
      
      if (val !== "") {
        hasValue = true;
      }
      
      if (fieldName === "colors" || fieldName === "batterySerials") {
        obj[fieldName] = val ? val.toString().split(",").map(function(c) { return c.trim(); }).filter(Boolean) : [];
      } else if (fieldName === "quantity" || fieldName === "availableStock" || fieldName === "buyingPrice" || fieldName === "warrantyDurationMonths") {
        obj[fieldName] = (val !== "" && !isNaN(Number(val))) ? Number(val) : 0;
      } else if (fieldName === "isUnderWarranty") {
        obj[fieldName] = (val.toString().toLowerCase() === "yes" || val === true);
      } else {
        obj[fieldName] = val;
      }
    }
    
    if (hasValue) {
      list.push(obj);
    }
  }
  return list;
}

function getOrCreateSheet(doc, name, headers) {
  var sheet = doc.getSheetByName(name);
  if (!sheet) {
    sheet = doc.insertSheet(name);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// Applies filter to data sheet
function applyFilter(sheet) {
  try {
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    if (lastRow > 1 && lastCol > 0) {
      var existingFilter = sheet.getFilter();
      if (existingFilter) {
        existingFilter.remove();
      }
      sheet.getRange(1, 1, lastRow, lastCol).createFilter();
    }
  } catch (e) {
    // Filter creation optional if restricted
  }
}

// Applies executive visual styling and automatic data filters
function applyProfessionalFormatting(sheet, hasZebra, statusColIndex) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  
  if (lastRow < 1 || lastCol < 1) return;
  
  // Format Header Row
  var headerRange = sheet.getRange(1, 1, 1, lastCol);
  headerRange.setFontFamily("Segoe UI")
             .setFontSize(10)
             .setFontWeight("bold")
             .setBackground("#0F172A") // Dark Slate 900
             .setFontColor("#FFFFFF")
             .setHorizontalAlignment("center")
             .setVerticalAlignment("middle");
  sheet.setRowHeight(1, 32); // Ample padding for header row
  
  if (lastRow > 1) {
    // Format Data Range
    var dataRange = sheet.getRange(2, 1, lastRow - 1, lastCol);
    dataRange.setFontFamily("Segoe UI")
             .setFontSize(9)
             .setFontColor("#334155") // Deep neutral
             .setVerticalAlignment("middle");
             
    // Apply elegant thin borders
    dataRange.setBorder(true, true, true, true, true, true, "#E2E8F0", SpreadsheetApp.BorderStyle.SOLID);
    sheet.setRowHeights(2, lastRow - 1, 24); // Beautiful spacing for data rows
    
    // Apply Zebra Striping if requested
    if (hasZebra) {
      for (var r = 2; r <= lastRow; r++) {
        var rowRange = sheet.getRange(r, 1, 1, lastCol);
        if (r % 2 === 0) {
          rowRange.setBackground("#FFFFFF");
        } else {
          rowRange.setBackground("#F8FAFC"); // Subtle light blue-gray
        }
      }
    }
    
    // Smart Column Formatting
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    for (var colIdx = 0; colIdx < lastCol; colIdx++) {
      var headerName = headers[colIdx].toString().toLowerCase();
      var colRange = sheet.getRange(2, colIdx + 1, lastRow - 1, 1);
      
      if (headerName.indexOf("price") !== -1 || headerName.indexOf("quantity") !== -1 || headerName.indexOf("months") !== -1 || headerName.indexOf("total") !== -1 || headerName.indexOf("stock") !== -1 || headerName.indexOf("count") !== -1) {
        colRange.setHorizontalAlignment("right");
      } else if (headerName.indexOf("id") !== -1 || headerName.indexOf("no") !== -1 || headerName.indexOf("status") !== -1 || headerName.indexOf("date") !== -1 || headerName.indexOf("timestamp") !== -1 || headerName.indexOf("warranty") !== -1) {
        colRange.setHorizontalAlignment("center");
      } else {
        colRange.setHorizontalAlignment("left");
      }
      
      if (headerName.indexOf("price") !== -1 || headerName.indexOf("amount") !== -1) {
        colRange.setNumberFormat("$#,##0.00");
      }
      
      if (headerName.indexOf("date") !== -1 || headerName.indexOf("timestamp") !== -1 || headerName.indexOf("updated") !== -1) {
        colRange.setNumberFormat("yyyy-mm-dd hh:mm");
      }
      
      // Dynamic status coloring
      if (statusColIndex > 0 && colIdx + 1 === statusColIndex) {
        for (var row = 2; row <= lastRow; row++) {
          var cell = sheet.getRange(row, colIdx + 1);
          var val = cell.getValue().toString().toLowerCase().trim();
          
          if (val === "available" || val === "in" || val === "dispatched" || val === "challan_generated" || val === "resolved" || val === "repaired") {
            cell.setBackground("#D1FAE5").setFontColor("#065F46").setFontWeight("bold"); // Soft Green
          } else if (val === "sold" || val === "out" || val === "cancelled" || val === "rejected") {
            cell.setBackground("#FEE2E2").setFontColor("#991B1B").setFontWeight("bold"); // Soft Red
          } else if (val === "hold" || val === "pending" || val === "under_repair" || val === "incomplete") {
            cell.setBackground("#FEF3C7").setFontColor("#92400E").setFontWeight("bold"); // Soft Amber
          } else if (val === "prepared") {
            cell.setBackground("#E0E7FF").setFontColor("#3730A3").setFontWeight("bold"); // Soft Indigo
          }
        }
      }
    }
  }
  
  // Auto-resize columns and add dynamic breathing room
  sheet.autoResizeColumns(1, lastCol);
  for (var col = 1; col <= lastCol; col++) {
    var width = sheet.getColumnWidth(col);
    sheet.setColumnWidth(col, Math.max(100, width + 15));
  }

  // Create native Google Sheet Data Filter
  applyFilter(sheet);
}

function updateOrAddScooter(doc, scoot) {
  var sheet = doc.getSheetByName("ScooterUnits");
  var values = sheet.getDataRange().getValues();
  var rowIdx = -1;
  
  for (var i = 1; i < values.length; i++) {
    if (values[i][0] === scoot.id || (values[i][3] && values[i][3] === scoot.chassisNo)) {
      rowIdx = i + 1;
      break;
    }
  }
  
  var rowData = [
    scoot.id,
    scoot.modelName,
    scoot.color,
    scoot.chassisNo,
    scoot.motorNo,
    scoot.controllerNo,
    scoot.frontTireSize || "12-inch",
    scoot.rearTireSize || "12-inch",
    scoot.buyerName || "",
    scoot.buyerContact || "",
    scoot.salesBillNo || scoot.billNo || "",
    scoot.deliveryChallanNo || "",
    (scoot.batterySerials || []).join(", "),
    scoot.status,
    scoot.scooterWarrantyStatus || "None",
    scoot.batteryWarrantyStatus || "None",
    scoot.createdOperator || "",
    scoot.lastUpdatedBy || "",
    scoot.lastUpdatedTimestamp || ""
  ];
  
  if (rowIdx !== -1) {
    sheet.getRange(rowIdx, 1, 1, rowData.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }
  applyProfessionalFormatting(sheet, true, 14); // column 14 is status
}

function syncAllData(doc, data) {
  // 1. SalesOrders
  var ordersSheet = getOrCreateSheet(doc, "SalesOrders", ["Order No", "Buyer Name", "Buyer Contact", "Salesperson Name", "Salesperson Username", "Status", "Delivery Location", "Challan No", "Bill No", "Items Summary", "Created Date", "Dispatched Date", "Notes"]);
  ordersSheet.clearContents();
  ordersSheet.appendRow(["Order No", "Buyer Name", "Buyer Contact", "Salesperson Name", "Salesperson Username", "Status", "Delivery Location", "Challan No", "Bill No", "Items Summary", "Created Date", "Dispatched Date", "Notes"]);
  (data.salesOrders || []).forEach(function(o) {
    var itemsSummary = (o.items || []).map(function(it) {
      return (it.productName || it.itemType) + " (Qty: " + (it.quantity || 1) + ")";
    }).join("; ");

    ordersSheet.appendRow([
      o.orderNo || "",
      o.buyerName || "",
      o.buyerContact || "",
      o.salespersonName || "",
      o.salespersonUsername || "",
      o.status || "pending",
      o.deliveryLocation || "",
      o.challanNo || "",
      o.salesBillNo || "",
      itemsSummary,
      o.createdTimestamp || "",
      o.dispatchedTimestamp || "",
      o.notes || ""
    ]);
  });
  applyProfessionalFormatting(ordersSheet, true, 6); // Col 6 is Status

  // 2. ScooterUnits
  var scootSheet = getOrCreateSheet(doc, "ScooterUnits", ["Scooter ID", "Model Name", "Color", "Chassis No", "Motor No", "Controller No", "Front Tire", "Rear Tire", "Buyer Name", "Buyer Contact", "Bill No", "Challan No", "Battery Serials", "Status", "Scooter Warranty", "Battery Warranty", "Assembly Worker", "Last Updated By", "Last Updated"]);
  scootSheet.clearContents();
  scootSheet.appendRow(["Scooter ID", "Model Name", "Color", "Chassis No", "Motor No", "Controller No", "Front Tire", "Rear Tire", "Buyer Name", "Buyer Contact", "Bill No", "Challan No", "Battery Serials", "Status", "Scooter Warranty", "Battery Warranty", "Assembly Worker", "Last Updated By", "Last Updated"]);
  (data.scooterUnits || []).forEach(function(scoot) {
    scootSheet.appendRow([
      scoot.id,
      scoot.modelName,
      scoot.color,
      scoot.chassisNo,
      scoot.motorNo,
      scoot.controllerNo,
      scoot.frontTireSize || "12-inch",
      scoot.rearTireSize || "12-inch",
      scoot.buyerName || "",
      scoot.buyerContact || "",
      scoot.salesBillNo || scoot.billNo || "",
      scoot.deliveryChallanNo || "",
      (scoot.batterySerials || []).join(", "),
      scoot.status,
      scoot.scooterWarrantyStatus || "None",
      scoot.batteryWarrantyStatus || "None",
      scoot.createdOperator || "",
      scoot.lastUpdatedBy || "",
      scoot.lastUpdatedTimestamp || ""
    ]);
  });
  applyProfessionalFormatting(scootSheet, true, 14); // Status column 14

  // 3. StockLogs
  var stockSheet = getOrCreateSheet(doc, "StockLogs", ["Log ID", "Model Name", "Color", "Type (IN/OUT)", "Source Channel", "Quantity", "Buyer", "Bill No", "Challan No", "Timestamp", "Operator / Worker", "Notes"]);
  stockSheet.clearContents();
  stockSheet.appendRow(["Log ID", "Model Name", "Color", "Type (IN/OUT)", "Source Channel", "Quantity", "Buyer", "Bill No", "Challan No", "Timestamp", "Operator / Worker", "Notes"]);
  (data.stockLogs || []).forEach(function(log) {
    stockSheet.appendRow([log.id, log.modelName, log.color, (log.type || "").toUpperCase(), log.sourceChannel || "", log.quantity, log.buyerName || "", log.billNo || "", log.deliveryChallanNo || "", log.timestamp, log.operator, log.notes || ""]);
  });
  applyProfessionalFormatting(stockSheet, true, 4);

  // 4. BatterySales
  var batSalesSheet = getOrCreateSheet(doc, "BatterySales", ["Sale ID", "Buyer Name", "Buyer Contact", "Battery Series", "Start Serial No", "End Serial No", "Quantity", "Status", "Bill No", "Challan No", "Sale Date", "Operator / Worker", "Warranty Months", "Held For", "Notes"]);
  batSalesSheet.clearContents();
  batSalesSheet.appendRow(["Sale ID", "Buyer Name", "Buyer Contact", "Battery Series", "Start Serial No", "End Serial No", "Quantity", "Status", "Bill No", "Challan No", "Sale Date", "Operator / Worker", "Warranty Months", "Held For", "Notes"]);
  (data.batterySales || []).forEach(function(s) {
    batSalesSheet.appendRow([
      s.id,
      s.buyerName || "",
      s.buyerContact || "",
      s.batterySeries || "",
      s.startNo || "N/A",
      s.endNo || "N/A",
      s.quantity || 1,
      s.status || "sold",
      s.billNo || "",
      s.deliveryChallanNo || "",
      s.saleDate || "",
      s.operator || "",
      s.warrantyDurationMonths || "N/A",
      s.heldFor || "",
      s.notes || ""
    ]);
  });
  applyProfessionalFormatting(batSalesSheet, true, 8);

  // 5. BatteryImports
  var batImportsSheet = getOrCreateSheet(doc, "BatteryImports", ["Import ID", "Battery Series", "Start Serial No", "End Serial No", "Quantity", "Import Date", "Operator / Worker", "Supplier Name", "Container ID", "Notes"]);
  batImportsSheet.clearContents();
  batImportsSheet.appendRow(["Import ID", "Battery Series", "Start Serial No", "End Serial No", "Quantity", "Import Date", "Operator / Worker", "Supplier Name", "Container ID", "Notes"]);
  (data.batteryImports || []).forEach(function(imp) {
    batImportsSheet.appendRow([
      imp.id,
      imp.batterySeries,
      imp.startNo || "N/A",
      imp.endNo || "N/A",
      imp.quantity,
      imp.importDate,
      imp.operator,
      imp.supplierName || "",
      imp.containerId || "",
      imp.notes || ""
    ]);
  });
  applyProfessionalFormatting(batImportsSheet, true, 0);

  // 6. ChargerSales
  var chgSalesSheet = getOrCreateSheet(doc, "ChargerSales", ["Sale ID", "Buyer Name", "Charger Type", "Start Serial No", "End Serial No", "Quantity", "Status", "Bill No", "Challan No", "Sale Date", "Operator / Worker", "Notes"]);
  chgSalesSheet.clearContents();
  chgSalesSheet.appendRow(["Sale ID", "Buyer Name", "Charger Type", "Start Serial No", "End Serial No", "Quantity", "Status", "Bill No", "Challan No", "Sale Date", "Operator / Worker", "Notes"]);
  (data.chargerSales || []).forEach(function(s) {
    chgSalesSheet.appendRow([
      s.id,
      s.buyerName || "",
      s.chargerType || "",
      s.startNo || "N/A",
      s.endNo || "N/A",
      s.quantity || 1,
      s.status || "sold",
      s.billNo || "",
      s.deliveryChallanNo || "",
      s.saleDate || "",
      s.operator || "",
      s.notes || ""
    ]);
  });
  applyProfessionalFormatting(chgSalesSheet, true, 7);

  // 7. ChargerImports
  var chgImportsSheet = getOrCreateSheet(doc, "ChargerImports", ["Import ID", "Charger Type", "Start Serial No", "End Serial No", "Quantity", "Import Date", "Operator / Worker", "Supplier Name", "Notes"]);
  chgImportsSheet.clearContents();
  chgImportsSheet.appendRow(["Import ID", "Charger Type", "Start Serial No", "End Serial No", "Quantity", "Import Date", "Operator / Worker", "Supplier Name", "Notes"]);
  (data.chargerImports || []).forEach(function(imp) {
    chgImportsSheet.appendRow([
      imp.id,
      imp.chargerType,
      imp.startNo || "N/A",
      imp.endNo || "N/A",
      imp.quantity,
      imp.importDate,
      imp.operator,
      imp.supplierName || "",
      imp.notes || ""
    ]);
  });
  applyProfessionalFormatting(chgImportsSheet, true, 0);

  // 8. WarrantyClaims
  var wcSheet = getOrCreateSheet(doc, "WarrantyClaims", ["Claim ID", "Buyer Name", "Buyer Contact", "Component / Serial", "Issue Description", "Status", "Action Taken", "Replacement Serial", "Claim Date", "Processed By", "Notes"]);
  wcSheet.clearContents();
  wcSheet.appendRow(["Claim ID", "Buyer Name", "Buyer Contact", "Component / Serial", "Issue Description", "Status", "Action Taken", "Replacement Serial", "Claim Date", "Processed By", "Notes"]);
  (data.warrantyClaims || []).forEach(function(c) {
    wcSheet.appendRow([
      c.id || "",
      c.buyerName || "",
      c.buyerContact || "",
      c.originalSerialNo || "",
      c.issueDescription || "",
      c.status || "investigating",
      c.actionTaken || "",
      c.newSerialNo || "",
      c.claimDate || "",
      c.operatorName || c.operatorUsername || "",
      c.notes || ""
    ]);
  });
  applyProfessionalFormatting(wcSheet, true, 6);

  // 9. AuditLogs
  var auditSheet = getOrCreateSheet(doc, "AuditLogs", ["Log ID", "Action", "Timestamp", "Username", "Operator Name", "Role", "Details"]);
  auditSheet.clearContents();
  auditSheet.appendRow(["Log ID", "Action", "Timestamp", "Username", "Operator Name", "Role", "Details"]);
  (data.auditLogs || []).slice(0, 1000).forEach(function(a) {
    auditSheet.appendRow([
      a.id || "",
      a.action || "",
      a.timestamp || "",
      a.username || "",
      a.operatorName || a.operator || "",
      a.operatorRole || "",
      a.details || ""
    ]);
  });
  applyProfessionalFormatting(auditSheet, true, 0);

  // 10. Products
  var prodSheet = getOrCreateSheet(doc, "Products", ["Product ID", "Model Name", "Available Colors"]);
  prodSheet.clearContents();
  prodSheet.appendRow(["Product ID", "Model Name", "Available Colors"]);
  (data.products || []).forEach(function(p) {
    prodSheet.appendRow([p.id, p.name, (p.colors || []).join(", ")]);
  });
  applyProfessionalFormatting(prodSheet, true, 0);
  
  // 11. Buyers
  var buySheet = getOrCreateSheet(doc, "Buyers", ["Buyer ID", "Buyer Name", "Contact Details", "Address", "GST No", "Buyer Type"]);
  buySheet.clearContents();
  buySheet.appendRow(["Buyer ID", "Buyer Name", "Contact Details", "Address", "GST No", "Buyer Type"]);
  (data.buyers || []).forEach(function(b) {
    buySheet.appendRow([b.id, b.name, b.contact || "", b.address || "", b.gstNo || "", b.buyerType || ""]);
  });
  applyProfessionalFormatting(buySheet, true, 0);
}

// Rebuild Executive Dashboard, Sales Leaderboard, and Employee Performance Reports
function rebuildExecutiveDashboard(doc, data) {
  // A. Rebuild Owner Sales Performance Sheet ("Who Sold How Much")
  rebuildSalesPerformanceSheet(doc, data);

  // B. Rebuild Owner Employee Performance Sheet ("Which Worker Is Doing How Much Work")
  rebuildEmployeePerformanceSheet(doc, data);

  // C. Rebuild Main Dashboard
  var dashboardSheet = doc.getSheetByName("Dashboard");
  if (!dashboardSheet) {
    dashboardSheet = doc.insertSheet("Dashboard");
  }
  
  doc.setActiveSheet(dashboardSheet);
  doc.moveActiveSheet(1);
  dashboardSheet.clear();
  dashboardSheet.setGridlinesVisible(false);
  
  var scooterUnits = data.scooterUnits || [];
  var salesOrders = data.salesOrders || [];
  var totalAssembled = scooterUnits.length;
  var availableStock = 0;
  var totalSold = 0;
  var totalHold = 0;
  for (var i = 0; i < scooterUnits.length; i++) {
    var st = scooterUnits[i].status ? scooterUnits[i].status.toLowerCase().trim() : "";
    if (st === "available") availableStock++;
    else if (st === "sold") totalSold++;
    else if (st === "hold") totalHold++;
  }
  
  // Set Column Widths
  dashboardSheet.setColumnWidth(1, 24);   // Left margin
  dashboardSheet.setColumnWidth(2, 220);  // Col 1
  dashboardSheet.setColumnWidth(3, 110);  // Col 2
  dashboardSheet.setColumnWidth(4, 30);   // Spacer
  dashboardSheet.setColumnWidth(5, 180);  // Col 3
  dashboardSheet.setColumnWidth(6, 120);  // Col 4
  dashboardSheet.setColumnWidth(7, 100);  // Col 5
  dashboardSheet.setColumnWidth(8, 100);  // Col 6
  dashboardSheet.setColumnWidth(9, 100);  // Col 7
  dashboardSheet.setColumnWidth(10, 100); // Col 8
  
  dashboardSheet.getRange("A1:K100").setFontFamily("Segoe UI");
  
  // Executive Header Banner
  var headerRange = dashboardSheet.getRange("B2:J4");
  headerRange.merge();
  headerRange.setValue("⚡ SENZO EXECUTIVE WAREHOUSE & OPERATIONS CONTROL CENTER\nReal-Time Executive Platform | Orders, Sales Leaderboard & Worker Performance");
  headerRange.setBackground("#0F172A")
             .setFontColor("#FFFFFF")
             .setFontSize(13)
             .setFontWeight("bold")
             .setHorizontalAlignment("left")
             .setVerticalAlignment("middle")
             .setWrap(true);
  
  // KPI Cards
  drawKPICard(dashboardSheet, "B6:C6", "B7:C8", "ASSEMBLIES REGISTERED", totalAssembled, "#F1F5F9", "#1E293B");
  drawKPICard(dashboardSheet, "E6:F6", "E7:F8", "AVAILABLE WAREHOUSE STOCK", availableStock, "#E0F2FE", "#0369A1");
  drawKPICard(dashboardSheet, "H6:I6", "H7:I8", "TOTAL DISPATCHED / SOLD", totalSold, "#D1FAE5", "#047857");
  
  // 1. Sales Performance Summary Table (Who Sold How Much)
  var salesTitle = dashboardSheet.getRange("B10:C10");
  salesTitle.merge();
  salesTitle.setValue("🏆 SALESPERSON PERFORMANCE LEADERBOARD");
  salesTitle.setBackground("#1E293B").setFontColor("#FFFFFF").setFontSize(9).setFontWeight("bold").setHorizontalAlignment("center").setVerticalAlignment("middle");
  dashboardSheet.setRowHeight(10, 26);
  
  var salesMap = computeSalespersonPerformance(data);
  var salesList = Object.keys(salesMap).map(function(k) { return salesMap[k]; });
  salesList.sort(function(a, b) { return b.totalSold - a.totalSold; });
  
  var curRow = 11;
  dashboardSheet.getRange(curRow, 2).setValue("Salesperson").setFontWeight("bold").setFontSize(8).setBackground("#334155").setFontColor("#FFF");
  dashboardSheet.getRange(curRow, 3).setValue("Units Sold").setFontWeight("bold").setFontSize(8).setBackground("#334155").setFontColor("#FFF").setHorizontalAlignment("right");
  dashboardSheet.setRowHeight(curRow, 22);
  curRow++;
  
  if (salesList.length === 0) {
    dashboardSheet.getRange(curRow, 2).setValue("No sales recorded yet").setFontSize(9).setFontColor("#64748B");
    dashboardSheet.getRange(curRow, 3).setValue(0).setFontSize(9).setHorizontalAlignment("right");
    curRow++;
  } else {
    for (var i = 0; i < Math.min(6, salesList.length); i++) {
      dashboardSheet.getRange(curRow, 2).setValue(salesList[i].name).setFontWeight("bold").setFontSize(9).setFontColor("#334155");
      dashboardSheet.getRange(curRow, 3).setValue(salesList[i].totalSold).setFontWeight("bold").setFontSize(10).setFontColor("#0F172A").setHorizontalAlignment("right");
      var bg = (curRow % 2 === 0) ? "#FFFFFF" : "#F8FAFC";
      dashboardSheet.getRange(curRow, 2, 1, 2).setBackground(bg).setBorder(true, true, true, true, true, true, "#E2E8F0", SpreadsheetApp.BorderStyle.SOLID);
      dashboardSheet.setRowHeight(curRow, 22);
      curRow++;
    }
  }

  // 2. Worker Performance Summary Table (Which Worker Did How Much Work)
  var workerTitleRow = curRow + 1;
  var wTitle = dashboardSheet.getRange(workerTitleRow, 2, 1, 2);
  wTitle.merge();
  wTitle.setValue("🛠️ WORKER PRODUCTIVITY TRACKER");
  wTitle.setBackground("#1E293B").setFontColor("#FFFFFF").setFontSize(9).setFontWeight("bold").setHorizontalAlignment("center").setVerticalAlignment("middle");
  dashboardSheet.setRowHeight(workerTitleRow, 26);
  
  var workerMap = computeWorkerPerformance(data);
  var workerList = Object.keys(workerMap).map(function(k) { return workerMap[k]; });
  workerList.sort(function(a, b) { return b.totalTasks - a.totalTasks; });
  
  curRow = workerTitleRow + 1;
  dashboardSheet.getRange(curRow, 2).setValue("Worker / Employee").setFontWeight("bold").setFontSize(8).setBackground("#334155").setFontColor("#FFF");
  dashboardSheet.getRange(curRow, 3).setValue("Total Tasks").setFontWeight("bold").setFontSize(8).setBackground("#334155").setFontColor("#FFF").setHorizontalAlignment("right");
  dashboardSheet.setRowHeight(curRow, 22);
  curRow++;
  
  if (workerList.length === 0) {
    dashboardSheet.getRange(curRow, 2).setValue("No worker activity logged").setFontSize(9).setFontColor("#64748B");
    dashboardSheet.getRange(curRow, 3).setValue(0).setFontSize(9).setHorizontalAlignment("right");
    curRow++;
  } else {
    for (var i = 0; i < Math.min(6, workerList.length); i++) {
      dashboardSheet.getRange(curRow, 2).setValue(workerList[i].name).setFontWeight("bold").setFontSize(9).setFontColor("#334155");
      dashboardSheet.getRange(curRow, 3).setValue(workerList[i].totalTasks).setFontWeight("bold").setFontSize(10).setFontColor("#0F172A").setHorizontalAlignment("right");
      var bg = (curRow % 2 === 0) ? "#FFFFFF" : "#F8FAFC";
      dashboardSheet.getRange(curRow, 2, 1, 2).setBackground(bg).setBorder(true, true, true, true, true, true, "#E2E8F0", SpreadsheetApp.BorderStyle.SOLID);
      dashboardSheet.setRowHeight(curRow, 22);
      curRow++;
    }
  }
  
  // 3. Right Side: Stock Breakdown Table
  var breakdownTitle = dashboardSheet.getRange("E10:J10");
  breakdownTitle.merge();
  breakdownTitle.setValue("PRODUCT & COLOR CONFIGURATION BREAKDOWN");
  breakdownTitle.setBackground("#1E293B").setFontColor("#FFFFFF").setFontSize(9).setFontWeight("bold").setHorizontalAlignment("center").setVerticalAlignment("middle");
  
  var breakdownHeaders = ["Model Name", "Color", "Available", "Sold", "Total Reg.", "Imported"];
  for (var b = 0; b < breakdownHeaders.length; b++) {
    var cell = dashboardSheet.getRange(11, 5 + b);
    cell.setValue(breakdownHeaders[b]);
    cell.setBackground("#334155").setFontColor("#FFFFFF").setFontSize(8).setFontWeight("bold").setHorizontalAlignment("center").setVerticalAlignment("middle");
  }
  dashboardSheet.setRowHeight(11, 22);
  
  var colorBreakdown = data.colorBreakdown || [];
  var brRow = 12;
  for (var i = 0; i < colorBreakdown.length; i++) {
    dashboardSheet.getRange(brRow, 5).setValue(colorBreakdown[i].modelName).setFontWeight("bold");
    dashboardSheet.getRange(brRow, 6).setValue(colorBreakdown[i].color).setFontColor("#475569");
    dashboardSheet.getRange(brRow, 7).setValue(colorBreakdown[i].availableStock).setHorizontalAlignment("right");
    dashboardSheet.getRange(brRow, 8).setValue(colorBreakdown[i].soldStock).setHorizontalAlignment("right");
    dashboardSheet.getRange(brRow, 9).setValue(colorBreakdown[i].totalRegistered).setHorizontalAlignment("right").setFontWeight("bold");
    dashboardSheet.getRange(brRow, 10).setValue(colorBreakdown[i].importedQty).setHorizontalAlignment("right");
    
    var bg = (brRow % 2 === 0) ? "#FFFFFF" : "#F8FAFC";
    var rowRange = dashboardSheet.getRange(brRow, 5, 1, 6);
    rowRange.setBackground(bg).setFontSize(9).setBorder(true, true, true, true, true, true, "#E2E8F0", SpreadsheetApp.BorderStyle.SOLID);
    dashboardSheet.setRowHeight(brRow, 22);
    brRow++;
  }
}

// Compute Salesperson Performance ("Who Sold How Much")
function computeSalespersonPerformance(data) {
  var map = {};
  var salesOrders = data.salesOrders || [];
  salesOrders.forEach(function(o) {
    var name = o.salespersonName || o.salespersonUsername || "Sales Representative";
    var username = o.salespersonUsername || "";
    var key = name.toLowerCase().trim();
    if (!map[key]) {
      map[key] = { name: name, username: username, ordersCount: 0, scootersSold: 0, batterySold: 0, chargerSold: 0, totalSold: 0, latestDate: "" };
    }
    map[key].ordersCount++;
    (o.items || []).forEach(function(it) {
      var qty = Number(it.quantity || 1);
      if (it.itemType === "scooter") map[key].scootersSold += qty;
      else if (it.itemType === "battery") map[key].batterySold += qty;
      else if (it.itemType === "charger") map[key].chargerSold += qty;
      map[key].totalSold += qty;
    });
    var d = o.dispatchedTimestamp || o.createdTimestamp || "";
    if (d > map[key].latestDate) map[key].latestDate = d;
  });

  // Include direct scooter sales
  (data.scooterUnits || []).forEach(function(s) {
    if (s.status === "sold" && s.lastUpdatedBy) {
      var name = s.lastUpdatedBy;
      var key = name.toLowerCase().trim();
      if (!map[key]) {
        map[key] = { name: name, username: name, ordersCount: 1, scootersSold: 1, batterySold: 0, chargerSold: 0, totalSold: 1, latestDate: s.lastUpdatedTimestamp || "" };
      }
    }
  });

  return map;
}

// Build dedicated Sales Performance tab for the Owner
function rebuildSalesPerformanceSheet(doc, data) {
  var sheet = getOrCreateSheet(doc, "SalesPerformance", ["Salesperson Name", "Username", "Orders Placed", "Scooters Sold", "Battery Packs Sold", "Chargers Sold", "Total Items Sold", "Latest Sale Date"]);
  sheet.clearContents();
  sheet.appendRow(["Salesperson Name", "Username", "Orders Placed", "Scooters Sold", "Battery Packs Sold", "Chargers Sold", "Total Items Sold", "Latest Sale Date"]);

  var salesMap = computeSalespersonPerformance(data);
  var salesList = Object.keys(salesMap).map(function(k) { return salesMap[k]; });
  salesList.sort(function(a, b) { return b.totalSold - a.totalSold; });

  salesList.forEach(function(sp) {
    sheet.appendRow([
      sp.name,
      sp.username,
      sp.ordersCount,
      sp.scootersSold,
      sp.batterySold,
      sp.chargerSold,
      sp.totalSold,
      sp.latestDate
    ]);
  });

  applyProfessionalFormatting(sheet, true, 0);
}

// Compute Worker Performance ("Which Worker Is Doing How Much Work")
function computeWorkerPerformance(data) {
  var map = {};

  function ensureWorker(name, uname) {
    var clean = (name || uname || "Worker").trim();
    if (!clean || clean.toLowerCase() === "system") return null;
    var key = clean.toLowerCase();
    if (!map[key]) {
      map[key] = {
        name: clean,
        username: uname || clean,
        assemblies: 0,
        customizations: 0,
        dispatches: 0,
        batteryChargerOps: 0,
        warrantyClaims: 0,
        auditActions: 0,
        totalTasks: 0,
        lastActive: ""
      };
    }
    return map[key];
  }

  // 1. Stage 1 Assemblies & Stage 2 Customizations from ScooterUnits
  (data.scooterUnits || []).forEach(function(s) {
    if (s.createdOperator) {
      var w = ensureWorker(s.createdOperator, s.createdOperator);
      if (w) {
        w.assemblies++;
        w.totalTasks++;
      }
    }
    if (s.preparedBy || (s.lastUpdatedBy && s.lastUpdatedBy !== s.createdOperator)) {
      var name = s.preparedBy || s.lastUpdatedBy;
      var w = ensureWorker(name, name);
      if (w) {
        w.customizations++;
        w.totalTasks++;
        if (s.lastUpdatedTimestamp > w.lastActive) w.lastActive = s.lastUpdatedTimestamp;
      }
    }
  });

  // 2. Sales Orders Preparation & Dispatches
  (data.salesOrders || []).forEach(function(o) {
    if (o.preparedBy) {
      var w = ensureWorker(o.preparedBy, o.preparedBy);
      if (w) {
        w.dispatches++;
        w.totalTasks++;
        if (o.preparedTimestamp > w.lastActive) w.lastActive = o.preparedTimestamp;
      }
    }
    if (o.dispatchedBy) {
      var w = ensureWorker(o.dispatchedBy, o.dispatchedBy);
      if (w) {
        w.dispatches++;
        w.totalTasks++;
        if (o.dispatchedTimestamp > w.lastActive) w.lastActive = o.dispatchedTimestamp;
      }
    }
    if (o.challanFinishedBy) {
      var w = ensureWorker(o.challanFinishedBy, o.challanFinishedBy);
      if (w) {
        w.dispatches++;
        w.totalTasks++;
        if (o.challanFinishedTimestamp > w.lastActive) w.lastActive = o.challanFinishedTimestamp;
      }
    }
  });

  // 3. Battery & Charger Sales/Imports
  (data.batterySales || []).forEach(function(b) {
    if (b.operator) {
      var w = ensureWorker(b.operator, b.operator);
      if (w) {
        w.batteryChargerOps++;
        w.totalTasks++;
        if (b.saleDate > w.lastActive) w.lastActive = b.saleDate;
      }
    }
  });
  (data.batteryImports || []).forEach(function(b) {
    if (b.operator) {
      var w = ensureWorker(b.operator, b.operator);
      if (w) {
        w.batteryChargerOps++;
        w.totalTasks++;
        if (b.importDate > w.lastActive) w.lastActive = b.importDate;
      }
    }
  });

  // 4. Warranty Claims
  (data.warrantyClaims || []).forEach(function(c) {
    if (c.operatorName || c.operatorUsername) {
      var name = c.operatorName || c.operatorUsername;
      var w = ensureWorker(name, c.operatorUsername);
      if (w) {
        w.warrantyClaims++;
        w.totalTasks++;
        if (c.claimDate > w.lastActive) w.lastActive = c.claimDate;
      }
    }
  });

  // 5. Audit Trail Actions
  (data.auditLogs || []).forEach(function(a) {
    if (a.operatorName || a.username) {
      var name = a.operatorName || a.username;
      var w = ensureWorker(name, a.username);
      if (w) {
        w.auditActions++;
        if (a.timestamp > w.lastActive) w.lastActive = a.timestamp;
      }
    }
  });

  return map;
}

// Build dedicated Employee Performance tab for the Owner
function rebuildEmployeePerformanceSheet(doc, data) {
  var sheet = getOrCreateSheet(doc, "EmployeePerformance", ["Worker / Operator Name", "System Username", "Stage 1 Assemblies", "Stage 2 Customizations", "Dispatches Handled", "Battery/Charger Ops", "Warranty Claims", "Total Audit Actions", "Total Work Output", "Last Active Date"]);
  sheet.clearContents();
  sheet.appendRow(["Worker / Operator Name", "System Username", "Stage 1 Assemblies", "Stage 2 Customizations", "Dispatches Handled", "Battery/Charger Ops", "Warranty Claims", "Total Audit Actions", "Total Work Output", "Last Active Date"]);

  var workerMap = computeWorkerPerformance(data);
  var workerList = Object.keys(workerMap).map(function(k) { return workerMap[k]; });
  workerList.sort(function(a, b) { return b.totalTasks - a.totalTasks; });

  workerList.forEach(function(w) {
    sheet.appendRow([
      w.name,
      w.username,
      w.assemblies,
      w.customizations,
      w.dispatches,
      w.batteryChargerOps,
      w.warrantyClaims,
      w.auditActions,
      w.totalTasks,
      w.lastActive
    ]);
  });

  applyProfessionalFormatting(sheet, true, 0);
}

function drawKPICard(sheet, titleCellRange, valueCellRange, titleText, valueVal, themeColor, textCol) {
  var tRange = sheet.getRange(titleCellRange);
  tRange.merge();
  tRange.setValue(titleText);
  tRange.setBackground(themeColor);
  tRange.setFontSize(8).setFontWeight("bold").setFontColor(textCol).setFontFamily("Segoe UI").setHorizontalAlignment("center").setVerticalAlignment("middle");
  
  var vRange = sheet.getRange(valueCellRange);
  vRange.merge();
  vRange.setValue(valueVal);
  vRange.setBackground(themeColor);
  vRange.setFontSize(20).setFontWeight("bold").setFontColor(textCol).setFontFamily("Segoe UI").setHorizontalAlignment("center").setVerticalAlignment("middle");
  
  var startColChar = titleCellRange.split(":")[0].charAt(0);
  var startRow = titleCellRange.split(":")[0].substring(1);
  var endColChar = valueCellRange.split(":")[1].charAt(0);
  var endRow = valueCellRange.split(":")[1].substring(1);
  
  var outerRange = sheet.getRange(startColChar + startRow + ":" + endColChar + endRow);
  outerRange.setBorder(true, true, true, true, true, true, "#CBD5E1", SpreadsheetApp.BorderStyle.SOLID);
}
`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(appsScriptCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    const ok = await onSaveConfig(webhookUrl, enabled);
    if (ok) {
      setSuccessMsg('Google Sheets configuration successfully updated!');
    } else {
      setErrorMsg('Failed to update sheets config. Verify server is running.');
    }
    setLoading(false);
  };

  const handleManualSync = async () => {
    setSyncLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    const res = await onTriggerSyncAll();
    if (res.success) {
      setSuccessMsg(res.message || 'Full database sync completed successfully!');
    } else {
      setErrorMsg(res.error || 'Failed to complete bulk Google Sheets sync.');
    }
    setSyncLoading(false);
  };

  const handlePullSync = async () => {
    if (!onTriggerPullAll) return;
    setPullLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    const res = await onTriggerPullAll();
    if (res.success) {
      setSuccessMsg(res.message || 'Successfully pulled and restored database from Google Sheet!');
    } else {
      setErrorMsg(res.error || 'Failed to pull Google Sheets data. Please deploy the updated script with doGet support.');
    }
    setPullLoading(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="sync-panel-container">
      
      {/* Configuration & Controls */}
      <div className="lg:col-span-5 space-y-6">
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm" id="config-card">
          <div className="flex items-center gap-2 mb-4">
            <Cloud className="h-5 w-5 text-purple-600" />
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-800 font-sans">
              🔗 Connect Google Sheet
            </h3>
          </div>

          <form onSubmit={handleSaveConfig} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 font-sans">
                Enter Google Sheet Link or Web App Link:
              </label>
              <input
                type="url"
                placeholder="https://docs.google.com/spreadsheets/d/... or Web App Link"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-xs text-slate-800 focus:border-cyan-500 outline-none font-mono"
              />
            </div>

            <div className="flex items-start gap-2.5 pt-1">
              <input
                type="checkbox"
                id="sync-enabled-chk"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-purple-600 bg-white focus:ring-purple-500 mt-0.5 cursor-pointer"
              />
              <label htmlFor="sync-enabled-chk" className="text-xs text-slate-600 font-semibold font-sans cursor-pointer select-none leading-relaxed">
                Always save changes to Google Sheets instantly
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-sans font-bold text-xs active:scale-[0.99] transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-40"
            >
              <Save className="h-4 w-4 text-purple-300" />
              <span>{loading ? 'Saving...' : 'Save Configuration Link'}</span>
            </button>
          </form>

          {sheetConfig.webhookUrl && (
            <div className="mt-5 pt-5 border-t border-slate-100 space-y-3">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-semibold">
                <Info className="h-4 w-4 text-emerald-600" />
                <span>Sync warehouse data bidirectional:</span>
              </div>
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={handleManualSync}
                  disabled={syncLoading || pullLoading}
                  className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-sans font-bold text-xs active:scale-[0.99] transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-40"
                >
                  {syncLoading ? (
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <Play className="h-4 w-4 fill-white" />
                      <span>Upload Data to Sheets (Push)</span>
                    </>
                  )}
                </button>
                
                {onTriggerPullAll && (
                  <button
                    type="button"
                    onClick={handlePullSync}
                    disabled={syncLoading || pullLoading}
                    className="w-full py-3 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-sans font-bold text-xs active:scale-[0.99] transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-40"
                  >
                    {pullLoading ? (
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <>
                        <Cloud className="h-4 w-4 text-white" />
                        <span>Pull Data from Sheets (Import)</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="mt-4 p-3 bg-rose-50 border border-rose-100 text-rose-800 text-xs font-semibold rounded-2xl">
              ⚠️ {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="mt-4 p-3 bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs font-semibold rounded-2xl">
              ✨ {successMsg}
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-2">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-sans">Why use Google Sheets Integration?</h4>
          <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
            Senzo matches physical warehouse status with Google Sheets instantly. By executing sync via standard Google Apps Script, we ensure data updates are 100% accurate, safe, and easily viewable by your entire team.
          </p>
        </div>
      </div>

      {/* Copyable code and instructions */}
      <div className="lg:col-span-7 space-y-4">
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm" id="code-guide-card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Code className="h-5 w-5 text-emerald-600" />
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-800 font-sans">
                Google Sheets Setup Script
              </h3>
            </div>
            
            <button
              onClick={copyToClipboard}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                copiedCode 
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
              }`}
            >
              {copiedCode ? (
                <span className="flex items-center gap-1"><Check className="h-3.5 w-3.5" /> Copied!</span>
              ) : (
                <span>Copy Script Code</span>
              )}
            </button>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 max-h-[350px] overflow-y-auto">
            <pre className="text-[10px] text-slate-700 font-mono select-all leading-relaxed whitespace-pre font-medium">
              {appsScriptCode}
            </pre>
          </div>
        </div>
      </div>

    </div>
  );
}
