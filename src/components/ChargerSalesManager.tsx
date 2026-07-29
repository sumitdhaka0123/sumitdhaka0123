import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Zap, Plus, Sparkles, User, Calendar, ClipboardList, CheckCircle2, 
  AlertCircle, Search, ShieldAlert, Ban, Timer, Check, Info, ShieldCheck, RefreshCw, X
} from 'lucide-react';
import { Buyer, ChargerSale, ChargerImport, ScooterUnit, BatterySale } from '../types';
import { inspectChallanNumber, isChallanRestrictedForUser } from '../utils/challanUtils';
import { ChallanStatusCard } from './ChallanStatusCard';

interface ChargerSalesManagerProps {
  buyers: Buyer[];
  chargerSales: ChargerSale[];
  chargerImports?: ChargerImport[];
  chargerTypesList: string[];
  scooterUnits?: ScooterUnit[];
  batterySales?: BatterySale[];
  currentUser: any;
  onRefresh: () => void;
  onSubmitChargerSale: (data: {
    buyerName: string;
    chargerType: string;
    startNo: string;
    endNo: string;
    quantity: number;
    notes?: string;
    isUnderWarranty?: boolean;
    warrantyDurationMonths?: number;
    status?: 'sold' | 'hold';
    heldFor?: string;
    serialNumbers?: string[];
  }) => Promise<boolean>;
  onSubmitChargerImport: (data: {
    chargerType: string;
    startNo: string;
    endNo: string;
    quantity: number;
    supplierName?: string;
    containerId?: string;
    notes?: string;
    serialNumbers?: string[];
  }) => Promise<boolean>;
  onReleaseHold: (id: string) => Promise<boolean>;
  onFinalizeHold: (id: string) => Promise<boolean>;
  isPipelineView?: boolean;
  onAddBuyer?: (
    name: string,
    contact?: string,
    address?: string,
    gstNo?: string,
    addressProof?: string,
    buyerType?: 'retail' | 'wholesale'
  ) => Promise<boolean>;
}

