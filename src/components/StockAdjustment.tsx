import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowDownCircle, ArrowUpCircle, ClipboardList, Plus, FileText, User, ShoppingBag, Ship, Store, Battery, Zap, PlusCircle } from 'lucide-react';
import { Product, Buyer, StockLog, User as SessionUser, BatteryImport, ChargerImport, ScooterUnit } from '../types';
import QRSerialScanner from './QRSerialScanner';

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
    billNo?: string;
    stockInNo?: string;
    serialNumbers?: string[];
    warrantyDurationMonths?: number;
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
    billNo?: string;
    stockInNo?: string;
  }) => Promise<boolean>;
  chargerTypeList?: string[];
  scooterUnits?: ScooterUnit[];
  onSubmitAssembly?: (payload: any) => Promise<boolean>;
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
  chargerTypeList = [],
  scooterUnits = [],
  onSubmitAssembly
}: StockAdjustmentProps) {
  const [activeSubTab, setActiveSubTab] = useState<'scooters' | 'batteries' | 'chargers' | 'local_scooters'>('scooters');

  // Local Seller Purchase States
  const [localModel, setLocalModel] = useState('');
  const [localColor, setLocalColor] = useState('');
  const [localChassis, setLocalChassis] = useState('');
  const [localFrontTireSize, setLocalFrontTireSize] = useState<'10-inch' | '12-inch'>('10-inch');
  const [localRearTireSize, setLocalRearTireSize] = useState<'10-inch' | '12-inch'>('10-inch');
  const [localMotor, setLocalMotor] = useState('');
  const [localController, setLocalController] = useState('');
  const [localNotes, setLocalNotes] = useState('');
  const [localErrorMsg, setLocalErrorMsg] = useState('');
  const [localSuccessMsg, setLocalSuccessMsg] = useState('');
  const [localLoading, setLocalLoading] = useState(false);

  // Bill No & Stock In No for various forms
  const [scooterBillNo, setScooterBillNo] = useState('');
  const [scooterStockInNo, setScooterStockInNo] = useState('');

  const [batteryBillNo, setBatteryBillNo] = useState('');
  const [batteryStockInNo, setBatteryStockInNo] = useState('');

  const [chargerBillNo, setChargerBillNo] = useState('');
  const [chargerStockInNo, setChargerStockInNo] = useState('');

  const [localBillNo, setLocalBillNo] = useState('');
  const [localStockInNo, setLocalStockInNo] = useState('');

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

  // Dual Input and QR Scanning States for Battery Purchase (Imports)
  const [importInputMethod, setImportInputMethod] = useState<'range' | 'scan'>('range');
  const [scannedImportSerials, setScannedImportSerials] = useState<string[]>([]);
  const [directManualImportSerial, setDirectManualImportSerial] = useState('');
  const [directManualImportError, setDirectManualImportError] = useState<string | null>(null);
  const [showImportScanner, setShowImportScanner] = useState(false);
  const [importIsUnderWarranty, setImportIsUnderWarranty] = useState<boolean>(true);
  const [importWarrantyDuration, setImportWarrantyDuration] = useState<number>(12);
  const [impStartNo, setImpStartNo] = useState('');
  const [impEndNo, setImpEndNo] = useState('');

  // Collect all registered battery serial numbers to prevent duplicates during purchase
  const allRegisteredBatterySerials = React.useMemo(() => {
    const list: string[] = [];
    if (batteryImports && Array.isArray(batteryImports)) {
      batteryImports.forEach(imp => {
        if (imp.serialNumbers && Array.isArray(imp.serialNumbers)) {
          list.push(...imp.serialNumbers);
        } else if (imp.startNo && imp.endNo && imp.startNo !== 'N/A' && imp.endNo !== 'N/A') {
          const startMatch = imp.startNo.match(/^([A-Za-z0-9_-]+?)(\d+)$/);
          const endMatch = imp.endNo.match(/^([A-Za-z0-9_-]+?)(\d+)$/);
          if (startMatch && endMatch && startMatch[1] === endMatch[1]) {
            const prefix = startMatch[1];
            const startNum = parseInt(startMatch[2], 10);
            const endNum = parseInt(endMatch[2], 10);
            const paddingLength = startMatch[2].length;
            for (let i = startNum; i <= endNum; i++) {
              const numStr = String(i).padStart(paddingLength, '0');
              list.push(`${prefix}${numStr}`);
            }
          }
        }
      });
    }
    if (scooterUnits && Array.isArray(scooterUnits)) {
      scooterUnits.forEach(unit => {
        if (unit.batterySerials && Array.isArray(unit.batterySerials)) {
          list.push(...unit.batterySerials);
        }
      });
    }
    return list;
  }, [batteryImports, scooterUnits]);

  // Handle direct manual entry of battery serials in purchase
  const handleAddDirectManualImportSerial = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setDirectManualImportError(null);
    const cleanSerial = directManualImportSerial.trim().toUpperCase();
    if (!cleanSerial) return;

    if (scannedImportSerials.includes(cleanSerial)) {
      setDirectManualImportError(`Duplicate: "${cleanSerial}" is already in your current purchase list!`);
      return;
    }

    if (allRegisteredBatterySerials.map(s => s.trim().toUpperCase()).includes(cleanSerial)) {
      setDirectManualImportError(`System Error: "${cleanSerial}" is already registered in the warehouse database!`);
      return;
    }

    setScannedImportSerials(prev => {
      const updated = [...prev, cleanSerial];
      setImpQuantity(String(updated.length)); // Automatically keep quantity in sync with scanned/entered count
      return updated;
    });
    setDirectManualImportSerial('');
  };

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
      billNo: type === 'in' ? scooterBillNo : undefined,
      stockInNo: type === 'in' ? scooterStockInNo : undefined,
    };

    const ok = await onSubmitStockLog(payload);
    if (ok) {
      setSuccessMsg(`Successfully logged Stock ${type.toUpperCase()} transaction!`);
      // Reset inputs
      setQuantity(1);
      setBuyerName('');
      setNotes('');
      setScooterBillNo('');
      setScooterStockInNo('');
      onRefresh();
    } else {
      setErrorMsg('Failed to record stock log. Verify backend connection.');
    }
    setLoading(false);
  };

  const handleBatteryImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!impBatterySeries) {
      setBatteryErrorMsg('Please select a battery series.');
      return;
    }

    // Validation based on input method
    if (importInputMethod === 'scan') {
      if (scannedImportSerials.length === 0) {
        setBatteryErrorMsg('Please scan or enter manually at least one battery serial number.');
        return;
      }
    } else {
      if (!impQuantity || Number(impQuantity) <= 0) {
        setBatteryErrorMsg('Please enter a valid battery quantity.');
        return;
      }
      if (importIsUnderWarranty && (!impStartNo.trim() || !impEndNo.trim())) {
        setBatteryErrorMsg('Please provide both Start and End Serial Numbers for warranty tracking.');
        return;
      }
    }

    setBatteryLoading(true);
    setBatteryErrorMsg('');
    setBatterySuccessMsg('');

    const calculatedQty = importInputMethod === 'scan' ? scannedImportSerials.length : Number(impQuantity);

    const success = await onSubmitBatteryImport?.({
      batterySeries: impBatterySeries,
      startNo: importInputMethod === 'range' && impStartNo ? impStartNo.trim().toUpperCase() : 'N/A',
      endNo: importInputMethod === 'range' && impEndNo ? impEndNo.trim().toUpperCase() : 'N/A',
      quantity: calculatedQty,
      supplierName: impSupplier,
      containerId: impContainerId,
      notes: impNotes,
      billNo: batteryBillNo,
      stockInNo: batteryStockInNo,
      serialNumbers: importInputMethod === 'scan' ? scannedImportSerials : undefined,
      warrantyDurationMonths: importIsUnderWarranty ? importWarrantyDuration : undefined
    });

    setBatteryLoading(false);
    if (success) {
      setBatterySuccessMsg(`Successfully logged import of ${calculatedQty} ${impBatterySeries} Series battery packs!`);
      // Reset inputs
      setImpQuantity('');
      setImpSupplier('');
      setImpContainerId('');
      setImpNotes('');
      setBatteryBillNo('');
      setBatteryStockInNo('');
      setImpStartNo('');
      setImpEndNo('');
      setScannedImportSerials([]);
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
      notes: impChargerNotes,
      billNo: chargerBillNo,
      stockInNo: chargerStockInNo
    });

    setChargerLoading(false);
    if (success) {
      setChargerSuccessMsg(`Successfully logged import of ${impChargerQuantity} ${impChargerType} units!`);
      // Reset inputs
      setImpChargerQuantity('');
      setImpChargerSupplier('');
      setImpChargerContainerId('');
      setImpChargerNotes('');
      setChargerBillNo('');
      setChargerStockInNo('');
      onRefresh();
    } else {
      setChargerErrorMsg('Failed to log charger import. Please try again.');
    }
  };

  const handleLocalPurchaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!localModel || !localColor || !localChassis || !localMotor || !localController) {
      setLocalErrorMsg('Please fill in all local seller purchase hardware fields.');
      return;
    }

    setLocalLoading(true);
    setLocalErrorMsg('');
    setLocalSuccessMsg('');

    try {
      if (onSubmitAssembly) {
        const success = await onSubmitAssembly({
          actionType: 'create_stage1',
          modelName: localModel,
          color: localColor,
          chassisNo: localChassis.trim().toUpperCase(),
          motorNo: localMotor.trim().toUpperCase(),
          controllerNo: localController.trim().toUpperCase(),
          frontTireSize: localFrontTireSize,
          rearTireSize: localRearTireSize,
          sourceChannel: 'local_seller',
          operator: currentUser.username,
          notes: localNotes.trim() || undefined,
          billNo: localBillNo,
          stockInNo: localStockInNo
        });

        if (success) {
          setLocalSuccessMsg(`Successfully registered and purchased fully-assembled scooter: ${localChassis.trim().toUpperCase()}!`);
          setLocalModel('');
          setLocalColor('');
          setLocalChassis('');
          setLocalMotor('');
          setLocalController('');
          setLocalNotes('');
          setLocalBillNo('');
          setLocalStockInNo('');
          onRefresh();
        } else {
          setLocalErrorMsg('Failed to register local purchase. Chassis number might already exist.');
        }
      } else {
        setLocalErrorMsg('Submit assembly callback is not configured.');
      }
    } catch (err) {
      setLocalErrorMsg('An error occurred during submission.');
    } finally {
      setLocalLoading(false);
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
          onClick={() => setActiveSubTab('local_scooters')}
          className={`flex-1 sm:flex-initial px-5 py-2.5 text-xs font-bold rounded-xl font-sans uppercase transition-all cursor-pointer ${
            activeSubTab === 'local_scooters' 
              ? 'bg-white text-slate-800 shadow-sm' 
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          🤝 Local Scooter Purchase
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

                {/* Bill Number & Stock IN Number (Only for IN Operations) */}
                {type === 'in' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 font-sans">
                        Bill Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. BILL-12345"
                        value={scooterBillNo}
                        onChange={(e) => setScooterBillNo(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-xs text-slate-800 focus:border-cyan-500 outline-none font-sans"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 font-sans">
                        Stock IN Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. STKIN-9876"
                        value={scooterStockInNo}
                        onChange={(e) => setScooterStockInNo(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-xs text-slate-800 focus:border-cyan-500 outline-none font-sans"
                        required
                      />
                    </div>
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

                {/* Warranty Configuration Section */}
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="block text-xs font-bold text-slate-600 uppercase tracking-wide font-sans">
                      🛡️ Under Manufacturer Warranty?
                    </span>
                    <div className="flex bg-slate-200 p-0.5 rounded-lg">
                      <button
                        type="button"
                        onClick={() => {
                          setImportIsUnderWarranty(true);
                        }}
                        className={`px-3 py-1 text-[10px] font-bold rounded-md transition cursor-pointer ${
                          importIsUnderWarranty ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setImportIsUnderWarranty(false);
                        }}
                        className={`px-3 py-1 text-[10px] font-bold rounded-md transition cursor-pointer ${
                          !importIsUnderWarranty ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        No
                      </button>
                    </div>
                  </div>

                  {importIsUnderWarranty && (
                    <div className="space-y-2 pt-2 border-t border-slate-200/60">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide font-sans">
                        Warranty Duration:
                      </label>
                      <select
                        value={importWarrantyDuration}
                        onChange={(e) => setImportWarrantyDuration(Number(e.target.value))}
                        className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 outline-none cursor-pointer font-sans focus:border-emerald-500"
                      >
                        <option value={6}>6 Months Warranty</option>
                        <option value={12}>12 Months (1 Year) Warranty</option>
                        <option value={18}>18 Months Warranty</option>
                        <option value={24}>24 Months (2 Years) Warranty</option>
                        <option value={36}>36 Months (3 Years) Warranty</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* Serial input method selection */}
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-3">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-200/60">
                    <span className="block text-xs font-bold text-slate-600 uppercase tracking-wide font-sans">
                      🔢 Serial Input Method:
                    </span>
                    <div className="flex bg-slate-200 p-0.5 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setImportInputMethod('range')}
                        className={`px-3 py-1 text-[10px] font-bold rounded-md transition cursor-pointer ${
                          importInputMethod === 'range' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        🔢 Range Series
                      </button>
                      <button
                        type="button"
                        onClick={() => setImportInputMethod('scan')}
                        className={`px-3 py-1 text-[10px] font-bold rounded-md transition flex items-center gap-1 cursor-pointer ${
                          importInputMethod === 'scan' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        📷 Scan QR/Codes
                      </button>
                    </div>
                  </div>

                  {importInputMethod === 'range' ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 font-sans">
                            Start No. Series
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. AL-2001"
                            value={impStartNo}
                            onChange={(e) => setImpStartNo(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 font-sans outline-none uppercase focus:border-emerald-500"
                            required={importInputMethod === 'range' && importIsUnderWarranty}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 font-sans">
                            End No. Series
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. AL-3000"
                            value={impEndNo}
                            onChange={(e) => setImpEndNo(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 font-sans outline-none uppercase focus:border-emerald-500"
                            required={importInputMethod === 'range' && importIsUnderWarranty}
                          />
                        </div>
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
                          required={importInputMethod === 'range'}
                          min="1"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                        <div>
                          <h4 className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5 font-sans">
                            <span>📊</span> Purchase Scanned Serials
                          </h4>
                          <p className="text-[10px] text-slate-400 mt-0.5 font-sans">
                            Register each purchased battery pack via barcode/QR scan.
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-xl font-black font-mono text-emerald-600 block leading-none">
                            {scannedImportSerials.length}
                          </span>
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider font-sans">Packs Scanned</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-2">
                        <button
                          type="button"
                          onClick={() => setShowImportScanner(true)}
                          className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-sans font-extrabold text-xs rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                        >
                          📷 Launch Camera QR Scanner
                        </button>

                        <div className="border border-slate-200 rounded-xl p-3 bg-white space-y-2">
                          <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider font-sans">
                            ✍️ Enter Serial Manually
                          </label>
                          <div className="flex gap-1.5">
                            <input
                              type="text"
                              value={directManualImportSerial}
                              onChange={(e) => {
                                setDirectManualImportSerial(e.target.value);
                                setDirectManualImportError(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddDirectManualImportSerial();
                                }
                              }}
                              placeholder="Type serial and click Add"
                              className="flex-1 text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                            />
                            <button
                              type="button"
                              onClick={() => handleAddDirectManualImportSerial()}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-4 py-2 rounded-xl font-extrabold font-sans cursor-pointer transition-colors"
                            >
                              ➕ Add
                            </button>
                          </div>
                          {directManualImportError && (
                            <p className="text-[10px] text-rose-600 font-bold font-sans mt-1">
                              ⚠️ {directManualImportError}
                            </p>
                          )}
                        </div>
                      </div>

                      {scannedImportSerials.length > 0 && (
                        <div className="bg-white border border-slate-200 p-3 rounded-xl space-y-2">
                          <span className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider font-sans">
                            Scanned Serial List (Click ❌ to remove):
                          </span>
                          <div className="space-y-1 max-h-[140px] overflow-y-auto pr-1">
                            {scannedImportSerials.map((serial, idx) => (
                              <div 
                                key={serial} 
                                className="flex justify-between items-center bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100 text-[11px] font-mono"
                              >
                                <span className="text-slate-800 font-semibold">
                                  {idx + 1}. {serial}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setScannedImportSerials(prev => {
                                      const updated = prev.filter(s => s !== serial);
                                      setImpQuantity(String(updated.length)); // Keep quantity in sync
                                      return updated;
                                    });
                                  }}
                                  className="text-[11px] text-rose-500 hover:text-rose-700 font-sans cursor-pointer p-0.5"
                                  title="Remove serial"
                                >
                                  ❌
                                </button>
                              </div>
                            ))}
                          </div>
                          <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">
                              Grand Total
                            </span>
                            <span className="text-xs font-black font-mono text-slate-800 bg-slate-100 px-2.5 py-1 rounded-md">
                              {scannedImportSerials.length} PACK(S) TOTAL
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 font-sans">
                      Bill Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. BILL-BAT-556"
                      value={batteryBillNo}
                      onChange={(e) => setBatteryBillNo(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-xs text-slate-800 focus:border-cyan-500 outline-none font-sans"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 font-sans">
                      Stock IN Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. STKIN-BAT-90"
                      value={batteryStockInNo}
                      onChange={(e) => setBatteryStockInNo(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-xs text-slate-800 focus:border-cyan-500 outline-none font-sans"
                      required
                    />
                  </div>
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 font-sans">
                      Bill Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. BILL-CHG-778"
                      value={chargerBillNo}
                      onChange={(e) => setChargerBillNo(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-xs text-slate-800 focus:border-red-500 outline-none font-sans"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 font-sans">
                      Stock IN Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. STKIN-CHG-12"
                      value={chargerStockInNo}
                      onChange={(e) => setChargerStockInNo(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-xs text-slate-800 focus:border-red-500 outline-none font-sans"
                      required
                    />
                  </div>
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

      {activeSubTab === 'local_scooters' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
          {/* Left Column: Local Seller Purchase form */}
          <div className="lg:col-span-5" id="log-local-scooter-panel">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm animate-fade-in" id="local-scooter-form-card">
              <div className="flex items-center gap-2 mb-4">
                <Store className="h-5 w-5 text-amber-600 animate-pulse" />
                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700 font-sans">
                  🤝 Domestic Local Purchase
                </h3>
              </div>

              <div className="p-3.5 mb-4 bg-amber-50 border border-amber-100 rounded-2xl text-xs text-amber-800 leading-relaxed font-sans font-medium">
                <p><strong>🤝 Local Seller Purchase:</strong> Register fully-assembled scooters acquired from domestic dealers. These units enter inventory directly, bypassing China parts container stock restrictions.</p>
              </div>

              {localErrorMsg && (
                <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 text-rose-600 text-xs font-sans font-medium rounded-2xl">
                  ⚠️ {localErrorMsg}
                </div>
              )}
              {localSuccessMsg && (
                <div className="mb-4 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-600 text-xs font-sans font-medium rounded-2xl">
                  ✨ {localSuccessMsg}
                </div>
              )}

              <form onSubmit={handleLocalPurchaseSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 font-sans">
                    Scooter Model Name
                  </label>
                  <select
                    value={localModel}
                    onChange={(e) => setLocalModel(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-base sm:text-sm text-slate-800 focus:border-amber-500 outline-none cursor-pointer font-sans"
                    required
                  >
                    <option value="">-- Choose Blueprint Model --</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 font-sans">
                    Color Variant
                  </label>
                  <select
                    value={localColor}
                    onChange={(e) => setLocalColor(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-base sm:text-sm text-slate-800 focus:border-amber-500 outline-none cursor-pointer font-sans"
                    disabled={!localModel}
                    required
                  >
                    <option value="">-- Select Color --</option>
                    {localModel && products.find(p => p.name === localModel)?.colors.map((c, idx) => (
                      <option key={idx} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-3.5 p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                  <span className="block text-[10px] font-bold text-amber-600 font-sans tracking-widest uppercase mb-1">
                    Scooter Identifiers
                  </span>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 font-sans">
                      Chassis Number (Unique)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. LOC-VOLT-CH88001"
                      value={localChassis}
                      onChange={(e) => setLocalChassis(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-base sm:text-xs text-slate-800 focus:border-amber-500 outline-none font-sans uppercase font-bold"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 font-sans">
                        Front Tyre Size
                      </label>
                      <select
                        value={localFrontTireSize}
                        onChange={(e) => setLocalFrontTireSize(e.target.value as '10-inch' | '12-inch')}
                        className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-base sm:text-xs text-slate-800 focus:border-amber-500 outline-none cursor-pointer font-sans"
                        required
                      >
                        <option value="10-inch">10-inches</option>
                        <option value="12-inch">12-inches</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 font-sans">
                        Rear Tyre Size
                      </label>
                      <select
                        value={localRearTireSize}
                        onChange={(e) => setLocalRearTireSize(e.target.value as '10-inch' | '12-inch')}
                        className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-base sm:text-xs text-slate-800 focus:border-amber-500 outline-none cursor-pointer font-sans"
                        required
                      >
                        <option value="10-inch">10-inches</option>
                        <option value="12-inch">12-inches</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 font-sans">
                        Motor Number
                      </label>
                      <input
                        type="text"
                        placeholder="MO-LOCAL-88"
                        value={localMotor}
                        onChange={(e) => setLocalMotor(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-base sm:text-xs text-slate-800 focus:border-amber-500 outline-none font-sans uppercase font-mono"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 font-sans">
                        Controller Number
                      </label>
                      <input
                        type="text"
                        placeholder="CO-LOCAL-88"
                        value={localController}
                        onChange={(e) => setLocalController(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-base sm:text-xs text-slate-800 focus:border-amber-500 outline-none font-sans uppercase font-mono"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 font-sans">
                        Bill Number <span className="text-amber-600">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. BILL-LOC-55"
                        value={localBillNo}
                        onChange={(e) => setLocalBillNo(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-base sm:text-xs text-slate-800 focus:border-amber-500 outline-none font-sans"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 font-sans">
                        Stock IN Number <span className="text-amber-600">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. STKIN-LOC-99"
                        value={localStockInNo}
                        onChange={(e) => setLocalStockInNo(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-base sm:text-xs text-slate-800 focus:border-amber-500 outline-none font-sans"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 font-sans">
                      Purchase & Seller Notes
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Purchased from Electro-Bikes Mumbai dealer"
                      value={localNotes}
                      onChange={(e) => setLocalNotes(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-base sm:text-xs text-slate-800 focus:border-amber-500 outline-none font-sans"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={localLoading}
                  className="w-full py-3.5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-sans font-bold text-sm sm:text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                >
                  <PlusCircle className="h-4.5 w-4.5" />
                  <span>{localLoading ? 'Processing...' : 'Register Local Purchase'}</span>
                </button>
              </form>
            </div>
          </div>

          {/* Right Column: Local Purchases Ledger */}
          <div className="lg:col-span-7" id="local-scooters-ledger-panel">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm h-full flex flex-col" id="local-scooters-ledger-card">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-amber-600" />
                  <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700 font-sans">
                    🤝 Local Scooter Purchase Ledger
                  </h3>
                </div>
                <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-2 py-1 rounded-full font-bold">
                  {scooterUnits.filter(u => u.chassisNo.startsWith('LOC') || u.createdOperator === 'admin').length} Units
                </span>
              </div>

              <div className="overflow-x-auto flex-1 max-h-[600px]">
                {scooterUnits.filter(u => u.chassisNo.startsWith('LOC') || u.createdOperator === 'admin').length === 0 ? (
                  <div className="text-center py-12 text-slate-400 font-sans text-xs">
                    No domestic locally purchased scooters logged in system yet.
                  </div>
                ) : (
                  <table className="w-full text-left text-xs font-sans">
                    <thead>
                      <tr className="text-[10px] font-bold text-slate-400 uppercase border-b border-slate-100">
                        <th className="py-2.5 px-2">Date Added</th>
                        <th className="py-2.5 px-2">Model</th>
                        <th className="py-2.5 px-2">Chassis</th>
                        <th className="py-2.5 px-2 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-slate-700 font-sans">
                      {[...scooterUnits]
                        .filter(u => u.chassisNo.startsWith('LOC') || u.createdOperator === 'admin')
                        .reverse()
                        .map((u) => (
                          <tr key={u.id} className="hover:bg-slate-50/50">
                            <td className="py-2.5 px-2 text-slate-400 font-mono text-[10px]">
                              {new Date(u.createdTimestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                            </td>
                            <td className="py-2.5 px-2 font-bold text-slate-800">
                              {u.modelName} <span className="text-[10px] text-slate-400 font-normal">({u.color})</span>
                            </td>
                            <td className="py-2.5 px-2 font-mono text-slate-600 font-semibold">
                              {u.chassisNo}
                            </td>
                            <td className="py-2.5 px-2 text-center">
                              <span className={`text-[9px] px-2.5 py-0.5 rounded-full font-bold uppercase ${
                                u.status === 'sold'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : u.status === 'hold'
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                    : 'bg-blue-50 text-blue-700 border border-blue-200'
                              }`}>
                                {u.status}
                              </span>
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

      {showImportScanner && (
        <div className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <QRSerialScanner
            title="🔋 Scan Purchased Battery Serials"
            type="battery"
            existingSerials={scannedImportSerials}
            allRegisteredSerials={allRegisteredBatterySerials}
            onConfirm={(serials) => {
              setScannedImportSerials(serials);
              setImpQuantity(String(serials.length));
              setShowImportScanner(false);
            }}
            onCancel={() => setShowImportScanner(false)}
          />
        </div>
      )}
    </div>
  );
}
