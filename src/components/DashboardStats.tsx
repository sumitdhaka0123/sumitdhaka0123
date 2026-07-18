import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Layers, CheckCircle2, AlertCircle, TrendingUp, Settings, 
  ShieldCheck, ShoppingBag, Ship, Hammer, PlusCircle, Battery, HelpCircle,
  X, Search, Calendar, User, Cpu, Coins
} from 'lucide-react';
import { ScooterUnit, Product, StockLog, BatterySale, BatteryImport } from '../types';

interface DashboardStatsProps {
  products: Product[];
  scooterUnits: ScooterUnit[];
  stockLogs: StockLog[];
  batterySales?: BatterySale[];
  batteryImports?: BatteryImport[];
  onNavigateToAssembly: () => void;
  onNavigateToBatteries?: () => void;
  onNavigateToStock?: () => void;
  onNavigateToSearch?: () => void;
}

export default function DashboardStats({ 
  products, 
  scooterUnits, 
  stockLogs, 
  batterySales = [], 
  batteryImports = [], 
  onNavigateToAssembly,
  onNavigateToBatteries,
  onNavigateToStock,
  onNavigateToSearch
}: DashboardStatsProps) {
  // Modal toggle state
  const [activeDetailTab, setActiveDetailTab] = useState<'imported' | 'boxes' | 'ready' | 'states' | 'sold' | 'batteries' | 'held' | null>(null);
  const [modalSearch, setModalSearch] = useState('');
  const [statesSubTab, setStatesSubTab] = useState<'all' | 'frame' | 'battery'>('all');

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

  // Real-time detailed stock levels including Brake Type
  const stockDetails: {
    [model: string]: {
      [color: string]: {
        total: number;
        Disk: number;
        Drum: number;
        unspecified: number;
      }
    }
  } = {};
  
  // Initialize map
  products.forEach(p => {
    stockLevels[p.name] = {};
    stockDetails[p.name] = {};
    p.colors.forEach(c => {
      stockLevels[p.name][c] = 0;
      stockDetails[p.name][c] = { total: 0, Disk: 0, Drum: 0, unspecified: 0 };
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
        stockDetails[unit.modelName][unit.color] = { total: 0, Disk: 0, Drum: 0, unspecified: 0 };
      }
      stockDetails[unit.modelName][unit.color].total += 1;
      if (unit.brakeType === 'Disk') {
        stockDetails[unit.modelName][unit.color].Disk += 1;
      } else if (unit.brakeType === 'Drum') {
        stockDetails[unit.modelName][unit.color].Drum += 1;
      } else {
        stockDetails[unit.modelName][unit.color].unspecified += 1;
      }
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

  const recentRegisteredUnits = scooterUnits.slice(-4).reverse();

  return (
    <div className="space-y-6" id="dashboard-container">
      
      {/* 1. Main Stock Details Board (User Requested Metrics) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4" id="stats-grid">
        
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
  
        {/* Yet to be Prepared */}
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
            <div className="text-[11px] text-slate-500 mt-1 font-medium leading-tight">Unfinished stock waiting to be built</div>
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
            <span className="text-3xl font-extrabold text-emerald-600 tracking-tight">{totalSold}</span>
            <div className="text-[11px] text-slate-500 mt-1 font-medium leading-tight text-slate-500">Delivered to customers and logged to Sheets!</div>
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
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">6. Battery Stock 🔋</span>
            <Battery className="h-5 w-5 text-emerald-500 fill-emerald-100" />
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-emerald-600 tracking-tight">{totalWarehouseBatteriesLeft}</span>
            <div className="text-[11px] text-slate-500 mt-1 font-medium leading-tight text-slate-500">
              {looseBatteriesInStock} loose packs / {batteriesInAvailableScooters} prepped
            </div>
          </div>
        </motion.div>

        {/* Held Stock */}
        <motion.div 
          onClick={() => { setActiveDetailTab('held'); setModalSearch(''); }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white border-2 border-amber-500/10 hover:border-amber-500/40 hover:shadow-md transition-all rounded-3xl p-5 flex flex-col justify-between shadow-sm cursor-pointer select-none relative group overflow-hidden"
          id="stat-card-held-stock"
        >
          <div className="absolute top-0 right-0 p-1 bg-amber-500/10 text-amber-600 text-[9px] font-bold rounded-bl-xl opacity-0 group-hover:opacity-100 transition-opacity">
            Click to View
          </div>
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">7. Held Stock 🤝</span>
            <User className="h-5 w-5 text-amber-500" />
          </div>
          <div className="mt-3 space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-600 font-sans font-medium">Scooters 🛴:</span>
              <span className="font-bold text-amber-600 font-mono bg-amber-50 px-2.5 py-0.5 rounded-lg">
                {scooterUnits.filter(u => u.status === 'hold').length}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-600 font-sans font-medium">Batteries 🔋:</span>
              <span className="font-bold text-amber-600 font-mono bg-amber-50 px-2.5 py-0.5 rounded-lg">
                {batterySales.filter(s => s.status === 'hold').reduce((sum, s) => sum + s.quantity, 0)}
              </span>
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
              {products.map((prod) => {
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

                    {/* Visual sub-breakdown per color and brake type */}
                    <div className="mt-3 pl-2 border-l-2 border-slate-150 space-y-2">
                      {prod.colors.map((col, cIdx) => {
                        const colDetail = stockDetails[prod.name]?.[col] || { total: 0, Disk: 0, Drum: 0, unspecified: 0 };
                        if (colDetail.total === 0) return null; // Only show colors that actually have stock to keep it clean and uncluttered!
                        
                        return (
                          <div key={cIdx} className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-[11px] text-slate-600 bg-slate-50/50 hover:bg-slate-50 px-3 py-2 rounded-xl border border-slate-100 transition-colors">
                            <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getColorDotHex(col) }}></span>
                              {col}
                              <span className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded-md font-bold font-mono text-[10px]">
                                {colDetail.total} units
                              </span>
                            </div>
                            
                            {/* Brake Type Breakdown for this Color */}
                            <div className="flex gap-2 mt-1 sm:mt-0">
                              {colDetail.Disk > 0 && (
                                <span className="bg-cyan-50/60 text-cyan-700 px-2 py-0.5 rounded-md font-medium border border-cyan-100/50 text-[10px]">
                                  Disk: <strong className="font-bold">{colDetail.Disk}</strong>
                                </span>
                              )}
                              {colDetail.Drum > 0 && (
                                <span className="bg-indigo-50/60 text-indigo-700 px-2 py-0.5 rounded-md font-medium border border-indigo-100/50 text-[10px]">
                                  Drum: <strong className="font-bold">{colDetail.Drum}</strong>
                                </span>
                              )}
                              {colDetail.unspecified > 0 && (
                                <span className="bg-slate-100/60 text-slate-600 px-2 py-0.5 rounded-md font-medium border border-slate-200/50 text-[10px]">
                                  Unspecified: <strong className="font-bold">{colDetail.unspecified}</strong>
                                </span>
                              )}
                            </div>
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
                  {activeDetailTab === 'held' && (
                    <>
                      <User className="h-5 w-5 text-amber-500" />
                      <span>Held Stock & Customer Reservations Ledger</span>
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
                  {activeDetailTab === 'held' && "List of physical scooters currently put on hold/reserved for specific customer orders."}
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
            <div className="p-4 border-b border-slate-100 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <Search className="h-4 w-4" />
                </span>
                <input 
                  type="text" 
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  placeholder="Search model, color, serials, names..."
                  className="w-full bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 focus:border-cyan-500 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-800 outline-none transition-all font-sans"
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
                      <div className="bg-slate-50 border border-slate-150 rounded-2xl p-3 text-center">
                        <span className="block text-[9px] font-sans font-bold uppercase tracking-wider text-slate-400 mb-1">Wholesale Dispatched</span>
                        <span className="text-lg font-extrabold text-slate-800">{totalBatterySalesWholesale.toLocaleString()}</span>
                        <span className="block text-[9px] text-slate-500 mt-0.5">Standalone sales</span>
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

              {/* RENDER TAB: HELD STOCK */}
              {activeDetailTab === 'held' && (() => {
                const heldList = scooterUnits.filter(u => {
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

                const heldBatteriesList = batterySales.filter(sale => {
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

                // Group by Held For (customer name)
                const groupings: { [customer: string]: { scootersCount: number; batteriesCount: number } } = {};
                
                scooterUnits.filter(u => u.status === 'hold').forEach(u => {
                  const cust = u.heldFor || 'Unknown Customer';
                  if (!groupings[cust]) {
                    groupings[cust] = { scootersCount: 0, batteriesCount: 0 };
                  }
                  groupings[cust].scootersCount += 1;
                });

                batterySales.filter(s => s.status === 'hold').forEach(s => {
                  const cust = s.heldFor || s.buyerName || 'Unknown Customer';
                  if (!groupings[cust]) {
                    groupings[cust] = { scootersCount: 0, batteriesCount: 0 };
                  }
                  groupings[cust].batteriesCount += s.quantity;
                });

                if (heldList.length === 0 && heldBatteriesList.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center p-12 text-center bg-white border border-slate-100 rounded-2xl">
                      <CheckCircle2 className="h-8 w-8 text-slate-300 mb-2" />
                      <p className="text-sm font-semibold text-slate-600">No Held Stock Found</p>
                      <p className="text-xs text-slate-400 mt-1">Sellers and owners can place scooters and batteries on hold.</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-6" id="held-stock-detail-container">
                    {/* Overview explanation banner */}
                    <div className="bg-amber-500/5 border border-amber-500/10 p-4 rounded-2xl text-xs text-amber-800 leading-relaxed">
                      <strong>🤝 Held Stock / Reservation Balance:</strong> Here is the list of active customer reservations. When ready, go to the <strong>Scooter Assembly Line</strong> (Stage 3 POS) or the <strong>Battery Sales</strong> tab to finalize checkout or release holds.
                    </div>

                    {/* Grouped counts section ("how much we have holded for whom") */}
                    <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-sm">
                      <h4 className="text-xs font-extrabold uppercase text-slate-600 tracking-wider mb-4 flex items-center gap-1.5">
                        <span>🤝 Reservation Breakdown (Holdings by Customer)</span>
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {Object.entries(groupings).map(([customer, info]) => (
                          <div key={customer} className="p-4 bg-slate-50 rounded-2xl border border-slate-150 flex flex-col justify-between shadow-sm">
                            <div>
                              <span className="text-xs font-bold text-slate-800 block mb-1">{customer}</span>
                              <span className="text-[10px] text-slate-500 block leading-tight font-sans font-medium mb-2">
                                Active holds:
                              </span>
                            </div>
                            <div className="space-y-1.5 text-xs">
                              {info.scootersCount > 0 && (
                                <div className="flex justify-between items-center">
                                  <span className="text-slate-500">Scooters 🛴:</span>
                                  <span className="font-extrabold text-amber-600 font-mono bg-amber-50 px-2.5 py-0.5 rounded-lg">{info.scootersCount} units</span>
                                </div>
                              )}
                              {info.batteriesCount > 0 && (
                                <div className="flex justify-between items-center">
                                  <span className="text-slate-500">Batteries 🔋:</span>
                                  <span className="font-extrabold text-amber-600 font-mono bg-amber-50 px-2.5 py-0.5 rounded-lg">{info.batteriesCount} packs</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Individual Scooter Units List */}
                    {heldList.length > 0 && (
                      <div className="space-y-4">
                        <h4 className="text-xs font-extrabold uppercase text-slate-600 tracking-wider flex items-center gap-1.5">
                          <span>📋 Individual Reserved Scooters ({heldList.length})</span>
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {heldList.map((unit) => (
                            <div key={unit.id} className="bg-white border border-slate-150 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="font-extrabold text-slate-900 text-sm">{unit.modelName}</span>
                                  <span className="text-[10px] font-sans font-bold px-2 py-0.5 bg-slate-50 border border-slate-200 text-slate-600 rounded-full">
                                    {unit.color}
                                  </span>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono mb-3 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                  <div className="col-span-2 border-b border-slate-200/50 pb-1.5 mb-1 flex justify-between items-center text-xs font-sans">
                                    <span className="text-slate-400 font-bold text-[9px] uppercase">Held For</span>
                                    <span className="text-amber-700 font-black">{unit.heldFor || '—'}</span>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 block text-[9px] uppercase font-sans font-bold">Chassis No</span>
                                    <span className="text-cyan-700 font-bold">{unit.chassisNo}</span>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 block text-[9px] uppercase font-sans font-bold">Motor No</span>
                                    <span className="text-slate-800 font-semibold">{unit.motorNo}</span>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 block text-[9px] uppercase font-sans font-bold">Held By</span>
                                    <span className="text-slate-800 font-semibold font-sans">{unit.heldBy || '—'}</span>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 block text-[9px] uppercase font-sans font-bold">Hold Date</span>
                                    <span className="text-slate-800 font-semibold font-sans">
                                      {unit.holdDate ? new Date(unit.holdDate).toLocaleDateString() : '—'}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                                <span className="text-slate-400">
                                  Registered by {unit.createdOperator}
                                </span>
                                <span className="inline-flex items-center gap-1 font-sans font-bold px-2.5 py-0.5 rounded text-[10px] bg-amber-50 text-amber-700 border border-amber-150">
                                  🤝 RESERVED SCOOTER
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Individual Battery Units List */}
                    {heldBatteriesList.length > 0 && (
                      <div className="space-y-4">
                        <h4 className="text-xs font-extrabold uppercase text-slate-600 tracking-wider flex items-center gap-1.5">
                          <span>🔋 Individual Reserved Battery Batches ({heldBatteriesList.length})</span>
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {heldBatteriesList.map((sale) => (
                            <div key={sale.id} className="bg-white border border-slate-150 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="font-extrabold text-slate-900 text-sm">{sale.batterySeries}</span>
                                  <span className="text-[10px] font-sans font-bold px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-full">
                                    {sale.quantity} Packs
                                  </span>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono mb-3 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                  <div className="col-span-2 border-b border-slate-200/50 pb-1.5 mb-1 flex justify-between items-center text-xs font-sans">
                                    <span className="text-slate-400 font-bold text-[9px] uppercase">Held For</span>
                                    <span className="text-amber-700 font-black">{sale.heldFor || sale.buyerName || '—'}</span>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 block text-[9px] uppercase font-sans font-bold">Start Serial</span>
                                    <span className="text-cyan-700 font-bold">{sale.startNo || 'N/A'}</span>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 block text-[9px] uppercase font-sans font-bold">End Serial</span>
                                    <span className="text-cyan-700 font-bold">{sale.endNo || 'N/A'}</span>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 block text-[9px] uppercase font-sans font-bold">Held By</span>
                                    <span className="text-slate-800 font-semibold font-sans">{sale.heldBy || sale.operator || '—'}</span>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 block text-[9px] uppercase font-sans font-bold">Hold Date</span>
                                    <span className="text-slate-800 font-semibold font-sans">
                                      {sale.holdDate ? new Date(sale.holdDate).toLocaleDateString() : '—'}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                                <span className="text-slate-400">
                                  Registered by {sale.operator}
                                </span>
                                <span className="inline-flex items-center gap-1 font-sans font-bold px-2.5 py-0.5 rounded text-[10px] bg-amber-50 text-amber-700 border border-amber-150">
                                  🔋 RESERVED BATTERY
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
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
    </div>
  );
}
