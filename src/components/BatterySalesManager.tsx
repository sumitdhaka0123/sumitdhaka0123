import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Battery, Plus, Sparkles, User, Calendar, ClipboardList, CheckCircle2, 
  AlertCircle, Search, ShieldAlert, Ban, Timer, Check, Info, ShieldCheck, RefreshCw, X, Trash2
} from 'lucide-react';
import { Buyer, BatterySale, BatteryImport, ScooterUnit } from '../types';

interface BatterySalesManagerProps {
  buyers: Buyer[];
  batterySales: BatterySale[];
  batteryImports?: BatteryImport[];
  scooterUnits?: ScooterUnit[];
  currentUser: any;
  onRefresh: () => void;
  onSubmitBatterySale: (data: {
    buyerName: string;
    batterySeries: string;
    startNo: string;
    endNo: string;
    quantity: number;
    notes?: string;
    isUnderWarranty?: boolean;
    warrantyDurationMonths?: number;
    status?: 'sold' | 'hold';
    heldFor?: string;
  }) => Promise<boolean>;
  batterySeriesList: string[];
  isPipelineView?: boolean;
  hideForm?: boolean;
}

export default function BatterySalesManager({
  buyers,
  batterySales,
  batteryImports = [],
  scooterUnits = [],
  currentUser,
  onRefresh,
  onSubmitBatterySale,
  batterySeriesList = [],
  isPipelineView = false,
  hideForm = false
}: BatterySalesManagerProps) {
  const [buyerName, setBuyerName] = useState('');
  const [batterySeries, setBatterySeries] = useState(batterySeriesList[0] || 'Alpha Series');
  const [customSeries, setCustomSeries] = useState('');
  const [startNo, setStartNo] = useState('');
  const [endNo, setEndNo] = useState('');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  
  // Warranty Questions Flow State
  const [isUnderWarranty, setIsUnderWarranty] = useState<boolean | null>(true);
  const [warrantyDuration, setWarrantyDuration] = useState<number | null>(12);

  // Submit and loading states
  const [submitMode, setSubmitMode] = useState<'sold' | 'hold'>('sold');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Searching & lookup states
  const [searchQuery, setSearchQuery] = useState('');
  const [lookupQuery, setLookupQuery] = useState('');
  const [actingOnId, setActingOnId] = useState<string | null>(null);
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [selectedDetailSale, setSelectedDetailSale] = useState<BatterySale | null>(null);
  const [selectedDetailScooter, setSelectedDetailScooter] = useState<ScooterUnit | null>(null);

  // Calculation of stock per series
  const seriesStockMap = useMemo(() => {
    const map: Record<string, { imported: number; soldStandalone: number; assignedToScooters: number; available: number }> = {};
    batterySeriesList.forEach(series => {
      const key = series.endsWith('Series') ? series : series + ' Series';
      map[key] = { imported: 0, soldStandalone: 0, assignedToScooters: 0, available: 0 };
    });
    // Fallback legacy series options
    ['Alpha Series', 'Beta Series', 'Delta Series', 'Omega Series', 'Pro-Pack Series'].forEach(series => {
      if (!map[series]) {
        map[series] = { imported: 0, soldStandalone: 0, assignedToScooters: 0, available: 0 };
      }
    });

    // Helper to get series key
    const getSeriesKey = (series: string) => {
      const clean = series.toLowerCase().replace(/\s*series/g, '').trim();
      const match = batterySeriesList.find(s => {
        const sClean = s.toLowerCase().replace(/\s*series/g, '').trim();
        return sClean === clean;
      });
      if (match) return match.endsWith('Series') ? match : match + ' Series';

      if (clean === 'alpha') return 'Alpha Series';
      if (clean === 'beta') return 'Beta Series';
      if (clean === 'delta') return 'Delta Series';
      if (clean === 'omega') return 'Omega Series';
      if (clean === 'pro-pack' || clean === 'pro') return 'Pro-Pack Series';
      return null;
    };

    // 1. Process Imports
    batteryImports.forEach(imp => {
      const key = getSeriesKey(imp.batterySeries);
      if (key) {
        map[key].imported += imp.quantity;
      } else {
        const customKey = imp.batterySeries.endsWith('Series') ? imp.batterySeries : imp.batterySeries + ' Series';
        if (!map[customKey]) {
          map[customKey] = { imported: 0, soldStandalone: 0, assignedToScooters: 0, available: 0 };
        }
        map[customKey].imported += imp.quantity;
      }
    });

    // 2. Process Standalone Sales (only count finalized 'sold' or 'hold' depending on logic, let's count all logged ones since they block inventory)
    batterySales.forEach(sale => {
      const key = getSeriesKey(sale.batterySeries);
      if (key) {
        map[key].soldStandalone += sale.quantity;
      } else {
        const customKey = sale.batterySeries.endsWith('Series') ? sale.batterySeries : sale.batterySeries + ' Series';
        if (!map[customKey]) {
          map[customKey] = { imported: 0, soldStandalone: 0, assignedToScooters: 0, available: 0 };
        }
        map[customKey].soldStandalone += sale.quantity;
      }
    });

    // 3. Process Scooter Assignments
    scooterUnits.forEach(u => {
      if (u.batterySerials) {
        u.batterySerials.forEach(s => {
          const cleanSerial = s.toLowerCase();
          let matchedKey: string | null = null;
          if (cleanSerial.includes('alpha') || cleanSerial.startsWith('al') || cleanSerial.startsWith('a-')) {
            matchedKey = 'Alpha Series';
          } else if (cleanSerial.includes('beta') || cleanSerial.startsWith('be') || cleanSerial.startsWith('b-')) {
            matchedKey = 'Beta Series';
          } else if (cleanSerial.includes('delta') || cleanSerial.startsWith('de') || cleanSerial.startsWith('d-')) {
            matchedKey = 'Delta Series';
          } else if (cleanSerial.includes('omega') || cleanSerial.startsWith('om') || cleanSerial.startsWith('o-')) {
            matchedKey = 'Omega Series';
          } else if (cleanSerial.includes('pro-pack') || cleanSerial.includes('pro') || cleanSerial.startsWith('pr') || cleanSerial.startsWith('p-')) {
            matchedKey = 'Pro-Pack Series';
          }

          if (matchedKey) {
            map[matchedKey].assignedToScooters += 1;
          }
        });
      }
    });

    // 4. Calculate Available Stock for each series
    Object.keys(map).forEach(key => {
      const entry = map[key];
      entry.available = Math.max(0, entry.imported - entry.soldStandalone - entry.assignedToScooters);
    });

    return map;
  }, [batteryImports, batterySales, scooterUnits]);

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

  // Hold Actions API handlers
  const handleReleaseHold = async (id: string) => {
    setActingOnId(id);
    setStatus(null);
    try {
      const res = await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/battery-sales/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, operator: currentUser?.name || currentUser?.username || 'system' })
      });
      const data = await res.json();
      if (res.ok) {
        setStatus({ type: 'success', text: 'Battery hold successfully released and stock returned to warehouse!' });
        onRefresh();
      } else {
        setStatus({ type: 'error', text: data.error || 'Failed to release the hold.' });
      }
    } catch (err) {
      setStatus({ type: 'error', text: 'Network error releasing hold.' });
    } finally {
      setActingOnId(null);
    }
  };

  const handleFinalizeHold = async (id: string) => {
    setActingOnId(id);
    setStatus(null);
    try {
      const res = await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/battery-sales/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, operator: currentUser?.name || currentUser?.username || 'system' })
      });
      const data = await res.json();
      if (res.ok) {
        setStatus({ type: 'success', text: 'Battery hold successfully converted into finalized sale!' });
        onRefresh();
      } else {
        setStatus({ type: 'error', text: data.error || 'Failed to finalize hold.' });
      }
    } catch (err) {
      setStatus({ type: 'error', text: 'Network error finalising hold.' });
    } finally {
      setActingOnId(null);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);

    const finalSeries = batterySeries === 'custom' ? customSeries.trim() : batterySeries;

    if (!buyerName) {
      setStatus({ type: 'error', text: 'Please select a buyer.' });
      return;
    }
    if (!finalSeries) {
      setStatus({ type: 'error', text: 'Please specify the battery series.' });
      return;
    }

    if (isUnderWarranty === null) {
      setStatus({ type: 'error', text: 'Please select whether the battery is under warranty or not.' });
      return;
    }

    let finalStartNo = 'N/A';
    let finalEndNo = 'N/A';
    let qtyNum = parseInt(quantity, 10);

    if (isUnderWarranty) {
      if (warrantyDuration === null) {
        setStatus({ type: 'error', text: 'Please select the warranty duration (12 or 13 months).' });
        return;
      }
      if (!startNo.trim() || !endNo.trim()) {
        setStatus({ type: 'error', text: 'Starting and ending series numbers are required for under-warranty batteries.' });
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
        setStatus({ type: 'error', text: 'Invalid serial formats. Series numbers must end with numeric values (e.g. AL-1001).' });
        return;
      }
    } else {
      // Not under warranty - just validate quantity input
      if (isNaN(qtyNum) || qtyNum <= 0) {
        setStatus({ type: 'error', text: 'Please enter a valid positive quantity.' });
        return;
      }
    }

    // OVERSOLD PREVENT VALIDATION
    const seriesKeyToCheck = batterySeries === 'custom' ? customSeries.trim() : batterySeries;
    const matchingKey = Object.keys(seriesStockMap).find(k => 
      k.toLowerCase() === seriesKeyToCheck.toLowerCase() || 
      k.toLowerCase().replace(/\s*series/g, '').trim() === seriesKeyToCheck.toLowerCase().replace(/\s*series/g, '').trim()
    );

    const availableStockForSelected = matchingKey ? seriesStockMap[matchingKey].available : 0;

    if (qtyNum > availableStockForSelected) {
      setStatus({ 
        type: 'error', 
        text: `Over-selling prevented! You are trying to allocate ${qtyNum} packs, but there are only ${availableStockForSelected} packs of "${seriesKeyToCheck}" left in stock.` 
      });
      return;
    }

    setSaving(true);
    const success = await onSubmitBatterySale({
      buyerName,
      batterySeries: finalSeries,
      startNo: finalStartNo,
      endNo: finalEndNo,
      quantity: qtyNum,
      notes: notes.trim(),
      isUnderWarranty: !!isUnderWarranty,
      warrantyDurationMonths: isUnderWarranty ? Number(warrantyDuration) : undefined,
      status: submitMode,
      heldFor: submitMode === 'hold' ? buyerName : undefined
    });
    setSaving(false);

    if (success) {
      const modeLabel = submitMode === 'hold' ? 'reserved (on hold)' : 'dispatched';
      setStatus({ type: 'success', text: `Successfully registered battery ${modeLabel} of ${qtyNum} units to ${buyerName}!` });
      setBuyerName('');
      setStartNo('');
      setEndNo('');
      setQuantity('');
      setNotes('');
      setCustomSeries('');
      setIsUnderWarranty(null);
      setWarrantyDuration(null);
      onRefresh();
    } else {
      setStatus({ type: 'error', text: 'Failed to save the battery transaction. Try again.' });
    }
  };

  // Compute stat totals
  const stats = useMemo(() => {
    const totalQty = batterySales.reduce((acc, curr) => acc + curr.quantity, 0);
    const totalBatches = batterySales.length;
    const uniqueBuyers = new Set(batterySales.map(s => s.buyerName)).size;
    const holdCount = batterySales.filter(s => s.status === 'hold').length;
    const holdQty = batterySales.filter(s => s.status === 'hold').reduce((acc, curr) => acc + curr.quantity, 0);
    
    return {
      totalQty,
      totalBatches,
      uniqueBuyers,
      holdCount,
      holdQty
    };
  }, [batterySales]);

  // Aggregated buyer summary for Owner intelligence
  const buyerSummary = useMemo(() => {
    const summaryMap: Record<string, { totalQty: number; seriesList: Set<string>; lastSaleDate: string }> = {};
    batterySales.forEach(s => {
      if (!summaryMap[s.buyerName]) {
        summaryMap[s.buyerName] = { totalQty: 0, seriesList: new Set<string>(), lastSaleDate: s.saleDate };
      }
      summaryMap[s.buyerName].totalQty += s.quantity;
      summaryMap[s.buyerName].seriesList.add(s.batterySeries);
      if (new Date(s.saleDate) > new Date(summaryMap[s.buyerName].lastSaleDate)) {
        summaryMap[s.buyerName].lastSaleDate = s.saleDate;
      }
    });

    return Object.entries(summaryMap).map(([buyer, details]) => ({
      buyer,
      totalQty: details.totalQty,
      series: Array.from(details.seriesList).join(', '),
      lastSaleDate: details.lastSaleDate
    })).sort((a, b) => b.totalQty - a.totalQty);
  }, [batterySales]);

  // Filter battery sales based on search query
  const filteredSales = useMemo(() => {
    if (!searchQuery.trim()) return batterySales;
    const q = searchQuery.toLowerCase();
    return batterySales.filter(
      s =>
        String(s.buyerName || '').toLowerCase().includes(q) ||
        String(s.batterySeries || '').toLowerCase().includes(q) ||
        String(s.startNo || '').toLowerCase().includes(q) ||
        String(s.endNo || '').toLowerCase().includes(q) ||
        String(s.status || '').toLowerCase().includes(q)
    );
  }, [batterySales, searchQuery]);

  // Comprehensive Battery Serial Search Range Lookup Engine
  const lookupResult = useMemo(() => {
    if (!lookupQuery.trim()) return null;
    const query = lookupQuery.trim().toUpperCase();

    // Parse a string into prefix and trailing numerical value if exists
    const parseSerial = (serial: string) => {
      const match = serial.trim().toUpperCase().match(/^([A-Z0-9\-_]*?)(\d+)$/);
      if (match) {
        return { prefix: match[1], num: parseInt(match[2], 10), raw: serial.toUpperCase() };
      }
      return { prefix: '', num: NaN, raw: serial.toUpperCase() };
    };

    const qParsed = parseSerial(query);

    // 1. Trace Standalone Battery Sales
    const standaloneMatches = batterySales.filter(sale => {
      if (!sale.startNo || !sale.endNo || sale.startNo === 'N/A' || sale.endNo === 'N/A') {
        // Substring checks fallback
        return sale.batterySeries.toUpperCase().includes(query) || 
               sale.buyerName.toUpperCase().includes(query);
      }

      const startParsed = parseSerial(sale.startNo);
      const endParsed = parseSerial(sale.endNo);

      // Numeric range comparison if both query and range end in integers
      if (!isNaN(qParsed.num) && !isNaN(startParsed.num) && !isNaN(endParsed.num)) {
        const isWithinRange = qParsed.num >= startParsed.num && qParsed.num <= endParsed.num;
        
        // Match prefix optionally (if query has a prefix, check prefix equivalence; if not, check range alone)
        const prefixMatches = !qParsed.prefix || 
                              qParsed.prefix === startParsed.prefix || 
                              startParsed.prefix.includes(qParsed.prefix) || 
                              qParsed.prefix.includes(startParsed.prefix);

        if (isWithinRange && prefixMatches) {
          return true;
        }
      }

      // Check raw substring
      return sale.startNo.includes(query) || sale.endNo.includes(query);
    });

    // 2. Trace Scooters carrying this battery serial
    const scooterMatches: any[] = [];
    scooterUnits.forEach(unit => {
      if (unit.batterySerials) {
        unit.batterySerials.forEach((serial, idx) => {
          if (serial.toUpperCase().includes(query)) {
            const inWarranty = unit.batteryWarrantyFlags ? unit.batteryWarrantyFlags[idx] : false;
            const warrantyMonths = unit.batteryWarrantyMonths ? unit.batteryWarrantyMonths[idx] : 12;
            scooterMatches.push({
              unit,
              serial,
              index: idx,
              inWarranty,
              warrantyMonths
            });
          }
        });
      }
    });

    return {
      standaloneMatches,
      scooterMatches
    };
  }, [batterySales, scooterUnits, lookupQuery]);

  if (isPipelineView && false) {
    return (
      <div className="space-y-4" id="battery-sales-manager-pipeline">
        {/* Logger Form Panel */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5 font-sans">
              🔋 Log Standalone Battery Allocation
            </h3>
            <p className="text-[11px] text-slate-500 mt-1 font-sans">
              Dispatch directly or place specific series blocks on reserved hold.
            </p>
          </div>

          <form onSubmit={handleFormSubmit} className="space-y-4">
            
            {/* 1. First Ask: Under Warranty? (GATED / PROGRESSIVE FIRST STEP) */}
            <div className="bg-slate-50 border border-slate-200/60 p-4 rounded-2xl space-y-2">
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide font-sans">
                Is this standalone battery allocation under warranty?
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsUnderWarranty(true);
                    setWarrantyDuration(null); // Force selection of 12 or 13
                    setStartNo('');
                    setEndNo('');
                    setQuantity('');
                  }}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    isUnderWarranty === true
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-sm'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  <span>Yes, Under Warranty</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsUnderWarranty(false);
                    setWarrantyDuration(null);
                    setStartNo('');
                    setEndNo('');
                    setQuantity('');
                  }}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    isUnderWarranty === false
                      ? 'bg-rose-50 border-rose-300 text-rose-800 shadow-sm'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Ban className="h-4 w-4 text-rose-500" />
                  <span>No Warranty</span>
                </button>
              </div>
            </div>

            {/* 2. Under Warranty: Pop up Duration Choice */}
            {isUnderWarranty === true && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-emerald-50/20 border border-emerald-100 p-4 rounded-2xl space-y-2"
              >
                <label className="block text-[11px] font-bold text-emerald-700 uppercase tracking-wide font-sans">
                  Select Warranty Duration
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setWarrantyDuration(12)}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      warrantyDuration === 12
                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                        : 'bg-white border-emerald-200 text-slate-700 hover:bg-emerald-50'
                    }`}
                  >
                    12 Months
                  </button>
                  <button
                    type="button"
                    onClick={() => setWarrantyDuration(13)}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      warrantyDuration === 13
                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                        : 'bg-white border-emerald-200 text-slate-700 hover:bg-emerald-50'
                    }`}
                  >
                    13 Months
                  </button>
                </div>
              </motion.div>
            )}

            {/* 3. Under Warranty with Duration selected: Show Series Start & End Range */}
            {isUnderWarranty === true && warrantyDuration !== null && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="grid grid-cols-2 gap-3 bg-slate-50 border border-slate-200 p-4 rounded-2xl"
              >
                <div className="col-span-2">
                  <span className="block text-[10px] font-bold text-emerald-800 uppercase tracking-wide mb-1 font-sans">
                    Specify Battery Serial Series Numbers:
                  </span>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 font-sans">
                    Start No. Series
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. AL-1001"
                    value={startNo}
                    onChange={(e) => handleStartOrEndChange('start', e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-base sm:text-xs text-slate-800 font-sans outline-none uppercase focus:border-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 font-sans">
                    End No. Series
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. AL-1100"
                    value={endNo}
                    onChange={(e) => handleStartOrEndChange('end', e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-base sm:text-xs text-slate-800 font-sans outline-none uppercase focus:border-emerald-500"
                    required
                  />
                </div>
              </motion.div>
            )}

            {/* 4. Display subsequent fields ONLY if the initial steps are filled out */}
            {(isUnderWarranty === false || (isUnderWarranty === true && warrantyDuration !== null)) && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3 pt-3 border-t border-slate-200"
              >
                {/* Buyer Select */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 font-sans">
                    Wholesale Buyer
                  </label>
                  <select
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-base sm:text-xs text-slate-800 outline-none focus:border-emerald-500 font-sans cursor-pointer"
                    required
                  >
                    <option value="">-- Choose Buyer --</option>
                    {buyers.map(b => (
                      <option key={b.id} value={b.name}>{b.name}</option>
                    ))}
                  </select>
                </div>

                {/* Battery Series */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 font-sans">
                    Battery Series Type
                  </label>
                  <select
                    value={batterySeries}
                    onChange={(e) => setBatterySeries(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-base sm:text-xs text-slate-800 outline-none focus:border-emerald-500 font-sans cursor-pointer"
                  >
                    {(batterySeriesList.length > 0 ? batterySeriesList : ['Alpha Series', 'Beta Series', 'Delta Series', 'Omega Series', 'Pro-Pack Series']).map(seriesOpt => {
                      const key = seriesOpt.endsWith('Series') ? seriesOpt : seriesOpt + ' Series';
                      const avail = seriesStockMap[key]?.available ?? 0;
                      return (
                        <option key={seriesOpt} value={seriesOpt}>
                          {seriesOpt} ({avail} Left)
                        </option>
                      );
                    })}
                    <option value="custom">-- Custom Series Name --</option>
                  </select>
                </div>

                {/* Custom Series Input */}
                {batterySeries === 'custom' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                  >
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 font-sans">
                      Custom Series Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Gamma X-200"
                      value={customSeries}
                      onChange={(e) => setCustomSeries(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-base sm:text-xs text-slate-800 outline-none focus:border-emerald-500 font-sans"
                      required
                    />
                  </motion.div>
                )}

                {/* Quantity Input */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 font-sans">
                    Quantity Dispatched
                  </label>
                  <input
                    type="number"
                    placeholder={isUnderWarranty ? "Quantity derived from series range..." : "e.g. 50"}
                    value={quantity}
                    onChange={(e) => {
                      if (isUnderWarranty === false) {
                        setQuantity(e.target.value);
                      }
                    }}
                    readOnly={isUnderWarranty === true}
                    className={`w-full border rounded-xl p-2.5 text-base sm:text-xs font-sans outline-none font-mono font-bold ${
                      isUnderWarranty === true
                        ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed font-medium'
                        : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-emerald-500'
                    }`}
                    required
                  />
                  {isUnderWarranty === true && (
                    <span className="text-[10px] text-emerald-600 mt-1 block font-semibold">
                      ✓ Derived automatically from Start/End serial numbers. Manual override disabled.
                    </span>
                  )}
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 font-sans">
                    Dispatch / Shipment Notes
                  </label>
                  <textarea
                    placeholder="Enter transport or batch notes..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-base sm:text-xs text-slate-800 font-sans outline-none focus:border-emerald-500 resize-none"
                  />
                </div>

                {/* Actions Button Grid */}
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={saving}
                    onClick={() => setSubmitMode('sold')}
                    className="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-sans font-bold text-xs rounded-xl cursor-pointer disabled:opacity-50 transition-all flex items-center justify-center gap-1 shadow-sm active:scale-[0.98]"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>{saving && submitMode === 'sold' ? 'Registering...' : 'Sell / Dispatch'}</span>
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    onClick={() => setSubmitMode('hold')}
                    className="py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-sans font-bold text-xs rounded-xl cursor-pointer disabled:opacity-50 transition-all flex items-center justify-center gap-1 shadow-sm active:scale-[0.98]"
                  >
                    <Timer className="h-3.5 w-3.5 text-amber-400" />
                    <span>{saving && submitMode === 'hold' ? 'Holding...' : 'Place on Hold'}</span>
                  </button>
                </div>
              </motion.div>
            )}
          </form>

          {status && (
            <div className={`p-3.5 rounded-2xl flex items-start gap-2 border text-xs font-sans ${
              status.type === 'success' 
                ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
                : 'bg-rose-50 border-rose-100 text-rose-800'
            }`}>
              {status.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <span className="font-semibold leading-relaxed">{status.text}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" id="battery-sales-manager">
      
      {/* Overview stats block */}
      {!isPipelineView && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white border border-emerald-100 rounded-3xl p-5 shadow-sm">
            <div className="flex items-center justify-between text-emerald-600 mb-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider">Total Standalone Dispatched</span>
              <div className="p-1.5 bg-emerald-50 rounded-xl">
                <Battery className="h-4 w-4" />
              </div>
            </div>
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight">{stats.totalQty}</span>
            <p className="text-[10px] text-slate-500 mt-1 font-semibold">Accumulated wholesale batteries sent</p>
          </div>

          <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider">Shipment Batches</span>
              <div className="p-1.5 bg-slate-50 rounded-xl">
                <ClipboardList className="h-4 w-4" />
              </div>
            </div>
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight">{stats.totalBatches}</span>
            <p className="text-[10px] text-slate-500 mt-1 font-semibold">Total wholesale log records</p>
          </div>

          <div className="bg-white border border-cyan-100 rounded-3xl p-5 shadow-sm">
            <div className="flex items-center justify-between text-cyan-600 mb-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider">Active Battery Buyers</span>
              <div className="p-1.5 bg-cyan-50 rounded-xl">
                <User className="h-4 w-4" />
              </div>
            </div>
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight">{stats.uniqueBuyers}</span>
            <p className="text-[10px] text-slate-500 mt-1 font-semibold">Unique buyers holding batteries</p>
          </div>

          <div 
            onClick={() => setShowHoldModal(true)}
            className="bg-white border border-amber-100 rounded-3xl p-5 shadow-sm cursor-pointer hover:border-amber-400 hover:shadow-md transition-all active:scale-[0.99] group relative overflow-hidden"
            title="Click to view and manage battery holdings"
          >
            <div className="flex items-center justify-between text-amber-600 mb-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider">Reserved (On Hold) 🤝</span>
              <div className="p-1.5 bg-amber-50 rounded-xl group-hover:bg-amber-100 transition-colors">
                <Timer className="h-4 w-4" />
              </div>
            </div>
            <span className="text-3xl font-extrabold text-amber-700 tracking-tight">{stats.holdCount}</span>
            <p className="text-[10px] text-slate-500 mt-1 font-semibold flex items-center justify-between">
              <span>Holds: {stats.holdQty} batteries reserved</span>
              <span className="text-[9px] text-amber-600 font-bold bg-amber-50/80 px-1.5 py-0.5 rounded border border-amber-100">Manage →</span>
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column wrapper */}
        <div className="space-y-6 lg:col-span-1">
          {/* Logger Form Panel */}
          {!hideForm && (
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5 font-sans">
                🔋 Log Standalone Battery Allocation
              </h3>
              <p className="text-[11px] text-slate-500 mt-1 font-sans">
                Dispatch directly or place specific series blocks on reserved hold.
              </p>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              
              {/* 1. First Ask: Under Warranty? (GATED / PROGRESSIVE FIRST STEP) */}
              <div className="bg-slate-50 border border-slate-200/60 p-4 rounded-2xl space-y-2">
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide font-sans">
                  Is this standalone battery allocation under warranty?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsUnderWarranty(true);
                      setWarrantyDuration(null); // Force selection of 12 or 13
                      setStartNo('');
                      setEndNo('');
                      setQuantity('');
                    }}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      isUnderWarranty === true
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-sm'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    <span>Yes, Under Warranty</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsUnderWarranty(false);
                      setWarrantyDuration(null);
                      setStartNo('');
                      setEndNo('');
                      setQuantity('');
                    }}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      isUnderWarranty === false
                        ? 'bg-rose-50 border-rose-300 text-rose-800 shadow-sm'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Ban className="h-4 w-4 text-rose-500" />
                    <span>No Warranty</span>
                  </button>
                </div>
              </div>

              {/* 2. Under Warranty: Pop up Duration Choice */}
              {isUnderWarranty === true && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-emerald-50/20 border border-emerald-100 p-4 rounded-2xl space-y-2"
                >
                  <label className="block text-[11px] font-bold text-emerald-700 uppercase tracking-wide font-sans">
                    Select Warranty Duration
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setWarrantyDuration(12)}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        warrantyDuration === 12
                          ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                          : 'bg-white border-emerald-200 text-slate-700 hover:bg-emerald-50'
                      }`}
                    >
                      12 Months
                    </button>
                    <button
                      type="button"
                      onClick={() => setWarrantyDuration(13)}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        warrantyDuration === 13
                          ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                          : 'bg-white border-emerald-200 text-slate-700 hover:bg-emerald-50'
                      }`}
                    >
                      13 Months
                    </button>
                  </div>
                </motion.div>
              )}

              {/* 3. Under Warranty with Duration selected: Show Series Start & End Range */}
              {isUnderWarranty === true && warrantyDuration !== null && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="grid grid-cols-2 gap-3 bg-slate-50 border border-slate-200 p-4 rounded-2xl"
                >
                  <div className="col-span-2">
                    <span className="block text-[10px] font-bold text-emerald-800 uppercase tracking-wide mb-1 font-sans">
                      Specify Battery Serial Series Numbers:
                    </span>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 font-sans">
                      Start No. Series
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. AL-1001"
                      value={startNo}
                      onChange={(e) => handleStartOrEndChange('start', e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-base sm:text-xs text-slate-800 font-sans outline-none uppercase focus:border-emerald-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 font-sans">
                      End No. Series
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. AL-1100"
                      value={endNo}
                      onChange={(e) => handleStartOrEndChange('end', e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-base sm:text-xs text-slate-800 font-sans outline-none uppercase focus:border-emerald-500"
                      required
                    />
                  </div>
                </motion.div>
              )}

              {/* 4. Display subsequent fields ONLY if the initial steps are filled out */}
              {(isUnderWarranty === false || (isUnderWarranty === true && warrantyDuration !== null)) && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3 pt-3 border-t border-slate-200"
                >
                  {/* Buyer Select */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 font-sans">
                      Wholesale Buyer
                    </label>
                    <select
                      value={buyerName}
                      onChange={(e) => setBuyerName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-base sm:text-xs text-slate-800 outline-none focus:border-emerald-500 font-sans cursor-pointer"
                      required
                    >
                      <option value="">-- Choose Buyer --</option>
                      {buyers.map(b => (
                        <option key={b.id} value={b.name}>{b.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Battery Series */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 font-sans">
                      Battery Series Type
                    </label>
                    <select
                      value={batterySeries}
                      onChange={(e) => setBatterySeries(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-base sm:text-xs text-slate-800 outline-none focus:border-emerald-500 font-sans cursor-pointer"
                    >
                      {(batterySeriesList.length > 0 ? batterySeriesList : ['Alpha Series', 'Beta Series', 'Delta Series', 'Omega Series', 'Pro-Pack Series']).map(seriesOpt => {
                        const key = seriesOpt.endsWith('Series') ? seriesOpt : seriesOpt + ' Series';
                        const avail = seriesStockMap[key]?.available ?? 0;
                        return (
                          <option key={seriesOpt} value={seriesOpt}>
                            {seriesOpt} ({avail} Left)
                          </option>
                        );
                      })}
                      <option value="custom">-- Custom Series Name --</option>
                    </select>
                  </div>

                  {/* Custom Series Input */}
                  {batterySeries === 'custom' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                    >
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 font-sans">
                        Custom Series Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Gamma X-200"
                        value={customSeries}
                        onChange={(e) => setCustomSeries(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-base sm:text-xs text-slate-800 outline-none focus:border-emerald-500 font-sans"
                        required
                      />
                    </motion.div>
                  )}

                  {/* Quantity Input */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 font-sans">
                      Quantity Dispatched
                    </label>
                    <input
                      type="number"
                      placeholder={isUnderWarranty ? "Quantity derived from series range..." : "e.g. 50"}
                      value={quantity}
                      onChange={(e) => {
                        if (isUnderWarranty === false) {
                          setQuantity(e.target.value);
                        }
                      }}
                      readOnly={isUnderWarranty === true}
                      className={`w-full border rounded-xl p-2.5 text-base sm:text-xs font-sans outline-none font-mono font-bold ${
                        isUnderWarranty === true
                          ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed font-medium'
                          : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-emerald-500'
                      }`}
                      required
                    />
                    {isUnderWarranty === true && (
                      <span className="text-[10px] text-emerald-600 mt-1 block font-semibold">
                        ✓ Derived automatically from Start/End serial numbers. Manual override disabled.
                      </span>
                    )}
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 font-sans">
                      Dispatch / Shipment Notes
                    </label>
                    <textarea
                      placeholder="Enter transport or batch notes..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-base sm:text-xs text-slate-800 font-sans outline-none focus:border-emerald-500 resize-none"
                    />
                  </div>

                  {/* Actions Button Grid */}
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <button
                      type="submit"
                      disabled={saving}
                      onClick={() => setSubmitMode('sold')}
                      className="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-sans font-bold text-xs rounded-xl cursor-pointer disabled:opacity-50 transition-all flex items-center justify-center gap-1 shadow-sm active:scale-[0.98]"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>{saving && submitMode === 'sold' ? 'Registering...' : 'Sell / Dispatch'}</span>
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      onClick={() => setSubmitMode('hold')}
                      className="py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-sans font-bold text-xs rounded-xl cursor-pointer disabled:opacity-50 transition-all flex items-center justify-center gap-1 shadow-sm active:scale-[0.98]"
                    >
                      <Timer className="h-3.5 w-3.5 text-amber-400" />
                      <span>{saving && submitMode === 'hold' ? 'Holding...' : 'Place on Hold'}</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </form>

            {status && (
              <div className={`p-3.5 rounded-2xl flex items-start gap-2 border text-xs font-sans ${
                status.type === 'success' 
                  ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
                  : 'bg-rose-50 border-rose-100 text-rose-800'
              }`}>
                {status.type === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <span className="font-semibold leading-relaxed">{status.text}</span>
              </div>
            )}
          </div>
          )}

          {/* Real-time Available Stock Levels Card */}
          <div className="bg-emerald-950 text-white rounded-3xl p-5 shadow-md space-y-3">
            <div>
              <span className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-wider block font-sans">
                📦 Available Battery Stock
              </span>
              <h3 className="text-xs font-bold text-slate-100 font-sans mt-0.5">
                Current Real-Time Stock in Warehouse
              </h3>
            </div>

            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {Object.keys(seriesStockMap).map((series) => {
                const info = seriesStockMap[series];
                return (
                  <div key={series} className="bg-emerald-900/40 border border-emerald-800/40 p-3 rounded-2xl flex justify-between items-center transition-all hover:bg-emerald-900/60">
                    <div>
                      <span className="block text-xs font-extrabold text-slate-100 font-sans">
                        {series}
                      </span>
                      <span className="block text-[9px] text-emerald-300 font-medium">
                        {info.imported} imported / {info.assignedToScooters} in scooters
                      </span>
                    </div>
                    <div className="text-right">
                      <span className={`block text-sm font-black font-mono ${info.available > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                        {info.available.toLocaleString()} Left
                      </span>
                      <span className="block text-[8px] text-slate-300 font-mono">
                        {info.soldStandalone} standalone sold
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Owner Intelligence: Buyer Purchase Summaries */}
          {!isPipelineView && (
            <div className="bg-slate-900 text-white rounded-3xl p-5 shadow-sm space-y-3">
              <div>
                <span className="text-[10px] font-extrabold text-amber-400 uppercase tracking-wider block">
                  👑 Owner Intelligence
                </span>
                <h3 className="text-xs font-bold text-slate-100 font-sans mt-0.5">
                  Total Battery Stock Sent to Buyers
                </h3>
              </div>

              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                {buyerSummary.length === 0 ? (
                  <div className="text-center py-6 text-[11px] text-slate-400 italic">
                    No standalone battery sales recorded yet.
                  </div>
                ) : (
                  buyerSummary.map((sum) => (
                    <div key={sum.buyer} className="bg-slate-800/80 border border-slate-700/50 p-3 rounded-2xl flex justify-between items-center transition-all hover:bg-slate-800">
                      <div>
                        <span className="block text-xs font-extrabold text-slate-100 font-sans">
                          {sum.buyer}
                        </span>
                        <span className="block text-[9px] text-slate-400 font-medium truncate max-w-[140px]" title={sum.series}>
                          {sum.series}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="block text-xs font-black text-emerald-400 font-mono">
                          {sum.totalQty.toLocaleString()} Units
                        </span>
                        <span className="block text-[8px] text-slate-500 font-mono">
                          Last Sent: {new Date(sum.lastSaleDate).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Column 2 & 3 wrapper */}
        <div className="lg:col-span-2 space-y-6">

          {/* Battery Serial Range Tracer / Lookup Engine */}
          <div className="bg-gradient-to-r from-slate-900 to-slate-950 text-white rounded-3xl p-6 shadow-md border border-slate-800 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-slate-800 rounded-2xl border border-slate-700">
                <Search className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-100 font-sans flex items-center gap-2">
                  🔍 Battery Serial Range Search & Audit Engine
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Trace any battery serial number (e.g. 1025 or AL-1025) to identify wholesale buyer, sale date, and warranty terms.
                </p>
              </div>
            </div>

            <div className="relative">
              <input
                type="text"
                placeholder="Enter battery serial number to trace... (e.g. AL-1050)"
                value={lookupQuery}
                onChange={(e) => setLookupQuery(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 pl-11 pr-4 text-xs text-slate-200 placeholder-slate-500 font-sans outline-none focus:border-emerald-500 focus:bg-slate-900 font-mono"
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                <Search className="h-4 w-4" />
              </span>
            </div>

            {/* Dynamic Tracing Results */}
            {lookupQuery.trim() && lookupResult && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-900/60 rounded-2xl p-4 border border-slate-800 space-y-3"
              >
                <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                  Traced Record Matches:
                </div>

                {/* Standalone Sales Matches */}
                {lookupResult.standaloneMatches.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">
                      Standalone Wholesale Dispatches:
                    </span>
                    {lookupResult.standaloneMatches.map((sale) => {
                      const ageInMonths = (new Date().getTime() - new Date(sale.saleDate).getTime()) / (1000 * 60 * 60 * 24 * 30.4);
                      const maxWarranty = sale.warrantyDurationMonths || 0;
                      const hasWarranty = !!sale.isUnderWarranty && maxWarranty > 0;
                      const isExpired = hasWarranty && ageInMonths > maxWarranty;

                      return (
                        <div 
                          key={sale.id} 
                          onClick={() => setSelectedDetailSale(sale)}
                          className="bg-slate-800/80 hover:bg-slate-800 hover:border-emerald-500 border border-slate-800 p-3.5 rounded-xl flex flex-col sm:flex-row justify-between sm:items-center gap-2 cursor-pointer transition-all hover:scale-[1.01]"
                        >
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-extrabold text-slate-200">{sale.buyerName}</span>
                              <span className={`text-[9px] px-1.5 py-0.5 font-bold rounded-md ${sale.status === 'hold' ? 'bg-amber-950 text-amber-400 border border-amber-900/40' : 'bg-emerald-950 text-emerald-400 border border-emerald-900/40'}`}>
                                {sale.status === 'hold' ? 'On Hold (Hold)' : 'Completed Sale'}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 mt-1 font-mono">
                              Series: {sale.batterySeries} | Range: {sale.startNo} - {sale.endNo}
                            </div>
                          </div>
                          <div className="text-left sm:text-right font-sans">
                            <span className="block text-[10px] text-slate-300">
                              📅 {sale.status === 'hold' ? 'Held' : 'Sold'} on: {new Date(sale.saleDate).toLocaleDateString()}
                            </span>
                            {hasWarranty ? (
                              <span className={`inline-block mt-1 text-[9px] px-2 py-0.5 font-bold rounded-full ${isExpired ? 'bg-rose-950 text-rose-400 border border-rose-900' : 'bg-emerald-950 text-emerald-400 border border-emerald-900'}`}>
                                🛡️ {maxWarranty}M Warranty — {isExpired ? 'Expired' : 'Active'}
                              </span>
                            ) : (
                              <span className="inline-block mt-1 text-[9px] px-2 py-0.5 bg-slate-800 text-slate-500 rounded-full font-bold">
                                ❌ No Warranty
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Scooter Assignments Matches */}
                {lookupResult.scooterMatches.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">
                      Assembled & Distributed with Scooters:
                    </span>
                    {lookupResult.scooterMatches.map((matchObj, i) => {
                      const unit = matchObj.unit;
                      return (
                        <div 
                          key={i} 
                          onClick={() => setSelectedDetailScooter(unit)}
                          className="bg-slate-800/80 hover:bg-slate-800 hover:border-emerald-500 border border-slate-800 p-3.5 rounded-xl flex flex-col sm:flex-row justify-between sm:items-center gap-2 cursor-pointer transition-all hover:scale-[1.01]"
                        >
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-extrabold text-slate-200">
                                {unit.buyerName || 'Unassigned Stock / Showroom'}
                              </span>
                              <span className="text-[9px] bg-cyan-950 text-cyan-400 px-1.5 py-0.5 rounded-md font-bold">
                                Scooter Asset
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 mt-1 font-mono">
                              Model: {unit.modelName} ({unit.color}) | Serial: <strong className="text-emerald-400 font-bold">{matchObj.serial}</strong>
                            </div>
                            <div className="text-[9px] text-slate-500 mt-0.5 font-mono">
                              Chassis: {unit.chassisNo} | Motor: {unit.motorNo}
                            </div>
                          </div>
                          <div className="text-left sm:text-right font-sans">
                            <span className="block text-[10px] text-slate-300">
                              📅 Built: {new Date(unit.createdTimestamp).toLocaleDateString()}
                            </span>
                            <span className={`inline-block mt-1 text-[9px] px-2 py-0.5 font-bold rounded-full ${matchObj.inWarranty ? 'bg-emerald-950 text-emerald-400 border border-emerald-900' : 'bg-slate-800 text-slate-500'}`}>
                              {matchObj.inWarranty ? `🛡️ ${matchObj.warrantyMonths}M Battery Warranty` : '❌ No Warranty'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {lookupResult.standaloneMatches.length === 0 && lookupResult.scooterMatches.length === 0 && (
                  <div className="text-center py-4 text-slate-500 text-xs italic">
                    No active tracing records or series ranges match serial: "{lookupQuery}".
                  </div>
                )}
              </motion.div>
            )}
          </div>

          {/* Ledger Table Panel */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 font-sans">
                  📋 Standalone Battery Sales & Holds Ledger
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5 font-sans">
                  Historically logged standalone battery sales, reservations, and holds.
                </p>
              </div>
              
              {/* Search Input */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search ledger..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl py-1.5 pl-8 pr-3 text-xs text-slate-700 font-sans outline-none focus:border-emerald-500 w-full sm:w-[180px]"
                />
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              {filteredSales.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs font-semibold font-sans">
                  No battery logs found matching your workspace state.
                </div>
              ) : (
                <table className="w-full text-left text-xs font-sans">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                      <th className="py-3 px-3">Buyer Name</th>
                      <th className="py-3 px-3">Battery Series</th>
                      <th className="py-3 px-3">Start Serial</th>
                      <th className="py-3 px-3">End Serial</th>
                      <th className="py-3 px-3 text-center">Qty</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredSales.map((sale) => {
                      const isHold = sale.status === 'hold';
                      return (
                        <tr 
                          key={sale.id} 
                          onClick={() => setSelectedDetailSale(sale)}
                          className={`text-slate-700 cursor-pointer transition-colors hover:bg-slate-50 ${isHold ? 'bg-amber-50/20 hover:bg-amber-50/40' : ''}`}
                        >
                          <td className="py-3.5 px-3 font-extrabold text-slate-900 leading-tight">
                            {sale.buyerName}
                            {sale.notes && (
                              <span className="block text-[10px] font-medium text-slate-400 mt-0.5 max-w-[150px] truncate" title={sale.notes}>
                                📝 {sale.notes}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-3 font-medium text-slate-600">
                            <div>
                              <span>{sale.batterySeries}</span>
                              {sale.isUnderWarranty ? (
                                <span className="block text-[9px] text-emerald-600 font-bold">
                                  🛡️ {sale.warrantyDurationMonths}M Warranty
                                </span>
                              ) : (
                                <span className="block text-[9px] text-slate-400">
                                  No Warranty
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-3 font-mono font-bold text-[11px] text-emerald-700">{sale.startNo}</td>
                          <td className="py-3.5 px-3 font-mono font-bold text-[11px] text-emerald-700">{sale.endNo}</td>
                          <td className="py-3.5 px-3 font-mono font-bold text-center text-slate-900 bg-slate-50/40 rounded-lg">{sale.quantity}</td>
                          <td className="py-3.5 px-3 whitespace-nowrap">
                            {isHold ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowHoldModal(true);
                                }}
                                className="px-2.5 py-1 text-[10px] font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200/60 rounded-full flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                                title="Click to view details of who held this and sell/release options"
                              >
                                <Timer className="h-3.5 w-3.5 text-amber-600" />
                                <span>On Hold (Click to Manage)</span>
                              </button>
                            ) : (
                              <span className="px-2 py-0.5 text-[9px] font-bold text-emerald-700 bg-emerald-50 rounded-md border border-emerald-100 flex items-center gap-1 w-fit">
                                <Check className="h-3 w-3" />
                                Dispatched
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-3 text-right whitespace-nowrap">
                            {isHold ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleFinalizeHold(sale.id);
                                  }}
                                  disabled={actingOnId !== null}
                                  className="px-2 py-1 text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md disabled:opacity-40 cursor-pointer shadow-sm animate-pulse"
                                  title="Convert hold to final sale"
                                >
                                  Sell / Finalize
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleReleaseHold(sale.id);
                                  }}
                                  disabled={actingOnId !== null}
                                  className="px-2 py-1 text-[10px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md disabled:opacity-40 cursor-pointer"
                                  title="Release reserved stock"
                                >
                                  Release
                                </button>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-[10px] font-medium font-mono">
                                {new Date(sale.saleDate).toLocaleDateString()}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Active Holds Management Modal */}
      {showHoldModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col"
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex flex-col gap-3 bg-gradient-to-r from-amber-500/10 to-transparent">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-500/10 rounded-2xl text-amber-700 border border-amber-500/20">
                    <Timer className="h-5 w-5 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 font-sans">
                      🤝 Manage Active Battery Holds & Reservations
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      View active allocations reserved on hold, trace who reserved them, and complete the final sale checkout or release stock back to the warehouse.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowHoldModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {status && (
                <div className={`p-3 rounded-xl flex items-start gap-2 border text-[11px] font-sans ${
                  status.type === 'success' 
                    ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
                    : 'bg-rose-50 border-rose-100 text-rose-800'
                }`}>
                  {status.type === 'success' ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <span className="font-semibold leading-relaxed">{status.text}</span>
                </div>
              )}
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {batterySales.filter(s => s.status === 'hold').length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <CheckCircle2 className="h-12 w-12 text-slate-300 mb-3" />
                  <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">No Active Battery Holds</h4>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-xs leading-relaxed">
                    All standalone battery stock allocations are currently dispatched or available in the warehouse.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {batterySales.filter(s => s.status === 'hold').map((sale) => {
                    const holdDateStr = sale.holdDate || sale.saleDate;
                    const dateFormatted = holdDateStr ? new Date(holdDateStr).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    }) : '—';

                    return (
                      <div 
                        key={sale.id} 
                        onClick={() => setSelectedDetailSale(sale)}
                        className="bg-slate-50/50 hover:bg-slate-100 hover:border-amber-400 border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between cursor-pointer transition-all hover:scale-[1.01] group"
                      >
                        <div>
                          {/* Top Info */}
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <span className="block text-[10px] text-slate-400 font-bold uppercase font-sans">Reserved For (Buyer)</span>
                              <span className="font-extrabold text-slate-900 text-sm leading-snug group-hover:text-amber-800 transition-colors">{sale.buyerName}</span>
                            </div>
                            <span className="text-[10px] font-sans font-bold px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200/60 rounded-full flex items-center gap-1">
                              <Timer className="h-3 w-3 text-amber-500" />
                              <span>{sale.quantity} Packs Held</span>
                            </span>
                          </div>

                          {/* Tech Grid details */}
                          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono mb-3 bg-white p-3 rounded-xl border border-slate-200/60 shadow-inner">
                            <div>
                              <span className="text-slate-400 block text-[9px] uppercase font-sans font-bold">Series</span>
                              <span className="text-slate-800 font-bold font-sans">{sale.batterySeries}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[9px] uppercase font-sans font-bold">Held By (Operator)</span>
                              <span className="text-slate-700 font-semibold font-sans">{sale.operator || sale.heldBy || 'system'}</span>
                            </div>
                            <div className="col-span-2 border-t border-slate-100 pt-1.5 mt-0.5">
                              <span className="text-slate-400 block text-[9px] uppercase font-sans font-bold">Serial Range</span>
                              <span className="text-emerald-700 font-bold">{sale.startNo} to {sale.endNo}</span>
                            </div>
                            <div className="col-span-2 border-t border-slate-100 pt-1.5 mt-0.5">
                              <span className="text-slate-400 block text-[9px] uppercase font-sans font-bold">Hold Date</span>
                              <span className="text-slate-600 font-medium font-sans">{dateFormatted}</span>
                            </div>
                            {sale.notes && (
                              <div className="col-span-2 border-t border-slate-100 pt-1.5 mt-0.5">
                                <span className="text-slate-400 block text-[9px] uppercase font-sans font-bold">Hold Notes</span>
                                <span className="text-slate-600 font-sans italic block text-[10px] bg-slate-50 p-1.5 rounded-lg border border-slate-100 mt-1">
                                  📝 {sale.notes}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Actions buttons */}
                        <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              await handleReleaseHold(sale.id);
                            }}
                            disabled={actingOnId !== null}
                            className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-250 rounded-xl disabled:opacity-40 cursor-pointer transition-all flex items-center gap-1 active:scale-[0.98]"
                            title="Release battery stock reservation back to warehouse"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-slate-500" />
                            <span>{actingOnId === sale.id ? 'Releasing...' : 'Release Hold'}</span>
                          </button>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              await handleFinalizeHold(sale.id);
                            }}
                            disabled={actingOnId !== null}
                            className="px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl disabled:opacity-40 cursor-pointer transition-all flex items-center gap-1 shadow-sm active:scale-[0.98]"
                            title="Complete shipment and register as final sale"
                          >
                            <Check className="h-3.5 w-3.5" />
                            <span>{actingOnId === sale.id ? 'Selling...' : 'Sell / Finalize'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-sans">
              <span>Total holds: <strong>{batterySales.filter(s => s.status === 'hold').length}</strong> batches (<strong>{stats.holdQty}</strong> total packs)</span>
              <button
                onClick={() => setShowHoldModal(false)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition-all cursor-pointer font-sans"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Standalone Battery Sale Detail Modal */}
      <AnimatePresence>
        {selectedDetailSale && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto" id="battery-sale-detail-overlay">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden font-sans"
              id="battery-sale-detail-content"
            >
              {/* Header */}
              <div className="bg-slate-950 text-white p-6 flex justify-between items-start">
                <div className="space-y-1">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400 font-mono">
                    Standalone Battery Shipment / Spec Sheet
                  </span>
                  <h3 className="text-lg font-black tracking-tight flex items-center gap-2">
                    {selectedDetailSale.buyerName} <span className="text-xs font-normal text-slate-400 font-mono">({selectedDetailSale.batterySeries})</span>
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedDetailSale(null)}
                  className="p-1.5 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer animate-none"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Scrollable details */}
              <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                {/* Visual Status row */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Shipment Status</span>
                    <span className={`text-xs font-extrabold flex items-center gap-1.5 mt-1 ${
                      selectedDetailSale.status === 'hold' 
                        ? 'text-amber-700' 
                        : 'text-emerald-700'
                    }`}>
                      <span className={`h-2 w-2 rounded-full ${
                        selectedDetailSale.status === 'hold' 
                          ? 'bg-amber-600 animate-pulse' 
                          : 'bg-emerald-600'
                      }`}></span>
                      {selectedDetailSale.status === 'hold' ? 'ON HOLD' : 'DISPATCHED'}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Quantity</span>
                    <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5 mt-1 font-mono">
                      🔋 {selectedDetailSale.quantity} Packs Allocated
                    </span>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 col-span-2 sm:col-span-1">
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Warranty Status</span>
                    <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5 mt-1">
                      {selectedDetailSale.isUnderWarranty ? (
                        <span className="text-emerald-700 flex items-center gap-1">
                          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                          {selectedDetailSale.warrantyDurationMonths} Months Active
                        </span>
                      ) : (
                        <span className="text-rose-600 flex items-center gap-1">
                          <Ban className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                          No Warranty
                        </span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Main specification details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Left Specs */}
                  <div className="space-y-3">
                    <h5 className="text-[10px] font-black uppercase tracking-wider text-slate-400 border-b pb-1">Series & Serial Range</h5>
                    
                    <div className="flex justify-between items-center text-xs py-1">
                      <span className="text-slate-500 font-semibold">Battery Series</span>
                      <strong className="text-slate-900 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">{selectedDetailSale.batterySeries}</strong>
                    </div>

                    <div className="flex justify-between items-center text-xs py-1">
                      <span className="text-slate-500 font-semibold">Start Serial No.</span>
                      <strong className="text-emerald-800 font-mono select-all bg-slate-50 px-2 py-0.5 rounded border border-slate-200">{selectedDetailSale.startNo}</strong>
                    </div>

                    <div className="flex justify-between items-center text-xs py-1">
                      <span className="text-slate-500 font-semibold">End Serial No.</span>
                      <strong className="text-emerald-800 font-mono select-all bg-slate-50 px-2 py-0.5 rounded border border-slate-200">{selectedDetailSale.endNo}</strong>
                    </div>
                  </div>

                  {/* Right Audit/Log */}
                  <div className="space-y-3">
                    <h5 className="text-[10px] font-black uppercase tracking-wider text-slate-400 border-b pb-1">Shipment & Logistics Log</h5>

                    <div className="flex justify-between items-center text-xs py-1">
                      <span className="text-slate-500 font-semibold">Authorized By</span>
                      <strong className="text-slate-800">@{selectedDetailSale.operator || selectedDetailSale.heldBy || 'system'}</strong>
                    </div>

                    <div className="flex justify-between items-center text-xs py-1">
                      <span className="text-slate-500 font-semibold">Log Timestamp</span>
                      <strong className="text-slate-800 text-[11px]">
                        {selectedDetailSale.saleDate ? new Date(selectedDetailSale.saleDate).toLocaleString() : 'N/A'}
                      </strong>
                    </div>

                    {selectedDetailSale.holdDate && (
                      <div className="flex justify-between items-center text-xs py-1">
                        <span className="text-slate-500 font-semibold">Hold Timestamp</span>
                        <strong className="text-slate-800 text-[11px]">
                          {new Date(selectedDetailSale.holdDate).toLocaleString()}
                        </strong>
                      </div>
                    )}
                  </div>
                </div>

                {/* Sequential serial number listing */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                  <h5 className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center justify-between">
                    <span>🔋 Sequenced Battery Pack Serials</span>
                    <span className="text-slate-400 text-[9px] font-bold">Generated from Series Range</span>
                  </h5>
                  
                  {(!selectedDetailSale.startNo || selectedDetailSale.startNo === 'N/A') ? (
                    <p className="text-xs text-slate-400 font-medium py-1">No serialized ranges defined for this bulk shipment.</p>
                  ) : (
                    (() => {
                      const list = generateSerialRange(selectedDetailSale.startNo, selectedDetailSale.endNo, selectedDetailSale.quantity);
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

                {/* Custom Notes */}
                {selectedDetailSale.notes && (
                  <div className="space-y-1.5">
                    <h5 className="text-[10px] font-black uppercase tracking-wider text-slate-400">Shipment Transport & Dispatch Notes</h5>
                    <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs text-slate-600 leading-relaxed font-sans font-medium whitespace-pre-wrap">
                      {selectedDetailSale.notes}
                    </div>
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-between items-center">
                <div className="flex gap-2">
                  {selectedDetailSale.status === 'hold' && (
                    <>
                      <button
                        onClick={async () => {
                          const saleId = selectedDetailSale.id;
                          setSelectedDetailSale(null);
                          await handleFinalizeHold(saleId);
                        }}
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-sans font-bold text-xs rounded-xl cursor-pointer transition-all shadow-sm active:scale-[0.98]"
                      >
                        Sell & Finalize Hold
                      </button>
                      <button
                        onClick={async () => {
                          const saleId = selectedDetailSale.id;
                          setSelectedDetailSale(null);
                          await handleReleaseHold(saleId);
                        }}
                        className="px-3.5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-sans font-bold text-xs rounded-xl cursor-pointer transition-all active:scale-[0.98]"
                      >
                        Release Hold
                      </button>
                    </>
                  )}
                </div>
                <button
                  onClick={() => setSelectedDetailSale(null)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-sans font-extrabold text-xs rounded-xl cursor-pointer transition-colors"
                >
                  Close Details
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Scooter Asset Detail Modal (when clicked from lookup results) */}
      <AnimatePresence>
        {selectedDetailScooter && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto" id="scooter-detail-modal-overlay">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden font-sans"
              id="scooter-detail-modal-content"
            >
              {/* Header */}
              <div className="bg-slate-900 text-white p-6 flex justify-between items-start">
                <div className="space-y-1">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400 font-mono">
                    System SKU Identifiers / Spec Sheet
                  </span>
                  <h3 className="text-lg font-black tracking-tight flex items-center gap-2">
                    {selectedDetailScooter.modelName} <span className="text-xs font-normal text-slate-400 font-mono">({selectedDetailScooter.color})</span>
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedDetailScooter(null)}
                  className="p-1.5 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Scrollable details */}
              <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
                {/* Visual Status row */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Chassis Status</span>
                    <span className={`text-xs font-extrabold flex items-center gap-1.5 mt-1 ${
                      selectedDetailScooter.status === 'sold' 
                        ? 'text-blue-700' 
                        : selectedDetailScooter.status === 'hold' 
                          ? 'text-amber-700' 
                          : 'text-emerald-700'
                    }`}>
                      <span className={`h-2 w-2 rounded-full ${
                        selectedDetailScooter.status === 'sold' 
                          ? 'bg-blue-600 animate-pulse' 
                          : selectedDetailScooter.status === 'hold' 
                            ? 'bg-amber-600' 
                            : 'bg-emerald-600'
                      }`}></span>
                      {selectedDetailScooter.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 col-span-1 sm:col-span-2">
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Battery Configuration</span>
                    <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5 mt-1">
                      {selectedDetailScooter.batterySerials.length > 0 ? (
                        <span className="text-emerald-700">🔋 {selectedDetailScooter.batterySerials.length} Linked Batteries</span>
                      ) : (
                        <span className="text-amber-600">⏳ No batteries linked yet</span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Main specification details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Left Specs */}
                  <div className="space-y-3">
                    <h5 className="text-[10px] font-black uppercase tracking-wider text-slate-400 border-b pb-1">Core Hardware</h5>
                    
                    <div className="flex justify-between items-center text-xs py-1">
                      <span className="text-slate-500 font-semibold">Chassis Number</span>
                      <strong className="text-slate-900 font-mono select-all bg-slate-50 px-2 py-0.5 rounded border border-slate-200">{selectedDetailScooter.chassisNo}</strong>
                    </div>

                    <div className="flex justify-between items-center text-xs py-1">
                      <span className="text-slate-500 font-semibold">Motor Number</span>
                      <strong className="text-slate-900 font-mono select-all bg-slate-50 px-2 py-0.5 rounded border border-slate-200">{selectedDetailScooter.motorNo}</strong>
                    </div>

                    <div className="flex justify-between items-center text-xs py-1">
                      <span className="text-slate-500 font-semibold">Controller Number</span>
                      <strong className="text-slate-900 font-mono select-all bg-slate-50 px-2 py-0.5 rounded border border-slate-200">{selectedDetailScooter.controllerNo}</strong>
                    </div>

                    <div className="flex justify-between items-center text-xs py-1">
                      <span className="text-slate-500 font-semibold">Front Tire Size</span>
                      <strong className="text-slate-800">{selectedDetailScooter.frontTireSize || 'Default (10-inch)'}</strong>
                    </div>

                    <div className="flex justify-between items-center text-xs py-1">
                      <span className="text-slate-500 font-semibold">Rear Tire Size</span>
                      <strong className="text-slate-800">{selectedDetailScooter.rearTireSize || 'Default (10-inch)'}</strong>
                    </div>
                  </div>

                  {/* Right Audit/Log */}
                  <div className="space-y-3">
                    <h5 className="text-[10px] font-black uppercase tracking-wider text-slate-400 border-b pb-1">Production Metadata</h5>

                    <div className="flex justify-between items-center text-xs py-1">
                      <span className="text-slate-500 font-semibold">Assembled By</span>
                      <strong className="text-slate-800">@{selectedDetailScooter.createdOperator}</strong>
                    </div>

                    <div className="flex justify-between items-center text-xs py-1">
                      <span className="text-slate-500 font-semibold">Build Timestamp</span>
                      <strong className="text-slate-800 text-[11px]">
                        {selectedDetailScooter.createdTimestamp ? new Date(selectedDetailScooter.createdTimestamp).toLocaleString() : 'N/A'}
                      </strong>
                    </div>

                    <div className="flex justify-between items-center text-xs py-1">
                      <span className="text-slate-500 font-semibold">Last Modified By</span>
                      <strong className="text-slate-800">@{selectedDetailScooter.lastUpdatedBy || selectedDetailScooter.createdOperator}</strong>
                    </div>

                    <div className="flex justify-between items-center text-xs py-1">
                      <span className="text-slate-500 font-semibold">Last Modified At</span>
                      <strong className="text-slate-800 text-[11px]">
                        {selectedDetailScooter.lastUpdatedTimestamp ? new Date(selectedDetailScooter.lastUpdatedTimestamp).toLocaleString() : 'N/A'}
                      </strong>
                    </div>

                    {selectedDetailScooter.heldFor && (
                      <div className="flex justify-between items-center text-xs py-1 bg-amber-50/50 p-1.5 rounded-xl border border-amber-100">
                        <span className="text-amber-800 font-semibold">Held For Buyer</span>
                        <strong className="text-amber-950 font-bold">{selectedDetailScooter.heldFor}</strong>
                      </div>
                    )}
                  </div>
                </div>

                {/* Battery allocations details */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                  <h5 className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
                    <span>🔋 Allocated Battery Serials</span>
                    <span className="text-slate-400">({selectedDetailScooter.batterySerials.length} in slot)</span>
                  </h5>
                  
                  {selectedDetailScooter.batterySerials.length === 0 ? (
                    <p className="text-xs text-slate-400 font-medium py-2">No physical battery cells have been assigned to this chassis in Stage 3.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {selectedDetailScooter.batterySerials.map((serial, idx) => {
                        const inWarranty = selectedDetailScooter.batteryWarrantyFlags?.[idx];
                        const duration = selectedDetailScooter.batteryWarrantyMonths?.[idx];
                        return (
                          <div key={idx} className="bg-white px-3 py-2 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-400 text-[10px] bg-slate-100 h-5 w-5 flex items-center justify-center rounded-full">
                                {idx + 1}
                              </span>
                              <span className="font-mono font-bold text-slate-800 select-all">{serial}</span>
                            </div>
                            {duration !== undefined && (
                              <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full ${
                                inWarranty ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                              }`}>
                                {inWarranty ? `${duration}m warranty` : 'No warranty'}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Customizations / Retrofit Notes if any */}
                {selectedDetailScooter.customizationNotes && (
                  <div className="space-y-1.5">
                    <h5 className="text-[10px] font-black uppercase tracking-wider text-slate-400">Retrofit / Customization Specification Log</h5>
                    <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs text-slate-600 leading-relaxed font-sans font-medium whitespace-pre-wrap">
                      {selectedDetailScooter.customizationNotes}
                    </div>
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-end">
                <button
                  onClick={() => setSelectedDetailScooter(null)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-sans font-extrabold text-xs rounded-2xl cursor-pointer transition-colors"
                >
                  Close Specification Sheet
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Helper function to generate battery sequential serials from start/end ranges
function generateSerialRange(start: string, end: string, count: number): string[] {
  if (!start || !end || start === 'N/A' || end === 'N/A') return [];
  
  const startMatch = start.trim().toUpperCase().match(/^([A-Z0-9\-_]*?)(\d+)$/);
  const endMatch = end.trim().toUpperCase().match(/^([A-Z0-9\-_]*?)(\d+)$/);
  
  if (startMatch && endMatch) {
    const prefix = startMatch[1];
    const startNum = parseInt(startMatch[2], 10);
    const endNum = parseInt(endMatch[2], 10);
    const paddingLength = startMatch[2].length;
    
    if (endNum >= startNum && (endNum - startNum + 1) <= 1000) { // Limit to 1000 to prevent crash
      const list: string[] = [];
      for (let i = startNum; i <= endNum; i++) {
        const numStr = String(i).padStart(paddingLength, '0');
        list.push(`${prefix}${numStr}`);
      }
      return list;
    }
  }
  
  // Fallback to start and end
  return [start, end];
}