export default function ChargerSalesManager({
  buyers,
  chargerSales = [],
  chargerImports = [],
  chargerTypesList = [],
  scooterUnits = [],
  batterySales = [],
  currentUser,
  onRefresh,
  onSubmitChargerSale,
  onSubmitChargerImport,
  onReleaseHold,
  onFinalizeHold,
  isPipelineView = false,
  onAddBuyer
}: ChargerSalesManagerProps) {
  // Add sale form state
  const [buyerName, setBuyerName] = useState('');
  const [buyerContact, setBuyerContact] = useState('');
  const [buyerAddress, setBuyerAddress] = useState('');
  const [chargerType, setChargerType] = useState(chargerTypesList[0] || '48V Charger');
  const [startNo, setStartNo] = useState('');
  const [endNo, setEndNo] = useState('');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [deliveryChallanNo, setDeliveryChallanNo] = useState('');
  const [billNo, setBillNo] = useState('');
  const [submitMode, setSubmitMode] = useState<'sold' | 'hold' | 'attach_challan'>('sold');

  // Collect active pending delivery challan numbers for chargers
  const activeChallanNumbers = useMemo(() => {
    const set = new Set<string>();
    if (chargerSales) {
      chargerSales.forEach(s => {
        if (s.deliveryChallanNo && s.challanStatus !== 'finished') set.add(s.deliveryChallanNo.toUpperCase());
      });
    }
    if (scooterUnits) {
      scooterUnits.forEach(u => {
        if (u.deliveryChallanNo && u.challanStatus !== 'finished') set.add(u.deliveryChallanNo.toUpperCase());
      });
    }
    if (batterySales) {
      batterySales.forEach(b => {
        if (b.deliveryChallanNo && b.challanStatus !== 'finished') set.add(b.deliveryChallanNo.toUpperCase());
      });
    }
    return Array.from(set);
  }, [chargerSales, scooterUnits, batterySales]);

  // Inspect current Delivery Challan Number
  const currentChallanInfo = useMemo(() => {
    return inspectChallanNumber(deliveryChallanNo, scooterUnits, batterySales, chargerSales);
  }, [deliveryChallanNo, scooterUnits, batterySales, chargerSales]);

  // Auto-fill or reset buyer details and bill number when delivery challan number changes
  useEffect(() => {
    if (submitMode === 'attach_challan') {
      const cleanNo = deliveryChallanNo.trim();
      if (!cleanNo) {
        setBuyerName('');
        setBuyerContact('');
        setBuyerAddress('');
        setBillNo('');
        return;
      }

      if (currentChallanInfo.exists && !currentChallanInfo.isFinished) {
        const name = currentChallanInfo.buyerName || '';
        const contact = currentChallanInfo.buyerContact || '';
        const bill = currentChallanInfo.billNo || '';
        setBuyerName(name);
        setBuyerContact(contact);
        setBillNo(bill);

        const matchedBuyer = buyers.find(b => b.name.toLowerCase() === name.toLowerCase());
        setBuyerAddress(matchedBuyer?.address || '');
      } else {
        // Reset buyer fields completely when entering a new/unregistered challan number
        setBuyerName('');
        setBuyerContact('');
        setBuyerAddress('');
        setBillNo('');
      }
    }
  }, [deliveryChallanNo, currentChallanInfo, submitMode, buyers]);

  // Auto-populate contact and address info when standard buyer is selected
  useEffect(() => {
    const trimmed = buyerName.trim();
    if (!trimmed) {
      setBuyerContact('');
      setBuyerAddress('');
      return;
    }
    const selectedBuyer = buyers.find(b => b.name.toLowerCase() === trimmed.toLowerCase());
    if (selectedBuyer) {
      setBuyerContact(selectedBuyer.contact || '');
      setBuyerAddress(selectedBuyer.address || '');
    }
  }, [buyerName, buyers]);
  
  // Warranty Flow State
  const [isUnderWarranty, setIsUnderWarranty] = useState<boolean | null>(true);
  const [warrantyDuration, setWarrantyDuration] = useState<number | null>(12);

  // Scanning Integration States (Sales)
  const [inputMethod, setInputMethod] = useState<'range' | 'scan'>('range');
  const [showScanner, setShowScanner] = useState(false);
  const [scannedSerials, setScannedSerials] = useState<string[]>([]);

  // Scanning Integration States (Imports)
  const [importInputMethod, setImportInputMethod] = useState<'range' | 'scan'>('range');
  const [showImportScanner, setShowImportScanner] = useState(false);
  const [scannedImportSerials, setScannedImportSerials] = useState<string[]>([]);

  // Collect all registered charger serial numbers to prevent duplicates
  const allRegisteredChargerSerials = useMemo(() => {
    const list: string[] = [];
    if (chargerImports && Array.isArray(chargerImports)) {
      chargerImports.forEach(imp => {
        if (imp.serialNumbers) {
          list.push(...imp.serialNumbers);
        }
      });
    }
    if (chargerSales && Array.isArray(chargerSales)) {
      chargerSales.forEach(sale => {
        if (sale.serialNumbers) {
          list.push(...sale.serialNumbers);
        }
      });
    }
    return list;
  }, [chargerImports, chargerSales]);

  // Submit and loading states
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Import form state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importType, setImportType] = useState(chargerTypesList[0] || '48V Charger');
  const [importStartNo, setImportStartNo] = useState('');
  const [importEndNo, setImportEndNo] = useState('');
  const [importQty, setImportQty] = useState('');
  const [importSupplier, setImportSupplier] = useState('');
  const [importContainer, setImportContainer] = useState('');
  const [importNotes, setImportNotes] = useState('');
  const [importSaving, setImportSaving] = useState(false);
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Tab within Charger Ledger Section
  const [managerTab, setManagerTab] = useState<'sales' | 'inventory'>('sales');

  // Searching & lookup states
  const [searchQuery, setSearchQuery] = useState('');
  const [lookupQuery, setLookupQuery] = useState('');
  const [actingOnId, setActingOnId] = useState<string | null>(null);
  const [selectedDetailSale, setSelectedDetailSale] = useState<ChargerSale | null>(null);

  // Set default type on list load
  React.useEffect(() => {
    if (chargerTypesList.length > 0 && !chargerTypesList.includes(chargerType)) {
      setChargerType(chargerTypesList[0]);
    }
    if (chargerTypesList.length > 0 && !chargerTypesList.includes(importType)) {
      setImportType(chargerTypesList[0]);
    }
  }, [chargerTypesList]);

  // Calculation of stock per charger type
  const typeStockMap = useMemo(() => {
    const map: Record<string, { imported: number; soldStandalone: number; available: number }> = {};

    // Initialize map with all customizable charger types
    chargerTypesList.forEach(t => {
      map[t] = { imported: 0, soldStandalone: 0, available: 0 };
    });

    // 1. Process Imports
    chargerImports.forEach(imp => {
      const type = imp.chargerType;
      if (!map[type]) {
        map[type] = { imported: 0, soldStandalone: 0, available: 0 };
      }
      map[type].imported += imp.quantity;
    });

    // 2. Process Sales/Holds
    chargerSales.forEach(sale => {
      const type = sale.chargerType;
      if (!map[type]) {
        map[type] = { imported: 0, soldStandalone: 0, available: 0 };
      }
      map[type].soldStandalone += sale.quantity;
    });

    // 3. Calculate Available Stock
    Object.keys(map).forEach(key => {
      const entry = map[key];
      entry.available = Math.max(0, entry.imported - entry.soldStandalone);
    });

    return map;
  }, [chargerImports, chargerSales, chargerTypesList]);

  // Auto-calculate quantity helper when start/end numbers are updated
  // Helper to calculate end serial from start serial and quantity
  const calculateEndNo = (start: string, qtyStr: string): string => {
    if (!start || !qtyStr) return '';
    const qty = parseInt(qtyStr, 10);
    if (isNaN(qty) || qty <= 0) return '';

    const match = start.trim().toUpperCase().match(/^([A-Z0-9\-_]*?)(\d+)$/);
    if (match) {
      const prefix = match[1];
      const startNum = parseInt(match[2], 10);
      const numDigits = match[2].length;
      const endNum = startNum + qty - 1;
      const paddedEndNum = String(endNum).padStart(numDigits, '0');
      return `${prefix}${paddedEndNum}`;
    }
    return '';
  };

  const calculateQtyFromRange = (start: string, end: string) => {
    if (!start || !end) return;
    const startMatch = start.match(/\d+$/);
    const endMatch = end.match(/\d+$/);
    if (startMatch && endMatch) {
      const startNum = parseInt(startMatch[0], 10);
      const endNum = parseInt(endMatch[0], 10);
      if (endNum >= startNum) {
        const calculated = endNum - startNum + 1;
        setQuantity(String(calculated));
      }
    }
  };

  const handleStartOrEndChange = (type: 'start' | 'end', value: string) => {
    if (type === 'start') {
      setStartNo(value);
      if (quantity && parseInt(quantity, 10) > 0) {
        const autoEnd = calculateEndNo(value, quantity);
        if (autoEnd) setEndNo(autoEnd);
      } else if (endNo) {
        calculateQtyFromRange(value, endNo);
      }
    } else {
      setEndNo(value);
      if (startNo) {
        calculateQtyFromRange(startNo, value);
      }
    }
  };

  const handleQuantityChange = (val: string) => {
    setQuantity(val);
    if (startNo && val) {
      const autoEnd = calculateEndNo(startNo, val);
      if (autoEnd) setEndNo(autoEnd);
    }
  };

  const handleImportStartOrEndChange = (type: 'start' | 'end', value: string) => {
    if (type === 'start') {
      setImportStartNo(value);
      calculateImportQty(value, importEndNo);
    } else {
      setImportEndNo(value);
      calculateImportQty(importStartNo, value);
    }
  };

  const calculateImportQty = (start: string, end: string) => {
    if (!start || !end) return;
    const cleanStart = start.replace(/\D/g, '');
    const cleanEnd = end.replace(/\D/g, '');
    if (cleanStart && cleanEnd) {
      const s = parseInt(cleanStart, 10);
      const e = parseInt(cleanEnd, 10);
      if (e >= s) {
        setImportQty(String(e - s + 1));
      }
    }
  };

  // Submit Sale / Hold Form
  const handleFormSubmit = async (e?: React.FormEvent, overrideMode?: 'sold' | 'hold' | 'attach_challan') => {
    if (e) e.preventDefault();
    setStatus(null);

    const activeMode = overrideMode || submitMode;

    if (currentChallanInfo.cleanNo && currentChallanInfo.isFinished) {
      setStatus({ 
        type: 'error', 
        text: `⛔ Delivery Challan #${currentChallanInfo.cleanNo} is FINISHED & VERIFIED! This challan is locked. You cannot attach items to a finished challan. Please use a NEW, unique Delivery Challan Number.` 
      });
      return;
    }

    if (!isPipelineView && !buyerName.trim()) {
      setStatus({ type: 'error', text: 'Please enter a buyer name.' });
      return;
    }
    if (!chargerType) {
      setStatus({ type: 'error', text: 'Please select a charger type.' });
      return;
    }

    let finalStartNo = 'N/A';
    let finalEndNo = 'N/A';
    let qtyNum = parseInt(quantity, 10);

    if (isUnderWarranty) {
      if (warrantyDuration === null) {
        setStatus({ type: 'error', text: 'Please select a warranty duration.' });
        return;
      }
      if (inputMethod === 'scan') {
        if (scannedSerials.length === 0) {
          setStatus({ type: 'error', text: 'Please scan or register at least one charger serial number.' });
          return;
        }
        qtyNum = scannedSerials.length;
        finalStartNo = scannedSerials[0];
        finalEndNo = scannedSerials[scannedSerials.length - 1];
      } else {
        if (!startNo.trim()) {
          setStatus({ type: 'error', text: 'Starting serial number is required for under-warranty chargers.' });
          return;
        }
        finalStartNo = startNo.trim().toUpperCase();

        if (endNo.trim()) {
          finalEndNo = endNo.trim().toUpperCase();
        } else if (qtyNum > 0) {
          const autoEnd = calculateEndNo(finalStartNo, String(qtyNum));
          finalEndNo = autoEnd || finalStartNo;
        } else {
          finalEndNo = finalStartNo;
        }

        // Validate range if end matches digits
        const startMatch = finalStartNo.match(/\d+$/);
        const endMatch = finalEndNo.match(/\d+$/);
        if (startMatch && endMatch) {
          const sNum = parseInt(startMatch[0], 10);
          const eNum = parseInt(endMatch[0], 10);
          if (eNum >= sNum) {
            const calculatedQty = eNum - sNum + 1;
            qtyNum = Math.max(qtyNum, calculatedQty);
          } else {
            setStatus({ type: 'error', text: 'Ending serial number must be greater than or equal to starting serial number.' });
            return;
          }
        }
      }
    } else {
      // Not under warranty - just validate quantity input
      if (isNaN(qtyNum) || qtyNum <= 0) {
        setStatus({ type: 'error', text: 'Please enter a valid positive quantity.' });
        return;
      }
      finalStartNo = startNo.trim() || 'N/A';
      finalEndNo = endNo.trim() || 'N/A';
    }

    // Check available stock
    const currentAvailable = typeStockMap[chargerType]?.available || 0;
    if (qtyNum > currentAvailable) {
      setStatus({ 
        type: 'error', 
        text: `Insufficient stock! Only ${currentAvailable} units of ${chargerType} are available.` 
      });
      return;
    }

    if (!isPipelineView && activeMode === 'sold') {
      const cleanChallan = deliveryChallanNo.trim().toUpperCase();
      if (!cleanChallan) {
        setStatus({ 
          type: 'error', 
          text: '❌ Delivery Challan Number is MANDATORY for Direct Sale / Dispatch. Please enter a unique Delivery Challan Number.' 
        });
        return;
      }

      const isExisting = activeChallanNumbers.some(cNo => cNo.toUpperCase() === cleanChallan) || (currentChallanInfo.exists && currentChallanInfo.cleanNo === cleanChallan);
      if (isExisting) {
        setStatus({ 
          type: 'error', 
          text: `❌ Delivery Challan #${cleanChallan} already exists as an active pending challan. Direct Sale / Dispatch requires a BRAND NEW unique Delivery Challan Number. If you want to attach items to this existing challan, please switch to 'Attach Challan' mode.` 
        });
        return;
      }
    }

    if (!isPipelineView && activeMode === 'attach_challan') {
      const cleanChallan = deliveryChallanNo.trim().toUpperCase();
      if (!cleanChallan) {
        setStatus({ 
          type: 'error', 
          text: '❌ Delivery Challan Number is 100% MANDATORY to attach chargers to a Delivery Challan! Please select or enter an active Delivery Challan Number.' 
        });
        return;
      }

      const existsInPending = activeChallanNumbers.some(cNo => cNo.toUpperCase() === cleanChallan) || (currentChallanInfo.exists && !currentChallanInfo.isFinished);
      if (!existsInPending) {
        setStatus({ 
          type: 'error', 
          text: `❌ Delivery Challan #${cleanChallan} does not exist. In 'Attach Challan' mode, you can only attach items to an existing active Delivery Challan. Please select an active pending challan or switch to 'Direct Sale / Dispatch' mode to create a new dispatch.` 
        });
        return;
      }
    }

    setSaving(true);
    setStatus(null);

    // Auto-register new buyer if they are not in the database
    const finalBuyerName = buyerName.trim();
    if (finalBuyerName) {
      const buyerExists = buyers.some(b => b.name.toLowerCase() === finalBuyerName.toLowerCase());
      if (!buyerExists && onAddBuyer) {
        await onAddBuyer(finalBuyerName, buyerContact.trim() || undefined, buyerAddress.trim() || undefined, undefined, undefined, 'retail');
      }
    }

    const data = {
      buyerName: buyerName.trim(),
      chargerType,
      startNo: finalStartNo,
      endNo: finalEndNo,
      quantity: qtyNum,
      notes: notes.trim() || undefined,
      isUnderWarranty: !!isUnderWarranty,
      warrantyDurationMonths: isUnderWarranty ? Number(warrantyDuration) : undefined,
      status: activeMode === 'hold' ? 'hold' : 'sold',
      heldFor: activeMode === 'hold' ? buyerName.trim() : undefined,
      serialNumbers: (inputMethod === 'scan' && scannedSerials.length > 0)
        ? scannedSerials
        : (finalStartNo !== 'N/A' && finalEndNo !== 'N/A')
        ? generateSerialRange(finalStartNo, finalEndNo, qtyNum)
        : undefined,
      deliveryChallanNo: deliveryChallanNo.trim().toUpperCase(),
      billNo: billNo.trim().toUpperCase()
    };

    const success = await onSubmitChargerSale(data as any);
    setSaving(false);

    if (success) {
      setStatus({ 
        type: 'success', 
        text: activeMode === 'hold' 
          ? `Successfully put ${qtyNum} units of ${chargerType} on HOLD for ${buyerName}.` 
          : activeMode === 'attach_challan'
          ? `Successfully attached ${qtyNum} units of ${chargerType} to Delivery Challan #${deliveryChallanNo.trim().toUpperCase()}.`
          : `Successfully registered sale of ${qtyNum} units of ${chargerType} to ${buyerName}.`
      });
      // Reset
      setBuyerName('');
      setBuyerContact('');
      setBuyerAddress('');
      setStartNo('');
      setEndNo('');
      setQuantity('');
      setNotes('');
      setDeliveryChallanNo('');
      setBillNo('');
      setBuyerAddress('');
      setStartNo('');
      setEndNo('');
      setQuantity('');
      setNotes('');
      setScannedSerials([]);
      onRefresh();
    } else {
      setStatus({ type: 'error', text: 'Server rejected the request. Please try again.' });
    }
  };

  // Submit Import Form
  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let finalStart = importStartNo.trim();
    let finalEnd = importEndNo.trim();
    let parsedQty = parseInt(importQty, 10);

    if (importInputMethod === 'scan') {
      if (scannedImportSerials.length === 0) {
        setImportStatus({ type: 'error', text: 'Please scan or register at least one imported charger.' });
        return;
      }
      parsedQty = scannedImportSerials.length;
      finalStart = scannedImportSerials[0];
      finalEnd = scannedImportSerials[scannedImportSerials.length - 1];
    } else {
      if (isNaN(parsedQty) || parsedQty <= 0) {
        setImportStatus({ type: 'error', text: 'Please specify a valid quantity.' });
        return;
      }
      if (!finalStart) finalStart = 'N/A';
      if (!finalEnd) finalEnd = 'N/A';
    }

    setImportSaving(true);
    setImportStatus(null);

    const success = await onSubmitChargerImport({
      chargerType: importType,
      startNo: finalStart,
      endNo: finalEnd,
      quantity: parsedQty,
      supplierName: importSupplier.trim() || undefined,
      containerId: importContainer.trim() || undefined,
      notes: importNotes.trim() || undefined,
      serialNumbers: importInputMethod === 'scan' ? scannedImportSerials : undefined
    });

    setImportSaving(false);
    if (success) {
      setImportStatus({ type: 'success', text: `Successfully registered import of ${parsedQty} units of ${importType}.` });
      setImportStartNo('');
      setImportEndNo('');
      setImportQty('');
      setImportSupplier('');
      setImportContainer('');
      setImportNotes('');
      setScannedImportSerials([]);
      onRefresh();
      setTimeout(() => {
        setShowImportModal(false);
        setImportStatus(null);
      }, 1500);
    } else {
      setImportStatus({ type: 'error', text: 'Server error while saving import batch.' });
    }
  };

  // Release hold handler
  const handleRelease = async (id: string) => {
    if (!window.confirm('Are you sure you want to cancel and release this hold reservation? The stock will return to generic available inventory.')) return;
    setActingOnId(id);
    const ok = await onReleaseHold(id);
    setActingOnId(null);
    if (ok) {
      onRefresh();
    } else {
      alert('Failed to release hold.');
    }
  };

  // Finalize hold handler
  const handleFinalize = async (id: string) => {
    if (!window.confirm('Finalize and dispatch this charger reservation? This converts the hold into a completed sale.')) return;
    setActingOnId(id);
    const ok = await onFinalizeHold(id);
    setActingOnId(null);
    if (ok) {
      onRefresh();
    } else {
      alert('Failed to finalize hold.');
    }
  };

  // Filtered sales ledger
  const filteredSales = useMemo(() => {
    let list = [...chargerSales];
    
    // Sort so holds/newest are easy to find
    list.sort((a, b) => new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime());

    const query = searchQuery.trim().toLowerCase();
    if (query) {
      list = list.filter(sale => 
        sale.buyerName.toLowerCase().includes(query) ||
        sale.chargerType.toLowerCase().includes(query) ||
        (sale.startNo && sale.startNo.toLowerCase().includes(query)) ||
        (sale.endNo && sale.endNo.toLowerCase().includes(query)) ||
        sale.operator.toLowerCase().includes(query) ||
        (sale.notes && sale.notes.toLowerCase().includes(query))
      );
    }
    return list;
  }, [chargerSales, searchQuery]);

  // Lookup results
  const lookupResult = useMemo(() => {
    const query = lookupQuery.trim().toLowerCase();
    if (!query) return null;

    // Search inside standalone charger sales first
    const matchedSale = chargerSales.find(s => {
      if (s.id.toLowerCase() === query) return true;
      if (s.startNo && s.startNo.toLowerCase().includes(query)) return true;
      if (s.endNo && s.endNo.toLowerCase().includes(query)) return true;
      
      // Check if query is a serial number range hit
      const sNo = s.startNo ? s.startNo.replace(/\D/g, '') : '';
      const eNo = s.endNo ? s.endNo.replace(/\D/g, '') : '';
      const qNo = query.replace(/\D/g, '');
      if (sNo && eNo && qNo) {
        const startVal = parseInt(sNo, 10);
        const endVal = parseInt(eNo, 10);
        const lookVal = parseInt(qNo, 10);
        if (lookVal >= startVal && lookVal <= endVal) {
          return true;
        }
      }
      return false;
    });

    if (matchedSale) return { type: 'sale', data: matchedSale };

    // Search inside imports
    const matchedImport = chargerImports.find(imp => {
      if (imp.id.toLowerCase() === query) return true;
      if (imp.startNo && imp.startNo.toLowerCase().includes(query)) return true;
      if (imp.endNo && imp.endNo.toLowerCase().includes(query)) return true;
      
      const sNo = imp.startNo ? imp.startNo.replace(/\D/g, '') : '';
      const eNo = imp.endNo ? imp.endNo.replace(/\D/g, '') : '';
      const qNo = query.replace(/\D/g, '');
      if (sNo && eNo && qNo) {
        const startVal = parseInt(sNo, 10);
        const endVal = parseInt(eNo, 10);
        const lookVal = parseInt(qNo, 10);
        if (lookVal >= startVal && lookVal <= endVal) {
          return true;
        }
      }
      return false;
    });

    if (matchedImport) return { type: 'import', data: matchedImport };

    return null;
  }, [chargerSales, chargerImports, lookupQuery]);

  if (isPipelineView) {
    return (
      <div id="charger-sales-manager-pipeline" className="space-y-4">
        <form onSubmit={handleFormSubmit} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex justify-between items-center border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Dispatch Standalone Charger</h2>
              <p className="text-xs text-slate-500 mt-0.5">Dispatch power charger units directly under a Delivery Challan Number.</p>
            </div>
          </div>

          {status && (
            <div className={`p-4 rounded-xl flex items-start gap-2 border text-sm ${
              status.type === 'success' 
                ? 'bg-emerald-50 text-emerald-800 border-emerald-100' 
                : 'bg-rose-50 text-rose-800 border-rose-100'
            }`}>
              {status.type === 'success' ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
              <span>{status.text}</span>
            </div>
          )}

          {/* Delivery Challan Primary Step when Attach Challan Mode is Active */}
          {submitMode === 'attach_challan' && (
            <div className="bg-cyan-50/90 border-2 border-cyan-400 p-4 rounded-2xl space-y-3 shadow-xs font-sans">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-cyan-950 uppercase tracking-wider flex items-center gap-1.5 font-sans">
                  🚚 Step 1: Select Active Delivery Challan
                </span>
                {deliveryChallanNo ? (
                  <span className="text-xs font-mono font-black text-cyan-900 bg-cyan-200 border border-cyan-400 px-2.5 py-1 rounded-lg shadow-2xs">
                    [ Challan #{deliveryChallanNo.toUpperCase()} ]
                  </span>
                ) : (
                  <span className="text-[11px] font-mono font-bold text-slate-500 bg-slate-200 border border-slate-300 px-2 py-0.5 rounded-lg">
                    [ Select Active Challan ]
                  </span>
                )}
              </div>

              {activeChallanNumbers.length > 0 ? (
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-extrabold text-cyan-900 uppercase tracking-wide font-sans">
                    Active Pending Challan Numbers (Click to Select):
                  </label>
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1 bg-white/80 rounded-xl border border-cyan-200">
                    {activeChallanNumbers.map((cNo) => {
                      const isSelected = deliveryChallanNo.toUpperCase() === cNo.toUpperCase();
                      return (
                        <button
                          key={cNo}
                          type="button"
                          onClick={() => setDeliveryChallanNo(cNo)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-mono font-black transition-all cursor-pointer border flex items-center gap-1.5 ${
                            isSelected
                              ? 'bg-cyan-700 text-white border-cyan-800 ring-2 ring-cyan-500/30 shadow-xs scale-105'
                              : 'bg-white text-cyan-900 border-cyan-300 hover:bg-cyan-100 hover:border-cyan-400'
                          }`}
                        >
                          <span>#{cNo}</span>
                          {isSelected && <Check className="h-3.5 w-3.5 text-cyan-200" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-[11px] font-medium text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200 font-sans">
                  ⚠️ No active pending Delivery Challans found. Enter a custom challan number below or create a new challan.
                </p>
              )}

              <div className="pt-2 border-t border-cyan-200/80 flex items-center gap-2 font-sans">
                <span className="text-[10px] font-bold text-cyan-900 uppercase shrink-0">Challan Number:</span>
                <input
                  type="text"
                  placeholder="e.g. DC-1001"
                  value={deliveryChallanNo}
                  onChange={(e) => setDeliveryChallanNo(e.target.value)}
                  className="w-full bg-white border border-cyan-300 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-mono font-bold uppercase outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-500"
                />
              </div>
            </div>
          )}

          {submitMode === 'attach_challan' && deliveryChallanNo.trim() && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center justify-between text-xs font-bold text-emerald-900 font-sans shadow-2xs">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                Attached to [ Challan #{deliveryChallanNo.toUpperCase()} ]
              </span>
              {currentChallanInfo.buyerName && (
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                  Buyer: {currentChallanInfo.buyerName}
                </span>
              )}
            </div>
          )}

          <div className={`grid grid-cols-1 ${!isPipelineView ? 'md:grid-cols-2' : ''} gap-4`}>
            {!isPipelineView && (
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Buyer / Customer Name *
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Enter customer or buyer name"
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    list="buyers-datalist"
                    className="w-full pl-9 pr-4 py-2.5 text-sm bg-slate-50 hover:bg-slate-100 focus:bg-white text-slate-800 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all"
                    required
                  />
                  <datalist id="buyers-datalist">
                    {buyers.map(b => (
                      <option key={b.id} value={b.name} />
                    ))}
                  </datalist>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Charger Type *
              </label>
              <select
                value={chargerType}
                onChange={(e) => setChargerType(e.target.value)}
                className="w-full px-4 py-2.5 text-sm bg-slate-50 hover:bg-slate-100 focus:bg-white text-slate-800 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all font-sans cursor-pointer font-bold"
                required
              >
                {chargerTypesList.map(type => {
                  const avail = typeStockMap[type]?.available || 0;
                  return (
                    <option key={type} value={type}>
                      {type} ({avail} Available in Warehouse)
                    </option>
                  );
                })}
              </select>

              {/* Stock Badge for Charger */}
              {(() => {
                const stock = typeStockMap[chargerType] || { imported: 0, soldStandalone: 0, available: 0 };
                return (
                  <div className="mt-2 p-2.5 rounded-xl border flex items-center justify-between text-xs font-sans transition-all bg-red-50/80 border-red-200">
                    <div className="flex items-center gap-2">
                      <span className="text-base">⚡</span>
                      <div>
                        <span className="font-extrabold text-red-950 block">
                          Available Stock: <span className="text-red-700 text-xs sm:text-sm font-black">{stock.available} Units</span>
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium">
                          Total Imported: {stock.imported} | Dispatched/Sold: {stock.soldStandalone}
                        </span>
                      </div>
                    </div>
                    {stock.available === 0 && (
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-300">
                        ⚠️ Out of Stock
                      </span>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Start Serial Number {isUnderWarranty && <span className="text-red-500">*</span>}
              </label>
              <input
                type="text"
                placeholder="e.g. CHG48-10001"
                value={startNo}
                onChange={(e) => handleStartOrEndChange('start', e.target.value)}
                className="w-full px-4 py-2.5 text-sm bg-slate-50 hover:bg-slate-100 focus:bg-white text-slate-800 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all placeholder:text-slate-400 font-mono font-bold"
                required={!!isUnderWarranty}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                End Serial Number {isUnderWarranty && <span className="text-red-500">*</span>}
              </label>
              <input
                type="text"
                placeholder="e.g. CHG48-10005"
                value={endNo}
                onChange={(e) => handleStartOrEndChange('end', e.target.value)}
                className="w-full px-4 py-2.5 text-sm bg-slate-50 hover:bg-slate-100 focus:bg-white text-slate-800 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all placeholder:text-slate-400 font-mono font-bold"
                required={!!isUnderWarranty}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Quantity *
              </label>
              <input
                type="number"
                placeholder="Specify units count (e.g. 20)"
                value={quantity}
                onChange={(e) => handleQuantityChange(e.target.value)}
                className="w-full px-4 py-2.5 text-sm bg-slate-50 hover:bg-slate-100 focus:bg-white text-slate-800 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all font-mono font-bold"
                required
              />
            </div>
          </div>

          {/* Warranty Questionnaire Section */}
          <div className="p-4 rounded-xl border border-slate-150 bg-slate-50 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Charger Warranty Status</h4>
                <p className="text-xs text-slate-500 mt-0.5">Is this standalone charger unit sold under warranty cover?</p>
              </div>
              
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsUnderWarranty(true);
                    setWarrantyDuration(12);
                  }}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                    isUnderWarranty === true 
                      ? 'bg-red-50 text-red-700 border-red-200' 
                      : 'bg-white text-slate-500 border-slate-200 hover:text-slate-700'
                  }`}
                >
                  Warranty Active
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsUnderWarranty(false);
                    setWarrantyDuration(0);
                  }}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                    isUnderWarranty === false 
                      ? 'bg-slate-200 text-slate-700 border-slate-300' 
                      : 'bg-white text-slate-500 border-slate-200 hover:text-slate-700'
                  }`}
                >
                  No Warranty
                </button>
              </div>
            </div>

            {isUnderWarranty && (
              <div className="pt-2 border-t border-slate-200">
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Warranty Duration
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm text-slate-700 font-medium cursor-pointer">
                    <input
                      type="radio"
                      name="chargerWarrantyMonths"
                      value={12}
                      checked={warrantyDuration === 12}
                      onChange={() => setWarrantyDuration(12)}
                      className="text-red-600 focus:ring-red-500"
                    />
                    12 Months (Standard)
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700 font-medium cursor-pointer">
                    <input
                      type="radio"
                      name="chargerWarrantyMonths"
                      value={13}
                      checked={warrantyDuration === 13}
                      onChange={() => setWarrantyDuration(13)}
                      className="text-red-600 focus:ring-red-500"
                    />
                    12+1 Months (Special promo)
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700 font-medium cursor-pointer">
                    <input
                      type="radio"
                      name="chargerWarrantyMonths"
                      value={6}
                      checked={warrantyDuration === 6}
                      onChange={() => setWarrantyDuration(6)}
                      className="text-red-600 focus:ring-red-500"
                    />
                    6 Months (Short duration)
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Bill Number & Delivery Challan Number Inputs (hidden in pipeline view since specified at dispatch level) */}
          {!isPipelineView && (
            <div className={`grid grid-cols-1 ${submitMode !== 'attach_challan' ? 'md:grid-cols-2' : ''} gap-4`}>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Sales Bill Number (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. BILL-9081 (optional)"
                  value={billNo}
                  onChange={(e) => setBillNo(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm bg-slate-50 hover:bg-slate-100 focus:bg-white text-slate-800 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all font-mono font-bold uppercase"
                />
              </div>

              {submitMode !== 'attach_challan' && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Delivery Challan Number (Mandatory) *
                    </label>
                    {deliveryChallanNo ? (
                      <span className="text-xs font-mono font-black text-red-800 bg-red-100 border border-red-300 px-2 py-0.5 rounded-md shadow-2xs">
                        [ Challan #{deliveryChallanNo.toUpperCase()} ]
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                        [ New Unique Challan ]
                      </span>
                    )}
                  </div>

                  <input
                    type="text"
                    placeholder="Enter a Delivery Challan No (e.g. DC-2005) *"
                    value={deliveryChallanNo}
                    onChange={(e) => setDeliveryChallanNo(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm bg-slate-50 hover:bg-slate-100 focus:bg-white text-slate-800 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all font-mono font-bold uppercase"
                    required
                  />
                  <ChallanStatusCard info={currentChallanInfo} currentUser={currentUser} />
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Dispatch Notes / Serial numbers checklist
            </label>
            <textarea
              rows={2}
              placeholder="Add special requests, courier details, invoice numbers, specific charger properties, etc."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-2 text-sm bg-slate-50 hover:bg-slate-100 focus:bg-white text-slate-800 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all placeholder:text-slate-400 resize-none font-sans"
            />
          </div>

          {/* Single Finishing Action Bar Button */}
          {!isPipelineView && (
            <div className="pt-2">
              <button
                type="submit"
                disabled={saving || currentChallanInfo.isFinished || isChallanRestrictedForUser(currentChallanInfo, currentUser)}
                className={`w-full py-3.5 font-sans font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-[0.98] text-white ${
                  submitMode === 'hold' 
                    ? 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800' 
                    : submitMode === 'attach_challan'
                    ? 'bg-cyan-700 hover:bg-cyan-800 active:bg-cyan-900'
                    : 'bg-red-600 hover:bg-red-700 active:bg-red-800'
                }`}
              >
                {saving ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : submitMode === 'hold' ? (
                  <>
                    <Timer className="h-4 w-4" />
                    <span>Place Chargers on Reservation Hold</span>
                  </>
                ) : submitMode === 'attach_challan' ? (
                  <>
                    <ClipboardList className="h-4 w-4" />
                    <span>
                      {deliveryChallanNo.trim()
                        ? `Attach Chargers to Challan #${deliveryChallanNo.trim().toUpperCase()}`
                        : 'Attach Chargers to Delivery Challan'}
                    </span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Complete Direct Sale / Dispatch</span>
                  </>
                )}
              </button>
            </div>
          )}
        </form>
      </div>
    );
  }

  return (
    <div id="charger-sales-manager" className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-red-50 text-red-600 rounded-xl">
              <Zap className="h-6 w-6" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Charger & Power Ledger</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">Manage standalone charger dispatches, reservation holds, imports, and live inventories.</p>
        </div>
        
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <button
            id="refresh-charger-btn"
            onClick={onRefresh}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-700 font-medium rounded-xl border border-slate-200 transition-colors cursor-pointer text-sm"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          
          {currentUser?.role !== 'salesperson' && (
            <button
              id="charger-import-btn"
              onClick={() => {
                setImportStatus(null);
                setShowImportModal(true);
              }}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-semibold rounded-xl transition-all shadow-sm cursor-pointer text-sm"
            >
              <Plus className="h-4 w-4" />
              Import New Charger Batch
            </button>
          )}
        </div>
      </div>

      {/* Grid Layout: Stock Overview & Interactive Sale Creator */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Inventory Stock Cards */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-red-500" />
              Live Charger Stocks
            </h2>
            
            <div className="space-y-4">
              {chargerTypesList.map(type => {
                const stock = typeStockMap[type] || { imported: 0, soldStandalone: 0, available: 0 };
                return (
                  <div key={type} className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-slate-800 text-sm">{type}</p>
                      <div className="flex gap-3 text-xs text-slate-500 mt-1">
                        <span>Imported: <strong className="text-slate-700">{stock.imported}</strong></span>
                        <span>Sold: <strong className="text-slate-700">{stock.soldStandalone}</strong></span>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold ${
                        stock.available > 10 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                          : stock.available > 0 
                            ? 'bg-amber-50 text-amber-700 border border-amber-100' 
                            : 'bg-rose-50 text-rose-700 border border-rose-100'
                      }`}>
                        {stock.available} Available
                      </span>
                    </div>
                  </div>
                );
              })}

              {chargerTypesList.length === 0 && (
                <div className="text-center py-6 text-slate-400 text-sm">
                  No charger types configured. Add them in settings tab.
                </div>
              )}
            </div>
          </div>

          {/* Quick Real-time Serial Tracker lookup */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="text-sm font-bold text-slate-700 mb-2">Charger Serial / ID Lookup</h3>
            <div className="relative">
              <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
              <input
                id="charger-lookup-input"
                type="text"
                placeholder="Search serial number range..."
                value={lookupQuery}
                onChange={(e) => setLookupQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 hover:bg-slate-100 focus:bg-white text-slate-800 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all placeholder:text-slate-400"
              />
            </div>
            {lookupQuery && (
              <div className="mt-3 p-3 bg-slate-50 border border-slate-150 rounded-xl text-xs space-y-2 animate-fadeIn">
                {lookupResult ? (
                  <div>
                    <span className={`inline-block px-2 py-0.5 rounded-md font-semibold mb-1.5 ${
                      lookupResult.type === 'sale' ? 'bg-indigo-50 text-indigo-700' : 'bg-teal-50 text-teal-700'
                    }`}>
                      {lookupResult.type === 'sale' ? 'Sale/Hold Found' : 'Import Batch Found'}
                    </span>
                    {lookupResult.type === 'sale' ? (
                      <div className="space-y-1">
                        <p><strong>Buyer:</strong> {lookupResult.data.buyerName}</p>
                        <p><strong>Type:</strong> {lookupResult.data.chargerType}</p>
                        <p><strong>Range:</strong> {lookupResult.data.startNo} - {lookupResult.data.endNo}</p>
                        <p><strong>Qty:</strong> {lookupResult.data.quantity}</p>
                        <p><strong>Status:</strong> <span className="capitalize font-bold">{lookupResult.data.status}</span></p>
                        <button
                          onClick={() => setSelectedDetailSale(lookupResult.data as ChargerSale)}
                          className="mt-2 text-red-600 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          View Full Details →
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p><strong>Importer:</strong> {lookupResult.data.operator}</p>
                        <p><strong>Type:</strong> {lookupResult.data.chargerType}</p>
                        <p><strong>Supplier:</strong> {lookupResult.data.supplierName || 'N/A'}</p>
                        <p><strong>Container:</strong> {lookupResult.data.containerId || 'N/A'}</p>
                        <p><strong>Qty:</strong> {lookupResult.data.quantity}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-slate-500 italic">No exact serial range matches found.</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Dispatch Charger / Reserve Hold */}
        <div className="lg:col-span-2">
          <form onSubmit={handleFormSubmit} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Dispatch Standalone Charger</h2>
                <p className="text-xs text-slate-500 mt-0.5">Dispatch power charger units directly under a Delivery Challan Number.</p>
              </div>
            </div>

            {status && (
              <div className={`p-4 rounded-xl flex items-start gap-2 border text-sm ${
                status.type === 'success' 
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-100' 
                  : 'bg-rose-50 text-rose-800 border-rose-100'
              }`}>
                {status.type === 'success' ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
                <span>{status.text}</span>
              </div>
            )}

            {/* Delivery Challan Primary Step when Attach Challan Mode is Active */}
            {submitMode === 'attach_challan' && (
              <div className="bg-cyan-50/90 border-2 border-cyan-400 p-4 rounded-2xl space-y-3 shadow-xs font-sans">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-cyan-950 uppercase tracking-wider flex items-center gap-1.5 font-sans">
                    🚚 Step 1: Select Active Delivery Challan
                  </span>
                  {deliveryChallanNo ? (
                    <span className="text-xs font-mono font-black text-cyan-900 bg-cyan-200 border border-cyan-400 px-2.5 py-1 rounded-lg shadow-2xs">
                      [ Challan #{deliveryChallanNo.toUpperCase()} ]
                    </span>
                  ) : (
                    <span className="text-[11px] font-mono font-bold text-slate-500 bg-slate-200 border border-slate-300 px-2 py-0.5 rounded-lg">
                      [ Select Active Challan ]
                    </span>
                  )}
                </div>

                {activeChallanNumbers.length > 0 ? (
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-extrabold text-cyan-900 uppercase tracking-wide font-sans">
                      Active Pending Challan Numbers (Click to Select):
                    </label>
                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1 bg-white/80 rounded-xl border border-cyan-200">
                      {activeChallanNumbers.map((cNo) => {
                        const isSelected = deliveryChallanNo.toUpperCase() === cNo.toUpperCase();
                        return (
                          <button
                            key={cNo}
                            type="button"
                            onClick={() => setDeliveryChallanNo(cNo)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-black transition-all cursor-pointer border flex items-center gap-1.5 ${
                              isSelected
                                ? 'bg-cyan-700 text-white border-cyan-800 ring-2 ring-cyan-500/30 shadow-xs scale-105'
                                : 'bg-white text-cyan-900 border-cyan-300 hover:bg-cyan-100 hover:border-cyan-400'
                            }`}
                          >
                            <span>#{cNo}</span>
                            {isSelected && <Check className="h-3.5 w-3.5 text-cyan-200" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] font-medium text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200 font-sans">
                    ⚠️ No active pending Delivery Challans found. Enter a custom challan number below or create a new challan.
                  </p>
                )}

                <div className="pt-2 border-t border-cyan-200/80 flex items-center gap-2 font-sans">
                  <span className="text-[10px] font-bold text-cyan-900 uppercase shrink-0">Challan Number:</span>
                  <input
                    type="text"
                    placeholder="e.g. DC-1001"
                    value={deliveryChallanNo}
                    onChange={(e) => setDeliveryChallanNo(e.target.value)}
                    className="w-full bg-white border border-cyan-300 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-mono font-bold uppercase outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
              </div>
            )}

            {submitMode === 'attach_challan' && deliveryChallanNo.trim() && (
              <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center justify-between text-xs font-bold text-emerald-900 font-sans shadow-2xs">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  Attached to [ Challan #{deliveryChallanNo.toUpperCase()} ]
                </span>
                {currentChallanInfo.buyerName && (
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                    Buyer: {currentChallanInfo.buyerName}
                  </span>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Buyer / Customer Name *
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Enter customer or buyer name"
                      value={buyerName}
                      onChange={(e) => setBuyerName(e.target.value)}
                      list="buyers-datalist"
                      className="w-full pl-9 pr-4 py-2.5 text-sm bg-slate-50 hover:bg-slate-100 focus:bg-white text-slate-800 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all font-semibold"
                      required
                    />
                    <datalist id="buyers-datalist">
                      {buyers.map(b => (
                        <option key={b.id} value={b.name} />
                      ))}
                    </datalist>
                  </div>
                  {buyerName.trim() !== '' && (
                    (() => {
                      const exists = buyers.some(b => b.name.toLowerCase() === buyerName.trim().toLowerCase());
                      return exists ? (
                        <div className="mt-1 flex items-center gap-1 text-[10px] text-emerald-600 font-bold font-sans">
                          <span>✅ Registered Buyer: auto-filling contact & address/location</span>
                        </div>
                      ) : (
                        <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-600 font-bold font-sans">
                          <span>✨ New Buyer! Will auto-register to database with address</span>
                        </div>
                      );
                    })()
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 font-sans">
                      Contact Number / Email
                    </label>
                    <input
                      type="text"
                      placeholder="+91 or email..."
                      value={buyerContact}
                      onChange={(e) => setBuyerContact(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 hover:bg-slate-100 focus:bg-white text-slate-800 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 font-sans">
                      Physical Address / Location (Important) 📍
                    </label>
                    <input
                      type="text"
                      placeholder="Delivery address / location"
                      value={buyerAddress}
                      onChange={(e) => setBuyerAddress(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 hover:bg-slate-100 focus:bg-white text-slate-800 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Charger Type *
                </label>
                <select
                  value={chargerType}
                  onChange={(e) => setChargerType(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm bg-slate-50 hover:bg-slate-100 focus:bg-white text-slate-800 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all"
                  required
                >
                  {chargerTypesList.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            </div>

            {isUnderWarranty === true ? (
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-3">
                <div className="flex justify-between items-center pb-2 border-b border-slate-200/60">
                  <span className="block text-xs font-bold text-red-800 uppercase tracking-wide font-sans">
                    Serial Input Method:
                  </span>
                  <div className="flex bg-slate-200/60 p-0.5 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setInputMethod('range')}
                      className={`px-3 py-1 text-[10px] font-bold rounded-md transition ${
                        inputMethod === 'range' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      🔢 Range Series
                    </button>
                    <button
                      type="button"
                      onClick={() => setInputMethod('scan')}
                      className={`px-3 py-1 text-[10px] font-bold rounded-md transition flex items-center gap-1 ${
                        inputMethod === 'scan' ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      ✍️ Individual Serials
                    </button>
                  </div>
                </div>

                {inputMethod === 'range' ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Start Serial Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. CHG48-10001"
                        value={startNo}
                        onChange={(e) => handleStartOrEndChange('start', e.target.value)}
                        className="w-full px-4 py-2.5 text-sm bg-white text-slate-800 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all placeholder:text-slate-400 font-mono font-bold"
                        required={inputMethod === 'range'}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        End Serial Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. CHG48-10005"
                        value={endNo}
                        onChange={(e) => handleStartOrEndChange('end', e.target.value)}
                        className="w-full px-4 py-2.5 text-sm bg-white text-slate-800 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all placeholder:text-slate-400 font-mono font-bold"
                        required={inputMethod === 'range'}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Quantity *
                      </label>
                      <input
                        type="number"
                        placeholder="Derived from range..."
                        value={quantity}
                        readOnly
                        className="w-full px-4 py-2.5 text-sm rounded-xl border border-emerald-250 bg-emerald-50 text-emerald-800 cursor-not-allowed font-mono font-bold"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                      <div>
                        <h4 className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
                          <span>📊</span> Scanned Charger Serials
                        </h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Each unit requires an individual scanned serial or QR code.
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-xl font-black font-mono text-red-600 block leading-none">
                          {scannedSerials.length}
                        </span>
                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider font-mono">Units Registered</span>
                      </div>
                    </div>

                    {scannedSerials.length > 0 && (
                      <div className="bg-white border border-slate-200 p-2.5 rounded-xl space-y-1">
                        <span className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Registered Scans (Click ❌ to remove):</span>
                        <div className="flex flex-wrap gap-1 max-h-[100px] overflow-y-auto pr-1">
                          {scannedSerials.map((serial, idx) => (
                            <span key={serial} className="inline-flex items-center gap-1 bg-red-50 text-red-800 text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border border-red-200">
                              <span>{idx + 1}. {serial}</span>
                              <button
                                type="button"
                                onClick={() => setScannedSerials(prev => prev.filter(s => s !== serial))}
                                className="text-[10px] text-red-600 hover:text-rose-600 font-sans cursor-pointer"
                              >
                                ❌
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Start/End Serial Reference (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Bulk-Reference"
                    value={startNo}
                    onChange={(e) => {
                      setStartNo(e.target.value);
                      setEndNo(e.target.value);
                    }}
                    className="w-full px-4 py-2.5 text-sm bg-slate-50 hover:bg-slate-100 focus:bg-white text-slate-800 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all placeholder:text-slate-400 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Quantity *
                  </label>
                  <input
                    type="number"
                    placeholder="Specify units count"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm bg-slate-50 hover:bg-slate-100 focus:bg-white text-slate-800 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all font-mono font-bold"
                    required
                  />
                </div>
              </div>
            )}

            {/* Warranty Questionnaire Section */}
            <div className="p-4 rounded-xl border border-slate-150 bg-slate-50 space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Charger Warranty Status</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Is this standalone charger unit sold under warranty cover?</p>
                </div>
                
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsUnderWarranty(true);
                      setWarrantyDuration(12);
                    }}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                      isUnderWarranty === true 
                        ? 'bg-red-50 text-red-700 border-red-200' 
                        : 'bg-white text-slate-500 border-slate-200 hover:text-slate-700'
                    }`}
                  >
                    Warranty Active
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsUnderWarranty(false);
                      setWarrantyDuration(0);
                    }}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                      isUnderWarranty === false 
                        ? 'bg-slate-200 text-slate-700 border-slate-300' 
                        : 'bg-white text-slate-500 border-slate-200 hover:text-slate-700'
                    }`}
                  >
                    No Warranty
                  </button>
                </div>
              </div>

              {isUnderWarranty && (
                <div className="pt-2 border-t border-slate-200">
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    Warranty Duration
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-sm text-slate-700 font-medium cursor-pointer">
                      <input
                        type="radio"
                        name="chargerWarrantyMonths"
                        value={12}
                        checked={warrantyDuration === 12}
                        onChange={() => setWarrantyDuration(12)}
                        className="text-red-600 focus:ring-red-500"
                      />
                      12 Months (Standard)
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-700 font-medium cursor-pointer">
                      <input
                        type="radio"
                        name="chargerWarrantyMonths"
                        value={13}
                        checked={warrantyDuration === 13}
                        onChange={() => setWarrantyDuration(13)}
                        className="text-red-600 focus:ring-red-500"
                      />
                      12+1 Months (Special promo)
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-700 font-medium cursor-pointer">
                      <input
                        type="radio"
                        name="chargerWarrantyMonths"
                        value={6}
                        checked={warrantyDuration === 6}
                        onChange={() => setWarrantyDuration(6)}
                        className="text-red-600 focus:ring-red-500"
                      />
                      6 Months (Short duration)
                    </label>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Dispatch Notes / Serial numbers checklist
              </label>
              <textarea
                rows={2}
                placeholder="Add special requests, courier details, invoice numbers, specific charger properties, etc."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-4 py-2 text-sm bg-slate-50 hover:bg-slate-100 focus:bg-white text-slate-800 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all placeholder:text-slate-400"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="submit"
                disabled={saving}
                className={`w-full md:w-auto px-6 py-3 font-semibold rounded-xl text-white shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  submitMode === 'hold' 
                    ? 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800' 
                    : submitMode === 'attach_challan'
                    ? 'bg-cyan-700 hover:bg-cyan-800 active:bg-cyan-900'
                    : 'bg-red-600 hover:bg-red-700 active:bg-red-800'
                }`}
              >
                {saving ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : submitMode === 'hold' ? (
                  <>
                    <Timer className="h-4 w-4" />
                    Put Chargers on Hold
                  </>
                ) : submitMode === 'attach_challan' ? (
                  <>
                    <ClipboardList className="h-4 w-4" />
                    Attach Chargers to Delivery Challan
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Finalize Charger Dispatch
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Ledger lists (Filterable Table Layout) */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Dispatch & Reservation Logs</h2>
            <p className="text-xs text-slate-500">Live ledger of all standalone charger dispatches and pending holds.</p>
          </div>

          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              id="charger-ledger-search"
              type="text"
              placeholder="Filter by customer, type, serial..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-sm bg-slate-50 hover:bg-slate-100 focus:bg-white text-slate-800 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all placeholder:text-slate-400"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-55 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-4 px-6">Customer / Date</th>
                <th className="py-4 px-6">Charger Type</th>
                <th className="py-4 px-6">Serial Numbers</th>
                <th className="py-4 px-6 text-center">Qty</th>
                <th className="py-4 px-6">Warranty Cover</th>
                <th className="py-4 px-6 text-center">Status</th>
                <th className="py-4 px-6">Operator</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredSales.map(sale => {
                const isHold = sale.status === 'hold';
                return (
                  <tr key={sale.id} className="hover:bg-slate-50 transition-colors">
                    {/* Customer */}
                    <td className="py-4 px-6">
                      <button 
                        onClick={() => setSelectedDetailSale(sale)}
                        className="font-semibold text-slate-900 hover:text-red-600 hover:underline text-left block cursor-pointer"
                        title="Click to view all charger sale details"
                      >
                        {sale.buyerName}
                      </button>
                      <span className="text-[11px] text-slate-400 block mt-0.5">
                        {new Date(sale.saleDate).toLocaleDateString()} {new Date(sale.saleDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                    </td>

                    {/* Charger Type */}
                    <td className="py-4 px-6">
                      <span className="inline-flex px-2 py-0.5 text-xs bg-slate-100 text-slate-700 font-semibold rounded-md">
                        {sale.chargerType}
                      </span>
                    </td>

                    {/* Serials */}
                    <td className="py-4 px-6 font-mono text-xs text-slate-600">
                      {sale.startNo && sale.startNo !== 'N/A' ? (
                        <span>{sale.startNo} - {sale.endNo}</span>
                      ) : (
                        <span className="text-slate-400 italic">No Serials Specified</span>
                      )}
                    </td>

                    {/* Qty */}
                    <td className="py-4 px-6 text-center font-bold text-slate-800">
                      {sale.quantity}
                    </td>

                    {/* Warranty */}
                    <td className="py-4 px-6">
                      {sale.isUnderWarranty ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          {sale.warrantyDurationMonths || 12} Mos Warranty
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500 font-semibold bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                          <Ban className="h-3.5 w-3.5" />
                          No Warranty
                        </span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-4 px-6 text-center">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        isHold 
                          ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}>
                        {isHold ? 'On Reservation Hold' : 'Sold & Dispatched'}
                      </span>
                    </td>

                    {/* Operator */}
                    <td className="py-4 px-6 text-xs text-slate-500 font-medium">
                      {sale.operator}
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-6 text-right">
                      {isHold ? (
                        <div className="flex gap-2 justify-end">
                          <button
                            id={`finalize-chg-${sale.id}`}
                            onClick={() => handleFinalize(sale.id)}
                            disabled={actingOnId === sale.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors cursor-pointer"
                          >
                            <Check className="h-3 w-3" />
                            Finalize
                          </button>
                          <button
                            id={`release-chg-${sale.id}`}
                            onClick={() => handleRelease(sale.id)}
                            disabled={actingOnId === sale.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors cursor-pointer"
                          >
                            <X className="h-3 w-3" />
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setSelectedDetailSale(sale)}
                          className="text-xs text-red-600 font-bold hover:underline cursor-pointer"
                        >
                          View Details
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}

              {filteredSales.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No matching charger dispatch transactions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* POPUP: DETAILED OVERVIEW FOR CHARGER SALES - "ever detail aper in front of me" */}
      <AnimatePresence>
        {selectedDetailSale && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-xl border border-slate-100 max-w-lg w-full overflow-hidden"
            >
              {/* Modal Title */}
              <div className="bg-red-600 p-6 text-white flex justify-between items-start">
                <div>
                  <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/20 uppercase tracking-wider mb-1">
                    Standalone Charger Transaction
                  </div>
                  <h3 className="text-xl font-bold tracking-tight">{selectedDetailSale.buyerName}</h3>
                  <p className="text-white/80 text-xs mt-0.5">Reference ID: {selectedDetailSale.id}</p>
                </div>
                <button 
                  onClick={() => setSelectedDetailSale(null)}
                  className="p-1 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Charger Type</span>
                    <strong className="text-slate-800 font-semibold block mt-0.5">{selectedDetailSale.chargerType}</strong>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Dispatched Quantity</span>
                    <strong className="text-slate-800 font-bold block mt-0.5">{selectedDetailSale.quantity} Units</strong>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2 text-sm">
                  <div className="flex justify-between border-b border-slate-150 pb-2">
                    <span className="text-slate-500 font-medium">Serial Numbers Range</span>
                    <strong className="font-mono text-slate-800">
                      {selectedDetailSale.startNo && selectedDetailSale.startNo !== 'N/A' 
                        ? `${selectedDetailSale.startNo} - ${selectedDetailSale.endNo}` 
                        : 'N/A'}
                    </strong>
                  </div>

                  <div className="flex justify-between border-b border-slate-150 pb-2">
                    <span className="text-slate-500 font-medium">Registered Operator</span>
                    <span className="text-slate-800 font-semibold">{selectedDetailSale.operator}</span>
                  </div>

                  <div className="flex justify-between border-b border-slate-150 pb-2">
                    <span className="text-slate-500 font-medium">Date / Time</span>
                    <span className="text-slate-800 font-semibold">
                      {new Date(selectedDetailSale.saleDate).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex justify-between pt-1">
                    <span className="text-slate-500 font-medium">Transaction Status</span>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${
                      selectedDetailSale.status === 'hold' 
                        ? 'bg-amber-50 text-amber-700 border border-amber-100' 
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                    }`}>
                      {selectedDetailSale.status === 'hold' ? 'On Hold (Reserved)' : 'Sold & Dispatched'}
                    </span>
                  </div>
                </div>

                {/* Warranty card details */}
                <div className={`p-4 rounded-xl border flex items-start gap-3 ${
                  selectedDetailSale.isUnderWarranty 
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-100' 
                    : 'bg-slate-50 text-slate-700 border-slate-150'
                }`}>
                  {selectedDetailSale.isUnderWarranty ? (
                    <>
                      <ShieldCheck className="h-6 w-6 text-emerald-600 shrink-0" />
                      <div>
                        <h4 className="font-bold text-xs uppercase tracking-wider text-emerald-900">Warranty Active</h4>
                        <p className="text-xs mt-0.5 text-emerald-800">
                          This charger is fully covered under warrenty for <strong>{selectedDetailSale.warrantyDurationMonths || 12} Months</strong> from the date of dispatch.
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <Ban className="h-6 w-6 text-slate-500 shrink-0" />
                      <div>
                        <h4 className="font-bold text-xs uppercase tracking-wider text-slate-800">No Warranty</h4>
                        <p className="text-xs mt-0.5 text-slate-600">
                          This charger unit was sold as a standalone item with <strong>no additional warranty support</strong>.
                        </p>
                      </div>
                    </>
                  )}
                </div>

                {/* Charger serial numbers breakdown list */}
                {selectedDetailSale.isUnderWarranty && (
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                    <h5 className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center justify-between">
                      <span>🔌 Sequenced Charger Serials</span>
                      <span className="text-slate-400 text-[9px] font-bold">
                        {selectedDetailSale.serialNumbers && selectedDetailSale.serialNumbers.length > 0 
                          ? 'Scanned QR Codes' 
                          : 'Generated from Series Range'}
                      </span>
                    </h5>
                    
                    {selectedDetailSale.serialNumbers && selectedDetailSale.serialNumbers.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[160px] overflow-y-auto pr-1">
                        {selectedDetailSale.serialNumbers.map((serial, idx) => (
                          <div key={idx} className="bg-white px-2.5 py-1.5 rounded-xl border border-red-200 bg-red-50/10 flex items-center justify-between text-[11px]">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-red-600 text-[9px] bg-red-100 h-4.5 w-4.5 flex items-center justify-center rounded-full">
                                {idx + 1}
                              </span>
                              <span className="font-mono font-bold text-slate-800 select-all">{serial}</span>
                            </div>
                            <span className="text-[9px] text-red-600 font-bold uppercase tracking-wider px-1 bg-red-100/50 rounded text-center">QR</span>
                          </div>
                        ))}
                      </div>
                    ) : (!selectedDetailSale.startNo || selectedDetailSale.startNo === 'N/A') ? (
                      <p className="text-xs text-slate-400 font-medium py-1">No serialized ranges defined for this bulk shipment.</p>
                    ) : (
                      (() => {
                        // Generate range list
                        const start = selectedDetailSale.startNo;
                        const end = selectedDetailSale.endNo;
                        const qty = selectedDetailSale.quantity;
                        const list: string[] = [];
                        const startMatch = start.match(/^(.*?)(\d+)$/);
                        const endMatch = end.match(/^(.*?)(\d+)$/);
                        if (startMatch && endMatch) {
                          const prefix = startMatch[1];
                          const sNum = parseInt(startMatch[2], 10);
                          const eNum = parseInt(endMatch[2], 10);
                          const padLen = startMatch[2].length;
                          if (eNum >= sNum) {
                            for (let i = 0; i < qty; i++) {
                              const curr = sNum + i;
                              if (curr <= eNum) {
                                list.push(prefix + String(curr).padStart(padLen, '0'));
                              }
                            }
                          }
                        }
                        if (list.length === 0) {
                          return <p className="text-xs text-slate-400 font-medium py-1">Could not expand serial range automatically.</p>;
                        }
                        return (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[160px] overflow-y-auto pr-1">
                            {list.map((serial, idx) => (
                              <div key={idx} className="bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 flex items-center justify-between text-[11px]">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-slate-400 text-[9px] bg-slate-100 h-4.5 w-4.5 flex items-center justify-center rounded-full">
                                    {idx + 1}
                                  </span>
                                  <span className="font-mono font-bold text-slate-800 select-all">{serial}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })()
                    )}
                  </div>
                )}

                {/* Hold specific details */}
                {selectedDetailSale.status === 'hold' && (
                  <div className="p-4 rounded-xl border bg-amber-50 text-amber-800 border-amber-100">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-amber-900 mb-1">Reservation Holds Tracker</h4>
                    <p className="text-xs">
                      Reserved for: <strong>{selectedDetailSale.heldFor || selectedDetailSale.buyerName}</strong><br />
                      Placed by: <strong>{selectedDetailSale.heldBy || selectedDetailSale.operator}</strong> on {selectedDetailSale.holdDate ? new Date(selectedDetailSale.holdDate).toLocaleString() : 'N/A'}
                    </p>
                  </div>
                )}

                {/* Notes details */}
                {selectedDetailSale.notes && (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-sm">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Special Notes & Comments</span>
                    <p className="text-slate-600 text-xs mt-1 bg-white p-2 rounded border border-slate-100 whitespace-pre-line font-medium leading-relaxed">
                      {selectedDetailSale.notes}
                    </p>
                  </div>
                )}
              </div>

              {/* Close Button */}
              <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setSelectedDetailSale(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-xl text-xs shadow transition-all cursor-pointer"
                >
                  Close Details panel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: IMPORT NEW CHARGERS BATCH */}
      <AnimatePresence>
        {showImportModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-xl border border-slate-100 max-w-lg w-full overflow-hidden"
            >
              <div className="bg-slate-900 p-6 text-white flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-red-500" />
                  <h3 className="text-lg font-bold">Import Stand-Alone Chargers</h3>
                </div>
                <button 
                  onClick={() => setShowImportModal(false)}
                  className="p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleImportSubmit} className="p-6 space-y-4">
                {importStatus && (
                  <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 border ${
                    importStatus.type === 'success' 
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-100' 
                      : 'bg-rose-50 text-rose-800 border-rose-100'
                  }`}>
                    {importStatus.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                    <span>{importStatus.text}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Charger Type *
                    </label>
                    <select
                      value={importType}
                      onChange={(e) => setImportType(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                      required
                    >
                      {chargerTypesList.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-2 bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-3">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-200/60">
                      <span className="block text-xs font-bold text-red-800 uppercase tracking-wide font-sans">
                        Import Serial Input Method:
                      </span>
                      <div className="flex bg-slate-200/60 p-0.5 rounded-lg">
                        <button
                          type="button"
                          onClick={() => setImportInputMethod('range')}
                          className={`px-3 py-1 text-[10px] font-bold rounded-md transition ${
                            importInputMethod === 'range' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                          }`}
                        >
                          🔢 Range Series
                        </button>
                        <button
                          type="button"
                          onClick={() => setImportInputMethod('scan')}
                          className={`px-3 py-1 text-[10px] font-bold rounded-md transition flex items-center gap-1 ${
                            importInputMethod === 'scan' ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                          }`}
                        >
                          📷 Scan QR/Codes
                        </button>
                      </div>
                    </div>

                    {importInputMethod === 'range' ? (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                            Start Serial No
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. C48-10001"
                            value={importStartNo}
                            onChange={(e) => handleImportStartOrEndChange('start', e.target.value)}
                            className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                            End Serial No
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. C48-10250"
                            value={importEndNo}
                            onChange={(e) => handleImportStartOrEndChange('end', e.target.value)}
                            className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                            Batch Quantity *
                          </label>
                          <input
                            type="number"
                            placeholder="Units count"
                            value={importQty}
                            onChange={(e) => setImportQty(e.target.value)}
                            className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none font-semibold"
                            required={importInputMethod === 'range'}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                          <div>
                            <h4 className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
                              <span>📊</span> Imported Charger Serials
                            </h4>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              Register the serial numbers of each incoming charger.
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="text-xl font-black font-mono text-red-600 block leading-none">
                              {scannedImportSerials.length}
                            </span>
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider font-mono">Units Registered</span>
                          </div>
                        </div>

                        {scannedImportSerials.length > 0 && (
                          <div className="bg-white border border-slate-200 p-2.5 rounded-xl space-y-1">
                            <span className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Registered Scans (Click ❌ to remove):</span>
                            <div className="flex flex-wrap gap-1 max-h-[100px] overflow-y-auto pr-1">
                              {scannedImportSerials.map((serial, idx) => (
                                <span key={serial} className="inline-flex items-center gap-1 bg-red-50 text-red-800 text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border border-red-200">
                                  <span>{idx + 1}. {serial}</span>
                                  <button
                                    type="button"
                                    onClick={() => setScannedImportSerials(prev => prev.filter(s => s !== serial))}
                                    className="text-[10px] text-red-600 hover:text-rose-600 font-sans cursor-pointer"
                                  >
                                    ❌
                                  </button>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Supplier Name
                    </label>
                    <input
                      type="text"
                      placeholder="Supplier"
                      value={importSupplier}
                      onChange={(e) => setImportSupplier(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Container / Shipment ID
                    </label>
                    <input
                      type="text"
                      placeholder="Container Ref"
                      value={importContainer}
                      onChange={(e) => setImportContainer(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Special Imports Notes
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Courier information, custom clearance, logistics codes, etc."
                    value={importNotes}
                    onChange={(e) => setImportNotes(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowImportModal(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={importSaving}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    {importSaving ? (
                      <>
                        <RefreshCw className="h-3 w-3 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        Confirm Import Batch
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function generateSerialRange(start: string, end: string, count: number): string[] {
  if (!start || start === 'N/A') return [];
  
  const cleanStart = start.trim();
  const cleanEnd = end && end !== 'N/A' ? end.trim() : '';
  
  const startMatch = cleanStart.match(/^(.*?[\s\-_/\\#]*?)(\d+)$/i);
  
  if (startMatch) {
    const prefix = startMatch[1] !== undefined ? startMatch[1] : '';
    const startNum = parseInt(startMatch[2], 10);
    const paddingLength = startMatch[2].length;
    
    let countToGen = Math.max(1, count);
    
    if (cleanEnd) {
      const endMatch = cleanEnd.match(/^(.*?[\s\-_/\\#]*?)(\d+)$/i);
      if (endMatch) {
        const endNum = parseInt(endMatch[2], 10);
        if (endNum >= startNum) {
          countToGen = Math.max(countToGen, endNum - startNum + 1);
        }
      }
    }
    
    const list: string[] = [];
    for (let i = 0; i < countToGen; i++) {
      const numStr = String(startNum + i).padStart(paddingLength, '0');
      list.push(`${prefix}${numStr}`);
    }
    return list;
  }
  
  if (cleanEnd) {
    return [cleanStart, cleanEnd];
  }
  return [cleanStart];
}
