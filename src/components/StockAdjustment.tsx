import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowDownCircle, ArrowUpCircle, ClipboardList, Plus, FileText, User, ShoppingBag, Ship, Store, Battery, Zap } from 'lucide-react';
import { Product, Buyer, StockLog, User as SessionUser, BatteryImport, ChargerImport } from '../types';

interface StockAdjustmentProps {
  products: Product[];
  buyers: Buyer[];
  stockLogs: StockLog[];
  currentUser: SessionUser;
  onRefresh: () => void;
  onSubmitStockLog: (payload: any) => Promise<boolean>;
  batteryImports?: BatteryImport[];
  onSubmitBatteryImport?: (data: {
    batterySeries: string;
    startNo: string;
    endNo: string;
    quantity: number;
    supplierName?: string;
    containerId?: string;
    notes?: string;
  }) => Promise<boolean>;
  chargerImports?: ChargerImport[];
  onSubmitChargerImport?: (data: {
    chargerType: string;
    startNo: string;
    endNo: string;
    quantity: number;
    supplierName?: string;
    containerId?: string;
    notes?: string;
  }) => Promise<boolean>;
  chargerTypeList?: string[];
}

export default function StockAdjustment({ 
  products, 
  buyers, 
  stockLogs, 
  currentUser, 
  onRefresh, 
  onSubmitStockLog,
  batteryImports = [],
  onSubmitBatteryImport,
  chargerImports = [],
  onSubmitChargerImport,
  chargerTypeList = []
}: StockAdjustmentProps) {
  const [activeSubTab, setActiveSubTab] = useState<'scooters' | 'batteries' | 'chargers'>('scooters');

  // Scooter Stock States
  const [modelName, setModelName] = useState('');
  const [color, setColor] = useState('');
  const [type, setType] = useState<'in' | 'out'>('in');
  const [sourceChannel, setSourceChannel] = useState<'container_freight' | 'local_seller' | 'customer_sale' | 'adjustment'>('container_freight');
  const [quantity, setQuantity] = useState(1);
  const [buyerName, setBuyerName] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Battery Import States
  const [impBatterySeries, setImpBatterySeries] = useState('Alpha');
  const [impQuantity, setImpQuantity] = useState('');
  const [impSupplier, setImpSupplier] = useState('');
  const [impContainerId, setImpContainerId] = useState('');
  const [impNotes, setImpNotes] = useState('');
  const [batteryLoading, setBatteryLoading] = useState(false);
  const [batteryErrorMsg, setBatteryErrorMsg] = useState('');
  const [batterySuccessMsg, setBatterySuccessMsg] = useState('');

  // Charger Import States
  const [impChargerType, setImpChargerType] = useState(chargerTypeList[0] || '48V Charger');
  const [impChargerQuantity, setImpChargerQuantity] = useState('');
  const [impChargerSupplier, setImpChargerSupplier] = useState('');
  const [impChargerContainerId, setImpChargerContainerId] = useState('');
  const [impChargerNotes, setImpChargerNotes] = useState('');
  const [chargerLoading, setChargerLoading] = useState(false);
  const [chargerErrorMsg, setChargerErrorMsg] = useState('');
  const [chargerSuccessMsg, setChargerSuccessMsg] = useState('');

  // Update selected charger type if list changes
  React.useEffect(() => {
    if (chargerTypeList.length > 0 && !chargerTypeList.includes(impChargerType)) {
      setImpChargerType(chargerTypeList[0]);
    }
  }, [chargerTypeList]);

  const handleModelChange = (selectedModel: string) => {
    setModelName(selectedModel);
    const prod = products.find(p => p.name === selectedModel);
    if (prod && prod.colors.length > 0) {
      setColor(prod.colors[0]);
    } else {
      setColor('');
    }
  };

  const handleTypeChange = (newType: 'in' | 'out') => {
    setType(newType);
    if (newType === 'in') {
      setSourceChannel('container_freight');
    } else {
      setSourceChannel('customer_sale');
    }
  };

  const handleLogStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modelName || !color) {
      setErrorMsg('Please select model and color first');
      return;
    }

    if (type === 'out' && sourceChannel === 'customer_sale' && !buyerName) {
      setErrorMsg('Buyer Name is required for customer sales');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    const payload = {
      modelName,
      color,
      type,
      sourceChannel,
      quantity: Number(quantity),
      buyerName: type === 'out' ? buyerName : undefined,
      notes: notes || '',
      operator: currentUser.username,
    };

    const ok = await onSubmitStockLog(payload);
    if (ok) {
      setSuccessMsg(`Successfully logged Stock ${type.toUpperCase()} transaction!`);
      // Reset inputs
      setQuantity(1);
      setBuyerName('');
      setNotes('');
      onRefresh();
    } else {
      setErrorMsg('Failed to record stock log. Verify backend connection.');
    }
    setLoading(false);
  };

  const handleBatteryImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!impBatterySeries || !impQuantity) {
      setBatteryErrorMsg('Please fill in all required battery details.');
      return;
    }

    setBatteryLoading(true);
    setBatteryErrorMsg('');
    setBatterySuccessMsg('');

    const success = await onSubmitBatteryImport?.({
      batterySeries: impBatterySeries,
      startNo: 'N/A', // Auto-filled to omit serial number prompt
      endNo: 'N/A',   // Auto-filled to omit serial number prompt
      quantity: Number(impQuantity),
      supplierName: impSupplier,
      containerId: impContainerId,
      notes: impNotes
    });

    setBatteryLoading(false);
    if (success) {
      setBatterySuccessMsg(`Successfully logged import of ${impQuantity} ${impBatterySeries} Series battery packs!`);
      // Reset inputs
      setImpQuantity('');
      setImpSupplier('');
      setImpContainerId('');
      setImpNotes('');
      onRefresh();
    } else {
      setBatteryErrorMsg('Failed to log battery import. Please try again.');
    }
  };

  const handleChargerImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!impChargerType || !impChargerQuantity) {
      setChargerErrorMsg('Please fill in all required charger details.');
      return;
    }

    setChargerLoading(true);
    setChargerErrorMsg('');
    setChargerSuccessMsg('');

    const success = await onSubmitChargerImport?.({
      chargerType: impChargerType,
      startNo: 'N/A', // Auto-filled to omit serial number prompt
      endNo: 'N/A',   // Auto-filled to omit serial number prompt
      quantity: Number(impChargerQuantity),
      supplierName: impChargerSupplier,
      containerId: impChargerContainerId,
      notes: impChargerNotes
    });

    setChargerLoading(false);
    if (success) {
      setChargerSuccessMsg(`Successfully logged import of ${impChargerQuantity} ${impChargerType} units!`);
      // Reset inputs
      setImpChargerQuantity('');
      setImpChargerSupplier('');
      setImpChargerContainerId('');
      setImpChargerNotes('');
      onRefresh();
    } else {
      setChargerErrorMsg('Failed to log charger import. Please try again.');
    }
  };

  // Helper to format source channel tags
  const getChannelBadge = (ch: string) => {
    switch (ch) {
      case 'container_freight': return { text: 'Container Freight', color: 'border-blue-100 text-blue-700 bg-blue-50', icon: Ship };
      case 'local_seller': return { text: 'Local Seller', color: 'border-amber-100 text-amber-700 bg-amber-50', icon: Store };
      case 'customer_sale': return { text: 'Customer Sale', color: 'border-emerald-100 text-emerald-700 bg-emerald-50', icon: ShoppingBag };
      default: return { text: 'Inventory Adjustment', color: 'border-slate-100 text-slate-700 bg-slate-50', icon: ClipboardList };
    }
  };

  return (
    <div className="space-y-6" id="stock-workspace">
      
      {/* Sub-tab Selection */}
      <div className="flex bg-slate-100 p-1 rounded-2xl w-full sm:w-fit" id="stock-subtab-selector">
        <button
          type="button"
          onClick={() => setActiveSubTab('scooters')}
          className={`flex-1 sm:flex-initial px-5 py-2.5 text-xs font-bold rounded-xl font-sans uppercase transition-all cursor-pointer ${
            activeSubTab === 'scooters' 
              ? 'bg-white text-slate-800 shadow-sm' 
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          📦 Scooter Stock (Kits)
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('batteries')}
          className={`flex-1 sm:flex-initial px-5 py-2.5 text-xs font-bold rounded-xl font-sans uppercase transition-all cursor-pointer ${
            activeSubTab === 'batteries' 
              ? 'bg-white text-slate-800 shadow-sm' 
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          🔋 Battery Imports
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('chargers')}
          className={`flex-1 sm:flex-initial px-5 py-2.5 text-xs font-bold rounded-xl font-sans uppercase transition-all cursor-pointer ${
            activeSubTab === 'chargers' 
              ? 'bg-white text-slate-800 shadow-sm' 
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          🔌 Charger Imports
        </button>
      </div>

      {activeSubTab === 'scooters' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Form to log transaction */}
          <div className="lg:col-span-5" id="log-stock-panel">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm animate-fade-in" id="stock-form-card">
              <div className="flex items-center gap-2 mb-4">
                <ClipboardList className="h-5 w-5 text-cyan-600" />
                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700 font-sans">
                  📥 Add / Remove Scooter Shipments
                </h3>
              </div>

              <div className="p-3.5 mb-4 bg-cyan-50 border border-cyan-100 rounded-2xl text-xs text-cyan-800 leading-relaxed font-sans font-medium">
                <p><strong>Scooter Stock Management:</strong> Log new production batches, supplier shipments (IN), or warehouse write-offs (OUT). Updates bulk un-assembled inventory.</p>
              </div>

              {errorMsg && (
                <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 text-rose-600 text-xs font-sans font-medium rounded-2xl" id="stock-error">
                  ⚠️ {errorMsg}
                </div>
              )}
              {successMsg && (
                <div className="mb-4 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-600 text-xs font-sans font-medium rounded-2xl" id="stock-success">
                  ✨ {successMsg}
                </div>
              )}

              <form onSubmit={handleLogStock} className="space-y-4">
                {/* Transaction Type Toggle */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 font-sans">
                    Operation Type
                  </label>
                  <div className="flex bg-slate-100 p-1 rounded-2xl">
                    <button
                      type="button"
                      onClick={() => handleTypeChange('in')}
                      className={`flex-1 py-2 text-xs font-bold rounded-xl font-sans uppercase transition-all cursor-pointer flex items-center justify-center gap-1 ${
                        type === 'in' 
                          ? 'bg-emerald-600 text-white shadow-sm' 
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <ArrowDownCircle className="h-4 w-4" />
                      <span>Stock IN (Add)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTypeChange('out')}
                      className={`flex-1 py-2 text-xs font-bold rounded-xl font-sans uppercase transition-all cursor-pointer flex items-center justify-center gap-1 ${
                        type === 'out' 
                          ? 'bg-cyan-600 text-white shadow-sm' 
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <ArrowUpCircle className="h-4 w-4" />
                      <span>Stock OUT (Deduct)</span>
                    </button>
                  </div>
                </div>

                {/* Model Selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 font-sans">
                    Scooter Model Name
                  </label>
                  <select
                    value={modelName}
                    onChange={(e) => handleModelChange(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-xs text-slate-800 focus:border-cyan-500 outline-none cursor-pointer font-sans"
                    required
                  >
                    <option value="">-- Choose Scooter Model --</option>
                    {products.map((prod) => (
                      <option key={prod.id} value={prod.name}>{prod.name}</option>
                    ))}
                  </select>
                </div>

                {/* Color Selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 font-sans">
                    Scooter Variant Color
                  </label>
                  <select
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-xs text-slate-800 focus:border-cyan-500 outline-none cursor-pointer font-sans"
                    required
                    disabled={!modelName}
                  >
                    <option value="">-- Select Variant Color --</option>
                    {modelName && products.find(p => p.name === modelName)?.colors.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* Channel & Qty Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 font-sans">
                      Source Channel
                    </label>
                    <select
                      value={sourceChannel}
                      onChange={(e) => setSourceChannel(e.target.value as any)}
                      className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-xs text-slate-800 focus:border-cyan-500 outline-none cursor-pointer font-sans"
                      required
                    >
                      {type === 'in' ? (
                        <>
                          <option value="container_freight">Container Freight (CKD)</option>
                          <option value="local_seller">Local Seller Purchase</option>
                          <option value="adjustment">Internal Stock Adjustment</option>
                        </>
                      ) : (
                        <>
                          <option value="customer_sale">Retail Customer Sale</option>
                          <option value="adjustment">Internal Write-off / Damage</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 font-sans">
                      Quantity (Units)
                    </label>
                    <input
                      type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-xs text-slate-800 focus:border-cyan-500 outline-none font-sans"
                      required
                      min="1"
                    />
                  </div>
                </div>

                {/* Optional Buyer Name for Outflow Sales */}
                {type === 'out' && sourceChannel === 'customer_sale' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 font-sans">
                      Recipient / Buyer Name
                    </label>
                    <select
                      value={buyerName}
                      onChange={(e) => setBuyerName(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-xs text-slate-800 focus:border-cyan-500 outline-none cursor-pointer font-sans"
                      required
                    >
                      <option value="">-- Choose Registered Buyer --</option>
                      {buyers.map((b) => (
                        <option key={b.id} value={b.name}>{b.name} ({b.contact || 'No Contact'})</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Additional Comments */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 font-sans">
                    Additional Comments & Remarks
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Container ID COSCO-928394-D, customs entry ref"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-xs text-slate-800 focus:border-cyan-500 outline-none font-sans"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-sans font-bold text-xs transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                >
                  <Plus className="h-4.5 w-4.5" />
                  <span>Log Stock Transaction ({quantity} Units)</span>
                </button>
              </form>
            </div>
          </div>

          {/* Right Column: Recent transactions list */}
          <div className="lg:col-span-7" id="transaction-logs-panel">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 h-full flex flex-col shadow-sm" id="logs-card">
              <div className="flex items-center gap-2 mb-4">
                <ClipboardList className="h-5 w-5 text-cyan-600" />
                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700 font-sans">
                  Warehouse Stock Flow History
                </h3>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 max-h-[500px] pr-1">
                {stockLogs.filter(log => !(log.notes && log.notes.includes('(Chassis:'))).length === 0 ? (
                  <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200" id="empty-logs">
                    <FileText className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                    <span className="text-xs text-slate-500">No stock logs or warehouse adjustments recorded yet.</span>
                  </div>
                ) : (
                  [...stockLogs]
                    .filter(log => !(log.notes && log.notes.includes('(Chassis:')))
                    .reverse()
                    .map((log) => {
                      const badge = getChannelBadge(log.sourceChannel);
                      const BadgeIcon = badge.icon;
                      
                      return (
                        <div 
                          key={log.id}
                          className={`p-4 rounded-2xl border text-xs font-sans transition-all ${
                            log.type === 'in' 
                              ? 'border-emerald-100 bg-emerald-50/30' 
                              : 'border-cyan-100 bg-cyan-50/30'
                          }`}
                          id={`log-item-${log.id}`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <span className="font-sans font-bold text-slate-800 text-sm">{log.modelName}</span>
                              <span className="ml-2 text-slate-500">[{log.color}]</span>
                            </div>
                            <span className={`px-2.5 py-1 rounded-xl text-[10px] font-bold border ${
                              log.type === 'in' 
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-200' 
                                : 'bg-cyan-100 text-cyan-800 border-cyan-200'
                            }`}>
                              {log.type === 'in' ? '+' : '-'}{log.quantity} UNITS
                            </span>
                          </div>

                          <div className="space-y-1.5 text-slate-500 text-[11px]">
                            <div className="flex justify-between items-center">
                              <span>Channel:</span>
                              <span className={`px-2 py-0.5 rounded-full border text-[9px] font-sans font-bold flex items-center gap-1 ${badge.color}`}>
                                <BadgeIcon className="h-3 w-3" />
                                {badge.text}
                              </span>
                            </div>

                            <div className="flex justify-between">
                              <span>Operator:</span>
                              <span className="text-slate-700 font-medium flex items-center gap-1">
                                <User className="h-3 w-3 text-slate-400" />
                                {log.operator}
                              </span>
                            </div>

                            {log.buyerName && (
                              <div className="flex justify-between">
                                <span>Buyer:</span>
                                <span className="text-cyan-700 font-bold flex items-center gap-1">
                                  <ShoppingBag className="h-3 w-3 text-cyan-500" />
                                  {log.buyerName}
                                </span>
                              </div>
                            )}

                            <div className="flex justify-between">
                              <span>Recorded At:</span>
                              <span className="text-slate-600">{new Date(log.timestamp).toLocaleString()}</span>
                            </div>

                            {log.notes && (
                              <div className="mt-2.5 pt-2 border-t border-slate-100 text-[11px] text-slate-500 font-sans italic">
                                Comment: "{log.notes}"
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'batteries' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
          {/* Left Column: Battery Import form */}
          <div className="lg:col-span-5" id="log-battery-panel">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm" id="battery-form-card">
              <div className="flex items-center gap-2 mb-4">
                <Battery className="h-5 w-5 text-emerald-600" />
                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700 font-sans">
                  ⚡ Import Batteries from Abroad
                </h3>
              </div>

              <div className="p-3.5 mb-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-xs text-emerald-800 leading-relaxed font-sans font-medium">
                <p><strong>Step C: Battery Import:</strong> Log batch imports of battery packs from foreign manufacturers directly into the warehouse state.</p>
              </div>

              {batteryErrorMsg && (
                <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 text-rose-600 text-xs font-sans font-medium rounded-2xl" id="battery-error">
                  ⚠️ {batteryErrorMsg}
                </div>
              )}
              {batterySuccessMsg && (
                <div className="mb-4 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-600 text-xs font-sans font-medium rounded-2xl" id="battery-success">
                  ✨ {batterySuccessMsg}
                </div>
              )}

              <form onSubmit={handleBatteryImportSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 font-sans">
                    Battery Series Name 🔋
                  </label>
                  <select
                    value={impBatterySeries}
                    onChange={(e) => setImpBatterySeries(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-xs text-slate-800 focus:border-cyan-500 outline-none cursor-pointer font-sans"
                    required
                  >
                    <option value="Alpha">Alpha Series</option>
                    <option value="Beta">Beta Series</option>
                    <option value="Pro-Pack">Pro-Pack Series</option>
                    <option value="custom">Custom/Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 font-sans">
                    Foreign Supplier / Manufacturer 🏢
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Shenzhen Lithium Tech"
                    value={impSupplier}
                    onChange={(e) => setImpSupplier(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-xs text-slate-800 focus:border-cyan-500 outline-none font-sans"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 font-sans">
                    Quantity (Packs) 🔢
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 1000"
                    value={impQuantity}
                    onChange={(e) => setImpQuantity(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-xs text-slate-800 focus:border-cyan-500 outline-none font-sans"
                    required
                    min="1"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 font-sans">
                    Container / Shipment ID 🚢
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. COSCO-93829-HK"
                    value={impContainerId}
                    onChange={(e) => setImpContainerId(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-xs text-slate-800 focus:border-cyan-500 outline-none font-sans"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 font-sans">
                    Additional Import Remarks ✏️
                  </label>
                  <input
                    type="text"
                    placeholder="Custom customs notes, customs entry ref"
                    value={impNotes}
                    onChange={(e) => setImpNotes(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-xs text-slate-800 focus:border-cyan-500 outline-none font-sans"
                  />
                </div>

                <button
                  type="submit"
                  disabled={batteryLoading}
                  className="w-full py-3.5 rounded-2xl bg-emerald-900 hover:bg-emerald-800 text-white font-sans font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-40"
                >
                  <Battery className="h-4.5 w-4.5" />
                  <span>Log Import Shipment ({impQuantity || '0'} Packs) 💾</span>
                </button>
              </form>
            </div>
          </div>

          {/* Right Column: Battery Import Ledger */}
          <div className="lg:col-span-7" id="battery-logs-panel">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 h-full flex flex-col shadow-sm" id="battery-logs-card">
              <div className="flex items-center gap-2 mb-4">
                <Battery className="h-5 w-5 text-emerald-600" />
                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700 font-sans">
                  Overseas Battery Import Ledger
                </h3>
              </div>

              <div className="flex-1 overflow-y-auto max-h-[500px] pr-1">
                {!batteryImports || batteryImports.length === 0 ? (
                  <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200" id="empty-battery-logs">
                    <FileText className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                    <span className="text-xs text-slate-500 font-sans">No imported battery series recorded yet.</span>
                  </div>
                ) : (
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">
                        <th className="py-2.5 px-2">Import Date</th>
                        <th className="py-2.5 px-2">Series</th>
                        <th className="py-2.5 px-2">Supplier</th>
                        <th className="py-2.5 px-2">Container ID</th>
                        <th className="py-2.5 px-2 text-right">Qty</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-slate-700 font-sans">
                      {[...batteryImports].reverse().map((imp) => (
                        <tr key={imp.id} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-2 text-slate-400 font-mono text-[10px]">
                            {new Date(imp.importDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                          </td>
                          <td className="py-2.5 px-2 font-bold text-emerald-800">
                            {imp.batterySeries}
                          </td>
                          <td className="py-2.5 px-2 text-slate-600">
                            {imp.supplierName || <span className="text-slate-300 italic">N/A</span>}
                          </td>
                          <td className="py-2.5 px-2 font-mono text-slate-500 text-[10px]">
                            {imp.containerId || <span className="text-slate-300 italic">N/A</span>}
                          </td>
                          <td className="py-2.5 px-2 text-right font-extrabold text-slate-900">
                            {imp.quantity.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'chargers' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
          {/* Left Column: Charger Import form */}
          <div className="lg:col-span-5" id="log-charger-panel">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm" id="charger-form-card">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="h-5 w-5 text-red-600" />
                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700 font-sans">
                  🔌 Import Chargers from Abroad
                </h3>
              </div>

              <div className="p-3.5 mb-4 bg-red-50 border border-red-100 rounded-2xl text-xs text-red-800 leading-relaxed font-sans font-medium">
                <p><strong>Charger Import:</strong> Log batch imports of standalone chargers from foreign manufacturers directly into the warehouse state.</p>
              </div>

              {chargerErrorMsg && (
                <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 text-rose-600 text-xs font-sans font-medium rounded-2xl" id="charger-error">
                  ⚠️ {chargerErrorMsg}
                </div>
              )}
              {chargerSuccessMsg && (
                <div className="mb-4 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-600 text-xs font-sans font-medium rounded-2xl" id="charger-success">
                  ✨ {chargerSuccessMsg}
                </div>
              )}

              <form onSubmit={handleChargerImportSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 font-sans">
                    Charger Type 🔌
                  </label>
                  <select
                    value={impChargerType}
                    onChange={(e) => setImpChargerType(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-xs text-slate-800 focus:border-red-500 outline-none cursor-pointer font-sans"
                    required
                  >
                    {chargerTypeList.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 font-sans">
                    Foreign Supplier / Manufacturer 🏢
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Shenzhen Charging Tech"
                    value={impChargerSupplier}
                    onChange={(e) => setImpChargerSupplier(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-xs text-slate-800 focus:border-red-500 outline-none font-sans"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 font-sans">
                    Quantity (Units) 🔢
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 1000"
                    value={impChargerQuantity}
                    onChange={(e) => setImpChargerQuantity(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-xs text-slate-800 focus:border-red-500 outline-none font-sans"
                    required
                    min="1"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 font-sans">
                    Container / Shipment ID 🚢
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. COSCO-CHARG-HK"
                    value={impChargerContainerId}
                    onChange={(e) => setImpChargerContainerId(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-xs text-slate-800 focus:border-red-500 outline-none font-sans"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 font-sans">
                    Additional Import Remarks ✏️
                  </label>
                  <input
                    type="text"
                    placeholder="Custom customs notes, customs entry ref"
                    value={impChargerNotes}
                    onChange={(e) => setImpChargerNotes(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-xs text-slate-800 focus:border-red-500 outline-none font-sans"
                  />
                </div>

                <button
                  type="submit"
                  disabled={chargerLoading}
                  className="w-full py-3.5 rounded-2xl bg-red-900 hover:bg-red-800 text-white font-sans font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-40"
                >
                  <Zap className="h-4.5 w-4.5" />
                  <span>Log Import Shipment ({impChargerQuantity || '0'} Units) 💾</span>
                </button>
              </form>
            </div>
          </div>

          {/* Right Column: Charger Import Ledger */}
          <div className="lg:col-span-7" id="charger-logs-panel">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 h-full flex flex-col shadow-sm" id="charger-logs-card">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="h-5 w-5 text-red-600" />
                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700 font-sans">
                  Overseas Charger Import Ledger
                </h3>
              </div>

              <div className="flex-1 overflow-y-auto max-h-[500px] pr-1">
                {!chargerImports || chargerImports.length === 0 ? (
                  <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200" id="empty-charger-logs">
                    <FileText className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                    <span className="text-xs text-slate-500 font-sans">No imported chargers recorded yet.</span>
                  </div>
                ) : (
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">
                        <th className="py-2.5 px-2">Import Date</th>
                        <th className="py-2.5 px-2">Type</th>
                        <th className="py-2.5 px-2">Supplier</th>
                        <th className="py-2.5 px-2">Container ID</th>
                        <th className="py-2.5 px-2 text-right">Qty</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-slate-700 font-sans">
                      {[...chargerImports].reverse().map((imp) => (
                        <tr key={imp.id} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-2 text-slate-400 font-mono text-[10px]">
                            {new Date(imp.importDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                          </td>
                          <td className="py-2.5 px-2 font-bold text-red-800">
                            {imp.chargerType}
                          </td>
                           <td className="py-2.5 px-2 text-slate-600">
                            {imp.supplierName || <span className="text-slate-300 italic">N/A</span>}
                          </td>
                          <td className="py-2.5 px-2 font-mono text-slate-500 text-[10px]">
                            {imp.containerId || <span className="text-slate-300 italic">N/A</span>}
                          </td>
                          <td className="py-2.5 px-2 text-right font-extrabold text-slate-900">
                            {imp.quantity.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
