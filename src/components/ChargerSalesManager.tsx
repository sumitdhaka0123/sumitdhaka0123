import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Zap, Plus, Sparkles, User, Calendar, ClipboardList, CheckCircle2, 
  AlertCircle, Search, ShieldAlert, Ban, Timer, Check, Info, ShieldCheck, RefreshCw, X
} from 'lucide-react';
import { Buyer, ChargerSale, ChargerImport } from '../types';

interface ChargerSalesManagerProps {
  buyers: Buyer[];
  chargerSales: ChargerSale[];
  chargerImports?: ChargerImport[];
  chargerTypesList: string[];
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
  }) => Promise<boolean>;
  onSubmitChargerImport: (data: {
    chargerType: string;
    startNo: string;
    endNo: string;
    quantity: number;
    supplierName?: string;
    containerId?: string;
    notes?: string;
  }) => Promise<boolean>;
  onReleaseHold: (id: string) => Promise<boolean>;
  onFinalizeHold: (id: string) => Promise<boolean>;
  isPipelineView?: boolean;
}

export default function ChargerSalesManager({
  buyers,
  chargerSales = [],
  chargerImports = [],
  chargerTypesList = [],
  currentUser,
  onRefresh,
  onSubmitChargerSale,
  onSubmitChargerImport,
  onReleaseHold,
  onFinalizeHold,
  isPipelineView = false
}: ChargerSalesManagerProps) {
  // Add sale form state
  const [buyerName, setBuyerName] = useState('');
  const [chargerType, setChargerType] = useState(chargerTypesList[0] || '48V Charger');
  const [startNo, setStartNo] = useState('');
  const [endNo, setEndNo] = useState('');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  
  // Warranty Flow State
  const [isUnderWarranty, setIsUnderWarranty] = useState<boolean | null>(true);
  const [warrantyDuration, setWarrantyDuration] = useState<number | null>(12);

  // Submit and loading states
  const [submitMode, setSubmitMode] = useState<'sold' | 'hold'>('sold');
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
  const handleStartOrEndChange = (type: 'start' | 'end', value: string) => {
    if (type === 'start') {
      setStartNo(value);
      calculateQty(value, endNo);
    } else {
      setEndNo(value);
      calculateQty(startNo, value);
    }
  };

  const calculateQty = (start: string, end: string) => {
    if (!start || !end) return;
    
    // Extract trailing digits if any
    const startMatch = start.match(/\d+$/);
    const endMatch = end.match(/\d+$/);

    if (startMatch && endMatch) {
      const startNum = parseInt(startMatch[0], 10);
      const endNum = parseInt(endMatch[0], 10);
      
      if (endNum >= startNum) {
        const calculated = endNum - startNum + 1;
        setQuantity(String(calculated));
      } else {
        setQuantity('');
      }
    } else {
      setQuantity('');
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
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!buyerName.trim()) {
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
      if (!startNo.trim() || !endNo.trim()) {
        setStatus({ type: 'error', text: 'Starting and ending series numbers are required for under-warranty chargers.' });
        return;
      }
      finalStartNo = startNo.trim().toUpperCase();
      finalEndNo = endNo.trim().toUpperCase();

      // Recalculate quantity to enforce
      const startMatch = finalStartNo.match(/\d+$/);
      const endMatch = finalEndNo.match(/\d+$/);
      if (startMatch && endMatch) {
        const sNum = parseInt(startMatch[0], 10);
        const eNum = parseInt(endMatch[0], 10);
        if (eNum >= sNum) {
          const calculatedQty = eNum - sNum + 1;
          qtyNum = calculatedQty;
        } else {
          setStatus({ type: 'error', text: 'Ending series number must be greater than or equal to starting series number.' });
          return;
        }
      } else {
        setStatus({ type: 'error', text: 'Invalid serial formats. Series numbers must end with numeric values (e.g. CHG48-1001).' });
        return;
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

    setSaving(true);
    setStatus(null);

    const data = {
      buyerName: buyerName.trim(),
      chargerType,
      startNo: finalStartNo,
      endNo: finalEndNo,
      quantity: qtyNum,
      notes: notes.trim() || undefined,
      isUnderWarranty: !!isUnderWarranty,
      warrantyDurationMonths: isUnderWarranty ? Number(warrantyDuration) : undefined,
      status: submitMode,
      heldFor: submitMode === 'hold' ? buyerName.trim() : undefined
    };

    const success = await onSubmitChargerSale(data);
    setSaving(false);

    if (success) {
      setStatus({ 
        type: 'success', 
        text: submitMode === 'hold' 
          ? `Successfully put ${qtyNum} units of ${chargerType} on HOLD for ${buyerName}.` 
          : `Successfully registered sale of ${qtyNum} units of ${chargerType} to ${buyerName}.`
      });
      // Reset
      setBuyerName('');
      setStartNo('');
      setEndNo('');
      setQuantity('');
      setNotes('');
      onRefresh();
    } else {
      setStatus({ type: 'error', text: 'Server rejected the request. Please try again.' });
    }
  };

  // Submit Import Form
  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedQty = parseInt(importQty, 10);
    if (isNaN(parsedQty) || parsedQty <= 0) {
      setImportStatus({ type: 'error', text: 'Please specify a valid quantity.' });
      return;
    }

    setImportSaving(true);
    setImportStatus(null);

    const success = await onSubmitChargerImport({
      chargerType: importType,
      startNo: importStartNo.trim() || 'N/A',
      endNo: importEndNo.trim() || 'N/A',
      quantity: parsedQty,
      supplierName: importSupplier.trim() || undefined,
      containerId: importContainer.trim() || undefined,
      notes: importNotes.trim() || undefined
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
              <p className="text-xs text-slate-500 mt-0.5">Create a stand-alone customer sale or reservation hold for power charger units.</p>
            </div>
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setSubmitMode('sold')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  submitMode === 'sold' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Sale/Dispatch
              </button>
              <button
                type="button"
                onClick={() => setSubmitMode('hold')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  submitMode === 'hold' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Reservation Hold
              </button>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Charger Type *
              </label>
              <select
                value={chargerType}
                onChange={(e) => setChargerType(e.target.value)}
                className="w-full px-4 py-2.5 text-sm bg-slate-50 hover:bg-slate-100 focus:bg-white text-slate-800 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all font-sans cursor-pointer"
                required
              >
                {chargerTypesList.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
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
                placeholder={isUnderWarranty ? "Derived from serial range..." : "Specify units count"}
                value={quantity}
                onChange={(e) => {
                  if (!isUnderWarranty) {
                    setQuantity(e.target.value);
                  }
                }}
                readOnly={isUnderWarranty === true}
                className={`w-full px-4 py-2.5 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-red-500 transition-all font-mono font-bold ${
                  isUnderWarranty
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800 cursor-not-allowed'
                    : 'bg-slate-50 hover:bg-slate-100 focus:bg-white text-slate-800 border-slate-200'
                }`}
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
                    13 Months (Special promo)
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
              className="w-full px-4 py-2 text-sm bg-slate-50 hover:bg-slate-100 focus:bg-white text-slate-800 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all placeholder:text-slate-400 resize-none font-sans"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="submit"
              disabled={saving}
              className={`w-full px-6 py-3 font-semibold rounded-xl text-white shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer ${
                submitMode === 'hold' 
                  ? 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800' 
                  : 'bg-red-600 hover:bg-red-700 active:bg-red-800'
              }`}
            >
              {saving ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Registering...
                </>
              ) : submitMode === 'hold' ? (
                <>
                  <Timer className="h-4 w-4" />
                  Put Chargers on Hold
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
                <p className="text-xs text-slate-500 mt-0.5">Create a stand-alone customer sale or reservation hold for power charger units.</p>
              </div>
              <div className="flex bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setSubmitMode('sold')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    submitMode === 'sold' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Sale/Dispatch
                </button>
                <button
                  type="button"
                  onClick={() => setSubmitMode('hold')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    submitMode === 'hold' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Reservation Hold
                </button>
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  placeholder={isUnderWarranty ? "Derived from serial range..." : "Specify units count"}
                  value={quantity}
                  onChange={(e) => {
                    if (!isUnderWarranty) {
                      setQuantity(e.target.value);
                    }
                  }}
                  readOnly={isUnderWarranty === true}
                  className={`w-full px-4 py-2.5 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-red-500 transition-all font-mono font-bold ${
                    isUnderWarranty
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800 cursor-not-allowed'
                      : 'bg-slate-50 hover:bg-slate-100 focus:bg-white text-slate-800 border-slate-200'
                  }`}
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
                      13 Months (Special promo)
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
                    : 'bg-red-600 hover:bg-red-700 active:bg-red-800'
                }`}
              >
                {saving ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Registering...
                  </>
                ) : submitMode === 'hold' ? (
                  <>
                    <Timer className="h-4 w-4" />
                    Put Chargers on Hold
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

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Start Serial No
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. C48-10001"
                      value={importStartNo}
                      onChange={(e) => handleImportStartOrEndChange('start', e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none"
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
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none"
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
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none font-semibold"
                      required
                    />
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
