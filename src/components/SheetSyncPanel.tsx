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
 * Google Apps Script for Executive Warehouse Registry Sync
 * 
 * DESIGN CONCEPTS:
 * - Designed by a 20-year Spreadsheet Architecture Veteran.
 * - Cohesive professional slate/indigo palette, clean typography, custom row heights, and auto-resizable layouts.
 * - Multi-tab layout including a fully interactive Executive Performance Dashboard with large metric blocks.
 * - Dynamic color status mapping, alternating row zebra striping, and automatic number/currency formatting.
 * 
 * Instructions:
 * 1. Open your Google Sheet.
 * 2. Click "Extensions" > "Apps Script".
 * 3. Delete any default code and paste this script.
 * 4. Click "Deploy" > "New deployment".
 * 5. Select "Web app" as deployment type.
 * 6. Set "Execute as" to "Me (your email)".
 * 7. Set "Who has access" to "Anyone".
 * 8. Click "Deploy", approve permissions, and COPY the Web App URL!
 * 9. Paste that URL into the control panel.
 */

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var action = payload.action;
    var data = payload.data;
    
    var doc = SpreadsheetApp.getActiveSpreadsheet();
    
    // Create tabs if they do not exist (with human-readable proper headers)
    getOrCreateSheet(doc, "StockLogs", ["Log ID", "Model Name", "Color", "Type (IN/OUT)", "Source Channel", "Quantity", "Buyer", "Timestamp", "Operator", "Notes"]);
    getOrCreateSheet(doc, "ScooterUnits", ["Scooter ID", "Model Name", "Color", "Chassis No", "Motor No", "Controller No", "Tires", "Buyer Name", "Buyer Contact", "Battery Serials", "Status", "Scooter Warranty", "Battery Warranty", "Last Updated", "Created By"]);
    getOrCreateSheet(doc, "Products", ["Product ID", "Model Name", "Available Colors"]);
    getOrCreateSheet(doc, "Buyers", ["Buyer ID", "Buyer Name", "Contact Details"]);
    getOrCreateSheet(doc, "BatterySales", ["Sale ID", "Buyer Name", "Battery Series", "Start Serial No", "End Serial No", "Quantity", "Sale Date", "Operator", "Notes", "Under Warranty", "Warranty Months", "Status", "Held For", "Held By", "Hold Date"]);
    getOrCreateSheet(doc, "BatteryImports", ["Import ID", "Battery Series", "Start Serial No", "End Serial No", "Quantity", "Import Date", "Operator", "Supplier Name", "Container ID", "Notes"]);
    getOrCreateSheet(doc, "SummaryStats", ["Metric Name", "Value", "Description"]);
    getOrCreateSheet(doc, "ColorBreakdown", ["Model Name", "Color", "Available Stock", "Sold Stock", "Total Registered", "Imported via Logs"]);
    
    if (action === "log_stock") {
      var sheet = doc.getSheetByName("StockLogs");
      sheet.appendRow([data.id, data.modelName, data.color, data.type.toUpperCase(), data.sourceChannel || "", data.quantity, data.buyerName || "", data.timestamp, data.operator, data.notes || ""]);
      applyProfessionalFormatting(sheet, true, 4); // status column 4 is Type
    } 
    else if (action === "create_scooter" || action === "update_scooter") {
      updateOrAddScooter(doc, data);
    }
    else if (action === "add_product") {
      var sheet = doc.getSheetByName("Products");
      sheet.appendRow([data.id, data.name, data.colors.join(", ")]);
      applyProfessionalFormatting(sheet, true, 0);
    }
    else if (action === "add_buyer") {
      var sheet = doc.getSheetByName("Buyers");
      sheet.appendRow([data.id, data.name, data.contact || ""]);
      applyProfessionalFormatting(sheet, true, 0);
    }
    else if (action === "sync_all") {
      syncAllData(doc, data);
    }
    
    // Automatically rebuild the gorgeous, executive control panel dashboard
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
      id: ["id", "id", "accessory id", "buyer id", "product id", "log id", "scooter id", "sale id", "import id"],
      name: ["name", "model name", "model", "buyer name", "accessory name"],
      colors: ["colors", "color list", "available colors"],
      contact: ["contact", "contact info", "phone", "contact details"],
      modelName: ["model", "model name"],
      color: ["color"],
      chassisNo: ["chassis no", "chassis number", "chassisno"],
      motorNo: ["motor no", "motor number", "motorno"],
      controllerNo: ["controller no", "controller number", "controllerno"],
      tireSize: ["tires", "tire size"],
      buyerName: ["buyer name", "buyer"],
      buyerContact: ["buyer contact", "contact"],
      batterySerials: ["battery serials", "battery serial"],
      status: ["status"],
      scooterWarrantyStatus: ["scooter warranty", "scooter warranty status"],
      batteryWarrantyStatus: ["battery warranty", "battery warranty status"],
      lastUpdatedTimestamp: ["last updated", "lastupdated"],
      createdOperator: ["created by", "createdby", "operator"],
      type: ["type", "type (in/out)"],
      sourceChannel: ["source channel", "sourcechannel"],
      quantity: ["quantity", "qty"],
      timestamp: ["timestamp", "date"],
      operator: ["operator", "user"],
      notes: ["notes", "note"],
      category: ["category"],
      availableStock: ["available stock", "stock", "availablestock", "quantity", "qty"],
      buyingPrice: ["buying price", "buy price", "buyingprice", "price", "cost"]
    };

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      data: {
        products: getSheetDataAsJson(doc, "Products", ["id", "name", "colors"], synonymsMap),
        buyers: getSheetDataAsJson(doc, "Buyers", ["id", "name", "contact"], synonymsMap),
        scooterUnits: getSheetDataAsJson(doc, "ScooterUnits", [
          "id", "modelName", "color", "chassisNo", "motorNo", "controllerNo", 
          "tireSize", "buyerName", "buyerContact", "batterySerials", 
          "status", "scooterWarrantyStatus", "batteryWarrantyStatus", "lastUpdatedTimestamp", "createdOperator"
        ], synonymsMap),
        stockLogs: getSheetDataAsJson(doc, "StockLogs", [
          "id", "modelName", "color", "type", "sourceChannel", "quantity", "buyerName", "timestamp", "operator", "notes"
        ], synonymsMap),
        batterySales: getSheetDataAsJson(doc, "BatterySales", [
          "id", "buyerName", "batterySeries", "startNo", "endNo", "quantity", "saleDate", "operator", "notes", "isUnderWarranty", "warrantyDurationMonths", "status", "heldFor", "heldBy", "holdDate"
        ], synonymsMap),
        batteryImports: getSheetDataAsJson(doc, "BatteryImports", [
          "id", "batterySeries", "startNo", "endNo", "quantity", "importDate", "operator", "supplierName", "containerId", "notes"
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

// Applies stunning, 20-year-expert visual styles to data sheets
function applyProfessionalFormatting(sheet, hasZebra, statusColIndex) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  
  if (lastRow < 1 || lastCol < 1) return;
  
  // Format Header Row
  var headerRange = sheet.getRange(1, 1, 1, lastCol);
  headerRange.setFontFamily("Inter")
             .setFontSize(10)
             .setFontWeight("bold")
             .setBackground("#1E293B") // Dark Slate Blue
             .setFontColor("#FFFFFF")
             .setHorizontalAlignment("center")
             .setVerticalAlignment("middle");
  sheet.setRowHeight(1, 32); // Ample padding for header row
  
  if (lastRow > 1) {
    // Format Data Range
    var dataRange = sheet.getRange(2, 1, lastRow - 1, lastCol);
    dataRange.setFontFamily("Inter")
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
    
    // Smart Column Formatting (Zebra override / Alignments / Number formats)
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    for (var colIdx = 0; colIdx < lastCol; colIdx++) {
      var headerName = headers[colIdx].toString().toLowerCase();
      var colRange = sheet.getRange(2, colIdx + 1, lastRow - 1, 1);
      
      // Right alignment for Numeric / Prices / Quantities
      if (headerName.indexOf("price") !== -1 || headerName.indexOf("quantity") !== -1 || headerName.indexOf("months") !== -1 || headerName.indexOf("total") !== -1 || headerName.indexOf("stock") !== -1) {
        colRange.setHorizontalAlignment("right");
      }
      // Center alignment for Codes, Statuses, Dates, IDs
      else if (headerName.indexOf("id") !== -1 || headerName.indexOf("no") !== -1 || headerName.indexOf("status") !== -1 || headerName.indexOf("date") !== -1 || headerName.indexOf("timestamp") !== -1 || headerName.indexOf("warranty") !== -1) {
        colRange.setHorizontalAlignment("center");
      }
      // Left align for Names, Notes, Text
      else {
        colRange.setHorizontalAlignment("left");
      }
      
      // Formatting Currency
      if (headerName.indexOf("price") !== -1) {
        colRange.setNumberFormat("$#,##0.00");
      }
      
      // Formatting Dates
      if (headerName.indexOf("date") !== -1 || headerName.indexOf("timestamp") !== -1 || headerName.indexOf("updated") !== -1) {
        colRange.setNumberFormat("yyyy-mm-dd hh:mm");
      }
      
      // Dynamic status coloring (Soft pastel colors)
      if (colIdx + 1 === statusColIndex) {
        for (var row = 2; row <= lastRow; row++) {
          var cell = sheet.getRange(row, colIdx + 1);
          var val = cell.getValue().toString().toLowerCase().trim();
          
          if (val === "available" || val === "in") {
            cell.setBackground("#D1FAE5").setFontColor("#065F46").setFontWeight("bold"); // Light Green theme
          } else if (val === "sold" || val === "out") {
            cell.setBackground("#FEE2E2").setFontColor("#991B1B").setFontWeight("bold"); // Light Red theme
          } else if (val === "hold") {
            cell.setBackground("#FEF3C7").setFontColor("#92400E").setFontWeight("bold"); // Light Amber theme
          }
        }
      }
    }
  }
  
  // Auto-resize columns and add dynamic margin
  sheet.autoResizeColumns(1, lastCol);
  for (var col = 1; col <= lastCol; col++) {
    var width = sheet.getColumnWidth(col);
    sheet.setColumnWidth(col, Math.max(90, width + 15)); // Add breathing room
  }
}

function updateOrAddScooter(doc, scoot) {
  var sheet = doc.getSheetByName("ScooterUnits");
  var values = sheet.getDataRange().getValues();
  var rowIdx = -1;
  
  for (var i = 1; i < values.length; i++) {
    if (values[i][0] === scoot.id) {
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
    scoot.tireSize,
    scoot.buyerName || "",
    scoot.buyerContact || "",
    (scoot.batterySerials || []).join(", "),
    scoot.status,
    scoot.scooterWarrantyStatus || "None",
    scoot.batteryWarrantyStatus || "None",
    scoot.lastUpdatedTimestamp,
    scoot.createdOperator || ""
  ];
  
  if (rowIdx !== -1) {
    sheet.getRange(rowIdx, 1, 1, rowData.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }
  applyProfessionalFormatting(sheet, true, 11); // column 11 is status
}

function syncAllData(doc, data) {
  // Products
  var prodSheet = getOrCreateSheet(doc, "Products", ["Product ID", "Model Name", "Available Colors"]);
  prodSheet.clearContents();
  prodSheet.appendRow(["Product ID", "Model Name", "Available Colors"]);
  (data.products || []).forEach(function(p) {
    prodSheet.appendRow([p.id, p.name, p.colors.join(", ")]);
  });
  applyProfessionalFormatting(prodSheet, true, 0);
  
  // Buyers
  var buySheet = getOrCreateSheet(doc, "Buyers", ["Buyer ID", "Buyer Name", "Contact Details"]);
  buySheet.clearContents();
  buySheet.appendRow(["Buyer ID", "Buyer Name", "Contact Details"]);
  (data.buyers || []).forEach(function(b) {
    buySheet.appendRow([b.id, b.name, b.contact || ""]);
  });
  applyProfessionalFormatting(buySheet, true, 0);
  
  // StockLogs
  var stockSheet = getOrCreateSheet(doc, "StockLogs", ["Log ID", "Model Name", "Color", "Type (IN/OUT)", "Source Channel", "Quantity", "Buyer", "Timestamp", "Operator", "Notes"]);
  stockSheet.clearContents();
  stockSheet.appendRow(["Log ID", "Model Name", "Color", "Type (IN/OUT)", "Source Channel", "Quantity", "Buyer", "Timestamp", "Operator", "Notes"]);
  (data.stockLogs || []).forEach(function(log) {
    stockSheet.appendRow([log.id, log.modelName, log.color, log.type.toUpperCase(), log.sourceChannel || "", log.quantity, log.buyerName || "", log.timestamp, log.operator, log.notes || ""]);
  });
  applyProfessionalFormatting(stockSheet, true, 4); // Status index 4 is type (IN/OUT)
  
  // ScooterUnits
  var scootSheet = getOrCreateSheet(doc, "ScooterUnits", ["Scooter ID", "Model Name", "Color", "Chassis No", "Motor No", "Controller No", "Tires", "Buyer Name", "Buyer Contact", "Battery Serials", "Status", "Scooter Warranty", "Battery Warranty", "Last Updated", "Created By"]);
  scootSheet.clearContents();
  scootSheet.appendRow(["Scooter ID", "Model Name", "Color", "Chassis No", "Motor No", "Controller No", "Tires", "Buyer Name", "Buyer Contact", "Battery Serials", "Status", "Scooter Warranty", "Battery Warranty", "Last Updated", "Created By"]);
  (data.scooterUnits || []).forEach(function(scoot) {
    scootSheet.appendRow([
      scoot.id,
      scoot.modelName,
      scoot.color,
      scoot.chassisNo,
      scoot.motorNo,
      scoot.controllerNo,
      scoot.tireSize,
      scoot.buyerName || "",
      scoot.buyerContact || "",
      (scoot.batterySerials || []).join(", "),
      scoot.status,
      scoot.scooterWarrantyStatus || "None",
      scoot.batteryWarrantyStatus || "None",
      scoot.lastUpdatedTimestamp,
      scoot.createdOperator || ""
    ]);
  });
  applyProfessionalFormatting(scootSheet, true, 11); // Status column 11
  
  // BatterySales
  var batSalesSheet = getOrCreateSheet(doc, "BatterySales", ["Sale ID", "Buyer Name", "Battery Series", "Start Serial No", "End Serial No", "Quantity", "Sale Date", "Operator", "Notes", "Under Warranty", "Warranty Months", "Status", "Held For", "Held By", "Hold Date"]);
  batSalesSheet.clearContents();
  batSalesSheet.appendRow(["Sale ID", "Buyer Name", "Battery Series", "Start Serial No", "End Serial No", "Quantity", "Sale Date", "Operator", "Notes", "Under Warranty", "Warranty Months", "Status", "Held For", "Held By", "Hold Date"]);
  (data.batterySales || []).forEach(function(s) {
    batSalesSheet.appendRow([
      s.id,
      s.buyerName,
      s.batterySeries,
      s.startNo || "N/A",
      s.endNo || "N/A",
      s.quantity,
      s.saleDate,
      s.operator,
      s.notes || "",
      s.isUnderWarranty ? "Yes" : "No",
      s.warrantyDurationMonths || "N/A",
      s.status,
      s.heldFor || "",
      s.heldBy || "",
      s.holdDate || ""
    ]);
  });
  applyProfessionalFormatting(batSalesSheet, true, 12); // column 12 is status
  
  // BatteryImports
  var batImportsSheet = getOrCreateSheet(doc, "BatteryImports", ["Import ID", "Battery Series", "Start Serial No", "End Serial No", "Quantity", "Import Date", "Operator", "Supplier Name", "Container ID", "Notes"]);
  batImportsSheet.clearContents();
  batImportsSheet.appendRow(["Import ID", "Battery Series", "Start Serial No", "End Serial No", "Quantity", "Import Date", "Operator", "Supplier Name", "Container ID", "Notes"]);
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
}

// Masterpiece dashboard rebuilding engine
function rebuildExecutiveDashboard(doc, data) {
  var dashboardSheet = doc.getSheetByName("Dashboard");
  if (!dashboardSheet) {
    dashboardSheet = doc.insertSheet("Dashboard");
  }
  
  // Ensure dashboard is always the very first visible sheet tab
  doc.setActiveSheet(dashboardSheet);
  doc.moveActiveSheet(1);
  
  // Clear everything & turn off default grid lines to look like an expert web app control deck
  dashboardSheet.clear();
  dashboardSheet.setGridlinesVisible(false);
  
  // Compute key stats for indicators
  var totalImported = 0;
  var stockLogs = data.stockLogs || [];
  for (var i = 0; i < stockLogs.length; i++) {
    if (stockLogs[i].type && stockLogs[i].type.toLowerCase() === "in") {
      totalImported += Number(stockLogs[i].quantity || 0);
    }
  }
  
  var scooterUnits = data.scooterUnits || [];
  var totalAssembled = scooterUnits.length;
  var availableStock = 0;
  var totalSold = 0;
  var totalHold = 0;
  for (var i = 0; i < scooterUnits.length; i++) {
    var st = scooterUnits[i].status ? scooterUnits[i].status.toLowerCase().trim() : "";
    if (st === "available") {
      availableStock++;
    } else if (st === "sold") {
      totalSold++;
    } else if (st === "hold") {
      totalHold++;
    }
  }
  
  // 1. Setup Column Widths for clean grid rhythm
  dashboardSheet.setColumnWidth(1, 24);   // Left margin spacing
  dashboardSheet.setColumnWidth(2, 220);  // Column 1 values
  dashboardSheet.setColumnWidth(3, 110);  // Column 2 values
  dashboardSheet.setColumnWidth(4, 30);   // Spacer column
  dashboardSheet.setColumnWidth(5, 160);  // Col breakdown Col 1
  dashboardSheet.setColumnWidth(6, 110);  // Col breakdown Col 2
  dashboardSheet.setColumnWidth(7, 100);  // Col breakdown Col 3
  dashboardSheet.setColumnWidth(8, 100);  // Col breakdown Col 4
  dashboardSheet.setColumnWidth(9, 100);  // Col breakdown Col 5
  dashboardSheet.setColumnWidth(10, 100); // Col breakdown Col 6
  
  // Set default fonts and size for Dashboard
  dashboardSheet.getRange("A1:K100").setFontFamily("Inter");
  
  // 2. Main Executive Header Banner
  var headerRange = dashboardSheet.getRange("B2:J4");
  headerRange.merge();
  headerRange.setValue("⚡ EXECUTIVE WAREHOUSE REGISTRY & CONTROL SYSTEM\nReal-Time Executive Operations Platform | Live Assembly & Inventory ledger");
  headerRange.setBackground("#0F172A") // Slate 900
             .setFontColor("#FFFFFF")
             .setFontSize(13)
             .setFontWeight("bold")
             .setHorizontalAlignment("left")
             .setVerticalAlignment("middle")
             .setWrap(true)
             .setBorder(true, true, true, true, false, false, "#0F172A", SpreadsheetApp.BorderStyle.SOLID);
  
  // 3. Draw Beautiful KPI Cards (3 columns wide cards with distinct styling)
  drawKPICard(dashboardSheet, "B6:C6", "B7:C8", "ASSEMBLIES REGISTERED", totalAssembled, "#F1F5F9", "#1E293B"); // Slate Theme
  drawKPICard(dashboardSheet, "E6:F6", "E7:F8", "AVAILABLE WAREHOUSE STOCK", availableStock, "#E0F2FE", "#0369A1"); // Sky Blue Theme
  drawKPICard(dashboardSheet, "H6:I6", "H7:I8", "DISPATCHED / SOLD UNITS", totalSold, "#D1FAE5", "#047857"); // Green Theme
  
  // 4. Summary Table - Key Operational Metrics
  var summaryTitle = dashboardSheet.getRange("B10:C10");
  summaryTitle.merge();
  summaryTitle.setValue("EXECUTIVE PERFORMANCE INDICATORS");
  summaryTitle.setBackground("#334155") // Slate 700
              .setFontColor("#FFFFFF")
              .setFontSize(9)
              .setFontWeight("bold")
              .setHorizontalAlignment("center")
              .setVerticalAlignment("middle");
  dashboardSheet.setRowHeight(10, 26);
  
  var summaryStats = data.summaryStats || [];
  if (summaryStats.length === 0) {
    // Generate default fallback stats if empty
    summaryStats = [
      { metric: "Total Raw Imported Logs", value: totalImported, description: "Total generic incoming stock logs" },
      { metric: "Completed Assemblies", value: totalAssembled, description: "Frames with unique serials assigned" },
      { metric: "Units Available on Floor", value: availableStock, description: "Physical finished units available" },
      { metric: "Units On Hold / Reserved", value: totalHold, description: "Units allocated for pre-orders" },
      { metric: "Unassembled Inventory Left", value: Math.max(0, totalImported - totalAssembled), description: "Stock awaiting assembly line" }
    ];
  }
  
  // Write Summary Table rows
  var curRow = 11;
  for (var i = 0; i < summaryStats.length; i++) {
    dashboardSheet.getRange(curRow, 2).setValue(summaryStats[i].metric).setFontWeight("bold").setFontSize(9).setFontColor("#475569");
    dashboardSheet.getRange(curRow, 3).setValue(summaryStats[i].value).setFontWeight("bold").setFontSize(10).setFontColor("#0F172A").setHorizontalAlignment("right");
    
    // Formatting currency where appropriate
    if (summaryStats[i].metric.indexOf("Price") !== -1 || summaryStats[i].metric.indexOf("Revenue") !== -1 || summaryStats[i].metric.indexOf("Valuation") !== -1) {
      dashboardSheet.getRange(curRow, 3).setNumberFormat("$#,##0.00");
    }
    
    // Zebra background styling for key metrics
    var bg = (curRow % 2 === 0) ? "#FFFFFF" : "#F8FAFC";
    dashboardSheet.getRange(curRow, 2, 1, 2).setBackground(bg).setBorder(true, true, true, true, true, true, "#E2E8F0", SpreadsheetApp.BorderStyle.SOLID);
    dashboardSheet.setRowHeight(curRow, 22);
    curRow++;
  }
  
  // 5. Stock breakdown table (Color & Models Breakdown)
  var breakdownTitle = dashboardSheet.getRange("E10:J10");
  breakdownTitle.merge();
  breakdownTitle.setValue("PRODUCT & COLOR CONFIGURATION BREAKDOWN");
  breakdownTitle.setBackground("#334155") // Slate 700
                .setFontColor("#FFFFFF")
                .setFontSize(9)
                .setFontWeight("bold")
                .setHorizontalAlignment("center")
                .setVerticalAlignment("middle");
                
  var breakdownHeaders = ["Model Name", "Color", "Available", "Sold", "Total Reg.", "Imported"];
  for (var b = 0; b < breakdownHeaders.length; b++) {
    var cell = dashboardSheet.getRange(11, 5 + b);
    cell.setValue(breakdownHeaders[b]);
    cell.setBackground("#475569") // Slate 600
        .setFontColor("#FFFFFF")
        .setFontSize(8)
        .setFontWeight("bold")
        .setHorizontalAlignment("center")
        .setVerticalAlignment("middle");
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
    rowRange.setBackground(bg)
            .setFontSize(9)
            .setBorder(true, true, true, true, true, true, "#E2E8F0", SpreadsheetApp.BorderStyle.SOLID);
    dashboardSheet.setRowHeight(brRow, 22);
    brRow++;
  }
}

function drawKPICard(sheet, titleCellRange, valueCellRange, titleText, valueVal, themeColor, textCol) {
  var tRange = sheet.getRange(titleCellRange);
  tRange.merge();
  tRange.setValue(titleText);
  tRange.setBackground(themeColor);
  tRange.setFontSize(8).setFontWeight("bold").setFontColor(textCol).setFontFamily("Inter").setHorizontalAlignment("center").setVerticalAlignment("middle");
  
  var vRange = sheet.getRange(valueCellRange);
  vRange.merge();
  vRange.setValue(valueVal);
  vRange.setBackground(themeColor);
  vRange.setFontSize(20).setFontWeight("bold").setFontColor(textCol).setFontFamily("Inter").setHorizontalAlignment("center").setVerticalAlignment("middle");
  
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
