import { getApiBaseUrl } from '../utils/apiConfig';
import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Layers, CheckCircle2, AlertCircle, AlertTriangle, TrendingUp, Settings, 
  ShieldCheck, ShoppingBag, Ship, Hammer, PlusCircle, Battery, HelpCircle,
  X, Search, Calendar, User, Cpu, Coins, Zap, Info
} from 'lucide-react';
import { ScooterUnit, Product, StockLog, BatterySale, BatteryImport, ChargerSale, ChargerImport } from '../types';

interface DashboardStatsProps {
  products: Product[];
  scooterUnits: ScooterUnit[];
  stockLogs: StockLog[];
  batterySales?: BatterySale[];
  batteryImports?: BatteryImport[];
  chargerSales?: ChargerSale[];
  chargerImports?: ChargerImport[];
  buyers?: any[];
  onNavigateToAssembly: () => void;
  onNavigateToBatteries?: () => void;
  onNavigateToStock?: () => void;
  onNavigateToSearch?: () => void;
  onNavigateToChargers?: () => void;
  onSubmitAssembly?: (payload: any) => Promise<boolean>;
  onReleaseBatteryHold?: (id: string) => Promise<boolean>;
  onFinalizeBatteryHold?: (id: string, extraData?: any) => Promise<boolean>;
  onReleaseChargerHold?: (id: string) => Promise<boolean>;
  onFinalizeChargerHold?: (id: string, extraData?: any) => Promise<boolean>;
  onReleaseScooterHold?: (id: string) => Promise<boolean>;
  onReleaseWholesalePackage?: (payload: { customerName: string; scooterIds?: string[]; batteryIds?: string[]; chargerIds?: string[]; }) => Promise<boolean>;
  onFinalizeScooterHold?: (payload: any) => Promise<boolean>;
  onUpdateBatteryHold?: (payload: any) => Promise<boolean>;
  onUpdateChargerHold?: (payload: any) => Promise<boolean>;
  onRefresh?: () => void;
  currentUser?: any;
}

