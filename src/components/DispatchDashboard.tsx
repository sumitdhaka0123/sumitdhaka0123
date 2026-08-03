import { getApiBaseUrl } from '../utils/apiConfig';
import React, { useState, useMemo } from 'react';
import { 
  Truck, CheckCircle2, Clock, AlertCircle, ArrowLeft, ArrowRight, Package, Shield, Layers, 
  Search, ArrowUpDown, MapPin, User, Phone, Eye, Box, Wrench, ChevronRight, Filter, Info, Copy, X
} from 'lucide-react';
import { 
  User as UserType, ScooterUnit, SalesOrder, SalesOrderItem, BatteryImport, BatterySale, ChargerImport, ChargerSale, Product, StockLog 
} from '../types';

interface DispatchDashboardProps {
  salesOrders?: SalesOrder[];
  scooterUnits?: ScooterUnit[];
  batteryImports?: BatteryImport[];
  batterySales?: BatterySale[];
  chargerImports?: ChargerImport[];
  chargerSales?: ChargerSale[];
  products?: Product[];
  stockLogs?: StockLog[];
  currentUser: UserType;
  onRefresh: () => void;
}

export const DispatchDashboard: React.FC<DispatchDashboardProps> = ({
  salesOrders = [],
  scooterUnits = [],
  batteryImports = [],
  batterySales = [],
  chargerImports = [],
  chargerSales = [],
  products = [],
  stockLogs = [],
  currentUser,
  onRefresh
}) => {
  // Main view switcher (Only 2 top navigation tabs: Orders Dispatch and Warehouse Stock)
  const [activeMainTab, setActiveMainTab] = useState<'orders' | 'warehouse'>('orders');

  // Box details modal state
  const [showBoxDetailsModal, setShowBoxDetailsModal] = useState(false);
  const [boxModalSearch, setBoxModalSearch] = useState('');

  // Battery details modal state
  const [showBatteryDetailsModal, setShowBatteryDetailsModal] = useState(false);
  const [batteryModalSearch, setBatteryModalSearch] = useState('');

  // Charger details modal state
  const [showChargerDetailsModal, setShowChargerDetailsModal] = useState(false);
  const [chargerModalSearch, setChargerModalSearch] = useState('');

  // Orders Filter & Sort States
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'prepared' | 'dispatched'>('pending');
  const [sortBy, setSortBy] = useState<'priority' | 'newest' | 'oldest'>('priority');
  const [searchQuery, setSearchQuery] = useState('');

  // Quick-View Side Panel State
  const [quickViewOrder, setQuickViewOrder] = useState<SalesOrder | null>(null);

  // Warehouse Search State
  const [warehouseSearch, setWarehouseSearch] = useState('');
  const [warehouseCategory, setWarehouseCategory] = useState<'all' | 'scooters' | 'batteries' | 'chargers'>('all');

  // Dispatch Loading wizard state
  const [selectedOrderForDispatch, setSelectedOrderForDispatch] = useState<SalesOrder | null>(null);

  // Warehouse Stock Calculations
  const availableScooters = useMemo(() => {
    return (scooterUnits || []).filter(u => u && (u.status === 'available' || u.status === 'hold'));
  }, [scooterUnits]);

  // Model-wise stock calculation matching Manager Dashboard
  const modelStockSummary = useMemo<Record<string, { total: number; colors: Record<string, number>; units: ScooterUnit[] }>>(() => {
    const map: Record<string, { total: number; colors: Record<string, number>; units: ScooterUnit[] }> = {};
    
    // Initialize for all known products
    (products || []).forEach(p => {
      if (!p || !p.name) return;
      map[p.name] = { total: 0, colors: {}, units: [] };
      const colorList = Array.isArray(p.colors) && p.colors.length > 0 ? p.colors : [];
      colorList.forEach(c => {
        map[p.name].colors[c] = 0;
      });
    });

    // Populate with available ready units in warehouse
    (availableScooters || []).forEach(scoot => {
      if (!scoot || !scoot.modelName) return;
      if (!map[scoot.modelName]) {
        map[scoot.modelName] = { total: 0, colors: {}, units: [] };
      }
      map[scoot.modelName].total += 1;
      const col = scoot.color || 'Standard';
      map[scoot.modelName].colors[col] = (map[scoot.modelName].colors[col] || 0) + 1;
      map[scoot.modelName].units.push(scoot);
    });

    return map;
  }, [products, availableScooters]);

  const getColorDotHex = (colorName: string) => {
    const c = (colorName || '').toLowerCase();
    if (c.includes('red') || c.includes('crimson')) return '#ef4444';
    if (c.includes('blue') || c.includes('cyan')) return '#06b6d4';
    if (c.includes('black') || c.includes('dark')) return '#1e293b';
    if (c.includes('white') || c.includes('silver')) return '#94a3b8';
    if (c.includes('green') || c.includes('emerald')) return '#10b981';
    if (c.includes('yellow') || c.includes('gold')) return '#eab308';
    if (c.includes('grey') || c.includes('gray')) return '#64748b';
    if (c.includes('orange')) return '#f97316';
    if (c.includes('purple')) return '#a855f7';
    return '#6366f1';
  };

  // Calculate detailed Stock in Box (unassembled kits) per model and color variant
  const boxesKitsList = useMemo(() => {
    const list: { modelName: string; color: string; imported: number; assembled: number; remaining: number }[] = [];
    (products || []).forEach(p => {
      if (!p) return;
      const colorList = Array.isArray(p.colors) && p.colors.length > 0 ? p.colors : ['Default'];
      colorList.forEach(col => {
        const importedCount = (stockLogs || [])
          .filter(log => log && log.modelName === p.name && log.color === col && log.type === 'in' && !(log.notes && log.notes.includes('(Chassis:')))
          .reduce((sum, log) => sum + (log.quantity || 0), 0);

        const assembledCount = (scooterUnits || []).filter(
          u => u && u.modelName === p.name && u.color === col
        ).length;

        const remaining = Math.max(0, importedCount - assembledCount);
        if (importedCount > 0) {
          list.push({
            modelName: p.name || 'Unknown',
            color: col || 'Standard',
            imported: importedCount,
            assembled: assembledCount,
            remaining: remaining
          });
        }
      });
    });
    return list;
  }, [products, stockLogs, scooterUnits]);

  const totalBoxesInCrates = useMemo(() => {
    return boxesKitsList.reduce((sum, item) => sum + item.remaining, 0);
  }, [boxesKitsList]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [loadingItemsState, setLoadingItemsState] = useState<SalesOrderItem[]>([]);

  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter and Sort Orders
  const filteredAndSortedOrders = useMemo(() => {
    return salesOrders
      .filter(o => {
        // Status filter
        if (statusFilter === 'pending' && o.status !== 'pending') return false;
        if (statusFilter === 'prepared' && o.status !== 'prepared') return false;
        if (statusFilter === 'dispatched' && o.status !== 'dispatched' && o.status !== 'challan_generated') return false;

        // Search query filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchesNo = o.orderNo ? (o.orderNo || '').toLowerCase().includes(q) : false;
          const matchesBuyer = o.buyerName ? (o.buyerName || '').toLowerCase().includes(q) : false;
          const matchesLoc = o.deliveryLocation ? (o.deliveryLocation || '').toLowerCase().includes(q) : false;
          const matchesSalesperson = o.salespersonName ? (o.salespersonName || '').toLowerCase().includes(q) : false;
          const matchesItem = (o.items || []).some(it => 
            (it.productName || '').toLowerCase().includes(q) || 
            (it.batteryType || '').toLowerCase().includes(q) || 
            (it.chargerType || '').toLowerCase().includes(q)
          );
          return matchesNo || matchesBuyer || matchesLoc || matchesSalesperson || matchesItem;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'priority') {
          // Priority sorting: Larger item count / pending first, then newest
          const totalQtyA = a.items.reduce((sum, item) => sum + item.quantity, 0);
          const totalQtyB = b.items.reduce((sum, item) => sum + item.quantity, 0);
          if (totalQtyB !== totalQtyA) {
            return totalQtyB - totalQtyA; // Larger orders first
          }
          return new Date(b.createdTimestamp).getTime() - new Date(a.createdTimestamp).getTime();
        } else if (sortBy === 'newest') {
          return new Date(b.createdTimestamp).getTime() - new Date(a.createdTimestamp).getTime();
        } else {
          return new Date(a.createdTimestamp).getTime() - new Date(b.createdTimestamp).getTime();
        }
      });
  }, [salesOrders, statusFilter, sortBy, searchQuery]);

  // Set default quickViewOrder if not set
  const activeQuickViewOrder = useMemo(() => {
    if (quickViewOrder && salesOrders.some(o => o.id === quickViewOrder.id)) {
      return salesOrders.find(o => o.id === quickViewOrder.id) || quickViewOrder;
    }
    return filteredAndSortedOrders.length > 0 ? filteredAndSortedOrders[0] : null;
  }, [quickViewOrder, filteredAndSortedOrders, salesOrders]);

  const unassembledKits = useMemo(() => {
    return scooterUnits.filter(u => u.status === 'in_assembly' || (u.assemblyStage && u.assemblyStage < 5));
  }, [scooterUnits]);

  // Battery Stock Calculations
  const totalBatteriesImported = useMemo(() => {
    return batteryImports.reduce((sum, imp) => sum + (Number(imp.quantity) || 0), 0);
  }, [batteryImports]);

  const totalBatteriesSold = useMemo(() => {
    return batterySales.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);
  }, [batterySales]);

  const totalBatteriesInScooters = useMemo(() => {
    return scooterUnits.reduce((sum, u) => sum + (u.batterySerials?.length || 0), 0);
  }, [scooterUnits]);

  const availableBatteryStock = Math.max(0, totalBatteriesImported - totalBatteriesSold - totalBatteriesInScooters);

  // Charger Stock Calculations
  const totalChargersImported = useMemo(() => {
    return chargerImports.reduce((sum, imp) => sum + (Number(imp.quantity) || (imp.serialNumbers ? imp.serialNumbers.length : 0) || 0), 0);
  }, [chargerImports]);

  const totalChargersSold = useMemo(() => {
    return chargerSales.reduce((sum, s) => sum + (Number(s.quantity) || (s.serialNumbers ? s.serialNumbers.length : 0) || 0), 0);
  }, [chargerSales]);

  const totalChargersInScooters = useMemo(() => {
    return scooterUnits.filter(u => u.chargerIncluded || u.chargerType || u.chargerSerial).length;
  }, [scooterUnits]);

  const availableChargerStock = Math.max(0, totalChargersImported - totalChargersSold - totalChargersInScooters);

  // Detailed Battery Stock Breakdown by Series / Type
  const batteryTypeStockList = useMemo(() => {
    const map: Record<string, { batterySeries: string; imported: number; sold: number; assignedToScooters: number; available: number }> = {};

    const resolveKey = (input: string) => {
      if (!input) return null;
      const clean = input.trim().toLowerCase().replace(/\s*series/g, '');
      for (const k of Object.keys(map)) {
        const kClean = k.trim().toLowerCase().replace(/\s*series/g, '');
        if (kClean === clean || clean.includes(kClean) || kClean.includes(clean)) return k;
      }
      return input.trim();
    };

    (batteryImports || []).forEach(imp => {
      const rawSeries = (imp.batterySeries || 'Standard Series').trim();
      const series = resolveKey(rawSeries) || rawSeries;
      if (!map[series]) {
        map[series] = { batterySeries: series, imported: 0, sold: 0, assignedToScooters: 0, available: 0 };
      }
      map[series].imported += (Number(imp.quantity) || 0);
    });

    (batterySales || []).forEach(s => {
      const rawSeries = (s.batterySeries || 'Standard Series').trim();
      const series = resolveKey(rawSeries) || rawSeries;
      if (!map[series]) {
        map[series] = { batterySeries: series, imported: 0, sold: 0, assignedToScooters: 0, available: 0 };
      }
      map[series].sold += (Number(s.quantity) || 0);
    });

    (scooterUnits || []).forEach(u => {
      if (u.batterySerials && u.batterySerials.length > 0) {
        u.batterySerials.forEach(s => {
          if (!s) return;
          const sLower = s.toLowerCase();
          let matchedKey: string | null = null;
          for (const key of Object.keys(map)) {
            if (sLower.includes(key.toLowerCase()) || key.toLowerCase().includes(sLower.substring(0, 3))) {
              matchedKey = key;
              break;
            }
          }
          if (matchedKey && map[matchedKey]) {
            map[matchedKey].assignedToScooters += 1;
          }
        });
      }
    });

    return Object.values(map).map(item => ({
      ...item,
      available: Math.max(0, item.imported - item.sold - item.assignedToScooters)
    }));
  }, [batteryImports, batterySales, scooterUnits]);

  // Detailed Charger Stock Breakdown by Type
  const chargerTypeStockList = useMemo(() => {
    const map: Record<string, { chargerType: string; imported: number; sold: number; assignedToScooters: number; available: number }> = {};

    const resolveKey = (input: string) => {
      if (!input) return null;
      const clean = input.trim().toLowerCase();
      for (const k of Object.keys(map)) {
        const kClean = k.trim().toLowerCase();
        if (kClean === clean || kClean.replace(/\s+/g, '') === clean.replace(/\s+/g, '')) return k;
      }
      return input.trim();
    };

    (chargerImports || []).forEach(imp => {
      const rawType = (imp.chargerType || 'Standard Charger').trim();
      const cType = resolveKey(rawType) || rawType;
      if (!map[cType]) {
        map[cType] = { chargerType: cType, imported: 0, sold: 0, assignedToScooters: 0, available: 0 };
      }
      map[cType].imported += (Number(imp.quantity) || 0);
    });

    (chargerSales || []).forEach(s => {
      const rawType = (s.chargerType || 'Standard Charger').trim();
      const cType = resolveKey(rawType) || rawType;
      if (!map[cType]) {
        map[cType] = { chargerType: cType, imported: 0, sold: 0, assignedToScooters: 0, available: 0 };
      }
      map[cType].sold += (Number(s.quantity) || 0);
    });

    (scooterUnits || []).forEach(u => {
      if (u.chargerIncluded || u.chargerType || u.chargerSerial) {
        const rawType = (u.chargerType || 'Standard Charger').trim();
        const cType = resolveKey(rawType) || rawType;
        if (map[cType]) {
          map[cType].assignedToScooters += 1;
        }
      }
    });

    return Object.values(map).map(item => ({
      ...item,
      available: Math.max(0, item.imported - item.sold - item.assignedToScooters)
    }));
  }, [chargerImports, chargerSales, scooterUnits]);

  // Handle Button 1: "Order Prepared"
  const handleMarkPrepared = async (orderId: string) => {
    setIsSubmitting(true);
    setStatusMessage(null);
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/sales-orders/${orderId}/prepare`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operator: currentUser.name || currentUser.username,
          operatorRole: currentUser.role
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to mark order as prepared');

      setStatusMessage({ type: 'success', text: data.message || 'Order marked as Prepared!' });
      onRefresh();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Error marking order as prepared.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Button 2: Open "Dispatch" (Step-by-step Loading Process)
  const handleStartDispatchWizard = (order: SalesOrder) => {
    const clonedItems: SalesOrderItem[] = order.items.map(it => ({
      ...it,
      chassisNumbers: it.chassisNumbers ? [...it.chassisNumbers] : Array(it.itemType === 'scooter' ? it.quantity : 0).fill(''),
      serialNumbers: it.serialNumbers ? [...it.serialNumbers] : Array(it.itemType !== 'scooter' && it.isUnderWarranty ? it.quantity : 0).fill('')
    }));

    setSelectedOrderForDispatch(order);
    setLoadingItemsState(clonedItems);
    setCurrentStepIndex(0);
    setStatusMessage(null);
  };

  // Helper to update chassis number for a specific scooter index
  const handleSetChassisNo = (itemIdx: number, scooterUnitIdx: number, value: string) => {
    const updated = [...loadingItemsState];
    const chassisList = [...(updated[itemIdx].chassisNumbers || [])];
    chassisList[scooterUnitIdx] = value;
    updated[itemIdx].chassisNumbers = chassisList;
    setLoadingItemsState(updated);
  };

  // Helper to update startNo and endNo for battery/charger
  const handleSetSeriesRange = (itemIdx: number, startNo: string, endNo: string) => {
    const updated = [...loadingItemsState];
    updated[itemIdx].startNo = startNo;
    updated[itemIdx].endNo = endNo;
    
    if (startNo && endNo) {
      const matchStart = startNo.match(/^(.*?)(\d+)$/);
      const matchEnd = endNo.match(/^(.*?)(\d+)$/);
      if (matchStart && matchEnd && matchStart[1] === matchEnd[1]) {
        const prefix = matchStart[1];
        const numStart = parseInt(matchStart[2], 10);
        const numEnd = parseInt(matchEnd[2], 10);
        const padLen = matchStart[2].length;
        if (!isNaN(numStart) && !isNaN(numEnd) && numEnd >= numStart) {
          const generated: string[] = [];
          for (let i = numStart; i <= numEnd; i++) {
            generated.push(`${prefix}${String(i).padStart(padLen, '0')}`);
          }
          updated[itemIdx].serialNumbers = generated;
        }
      }
    }
    setLoadingItemsState(updated);
  };

  // Submit full dispatch loading
  const handleCompleteDispatch = async () => {
    if (!selectedOrderForDispatch) return;

    for (let i = 0; i < loadingItemsState.length; i++) {
      const it = loadingItemsState[i];
      if (it.itemType === 'scooter') {
        if (!it.chassisNumbers || it.chassisNumbers.length < it.quantity || it.chassisNumbers.some(c => !c || !c.trim())) {
          setStatusMessage({ type: 'error', text: `Please select a valid Chassis Number for all ${it.quantity} unit(s) of ${it.productName} (${it.color}).` });
          return;
        }
      } else if (it.isUnderWarranty) {
        if (!it.serialNumbers || it.serialNumbers.length < it.quantity || it.serialNumbers.some(s => !s || !s.trim())) {
          setStatusMessage({ type: 'error', text: `Please enter Serial Numbers for all ${it.quantity} unit(s) of ${it.batteryType || it.chargerType} (Under Warranty).` });
          return;
        }
      }
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/sales-orders/${selectedOrderForDispatch.id}/dispatch`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operator: currentUser.name || currentUser.username,
          operatorRole: currentUser.role,
          items: loadingItemsState
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to complete dispatch');

      setStatusMessage({ type: 'success', text: data.message || 'Dispatch loading completed successfully! Moved to Manager Challan section.' });
      setSelectedOrderForDispatch(null);
      setLoadingItemsState([]);
      setCurrentStepIndex(0);
      onRefresh();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Error completing dispatch.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner & Main Mode Selector */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Truck className="h-7 w-7 text-indigo-600" />
              <span>Warehouse & Dispatch Control Terminal</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Manage incoming sales order loading, audit total warehouse inventory, and track pending assembly kits.
            </p>
          </div>

          {/* High-level navigation modes */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl text-xs font-bold shrink-0">
            <button
              onClick={() => setActiveMainTab('orders')}
              className={`px-3.5 py-2 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeMainTab === 'orders' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Truck className="h-4 w-4" />
              <span>Orders Dispatch ({salesOrders.filter(o => o.status === 'pending' || o.status === 'prepared').length})</span>
            </button>

            <button
              onClick={() => setActiveMainTab('warehouse')}
              className={`px-3.5 py-2 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeMainTab === 'warehouse' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Box className="h-4 w-4 text-emerald-400" />
              <span>Warehouse Stock ({availableScooters.length})</span>
            </button>
          </div>
        </div>
      </div>

      {statusMessage && (
        <div className={`p-4 rounded-xl flex items-center gap-3 text-sm font-semibold ${
          statusMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          {statusMessage.type === 'success' ? <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" /> : <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* 1. MAIN TAB: ORDERS DISPATCH & LOADING */}
      {activeMainTab === 'orders' && (
        <div className="space-y-5">
          {/* Filter & Sort Control Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Status Tabs */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold overflow-x-auto">
              <button
                onClick={() => setStatusFilter('pending')}
                className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                  statusFilter === 'pending' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ⏳ Pending ({salesOrders.filter(o => o.status === 'pending').length})
              </button>
              <button
                onClick={() => setStatusFilter('prepared')}
                className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                  statusFilter === 'prepared' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                📦 Prepared ({salesOrders.filter(o => o.status === 'prepared').length})
              </button>
              <button
                onClick={() => setStatusFilter('dispatched')}
                className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                  statusFilter === 'dispatched' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ✅ Dispatched ({salesOrders.filter(o => o.status === 'dispatched' || o.status === 'challan_generated').length})
              </button>
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                  statusFilter === 'all' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Orders ({salesOrders.length})
              </button>
            </div>

            {/* Search & Sort Controls */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              {/* Search Bar */}
              <div className="relative w-full sm:w-64">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search buyer, location, order #..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Priority / Date Sort Dropdown */}
              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                <ArrowUpDown className="h-4 w-4 text-slate-400 shrink-0" />
                <select
                  value={sortBy}
                  onChange={(e: any) => setSortBy(e.target.value)}
                  className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer w-full"
                >
                  <option value="priority">🔥 Sort by Priority (Large Orders First)</option>
                  <option value="newest">📅 Sort by Delivery Date (Newest First)</option>
                  <option value="oldest">⏳ Sort by Delivery Date (Oldest First)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Main Grid + Quick View Side Panel Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Orders Cards List (7 Cols) */}
            <div className="lg:col-span-7 space-y-4">
              {filteredAndSortedOrders.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 text-slate-400 space-y-2">
                  <Clock className="h-10 w-10 text-slate-300 mx-auto" />
                  <p className="font-bold text-base text-slate-600">No orders match the selected filter/search.</p>
                  <p className="text-xs">Adjust search keywords or switch order status above.</p>
                </div>
              ) : (
                filteredAndSortedOrders.map(order => {
                  const isSelected = activeQuickViewOrder?.id === order.id;
                  const totalUnits = order.items.reduce((a, b) => a + b.quantity, 0);

                  return (
                    <div 
                      key={order.id} 
                      onClick={() => setQuickViewOrder(order)}
                      className={`bg-white rounded-2xl p-5 shadow-sm border transition-all cursor-pointer relative ${
                        isSelected 
                          ? 'border-indigo-600 ring-2 ring-indigo-500/20 shadow-md' 
                          : 'border-slate-200 hover:border-indigo-300'
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-black bg-slate-900 text-white px-2.5 py-1 rounded-lg">
                              {order.orderNo}
                            </span>
                            {totalUnits >= 5 && (
                              <span className="bg-rose-100 text-rose-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1 border border-rose-200">
                                🔥 High Priority ({totalUnits} units)
                              </span>
                            )}
                          </div>

                          <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${
                            order.status === 'pending' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                            order.status === 'prepared' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                            'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}>
                            {order.status === 'pending' ? '⏳ Pending' : order.status === 'prepared' ? '📦 Prepared' : '🚚 Dispatched'}
                          </span>
                        </div>

                        <div>
                          <h4 className="text-sm font-black text-slate-900">{order.buyerName}</h4>
                          {order.buyerContact && <p className="text-xs text-slate-500 font-semibold mt-0.5">📞 {order.buyerContact}</p>}
                          {order.deliveryLocation && (
                            <p className="text-xs text-indigo-700 font-bold mt-1.5 bg-indigo-50/80 p-2 rounded-xl border border-indigo-100 flex items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                              <span>Delivery: {order.deliveryLocation}</span>
                            </p>
                          )}
                        </div>

                        {/* Items Summary */}
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
                          <p className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">
                            Order Line Items ({totalUnits} units)
                          </p>
                          {order.items.map((it, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs text-slate-700">
                              <span className="font-semibold truncate">
                                {it.itemType === 'scooter' ? `🛵 ${it.productName} (${it.color})` : it.itemType === 'battery' ? `🔋 ${it.batteryType}` : `⚡ ${it.chargerType}`}
                              </span>
                              <span className="font-black text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200 ml-2">
                                x{it.quantity}
                              </span>
                            </div>
                          ))}
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                          <span>Sales Rep: {order.salespersonName}</span>
                          <span className="font-semibold text-indigo-600 flex items-center gap-1">
                            <Eye className="h-3.5 w-3.5" /> View Panel & Actions
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Right Column: Quick View Side Panel (5 Cols) */}
            <div className="lg:col-span-5">
              <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-xl border border-slate-800 sticky top-4 space-y-5">
                <div className="border-b border-slate-800 pb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Info className="h-5 w-5 text-indigo-400" />
                    <h3 className="text-base font-extrabold text-white">Quick-View Order Panel</h3>
                  </div>
                  {activeQuickViewOrder && (
                    <span className="font-mono text-xs bg-indigo-950 text-indigo-300 font-bold px-2.5 py-1 rounded-lg border border-indigo-800/50">
                      {activeQuickViewOrder.orderNo}
                    </span>
                  )}
                </div>

                {!activeQuickViewOrder ? (
                  <div className="py-12 text-center text-slate-500 space-y-2">
                    <Package className="h-10 w-10 text-slate-700 mx-auto" />
                    <p className="text-xs font-semibold">Select any order card on the left to inspect details here.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Buyer & Location Card */}
                    <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700/60 space-y-3">
                      <div>
                        <p className="text-[10px] font-extrabold uppercase text-indigo-400 tracking-wider">Buyer Name</p>
                        <p className="text-base font-black text-white mt-0.5">{activeQuickViewOrder.buyerName}</p>
                        {activeQuickViewOrder.buyerContact && (
                          <p className="text-xs text-slate-300 font-semibold mt-0.5 flex items-center gap-1">
                            <Phone className="h-3.5 w-3.5 text-cyan-400" />
                            <span>{activeQuickViewOrder.buyerContact}</span>
                          </p>
                        )}
                      </div>

                      <div className="border-t border-slate-700/60 pt-2.5">
                        <p className="text-[10px] font-extrabold uppercase text-indigo-400 tracking-wider flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-rose-400" />
                          <span>Delivery Location</span>
                        </p>
                        <p className="text-xs font-bold text-slate-100 mt-1 bg-slate-900/80 p-2.5 rounded-lg border border-slate-700">
                          {activeQuickViewOrder.deliveryLocation || 'Location not explicitly provided'}
                        </p>
                      </div>
                    </div>

                    {/* Total Items to be Packed Card */}
                    <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700/60 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
                        <span className="text-xs font-extrabold uppercase text-slate-300">Total Items To Pack</span>
                        <span className="text-xs font-black text-indigo-400 bg-indigo-950 px-2.5 py-0.5 rounded-full border border-indigo-800">
                          {activeQuickViewOrder.items.reduce((a, b) => a + b.quantity, 0)} Units
                        </span>
                      </div>

                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {activeQuickViewOrder.items.map((it, idx) => (
                          <div key={idx} className="bg-slate-900 p-2.5 rounded-lg border border-slate-700 flex items-center justify-between text-xs">
                            <div className="space-y-0.5">
                              <p className="font-bold text-white">
                                {it.itemType === 'scooter' ? `${it.productName}` : it.itemType === 'battery' ? `${it.batteryType}` : `${it.chargerType}`}
                              </p>
                              {it.itemType === 'scooter' && <p className="text-[10px] text-indigo-300 font-semibold">Color: {it.color}</p>}
                              {it.isUnderWarranty && <p className="text-[10px] text-emerald-400 font-semibold">🛡️ Warranty: {it.warrantyMonths} Mos</p>}
                            </div>
                            <span className="font-extrabold text-sm text-cyan-300 bg-slate-800 px-2.5 py-1 rounded border border-slate-700">
                              x{it.quantity}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Sales Order Placement Info */}
                    <div className="text-[11px] text-slate-400 space-y-1 bg-slate-800/40 p-3 rounded-xl border border-slate-800">
                      <p><strong>Order No:</strong> #{activeQuickViewOrder.orderNo}</p>
                      <p><strong>Salesperson:</strong> {activeQuickViewOrder.salespersonName}</p>
                      <p><strong>Date Placed:</strong> {new Date(activeQuickViewOrder.createdTimestamp).toLocaleString()}</p>
                      {activeQuickViewOrder.notes && (
                        <p className="text-amber-300 mt-1 italic">💡 {activeQuickViewOrder.notes}</p>
                      )}
                    </div>

                    {/* Quick CTA Buttons */}
                    <div className="space-y-2 pt-2">
                      {activeQuickViewOrder.status === 'pending' && (
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => handleMarkPrepared(activeQuickViewOrder.id)}
                          className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer transition-all border border-slate-700"
                        >
                          <Package className="h-4 w-4 text-blue-400" />
                          <span>Button 1: Mark Order "Prepared"</span>
                        </button>
                      )}

                      {(activeQuickViewOrder.status === 'pending' || activeQuickViewOrder.status === 'prepared') && (
                        <button
                          type="button"
                          onClick={() => handleStartDispatchWizard(activeQuickViewOrder)}
                          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-3 rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/30 transition-all"
                        >
                          <Truck className="h-4 w-4" />
                          <span>Button 2: Start Step-by-Step Dispatch Wizard</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. MAIN TAB: WAREHOUSE STOCK INSPECTION */}
      {activeMainTab === 'warehouse' && (
        <div className="space-y-6">
          {/* Stock Metrics Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase text-slate-400">Available Scooters</span>
                <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600"><Truck className="h-5 w-5" /></span>
              </div>
              <p className="text-3xl font-black text-slate-900">{availableScooters.length} <span className="text-xs font-semibold text-slate-500">Units</span></p>
              <p className="text-xs text-slate-500 font-medium">Ready in warehouse with chassis numbers assigned.</p>
            </div>

            <div 
              onClick={() => { setShowBoxDetailsModal(true); setBoxModalSearch(''); }}
              className="bg-white p-5 rounded-2xl border-2 border-amber-200 hover:border-amber-400 hover:shadow-md transition-all space-y-2 cursor-pointer select-none relative group overflow-hidden shadow-sm"
              id="dispatch-stock-in-box-card"
            >
              <div className="absolute top-0 right-0 p-1 bg-amber-500/10 text-amber-700 text-[9px] font-bold rounded-bl-xl opacity-0 group-hover:opacity-100 transition-opacity">
                Click to View
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase text-amber-700 flex items-center gap-1.5">
                  <span>Stock in Box 📦</span>
                </span>
                <span className="p-2 rounded-xl bg-amber-50 text-amber-600"><Wrench className="h-5 w-5" /></span>
              </div>
              <p className="text-3xl font-black text-amber-900">{totalBoxesInCrates} <span className="text-xs font-semibold text-amber-700">Boxes in Crates</span></p>
              <p className="text-xs text-slate-500 font-medium">Click to inspect breakdown per model variant & color.</p>
            </div>

            <div 
              onClick={() => { setShowBatteryDetailsModal(true); setBatteryModalSearch(''); }}
              className="bg-white p-5 rounded-2xl border-2 border-emerald-200 hover:border-emerald-400 hover:shadow-md transition-all space-y-2 cursor-pointer select-none relative group overflow-hidden shadow-sm"
              id="dispatch-available-batteries-card"
            >
              <div className="absolute top-0 right-0 p-1 bg-emerald-500/10 text-emerald-700 text-[9px] font-bold rounded-bl-xl opacity-0 group-hover:opacity-100 transition-opacity">
                Click to View
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase text-emerald-800 flex items-center gap-1.5">
                  <span>Available Batteries 🔋</span>
                </span>
                <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600"><Shield className="h-5 w-5" /></span>
              </div>
              <p className="text-3xl font-black text-slate-900">{availableBatteryStock} <span className="text-xs font-semibold text-slate-500">Packs</span></p>
              <p className="text-xs text-slate-500 font-medium">Click to view stock breakdown per battery type & series.</p>
            </div>

            <div 
              onClick={() => { setShowChargerDetailsModal(true); setChargerModalSearch(''); }}
              className="bg-white p-5 rounded-2xl border-2 border-cyan-200 hover:border-cyan-400 hover:shadow-md transition-all space-y-2 cursor-pointer select-none relative group overflow-hidden shadow-sm"
              id="dispatch-available-chargers-card"
            >
              <div className="absolute top-0 right-0 p-1 bg-cyan-500/10 text-cyan-700 text-[9px] font-bold rounded-bl-xl opacity-0 group-hover:opacity-100 transition-opacity">
                Click to View
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase text-cyan-800 flex items-center gap-1.5">
                  <span>Available Chargers ⚡</span>
                </span>
                <span className="p-2 rounded-xl bg-cyan-50 text-cyan-600"><Box className="h-5 w-5" /></span>
              </div>
              <p className="text-3xl font-black text-slate-900">{availableChargerStock} <span className="text-xs font-semibold text-slate-500">Units</span></p>
              <p className="text-xs text-slate-500 font-medium">Click to view stock breakdown per charger type.</p>
            </div>
          </div>

          {/* Warehouse Stock Inventory according to Category */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-5">
            {/* Category Selector Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setWarehouseCategory('all')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                    warehouseCategory === 'all' || warehouseCategory === 'scooters'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Truck className="h-4 w-4" />
                  <span>Ready Scooters ({availableScooters.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setWarehouseCategory('batteries')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                    warehouseCategory === 'batteries'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Shield className="h-4 w-4" />
                  <span>Battery Types ({batteryTypeStockList.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setWarehouseCategory('chargers')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                    warehouseCategory === 'chargers'
                      ? 'bg-cyan-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Box className="h-4 w-4" />
                  <span>Charger Types ({chargerTypeStockList.length})</span>
                </button>
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter stock inventory..."
                  value={warehouseSearch}
                  onChange={(e) => setWarehouseSearch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Category Stock Content Views */}
            {(warehouseCategory === 'all' || warehouseCategory === 'scooters') && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(modelStockSummary)
                  .filter(([modelName, data]: [string, { total: number; colors: Record<string, number>; units: ScooterUnit[] }]) => {
                    if (!warehouseSearch.trim()) return true;
                    const q = warehouseSearch.toLowerCase().trim();
                    if (modelName.toLowerCase().includes(q)) return true;
                    if (data.units.some(u => (u.chassisNo || '').toLowerCase().includes(q) || (u.color || '').toLowerCase().includes(q))) return true;
                    return false;
                  })
                  .sort((a: [string, any], b: [string, any]) => (b[1]?.total || 0) - (a[1]?.total || 0))
                  .map(([modelName, data]: [string, { total: number; colors: Record<string, number>; units: ScooterUnit[] }]) => {
                    const percentOfTotal = availableScooters.length > 0 
                      ? Math.round((data.total / availableScooters.length) * 100) 
                      : 0;

                    return (
                      <div 
                        key={modelName}
                        className="border border-slate-200 hover:border-indigo-300 bg-slate-50/50 hover:bg-white rounded-2xl p-4 shadow-xs transition-all space-y-3.5"
                      >
                        {/* Model Title Header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="p-1.5 rounded-lg bg-indigo-100 text-indigo-800 text-xs font-black uppercase tracking-wider font-sans">
                              {modelName}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-slate-900 bg-white px-3 py-1 rounded-full border border-slate-200 shadow-2xs font-mono">
                              {data.total} {data.total === 1 ? 'Unit' : 'Units'}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400 font-mono">
                              ({percentOfTotal}%)
                            </span>
                          </div>
                        </div>

                        {/* Stock Visual Bar */}
                        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden flex">
                          {data.total > 0 ? (
                            <div 
                              className="bg-indigo-600 h-full transition-all duration-300"
                              style={{ width: `${percentOfTotal}%` }}
                            />
                          ) : (
                            <div className="bg-slate-300 h-full w-full" />
                          )}
                        </div>

                        {/* Color Breakdown List */}
                        <div>
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1.5 font-sans">
                            Color Breakdown:
                          </span>
                          {Object.keys(data.colors).length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {Object.entries(data.colors).map(([colorName, count]) => (
                                <div
                                  key={colorName}
                                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border ${
                                    count > 0 
                                      ? 'bg-white border-slate-200 text-slate-800 shadow-2xs' 
                                      : 'bg-slate-100/60 border-slate-200/60 text-slate-400'
                                  }`}
                                >
                                  <span 
                                    className="h-2.5 w-2.5 rounded-full border border-slate-300 shrink-0" 
                                    style={{ backgroundColor: getColorDotHex(colorName) }}
                                  />
                                  <span className="font-sans">{colorName}:</span>
                                  <span className={count > 0 ? 'text-indigo-600 font-extrabold font-mono' : 'font-mono'}>
                                    {count}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">No colors specified</span>
                          )}
                        </div>

                        {/* Filtered Chassis Units List */}
                        {data.units.length > 0 && (
                          <div className="pt-2 border-t border-slate-200/60">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block mb-1.5 font-sans">
                              Available Chassis Numbers ({data.units.length}):
                            </span>
                            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                              {data.units.map((unit) => (
                                <span 
                                  key={unit.id}
                                  className="font-mono text-[11px] font-bold bg-white text-slate-800 px-2 py-0.5 rounded-lg border border-slate-200 shadow-2xs flex items-center gap-1"
                                >
                                  <span className="text-slate-400">#</span>
                                  <span>{unit.chassisNo}</span>
                                  <span className="text-[9px] text-slate-500 font-sans">({unit.color})</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}

            {warehouseCategory === 'batteries' && (
              <div className="space-y-4">
                <div className="bg-emerald-500/5 border border-emerald-500/10 p-3.5 rounded-2xl text-xs text-emerald-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <span><strong>🔋 Available Battery Stock Breakdown:</strong> Showing available inventory per battery type & series.</span>
                  <span className="font-bold font-mono text-emerald-900 bg-emerald-100 px-3 py-1 rounded-xl">Total Net Available: {availableBatteryStock} Packs</span>
                </div>

                <div className="overflow-x-auto bg-white border border-slate-200 rounded-2xl shadow-sm">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider font-sans">
                        <th className="p-3.5">Battery Series / Type</th>
                        <th className="p-3.5 text-center">Imported Total 📦</th>
                        <th className="p-3.5 text-center">Standalone Sold 🏷️</th>
                        <th className="p-3.5 text-center">Assigned to Scooters 🛵</th>
                        <th className="p-3.5 text-center bg-emerald-50 text-emerald-800">Available Stock 🔋</th>
                        <th className="p-3.5 text-right">Status Indicator</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                      {batteryTypeStockList
                        .filter(b => !warehouseSearch.trim() || b.batterySeries.toLowerCase().includes(warehouseSearch.toLowerCase().trim()))
                        .map((b, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3.5 font-bold text-slate-900 flex items-center gap-2">
                              <span className="p-1 rounded-lg bg-emerald-100 text-emerald-700 font-mono text-[10px] font-black">BAT</span>
                              <span>{b.batterySeries}</span>
                            </td>
                            <td className="p-3.5 text-center font-mono">{b.imported} packs</td>
                            <td className="p-3.5 text-center font-mono text-slate-600">{b.sold} packs</td>
                            <td className="p-3.5 text-center font-mono text-indigo-600">{b.assignedToScooters} packs</td>
                            <td className="p-3.5 text-center font-mono font-extrabold text-emerald-800 bg-emerald-50/60 text-sm">
                              {b.available} packs
                            </td>
                            <td className="p-3.5 text-right">
                              {b.available > 5 ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  In Stock
                                </span>
                              ) : b.available > 0 ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                                  Low Stock
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                                  Out of Stock
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {warehouseCategory === 'chargers' && (
              <div className="space-y-4">
                <div className="bg-cyan-500/5 border border-cyan-500/10 p-3.5 rounded-2xl text-xs text-cyan-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <span><strong>⚡ Available Charger Stock Breakdown:</strong> Showing available inventory per charger specification.</span>
                  <span className="font-bold font-mono text-cyan-900 bg-cyan-100 px-3 py-1 rounded-xl">Total Net Available: {availableChargerStock} Units</span>
                </div>

                <div className="overflow-x-auto bg-white border border-slate-200 rounded-2xl shadow-sm">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider font-sans">
                        <th className="p-3.5">Charger Type / Spec</th>
                        <th className="p-3.5 text-center">Imported Total 📦</th>
                        <th className="p-3.5 text-center">Standalone Sold 🏷️</th>
                        <th className="p-3.5 text-center">Scooter Included 🛵</th>
                        <th className="p-3.5 text-center bg-cyan-50 text-cyan-800">Available Stock ⚡</th>
                        <th className="p-3.5 text-right">Status Indicator</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                      {chargerTypeStockList
                        .filter(c => !warehouseSearch.trim() || c.chargerType.toLowerCase().includes(warehouseSearch.toLowerCase().trim()))
                        .map((c, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3.5 font-bold text-slate-900 flex items-center gap-2">
                              <span className="p-1 rounded-lg bg-cyan-100 text-cyan-700 font-mono text-[10px] font-black">CHG</span>
                              <span>{c.chargerType}</span>
                            </td>
                            <td className="p-3.5 text-center font-mono">{c.imported} units</td>
                            <td className="p-3.5 text-center font-mono text-slate-600">{c.sold} units</td>
                            <td className="p-3.5 text-center font-mono text-indigo-600">{c.assignedToScooters} units</td>
                            <td className="p-3.5 text-center font-mono font-extrabold text-cyan-800 bg-cyan-50/60 text-sm">
                              {c.available} units
                            </td>
                            <td className="p-3.5 text-right">
                              {c.available > 5 ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  In Stock
                                </span>
                              ) : c.available > 0 ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                                  Low Stock
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                                  Out of Stock
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. MAIN TAB: UNASSEMBLED KITS & PRODUCTION PIPELINE */}
      {activeMainTab === 'kits' && (
        <div className="space-y-6">
          <div className="bg-amber-50 rounded-2xl p-5 border border-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-base font-black text-amber-900 flex items-center gap-2">
                <Wrench className="h-5 w-5 text-amber-600" />
                <span>Unassembled Kits & Factory Production Pipeline</span>
              </h3>
              <p className="text-xs text-amber-800">
                Scooter assembly kits currently being assembled or awaiting quality testing before moving into finished warehouse stock.
              </p>
            </div>
            <span className="bg-amber-600 text-white font-black text-xs px-3 py-1.5 rounded-xl shadow-sm">
              {unassembledKits.length} Kits Pending Assembly
            </span>
          </div>

          {/* Stages Breakdown Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((stageNum) => {
              const stageKits = unassembledKits.filter(u => u.assemblyStage === stageNum);
              const stageTitles = [
                'Stage 1: Frame & Chassis',
                'Stage 2: Wiring & Controller',
                'Stage 3: Motor & Battery Mount',
                'Stage 4: Quality Testing'
              ];

              return (
                <div key={stageNum} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
                  <p className="text-[11px] font-extrabold uppercase text-slate-400">{stageTitles[stageNum - 1]}</p>
                  <p className="text-2xl font-black text-slate-900">{stageKits.length} <span className="text-xs font-semibold text-slate-500">Kits</span></p>
                </div>
              );
            })}
          </div>

          {/* Unassembled Kits List */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-4">
            <h4 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
              Detailed Pending Assembly Kits Breakdown
            </h4>

            {unassembledKits.length === 0 ? (
              <div className="p-8 text-center text-slate-400 space-y-1">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
                <p className="font-bold text-slate-700 text-sm">All factory kits are assembled!</p>
                <p className="text-xs">No pending kits in assembly pipeline.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {unassembledKits.map((kit) => {
                  const stage = kit.assemblyStage || 1;
                  const progressPct = stage === 1 ? 25 : stage === 2 ? 50 : stage === 3 ? 75 : 90;

                  return (
                    <div key={kit.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                        <span className="font-mono text-xs font-bold text-slate-900">{kit.chassisNo}</span>
                        <span className="bg-amber-100 text-amber-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-amber-200">
                          Stage {stage}/4
                        </span>
                      </div>

                      <div className="space-y-1">
                        <p className="text-sm font-black text-slate-900">{kit.modelName}</p>
                        <p className="text-xs text-slate-600 font-semibold">Color: {kit.color} | Battery: {kit.batteryType}</p>
                      </div>

                      {/* Progress Bar */}
                      <div className="space-y-1 pt-1">
                        <div className="flex justify-between text-[10px] font-bold text-slate-500">
                          <span>Assembly Progress</span>
                          <span>{progressPct}%</span>
                        </div>
                        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                          <div 
                            className="bg-amber-500 h-full rounded-full transition-all duration-300"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* STEP-BY-STEP DISPATCH LOADING WIZARD MODAL */}
      {selectedOrderForDispatch && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
            <div className="bg-slate-900 text-white p-6 flex items-center justify-between border-b border-slate-800">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider bg-indigo-950 text-indigo-300 px-2.5 py-1 rounded-lg border border-indigo-800/50">
                  Step-by-step Dispatch Loading
                </span>
                <h3 className="text-lg font-black text-white mt-1">
                  Loading Order #{selectedOrderForDispatch.orderNo} ({selectedOrderForDispatch.buyerName})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedOrderForDispatch(null);
                  setLoadingItemsState([]);
                  setCurrentStepIndex(0);
                }}
                className="text-slate-400 hover:text-white text-sm font-bold bg-slate-800 px-3 py-1.5 rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* Steps Navigation Bar */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <p className="text-xs font-bold text-slate-600">
                  Item Step {currentStepIndex + 1} of {loadingItemsState.length}
                </p>
                <div className="flex items-center gap-1.5">
                  {loadingItemsState.map((_, idx) => (
                    <span 
                      key={idx} 
                      className={`h-2.5 rounded-full transition-all ${
                        idx === currentStepIndex ? 'w-8 bg-indigo-600' : idx < currentStepIndex ? 'w-2.5 bg-emerald-500' : 'w-2.5 bg-slate-200'
                      }`} 
                    />
                  ))}
                </div>
              </div>

              {/* Current Loading Item */}
              {(() => {
                const item = loadingItemsState[currentStepIndex];
                if (!item) return null;

                return (
                  <div className="space-y-5">
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-extrabold uppercase bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded border border-indigo-200">
                          {item.itemType === 'scooter' ? '🛵 Scooter Unit' : item.itemType === 'battery' ? '🔋 Battery Pack' : '⚡ Charger Unit'}
                        </span>
                        <h4 className="text-base font-black text-slate-900 mt-1">
                          {item.itemType === 'scooter' ? `${item.productName} (${item.color})` : item.itemType === 'battery' ? item.batteryType : item.chargerType}
                        </h4>
                      </div>
                      <span className="text-lg font-black text-slate-900 bg-white px-3 py-1 rounded-xl border border-slate-200">
                        x{item.quantity} Units
                      </span>
                    </div>

                    {/* Chassis Selection for Scooter */}
                    {item.itemType === 'scooter' && (
                      <div className="space-y-3">
                        <p className="text-xs font-bold text-slate-700">Select Available Chassis Number for each unit loaded:</p>
                        {Array.from({ length: item.quantity }).map((_, unitIdx) => {
                          const availableForModel = availableScooters.filter(u => 
                            u.modelName === item.productName && u.color === item.color
                          );

                          return (
                            <div key={unitIdx} className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1">
                              <label className="block text-xs font-bold text-slate-700">
                                Scooter Unit #{unitIdx + 1} Chassis Number *
                              </label>
                              <select
                                value={item.chassisNumbers?.[unitIdx] || ''}
                                onChange={(e) => handleSetChassisNo(currentStepIndex, unitIdx, e.target.value)}
                                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                              >
                                <option value="">-- Choose Chassis Number --</option>
                                {availableForModel.map(u => (
                                  <option key={u.id} value={u.chassisNo}>
                                    {u.chassisNo} (Color: {u.color})
                                  </option>
                                ))}
                              </select>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Serial Numbers / Series Range for Battery & Charger */}
                    {item.itemType !== 'scooter' && (
                      <div className="space-y-4">
                        {item.isUnderWarranty ? (
                          <div className="space-y-4">
                            <div className="bg-emerald-50 p-3.5 rounded-xl border border-emerald-200 space-y-1">
                              <div className="flex items-center gap-2">
                                <Shield className="h-5 w-5 text-emerald-600 shrink-0" />
                                <span className="text-xs font-bold text-emerald-900">
                                  Item is under {item.warrantyMonths} Months Warranty ({item.quantity} units).
                                </span>
                              </div>
                              <p className="text-xs text-emerald-700">
                                Specify the Start & End Number series range, or enter individual serial numbers below:
                              </p>
                            </div>

                            {/* Series Start & End inputs */}
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                              <p className="text-xs font-extrabold uppercase text-slate-700 tracking-wider">Series Number Range</p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Start Number of Series *</label>
                                  <input
                                    type="text"
                                    placeholder="e.g. BAT-2026-001"
                                    value={item.startNo || ''}
                                    onChange={(e) => handleSetSeriesRange(currentStepIndex, e.target.value, item.endNo || '')}
                                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[11px] font-bold text-slate-600 mb-1">End Number of Series *</label>
                                  <input
                                    type="text"
                                    placeholder="e.g. BAT-2026-010"
                                    value={item.endNo || ''}
                                    onChange={(e) => handleSetSeriesRange(currentStepIndex, item.startNo || '', e.target.value)}
                                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500"
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="border-t border-slate-200 pt-3 space-y-2">
                              <p className="text-xs font-bold text-slate-700">Individual Unit Serial Numbers ({item.quantity} required):</p>
                              {Array.from({ length: item.quantity }).map((_, unitIdx) => (
                                <div key={unitIdx} className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
                                  <label className="text-xs font-bold text-slate-700 shrink-0">
                                    Unit #{unitIdx + 1}:
                                  </label>
                                  <input
                                    type="text"
                                    placeholder="Enter or auto-filled serial..."
                                    value={item.serialNumbers?.[unitIdx] || ''}
                                    onChange={(e) => {
                                      const updated = [...loadingItemsState];
                                      const serials = [...(updated[currentStepIndex].serialNumbers || [])];
                                      serials[unitIdx] = e.target.value;
                                      updated[currentStepIndex].serialNumbers = serials;
                                      setLoadingItemsState(updated);
                                    }}
                                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 text-center space-y-1">
                            <p className="text-xs font-bold text-amber-900">Standard Item (No Warranty Serial Numbers Required)</p>
                            <p className="text-[11px] text-amber-700">You can proceed to the next item step directly.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Wizard Controls Footer */}
            <div className="p-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                disabled={currentStepIndex === 0}
                onClick={() => setCurrentStepIndex(prev => Math.max(0, prev - 1))}
                className="px-4 py-2 text-xs font-bold rounded-xl text-slate-600 hover:text-slate-900 disabled:opacity-40 cursor-pointer border border-slate-300 bg-white"
              >
                Previous Item
              </button>

              {currentStepIndex < loadingItemsState.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrentStepIndex(prev => prev + 1)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-5 py-2.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-md shadow-indigo-600/20"
                >
                  <span>Next Item Step</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleCompleteDispatch}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-6 py-2.5 rounded-xl text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/20"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{isSubmitting ? 'Finalizing Loading...' : 'Complete Loading & Dispatch'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Stock in Box Details Modal Overlay */}
      {showBoxDetailsModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black flex items-center gap-2 text-amber-400">
                  <Wrench className="h-5 w-5" />
                  <span>Stock in Box (Unassembled Shipment Crates)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Breakdown of shipment stock unpacked vs built frames in warehouse.
                </p>
              </div>
              <button
                onClick={() => setShowBoxDetailsModal(false)}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Filter / Search Bar */}
            <div className="p-4 bg-slate-100 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="relative flex-1 w-full sm:w-auto">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search model variant or color option..."
                  value={boxModalSearch}
                  onChange={(e) => setBoxModalSearch(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <span className="text-xs font-bold text-slate-600 font-mono">
                Total Unassembled: <strong className="text-amber-700">{totalBoxesInCrates} Boxes</strong>
              </span>
            </div>

            {/* Table Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="bg-amber-500/5 border border-amber-500/10 p-3.5 rounded-2xl text-xs text-amber-800 leading-relaxed">
                <strong>💡 Quick Explanation:</strong> Quantities represent bulk boxes unpacked from shipments minus built frames on the assembly line.
              </div>

              {(() => {
                const filteredKits = boxesKitsList
                  .filter(k => {
                    const q = boxModalSearch.toLowerCase();
                    return k.modelName.toLowerCase().includes(q) || k.color.toLowerCase().includes(q);
                  })
                  .sort((a, b) => b.remaining - a.remaining);

                if (filteredKits.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center p-12 text-center bg-white border border-slate-100 rounded-2xl">
                      <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-2" />
                      <p className="text-sm font-semibold text-slate-600">Zero Unassembled Boxes!</p>
                      <p className="text-xs text-slate-400 mt-1">All shipment container kits have been built into registered frames.</p>
                    </div>
                  );
                }

                return (
                  <div className="overflow-x-auto bg-white border border-slate-200 rounded-2xl shadow-sm">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                          <th className="p-3.5">Model Variant</th>
                          <th className="p-3.5">Color Option</th>
                          <th className="p-3.5 text-center">Shipment Total 🚢</th>
                          <th className="p-3.5 text-center">Built Frames 🚲</th>
                          <th className="p-3.5 text-center bg-amber-50 text-amber-700">Still in Boxes 📦</th>
                          <th className="p-3.5 text-right">Status Indicator</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                        {filteredKits.map((kit, index) => (
                          <tr key={index} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3.5 font-bold text-slate-900">{kit.modelName}</td>
                            <td className="p-3.5 text-slate-600">{kit.color}</td>
                            <td className="p-3.5 text-center font-mono">{kit.imported} units</td>
                            <td className="p-3.5 text-center font-mono text-cyan-600">{kit.assembled} units</td>
                            <td className="p-3.5 text-center font-mono font-extrabold text-amber-700 bg-amber-50/50">
                              {kit.remaining} boxes
                            </td>
                            <td className="p-3.5 text-right">
                              {kit.remaining > 0 ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                                  Ready to Build
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  All Assembled
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setShowBoxDetailsModal(false)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Available Battery Details Modal Overlay */}
      {showBatteryDetailsModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black flex items-center gap-2 text-emerald-400">
                  <Shield className="h-5 w-5" />
                  <span>Available Battery Stock Breakdown by Type & Series</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Detailed warehouse inventory showing imported packs, standalone sales, and scooter assignments.
                </p>
              </div>
              <button
                onClick={() => setShowBatteryDetailsModal(false)}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Filter / Search Bar */}
            <div className="p-4 bg-slate-100 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="relative flex-1 w-full sm:w-auto">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search battery type or series name..."
                  value={batteryModalSearch}
                  onChange={(e) => setBatteryModalSearch(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <span className="text-xs font-bold text-slate-600 font-mono">
                Total Net Available: <strong className="text-emerald-700">{availableBatteryStock} Packs</strong>
              </span>
            </div>

            {/* Table Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="bg-emerald-500/5 border border-emerald-500/10 p-3.5 rounded-2xl text-xs text-emerald-800 leading-relaxed">
                <strong>💡 Battery Inventory Breakdown:</strong> Quantities reflect total imported battery shipments minus standalone sales and batteries installed on scooter frames.
              </div>

              {(() => {
                const filteredBatteries = batteryTypeStockList
                  .filter(b => {
                    const q = batteryModalSearch.toLowerCase().trim();
                    return !q || b.batterySeries.toLowerCase().includes(q);
                  })
                  .sort((a, b) => b.available - a.available);

                if (filteredBatteries.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center p-12 text-center bg-white border border-slate-100 rounded-2xl">
                      <Shield className="h-8 w-8 text-slate-300 mb-2" />
                      <p className="text-sm font-semibold text-slate-600">No Battery Types Found</p>
                      <p className="text-xs text-slate-400 mt-1">No battery series match the specified search term.</p>
                    </div>
                  );
                }

                return (
                  <div className="overflow-x-auto bg-white border border-slate-200 rounded-2xl shadow-sm">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                          <th className="p-3.5">Battery Series / Type</th>
                          <th className="p-3.5 text-center">Imported Total 📦</th>
                          <th className="p-3.5 text-center">Standalone Sold 🏷️</th>
                          <th className="p-3.5 text-center">Assigned to Scooters 🛵</th>
                          <th className="p-3.5 text-center bg-emerald-50 text-emerald-800">Available Stock 🔋</th>
                          <th className="p-3.5 text-right">Status Indicator</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                        {filteredBatteries.map((b, index) => (
                          <tr key={index} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3.5 font-bold text-slate-900 flex items-center gap-2">
                              <span className="p-1 rounded-lg bg-emerald-100 text-emerald-700 font-mono text-[10px] font-black">
                                BAT
                              </span>
                              <span>{b.batterySeries}</span>
                            </td>
                            <td className="p-3.5 text-center font-mono">{b.imported} packs</td>
                            <td className="p-3.5 text-center font-mono text-slate-600">{b.sold} packs</td>
                            <td className="p-3.5 text-center font-mono text-indigo-600">{b.assignedToScooters} packs</td>
                            <td className="p-3.5 text-center font-mono font-black text-emerald-800 bg-emerald-50/60 text-sm">
                              {b.available} packs
                            </td>
                            <td className="p-3.5 text-right">
                              {b.available > 5 ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  In Stock
                                </span>
                              ) : b.available > 0 ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                                  Low Stock
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                                  Out of Stock
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setShowBatteryDetailsModal(false)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Available Charger Details Modal Overlay */}
      {showChargerDetailsModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black flex items-center gap-2 text-cyan-400">
                  <Box className="h-5 w-5" />
                  <span>Available Charger Stock Breakdown by Type</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Detailed warehouse inventory showing imported charger units vs dispatched chargers.
                </p>
              </div>
              <button
                onClick={() => setShowChargerDetailsModal(false)}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Filter / Search Bar */}
            <div className="p-4 bg-slate-100 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="relative flex-1 w-full sm:w-auto">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search charger specification or type..."
                  value={chargerModalSearch}
                  onChange={(e) => setChargerModalSearch(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <span className="text-xs font-bold text-slate-600 font-mono">
                Total Net Available: <strong className="text-cyan-700">{availableChargerStock} Units</strong>
              </span>
            </div>

            {/* Table Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="bg-cyan-500/5 border border-cyan-500/10 p-3.5 rounded-2xl text-xs text-cyan-800 leading-relaxed">
                <strong>💡 Charger Inventory Breakdown:</strong> Quantities reflect total imported charger shipments minus standalone sales and chargers allocated to dispatched orders.
              </div>

              {(() => {
                const filteredChargers = chargerTypeStockList
                  .filter(c => {
                    const q = chargerModalSearch.toLowerCase().trim();
                    return !q || c.chargerType.toLowerCase().includes(q);
                  })
                  .sort((a, b) => b.available - a.available);

                if (filteredChargers.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center p-12 text-center bg-white border border-slate-100 rounded-2xl">
                      <Box className="h-8 w-8 text-slate-300 mb-2" />
                      <p className="text-sm font-semibold text-slate-600">No Charger Types Found</p>
                      <p className="text-xs text-slate-400 mt-1">No charger specifications match the specified search term.</p>
                    </div>
                  );
                }

                return (
                  <div className="overflow-x-auto bg-white border border-slate-200 rounded-2xl shadow-sm">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                          <th className="p-3.5">Charger Type / Spec</th>
                          <th className="p-3.5 text-center">Imported Total 📦</th>
                          <th className="p-3.5 text-center">Standalone Sold 🏷️</th>
                          <th className="p-3.5 text-center">Scooter Included 🛵</th>
                          <th className="p-3.5 text-center bg-cyan-50 text-cyan-800">Available Stock ⚡</th>
                          <th className="p-3.5 text-right">Status Indicator</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                        {filteredChargers.map((c, index) => (
                          <tr key={index} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3.5 font-bold text-slate-900 flex items-center gap-2">
                              <span className="p-1 rounded-lg bg-cyan-100 text-cyan-700 font-mono text-[10px] font-black">
                                CHG
                              </span>
                              <span>{c.chargerType}</span>
                            </td>
                            <td className="p-3.5 text-center font-mono">{c.imported} units</td>
                            <td className="p-3.5 text-center font-mono text-slate-600">{c.sold} units</td>
                            <td className="p-3.5 text-center font-mono text-indigo-600">{c.assignedToScooters} units</td>
                            <td className="p-3.5 text-center font-mono font-black text-cyan-800 bg-cyan-50/60 text-sm">
                              {c.available} units
                            </td>
                            <td className="p-3.5 text-right">
                              {c.available > 5 ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  In Stock
                                </span>
                              ) : c.available > 0 ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                                  Low Stock
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                                  Out of Stock
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setShowChargerDetailsModal(false)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