export default function DashboardStats({ 
  products, 
  scooterUnits, 
  stockLogs, 
  batterySales = [], 
  batteryImports = [], 
  chargerSales = [],
  chargerImports = [],
  buyers = [],
  onNavigateToAssembly,
  onNavigateToBatteries,
  onNavigateToStock,
  onNavigateToSearch,
  onNavigateToChargers,
  onSubmitAssembly,
  onReleaseBatteryHold,
  onFinalizeBatteryHold,
  onReleaseChargerHold,
  onFinalizeChargerHold,
  onReleaseScooterHold,
  onReleaseWholesalePackage,
  onFinalizeScooterHold,
  onUpdateBatteryHold,
  onUpdateChargerHold,
  onRefresh,
  currentUser
}: DashboardStatsProps) {
  // Modal toggle state
  const [activeDetailTab, setActiveDetailTab] = useState<'imported' | 'boxes' | 'ready' | 'states' | 'sold' | 'batteries' | 'chargers' | 'held' | 'incomplete' | null>(null);
  const [modalSearch, setModalSearch] = useState('');
  const [modalSearchTarget, setModalSearchTarget] = useState<'all' | 'buyer' | 'chassis' | 'model' | 'color'>('all');
  const [statesSubTab, setStatesSubTab] = useState<'all' | 'frame' | 'battery'>('all');

  // Incomplete stock modal states
  const [showLogIncompleteModal, setShowLogIncompleteModal] = useState(false);
  const [logChassisNo, setLogChassisNo] = useState('');
  const [logMissingParts, setLogMissingParts] = useState('');
  const [logModelName, setLogModelName] = useState(products[0]?.name || 'SENZO ESSENATIAL DISC 12"/10"');
  const [logColor, setLogColor] = useState('Black');

  // Hold management states
  const [actionStatus, setActionStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [completingScooter, setCompletingScooter] = useState<ScooterUnit | null>(null);
  const [completingBuyerName, setCompletingBuyerName] = useState('');
  const [completingBuyerContact, setCompletingBuyerContact] = useState('');
  const [completingSalePrice, setCompletingSalePrice] = useState('');
  const [completingBillingNo, setCompletingBillingNo] = useState('');
  const [completingDeliveryChallanNo, setCompletingDeliveryChallanNo] = useState('');
  const [completingNotes, setCompletingNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [docValidationError, setDocValidationError] = useState<string | null>(null);

  // Incomplete logging submit handler
  const handleLogIncompleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logChassisNo.trim()) {
      alert('Please enter or select a Chassis Number.');
      return;
    }
    if (!logMissingParts.trim()) {
      alert('Please specify exactly what part or thing is missing to complete the unit.');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/scooter-units/mark-incomplete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chassisNo: logChassisNo.trim().toUpperCase(),
          missingParts: logMissingParts.trim(),
          modelName: logModelName,
          color: logColor,
          operator: currentUser?.name || currentUser?.username || 'Manager'
        })
      });
      const data = await res.json();
      if (res.ok) {
        setActionStatus({ type: 'success', text: `Chassis ${logChassisNo.toUpperCase()} logged as Unprepared/Incomplete with missing parts!` });
        setShowLogIncompleteModal(false);
        setLogChassisNo('');
        setLogMissingParts('');
        if (onRefresh) onRefresh();
      } else {
        setActionStatus({ type: 'error', text: data.error || 'Failed to log incomplete unit.' });
      }
    } catch (err: any) {
      setActionStatus({ type: 'error', text: err.message || 'Error communicating with server.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Prepare Incomplete Unit (Restock to Built and Ready)
  const handlePrepareIncompleteUnit = async (unit: ScooterUnit) => {
    if (!window.confirm(`Confirm that missing parts ("${unit.missingParts || 'unspecified'}") have been added to Chassis #${unit.chassisNo}? It will be restocked into "Built & Ready" stock.`)) {
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/scooter-units/prepare-incomplete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: unit.id,
          chassisNo: unit.chassisNo,
          operator: currentUser?.name || currentUser?.username || 'Manager'
        })
      });
      const data = await res.json();
      if (res.ok) {
        setActionStatus({ type: 'success', text: `Chassis ${unit.chassisNo} completed and restocked into Built & Ready stock!` });
        if (onRefresh) onRefresh();
      } else {
        setActionStatus({ type: 'error', text: data.error || 'Failed to complete unit.' });
      }
    } catch (err: any) {
      setActionStatus({ type: 'error', text: err.message || 'Error communicating with server.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Edit quantity & details state
  const [editingHoldItem, setEditingHoldItem] = useState<{
    id: string;
    itemType: 'battery' | 'charger' | 'scooter';
    title: string;
    heldFor: string;
    buyerName: string;
    quantity: number;
    notes: string;
  } | null>(null);

  // Wholesale customer order package state
  const [completingCustomerPackage, setCompletingCustomerPackage] = useState<{
    customerName: string;
    scooters: ScooterUnit[];
    batteries: BatterySale[];
    chargers: ChargerSale[];
  } | null>(null);

  // 1. Precise metric calculations based on User Request
  
  // Battery metrics calculations
  const totalBatteryImports = batteryImports.reduce((sum, imp) => sum + imp.quantity, 0);
  const totalBatterySalesWholesale = batterySales.reduce((sum, sale) => sum + sale.quantity, 0);
  const totalBatteriesInScooters = scooterUnits.reduce((sum, u) => sum + (u.batterySerials?.length || 0), 0);
  const batteriesInSoldScooters = scooterUnits
    .filter(u => u.status === 'sold')
    .reduce((sum, u) => sum + (u.batterySerials?.length || 0), 0);
  const batteriesInAvailableScooters = scooterUnits
    .filter(u => u.status === 'available')
    .reduce((sum, u) => sum + (u.batterySerials?.length || 0), 0);

  const looseBatteriesInStock = Math.max(0, totalBatteryImports - totalBatterySalesWholesale - totalBatteriesInScooters);
  const totalWarehouseBatteriesLeft = looseBatteriesInStock + batteriesInAvailableScooters;
  
  // Charger metrics calculations
  const totalChargerImports = chargerImports.reduce((sum, imp) => sum + (imp.quantity || (imp.serialNumbers ? imp.serialNumbers.length : 0) || 0), 0);
  const totalChargerSalesWholesale = chargerSales.reduce((sum, sale) => sum + (sale.quantity || (sale.serialNumbers ? sale.serialNumbers.length : 0) || 0), 0);
  const totalChargersInScooters = scooterUnits.filter(u => u.chargerIncluded || u.chargerType || u.chargerSerial).length;
  const looseChargersInStock = Math.max(0, totalChargerImports - totalChargerSalesWholesale - totalChargersInScooters);
  
  // Total Imported: sum of quantities of all "Stock IN" logs (excluding auto-generated assembly logs)
  const totalImported = stockLogs
    .filter(log => log.type === 'in' && !(log.notes && log.notes.includes('(Chassis:')))
    .reduce((sum, log) => sum + log.quantity, 0);

  // Total Assembled: total registered scooter units in database
  const totalAssembled = scooterUnits.length;

  // Yet to be Prepared / Assembled: Generic stock received but not yet given chassis/motor serial numbers
  const yetToBeAssembled = Math.max(0, totalImported - totalAssembled);

  // Left in Warehouse: Current available assembled stock in warehouse (status === 'available')
  const availableStock = scooterUnits.filter(u => u.status === 'available').length;

  // Total Sold: Status === 'sold'
  const totalSold = scooterUnits.filter(u => u.status === 'sold').length;

  // STAGE BREAKDOWNS OF ASSEMBLED STOCK:
  
  // Stage 1 Completed (Core Assembly - Chassis & Motor done, but NO batteries assigned)
  const stage1AssembledOnly = scooterUnits.filter(
    u => u.status === 'available' && u.batterySerials.length === 0
  ).length;

  // Stage 1 + Post-Assembly Batteries (Core Assembly done AND batteries already assigned in warehouse)
  const stage1WithBatteries = scooterUnits.filter(
    u => u.status === 'available' && u.batterySerials.length > 0
  ).length;

  // Stage 2 Optional Customized (Customized tire swaps, color changes, etc.)
  const stage2Customized = scooterUnits.filter(
    u => u.tireSize === '10-inch' || (u.customizationNotes && u.customizationNotes.trim() !== '')
  ).length;

  // Warranty active stats
  const activeScooterWarranty = scooterUnits.filter(u => u.scooterWarrantyStatus === 'Active').length;
  const activeBatteryWarranty = scooterUnits.filter(u => u.batteryWarrantyStatus === 'Active').length;

  // Incomplete / Unprepared Stock calculation
  const incompleteUnitsList = scooterUnits.filter(u => u.status === 'incomplete');
  const incompleteUnitsCount = incompleteUnitsList.length;

  // Helper to map color names to HEX values for pretty dashboard UI
  const getColorDotHex = (colorName: string): string => {
    const norm = colorName.toLowerCase().trim();
    if (norm.includes('red')) return '#ef4444';
    if (norm.includes('blue')) return '#3b82f6';
    if (norm.includes('green')) return '#10b981';
    if (norm.includes('yellow')) return '#f59e0b';
    if (norm.includes('black')) return '#1e293b';
    if (norm.includes('white')) return '#cbd5e1'; // subtle light gray for white
    if (norm.includes('gray') || norm.includes('grey')) return '#64748b';
    if (norm.includes('orange')) return '#f97316';
    if (norm.includes('purple')) return '#a855f7';
    if (norm.includes('pink')) return '#ec4899';
    if (norm.includes('silver') || norm.includes('chrome')) return '#94a3b8';
    if (norm.includes('gold')) return '#fbbf24';
    return '#64748b'; // default slate gray
  };

  // Real-time stock levels per model & color (for available stock in warehouse)
  const stockLevels: { [model: string]: { [color: string]: number } } = {};

  // Real-time detailed stock levels
  const stockDetails: {
    [model: string]: {
      [color: string]: {
        total: number;
      }
    }
  } = {};
  
  // Initialize map
  products.forEach(p => {
    stockLevels[p.name] = {};
    stockDetails[p.name] = {};
    p.colors.forEach(c => {
      stockLevels[p.name][c] = 0;
      stockDetails[p.name][c] = { total: 0 };
    });
  });

  // Calculate based on scooterUnits that are currently 'available' (actually present in warehouse)
  scooterUnits.forEach(unit => {
    if (unit.status === 'available') {
      if (!stockLevels[unit.modelName]) {
        stockLevels[unit.modelName] = {};
      }
      if (stockLevels[unit.modelName][unit.color] === undefined) {
        stockLevels[unit.modelName][unit.color] = 0;
      }
      stockLevels[unit.modelName][unit.color] += 1;

      if (!stockDetails[unit.modelName]) {
        stockDetails[unit.modelName] = {};
      }
      if (!stockDetails[unit.modelName][unit.color]) {
        stockDetails[unit.modelName][unit.color] = { total: 0 };
      }
      stockDetails[unit.modelName][unit.color].total += 1;
    }
  });

  // Calculate totals
  const modelStockTotals: { [model: string]: number } = {};
  Object.entries(stockLevels).forEach(([model, colors]) => {
    let modelTotal = 0;
    Object.values(colors).forEach(qty => {
      modelTotal += qty;
    });
    modelStockTotals[model] = modelTotal;
  });

  // Sort products by highest available stock first (highest on top)
  const sortedProducts = [...products].sort((a, b) => {
    const qtyA = modelStockTotals[a.name] || 0;
    const qtyB = modelStockTotals[b.name] || 0;
    return qtyB - qtyA;
  });

  const recentRegisteredUnits = scooterUnits.slice(-4).reverse();

  return (
    <div className="space-y-6" id="dashboard-container">
      
      {/* 1. Main Stock Details Board (User Requested Metrics) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-3" id="stats-grid">
        
        {/* Total Imported */}
        <motion.div 
          onClick={() => { setActiveDetailTab('imported'); setModalSearch(''); }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border-2 border-blue-500/10 hover:border-blue-500/40 hover:shadow-md transition-all rounded-3xl p-5 flex flex-col justify-between shadow-sm cursor-pointer select-none relative group overflow-hidden"
          id="stat-card-imported"
        >
          <div className="absolute top-0 right-0 p-1 bg-blue-500/10 text-blue-600 text-[9px] font-bold rounded-bl-xl opacity-0 group-hover:opacity-100 transition-opacity">
            Click to View
          </div>
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">1. Raw Stock Arrived 🚢</span>
            <Ship className="h-5 w-5 text-blue-500" />
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight">{totalImported}</span>
            <div className="text-[11px] text-slate-500 mt-1 font-medium leading-tight">Total boxes we unpacked from shipments</div>
          </div>
        </motion.div>
  
        {/* Still In Boxes (Unassembled Kits) */}
        <motion.div 
          onClick={() => { setActiveDetailTab('boxes'); setModalSearch(''); }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white border-2 border-amber-500/10 hover:border-amber-500/40 hover:shadow-md transition-all rounded-3xl p-5 flex flex-col justify-between shadow-sm cursor-pointer select-none relative group overflow-hidden"
          id="stat-card-yet-to-assemble"
        >
          <div className="absolute top-0 right-0 p-1 bg-amber-500/10 text-amber-600 text-[9px] font-bold rounded-bl-xl opacity-0 group-hover:opacity-100 transition-opacity">
            Click to View
          </div>
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">2. Still In Boxes 📦</span>
            <AlertCircle className="h-5 w-5 text-amber-500 animate-pulse" />
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-amber-600 tracking-tight">{yetToBeAssembled}</span>
            <div className="text-[11px] text-slate-500 mt-1 font-medium leading-tight">Unassembled kits boxed stock</div>
          </div>
        </motion.div>

        {/* Unprepared / Incomplete Stock */}
        <motion.div 
          onClick={() => { setActiveDetailTab('incomplete'); setModalSearch(''); }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="bg-white border-2 border-rose-500/20 hover:border-rose-500/50 hover:shadow-md transition-all rounded-3xl p-5 flex flex-col justify-between shadow-sm cursor-pointer select-none relative group overflow-hidden"
          id="stat-card-incomplete-stock"
        >
          <div className="absolute top-0 right-0 p-1 bg-rose-500/10 text-rose-600 text-[9px] font-bold rounded-bl-xl opacity-0 group-hover:opacity-100 transition-opacity">
            Click to View
          </div>
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600">Incomplete Stock ⚠️</span>
            <AlertTriangle className="h-5 w-5 text-rose-500 animate-pulse" />
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-rose-600 tracking-tight">{incompleteUnitsCount}</span>
            <div className="text-[11px] text-slate-500 mt-1 font-medium leading-tight">Built units missing parts / unprepared</div>
          </div>
        </motion.div>
  
        {/* Left in Warehouse */}
        <motion.div 
          onClick={() => { setActiveDetailTab('ready'); setModalSearch(''); }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white border-2 border-cyan-500/10 hover:border-cyan-500/40 hover:shadow-md transition-all rounded-3xl p-5 flex flex-col justify-between shadow-sm cursor-pointer select-none relative group overflow-hidden"
          id="stat-card-warehouse-left"
        >
          <div className="absolute top-0 right-0 p-1 bg-cyan-500/10 text-cyan-600 text-[9px] font-bold rounded-bl-xl opacity-0 group-hover:opacity-100 transition-opacity">
            Click to View
          </div>
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-600">3. Built & Ready 🏪</span>
            <Layers className="h-5 w-5 text-cyan-500" />
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-cyan-600 tracking-tight">{availableStock}</span>
            <div className="text-[11px] text-slate-500 mt-1 font-medium leading-tight">Finished units ready in our warehouse</div>
          </div>
        </motion.div>
  
        {/* Assembled in Stage 1 only vs with Batteries */}
        <motion.div 
          onClick={() => { setActiveDetailTab('states'); setModalSearch(''); setStatesSubTab('all'); }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white border-2 border-purple-500/10 hover:border-purple-500/40 hover:shadow-md transition-all rounded-3xl p-5 flex flex-col justify-between shadow-sm cursor-pointer select-none relative group overflow-hidden"
          id="stat-card-stage1-breakdown"
        >
          <div className="absolute top-0 right-0 p-1 bg-purple-500/10 text-purple-600 text-[9px] font-bold rounded-bl-xl opacity-0 group-hover:opacity-100 transition-opacity">
            Click to View
          </div>
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600">4. Assembly States 🔧</span>
            <Hammer className="h-5 w-5 text-purple-500" />
          </div>
          <div className="mt-3 space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-600 font-sans font-medium">Just Frame 🚲:</span>
              <span className="font-bold text-slate-800 font-mono bg-slate-100 px-2.5 py-0.5 rounded-lg">{stage1AssembledOnly}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-600 font-sans font-medium">With Battery 🔋:</span>
              <span className="font-bold text-emerald-600 font-mono bg-emerald-50 px-2.5 py-0.5 rounded-lg">{stage1WithBatteries}</span>
            </div>
          </div>
        </motion.div>
  
        {/* Sales Dispatched */}
        <motion.div 
          onClick={() => { setActiveDetailTab('sold'); setModalSearch(''); }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white border-2 border-emerald-500/10 hover:border-emerald-500/40 hover:shadow-md transition-all rounded-3xl p-5 flex flex-col justify-between shadow-sm cursor-pointer select-none relative group overflow-hidden"
          id="stat-card-sales-dispatched"
        >
          <div className="absolute top-0 right-0 p-1 bg-emerald-500/10 text-emerald-600 text-[9px] font-bold rounded-bl-xl opacity-0 group-hover:opacity-100 transition-opacity">
            Click to View
          </div>
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">5. Delivered & Sold 💵</span>
            <ShoppingBag className="h-5 w-5 text-emerald-500" />
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-emerald-600 tracking-tight">{totalSold}</span>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Scooters</span>
            </div>
            <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-slate-100">
              <span className="text-sm font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg">+{totalBatterySalesWholesale}</span>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Batteries Sold</span>
            </div>
          </div>
        </motion.div>
  
        {/* Battery Stock Left */}
        <motion.div 
          onClick={() => { setActiveDetailTab('batteries'); setModalSearch(''); }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-white border-2 border-emerald-500/10 hover:border-emerald-500/40 hover:shadow-md transition-all rounded-3xl p-5 flex flex-col justify-between shadow-sm cursor-pointer select-none relative group overflow-hidden"
          id="stat-card-battery-stock"
        >
          <div className="absolute top-0 right-0 p-1 bg-emerald-500/10 text-emerald-600 text-[9px] font-bold rounded-bl-xl opacity-0 group-hover:opacity-100 transition-opacity">
            Click to View
          </div>
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">6. Stock Remaining 🔋</span>
            <Battery className="h-5 w-5 text-emerald-500 fill-emerald-100" />
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-emerald-600 tracking-tight">{totalWarehouseBatteriesLeft}</span>
            <div className="text-[11px] text-slate-500 mt-1 font-medium leading-tight">
              <span className="text-emerald-700 font-bold">{looseBatteriesInStock}</span> loose / <span className="text-cyan-700 font-bold">{batteriesInAvailableScooters}</span> in ready scooters
            </div>
          </div>
        </motion.div>
  
        {/* Charger Stock Left */}
        <motion.div 
          onClick={() => { setActiveDetailTab('chargers'); setModalSearch(''); }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28 }}
          className="bg-white border-2 border-amber-500/10 hover:border-amber-500/40 hover:shadow-md transition-all rounded-3xl p-5 flex flex-col justify-between shadow-sm cursor-pointer select-none relative group overflow-hidden"
          id="stat-card-charger-stock"
        >
          <div className="absolute top-0 right-0 p-1 bg-amber-500/10 text-amber-600 text-[9px] font-bold rounded-bl-xl opacity-0 group-hover:opacity-100 transition-opacity">
            Click to View
          </div>
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">7. Charger Stock ⚡</span>
            <Zap className="h-5 w-5 text-amber-500 fill-amber-100" />
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-amber-600 tracking-tight">{looseChargersInStock}</span>
            <div className="text-[11px] text-slate-500 mt-1 font-medium leading-tight">
              <span className="text-amber-700 font-bold">{totalChargerImports}</span> imported / <span className="text-emerald-700 font-bold">{totalChargerSalesWholesale}</span> sold
            </div>
          </div>
        </motion.div>
      </div>

      {/* 2. Visual Graphs & Pipeline Activity Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="charts-and-alerts-grid">
        
        {/* Left/Middle Column: Inventory Stock Levels Distribution */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl p-6 flex flex-col justify-between shadow-sm" id="stock-levels-section">
          <div>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700 font-sans">Model Stock Distribution (Available in Warehouse)</h3>
                <p className="text-xs text-slate-400 mt-0.5">Physical counts across warehouse color catalogs</p>
              </div>
              <TrendingUp className="h-4 w-4 text-slate-400" />
            </div>

            <div className="space-y-4" id="model-stock-distribution-list">
              {sortedProducts.map((prod) => {
                const qty = modelStockTotals[prod.name] || 0;
                const percentage = availableStock > 0 ? (qty / availableStock) * 100 : 0;
                
                return (
                  <div key={prod.id} className="group border-b border-slate-100 pb-4 last:border-0 last:pb-0" id={`distribution-${prod.id}`}>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-bold text-slate-800 group-hover:text-cyan-600 transition-colors font-sans">{prod.name}</span>
                      <span className="font-mono text-slate-500 font-medium">{qty} units ({Math.round(percentage)}%)</span>
                    </div>
                    {/* Outer Bar */}
                    <div className="w-full h-2.5 bg-slate-150 rounded-full overflow-hidden flex">
                      <div 
                        className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-500 transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>

                    {/* Visual sub-breakdown per color */}
                    <div className="mt-3 pl-2 border-l-2 border-slate-150 space-y-2">
                      {prod.colors.map((col, cIdx) => {
                        const colDetail = stockDetails[prod.name]?.[col] || { total: 0 };
                        if (colDetail.total === 0) return null; // Only show colors that actually have stock to keep it clean and uncluttered!
                        
                        return (
                          <div key={cIdx} className="flex items-center justify-between text-[11px] text-slate-600 bg-slate-50/50 hover:bg-slate-50 px-3 py-2 rounded-xl border border-slate-100 transition-colors">
                            <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getColorDotHex(col) }}></span>
                              {col}
                            </div>
                            <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded-md font-bold font-mono text-[10px]">
                              {colDetail.total} units
                            </span>
                          </div>
                        );
                      })}
                      {/* If all colors are zero, show a subtle empty text */}
                      {(!stockDetails[prod.name] || Object.values(stockDetails[prod.name]).every(d => d.total === 0)) && (
                        <div className="text-[10px] text-slate-400 italic">No available stock in warehouse.</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Informative Box about customization conversions */}
          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-sans font-semibold text-slate-500">
            <span>Optional Conversions Logged:</span>
            <span className="text-amber-600 font-bold flex items-center gap-1 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
              <Settings className="h-3.5 w-3.5 animate-spin-slow text-amber-500" />
              {stage2Customized} modifications
            </span>
          </div>
        </div>

        {/* Right Column: Recent Activity and Stage Information */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 flex flex-col shadow-sm" id="action-queue-section">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700 font-sans mb-4">Latest Registered Scooters</h3>
          
          {recentRegisteredUnits.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200" id="queue-empty">
              <AlertCircle className="h-8 w-8 text-slate-300 mb-2" />
              <span className="text-xs text-slate-400 font-bold font-sans">No scooters registered yet!</span>
              <p className="text-[10px] text-slate-500 mt-1">Go to "Build & Sell" tab to begin Stage 1.</p>
            </div>
          ) : (
            <div className="flex-1 space-y-3 overflow-y-auto" id="queue-list">
              {recentRegisteredUnits.map((scoot) => (
                <div 
                  key={scoot.id}
                  className="p-3 bg-slate-50 hover:bg-slate-100/50 border border-slate-100 rounded-2xl transition-all text-xs"
                  id={`queue-item-${scoot.id}`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-slate-800">{scoot.modelName}</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-sans font-semibold border ${
                      scoot.status === 'sold' 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                        : 'bg-cyan-50 text-cyan-700 border-cyan-200'
                    }`}>
                      {scoot.status === 'sold' ? 'Sold' : 'In Warehouse'}
                    </span>
                  </div>
                  <div className="space-y-1 text-slate-500 text-[11px] font-medium">
                    <div>Color: <span className="text-slate-800 font-bold">{scoot.color}</span></div>
                    <div>Chassis: <span className="text-cyan-600 font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-slate-100">{scoot.chassisNo}</span></div>
                    <div>Tires: <span className="text-amber-600 font-semibold">{scoot.tireSize}</span></div>
                    {scoot.batterySerials.length > 0 && (
                      <div className="mt-1">Batteries: <span className="text-emerald-600 font-mono text-[10px] font-bold bg-white px-1.5 py-0.5 rounded border border-slate-100">{scoot.batterySerials.join(', ')}</span></div>
                    )}
                  </div>
                </div>
              ))}
              <button
                onClick={onNavigateToAssembly}
                className="w-full py-2.5 mt-2 bg-slate-900 hover:bg-slate-800 text-xs text-white rounded-xl font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-sm"
              >
                <span>Go to Build & Sell</span>
              </button>
              </div>
          )}
        </div>

      </div>

      {/* 3. Detailed Statistics Modals / Drawers (User Click Target Actions) */}
      {activeDetailTab !== null && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" 
          id="stats-modal-backdrop"
          onClick={() => setActiveDetailTab(null)}
        >
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl border border-slate-100"
            id="stats-modal-container"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  {activeDetailTab === 'imported' && (
                    <>
                      <Ship className="h-5 w-5 text-blue-500" />
                      <span>Raw Stock Arrivals Log (Import History)</span>
                    </>
                  )}
                  {activeDetailTab === 'boxes' && (
                    <>
                      <AlertCircle className="h-5 w-5 text-amber-500" />
                      <span>Kits Still in Boxes (Unprepared Stock)</span>
                    </>
                  )}
                  {activeDetailTab === 'ready' && (
                    <>
                      <Layers className="h-5 w-5 text-cyan-500" />
                      <span>Assembled & Available in Warehouse</span>
                    </>
                  )}
                  {activeDetailTab === 'states' && (
                    <>
                      <Hammer className="h-5 w-5 text-purple-500" />
                      <span>Assembly Status Breakdown</span>
                    </>
                  )}
                  {activeDetailTab === 'sold' && (
                    <>
                      <ShoppingBag className="h-5 w-5 text-emerald-500" />
                      <span>Delivered & Sold Customer Ledger</span>
                    </>
                  )}
                  {activeDetailTab === 'batteries' && (
                    <>
                      <Battery className="h-5 w-5 text-emerald-500 fill-emerald-100" />
                      <span>Battery Inventory & Dispatch Ledger</span>
                    </>
                  )}
                  {activeDetailTab === 'chargers' && (
                    <>
                      <Zap className="h-5 w-5 text-amber-500 fill-amber-100" />
                      <span>Charger Inventory & Dispatch Ledger</span>
                    </>
                  )}
                  {activeDetailTab === 'held' && (
                    <>
                      <User className="h-5 w-5 text-amber-500" />
                      <span>Held Stock & Customer Reservations Ledger</span>
                    </>
                  )}
                  {activeDetailTab === 'incomplete' && (
                    <>
                      <AlertTriangle className="h-5 w-5 text-rose-500" />
                      <span>Unprepared / Incomplete Stock List</span>
                    </>
                  )}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  {activeDetailTab === 'imported' && "View all documented shipping container counts and local seller logs."}
                  {activeDetailTab === 'boxes' && "Compare imported product totals against registered frames to find unbuilt inventory."}
                  {activeDetailTab === 'ready' && "All completed scooters currently stored in physical warehouse ready for customer delivery."}
                  {activeDetailTab === 'states' && "Manage and filter frames with core assembly completed versus fully powered battery packs."}
                  {activeDetailTab === 'sold' && "Complete dispatch record including customer contacts, sales pricing, and active warranties."}
                  {activeDetailTab === 'batteries' && "Detailed balance sheet of battery imports, standalone wholesale, and assemblies."}
                  {activeDetailTab === 'chargers' && "Detailed breakdown of imported chargers, sales, and standalone warehouse balance."}
                  {activeDetailTab === 'held' && "List of physical scooters currently put on hold/reserved for specific customer orders."}
                  {activeDetailTab === 'incomplete' && "View built chassis with missing parts, log missing items, and confirm restoration to Built & Ready stock."}
                </p>
              </div>
              <button 
                onClick={() => setActiveDetailTab(null)}
                className="h-9 w-9 rounded-full hover:bg-slate-200/60 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Sub-filters / Search Control */}
            <div className="p-3 sm:p-4 border-b border-slate-100 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0 w-full">
              <div className="relative flex-1 min-w-0">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <Search className="h-4 w-4" />
                </span>
                <input 
                  type="text" 
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  placeholder="Search model, color, serials, names..."
                  className="w-full bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 focus:border-cyan-500 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-800 outline-none transition-all font-sans min-w-0"
                />
              </div>

              {/* Sub tabs for Assembly states tab */}
              {activeDetailTab === 'states' && (
                <div className="flex gap-1.5 p-1 bg-slate-100 rounded-xl self-start sm:self-auto">
                  <button 
                    onClick={() => setStatesSubTab('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold font-sans transition-all cursor-pointer ${
                      statesSubTab === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    All Available
                  </button>
                  <button 
                    onClick={() => setStatesSubTab('frame')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold font-sans transition-all cursor-pointer flex items-center gap-1 ${
                      statesSubTab === 'frame' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <span>Just Frame</span>
                    <span className="px-1.5 py-0.2 bg-blue-50 text-[10px] rounded-md">{stage1AssembledOnly}</span>
                  </button>
                  <button 
                    onClick={() => setStatesSubTab('battery')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold font-sans transition-all cursor-pointer flex items-center gap-1 ${
                      statesSubTab === 'battery' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <span>With Battery</span>
                    <span className="px-1.5 py-0.2 bg-emerald-50 text-[10px] rounded-md">{stage1WithBatteries}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Modal Body / Scroll Content */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
              
              {/* RENDER TAB: IMPORTED */}
              {activeDetailTab === 'imported' && (() => {
                const logs = stockLogs.filter(log => {
                  if (log.type !== 'in') return false;
                  if (log.notes && log.notes.includes('(Chassis:')) return false;
                  const searchLower = modalSearch.toLowerCase();
                  return (
                    String(log.modelName || '').toLowerCase().includes(searchLower) ||
                    String(log.color || '').toLowerCase().includes(searchLower) ||
                    String(log.sourceChannel || '').toLowerCase().includes(searchLower) ||
                    String(log.notes || '').toLowerCase().includes(searchLower) ||
                    String(log.operator || '').toLowerCase().includes(searchLower)
                  );
                });

                if (logs.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center p-12 text-center bg-white border border-slate-100 rounded-2xl">
                      <AlertCircle className="h-8 w-8 text-slate-300 mb-2" />
                      <p className="text-sm font-semibold text-slate-600">No matching logs found</p>
                      <p className="text-xs text-slate-400 mt-1">Try refining your search terms or verify inputs.</p>
                    </div>
                  );
                }

                return (
                  <div className="overflow-x-auto bg-white border border-slate-150 rounded-2xl shadow-sm">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100/80 border-b border-slate-150 text-slate-500 font-bold uppercase tracking-wider">
                          <th className="p-3.5">Model / Color Variant</th>
                          <th className="p-3.5">Arrival Source</th>
                          <th className="p-3.5 text-center">Box Quantity</th>
                          <th className="p-3.5">Logged By</th>
                          <th className="p-3.5">Date / Time</th>
                          <th className="p-3.5">Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {logs.map((log) => (
                          <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-3.5">
                              <div className="font-bold text-slate-900">{log.modelName}</div>
                              <div className="text-[11px] text-slate-500">{log.color}</div>
                            </td>
                            <td className="p-3.5">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                log.sourceChannel === 'container_freight' 
                                  ? 'bg-blue-50 text-blue-700 border border-blue-150' 
                                  : 'bg-indigo-50 text-indigo-700 border border-indigo-150'
                              }`}>
                                {log.sourceChannel === 'container_freight' ? '🚢 Container Freight' : '🏪 Local Seller'}
                              </span>
                            </td>
                            <td className="p-3.5 text-center font-mono font-extrabold text-slate-900 bg-slate-50/50">
                              {log.quantity} boxes
                            </td>
                            <td className="p-3.5 text-slate-600 font-medium">
                              {log.operator}
                            </td>
                            <td className="p-3.5 text-slate-400 text-[11px] font-mono">
                              {new Date(log.timestamp).toLocaleString()}
                            </td>
                            <td className="p-3.5 text-slate-500 max-w-xs truncate" title={log.notes}>
                              {log.notes || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}

              {/* RENDER TAB: UNPREPARED / INCOMPLETE UNITS */}
              {activeDetailTab === 'incomplete' && (() => {
                const incompleteList = scooterUnits.filter(u => {
                  if (u.status !== 'incomplete') return false;
                  const searchLower = modalSearch.toLowerCase();
                  return (
                    String(u.modelName || '').toLowerCase().includes(searchLower) ||
                    String(u.color || '').toLowerCase().includes(searchLower) ||
                    String(u.chassisNo || '').toLowerCase().includes(searchLower) ||
                    String(u.missingParts || '').toLowerCase().includes(searchLower) ||
                    String(u.flaggedIncompleteBy || '').toLowerCase().includes(searchLower)
                  );
                });

                return (
                  <div className="space-y-4" id="incomplete-units-tab-container">
                    {/* Header Banner & Action Button */}
                    <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-900">
                      <div>
                        <strong>⚠️ Incomplete / Unprepared Units Log:</strong> These units are built frames but missing specific parts (mirrors, mudguards, chargers, etc.).
                      </div>
                      {(currentUser?.role === 'manager' || currentUser?.role === 'admin' || !currentUser?.role) && (
                        <button
                          onClick={() => {
                            setLogChassisNo('');
                            setLogMissingParts('');
                            setShowLogIncompleteModal(true);
                          }}
                          className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap text-xs shrink-0"
                        >
                          <PlusCircle className="h-4 w-4" />
                          <span>Log Incomplete Chassis</span>
                        </button>
                      )}
                    </div>

                    {actionStatus && (
                      <div className={`p-3.5 rounded-xl text-xs font-semibold flex items-center justify-between shadow-sm ${
                        actionStatus.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-rose-50 border border-rose-200 text-rose-800'
                      }`}>
                        <span>{actionStatus.text}</span>
                        <button onClick={() => setActionStatus(null)} className="text-slate-400 hover:text-slate-600">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    )}

                    {incompleteList.length === 0 ? (
                      <div className="flex flex-col items-center justify-center p-12 text-center bg-white border border-slate-100 rounded-2xl">
                        <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-2" />
                        <p className="text-sm font-semibold text-slate-600">No Incomplete Units Logged!</p>
                        <p className="text-xs text-slate-400 mt-1">All built scooters in warehouse are complete and ready for dispatch.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {incompleteList.map(unit => (
                          <div key={unit.id} className="bg-white border-2 border-amber-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between space-y-3">
                            <div>
                              <div className="flex items-center justify-between">
                                <span className="font-extrabold text-slate-900 text-sm">{unit.modelName}</span>
                                <span className="text-[10px] font-bold px-2.5 py-0.5 bg-amber-100 text-amber-800 rounded-full border border-amber-200">
                                  {unit.color}
                                </span>
                              </div>

                              <div className="mt-2 p-2.5 bg-slate-50 rounded-xl border border-slate-150 space-y-1.5 text-xs font-mono">
                                <div className="flex justify-between">
                                  <span className="text-slate-400 font-sans font-medium text-[11px]">Chassis No:</span>
                                  <span className="font-bold text-amber-700">{unit.chassisNo}</span>
                                </div>
                                {unit.flaggedIncompleteBy && (
                                  <div className="flex justify-between text-[10px]">
                                    <span className="text-slate-400 font-sans font-medium">Logged By:</span>
                                    <span className="text-slate-700 font-sans font-bold">{unit.flaggedIncompleteBy}</span>
                                  </div>
                                )}
                                {unit.flaggedIncompleteTimestamp && (
                                  <div className="flex justify-between text-[10px]">
                                    <span className="text-slate-400 font-sans font-medium">Date Flagged:</span>
                                    <span className="text-slate-500 font-sans">{new Date(unit.flaggedIncompleteTimestamp).toLocaleString()}</span>
                                  </div>
                                )}
                              </div>

                              <div className="mt-2.5 p-3 bg-rose-50 border border-rose-200 rounded-xl">
                                <span className="block text-[10px] font-extrabold uppercase text-rose-700 tracking-wider">
                                  Missing Parts / Items Required:
                                </span>
                                <p className="text-xs font-bold text-rose-900 mt-0.5 leading-snug">
                                  {unit.missingParts || 'Unspecified missing parts'}
                                </p>
                              </div>
                            </div>

                            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                              <span className="text-[10px] text-slate-400">
                                Status: <strong className="text-amber-600">Unprepared</strong>
                              </span>
                              <button
                                onClick={() => handlePrepareIncompleteUnit(unit)}
                                disabled={isSubmitting}
                                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                <span>Prepare It (Restock)</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* RENDER TAB: STILL IN BOXES */}
              {activeDetailTab === 'boxes' && (() => {
                const boxesKitsList: any[] = [];
                products.forEach(p => {
                  p.colors.forEach(col => {
                    const importedCount = stockLogs
                      .filter(log => log.modelName === p.name && log.color === col && log.type === 'in' && !(log.notes && log.notes.includes('(Chassis:')))
                      .reduce((sum, log) => sum + log.quantity, 0);

                    const assembledCount = scooterUnits.filter(
                      u => u.modelName === p.name && u.color === col
                    ).length;

                    const remaining = Math.max(0, importedCount - assembledCount);
                    if (importedCount > 0) {
                      boxesKitsList.push({
                        modelName: p.name,
                        color: col,
                        imported: importedCount,
                        assembled: assembledCount,
                        remaining: remaining
                      });
                    }
                  });
                });

                const filteredKits = boxesKitsList
                  .filter(k => {
                    const searchLower = modalSearch.toLowerCase();
                    return (
                      String(k.modelName || '').toLowerCase().includes(searchLower) ||
                      String(k.color || '').toLowerCase().includes(searchLower)
                    );
                  })
                  .sort((a, b) => b.remaining - a.remaining);

                if (filteredKits.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center p-12 text-center bg-white border border-slate-100 rounded-2xl">
                      <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-2 animate-bounce" />
                      <p className="text-sm font-semibold text-slate-600">Zero Unassembled Boxes!</p>
                      <p className="text-xs text-slate-400 mt-1">All shipment container kits have been built into registered frames.</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-4">
                    <div className="bg-amber-500/5 border border-amber-500/10 p-4 rounded-2xl text-xs text-amber-800 leading-relaxed">
                      <strong>💡 Quick Explanation of "In Boxes" calculation:</strong> We take the total quantity of bulk boxes unpacked in the <em>Import Stock</em> log and subtract the number of registered frames we built on the assembly line. The remainder is stock currently waiting in crates.
                    </div>
                    
                    <div className="overflow-x-auto bg-white border border-slate-150 rounded-2xl shadow-sm">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-100/80 border-b border-slate-150 text-slate-500 font-bold uppercase tracking-wider">
                            <th className="p-3.5">Model Variant</th>
                            <th className="p-3.5">Color Option</th>
                            <th className="p-3.5 text-center">Shipment Total 🚢</th>
                            <th className="p-3.5 text-center">Built Frames 🚲</th>
                            <th className="p-3.5 text-center bg-amber-50/50 text-amber-700">Still in Boxes 📦</th>
                            <th className="p-3.5 text-right">Status Indicator</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {filteredKits.map((kit, index) => (
                            <tr key={index} className="hover:bg-slate-50/80 transition-colors">
                              <td className="p-3.5 font-bold text-slate-900">{kit.modelName}</td>
                              <td className="p-3.5 text-slate-600 font-medium">{kit.color}</td>
                              <td className="p-3.5 text-center font-mono">{kit.imported} units</td>
                              <td className="p-3.5 text-center font-mono text-cyan-600">{kit.assembled} units</td>
                              <td className="p-3.5 text-center font-mono font-extrabold text-amber-700 bg-amber-50/40">
                                {kit.remaining} boxes
                              </td>
                              <td className="p-3.5 text-right">
                                {kit.remaining > 0 ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
                                    Ready to Build
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                                    All Assembled
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

              {/* RENDER TAB: BUILT & READY */}
              {activeDetailTab === 'ready' && (() => {
                const readyList = scooterUnits.filter(u => {
                  if (u.status !== 'available') return false;
                  const searchLower = modalSearch.toLowerCase();
                  return (
                    String(u.modelName || '').toLowerCase().includes(searchLower) ||
                    String(u.color || '').toLowerCase().includes(searchLower) ||
                    String(u.chassisNo || '').toLowerCase().includes(searchLower) ||
                    String(u.motorNo || '').toLowerCase().includes(searchLower) ||
                    String(u.controllerNo || '').toLowerCase().includes(searchLower)
                  );
                });

                if (readyList.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center p-12 text-center bg-white border border-slate-100 rounded-2xl">
                      <AlertCircle className="h-8 w-8 text-slate-300 mb-2" />
                      <p className="text-sm font-semibold text-slate-600">No built scooters available</p>
                      <p className="text-xs text-slate-400 mt-1">Head over to "Build & Sell" tab to assemble new scooters.</p>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {readyList.map((unit) => (
                      <div key={unit.id} className="bg-white border border-slate-150 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-extrabold text-slate-900 text-sm">{unit.modelName}</span>
                            <span className="text-[10px] font-sans font-bold px-2 py-0.5 bg-slate-50 border border-slate-200 text-slate-600 rounded-full">
                              {unit.color}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono mb-3 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                            <div>
                              <span className="text-slate-400 block text-[9px] uppercase font-sans font-bold">Chassis No</span>
                              <span className="text-cyan-700 font-bold">{unit.chassisNo}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[9px] uppercase font-sans font-bold">Motor No</span>
                              <span className="text-slate-800 font-semibold">{unit.motorNo}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[9px] uppercase font-sans font-bold">Controller No</span>
                              <span className="text-slate-800 font-semibold">{unit.controllerNo}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[9px] uppercase font-sans font-bold">Tyres Configuration</span>
                              <span className="text-amber-600 font-semibold text-[10px]">
                                F: {unit.frontTireSize === '10-inch' ? '10"' : '12"'} / R: {unit.rearTireSize === '10-inch' ? '10"' : '12"'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                          <span className="text-slate-400">
                            By {unit.createdOperator} • {new Date(unit.createdTimestamp).toLocaleDateString()}
                          </span>
                          <span className={`inline-flex items-center gap-1 font-sans font-bold px-2 py-0.5 rounded text-[10px] ${
                            unit.batterySerials.length > 0 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-150' 
                              : 'bg-blue-50 text-blue-700 border border-blue-150'
                          }`}>
                            {unit.batterySerials.length > 0 
                              ? `🔋 ${unit.batterySerials.length} Battery Ready` 
                              : '🚲 Frame Assembled'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* RENDER TAB: ASSEMBLY STATES */}
              {activeDetailTab === 'states' && (() => {
                const filteredStates = scooterUnits.filter(u => {
                  if (u.status !== 'available') return false;
                  if (statesSubTab === 'frame' && u.batterySerials.length > 0) return false;
                  if (statesSubTab === 'battery' && u.batterySerials.length === 0) return false;

                  const searchLower = modalSearch.toLowerCase();
                  return (
                    String(u.modelName || '').toLowerCase().includes(searchLower) ||
                    String(u.color || '').toLowerCase().includes(searchLower) ||
                    String(u.chassisNo || '').toLowerCase().includes(searchLower)
                  );
                });

                if (filteredStates.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center p-12 text-center bg-white border border-slate-100 rounded-2xl">
                      <AlertCircle className="h-8 w-8 text-slate-300 mb-2" />
                      <p className="text-sm font-semibold text-slate-600">No scooters match current filter</p>
                      <p className="text-xs text-slate-400 mt-1">Try switching tabs above or check search criteria.</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-4">
                    <div className="text-xs text-slate-500 bg-white p-3 rounded-xl border border-slate-150 flex items-center justify-between">
                      <span>Total displaying count: <strong>{filteredStates.length} units</strong></span>
                      <span className="font-semibold text-purple-600">Active Assembly Progress Tracking</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {filteredStates.map((unit) => (
                        <div key={unit.id} className="bg-white border border-slate-150 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <span className="font-extrabold text-slate-900 text-sm block">{unit.modelName}</span>
                              <span className="text-[11px] text-slate-400 mt-0.5 block">Color: <strong className="text-slate-600 font-medium">{unit.color}</strong></span>
                            </div>
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-sans font-bold flex items-center gap-1 ${
                              unit.batterySerials.length > 0 
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-150' 
                                : 'bg-amber-50 text-amber-700 border border-amber-150'
                            }`}>
                              {unit.batterySerials.length > 0 ? (
                                <>
                                  <Battery className="h-3 w-3 text-emerald-500 fill-emerald-500 animate-pulse" />
                                  <span>Fully Powered</span>
                                </>
                              ) : (
                                <>
                                  <span>🚲 Just Frame Only</span>
                                </>
                              )}
                            </span>
                          </div>

                          <div className="space-y-1.5 text-[11px] font-mono bg-slate-50 p-2.5 rounded-xl border border-slate-100 mb-3">
                            <div className="flex justify-between">
                              <span className="text-slate-400">Chassis Code:</span>
                              <span className="text-cyan-700 font-bold">{unit.chassisNo}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Motor Serial:</span>
                              <span className="text-slate-800 font-semibold">{unit.motorNo}</span>
                            </div>
                            {unit.batterySerials.length > 0 && (
                              <div className="pt-1.5 border-t border-slate-100">
                                <span className="text-slate-400 block text-[9px] uppercase font-sans font-bold mb-1">Installed Battery Codes</span>
                                <div className="flex flex-wrap gap-1">
                                  {unit.batterySerials.map((ser, sIdx) => (
                                    <span key={sIdx} className="text-[9px] bg-emerald-50 text-emerald-700 font-bold px-1.5 py-0.5 rounded border border-emerald-100 font-mono text-[10px]">
                                      {ser}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="text-[10px] text-slate-400">
                            Registered by {unit.createdOperator} on {new Date(unit.createdTimestamp).toLocaleDateString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* RENDER TAB: DELIVERED & SOLD */}
              {activeDetailTab === 'sold' && (() => {
                const soldList = scooterUnits.filter(u => {
                  if (u.status !== 'sold') return false;
                  const searchLower = modalSearch.toLowerCase();
                  return (
                    String(u.modelName || '').toLowerCase().includes(searchLower) ||
                    String(u.color || '').toLowerCase().includes(searchLower) ||
                    String(u.buyerName || '').toLowerCase().includes(searchLower) ||
                    String(u.buyerContact || '').toLowerCase().includes(searchLower) ||
                    String(u.chassisNo || '').toLowerCase().includes(searchLower)
                  );
                });

                if (soldList.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center p-12 text-center bg-white border border-slate-100 rounded-2xl">
                      <AlertCircle className="h-8 w-8 text-slate-300 mb-2" />
                      <p className="text-sm font-semibold text-slate-600">No delivery/sales logged yet</p>
                      <p className="text-xs text-slate-400 mt-1">Sell assembled frame units to record customer transactions.</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-4">
                    <div className="bg-emerald-50 text-emerald-800 p-4 border border-emerald-200/50 rounded-2xl text-xs flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                        <div>
                          <strong>Sheets Synchronization Ledger:</strong> All dispatches listed below are automatically exported and synced to the connected Google Sheets webhook.
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {soldList.map((unit) => (
                        <div key={unit.id} className="bg-white border border-slate-150 rounded-2xl p-5 shadow-sm">
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5 pb-3.5 border-b border-slate-100">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-slate-900 text-sm">{unit.modelName}</span>
                                <span className="text-[10px] font-sans font-bold px-2 py-0.5 bg-slate-50 border border-slate-200 text-slate-600 rounded-full">
                                  {unit.color}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                                <User className="h-3.5 w-3.5 text-slate-400" />
                                <span>Customer: <strong className="text-slate-800 font-bold">{unit.buyerName || 'Walk-in Buyer'}</strong></span>
                                {unit.buyerContact && <span className="text-slate-400 font-mono text-[11px]">({unit.buyerContact})</span>}
                              </div>
                            </div>
                            
                            <div className="text-left sm:text-right">
                              <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5 justify-start sm:justify-end">
                                <Calendar className="h-3.5 w-3.5" />
                                <span>Sold on: {unit.saleDate ? new Date(unit.saleDate).toLocaleDateString() : '—'}</span>
                              </div>
                            </div>
                          </div>

                          {/* Technical Serials Grid */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 py-3.5 border-b border-slate-100 text-[11px] font-mono text-slate-600">
                            <div>
                              <span className="block text-[9px] uppercase font-sans font-bold text-slate-400 mb-0.5">Chassis Number</span>
                              <span className="text-cyan-700 font-bold bg-cyan-50/50 border border-cyan-100 px-2 py-0.5 rounded inline-block">{unit.chassisNo}</span>
                            </div>
                            <div>
                              <span className="block text-[9px] uppercase font-sans font-bold text-slate-400 mb-0.5">Motor Number</span>
                              <span className="text-slate-800 font-bold bg-slate-100 border border-slate-200 px-2 py-0.5 rounded inline-block">{unit.motorNo}</span>
                            </div>
                            <div>
                              <span className="block text-[9px] uppercase font-sans font-bold text-slate-400 mb-0.5">Tyres Configured</span>
                              <span className="text-slate-800 font-semibold inline-block pt-1">
                                F: {unit.frontTireSize === '10-inch' ? '10-inch' : '12-inch'} / R: {unit.rearTireSize === '10-inch' ? '10-inch' : '12-inch'}
                              </span>
                            </div>
                          </div>

                          {/* Installed Batteries & Warranty Status */}
                          <div className="pt-3.5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-xs">
                            <div>
                              <span className="block text-[9px] uppercase font-bold text-slate-400 mb-1.5">Delivered Battery Serials</span>
                              <div className="flex flex-wrap gap-1.5">
                                {unit.batterySerials.length === 0 ? (
                                  <span className="text-slate-400 italic">No battery packs registered</span>
                                ) : (
                                  unit.batterySerials.map((bat, batIdx) => (
                                    <span key={batIdx} className="bg-emerald-50 text-emerald-700 font-bold px-2 py-1 rounded border border-emerald-100 font-mono text-[10px]">
                                      {bat}
                                    </span>
                                  ))
                                )}
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                                unit.scooterWarrantyStatus === 'Active' 
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                  : 'bg-red-50 text-red-700 border-red-200'
                              }`}>
                                Scooter Warranty: {unit.scooterWarrantyStatus}
                              </span>
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                                unit.batteryWarrantyStatus === 'Active' 
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                  : 'bg-red-50 text-red-700 border-red-200'
                              }`}>
                                Battery Warranty: {unit.batteryWarrantyStatus}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* RENDER TAB: BATTERIES DETAIL */}
              {activeDetailTab === 'batteries' && (() => {
                // Group battery imports and sales by series
                const seriesData: { [series: string]: { imported: number; soldWholesale: number } } = {};
                
                // Initialize default series
                ["Alpha", "Beta", "Pro-Pack"].forEach(ser => {
                  seriesData[ser] = { imported: 0, soldWholesale: 0 };
                });

                batteryImports.forEach(imp => {
                  const s = imp.batterySeries || "Custom/Other";
                  if (!seriesData[s]) seriesData[s] = { imported: 0, soldWholesale: 0 };
                  seriesData[s].imported += imp.quantity;
                });

                batterySales.forEach(sale => {
                  const s = sale.batterySeries || "Custom/Other";
                  if (!seriesData[s]) seriesData[s] = { imported: 0, soldWholesale: 0 };
                  seriesData[s].soldWholesale += sale.quantity;
                });

                // Filter series based on modal search
                const filteredSeries = Object.entries(seriesData).filter(([seriesName]) => {
                  return seriesName.toLowerCase().includes(modalSearch.toLowerCase());
                });

                // Filter imports and sales logs for lists based on search
                const searchLower = modalSearch.toLowerCase();
                const filteredImports = batteryImports.filter(imp => 
                  String(imp.batterySeries || '').toLowerCase().includes(searchLower) ||
                  String(imp.supplierName || '').toLowerCase().includes(searchLower) ||
                  String(imp.containerId || '').toLowerCase().includes(searchLower)
                ).slice(-5).reverse();

                const filteredSales = batterySales.filter(sale => 
                  String(sale.batterySeries || '').toLowerCase().includes(searchLower) ||
                  String(sale.buyerName || '').toLowerCase().includes(searchLower) ||
                  String(sale.notes || '').toLowerCase().includes(searchLower)
                ).slice(-5).reverse();

                return (
                  <div className="space-y-6" id="batteries-detail-container">
                    {/* Key KPIs inside Modal */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      <div className="bg-slate-50 border border-slate-150 rounded-2xl p-3 text-center">
                        <span className="block text-[9px] font-sans font-bold uppercase tracking-wider text-slate-400 mb-1">Total Imported</span>
                        <span className="text-lg font-extrabold text-slate-800">{totalBatteryImports.toLocaleString()}</span>
                        <span className="block text-[9px] text-slate-500 mt-0.5">Shipments logged</span>
                      </div>
                      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-center shadow-sm">
                        <span className="block text-[9px] font-sans font-bold uppercase tracking-wider text-emerald-600 mb-1">Total Wholesale Sold</span>
                        <span className="text-lg font-extrabold text-emerald-700">{totalBatterySalesWholesale.toLocaleString()}</span>
                        <span className="block text-[9px] text-emerald-500 mt-0.5 font-bold">Standalone Sales</span>
                      </div>
                      <div className="bg-slate-50 border border-slate-150 rounded-2xl p-3 text-center">
                        <span className="block text-[9px] font-sans font-bold uppercase tracking-wider text-slate-400 mb-1">Installed on Scooters</span>
                        <span className="text-lg font-extrabold text-slate-800">{totalBatteriesInScooters.toLocaleString()}</span>
                        <span className="block text-[9px] text-slate-500 mt-0.5">
                          {batteriesInAvailableScooters} prepped / {batteriesInSoldScooters} sold
                        </span>
                      </div>
                      <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-3 text-center">
                        <span className="block text-[9px] font-sans font-bold uppercase tracking-wider text-emerald-600 mb-1">Loose In Bins</span>
                        <span className="text-lg font-extrabold text-emerald-700">{looseBatteriesInStock.toLocaleString()}</span>
                        <span className="block text-[9px] text-emerald-500 mt-0.5 font-medium">Available to install</span>
                      </div>
                      <div className="bg-cyan-50/50 border border-cyan-150 rounded-2xl p-3 text-center col-span-2 md:col-span-1">
                        <span className="block text-[9px] font-sans font-bold uppercase tracking-wider text-cyan-600 mb-1 font-medium">Warehouse Net Stock</span>
                        <span className="text-lg font-extrabold text-cyan-700">{totalWarehouseBatteriesLeft.toLocaleString()}</span>
                        <span className="block text-[9px] text-cyan-500 mt-0.5 font-medium">Loose + unsold scooters</span>
                      </div>
                    </div>

                    {/* Series Stock Breakdown */}
                    <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-sm">
                      <h4 className="text-xs font-extrabold uppercase text-slate-600 tracking-wider mb-3 flex items-center gap-1.5">
                        <Battery className="h-4 w-4 text-emerald-500" />
                        <span>Battery Series Inventory Balance Sheet</span>
                      </h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-150 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              <th className="pb-2">Series name</th>
                              <th className="pb-2 text-right">Total Imported</th>
                              <th className="pb-2 text-right">Wholesale Sold</th>
                              <th className="pb-2 text-right text-emerald-600 font-extrabold">Net Available Stock</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-700">
                            {filteredSeries.map(([name, counts]) => {
                              const netStock = Math.max(0, counts.imported - counts.soldWholesale);
                              return (
                                <tr key={name} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="py-2.5 font-bold text-slate-800 flex items-center gap-1.5">
                                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                    {name} Series Pack
                                  </td>
                                  <td className="py-2.5 text-right font-mono text-slate-600">{counts.imported.toLocaleString()}</td>
                                  <td className="py-2.5 text-right font-mono text-slate-600">{counts.soldWholesale.toLocaleString()}</td>
                                  <td className="py-2.5 text-right font-mono font-extrabold text-emerald-700 bg-emerald-50/20 px-2">{netStock.toLocaleString()} packs</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Quick navigation and Action Links */}
                    <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-150 text-xs">
                      <span className="text-slate-500 font-medium">Quick Actions Panel:</span>
                      <div className="flex flex-wrap gap-2">
                        {onNavigateToStock && (
                          <button 
                            onClick={() => { setActiveDetailTab(null); onNavigateToStock(); }}
                            className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-bold border border-slate-200 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-sm text-[11px]"
                          >
                            <Ship className="h-3.5 w-3.5 text-blue-500" />
                            <span>Log New Battery Import Shipment</span>
                          </button>
                        )}
                        {onNavigateToBatteries && (
                          <button 
                            onClick={() => { setActiveDetailTab(null); onNavigateToBatteries(); }}
                            className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-bold border border-slate-200 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-sm text-[11px]"
                          >
                            <ShoppingBag className="h-3.5 w-3.5 text-emerald-500" />
                            <span>Log Standalone Battery Sale</span>
                          </button>
                        )}
                        {onNavigateToAssembly && (
                          <button 
                            onClick={() => { setActiveDetailTab(null); onNavigateToAssembly(); }}
                            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-sm text-[11px]"
                          >
                            <Hammer className="h-3.5 w-3.5 text-cyan-400" />
                            <span>Go to Scooter Assembly Line</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Dual Ledger Panels: Recent Imports vs Recent Standalone Sales */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Left: Recent Imports list */}
                      <div className="bg-white border border-slate-150 rounded-2xl p-4 shadow-sm">
                        <h5 className="text-[11px] font-extrabold uppercase text-slate-500 tracking-wider mb-3 flex items-center gap-1">
                          <Ship className="h-3.5 w-3.5 text-blue-500" />
                          <span>Recent Overseas Battery Imports</span>
                        </h5>
                        {filteredImports.length === 0 ? (
                          <div className="text-center py-6 text-slate-400 font-sans italic text-xs">
                            No matching battery imports found
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                            {filteredImports.map(imp => (
                              <div key={imp.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-[11px]">
                                <div className="flex items-center justify-between font-bold text-slate-800">
                                  <span>{imp.batterySeries} Series</span>
                                  <span className="text-emerald-600">+{imp.quantity} Packs</span>
                                </div>
                                <div className="flex items-center justify-between text-slate-400 mt-1 font-mono text-[10px]">
                                  <span>Supplier: {imp.supplierName || '—'}</span>
                                  <span>{new Date(imp.importDate).toLocaleDateString()}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Right: Recent Wholesale Sales */}
                      <div className="bg-white border border-slate-150 rounded-2xl p-4 shadow-sm">
                        <h5 className="text-[11px] font-extrabold uppercase text-slate-500 tracking-wider mb-3 flex items-center gap-1">
                          <ShoppingBag className="h-3.5 w-3.5 text-emerald-500" />
                          <span>Recent Wholesale Dispatches</span>
                        </h5>
                        {filteredSales.length === 0 ? (
                          <div className="text-center py-6 text-slate-400 font-sans italic text-xs">
                            No matching wholesale battery sales found
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                            {filteredSales.map(sale => (
                              <div key={sale.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-[11px]">
                                <div className="flex items-center justify-between font-bold text-slate-800">
                                  <span>{sale.buyerName}</span>
                                  <span className="text-amber-600">-{sale.quantity} Packs</span>
                                </div>
                                <div className="flex items-center justify-between text-slate-400 mt-1 font-mono text-[10px]">
                                  <span>Series: {sale.batterySeries}</span>
                                  <span>{new Date(sale.saleDate).toLocaleDateString()}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                  </div>
                );
              })()}

              {/* RENDER TAB: CHARGERS DETAIL */}
              {activeDetailTab === 'chargers' && (() => {
                const chargerTypeData: { [type: string]: { imported: number; soldWholesale: number; available: number } } = {};
                
                ["48V Charger", "60V Charger", "72V Charger"].forEach(t => {
                  chargerTypeData[t] = { imported: 0, soldWholesale: 0, available: 0 };
                });

                chargerImports.forEach(imp => {
                  const t = imp.chargerType || "Standard Charger";
                  if (!chargerTypeData[t]) chargerTypeData[t] = { imported: 0, soldWholesale: 0, available: 0 };
                  chargerTypeData[t].imported += (imp.quantity || (imp.serialNumbers ? imp.serialNumbers.length : 0) || 0);
                });

                chargerSales.forEach(sale => {
                  const t = sale.chargerType || "Standard Charger";
                  if (!chargerTypeData[t]) chargerTypeData[t] = { imported: 0, soldWholesale: 0, available: 0 };
                  chargerTypeData[t].soldWholesale += (sale.quantity || (sale.serialNumbers ? sale.serialNumbers.length : 0) || 0);
                });

                Object.keys(chargerTypeData).forEach(t => {
                  chargerTypeData[t].available = Math.max(0, chargerTypeData[t].imported - chargerTypeData[t].soldWholesale);
                });

                const filteredTypes = Object.entries(chargerTypeData).filter(([typeName]) => {
                  return typeName.toLowerCase().includes(modalSearch.toLowerCase());
                });

                const searchLower = modalSearch.toLowerCase();
                const filteredImports = chargerImports.filter(imp => 
                  String(imp.chargerType || '').toLowerCase().includes(searchLower) ||
                  String(imp.supplierName || '').toLowerCase().includes(searchLower) ||
                  String(imp.containerId || '').toLowerCase().includes(searchLower)
                ).slice(-5).reverse();

                const filteredSales = chargerSales.filter(sale => 
                  String(sale.chargerType || '').toLowerCase().includes(searchLower) ||
                  String(sale.buyerName || '').toLowerCase().includes(searchLower) ||
                  String(sale.notes || '').toLowerCase().includes(searchLower)
                ).slice(-5).reverse();

                return (
                  <div className="space-y-6" id="chargers-detail-container">
                    {/* Key KPIs inside Modal */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-slate-50 border border-slate-150 rounded-2xl p-3 text-center">
                        <span className="block text-[9px] font-sans font-bold uppercase tracking-wider text-slate-400 mb-1">Total Imported</span>
                        <span className="text-lg font-extrabold text-slate-800">{totalChargerImports.toLocaleString()}</span>
                        <span className="block text-[9px] text-slate-500 mt-0.5">Shipments logged</span>
                      </div>
                      <div className="bg-slate-50 border border-slate-150 rounded-2xl p-3 text-center">
                        <span className="block text-[9px] font-sans font-bold uppercase tracking-wider text-amber-500 mb-1">Wholesale Dispatched</span>
                        <span className="text-lg font-extrabold text-amber-600">{totalChargerSalesWholesale.toLocaleString()}</span>
                        <span className="block text-[9px] text-slate-500 mt-0.5">Sold standalone</span>
                      </div>
                      <div className="bg-emerald-50/60 border border-emerald-150 rounded-2xl p-3 text-center">
                        <span className="block text-[9px] font-sans font-bold uppercase tracking-wider text-emerald-700 mb-1">Stock Left</span>
                        <span className="text-lg font-extrabold text-emerald-700">{looseChargersInStock.toLocaleString()}</span>
                        <span className="block text-[9px] text-emerald-600 font-semibold mt-0.5">Loose chargers in stock</span>
                      </div>
                      <div className="bg-amber-50/60 border border-amber-150 rounded-2xl p-3 text-center">
                        <span className="block text-[9px] font-sans font-bold uppercase tracking-wider text-amber-800 mb-1">Charger Types</span>
                        <span className="text-lg font-extrabold text-amber-900">{Object.keys(chargerTypeData).length}</span>
                        <span className="block text-[9px] text-amber-700 font-semibold mt-0.5">Variants recorded</span>
                      </div>
                    </div>

                    {/* Stock level breakdown by Charger Type */}
                    <div className="bg-white border border-slate-150 rounded-2xl p-4 shadow-sm">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center justify-between">
                        <span>Charger Stock per Type Variant</span>
                        <span className="text-[10px] text-slate-400 font-normal">Calculated: Imported - Sold</span>
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {filteredTypes.map(([typeName, stats]) => (
                          <div key={typeName} className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200 flex flex-col justify-between">
                            <div className="flex justify-between items-center mb-2">
                              <span className="font-bold text-xs text-slate-800 font-sans">{typeName}</span>
                              <span className="text-[10px] font-mono font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md">
                                {stats.available} Available
                              </span>
                            </div>
                            <div className="space-y-1 text-[11px] text-slate-500 font-mono">
                              <div className="flex justify-between">
                                <span>Imported:</span>
                                <strong className="text-slate-700">{stats.imported}</strong>
                              </div>
                              <div className="flex justify-between">
                                <span>Sold:</span>
                                <strong className="text-amber-700">-{stats.soldWholesale}</strong>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Recent Imports & Sales logs */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Left: Recent Overseas Charger Imports */}
                      <div className="bg-white border border-slate-150 rounded-2xl p-4 shadow-sm">
                        <h5 className="text-[11px] font-extrabold uppercase text-slate-500 tracking-wider mb-3 flex items-center gap-1">
                          <Ship className="h-3.5 w-3.5 text-blue-500" />
                          <span>Recent Overseas Charger Imports</span>
                        </h5>
                        {filteredImports.length === 0 ? (
                          <div className="text-center py-6 text-slate-400 font-sans italic text-xs">
                            No matching charger imports found
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                            {filteredImports.map(imp => (
                              <div key={imp.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-[11px]">
                                <div className="flex items-center justify-between font-bold text-slate-800">
                                  <span>{imp.chargerType}</span>
                                  <span className="text-emerald-600">+{imp.quantity || imp.serialNumbers?.length} Units</span>
                                </div>
                                <div className="flex items-center justify-between text-slate-400 mt-1 font-mono text-[10px]">
                                  <span>Supplier: {imp.supplierName || '—'}</span>
                                  <span>{new Date(imp.importDate).toLocaleDateString()}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Right: Recent Wholesale Sales */}
                      <div className="bg-white border border-slate-150 rounded-2xl p-4 shadow-sm">
                        <h5 className="text-[11px] font-extrabold uppercase text-slate-500 tracking-wider mb-3 flex items-center gap-1">
                          <ShoppingBag className="h-3.5 w-3.5 text-emerald-500" />
                          <span>Recent Wholesale Charger Sales</span>
                        </h5>
                        {filteredSales.length === 0 ? (
                          <div className="text-center py-6 text-slate-400 font-sans italic text-xs">
                            No matching wholesale charger sales found
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                            {filteredSales.map(sale => (
                              <div key={sale.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-[11px]">
                                <div className="flex items-center justify-between font-bold text-slate-800">
                                  <span>{sale.buyerName}</span>
                                  <span className="text-amber-600">-{sale.quantity || sale.serialNumbers?.length} Units</span>
                                </div>
                                <div className="flex items-center justify-between text-slate-400 mt-1 font-mono text-[10px]">
                                  <span>Type: {sale.chargerType}</span>
                                  <span>{new Date(sale.saleDate).toLocaleDateString()}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                  </div>
                );
              })()}

              {/* RENDER TAB: HELD STOCK */}
              {activeDetailTab === 'held' && (() => {
                const heldScooters = scooterUnits.filter(u => {
                  if (u.status !== 'hold') return false;
                  const searchLower = modalSearch.toLowerCase();
                  return (
                    String(u.modelName || '').toLowerCase().includes(searchLower) ||
                    String(u.color || '').toLowerCase().includes(searchLower) ||
                    String(u.chassisNo || '').toLowerCase().includes(searchLower) ||
                    String(u.heldFor || '').toLowerCase().includes(searchLower) ||
                    String(u.heldBy || '').toLowerCase().includes(searchLower)
                  );
                });

                const heldBatteries = batterySales.filter(sale => {
                  if (sale.status !== 'hold') return false;
                  const searchLower = modalSearch.toLowerCase();
                  return (
                    String(sale.batterySeries || '').toLowerCase().includes(searchLower) ||
                    String(sale.buyerName || '').toLowerCase().includes(searchLower) ||
                    String(sale.notes || '').toLowerCase().includes(searchLower) ||
                    String(sale.heldFor || '').toLowerCase().includes(searchLower) ||
                    String(sale.heldBy || '').toLowerCase().includes(searchLower)
                  );
                });

                const heldChargers = chargerSales.filter(sale => {
                  if (sale.status !== 'hold') return false;
                  const searchLower = modalSearch.toLowerCase();
                  return (
                    String(sale.chargerType || '').toLowerCase().includes(searchLower) ||
                    String(sale.buyerName || '').toLowerCase().includes(searchLower) ||
                    String(sale.notes || '').toLowerCase().includes(searchLower) ||
                    String(sale.heldFor || '').toLowerCase().includes(searchLower) ||
                    String(sale.heldBy || '').toLowerCase().includes(searchLower)
                  );
                });

                // Group ALL held items by Customer Name (heldFor or buyerName)
                const customerMap: {
                  [customerName: string]: {
                    customerName: string;
                    contact?: string;
                    scooters: ScooterUnit[];
                    batteries: BatterySale[];
                    chargers: ChargerSale[];
                  }
                } = {};

                const getOrInitCustomer = (name: string) => {
                  const cleanName = (name || 'Unassigned Customer').trim();
                  if (!customerMap[cleanName]) {
                    // Try to match contact from buyers catalog
                    const catalogMatch = buyers.find((b: any) => b.name?.toLowerCase() === cleanName.toLowerCase());
                    customerMap[cleanName] = {
                      customerName: cleanName,
                      contact: catalogMatch?.phone || catalogMatch?.contactPerson || '',
                      scooters: [],
                      batteries: [],
                      chargers: []
                    };
                  }
                  return customerMap[cleanName];
                };

                heldScooters.forEach(scoot => {
                  const custObj = getOrInitCustomer(scoot.heldFor || scoot.buyerName || 'Unassigned');
                  custObj.scooters.push(scoot);
                  if (!custObj.contact && scoot.buyerContact) custObj.contact = scoot.buyerContact;
                });

                heldBatteries.forEach(bat => {
                  const custObj = getOrInitCustomer(bat.heldFor || bat.buyerName || 'Unassigned');
                  custObj.batteries.push(bat);
                  if (!custObj.contact && bat.buyerContact) custObj.contact = bat.buyerContact;
                });

                heldChargers.forEach(chg => {
                  const custObj = getOrInitCustomer(chg.heldFor || chg.buyerName || 'Unassigned');
                  custObj.chargers.push(chg);
                  if (!custObj.contact && chg.buyerContact) custObj.contact = chg.buyerContact;
                });

                const customerPackages = Object.values(customerMap);

                if (customerPackages.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center p-12 text-center bg-white border border-slate-100 rounded-2xl">
                      <CheckCircle2 className="h-8 w-8 text-slate-300 mb-2" />
                      <p className="text-sm font-semibold text-slate-600">No Held Stock Found</p>
                      <p className="text-xs text-slate-400 mt-1">Sellers and operators can place scooters, batteries, and chargers on hold.</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-6" id="held-stock-detail-container">
                    {/* Notification banner */}
                    {actionStatus && (
                      <div className={`p-4 rounded-2xl text-xs font-semibold flex items-center justify-between shadow-sm ${
                        actionStatus.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-rose-50 border border-rose-200 text-rose-800'
                      }`}>
                        <span>{actionStatus.text}</span>
                        <button onClick={() => setActionStatus(null)} className="text-slate-400 hover:text-slate-600">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    )}

                    {/* Overview banner */}
                    <div className="bg-amber-500/5 border border-amber-500/10 p-4 rounded-2xl text-xs text-amber-800 leading-relaxed flex items-center justify-between">
                      <div>
                        <strong>🤝 Customer Wholesale Reservations:</strong> Reserved items are grouped by Customer. You can edit quantities before dispatch, release holds, or complete wholesale sales directly.
                      </div>
                      <span className="text-xs font-bold bg-amber-100 text-amber-800 px-3 py-1 rounded-full whitespace-nowrap">
                        {customerPackages.length} Customers On Hold
                      </span>
                    </div>

                    {/* Customer Wholesale Reservation Cards Grid (2-column layout) */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                      {customerPackages.map((pkg) => {
                        const totalScooters = pkg.scooters.length;
                        const totalBatteries = pkg.batteries.reduce((sum, b) => sum + (b.quantity || 1), 0);
                        const totalChargers = pkg.chargers.reduce((sum, c) => sum + (c.quantity || (c.serialNumbers?.length) || 1), 0);

                        const packageHeldBySet = Array.from(new Set([
                          ...pkg.scooters.map(s => (s as any).heldBy || (s as any).createdOperator),
                          ...pkg.batteries.map(b => b.heldBy || b.operator),
                          ...pkg.chargers.map(c => c.heldBy || c.operator)
                        ].filter(Boolean)));
                        const packageHeldByLabel = packageHeldBySet.length > 0 ? packageHeldBySet.join(', ') : 'Sales Staff';

                        return (
                          <div key={pkg.customerName} className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4">
                            
                            {/* Card Header */}
                            <div>
                              <div className="flex items-start justify-between pb-3 border-b border-slate-100">
                                <div className="flex items-center gap-3">
                                  <div className="p-2.5 bg-amber-50 text-amber-600 rounded-2xl border border-amber-150">
                                    <User className="h-5 w-5" />
                                  </div>
                                  <div>
                                    <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                                      <span>{pkg.customerName}</span>
                                    </h3>
                                    <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-slate-500">
                                      {pkg.contact && <span className="font-mono">📞 {pkg.contact}</span>}
                                      <span className="inline-flex items-center gap-1 font-sans text-[11px] font-extrabold text-amber-900 bg-amber-100/80 px-2 py-0.5 rounded-md border border-amber-200">
                                        <User className="h-3 w-3 text-amber-700" /> Held by: {packageHeldByLabel}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-800 rounded-full shrink-0">
                                  Wholesale Reservation
                                </span>
                              </div>

                              {/* Breakdown Badges Summary */}
                              <div className="grid grid-cols-3 gap-2 my-3">
                                <div className={`p-2.5 rounded-2xl border text-center ${totalScooters > 0 ? 'bg-cyan-50/60 border-cyan-200 text-cyan-900' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Scooters</span>
                                  <span className="text-sm font-black font-mono">{totalScooters} 🛴</span>
                                </div>
                                <div className={`p-2.5 rounded-2xl border text-center ${totalBatteries > 0 ? 'bg-amber-50/60 border-amber-200 text-amber-900' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Batteries</span>
                                  <span className="text-sm font-black font-mono">{totalBatteries} 🔋</span>
                                </div>
                                <div className={`p-2.5 rounded-2xl border text-center ${totalChargers > 0 ? 'bg-purple-50/60 border-purple-200 text-purple-900' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Chargers</span>
                                  <span className="text-sm font-black font-mono">{totalChargers} ⚡</span>
                                </div>
                              </div>

                              {/* Itemized Lists inside Customer Package */}
                              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                                
                                {/* Reserved Scooters */}
                                {pkg.scooters.length > 0 && (
                                  <div className="space-y-1.5">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                                      Scooter Units ({pkg.scooters.length})
                                    </span>
                                    {pkg.scooters.map((s) => (
                                      <div key={s.id} className="p-2.5 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between text-xs">
                                        <div>
                                          <div className="font-bold text-slate-900">{s.modelName} ({s.color})</div>
                                          <div className="text-[10px] font-mono text-cyan-700">Chassis: {s.chassisNo}</div>
                                          <div className="text-[10px] text-slate-500 font-sans flex items-center gap-1.5 mt-0.5">
                                            <span>Held by: <strong>{(s as any).heldBy || (s as any).createdOperator || 'Staff'}</strong></span>
                                            {s.deliveryChallanNo && <span className="text-[9px] font-mono font-bold bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded border border-amber-200">Challan: {s.deliveryChallanNo}</span>}
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                          <button
                                            onClick={() => {
                                              setCompletingScooter(s);
                                              setCompletingBuyerName(s.heldFor || pkg.customerName);
                                              setCompletingBuyerContact((s as any).buyerContact || pkg.contact || '');
                                              setCompletingSalePrice((s as any).salePrice ? String((s as any).salePrice) : '');
                                              setCompletingBillingNo(s.salesBillNo || s.billNo || '');
                                              setCompletingDeliveryChallanNo(s.deliveryChallanNo || '');
                                              setCompletingNotes(s.customizationNotes || (s as any).notes || '');
                                              setDocValidationError(null);
                                              setActionStatus(null);
                                            }}
                                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] rounded-lg transition-colors cursor-pointer"
                                            title="Complete Sale for this scooter"
                                          >
                                            Complete
                                          </button>
                                          <button
                                            onClick={async () => {
                                              if (!window.confirm(`Release hold on Scooter Chassis "${s.chassisNo}"?`)) return;
                                              setIsSubmitting(true);
                                              if (onReleaseScooterHold) {
                                                const ok = await onReleaseScooterHold(s.id);
                                                if (ok) {
                                                  setActionStatus({ type: 'success', text: `Hold released for scooter ${s.chassisNo}` });
                                                  if (onRefresh) onRefresh();
                                                }
                                              } else if (onSubmitAssembly) {
                                                await onSubmitAssembly({ id: s.id, actionType: 'direct_update', status: 'available', heldFor: null, heldBy: null, holdDate: null });
                                                if (onRefresh) onRefresh();
                                              }
                                              setIsSubmitting(false);
                                            }}
                                            className="p-1 bg-slate-200 hover:bg-rose-100 text-slate-600 hover:text-rose-700 rounded-lg transition-colors cursor-pointer"
                                            title="Release hold"
                                          >
                                            <X className="h-3.5 w-3.5" />
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Reserved Batteries */}
                                {pkg.batteries.length > 0 && (
                                  <div className="space-y-1.5">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                                      Battery Batches ({pkg.batteries.length})
                                    </span>
                                    {pkg.batteries.map((b) => (
                                      <div key={b.id} className="p-2.5 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between text-xs">
                                        <div>
                                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                            <span>Series: {b.batterySeries}</span>
                                            <span className="text-[10px] font-mono font-extrabold px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full">
                                              {b.quantity} Packs
                                            </span>
                                          </div>
                                          <div className="text-[10px] font-mono text-slate-500">
                                            Serials: {b.startNo} to {b.endNo}
                                          </div>
                                          <div className="text-[10px] text-slate-500 font-sans flex items-center gap-1.5 mt-0.5">
                                            <span>Held by: <strong>{b.heldBy || b.operator || 'Staff'}</strong></span>
                                            {b.deliveryChallanNo && <span className="text-[9px] font-mono font-bold bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded border border-amber-200">Challan: {b.deliveryChallanNo}</span>}
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                          <button
                                            onClick={() => {
                                              setEditingHoldItem({
                                                id: b.id,
                                                itemType: 'battery',
                                                title: `Battery Hold (${b.batterySeries})`,
                                                heldFor: b.heldFor || pkg.customerName,
                                                buyerName: b.buyerName || pkg.customerName,
                                                quantity: b.quantity,
                                                notes: b.notes || ''
                                              });
                                            }}
                                            className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold text-[10px] rounded-lg transition-colors cursor-pointer"
                                            title="Edit hold quantity"
                                          >
                                            ✏️ Edit Qty
                                          </button>
                                          <button
                                            onClick={async () => {
                                              if (!onFinalizeBatteryHold) return;
                                              setIsSubmitting(true);
                                              const ok = await onFinalizeBatteryHold(b.id, {
                                                buyerName: pkg.customerName,
                                                buyerContact: pkg.contact,
                                                billNo: b.billNo || '',
                                                deliveryChallanNo: b.deliveryChallanNo || ''
                                              });
                                              if (ok) {
                                                setActionStatus({ type: 'success', text: `Battery hold converted to sale!` });
                                                if (onRefresh) onRefresh();
                                              }
                                              setIsSubmitting(false);
                                            }}
                                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] rounded-lg transition-colors cursor-pointer"
                                          >
                                            Complete
                                          </button>
                                          <button
                                            onClick={async () => {
                                              if (!window.confirm(`Release battery hold for ${b.quantity} packs?`)) return;
                                              if (!onReleaseBatteryHold) return;
                                              setIsSubmitting(true);
                                              const ok = await onReleaseBatteryHold(b.id);
                                              if (ok) {
                                                setActionStatus({ type: 'success', text: `Battery hold released!` });
                                                if (onRefresh) onRefresh();
                                              }
                                              setIsSubmitting(false);
                                            }}
                                            className="p-1 bg-slate-200 hover:bg-rose-100 text-slate-600 hover:text-rose-700 rounded-lg transition-colors cursor-pointer"
                                            title="Release hold"
                                          >
                                            <X className="h-3.5 w-3.5" />
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Reserved Chargers */}
                                {pkg.chargers.length > 0 && (
                                  <div className="space-y-1.5">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                                      Charger Batches ({pkg.chargers.length})
                                    </span>
                                    {pkg.chargers.map((c) => (
                                      <div key={c.id} className="p-2.5 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between text-xs">
                                        <div>
                                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                            <span>{c.chargerType}</span>
                                            <span className="text-[10px] font-mono font-extrabold px-2 py-0.5 bg-purple-100 text-purple-800 rounded-full">
                                              {c.quantity || 1} Units
                                            </span>
                                          </div>
                                          <div className="text-[10px] text-slate-500 font-sans flex items-center gap-1.5 mt-0.5">
                                            <span>Held by: <strong>{c.heldBy || c.operator || 'Staff'}</strong></span>
                                            {c.deliveryChallanNo && <span className="text-[9px] font-mono font-bold bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded border border-amber-200">Challan: {c.deliveryChallanNo}</span>}
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                          <button
                                            onClick={() => {
                                              setEditingHoldItem({
                                                id: c.id,
                                                itemType: 'charger',
                                                title: `Charger Hold (${c.chargerType})`,
                                                heldFor: c.heldFor || pkg.customerName,
                                                buyerName: c.buyerName || pkg.customerName,
                                                quantity: c.quantity || 1,
                                                notes: c.notes || ''
                                              });
                                            }}
                                            className="px-2 py-1 bg-purple-100 hover:bg-purple-200 text-purple-800 font-bold text-[10px] rounded-lg transition-colors cursor-pointer"
                                            title="Edit hold quantity"
                                          >
                                            ✏️ Edit Qty
                                          </button>
                                          <button
                                            onClick={async () => {
                                              if (!onFinalizeChargerHold) return;
                                              setIsSubmitting(true);
                                              const ok = await onFinalizeChargerHold(c.id, {
                                                buyerName: pkg.customerName,
                                                buyerContact: pkg.contact,
                                                billNo: c.billNo || '',
                                                deliveryChallanNo: c.deliveryChallanNo || ''
                                              });
                                              if (ok) {
                                                setActionStatus({ type: 'success', text: `Charger hold converted to sale!` });
                                                if (onRefresh) onRefresh();
                                              }
                                              setIsSubmitting(false);
                                            }}
                                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] rounded-lg transition-colors cursor-pointer"
                                          >
                                            Complete
                                          </button>
                                          <button
                                            onClick={async () => {
                                              if (!window.confirm(`Release charger hold?`)) return;
                                              if (!onReleaseChargerHold) return;
                                              setIsSubmitting(true);
                                              const ok = await onReleaseChargerHold(c.id);
                                              if (ok) {
                                                setActionStatus({ type: 'success', text: `Charger hold released!` });
                                                if (onRefresh) onRefresh();
                                              }
                                              setIsSubmitting(false);
                                            }}
                                            className="p-1 bg-slate-200 hover:bg-rose-100 text-slate-600 hover:text-rose-700 rounded-lg transition-colors cursor-pointer"
                                            title="Release hold"
                                          >
                                            <X className="h-3.5 w-3.5" />
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Wholesale Package Actions Footer */}
                            <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2">
                              <button
                                disabled={isSubmitting}
                                onClick={() => {
                                  const existingChallan = pkg.scooters.find(s => s.deliveryChallanNo)?.deliveryChallanNo || pkg.batteries.find(b => b.deliveryChallanNo)?.deliveryChallanNo || pkg.chargers.find(c => c.deliveryChallanNo)?.deliveryChallanNo || '';
                                  const existingBill = pkg.scooters.find(s => s.salesBillNo || s.billNo)?.salesBillNo || pkg.scooters.find(s => s.billNo)?.billNo || pkg.batteries.find(b => b.billNo)?.billNo || pkg.chargers.find(c => c.billNo)?.billNo || '';
                                  const existingPrice = pkg.scooters.reduce((acc, s) => acc + ((s as any).salePrice || 0), 0) || '';
                                  const existingNotes = pkg.scooters.find(s => s.customizationNotes || (s as any).notes)?.customizationNotes || pkg.batteries.find(b => b.notes)?.notes || pkg.chargers.find(c => c.notes)?.notes || '';

                                  setCompletingCustomerPackage(pkg);
                                  setCompletingBuyerName(pkg.customerName);
                                  setCompletingBuyerContact(pkg.contact || '');
                                  setCompletingSalePrice(existingPrice ? String(existingPrice) : '');
                                  setCompletingBillingNo(existingBill);
                                  setCompletingDeliveryChallanNo(existingChallan);
                                  setCompletingNotes(existingNotes);
                                  setDocValidationError(null);
                                  setActionStatus(null);
                                }}
                                className="col-span-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                              >
                                <ShoppingBag className="h-4 w-4" />
                                <span>Complete Wholesale Package Sale</span>
                              </button>

                              <button
                                disabled={isSubmitting}
                                onClick={async () => {
                                  if (!window.confirm(`Are you sure you want to release ALL held items (${totalScooters} scooters, ${totalBatteries} batteries, ${totalChargers} chargers) reserved for customer "${pkg.customerName}"?`)) return;
                                  setIsSubmitting(true);
                                  setActionStatus(null);

                                  const scooterIds = pkg.scooters.map(s => s.id);
                                  const batteryIds = pkg.batteries.map(b => b.id);
                                  const chargerIds = pkg.chargers.map(c => c.id);

                                  let success = false;
                                  if (onReleaseWholesalePackage) {
                                    success = await onReleaseWholesalePackage({
                                      customerName: pkg.customerName,
                                      scooterIds,
                                      batteryIds,
                                      chargerIds
                                    });
                                  } else {
                                    let releasedCount = 0;
                                    for (const s of pkg.scooters) {
                                      if (onReleaseScooterHold) await onReleaseScooterHold(s.id);
                                      else if (onSubmitAssembly) await onSubmitAssembly({ id: s.id, actionType: 'direct_update', status: 'available', heldFor: null, heldBy: null, holdDate: null });
                                      releasedCount++;
                                    }
                                    for (const b of pkg.batteries) {
                                      if (onReleaseBatteryHold) await onReleaseBatteryHold(b.id);
                                      releasedCount++;
                                    }
                                    for (const c of pkg.chargers) {
                                      if (onReleaseChargerHold) await onReleaseChargerHold(c.id);
                                      releasedCount++;
                                    }
                                    success = true;
                                  }

                                  if (success) {
                                    setActionStatus({ type: 'success', text: `Released entire wholesale package for ${pkg.customerName} (${totalScooters + totalBatteries + totalChargers} items returned to inventory).` });
                                    if (onRefresh) onRefresh();
                                  } else {
                                    setActionStatus({ type: 'error', text: `Failed to release wholesale package for ${pkg.customerName}. Please try again.` });
                                  }
                                  setIsSubmitting(false);
                                }}
                                className="col-span-2 py-2 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                              >
                                <X className="h-3.5 w-3.5" />
                                <span>Release Entire Package</span>
                              </button>
                            </div>

                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button 
                onClick={() => setActiveDetailTab(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl cursor-pointer transition-colors"
              >
                Close Details
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* DATALIST FOR BUYER AUTOCOMPLETE */}
      <datalist id="buyers-datalist">
        {buyers.map((b: any, idx: number) => (
          <option key={b.id || idx} value={b.name}>
            {b.name} ({b.phone || b.type || 'Buyer'})
          </option>
        ))}
      </datalist>

      {/* MODAL: EDIT HOLD ITEM QUANTITY & DETAILS */}
      {editingHoldItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-slate-150 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-100 text-amber-700 rounded-xl">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">Edit Reserved Hold</h3>
                  <p className="text-[11px] text-slate-500 font-sans">{editingHoldItem.title}</p>
                </div>
              </div>
              <button 
                onClick={() => setEditingHoldItem(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              setIsSubmitting(true);
              let ok = false;
              if (editingHoldItem.itemType === 'battery' && onUpdateBatteryHold) {
                ok = await onUpdateBatteryHold({
                  id: editingHoldItem.id,
                  quantity: Number(editingHoldItem.quantity) || 1,
                  heldFor: editingHoldItem.heldFor,
                  buyerName: editingHoldItem.heldFor,
                  notes: editingHoldItem.notes
                });
              } else if (editingHoldItem.itemType === 'charger' && onUpdateChargerHold) {
                ok = await onUpdateChargerHold({
                  id: editingHoldItem.id,
                  quantity: Number(editingHoldItem.quantity) || 1,
                  heldFor: editingHoldItem.heldFor,
                  buyerName: editingHoldItem.heldFor,
                  notes: editingHoldItem.notes
                });
              }

              if (ok) {
                setActionStatus({ type: 'success', text: `Updated hold reservation quantity & details successfully!` });
                setEditingHoldItem(null);
                if (onRefresh) onRefresh();
              } else {
                alert('Failed to update hold item.');
              }
              setIsSubmitting(false);
            }} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Customer / Reserved For *</label>
                <input 
                  type="text" 
                  list="buyers-datalist"
                  required
                  value={editingHoldItem.heldFor}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEditingHoldItem(prev => prev ? { ...prev, heldFor: val } : null);
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Reserved Quantity (Units / Packs) *</label>
                <input 
                  type="number" 
                  min="1"
                  required
                  value={editingHoldItem.quantity}
                  onChange={(e) => {
                    const qty = Number(e.target.value);
                    setEditingHoldItem(prev => prev ? { ...prev, quantity: qty } : null);
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 font-mono focus:outline-none focus:border-amber-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">Adjust quantity before final dispatch (e.g. send 4 instead of 5, or 6 instead of 5).</p>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Notes / Instructions</label>
                <textarea 
                  value={editingHoldItem.notes}
                  onChange={(e) => {
                    const notes = e.target.value;
                    setEditingHoldItem(prev => prev ? { ...prev, notes } : null);
                  }}
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingHoldItem(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{isSubmitting ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: COMPLETE WHOLESALE PACKAGE SALE CHECKOUT */}
      {completingCustomerPackage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-slate-150 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                  <ShoppingBag className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">Complete Wholesale Package Dispatch</h3>
                  <p className="text-[11px] text-slate-500 font-sans">Convert all reserved items for {completingCustomerPackage.customerName} into completed sale</p>
                </div>
              </div>
              <button 
                onClick={() => setCompletingCustomerPackage(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Package Summary Badge */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs space-y-1.5">
              <div className="font-extrabold text-slate-900 border-b border-slate-200 pb-1 flex justify-between">
                <span>Customer: {completingCustomerPackage.customerName}</span>
                <span className="text-emerald-700 font-mono">Wholesale Package</span>
              </div>
              <div className="flex gap-3 text-[11px] font-bold text-slate-700">
                {completingCustomerPackage.scooters.length > 0 && <span>🛴 {completingCustomerPackage.scooters.length} Scooters</span>}
                {completingCustomerPackage.batteries.length > 0 && <span>🔋 {completingCustomerPackage.batteries.reduce((sum, b) => sum + b.quantity, 0)} Batteries</span>}
                {completingCustomerPackage.chargers.length > 0 && <span>⚡ {completingCustomerPackage.chargers.reduce((sum, c) => sum + (c.quantity || 1), 0)} Chargers</span>}
              </div>
            </div>

            {/* Preserved Hold details notice banner */}
            {(completingDeliveryChallanNo || completingBillingNo || completingNotes) && (
              <div className="p-3 bg-amber-50/90 border border-amber-200 rounded-2xl text-amber-900 text-xs space-y-1">
                <div className="font-extrabold flex items-center gap-1.5 text-amber-900">
                  <Info className="h-4 w-4 shrink-0 text-amber-600" />
                  <span>Preserved Hold Reservation Details</span>
                </div>
                <p className="text-[11px] text-amber-800">
                  You put these details when putting this item/package on hold. They are pre-filled below for easy verification.
                </p>
              </div>
            )}

            {/* Document validation error alert */}
            {docValidationError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{docValidationError}</span>
              </div>
            )}

            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!completingBuyerName.trim()) {
                alert('Please enter a customer/buyer name.');
                return;
              }

              setIsSubmitting(true);
              setDocValidationError(null);

              const packageItemIds = [
                ...completingCustomerPackage.scooters.map(s => s.id),
                ...completingCustomerPackage.batteries.map(b => b.id),
                ...completingCustomerPackage.chargers.map(c => c.id)
              ];

              // Validate document numbers uniqueness
              if (completingBillingNo.trim() || completingDeliveryChallanNo.trim()) {
                try {
                  const valRes = await fetch(getApiBaseUrl() + '/api/validate-document-numbers', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      billNo: completingBillingNo.trim(),
                      deliveryChallanNo: completingDeliveryChallanNo.trim(),
                      excludeIds: packageItemIds
                    })
                  });
                  if (valRes.ok) {
                    const valData = await valRes.json();
                    if (valData.billExists) {
                      setDocValidationError(`⚠️ Bill / Invoice Number '${completingBillingNo.trim()}' already exists in database (${valData.billFoundIn}). Please enter a unique Bill Number.`);
                      setIsSubmitting(false);
                      return;
                    }
                    if (valData.challanExists) {
                      setDocValidationError(`⚠️ Delivery Challan Number '${completingDeliveryChallanNo.trim()}' already exists in database (${valData.challanFoundIn}). Please enter a unique Delivery Challan Number.`);
                      setIsSubmitting(false);
                      return;
                    }
                  }
                } catch (err) {
                  console.error('Validation error', err);
                }
              }

              // Finalize all scooters in package
              let successCount = 0;
              for (const s of completingCustomerPackage.scooters) {
                if (onSubmitAssembly) {
                  const ok = await onSubmitAssembly({
                    id: s.id,
                    actionType: 'direct_update',
                    status: 'sold',
                    buyerName: completingBuyerName.trim(),
                    buyerContact: completingBuyerContact.trim(),
                    salePrice: Number(completingSalePrice) || 0,
                    billingNo: completingBillingNo.trim(),
                    deliveryChallanNo: completingDeliveryChallanNo.trim(),
                    notes: completingNotes.trim(),
                    operator: currentUser?.name || currentUser?.username || 'system'
                  });
                  if (ok) successCount++;
                }
              }

              // Finalize all batteries in package
              for (const b of completingCustomerPackage.batteries) {
                if (onFinalizeBatteryHold) {
                  const ok = await onFinalizeBatteryHold(b.id, {
                    buyerName: completingBuyerName.trim(),
                    buyerContact: completingBuyerContact.trim(),
                    billNo: completingBillingNo.trim(),
                    deliveryChallanNo: completingDeliveryChallanNo.trim(),
                    notes: completingNotes.trim()
                  });
                  if (ok) successCount++;
                }
              }

              // Finalize all chargers in package
              for (const c of completingCustomerPackage.chargers) {
                if (onFinalizeChargerHold) {
                  const ok = await onFinalizeChargerHold(c.id, {
                    buyerName: completingBuyerName.trim(),
                    buyerContact: completingBuyerContact.trim(),
                    billNo: completingBillingNo.trim(),
                    deliveryChallanNo: completingDeliveryChallanNo.trim(),
                    notes: completingNotes.trim()
                  });
                  if (ok) successCount++;
                }
              }

              setActionStatus({
                type: 'success',
                text: `Successfully completed wholesale dispatch for customer ${completingBuyerName.trim()} (${successCount} records finalized)!`
              });
              setCompletingCustomerPackage(null);
              if (onRefresh) onRefresh();
              setIsSubmitting(false);
            }} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Customer / Buyer Name *</label>
                <input 
                  type="text" 
                  list="buyers-datalist"
                  required
                  value={completingBuyerName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCompletingBuyerName(val);
                    const match = buyers.find((b: any) => b.name?.toLowerCase() === val.toLowerCase());
                    if (match) {
                      setCompletingBuyerContact(match.phone || match.contactPerson || '');
                    }
                  }}
                  placeholder="Select or enter customer name..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Contact / Phone</label>
                  <input 
                    type="text" 
                    value={completingBuyerContact}
                    onChange={(e) => setCompletingBuyerContact(e.target.value)}
                    placeholder="Phone number"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Total Sale Amount ($)</label>
                  <input 
                    type="number" 
                    value={completingSalePrice}
                    onChange={(e) => setCompletingSalePrice(e.target.value)}
                    placeholder="e.g. 15000"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Bill / Invoice No *</label>
                  <input 
                    type="text" 
                    value={completingBillingNo}
                    onChange={(e) => setCompletingBillingNo(e.target.value)}
                    placeholder="e.g. INV-2026-001"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Delivery Challan No *</label>
                  <input 
                    type="text" 
                    value={completingDeliveryChallanNo}
                    onChange={(e) => setCompletingDeliveryChallanNo(e.target.value)}
                    placeholder="e.g. CH-2026-001"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Dispatch Remarks / Notes</label>
                <textarea 
                  value={completingNotes}
                  onChange={(e) => setCompletingNotes(e.target.value)}
                  placeholder="Optional delivery details or notes"
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCompletingCustomerPackage(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{isSubmitting ? 'Finalizing...' : 'Confirm Wholesale Sale'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: COMPLETE SCOOTER SALE CHECKOUT */}
      {completingScooter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-slate-150 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                  <ShoppingBag className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">Finalize Scooter Sale</h3>
                  <p className="text-[11px] text-slate-500 font-sans">Convert hold reservation into a completed dispatch</p>
                </div>
              </div>
              <button 
                onClick={() => setCompletingScooter(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scooter Summary Badge */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs space-y-1 font-mono">
              <div className="flex justify-between font-bold text-slate-800">
                <span>{completingScooter.modelName} ({completingScooter.color})</span>
                <span className="text-cyan-700">Chassis: {completingScooter.chassisNo}</span>
              </div>
              <div className="text-[10px] text-slate-500 flex justify-between">
                <span>Motor: {completingScooter.motorNo}</span>
                <span>Controller: {completingScooter.controllerNo}</span>
              </div>
            </div>

            {/* Document validation error alert */}
            {docValidationError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{docValidationError}</span>
              </div>
            )}

            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!completingBuyerName.trim()) {
                alert('Please enter a customer/buyer name.');
                return;
              }
              setIsSubmitting(true);
              setDocValidationError(null);

              // Validate document numbers uniqueness
              if (completingBillingNo.trim() || completingDeliveryChallanNo.trim()) {
                try {
                  const valRes = await fetch(getApiBaseUrl() + '/api/validate-document-numbers', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      billNo: completingBillingNo.trim(),
                      deliveryChallanNo: completingDeliveryChallanNo.trim(),
                      excludeId: completingScooter.id
                    })
                  });
                  if (valRes.ok) {
                    const valData = await valRes.json();
                    if (valData.billExists) {
                      setDocValidationError(`⚠️ Bill / Invoice Number '${completingBillingNo.trim()}' already exists in database (${valData.billFoundIn}). Please enter a unique Bill Number.`);
                      setIsSubmitting(false);
                      return;
                    }
                    if (valData.challanExists) {
                      setDocValidationError(`⚠️ Delivery Challan Number '${completingDeliveryChallanNo.trim()}' already exists in database (${valData.challanFoundIn}). Please enter a unique Delivery Challan Number.`);
                      setIsSubmitting(false);
                      return;
                    }
                  }
                } catch (err) {
                  console.error('Validation error', err);
                }
              }

              if (onSubmitAssembly) {
                const ok = await onSubmitAssembly({
                  id: completingScooter.id,
                  actionType: 'direct_update',
                  status: 'sold',
                  buyerName: completingBuyerName.trim(),
                  buyerContact: completingBuyerContact.trim(),
                  salePrice: Number(completingSalePrice) || 0,
                  billingNo: completingBillingNo.trim(),
                  deliveryChallanNo: completingDeliveryChallanNo.trim(),
                  notes: completingNotes.trim(),
                  operator: currentUser?.name || currentUser?.username || 'system'
                });

                if (ok) {
                  setActionStatus({ type: 'success', text: `Sale completed for Scooter ${completingScooter.chassisNo}! Moved to Sold stock.` });
                  setCompletingScooter(null);
                  if (onRefresh) onRefresh();
                } else {
                  alert('Failed to complete sale.');
                }
              }
              setIsSubmitting(false);
            }} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Customer / Buyer Name *</label>
                <input 
                  type="text" 
                  list="buyers-datalist"
                  required
                  value={completingBuyerName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCompletingBuyerName(val);
                    const match = buyers.find((b: any) => b.name?.toLowerCase() === val.toLowerCase());
                    if (match) {
                      setCompletingBuyerContact(match.phone || match.contactPerson || '');
                    }
                  }}
                  placeholder="Select or enter customer name..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Contact / Phone</label>
                  <input 
                    type="text" 
                    value={completingBuyerContact}
                    onChange={(e) => setCompletingBuyerContact(e.target.value)}
                    placeholder="Phone number"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Sale Price ($)</label>
                  <input 
                    type="number" 
                    value={completingSalePrice}
                    onChange={(e) => setCompletingSalePrice(e.target.value)}
                    placeholder="e.g. 1500"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Bill / Invoice No</label>
                  <input 
                    type="text" 
                    value={completingBillingNo}
                    onChange={(e) => setCompletingBillingNo(e.target.value)}
                    placeholder="Invoice #"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Delivery Challan No</label>
                  <input 
                    type="text" 
                    value={completingDeliveryChallanNo}
                    onChange={(e) => setCompletingDeliveryChallanNo(e.target.value)}
                    placeholder="Challan #"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Notes / Warranty Remarks</label>
                <textarea 
                  value={completingNotes}
                  onChange={(e) => setCompletingNotes(e.target.value)}
                  placeholder="Optional notes or customer requirements"
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCompletingScooter(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{isSubmitting ? 'Saving...' : 'Confirm & Complete Sale'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: LOG INCOMPLETE / UNPREPARED CHASSIS (MANAGER ROLE) */}
      {showLogIncompleteModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <span>Log Incomplete / Unprepared Unit</span>
              </h3>
              <button onClick={() => setShowLogIncompleteModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleLogIncompleteSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Chassis Number *</label>
                <input
                  type="text"
                  required
                  value={logChassisNo}
                  onChange={(e) => setLogChassisNo(e.target.value.toUpperCase())}
                  placeholder="e.g., SENZO-2026-CH001"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-slate-800 outline-none uppercase"
                />
                <p className="text-[10px] text-slate-400 mt-1">Select or type an existing built chassis or enter new built chassis.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Model Name</label>
                  <select
                    value={logModelName}
                    onChange={(e) => setLogModelName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none"
                  >
                    {products.map(p => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Color Option</label>
                  <input
                    type="text"
                    value={logColor}
                    onChange={(e) => setLogColor(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Missing Parts / Detail Required *</label>
                <textarea
                  required
                  rows={3}
                  value={logMissingParts}
                  onChange={(e) => setLogMissingParts(e.target.value)}
                  placeholder="Type exactly what part or item is missing (e.g., Missing side mirror, front wheel mudguard, charger port cap)"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-amber-500 rounded-xl p-3 text-xs text-slate-800 outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowLogIncompleteModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer"
                >
                  {isSubmitting ? 'Logging...' : 'Save Incomplete Unit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
