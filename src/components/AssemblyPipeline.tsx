import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Layers, Settings, ShoppingBag, Battery, ShieldCheck, Search, Calendar, 
  ChevronRight, Plus, Trash, PlusCircle, CheckCircle2, Sparkles, Filter, Info, AlertTriangle, Hammer, AlertCircle, User,
  LayoutGrid, Kanban
} from 'lucide-react';
import { ScooterUnit, Product, Buyer, User as SessionUser, StockLog, BatterySale, BatteryImport, ChargerSale, ChargerImport } from '../types';
import BatterySalesManager from './BatterySalesManager';
import ChargerSalesManager from './ChargerSalesManager';
import QRSerialScanner from './QRSerialScanner';
import { SearchableDropdown } from './SearchableDropdown';
import { formatUserMessage } from '../utils/errorHelper';

interface AssemblyPipelineProps {
  products: Product[];
  buyers?: Buyer[]; 
  scooterUnits: ScooterUnit[];
  stockLogs?: StockLog[];
  currentUser: SessionUser;
  onRefresh: () => void;
  onSubmitAssembly: (payload: any) => Promise<boolean>; 
  onAddBuyer?: (
    name: string,
    contact?: string,
    address?: string,
    gstNo?: string,
    addressProof?: string,
    buyerType?: 'retail' | 'wholesale'
  ) => Promise<boolean>;
  batterySales?: BatterySale[];
  batteryImports?: BatteryImport[];
  onSubmitBatterySale?: (data: {
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
  onSubmitBatteryImport?: (data: {
    batterySeries: string;
    startNo: string;
    endNo: string;
    quantity: number;
    supplierName?: string;
    containerId?: string;
    notes?: string;
  }) => Promise<boolean>;
  batterySeriesList?: string[];
  chargerSales?: ChargerSale[];
  chargerImports?: ChargerImport[];
  onSubmitChargerSale?: (data: {
    buyerName: string;
    chargerType: string;
    quantity: number;
    notes?: string;
    status?: 'sold' | 'hold';
  }) => Promise<boolean>;
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
  onReleaseChargerHold?: (id: string) => Promise<boolean>;
  onFinalizeChargerHold?: (id: string) => Promise<boolean>;
  onSelectDetailScooter?: (scooter: ScooterUnit) => void;
  onShowMobileNotification?: (message: string) => void;
}

export default function AssemblyPipeline({ 
  products, 
  buyers = [], 
  scooterUnits, 
  stockLogs = [],
  currentUser, 
  onRefresh, 
  onSubmitAssembly,
  onAddBuyer,
  batterySales = [],
  batteryImports = [],
  onSubmitBatterySale,
  onSubmitBatteryImport,
  batterySeriesList = [],
  chargerSales = [],
  chargerImports = [],
  onSubmitChargerSale,
  onSubmitChargerImport,
  chargerTypeList = [],
  onReleaseChargerHold,
  onFinalizeChargerHold,
  onSelectDetailScooter,
  onShowMobileNotification
}: AssemblyPipelineProps) {
  
  // Helper to pre-calculate default future dates
  const getFutureDate = (years: number) => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + years);
    return d.toISOString().split('T')[0];
  };

  const getFutureDateByMonths = (months: number) => {
    const d = new Date();
    d.setMonth(d.getMonth() + months);
    return d.toISOString().split('T')[0];
  };

  // Helper to compute remaining unassembled imported stock for a given model and color
  const getImportedStockRemaining = (model: string, color: string) => {
    if (!model || !color) return 0;
    const totalImported = stockLogs
      .filter(log => log.modelName === model && log.color === color && log.type === 'in')
      .reduce((sum, log) => sum + log.quantity, 0);

    const totalAssembled = scooterUnits.filter(
      u => u.modelName === model && u.color === color
    ).length;

    return Math.max(0, totalImported - totalAssembled);
  };

  // Nav tabs: Stage 1 (Production), Stage 3 (Sell / POS), Stage 2 (Optional Retrofit)
  const [activeStepTab, setActiveStepTab] = useState<'stage1' | 'stage3' | 'stage2'>(
    currentUser.role === 'salesperson' ? 'stage3' : 'stage1'
  );


  
  // Sub-navigation inside Stage 1 tab
  const [stage1SubTab, setStage1SubTab] = useState<'assemble_single' | 'assemble_bulk'>('assemble_bulk');

  // Status feedback
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  
  // Filters and Searching
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'sold' | 'hold'>('all');
  const [tireFilter, setTireFilter] = useState<'all' | '10-inch' | '12-inch'>('all');
  const [registryViewMode, setRegistryViewMode] = useState<'list' | 'grid' | 'board'>('list');

  // --- STAGE 1A FORM STATE: CORE FRAME ASSEMBLY ---
  const [s1Model, setS1Model] = useState('');
  const [s1Color, setS1Color] = useState('');
  const [s1Chassis, setS1Chassis] = useState('');
  const [s1Motor, setS1Motor] = useState('');
  const [s1Controller, setS1Controller] = useState('');
  const [s1FrontTireSize, setS1FrontTireSize] = useState<'10-inch' | '12-inch'>('12-inch');
  const [s1RearTireSize, setS1RearTireSize] = useState<'10-inch' | '12-inch'>('12-inch');
  const [s1Source, setS1Source] = useState<'container_freight' | 'local_seller'>('container_freight');

  // Dynamic list of bulk scooter slots
  const [s1BulkScooters, setS1BulkScooters] = useState<{ chassisNo: string; motorNo: string; controllerNo: string }[]>([
    { chassisNo: '', motorNo: '', controllerNo: '' }
  ]);

  const handleBulkScooterChange = (index: number, field: 'chassisNo' | 'motorNo' | 'controllerNo', value: string) => {
    const updated = [...s1BulkScooters];
    updated[index][field] = value;
    setS1BulkScooters(updated);
  };

  const addBulkScooterSlot = () => {
    setS1BulkScooters([...s1BulkScooters, { chassisNo: '', motorNo: '', controllerNo: '' }]);
  };

  const removeBulkScooterSlot = (index: number) => {
    if (s1BulkScooters.length > 1) {
      setS1BulkScooters(s1BulkScooters.filter((_, i) => i !== index));
    }
  };

  // --- STAGE 1B FORM STATE: POST-ASSEMBLY WAREHOUSE BATTERIES PREP ---
  const [selectedPrepScooterId, setSelectedPrepScooterId] = useState('');
  const [prepBatteries, setPrepBatteries] = useState<string[]>(['']);
  const [prepBatteryWarranties, setPrepBatteryWarranties] = useState<boolean[]>([true]);
  const [prepBatteryWarrantyMonths, setPrepBatteryWarrantyMonths] = useState<number[]>([12]);

  // --- STAGE 1C FORM STATE: BATTERY IMPORT FROM ABROAD ---
  const [impBatterySeries, setImpBatterySeries] = useState('Alpha');
  const [impStartNo, setImpStartNo] = useState('');
  const [impEndNo, setImpEndNo] = useState('');
  const [impQuantity, setImpQuantity] = useState('');
  const [impSupplier, setImpSupplier] = useState('');
  const [impContainerId, setImpContainerId] = useState('');
  const [impNotes, setImpNotes] = useState('');
  const [impSaving, setImpSaving] = useState(false);
  const [impStatus, setImpStatus] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // --- STAGE 3 FORM STATE: SALES POS CHECKOUT ---
  const [selectedPOSScooterId, setSelectedPOSScooterId] = useState('');
  const [s3BuyerName, setS3BuyerName] = useState('');
  const [s3BuyerContact, setS3BuyerContact] = useState('');
  const [s3BuyerAddress, setS3BuyerAddress] = useState('');
  const [s3Price, setS3Price] = useState('');
  const [s3BillNo, setS3BillNo] = useState('');
  const [s3DeliveryChallanNo, setS3DeliveryChallanNo] = useState('');

  // Integrated retail sales options
  const [s3ModelSelected, setS3ModelSelected] = useState('');
  const [posIncludeBattery, setPosIncludeBattery] = useState(true);
  const [posBatteryWarrantyActive, setPosBatteryWarrantyActive] = useState(true);
  const [posBatteryWarrantyDuration, setPosBatteryWarrantyDuration] = useState(12); // Default 12 (6+6) months
  const [posIncludeCharger, setPosIncludeCharger] = useState(true);
  const [posChargerType, setPosChargerType] = useState('60V Charger');
  const [posChargerSerial, setPosChargerSerial] = useState('');
  const [posChargerWarrantyActive, setPosChargerWarrantyActive] = useState(true);
  const [posChargerWarrantyDuration, setPosChargerWarrantyDuration] = useState(12); // Default 12 months
  const [posScooterWarrantyDuration, setPosScooterWarrantyDuration] = useState(12); // Default 12 months
  const [posWarrantyTermsAccepted, setPosWarrantyTermsAccepted] = useState(true);

  // Scanning overlay state for individual slots (Stage 1 / Stage 3)
  const [assemblyScannerTarget, setAssemblyScannerTarget] = useState<{
    type: 'battery_prep' | 'battery_checkout' | 'charger_checkout';
    index?: number;
  } | null>(null);

  // Collect registered battery and charger serials to prevent duplicates
  const allRegisteredBatterySerialsInAssembly = useMemo(() => {
    const list: string[] = [];
    if (scooterUnits && Array.isArray(scooterUnits)) {
      scooterUnits.forEach(scoot => {
        if (scoot.batterySerials) {
          list.push(...scoot.batterySerials);
        }
      });
    }
    if (batterySales && Array.isArray(batterySales)) {
      batterySales.forEach(sale => {
        if (sale.serialNumbers) {
          list.push(...sale.serialNumbers);
        }
      });
    }
    if (batteryImports && Array.isArray(batteryImports)) {
      batteryImports.forEach(imp => {
        if (imp.serialNumbers) {
          list.push(...imp.serialNumbers);
        }
      });
    }
    return list;
  }, [scooterUnits, batterySales, batteryImports]);

  const allRegisteredChargerSerialsInAssembly = useMemo(() => {
    const list: string[] = [];
    if (scooterUnits && Array.isArray(scooterUnits)) {
      scooterUnits.forEach(scoot => {
        if (scoot.chargerSerial) {
          list.push(scoot.chargerSerial);
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
    if (chargerImports && Array.isArray(chargerImports)) {
      chargerImports.forEach(imp => {
        if (imp.serialNumbers) {
          list.push(...imp.serialNumbers);
        }
      });
    }
    return list;
  }, [scooterUnits, chargerSales, chargerImports]);
  
  const [posHasPreassignedBatteries, setPosHasPreassignedBatteries] = useState(false);
  const [posEditPreassignedBatteries, setPosEditPreassignedBatteries] = useState(false);
  
  const [s4Batteries, setS4Batteries] = useState<string[]>(['']); 
  const [s4BatteryWarranties, setS4BatteryWarranties] = useState<boolean[]>([true]); 
  const [s4BatteryWarrantyMonths, setS4BatteryWarrantyMonths] = useState<number[]>([12]); 
  
  // Scooter & general warranty details inside Stage 3 checkout
  const [s5ScooterWarrantyActive, setS5ScooterWarrantyActive] = useState(true);
  const [s5ScooterExpiry, setS5ScooterExpiry] = useState(getFutureDateByMonths(12)); 
  const [s5BatteryWarrantyActive, setS5BatteryWarrantyActive] = useState(true);
  const [s5BatteryExpiry, setS5BatteryExpiry] = useState(getFutureDateByMonths(12)); 
  const [s5Notes, setS5Notes] = useState('');

  // Auto calculate expiration dates based on custom warranty months
  useEffect(() => {
    const dateStr = getFutureDateByMonths(posScooterWarrantyDuration);
    setS5ScooterExpiry(dateStr);
  }, [posScooterWarrantyDuration]);

  // Auto-populate contact and address info when standard buyer is selected
  useEffect(() => {
    const trimmed = s3BuyerName.trim();
    if (!trimmed) {
      setS3BuyerContact('');
      setS3BuyerAddress('');
      return;
    }
    const selectedBuyer = buyers.find(b => b.name.toLowerCase() === trimmed.toLowerCase());
    if (selectedBuyer) {
      setS3BuyerContact(selectedBuyer.contact || '');
      setS3BuyerAddress(selectedBuyer.address || '');
    }
  }, [s3BuyerName, buyers]);

  useEffect(() => {
    const dateStr = getFutureDateByMonths(posBatteryWarrantyDuration);
    setS5BatteryExpiry(dateStr);
    // Sync active array of battery months to match the chosen global battery warranty duration
    setS4BatteryWarrantyMonths(prev => prev.map(() => posBatteryWarrantyDuration));
  }, [posBatteryWarrantyDuration]);

  // --- STAGE 2 FORM STATE: RETROFIT CUSTOMIZER (OPTIONAL) ---
  const [selectedCustomizeScooterId, setSelectedCustomizeScooterId] = useState('');
  const [customizeModel, setCustomizeModel] = useState('');
  const [customizeColor, setCustomizeColor] = useState('');
  const [customizeTireSize, setCustomizeTireSize] = useState<string>('12-inch');
  const [customizeFrontTireSize, setCustomizeFrontTireSize] = useState<'10-inch' | '12-inch'>('12-inch');
  const [customizeRearTireSize, setCustomizeRearTireSize] = useState<'10-inch' | '12-inch'>('12-inch');
  const [customizeChassisNo, setCustomizeChassisNo] = useState('');
  const [customizeMotorNo, setCustomizeMotorNo] = useState('');
  const [customizeControllerNo, setCustomizeControllerNo] = useState('');
  const [customizeNotes, setCustomizeNotes] = useState('');

  // --- DIRECT NEW BUYER REGISTRATION FORM STATE (In Checkout Section) ---
  const [showInlineAddBuyer, setShowInlineAddBuyer] = useState(false);
  const [inlineBuyerName, setInlineBuyerName] = useState('');
  const [inlineBuyerContact, setInlineBuyerContact] = useState('');
  const [inlineBuyerAddress, setInlineBuyerAddress] = useState('');
  const [inlineBuyerGstNo, setInlineBuyerGstNo] = useState('');
  const [inlineBuyerAddressProof, setInlineBuyerAddressProof] = useState('');
  const [inlineBuyerType, setInlineBuyerType] = useState<'retail' | 'wholesale'>('retail');
  const [inlineBuyerSaving, setInlineBuyerSaving] = useState(false);

  const handleInlineBuyerAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inlineBuyerName.trim()) return;
    setInlineBuyerSaving(true);
    if (onAddBuyer) {
      const ok = await onAddBuyer(
        inlineBuyerName.trim(),
        inlineBuyerContact.trim() || undefined,
        inlineBuyerAddress.trim() || undefined,
        inlineBuyerGstNo.trim() || undefined,
        inlineBuyerAddressProof.trim() || undefined,
        inlineBuyerType
      );
      if (ok) {
        setS3BuyerName(inlineBuyerName.trim());
        setS3BuyerContact(inlineBuyerContact.trim());
        triggerAlert('success', `Buyer "${inlineBuyerName}" registered and auto-selected!`);
        setInlineBuyerName('');
        setInlineBuyerContact('');
        setInlineBuyerAddress('');
        setInlineBuyerGstNo('');
        setInlineBuyerAddressProof('');
        setInlineBuyerType('retail');
        setShowInlineAddBuyer(false);
      } else {
        triggerAlert('error', 'Failed to register buyer. Name might already exist.');
      }
    } else {
      triggerAlert('error', 'Buyer registration callback not provided.');
    }
    setInlineBuyerSaving(false);
  };

  // --- BULK EXTRA STATES FOR WHOLESALE LARGE DATA ENTRY ---
  // Bulk Production Registration (Stage 1)
  const [s1IsBulk, setS1IsBulk] = useState(false);
  const [s1BulkModeType, setS1BulkModeType] = useState<'csv' | 'separate'>('csv');
  const [s1BulkCSV, setS1BulkCSV] = useState('');
  const [s1BulkChassisList, setS1BulkChassisList] = useState('');
  const [s1BulkMotorList, setS1BulkMotorList] = useState('');
  const [s1BulkControllerList, setS1BulkControllerList] = useState('');

  // Bulk POS Sales Checkout (Stage 3)
  const [s3IsBulk, setS3IsBulk] = useState(false);
  const [s3Mode, setS3Mode] = useState<'single' | 'bulk' | 'battery' | 'charger' | 'assign_battery'>('single');
  const [s3BulkModel, setS3BulkModel] = useState('');
  const [s3BulkColor, setS3BulkColor] = useState('');
  const [s3BulkChassisPasted, setS3BulkChassisPasted] = useState('');
  const [s3BulkSelectedIds, setS3BulkSelectedIds] = useState<string[]>([]);
  const [s3BulkBatteriesRaw, setS3BulkBatteriesRaw] = useState('');
  const [s3BulkBatteriesPerScooter, setS3BulkBatteriesPerScooter] = useState(1);

  // Set default model color for bulk POS when products change
  React.useEffect(() => {
    if (products.length > 0) {
      setS3BulkModel(products[0].name);
      if (products[0].colors.length > 0) {
        setS3BulkColor(products[0].colors[0]);
      }
    }
  }, [products]);

  // Force manufacturer to only use assign_battery mode in Stage 3
  React.useEffect(() => {
    if (currentUser?.role === 'manufacturer' && s3Mode !== 'assign_battery') {
      setS3Mode('assign_battery');
    }
  }, [currentUser, s3Mode]);

  // Adjust bulk POS color when model changes
  const handleBulkPOSModelChange = (modelName: string) => {
    setS3BulkModel(modelName);
    const prod = products.find(p => p.name === modelName);
    if (prod && prod.colors.length > 0) {
      setS3BulkColor(prod.colors[0]);
    } else {
      setS3BulkColor('');
    }
    // Reset selection when changing scooter type
    setS3BulkSelectedIds([]);
  };

  // Parsed bulk creation items
  const parsedBulkCreationItems = React.useMemo(() => {
    const items: { chassisNo: string; motorNo: string; controllerNo: string; valid: boolean; error?: string }[] = [];
    
    if (s1BulkModeType === 'csv') {
      if (!s1BulkCSV.trim()) return [];
      const lines = s1BulkCSV.split('\n');
      lines.forEach((line) => {
        const clean = line.trim();
        if (!clean) return;
        
        // Split by comma, tab, or semicolon
        const parts = clean.split(/[,\t;]+/);
        const chassis = (parts[0] || '').trim().toUpperCase();
        const motor = (parts[1] || '').trim().toUpperCase();
        const controller = (parts[2] || '').trim().toUpperCase();
        
        const valid = !!chassis && !!motor && !!controller;
        items.push({
          chassisNo: chassis,
          motorNo: motor,
          controllerNo: controller,
          valid,
          error: !chassis ? 'Missing Chassis' : (!motor ? 'Missing Motor' : (!controller ? 'Missing Controller' : undefined))
        });
      });
    } else {
      const chassisLines = s1BulkChassisList.split('\n').map(l => l.trim().toUpperCase()).filter(Boolean);
      const motorLines = s1BulkMotorList.split('\n').map(l => l.trim().toUpperCase()).filter(Boolean);
      const controllerLines = s1BulkControllerList.split('\n').map(l => l.trim().toUpperCase()).filter(Boolean);
      
      const maxLen = Math.max(chassisLines.length, motorLines.length, controllerLines.length);
      if (maxLen === 0) return [];
      for (let i = 0; i < maxLen; i++) {
        const chassis = chassisLines[i] || '';
        const motor = motorLines[i] || '';
        const controller = controllerLines[i] || '';
        const valid = !!chassis && !!motor && !!controller;
        items.push({
          chassisNo: chassis,
          motorNo: motor,
          controllerNo: controller,
          valid,
          error: !chassis ? 'Missing Chassis' : (!motor ? 'Missing Motor' : (!controller ? 'Missing Controller' : undefined))
        });
      }
    }
    return items;
  }, [s1BulkModeType, s1BulkCSV, s1BulkChassisList, s1BulkMotorList, s1BulkControllerList]);



  // Filter stock for bulk sales
  const availableBulkStock = React.useMemo(() => {
    if (!s3BulkModel || !s3BulkColor) return [];
    return scooterUnits.filter(u => (u.status === 'available' || u.status === 'hold') && u.modelName === s3BulkModel && u.color === s3BulkColor);
  }, [scooterUnits, s3BulkModel, s3BulkColor]);

  // Handle chassis pasting auto-selection
  React.useEffect(() => {
    if (!s3IsBulk || !s3BulkChassisPasted) return;
    const pastedList = s3BulkChassisPasted
      .split(/[\n,;\t\r]+/)
      .map(s => s.trim().toUpperCase())
      .filter(Boolean);
    
    if (pastedList.length === 0) return;

    // Find scooter IDs matching the pasted chassis numbers
    const matchedIds = availableBulkStock
      .filter(u => pastedList.includes(u.chassisNo))
      .map(u => u.id);

    setS3BulkSelectedIds(matchedIds);
  }, [s3BulkChassisPasted, availableBulkStock, s3IsBulk]);

  // Bulk sales battery sequential allocation
  const bulkPOSBatteryAllocation = React.useMemo(() => {
    const allocation: { scooterId: string; chassisNo: string; preassigned: boolean; batteries: string[]; error?: string }[] = [];
    const pastedBatteries = s3BulkBatteriesRaw
      .split(/[\n,;\t\r]+/)
      .map(b => b.trim().toUpperCase())
      .filter(Boolean);

    let pastedIndex = 0;

    s3BulkSelectedIds.forEach((id) => {
      const unit = scooterUnits.find(u => u.id === id);
      if (!unit) return;

      if (unit.batterySerials && unit.batterySerials.length > 0) {
        allocation.push({
          scooterId: id,
          chassisNo: unit.chassisNo,
          preassigned: true,
          batteries: unit.batterySerials
        });
      } else {
        const numNeeded = Number(s3BulkBatteriesPerScooter) || 1;
        const allocated: string[] = [];
        for (let k = 0; k < numNeeded; k++) {
          if (pastedIndex < pastedBatteries.length) {
            allocated.push(pastedBatteries[pastedIndex]);
            pastedIndex++;
          }
        }
        allocation.push({
          scooterId: id,
          chassisNo: unit.chassisNo,
          preassigned: false,
          batteries: allocated,
          error: allocated.length < numNeeded ? `Needs ${numNeeded - allocated.length} more battery serial(s)` : undefined
        });
      }
    });

    return { allocation, unusedBatteries: pastedBatteries.slice(pastedIndex) };
  }, [s3BulkSelectedIds, scooterUnits, s3BulkBatteriesRaw, s3BulkBatteriesPerScooter]);

  // Bulk POS checkout submit
  const handleStage3BulkSubmit = async (e?: React.FormEvent, submitStatus: 'sold' | 'hold' = 'sold') => {
    if (e) e.preventDefault();
    if (s3BulkSelectedIds.length === 0) {
      triggerAlert('error', `Please select at least one scooter frame to ${submitStatus === 'hold' ? 'hold' : 'sell'}.`);
      return;
    }
    if (!s3BuyerName) {
      triggerAlert('error', `Buyer Name is required for bulk wholesale ${submitStatus === 'hold' ? 'holding' : 'sales'}.`);
      return;
    }
    if (submitStatus === 'sold' && !s3BillNo.trim()) {
      triggerAlert('error', 'Bill Number is required to finalize sale.');
      return;
    }
    if (submitStatus === 'sold' && !s3DeliveryChallanNo.trim()) {
      triggerAlert('error', 'Chalan Number is required to finalize sale.');
      return;
    }

    setLoading(true);
    try {
      // Auto-register new buyer if they are not in the database
      const finalBuyerName = s3BuyerName.trim();
      if (finalBuyerName) {
        const buyerExists = buyers.some(b => b.name.toLowerCase() === finalBuyerName.toLowerCase());
        if (!buyerExists && onAddBuyer) {
          await onAddBuyer(finalBuyerName, s3BuyerContact.trim() || undefined, s3BuyerAddress.trim() || undefined, undefined, undefined, 'wholesale');
        }
      }

      const salesPayload = bulkPOSBatteryAllocation.allocation.map(alloc => ({
        id: alloc.scooterId,
        batterySerials: alloc.preassigned ? [] : alloc.batteries,
        batteryWarrantyFlags: alloc.preassigned ? [] : alloc.batteries.map(() => true),
        batteryWarrantyMonths: alloc.preassigned ? [] : alloc.batteries.map(() => 12)
      }));

      const res = await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/scooter-units/bulk-pos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyerName: s3BuyerName,
          buyerContact: s3BuyerContact,
          salesPrice: s3Price ? Number(s3Price) : undefined,
          scooterWarrantyStatus: s5ScooterWarrantyActive ? 'Active' : 'None',
          scooterWarrantyExpiry: s5ScooterWarrantyActive ? s5ScooterExpiry : undefined,
          batteryWarrantyStatus: 'None',
          warrantyNotes: s5Notes,
          operator: currentUser.username,
          sales: salesPayload,
          status: submitStatus,
          salesBillNo: s3BillNo.trim(),
          deliveryChallanNo: s3DeliveryChallanNo.trim()
        })
      });

      const data = await res.json();
      if (res.ok) {
        if (submitStatus === 'hold') {
          triggerAlert('success', `Wholesale Reservation Success! Placed ${data.count} scooters on hold under buyer ${s3BuyerName}.`);
        } else {
          triggerAlert('success', `Wholesale Sale Finalized! Dispatched ${data.count} scooters, logged transactions, and updated Sheets.`);
        }
        setS3BulkSelectedIds([]);
        setS3BulkChassisPasted('');
        setS3BulkBatteriesRaw('');
        setS3BuyerName('');
        setS3BuyerContact('');
        setS3BuyerAddress('');
        setS3Price('');
        setS3BillNo('');
        setS3DeliveryChallanNo('');
        setS5Notes('');
        onRefresh();
      } else {
        triggerAlert('error', data.error || `Bulk POS ${submitStatus === 'hold' ? 'hold' : 'sale'} failed.`);
      }
    } catch (err) {
      triggerAlert('error', `Network error during bulk ${submitStatus === 'hold' ? 'hold' : 'checkout'}.`);
    } finally {
      setLoading(false);
    }
  };

  // Change s1Color when model changes
  const handleModelChange = (modelName: string) => {
    setS1Model(modelName);
    const prod = products.find(p => p.name === modelName);
    if (prod && prod.colors.length > 0) {
      setS1Color(prod.colors[0]);
    } else {
      setS1Color('');
    }
  };

  // Battery serials for checkout (Stage 3)
  const handleBatterySerialChange = (index: number, val: string) => {
    const updated = [...s4Batteries];
    updated[index] = val.trim().toUpperCase();
    setS4Batteries(updated);
  };

  const handleBatteryWarrantyChange = (index: number, val: boolean) => {
    const updated = [...s4BatteryWarranties];
    updated[index] = val;
    setS4BatteryWarranties(updated);
  };

  const handleBatteryWarrantyMonthsChange = (index: number, val: number) => {
    const updated = [...s4BatteryWarrantyMonths];
    updated[index] = val;
    setS4BatteryWarrantyMonths(updated);
  };

  const addBatterySlot = () => {
    if (s4Batteries.length < 6) {
      setS4Batteries([...s4Batteries, '']);
      setS4BatteryWarranties([...s4BatteryWarranties, true]);
      setS4BatteryWarrantyMonths([...s4BatteryWarrantyMonths, 12]);
    }
  };

  const removeBatterySlot = (index: number) => {
    if (s4Batteries.length > 1) {
      setS4Batteries(s4Batteries.filter((_, i) => i !== index));
      setS4BatteryWarranties(s4BatteryWarranties.filter((_, i) => i !== index));
      setS4BatteryWarrantyMonths(s4BatteryWarrantyMonths.filter((_, i) => i !== index));
    }
  };

  // Prep batteries for Stage 1B (Warehouse prep)
  const handlePrepBatteryChange = (index: number, val: string) => {
    const updated = [...prepBatteries];
    updated[index] = val.trim().toUpperCase();
    setPrepBatteries(updated);
  };

  const handlePrepBatteryWarrantyChange = (index: number, val: boolean) => {
    const updated = [...prepBatteryWarranties];
    updated[index] = val;
    setPrepBatteryWarranties(updated);
  };

  const handlePrepBatteryMonthsChange = (index: number, val: number) => {
    const updated = [...prepBatteryWarrantyMonths];
    updated[index] = val;
    setPrepBatteryWarrantyMonths(updated);
  };

  const addPrepBatterySlot = () => {
    if (prepBatteries.length < 6) {
      setPrepBatteries([...prepBatteries, '']);
      setPrepBatteryWarranties([...prepBatteryWarranties, true]);
      setPrepBatteryWarrantyMonths([...prepBatteryWarrantyMonths, 12]);
    }
  };

  const removePrepBatterySlot = (index: number) => {
    if (prepBatteries.length > 1) {
      setPrepBatteries(prepBatteries.filter((_, i) => i !== index));
      setPrepBatteryWarranties(prepBatteryWarranties.filter((_, i) => i !== index));
      setPrepBatteryWarrantyMonths(prepBatteryWarrantyMonths.filter((_, i) => i !== index));
    }
  };

  // Clear feed-back alerts helper
  const triggerAlert = (type: 'success' | 'error', textOrError: any) => {
    if (type === 'success') {
      setSuccessMsg(String(textOrError));
      setErrorMsg('');
    } else {
      const isAdmin = currentUser.role === 'admin';
      const formatted = formatUserMessage(textOrError, isAdmin);
      setErrorMsg(formatted);
      setSuccessMsg('');
    }
    // Auto clear after 6 seconds
    setTimeout(() => {
      setSuccessMsg('');
      setErrorMsg('');
    }, 6000);
  };

  // --- ACTIONS ---

  // Stage 1A: Register New Scooter (Single Assembly)
  const handleStage1SingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!s1Model || !s1Color || !s1Chassis || !s1Motor || !s1Controller) {
      triggerAlert('error', 'Please fill in all Stage 1 hardware fields.');
      return;
    }

    setLoading(true);
    const success = await onSubmitAssembly({
      actionType: 'create_stage1',
      modelName: s1Model,
      color: s1Color,
      chassisNo: s1Chassis.trim().toUpperCase(),
      motorNo: s1Motor.trim().toUpperCase(),
      controllerNo: s1Controller.trim().toUpperCase(),
      frontTireSize: s1FrontTireSize,
      rearTireSize: s1RearTireSize,
      sourceChannel: 'container_freight',
      operator: currentUser.username
    });

    if (success) {
      triggerAlert('success', `Successfully registered assembled frame ${s1Chassis.trim().toUpperCase()}! Standard stock IN logged.`);
      setS1Chassis('');
      setS1Motor('');
      setS1Controller('');
      onRefresh();
    } else {
      triggerAlert('error', 'Chassis registration failed. Verify that the Chassis number is unique.');
    }
    setLoading(false);
  };

  // Stage 1A: Register New Scooter (Bulk Assembly)
  const handleStage1BulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!s1Model || !s1Color) {
      triggerAlert('error', 'Please select a Scooter Model and Color Variant.');
      return;
    }

    const activeItems = s1BulkScooters.filter(item => item.chassisNo.trim() || item.motorNo.trim() || item.controllerNo.trim());
    if (activeItems.length === 0) {
      triggerAlert('error', 'Please add at least one Scooter with completed identifiers.');
      return;
    }

    const invalidItem = activeItems.find(item => !item.chassisNo.trim() || !item.motorNo.trim() || !item.controllerNo.trim());
    if (invalidItem) {
      triggerAlert('error', 'Incomplete entry. Chassis, Motor, and Controller numbers are all required for every slot.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/scooter-units/bulk-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelName: s1Model,
          color: s1Color,
          sourceChannel: 'container_freight',
          frontTireSize: s1FrontTireSize,
          rearTireSize: s1RearTireSize,
          items: activeItems.map(item => ({
            chassisNo: item.chassisNo.trim().toUpperCase(),
            motorNo: item.motorNo.trim().toUpperCase(),
            controllerNo: item.controllerNo.trim().toUpperCase()
          })),
          operator: currentUser.username
        })
      });

      const data = await res.json();
      if (res.ok) {
        triggerAlert('success', `Bulk Assembly Success! Registered ${data.count} units of ${s1Model} (${s1Color}) in warehouse inventory.`);
        setS1BulkScooters([{ chassisNo: '', motorNo: '', controllerNo: '' }]);
        onRefresh();
      } else {
        triggerAlert('error', data.error || 'Bulk assembly failed.');
      }
    } catch (err) {
      triggerAlert('error', 'Network error registering bulk scooters.');
    } finally {
      setLoading(false);
    }
  };



  // Stage 1B: Assign Batteries (Pre-Sale Prep)
  const handleStage1BatteriesSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPrepScooterId) {
      triggerAlert('error', 'Please choose an available scooter frame.');
      return;
    }

    const cleanPrepBatteries: string[] = [];
    const cleanPrepWarranties: boolean[] = [];
    const cleanPrepMonths: number[] = [];

    prepBatteries.forEach((b, idx) => {
      const months = prepBatteryWarrantyMonths[idx] !== undefined ? prepBatteryWarrantyMonths[idx] : 12;
      const serial = b.trim().toUpperCase();
      if (months > 0 && serial) {
        cleanPrepBatteries.push(serial);
        cleanPrepWarranties.push(true);
        cleanPrepMonths.push(months);
      }
    });

    setLoading(true);
    const success = await onSubmitAssembly({
      id: selectedPrepScooterId,
      actionType: 'direct_update', // Overwrite battery configuration directly on server
      batterySerials: cleanPrepBatteries,
      batteryWarrantyFlags: cleanPrepWarranties,
      batteryWarrantyMonths: cleanPrepMonths,
      operator: currentUser.username
    });

    if (success) {
      triggerAlert('success', `Success: Allocated ${cleanPrepBatteries.length} batteries to the physical scooter in warehouse.`);
      setSelectedPrepScooterId('');
      setPrepBatteries(['']);
      setPrepBatteryWarranties([true]);
      setPrepBatteryWarrantyMonths([12]);
      onRefresh();
    } else {
      triggerAlert('error', 'Failed to update battery allocation.');
    }
    setLoading(false);
  };

  // Stage 1C: Import Batteries
  const handleBatteryImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!impBatterySeries || !impQuantity) {
      triggerAlert('error', 'Please fill in all required battery details.');
      return;
    }

    setLoading(true);
    const success = await onSubmitBatteryImport?.({
      batterySeries: impBatterySeries,
      startNo: impStartNo.trim() || 'N/A',
      endNo: impEndNo.trim() || 'N/A',
      quantity: Number(impQuantity),
      supplierName: impSupplier,
      containerId: impContainerId,
      notes: impNotes
    });

    setLoading(false);
    if (success) {
      triggerAlert('success', `Success: Logged import of ${impQuantity} ${impBatterySeries} Series batteries from abroad.`);
      setImpStartNo('');
      setImpEndNo('');
      setImpQuantity('');
      setImpSupplier('');
      setImpContainerId('');
      setImpNotes('');
      onRefresh();
    } else {
      triggerAlert('error', 'Failed to register battery import.');
    }
  };

  const getS4BatteryExpiryDate = () => {
    const activeMonths = s4BatteryWarrantyMonths.filter((m, i) => s4Batteries[i] && s4BatteryWarranties[i]);
    const maxMonths = activeMonths.length > 0 ? Math.max(...activeMonths) : 12;
    const d = new Date();
    d.setMonth(d.getMonth() + maxMonths);
    return d.toISOString().split('T')[0];
  };

  // Stage 3: POS Checkout & Deliver
  const handleStage3Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPOSScooterId) {
      triggerAlert('error', 'Please select a scooter chassis.');
      return;
    }
    if (!s3BuyerName) {
      triggerAlert('error', 'Buyer Name is required to finalize transaction.');
      return;
    }
    if (!s3BillNo.trim()) {
      triggerAlert('error', 'Bill Number is required to finalize transaction.');
      return;
    }
    if (!s3DeliveryChallanNo.trim()) {
      triggerAlert('error', 'Chalan Number is required to finalize transaction.');
      return;
    }
    if (!posWarrantyTermsAccepted) {
      triggerAlert('error', 'Please accept the terms and conditions of the warranty to continue.');
      return;
    }

    setLoading(true);
    
    // Auto-register new buyer if they are not in the database
    const finalBuyerName = s3BuyerName.trim();
    if (finalBuyerName) {
      const buyerExists = buyers.some(b => b.name.toLowerCase() === finalBuyerName.toLowerCase());
      if (!buyerExists && onAddBuyer) {
        await onAddBuyer(finalBuyerName, s3BuyerContact.trim() || undefined, s3BuyerAddress.trim() || undefined, undefined, undefined, 'retail');
      }
    }

    const scooterWarrantyStatus = s5ScooterWarrantyActive ? 'Active' : 'None';
    const cleanBatteries = posIncludeBattery ? s4Batteries.filter(b => b && b.trim() !== '') : [];
    const cleanBatteryFlags = posIncludeBattery ? s4BatteryWarranties : [];
    const cleanBatteryMonths = posIncludeBattery ? s4BatteryWarrantyMonths.map(() => posBatteryWarrantyActive ? posBatteryWarrantyDuration : 0) : [];

    const success = await onSubmitAssembly({
      id: selectedPOSScooterId,
      actionType: 'pos_stage3_4',
      buyerName: s3BuyerName,
      buyerContact: s3BuyerContact,
      salesPrice: s3Price ? Number(s3Price) : undefined,
      salesBillNo: s3BillNo.trim(),
      deliveryChallanNo: s3DeliveryChallanNo.trim(),
      batterySerials: cleanBatteries,
      batteryWarrantyFlags: cleanBatteryFlags,
      batteryWarrantyMonths: cleanBatteryMonths,
      scooterWarrantyStatus,
      scooterWarrantyExpiry: s5ScooterWarrantyActive ? getFutureDateByMonths(posScooterWarrantyDuration) : undefined,
      batteryWarrantyStatus: (posIncludeBattery && posBatteryWarrantyActive && cleanBatteries.length > 0) ? 'Active' : 'None',
      batteryWarrantyExpiry: (posIncludeBattery && posBatteryWarrantyActive && cleanBatteries.length > 0) ? getFutureDateByMonths(posBatteryWarrantyDuration) : undefined,
      
      // Integrated Charger Options
      chargerIncluded: posIncludeCharger,
      chargerType: posIncludeCharger ? posChargerType : undefined,
      chargerSerial: posIncludeCharger ? posChargerSerial : undefined,
      chargerWarrantyActive: posIncludeCharger ? posChargerWarrantyActive : false,
      chargerWarrantyMonths: (posIncludeCharger && posChargerWarrantyActive) ? posChargerWarrantyDuration : 0,
      
      scooterWarrantyMonths: posScooterWarrantyDuration,
      scooterWarrantyActive: s5ScooterWarrantyActive,
      
      warrantyNotes: s5Notes,
      operator: currentUser.username
    });

    if (success) {
      triggerAlert('success', `POS Completed! Dispatch logged and scooter warranty active.`);
      setS3BuyerName('');
      setS3BuyerContact('');
      setS3BuyerAddress('');
      setS3Price('');
      setS3BillNo('');
      setS3DeliveryChallanNo('');
      setS4Batteries(['']);
      setS4BatteryWarranties([true]);
      setS4BatteryWarrantyMonths([12]);
      setS5ScooterWarrantyActive(true);
      setS5BatteryWarrantyActive(true);
      setS5Notes('');
      setSelectedPOSScooterId('');
      setS3ModelSelected('');
      setPosIncludeBattery(true);
      setPosBatteryWarrantyActive(true);
      setPosBatteryWarrantyDuration(12);
      setPosIncludeCharger(true);
      setPosChargerType('60V Charger');
      setPosChargerSerial('');
      setPosChargerWarrantyActive(true);
      setPosChargerWarrantyDuration(12);
      setPosScooterWarrantyDuration(12);
      setPosWarrantyTermsAccepted(true);
      setPosHasPreassignedBatteries(false);
      setPosEditPreassignedBatteries(false);
      onRefresh();
    } else {
      triggerAlert('error', 'Checkout transaction failed.');
    }
    setLoading(false);
  };

  // NEW: Place Scooter on Hold
  const handlePlaceOnHold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPOSScooterId) {
      triggerAlert('error', 'Please select a scooter chassis.');
      return;
    }
    if (!s3BuyerName) {
      triggerAlert('error', 'Customer name is required to place scooter on hold.');
      return;
    }

    setLoading(true);

    // Auto-register new buyer if they are not in the database
    const finalBuyerName = s3BuyerName.trim();
    if (finalBuyerName) {
      const buyerExists = buyers.some(b => b.name.toLowerCase() === finalBuyerName.toLowerCase());
      if (!buyerExists && onAddBuyer) {
        await onAddBuyer(finalBuyerName, s3BuyerContact.trim() || undefined, s3BuyerAddress.trim() || undefined, undefined, undefined, 'retail');
      }
    }

    const success = await onSubmitAssembly({
      id: selectedPOSScooterId,
      actionType: 'direct_update',
      status: 'hold',
      heldFor: s3BuyerName,
      heldBy: currentUser.username,
      holdDate: new Date().toISOString()
    });

    if (success) {
      triggerAlert('success', `Scooter put on hold for ${s3BuyerName}!`);
      setS3BuyerName('');
      setS3BuyerContact('');
      setS3BuyerAddress('');
      setS3Price('');
      setSelectedPOSScooterId('');
      onRefresh();
    } else {
      triggerAlert('error', 'Failed to put scooter on hold.');
    }
    setLoading(false);
  };

  // NEW: Release Scooter Reservation Hold
  const handleReleaseHold = async (scootId: string) => {
    setLoading(true);
    const success = await onSubmitAssembly({
      id: scootId,
      actionType: 'direct_update',
      status: 'available',
      heldFor: null,
      heldBy: null,
      holdDate: null
    });

    if (success) {
      triggerAlert('success', 'Reservation released. Scooter is available for inventory again.');
      onRefresh();
    } else {
      triggerAlert('error', 'Failed to release reservation.');
    }
    setLoading(false);
  };

  // Stage 2: Retrofit Customizer (Optional, Last tab)
  const handleStage2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomizeScooterId) {
      triggerAlert('error', 'Please choose a scooter to retrofit.');
      return;
    }
    if (!customizeModel || !customizeColor || !customizeChassisNo || !customizeMotorNo || !customizeControllerNo) {
      triggerAlert('error', 'All fields must be filled to retrofit.');
      return;
    }

    // Check duplicate chassis number if changed
    const currentUnit = scooterUnits.find(u => u.id === selectedCustomizeScooterId);
    if (currentUnit && String(currentUnit.chassisNo || '').toLowerCase() !== String(customizeChassisNo || '').toLowerCase()) {
      if (scooterUnits.some(u => u.id !== selectedCustomizeScooterId && String(u.chassisNo || '').toLowerCase() === String(customizeChassisNo || '').toLowerCase())) {
        triggerAlert('error', 'Chassis number already exists on another unit.');
        return;
      }
    }

    setLoading(true);
    const success = await onSubmitAssembly({
      id: selectedCustomizeScooterId,
      actionType: 'direct_update', // Retrofit changes everything
      modelName: customizeModel,
      color: customizeColor,
      tireSize: customizeTireSize,
      frontTireSize: customizeFrontTireSize,
      rearTireSize: customizeRearTireSize,
      chassisNo: customizeChassisNo.toUpperCase(),
      motorNo: customizeMotorNo.toUpperCase(),
      controllerNo: customizeControllerNo.toUpperCase(),
      customizationNotes: customizeNotes,
      operator: currentUser.username
    });

    if (success) {
      triggerAlert('success', `Retrofit Success: Scooter details modified to customize specifications.`);
      setSelectedCustomizeScooterId('');
      setCustomizeNotes('');
      onRefresh();
    } else {
      triggerAlert('error', 'Failed to save modifications.');
    }
    setLoading(false);
  };




  // Filter & Search Logic
  const filteredScooters = scooterUnits.filter(scoot => {
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch = !query || 
      String(scoot.chassisNo || '').toLowerCase().includes(query) ||
      String(scoot.motorNo || '').toLowerCase().includes(query) ||
      String(scoot.controllerNo || '').toLowerCase().includes(query) ||
      String(scoot.modelName || '').toLowerCase().includes(query) ||
      String(scoot.color || '').toLowerCase().includes(query) ||
      (scoot.buyerName && String(scoot.buyerName || '').toLowerCase().includes(query)) ||
      (scoot.heldFor && String(scoot.heldFor || '').toLowerCase().includes(query));

    const matchesStatus = statusFilter === 'all' || scoot.status === statusFilter;
    const matchesTires = tireFilter === 'all' || scoot.tireSize === tireFilter;

    return matchesSearch && matchesStatus && matchesTires;
  });

  const availableScooters = scooterUnits.filter(u => u.status === 'available');

  // Handle selecting scooter for prep batteries (Stage 1B)
  const handlePrepScooterSelect = (id: string) => {
    setSelectedPrepScooterId(id);
    const unit = scooterUnits.find(u => u.id === id);
    if (unit) {
      setPrepBatteries(unit.batterySerials.length > 0 ? [...unit.batterySerials] : ['']);
      setPrepBatteryWarranties(
        unit.batteryWarrantyFlags && unit.batteryWarrantyFlags.length > 0
          ? [...unit.batteryWarrantyFlags]
          : (unit.batterySerials.length > 0 ? unit.batterySerials.map(() => true) : [true])
      );
      setPrepBatteryWarrantyMonths(
        unit.batteryWarrantyMonths && unit.batteryWarrantyMonths.length > 0
          ? [...unit.batteryWarrantyMonths]
          : (unit.batterySerials.length > 0 ? unit.batterySerials.map(() => 12) : [12])
      );
    } else {
      setPrepBatteries(['']);
      setPrepBatteryWarranties([true]);
      setPrepBatteryWarrantyMonths([12]);
    }
  };

  // Handle selecting scooter for POS checkout (Stage 3)
  const handlePOSScooterSelect = (id: string) => {
    if (currentUser?.role === 'manufacturer') return; // Restrict manufacturer from POS sales
    setSelectedPOSScooterId(id);
    const unit = scooterUnits.find(u => u.id === id);
    if (unit) {
      const hasBatteries = unit.batterySerials && unit.batterySerials.length > 0;
      setPosHasPreassignedBatteries(hasBatteries);
      setPosEditPreassignedBatteries(false);
      
      if (unit.status === 'hold') {
        setS3BuyerName(unit.heldFor || '');
      } else {
        setS3BuyerName('');
      }
      setS3BuyerContact('');
      
      if (hasBatteries) {
        setS4Batteries([...unit.batterySerials]);
        setS4BatteryWarranties(
          unit.batteryWarrantyFlags && unit.batteryWarrantyFlags.length > 0
            ? [...unit.batteryWarrantyFlags]
            : unit.batterySerials.map(() => true)
        );
        setS4BatteryWarrantyMonths(
          unit.batteryWarrantyMonths && unit.batteryWarrantyMonths.length > 0
            ? [...unit.batteryWarrantyMonths]
            : unit.batterySerials.map(() => 12)
        );
      } else {
        setS4Batteries(['']);
        setS4BatteryWarranties([true]);
        setS4BatteryWarrantyMonths([12]);
      }
    } else {
      setPosHasPreassignedBatteries(false);
      setPosEditPreassignedBatteries(false);
      setS3BuyerName('');
      setS3BuyerContact('');
      setS4Batteries(['']);
      setS4BatteryWarranties([true]);
      setS4BatteryWarrantyMonths([12]);
    }
  };

  // Handle selecting scooter for customization retrofit (Stage 2)
  const handleCustomizeScooterSelect = (id: string) => {
    setSelectedCustomizeScooterId(id);
    const unit = scooterUnits.find(u => u.id === id);
    if (unit) {
      setCustomizeModel(unit.modelName);
      setCustomizeColor(unit.color);
      setCustomizeTireSize(unit.tireSize);
      setCustomizeFrontTireSize(unit.frontTireSize || '12-inch');
      setCustomizeRearTireSize(unit.rearTireSize || '12-inch');
      setCustomizeChassisNo(unit.chassisNo);
      setCustomizeMotorNo(unit.motorNo);
      setCustomizeControllerNo(unit.controllerNo);
      setCustomizeNotes(unit.customizationNotes || '');
    }
  };

  const handleCustomizeModelChange = (modelName: string) => {
    setCustomizeModel(modelName);
    const prod = products.find(p => p.name === modelName);
    if (prod && prod.colors.length > 0) {
      setCustomizeColor(prod.colors[0]);
    } else {
      setCustomizeColor('');
    }
  };

  return (
    <div className="space-y-6" id="registry-workspace">
      
      {/* TOP SECTION: Stage Form Enforcer (3 Main Tabs) */}
      <div className="w-full space-y-6" id="left-workspace-panel">
        <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 shadow-sm" id="stage-enforcer-card">
          
          {/* Heading */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-cyan-50 rounded-xl border border-cyan-100">
                <Sparkles className="h-4.5 w-4.5 text-cyan-600" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900 font-sans tracking-tight">
                Log Workspace Stages
              </h3>
            </div>
            

          </div>

          {/* Messages */}
          <AnimatePresence mode="wait">
            {errorMsg && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4 p-3.5 bg-rose-50 border border-rose-200 text-rose-600 text-xs font-sans font-medium rounded-2xl flex items-center gap-2"
                id="error-feedback-alert"
              >
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500" />
                <span>{errorMsg}</span>
              </motion.div>
            )}
            {successMsg && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-600 text-xs font-sans font-medium rounded-2xl flex items-center gap-2"
                id="success-feedback-alert"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                <span>{successMsg}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Segmented Stages Tabs (Exactly two primary stages first, optional customization last) */}
          {currentUser.role === 'admin' || currentUser.role === 'manager' ? (
            <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-2xl mb-5 border border-slate-200" id="stage-tabs-selector">
              <button
                type="button"
                onClick={() => setActiveStepTab('stage1')}
                className={`py-3 sm:py-2 text-xs sm:text-[11px] font-bold tracking-wide rounded-xl font-sans uppercase cursor-pointer transition-all ${
                  activeStepTab === 'stage1' 
                    ? 'bg-white text-slate-800 shadow-sm border border-slate-200' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                🛠️ Assemble
              </button>
              <button
                type="button"
                onClick={() => setActiveStepTab('stage3')}
                className={`py-3 sm:py-2 text-xs sm:text-[11px] font-bold tracking-wide rounded-xl font-sans uppercase cursor-pointer transition-all ${
                  activeStepTab === 'stage3' 
                    ? 'bg-white text-slate-800 shadow-sm border border-slate-200' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                💵 Sell
              </button>
              <button
                type="button"
                onClick={() => setActiveStepTab('stage2')}
                className={`py-3 sm:py-2 text-xs sm:text-[11px] font-bold tracking-wide rounded-xl font-sans uppercase cursor-pointer transition-all ${
                  activeStepTab === 'stage2' 
                    ? 'bg-white text-slate-800 shadow-sm border border-slate-200' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                🎨 Custom
              </button>
            </div>
          ) : currentUser.role === 'salesperson' ? (
            <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-2xl mb-5 border border-slate-200" id="stage-tabs-selector">
              <button
                type="button"
                onClick={() => setActiveStepTab('stage3')}
                className={`py-3 sm:py-2 text-xs sm:text-[11px] font-bold tracking-wide rounded-xl font-sans uppercase cursor-pointer transition-all ${
                  activeStepTab === 'stage3' 
                    ? 'bg-white text-slate-800 shadow-sm border border-slate-200' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                💵 Sell
              </button>
              <button
                type="button"
                onClick={() => setActiveStepTab('stage2')}
                className={`py-3 sm:py-2 text-xs sm:text-[11px] font-bold tracking-wide rounded-xl font-sans uppercase cursor-pointer transition-all ${
                  activeStepTab === 'stage2' 
                    ? 'bg-white text-slate-800 shadow-sm border border-slate-200' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                🎨 Custom
              </button>
            </div>
          ) : (
            <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-2xl text-center mb-5">
              <span className="text-[11px] font-extrabold text-emerald-800 uppercase tracking-wide font-sans flex items-center justify-center gap-1.5">
                🛠️ Frame Assembly Station Active
              </span>
            </div>
          )}

          {/* Form Contexts */}
          <AnimatePresence mode="wait">
            
            {/* STAGE 1 FORM: Build Option */}
            {activeStepTab === 'stage1' && (
              <motion.div
                key="stage1_container"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-4"
              >
                <div>
                  <form onSubmit={handleStage1BulkSubmit} className="space-y-4">
                    <div className="p-3.5 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl text-xs text-slate-700">
                      <p><strong>🛠️ Build & Assembly Line (Internal Station):</strong> Record chassis, motor, and controller serial numbers assembled directly from China-imported container parts kits. Scooter enters available warehouse inventory.</p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 font-sans">
                        Scooter Model Name
                      </label>
                      <SearchableDropdown
                        options={products.map((p) => ({ value: p.name, label: p.name }))}
                        value={s1Model}
                        onChange={(val) => handleModelChange(val)}
                        placeholder="-- Choose Model --"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 font-sans">
                        Color Variant
                      </label>
                      <SearchableDropdown
                        options={s1Model ? (products.find(p => p.name === s1Model)?.colors || []) : []}
                        value={s1Color}
                        onChange={(val) => setS1Color(val)}
                        placeholder="-- Select Color --"
                        disabled={!s1Model}
                        required
                      />
                    </div>

                    {/* Dynamic Imported Stock Indicator (Assembly from China Import Stock) */}
                    {s1Model && s1Color && (
                      <div className="space-y-2 font-sans">
                        <div className="p-3.5 rounded-2xl border text-xs flex items-center justify-between gap-3 bg-cyan-500/5 border-cyan-500/10">
                          <div>
                            <span className="block font-bold text-slate-800">🇨🇳 China Imported Parts Stock</span>
                            <span className="text-[10px] text-slate-500 font-medium">Unassembled container kits available</span>
                          </div>
                          <div className="text-right">
                            <span className={`text-sm font-extrabold px-3 py-1 rounded-xl ${getImportedStockRemaining(s1Model, s1Color) > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-amber-50 text-amber-700 border border-amber-100'}`}>
                              {getImportedStockRemaining(s1Model, s1Color)} Kits
                            </span>
                          </div>
                        </div>
                        
                        {getImportedStockRemaining(s1Model, s1Color) === 0 && (
                          <div className="p-3.5 bg-amber-50 border border-amber-100 rounded-2xl text-[10px] text-amber-800 font-sans leading-relaxed flex items-start gap-2">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                              <strong>⚠️ 0 China Kits Remaining:</strong> We have already registered unique assemblies for all logged imported shipments of <strong>{s1Model} ({s1Color})</strong>. Please log an incoming shipment in the <strong>Import</strong> tab first, or proceed if registering pre-existing parts.
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 font-sans">
                          Front Tyre Size
                        </label>
                        <select
                          value={s1FrontTireSize}
                          onChange={(e) => setS1FrontTireSize(e.target.value as '10-inch' | '12-inch')}
                          className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-base sm:text-xs text-slate-800 focus:border-cyan-500 outline-none cursor-pointer font-sans"
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
                          value={s1RearTireSize}
                          onChange={(e) => setS1RearTireSize(e.target.value as '10-inch' | '12-inch')}
                          className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-base sm:text-xs text-slate-800 focus:border-cyan-500 outline-none cursor-pointer font-sans"
                          required
                        >
                          <option value="10-inch">10-inches</option>
                          <option value="12-inch">12-inches</option>
                        </select>
                      </div>
                    </div>

                    {/* Dynamic Scooter Parts Assembled Slots */}
                    <div className="space-y-3.5 p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                      <div className="flex justify-between items-center mb-1">
                        <span className="block text-[10px] font-bold text-cyan-600 font-sans tracking-widest uppercase">
                          ⚡ Assembled Scooter Hardware Slots
                        </span>
                        <span className="text-[10px] bg-cyan-50 text-cyan-700 px-2.5 py-0.5 rounded-full border border-cyan-100 font-bold font-sans">
                          {s1BulkScooters.length} slots active
                        </span>
                      </div>

                      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                        {s1BulkScooters.map((scoot, idx) => (
                          <div key={idx} className="flex flex-col gap-3 p-3.5 bg-white border border-slate-200 rounded-xl shadow-sm">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                              <span className="text-xs font-bold text-cyan-600 font-sans">
                                Scooter #{idx + 1}
                              </span>
                              {s1BulkScooters.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeBulkScooterSlot(idx)}
                                  className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                                  title="Remove this slot"
                                >
                                  <Trash className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div>
                                <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wide mb-1 font-sans">
                                  Chassis Number (Unique)
                                </label>
                                <input
                                  type="text"
                                  placeholder={`CHASSIS-${1001 + idx}`}
                                  value={scoot.chassisNo}
                                  onChange={(e) => handleBulkScooterChange(idx, 'chassisNo', e.target.value)}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 sm:py-2 text-base sm:text-xs text-slate-800 font-sans uppercase focus:border-cyan-500 outline-none"
                                  required
                                />
                              </div>
                              <div>
                                <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wide mb-1 font-sans">
                                  Motor Number
                                </label>
                                <input
                                  type="text"
                                  placeholder={`MOTOR-${1001 + idx}`}
                                  value={scoot.motorNo}
                                  onChange={(e) => handleBulkScooterChange(idx, 'motorNo', e.target.value)}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 sm:py-2 text-base sm:text-xs text-slate-800 font-sans uppercase focus:border-cyan-500 outline-none"
                                  required
                                />
                              </div>
                              <div>
                                <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wide mb-1 font-sans">
                                  Controller Number
                                </label>
                                <input
                                  type="text"
                                  placeholder={`CTRL-${1001 + idx}`}
                                  value={scoot.controllerNo}
                                  onChange={(e) => handleBulkScooterChange(idx, 'controllerNo', e.target.value)}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 sm:py-2 text-base sm:text-xs text-slate-800 font-sans uppercase focus:border-cyan-500 outline-none"
                                  required
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={addBulkScooterSlot}
                        className="mt-2 w-full py-3 sm:py-2 border border-dashed border-cyan-300 rounded-xl text-cyan-600 hover:bg-cyan-50/50 text-sm sm:text-xs font-bold font-sans transition-all flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Plus className="h-4 w-4" />
                        <span>Add Scooter Slot</span>
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-sans font-bold text-sm sm:text-xs transition-all flex items-center justify-center gap-1 cursor-pointer shadow-sm"
                    >
                      <PlusCircle className="h-4.5 w-4.5" />
                      <span>Confirm Assembly & Register ({s1BulkScooters.length} Units)</span>
                    </button>
                  </form>
                </div>

                {/* --- RECENTLY BUILT LOGS HISTORY FOR THE MANUFACTURER (MOBILE-FIRST CARD VIEW) --- */}
                {currentUser.role !== 'salesperson' && (
                  <div className="border-t border-slate-150 pt-6 mt-6" id="my-recent-builds-history">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
                      <div>
                        <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 font-sans flex items-center gap-2">
                          📝 My Recent Assembly Recordings
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Instant verification of physical serial numbers registered by you.
                        </p>
                      </div>
                      <span className="text-[10px] text-slate-400 font-sans">
                        Tap on any card to view full specifications
                      </span>
                    </div>

                    {(() => {
                      const myRecentRecordings = scooterUnits
                        .filter(u => u.createdOperator === currentUser.username)
                        .slice(-5)
                        .reverse();

                      if (myRecentRecordings.length === 0) {
                        return (
                          <div className="text-center py-8 bg-slate-50/50 border border-dashed border-slate-200 rounded-2xl">
                            <span className="text-xs text-slate-400 font-semibold font-sans">No recent frames assembled by you yet.</span>
                            <p className="text-[10px] text-slate-400 mt-1 font-mono">Use the build form above to start registering assembled scooters!</p>
                          </div>
                        );
                      }

                      return (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" id="recent-builds-cards-list">
                          {myRecentRecordings.map((unit) => (
                            <div
                              key={unit.id}
                              onClick={() => onSelectDetailScooter && onSelectDetailScooter(unit)}
                              className="group border border-slate-200 hover:border-emerald-500 bg-white hover:bg-emerald-50/10 rounded-2xl p-4 shadow-sm hover:shadow transition-all cursor-pointer flex flex-col justify-between"
                              title="Click to view full specifications"
                            >
                              <div className="space-y-2.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-extrabold text-slate-950 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200 uppercase tracking-wide">
                                    {unit.modelName}
                                  </span>
                                  <span className="text-[9px] bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-md border border-emerald-100 font-extrabold uppercase tracking-wider">
                                    {unit.color}
                                  </span>
                                </div>

                                <div className="space-y-1.5 pt-1.5 border-t border-slate-100 font-sans">
                                  <div className="flex justify-between items-center text-[11px]">
                                    <span className="text-slate-400 font-medium">Chassis No:</span>
                                    <span className="font-mono font-black text-slate-900 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 group-hover:bg-emerald-50 group-hover:text-emerald-950 transition-colors">
                                      {unit.chassisNo}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center text-[11px]">
                                    <span className="text-slate-400 font-medium">Motor No:</span>
                                    <span className="font-mono font-bold text-slate-700">{unit.motorNo}</span>
                                  </div>
                                  <div className="flex justify-between items-center text-[11px]">
                                    <span className="text-slate-400 font-medium">Controller No:</span>
                                    <span className="font-mono font-bold text-slate-700">{unit.controllerNo}</span>
                                  </div>
                                  <div className="flex justify-between items-center text-[11px]">
                                    <span className="text-slate-400 font-medium">Batteries:</span>
                                    {unit.batterySerials.length > 0 ? (
                                      <span className="text-emerald-700 font-bold flex items-center gap-0.5 text-[10px] bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                                        🔋 {unit.batterySerials.length} Linked
                                      </span>
                                    ) : (
                                      <span className="text-amber-700 font-bold flex items-center gap-0.5 text-[10px] bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 animate-pulse">
                                        ⏳ Missing
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="mt-3 pt-2 border-t border-slate-50 flex items-center justify-between text-[10px] text-slate-400 group-hover:text-emerald-600 transition-colors">
                                <span>Spec Sheet Sheet ➔</span>
                                <span className="font-bold text-slate-300 group-hover:text-emerald-500">View Details</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </motion.div>
            )}

            {/* STAGE 3 FORM: POS Sales Checkout & Deliver */}
            {activeStepTab === 'stage3' && (
              <motion.div
                key="stage3_container"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-4"
              >
                {currentUser.role === 'manufacturer' ? (
                  <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-xs text-emerald-800">
                    <p><strong>Battery Allocation:</strong> Prep and record battery cells for physical scooter inventory located in the warehouse.</p>
                  </div>
                ) : (
                  <div className="p-4 bg-cyan-50 border border-cyan-100 rounded-2xl text-xs text-cyan-800">
                    <p><strong>Stage 3 Checkout:</strong> Complete sales dispatch. Checks if selected chassis has pre-allocated batteries in warehouse. Displays for confirmation or allows dynamic editing.</p>
                  </div>
                )}

                <div>
                  {/* Toggle between Single, Bulk, and Standalone Battery/Charger POS Sales */}
                  {currentUser.role !== 'manufacturer' && (
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl mb-4 overflow-x-auto whitespace-nowrap hide-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }} id="stage3-mode-selector">
                      <button
                        type="button"
                        onClick={() => { setS3IsBulk(false); setS3Mode('single'); }}
                        className={`flex-1 flex-shrink-0 min-w-max py-2.5 px-3 text-xs sm:text-[10px] font-bold rounded-xl font-sans uppercase transition-all cursor-pointer text-center ${
                          s3Mode === 'single' 
                            ? 'bg-white text-slate-800 shadow-sm' 
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        🛍️ Retail POS
                      </button>
                      <button
                        type="button"
                        onClick={() => { setS3IsBulk(true); setS3Mode('bulk'); }}
                        className={`flex-1 flex-shrink-0 min-w-max py-2.5 px-3 text-xs sm:text-[10px] font-bold rounded-xl font-sans uppercase transition-all cursor-pointer text-center ${
                          s3Mode === 'bulk' 
                            ? 'bg-white text-slate-800 shadow-sm' 
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        📦 Wholesale POS
                      </button>
                      <button
                        type="button"
                        onClick={() => { setS3IsBulk(false); setS3Mode('battery'); }}
                        className={`flex-1 flex-shrink-0 min-w-max py-2.5 px-3 text-xs sm:text-[10px] font-bold rounded-xl font-sans uppercase transition-all cursor-pointer text-center ${
                          s3Mode === 'battery' 
                            ? 'bg-white text-slate-800 shadow-sm' 
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        🔋 Battery POS
                      </button>
                      <button
                        type="button"
                        onClick={() => { setS3IsBulk(false); setS3Mode('charger'); }}
                        className={`flex-1 flex-shrink-0 min-w-max py-2.5 px-3 text-xs sm:text-[10px] font-bold rounded-xl font-sans uppercase transition-all cursor-pointer text-center ${
                          s3Mode === 'charger' 
                            ? 'bg-white text-slate-800 shadow-sm' 
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        🔌 Charger POS
                      </button>
                      <button
                        type="button"
                        onClick={() => { setS3IsBulk(false); setS3Mode('assign_battery'); }}
                        className={`flex-1 flex-shrink-0 min-w-max py-2.5 px-3 text-xs sm:text-[10px] font-bold rounded-xl font-sans uppercase transition-all cursor-pointer text-center ${
                          s3Mode === 'assign_battery' 
                            ? 'bg-white text-slate-800 shadow-sm' 
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        ⚡ Assign Battery
                      </button>
                    </div>
                  )}

                  {s3Mode === 'assign_battery' && (
                    // Assign Batteries (Post-Assembly, before sale)
                    <form onSubmit={handleStage1BatteriesSubmit} className="space-y-4">
                      <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-xs text-emerald-800">
                        <p><strong>Step 2: Battery Allocation:</strong> Prep and record battery cells for physical scooter inventory located in the warehouse prior to sale dispatch.</p>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 font-sans">
                          Select Assembled Scooter (In Warehouse)
                        </label>
                        <SearchableDropdown
                          options={availableScooters.map((scoot) => ({
                            value: scoot.id,
                            label: `${scoot.modelName} (${scoot.color}) - Chassis: ${scoot.chassisNo}`
                          }))}
                          value={selectedPrepScooterId}
                          onChange={(val) => handlePrepScooterSelect(val)}
                          placeholder="-- Choose Scooter Chassis --"
                          required
                        />
                      </div>

                      {selectedPrepScooterId && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="space-y-3.5 p-4 bg-slate-50 border border-slate-100 rounded-2xl"
                        >
                          <div className="flex items-center justify-between">
                            <span className="block text-[10px] font-bold text-emerald-700 font-sans tracking-wide uppercase">
                              Allocate Battery Serials (Max 6)
                            </span>
                            <span className="text-[10px] font-bold text-slate-600">
                              {prepBatteries.length} Slots
                            </span>
                          </div>

                          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                            {prepBatteries.map((serial, idx) => {
                              const months = prepBatteryWarrantyMonths[idx] !== undefined ? prepBatteryWarrantyMonths[idx] : 12;
                              const currentOption = months === 0 ? 'no_battery' : (months === 13 ? 'with_13_warranty' : 'with_12_warranty');
                              
                              return (
                                <div key={idx} className="flex flex-col gap-2 p-3 bg-white border border-slate-200 rounded-xl shadow-sm">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-slate-400 w-4">{idx + 1}.</span>
                                    
                                    <div className="flex-1 flex flex-col sm:flex-row gap-2">
                                      <select
                                        value={currentOption}
                                        onChange={(e) => {
                                          const opt = e.target.value;
                                          if (opt === 'no_battery') {
                                            handlePrepBatteryChange(idx, '');
                                            handlePrepBatteryMonthsChange(idx, 0);
                                            handlePrepBatteryWarrantyChange(idx, false);
                                          } else if (opt === 'with_13_warranty') {
                                            handlePrepBatteryMonthsChange(idx, 13);
                                            handlePrepBatteryWarrantyChange(idx, true);
                                          } else {
                                            handlePrepBatteryMonthsChange(idx, 12);
                                            handlePrepBatteryWarrantyChange(idx, true);
                                          }
                                        }}
                                        className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-base sm:text-xs text-slate-800 focus:border-cyan-500 outline-none font-sans font-semibold cursor-pointer shrink-0"
                                      >
                                        <option value="with_12_warranty">🔋 12 Months Warranty</option>
                                        <option value="with_13_warranty">🔋 13 Months Warranty</option>
                                        <option value="no_battery">❌ No Battery / Slot Empty</option>
                                      </select>
                                      
                                      <div className="flex-1 flex gap-1.5 items-center">
                                        <input
                                          type="text"
                                          placeholder={currentOption === 'no_battery' ? 'Without Battery' : `Enter Battery Serial #${idx + 1}`}
                                          value={serial}
                                          onChange={(e) => handlePrepBatteryChange(idx, e.target.value)}
                                          disabled={currentOption === 'no_battery'}
                                          className="flex-1 bg-slate-50 border border-slate-200 rounded-lg p-2 text-base sm:text-xs text-slate-800 font-sans uppercase focus:border-cyan-500 outline-none disabled:opacity-50 disabled:bg-slate-100 font-semibold"
                                          required={currentOption !== 'no_battery'} 
                                        />
                                        {currentOption !== 'no_battery' && (
                                          <button
                                            type="button"
                                            onClick={() => setAssemblyScannerTarget({ type: 'battery_prep', index: idx })}
                                            className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg cursor-pointer transition-all flex items-center justify-center shrink-0 text-sm"
                                            title="Scan QR Code"
                                          >
                                            📷
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                    
                                    {prepBatteries.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => removePrepBatterySlot(idx)}
                                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-xl cursor-pointer transition-colors"
                                      >
                                        <Trash className="h-3.5 w-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {prepBatteries.length < 6 && (
                            <button
                              type="button"
                              onClick={addPrepBatterySlot}
                              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-[10px] font-bold text-emerald-700 border border-slate-200 rounded-xl flex items-center justify-center gap-1 cursor-pointer transition-colors"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              <span>Add Battery Slot</span>
                            </button>
                          )}
                        </motion.div>
                      )}

                      <button
                        type="submit"
                        disabled={loading || !selectedPrepScooterId}
                        className="w-full py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-sans font-bold text-sm sm:text-xs transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                      >
                        <Battery className="h-4.5 w-4.5" />
                        <span>Assign Batteries to Inventory</span>
                      </button>
                    </form>
                  )}

                  {s3Mode === 'single' && (
                    <form onSubmit={handleStage3Submit} className="space-y-4">
                      {/* 1. MODEL & CHASSIS SELECTION */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 font-sans">
                            1. Filter by Scooter Model
                          </label>
                          <SearchableDropdown
                            options={[{ value: '', label: '-- All Models --' }, ...products.map((p) => ({ value: p.name, label: p.name }))]}
                            value={s3ModelSelected}
                            onChange={(val) => {
                              setS3ModelSelected(val);
                              setSelectedPOSScooterId(''); // Reset selected chassis when model changes
                            }}
                            placeholder="-- All Models --"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 font-sans">
                            2. Choose Scooter Chassis *
                          </label>
                          <SearchableDropdown
                            options={scooterUnits
                              .filter(u => (u.status === 'available' || u.status === 'hold') && (!s3ModelSelected || u.modelName === s3ModelSelected))
                              .map((scoot) => ({
                                value: scoot.id,
                                label: `${scoot.modelName} (${scoot.color}) - Chassis: ${scoot.chassisNo}${scoot.status === 'hold' ? ` [🤝 HELD FOR ${scoot.heldFor?.toUpperCase()}]` : ''}`
                              }))}
                            value={selectedPOSScooterId}
                            onChange={(val) => handlePOSScooterSelect(val)}
                            placeholder="-- Choose Chassis --"
                            required
                          />
                        </div>
                      </div>

                      {selectedPOSScooterId && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="space-y-4"
                        >
                          {/* 2. BUYER DETAILS & REGISTRATION */}
                          <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-3.5">
                            <div className="flex items-center justify-between">
                              <span className="block text-[10px] font-bold text-cyan-600 font-sans tracking-wide uppercase">
                                Buyer & Registration Information
                              </span>
                              {onAddBuyer && (
                                <button
                                  type="button"
                                  onClick={() => setShowInlineAddBuyer(!showInlineAddBuyer)}
                                  className="text-[10px] font-bold text-cyan-600 hover:text-cyan-700 font-sans underline cursor-pointer"
                                >
                                  {showInlineAddBuyer ? 'Cancel Quick-Add' : '➕ Quick-Register Buyer'}
                                </button>
                              )}
                            </div>

                            {showInlineAddBuyer ? (
                              <div className="p-3.5 bg-cyan-50/40 border border-cyan-100 rounded-2xl space-y-3">
                                <span className="block text-[10px] font-extrabold text-cyan-800 uppercase tracking-wide">Quick-Register New Buyer</span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  <div>
                                    <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-wide mb-1 font-sans">Full Name *</span>
                                    <input
                                      type="text"
                                      placeholder="Full name"
                                      value={inlineBuyerName}
                                      onChange={(e) => setInlineBuyerName(e.target.value)}
                                      className="w-full bg-white border border-slate-200 rounded-xl p-3 sm:p-2 text-base sm:text-xs text-slate-800 focus:border-cyan-500 outline-none font-sans"
                                      required
                                    />
                                  </div>
                                  <div>
                                    <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-wide mb-1 font-sans">Contact / Email</span>
                                    <input
                                      type="text"
                                      placeholder="Contact details"
                                      value={inlineBuyerContact}
                                      onChange={(e) => setInlineBuyerContact(e.target.value)}
                                      className="w-full bg-white border border-slate-200 rounded-xl p-3 sm:p-2 text-base sm:text-xs text-slate-800 focus:border-cyan-500 outline-none font-sans"
                                    />
                                  </div>
                                  <div>
                                    <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-wide mb-1 font-sans">Buyer Type</span>
                                    <select
                                      value={inlineBuyerType}
                                      onChange={(e) => setInlineBuyerType(e.target.value as 'retail' | 'wholesale')}
                                      className="w-full bg-white border border-slate-200 rounded-xl p-3 sm:p-2 text-base sm:text-xs text-slate-800 focus:border-cyan-500 outline-none font-sans"
                                    >
                                      <option value="retail">Retail</option>
                                      <option value="wholesale">Wholesale</option>
                                    </select>
                                  </div>
                                  <div>
                                    <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-wide mb-1 font-sans">GST No.</span>
                                    <input
                                      type="text"
                                      placeholder="GST Identification Number"
                                      value={inlineBuyerGstNo}
                                      onChange={(e) => setInlineBuyerGstNo(e.target.value)}
                                      className="w-full bg-white border border-slate-200 rounded-xl p-3 sm:p-2 text-base sm:text-xs text-slate-800 focus:border-cyan-500 outline-none font-sans"
                                    />
                                  </div>
                                  <div className="sm:col-span-2">
                                    <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-wide mb-1 font-sans">Physical Address</span>
                                    <textarea
                                      placeholder="Complete physical or business address"
                                      value={inlineBuyerAddress}
                                      onChange={(e) => setInlineBuyerAddress(e.target.value)}
                                      className="w-full bg-white border border-slate-200 rounded-xl p-3 sm:p-2 text-base sm:text-xs text-slate-800 focus:border-cyan-500 outline-none font-sans resize-none h-16"
                                    />
                                  </div>
                                  <div className="sm:col-span-2">
                                    <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-wide mb-1 font-sans">Address Proof Description / Doc Reference</span>
                                    <input
                                      type="text"
                                      placeholder="e.g. Aadhaar Card, Utility Bill, Trade license reference"
                                      value={inlineBuyerAddressProof}
                                      onChange={(e) => setInlineBuyerAddressProof(e.target.value)}
                                      className="w-full bg-white border border-slate-200 rounded-xl p-3 sm:p-2 text-base sm:text-xs text-slate-800 focus:border-cyan-500 outline-none font-sans"
                                    />
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={handleInlineBuyerAdd}
                                  disabled={inlineBuyerSaving || !inlineBuyerName.trim()}
                                  className="w-full py-3.5 sm:py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-sm sm:text-xs rounded-xl disabled:opacity-50 cursor-pointer font-sans"
                                >
                                  {inlineBuyerSaving ? 'Saving...' : 'Register & Auto-Select'}
                                </button>
                              </div>
                            ) : (
                              <>
                                 <div>
                                  <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 font-sans">
                                      Buyer Name *
                                    </label>
                                    <input
                                      type="text"
                                      placeholder="Enter or select buyer name"
                                      list="buyers-autocomplete"
                                      value={s3BuyerName}
                                      onChange={(e) => setS3BuyerName(e.target.value)}
                                      className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-base sm:text-xs text-slate-800 focus:border-cyan-500 outline-none font-sans"
                                      required
                                    />
                                    <datalist id="buyers-autocomplete">
                                      {buyers.map(b => (
                                        <option key={b.id} value={b.name} />
                                      ))}
                                    </datalist>
                                    {s3BuyerName.trim() !== '' && (
                                      (() => {
                                        const exists = buyers.some(b => b.name.toLowerCase() === s3BuyerName.trim().toLowerCase());
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
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                                  <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 font-sans">
                                      Bill Number *
                                    </label>
                                    <input
                                      type="text"
                                      placeholder="Enter sales bill number"
                                      value={s3BillNo}
                                      onChange={(e) => setS3BillNo(e.target.value)}
                                      className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-base sm:text-xs text-slate-800 focus:border-cyan-500 outline-none font-sans uppercase font-semibold"
                                      required
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 font-sans">
                                      Chalan (Challan) Number *
                                    </label>
                                    <input
                                      type="text"
                                      placeholder="Enter delivery chalan number"
                                      value={s3DeliveryChallanNo}
                                      onChange={(e) => setS3DeliveryChallanNo(e.target.value)}
                                      className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-base sm:text-xs text-slate-800 focus:border-cyan-500 outline-none font-sans uppercase font-semibold"
                                      required
                                    />
                                  </div>
                                </div>

                                {(() => {
                                  const selectedBuyer = buyers.find(b => b.name.toLowerCase() === s3BuyerName.trim().toLowerCase());
                                  if (!selectedBuyer) return null;
                                  return (
                                    <motion.div
                                      initial={{ opacity: 0, y: 5 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      className="p-3.5 bg-cyan-500/5 border border-cyan-500/10 rounded-2xl space-y-2 text-xs font-sans"
                                    >
                                      <div className="flex items-center justify-between border-b border-cyan-500/10 pb-1.5">
                                        <span className="font-extrabold text-cyan-800 uppercase text-[9px] tracking-wide flex items-center gap-1">
                                          <CheckCircle2 className="h-3.5 w-3.5 text-cyan-600 shrink-0" />
                                          <span>Linked Buyer Profile Verified</span>
                                        </span>
                                        {selectedBuyer.buyerType && (
                                          <span className="bg-cyan-100 text-cyan-800 font-extrabold text-[9px] uppercase px-2 py-0.5 rounded-full border border-cyan-200">
                                            {selectedBuyer.buyerType}
                                          </span>
                                        )}
                                      </div>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600 font-sans">
                                        {selectedBuyer.contact && (
                                          <div>
                                            <span className="font-extrabold text-slate-400 block text-[8px] uppercase tracking-wider">Contact Details</span>
                                            <span className="font-semibold">{selectedBuyer.contact}</span>
                                          </div>
                                        )}
                                        {selectedBuyer.gstNo && (
                                          <div>
                                            <span className="font-extrabold text-slate-400 block text-[8px] uppercase tracking-wider">GST Number</span>
                                            <span className="font-mono font-bold text-slate-800">{selectedBuyer.gstNo}</span>
                                          </div>
                                        )}
                                        {selectedBuyer.address && (
                                          <div className="sm:col-span-2">
                                            <span className="font-extrabold text-slate-400 block text-[8px] uppercase tracking-wider">Physical Address</span>
                                            <span className="font-semibold">{selectedBuyer.address}</span>
                                          </div>
                                        )}
                                        {selectedBuyer.addressProof && (
                                          <div className="sm:col-span-2">
                                            <span className="font-extrabold text-slate-400 block text-[8px] uppercase tracking-wider">Address Proof</span>
                                            <span className="font-semibold">{selectedBuyer.addressProof}</span>
                                          </div>
                                        )}
                                      </div>
                                    </motion.div>
                                  );
                                })()}
                              </>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 font-sans">
                                  Contact Number / Email
                                </label>
                                <input
                                  type="text"
                                  placeholder="+1 (555) or email address"
                                  value={s3BuyerContact}
                                  onChange={(e) => setS3BuyerContact(e.target.value)}
                                  className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-base sm:text-xs text-slate-800 focus:border-cyan-500 outline-none font-sans"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 font-sans">
                                  Physical Address / Location (Important) 📍
                                </label>
                                <input
                                  type="text"
                                  placeholder="Enter delivery address / location"
                                  value={s3BuyerAddress}
                                  onChange={(e) => setS3BuyerAddress(e.target.value)}
                                  className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-base sm:text-xs text-slate-800 focus:border-cyan-500 outline-none font-sans"
                                />
                              </div>
                            </div>
                          </div>

                          {/* 3. INTEGRATED BATTERIES SECTION */}
                          <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-3.5">
                            <div className="flex items-center justify-between">
                              <span className="block text-[10px] font-bold text-emerald-700 font-sans tracking-wide uppercase">
                                🔋 Integrated Battery Package
                              </span>
                              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={posIncludeBattery}
                                  onChange={(e) => setPosIncludeBattery(e.target.checked)}
                                  className="rounded border-slate-300 text-emerald-600 focus:ring-0 h-4 w-4 cursor-pointer"
                                />
                                <span>Provide Batteries</span>
                              </label>
                            </div>

                            {posIncludeBattery ? (
                              <motion.div 
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="space-y-3"
                              >
                                {posHasPreassignedBatteries ? (
                                  <div className="bg-emerald-50/50 border border-emerald-100 p-3 rounded-xl">
                                    <div className="text-xs font-semibold text-emerald-800 flex items-center gap-1.5 mb-2">
                                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                                      <span>Pre-assigned Warehouse Batteries detected:</span>
                                    </div>
                                    <div className="flex flex-col gap-1.5 pl-5">
                                      {s4Batteries.map((serial, bidx) => (
                                        <div key={bidx} className="text-xs font-mono font-bold text-slate-700">
                                          - {serial}
                                        </div>
                                      ))}
                                    </div>
                                    <label className="flex items-center gap-1.5 mt-2.5 text-[10px] font-semibold text-slate-600 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={posEditPreassignedBatteries}
                                        onChange={(e) => setPosEditPreassignedBatteries(e.target.checked)}
                                        className="rounded border-slate-300 text-emerald-600 focus:ring-0 h-3.5 w-3.5"
                                      />
                                      <span>Override / Edit Battery Serials</span>
                                    </label>
                                  </div>
                                ) : null}

                                {(!posHasPreassignedBatteries || posEditPreassignedBatteries) && (
                                  <div className="space-y-2 p-3 bg-white border border-slate-200 rounded-xl">
                                    <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide font-sans mb-1">
                                      Enter Battery Serial Numbers (Max 6)
                                    </span>
                                    <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                                      {s4Batteries.map((serial, idx) => (
                                        <div key={idx} className="flex items-center gap-2">
                                          <span className="text-[10px] font-bold text-slate-400 w-4">{idx + 1}.</span>
                                          <div className="flex-1 flex gap-1.5 items-center">
                                            <input
                                              type="text"
                                              placeholder={`Battery Serial #${idx + 1}`}
                                              value={serial}
                                              onChange={(e) => handleBatterySerialChange(idx, e.target.value)}
                                              className="flex-1 bg-slate-50 border border-slate-200 rounded-lg p-2 text-base sm:text-xs text-slate-800 font-sans uppercase focus:border-cyan-500 outline-none font-semibold"
                                              required
                                            />
                                            <button
                                              type="button"
                                              onClick={() => setAssemblyScannerTarget({ type: 'battery_checkout', index: idx })}
                                              className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg cursor-pointer transition-all flex items-center justify-center shrink-0 text-sm"
                                              title="Scan QR Code"
                                            >
                                              📷
                                            </button>
                                          </div>
                                          {s4Batteries.length > 1 && (
                                            <button
                                              type="button"
                                              onClick={() => removeBatterySlot(idx)}
                                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-xl cursor-pointer"
                                            >
                                              <Trash className="h-3.5 w-3.5" />
                                            </button>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                    {s4Batteries.length < 6 && (
                                      <button
                                        type="button"
                                        onClick={addBatterySlot}
                                        className="py-1 px-3 bg-slate-100 hover:bg-slate-200 text-[10px] font-bold text-emerald-700 border border-slate-200 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-colors"
                                      >
                                        <Plus className="h-3 w-3" />
                                        <span>Add Battery Slot</span>
                                      </button>
                                    )}
                                  </div>
                                )}

                                {/* Battery Warranty setup */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1.5 border-t border-slate-200/60">
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      id="posBatteryWarrantyActive"
                                      checked={posBatteryWarrantyActive}
                                      onChange={(e) => setPosBatteryWarrantyActive(e.target.checked)}
                                      className="rounded border-slate-300 text-emerald-600 focus:ring-0 h-4 w-4 cursor-pointer"
                                    />
                                    <label htmlFor="posBatteryWarrantyActive" className="text-xs text-slate-700 font-bold cursor-pointer">
                                      Enable Battery Warranty
                                    </label>
                                  </div>

                                  {posBatteryWarrantyActive && (
                                    <div>
                                      <label className="block text-[9px] text-slate-500 font-sans uppercase font-bold mb-1">
                                        Battery Warranty Duration
                                      </label>
                                      <select
                                        value={posBatteryWarrantyDuration}
                                        onChange={(e) => setPosBatteryWarrantyDuration(Number(e.target.value))}
                                        className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs text-slate-800 font-sans cursor-pointer font-semibold"
                                      >
                                        <option value={12}>6+6 Months Warranty (Standard)</option>
                                        <option value={13}>12+1 Months Warranty</option>
                                        <option value={6}>6 Months Warranty</option>
                                        <option value={18}>18 Months Warranty</option>
                                        <option value={24}>24 Months Warranty</option>
                                      </select>
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            ) : (
                              <div className="text-xs text-slate-500 italic bg-slate-100 p-2.5 rounded-xl">
                                No batteries are being provided in this sales receipt.
                              </div>
                            )}
                          </div>

                          {/* 4. INTEGRATED CHARGER SECTION */}
                          <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-3.5">
                            <div className="flex items-center justify-between">
                              <span className="block text-[10px] font-bold text-slate-700 font-sans tracking-wide uppercase">
                                🔌 Integrated Charger Package
                              </span>
                              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={posIncludeCharger}
                                  onChange={(e) => setPosIncludeCharger(e.target.checked)}
                                  className="rounded border-slate-300 text-slate-700 focus:ring-0 h-4 w-4 cursor-pointer"
                                />
                                <span>Provide Charger</span>
                              </label>
                            </div>

                            {posIncludeCharger ? (
                              <motion.div 
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="space-y-3"
                              >
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white border border-slate-200 rounded-xl p-3">
                                  <div>
                                    <label className="block text-[9px] text-slate-500 font-sans uppercase font-bold mb-1">
                                      Charger Model / Type
                                    </label>
                                    <select
                                      value={posChargerType}
                                      onChange={(e) => setPosChargerType(e.target.value)}
                                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-800 font-sans font-semibold cursor-pointer"
                                    >
                                      {chargerTypeList && chargerTypeList.length > 0 ? (
                                        chargerTypeList.map(ct => (
                                          <option key={ct} value={ct}>{ct}</option>
                                        ))
                                      ) : (
                                        <>
                                          <option value="60V 3A Standard Charger">60V 3A Standard Charger</option>
                                          <option value="60V 5A Smart Fast Charger">60V 5A Smart Fast Charger</option>
                                          <option value="48V 3A Charger">48V 3A Charger</option>
                                          <option value="72V 10A Fast Charger">72V 10A Fast Charger</option>
                                        </>
                                      )}
                                    </select>
                                  </div>

                                  <div>
                                    <label className="block text-[9px] text-slate-500 font-sans uppercase font-bold mb-1">
                                      Charger Serial Number
                                    </label>
                                    <div className="flex gap-1.5 items-center">
                                      <input
                                        type="text"
                                        placeholder="e.g. CHG-2026-9901"
                                        value={posChargerSerial}
                                        onChange={(e) => setPosChargerSerial(e.target.value)}
                                        className="flex-1 bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-800 font-sans uppercase focus:border-cyan-500 outline-none font-semibold"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => setAssemblyScannerTarget({ type: 'charger_checkout' })}
                                        className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg cursor-pointer transition-all flex items-center justify-center shrink-0 text-sm"
                                        title="Scan QR Code"
                                      >
                                        📷
                                      </button>
                                    </div>
                                  </div>
                                </div>

                                {/* Charger Warranty Setup */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1.5 border-t border-slate-200/60">
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      id="posChargerWarrantyActive"
                                      checked={posChargerWarrantyActive}
                                      onChange={(e) => setPosChargerWarrantyActive(e.target.checked)}
                                      className="rounded border-slate-300 text-slate-700 focus:ring-0 h-4 w-4 cursor-pointer"
                                    />
                                    <label htmlFor="posChargerWarrantyActive" className="text-xs text-slate-700 font-bold cursor-pointer">
                                      Enable Charger Warranty
                                    </label>
                                  </div>

                                  {posChargerWarrantyActive && (
                                    <div>
                                      <label className="block text-[9px] text-slate-500 font-sans uppercase font-bold mb-1">
                                        Charger Warranty Duration
                                      </label>
                                      <select
                                        value={posChargerWarrantyDuration}
                                        onChange={(e) => setPosChargerWarrantyDuration(Number(e.target.value))}
                                        className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs text-slate-800 font-sans cursor-pointer font-semibold"
                                      >
                                        <option value={12}>12 Months Warranty (Standard)</option>
                                        <option value={13}>12+1 Months Warranty</option>
                                        <option value={6}>6 Months Warranty</option>
                                        <option value={18}>18 Months Warranty</option>
                                        <option value={24}>24 Months Warranty</option>
                                      </select>
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            ) : (
                              <div className="text-xs text-slate-500 italic bg-slate-100 p-2.5 rounded-xl">
                                No charger is being provided in this sales receipt.
                              </div>
                            )}
                          </div>

                          {/* 5. SCOOTER FRAME WARRANTY SELECTION */}
                          <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-3.5">
                            <span className="block text-[10px] font-bold text-purple-700 font-sans tracking-wide uppercase">
                              🛡️ Scooter Frame Warranty Coverage
                            </span>

                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <label className="text-xs text-slate-700 font-bold flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={s5ScooterWarrantyActive}
                                    onChange={(e) => setS5ScooterWarrantyActive(e.target.checked)}
                                    className="rounded border-slate-300 bg-white text-purple-600 focus:ring-0 h-4 w-4 cursor-pointer"
                                  />
                                  <span>Include Frame Warranty</span>
                                </label>
                                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${s5ScooterWarrantyActive ? 'bg-purple-100 text-purple-800 border-purple-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                  {s5ScooterWarrantyActive ? `${posScooterWarrantyDuration} Months` : 'No Warranty'}
                                </span>
                              </div>

                              {s5ScooterWarrantyActive && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white border border-slate-200 rounded-xl p-3">
                                  <div>
                                    <label className="block text-[9px] text-slate-500 font-sans uppercase font-bold mb-1">
                                      Frame Warranty Duration
                                    </label>
                                    <select
                                      value={posScooterWarrantyDuration}
                                      onChange={(e) => setPosScooterWarrantyDuration(Number(e.target.value))}
                                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-800 font-sans cursor-pointer font-semibold focus:border-purple-500 outline-none"
                                    >
                                      <option value={12}>12 Months Warranty (Standard)</option>
                                      <option value={13}>12+1 Months Warranty</option>
                                      <option value={6}>6 Months Warranty</option>
                                      <option value={18}>18 Months Warranty</option>
                                      <option value={24}>24 Months Warranty</option>
                                    </select>
                                  </div>
                                  <div>
                                    <span className="block text-[9px] text-slate-500 font-sans uppercase font-bold mb-1">Expiry Date</span>
                                    <div className="p-2 border border-slate-100 bg-slate-50 rounded-lg text-xs font-mono font-bold text-slate-700">
                                      📅 {s5ScooterExpiry}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="pt-1">
                              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 font-sans">
                                Retail Warranty Terms / Special Remarks
                              </label>
                              <textarea
                                placeholder="Add terms, e.g., structural, motor restrictions, body damage exclusion..."
                                value={s5Notes}
                                onChange={(e) => setS5Notes(e.target.value)}
                                rows={2}
                                className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-xs text-slate-800 focus:border-cyan-500 outline-none font-sans"
                              />
                            </div>
                          </div>

                          {/* 6. TERMS & CONDITIONS (MANDATORY APPLICABILITY NOTICE) */}
                          <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl space-y-2.5">
                            <div className="text-xs font-semibold text-amber-900 flex items-center gap-1.5">
                              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                              <span>Terms & Conditions Apply *</span>
                            </div>
                            <p className="text-[11px] text-amber-800 leading-relaxed font-sans">
                              Warranties issued for Scooter Frame, Battery cells, and Charger units are strictly subject to standard manufacturer conditions and customer service policies.
                            </p>
                            <label className="flex items-center gap-2 pt-1 font-bold text-xs text-slate-800 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={posWarrantyTermsAccepted}
                                onChange={(e) => setPosWarrantyTermsAccepted(e.target.checked)}
                                className="rounded border-amber-300 text-amber-600 focus:ring-0 h-4 w-4 cursor-pointer"
                                required
                              />
                              <span>I confirm that Terms & Conditions apply and have been communicated to the customer</span>
                            </label>
                          </div>
                        </motion.div>
                      )}

                      {selectedPOSScooterId && scooterUnits.find(u => u.id === selectedPOSScooterId)?.status === 'hold' && (
                        <div className="p-3.5 bg-amber-500/5 border border-amber-500/15 text-amber-800 rounded-2xl text-xs flex items-center gap-2">
                          <Info className="h-4 w-4 text-amber-600 shrink-0" />
                          <span>This scooter is currently <strong>Reserved / On Hold</strong> for <strong>{scooterUnits.find(u => u.id === selectedPOSScooterId)?.heldFor}</strong>. Finalizing the sale will complete the POS and transition status to SOLD.</span>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                          type="submit"
                          disabled={loading || !selectedPOSScooterId}
                          className="py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-sans font-bold text-xs active:scale-[0.99] transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-sm animate-pulse-slow"
                        >
                          <ShoppingBag className="h-4.5 w-4.5" />
                          <span>Finalize Sale & Dispatch</span>
                        </button>

                        <button
                          type="button"
                          onClick={handlePlaceOnHold}
                          disabled={loading || !selectedPOSScooterId || scooterUnits.find(u => u.id === selectedPOSScooterId)?.status === 'hold'}
                          className="py-3.5 rounded-2xl bg-amber-50 border border-amber-200 hover:bg-amber-100 text-amber-700 font-sans font-bold text-xs active:scale-[0.99] transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                        >
                          <User className="h-4.5 w-4.5 text-amber-600" />
                          <span>Place on Hold / Reserve</span>
                        </button>
                      </div>
                    </form>
                  )}

                  {s3Mode === 'bulk' && (
                    // BULK WHOLESALE SALES FORM
                    <form onSubmit={handleStage3BulkSubmit} className="space-y-4">
                      <div className="p-4 bg-cyan-50 border border-cyan-100 rounded-2xl text-xs text-cyan-800">
                        <p><strong>Wholesale Dispatch:</strong> Dispatch multiple units of the same model and color in a single transaction. Paste chassis numbers to auto-map or manually check items from the physical inventory below.</p>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 font-sans">
                            Scooter Model Filter
                          </label>
                          <SearchableDropdown
                            options={products.map((p) => ({ value: p.name, label: p.name }))}
                            value={s3BulkModel}
                            onChange={(val) => handleBulkPOSModelChange(val)}
                            placeholder="-- Choose Blueprint --"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 font-sans">
                            Color Filter
                          </label>
                          <SearchableDropdown
                            options={s3BulkModel ? (products.find(p => p.name === s3BulkModel)?.colors || []) : []}
                            value={s3BulkColor}
                            onChange={(val) => setS3BulkColor(val)}
                            placeholder="-- Choose Color --"
                            disabled={!s3BulkModel}
                            required
                          />
                        </div>
                      </div>

                      {s3BulkModel && s3BulkColor && (
                        <div className="space-y-3">
                          {/* Search & Paste Chassis numbers for quick selection */}
                          <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-2">
                            <label className="block text-[10px] font-bold text-cyan-700 font-sans uppercase tracking-wide">
                              🔍 Search & Auto-Select Chassis Numbers
                            </label>
                            <p className="text-[10px] text-slate-600 leading-relaxed font-semibold">
                              Paste a column of chassis serial numbers (one per line or separated by commas). The matching checkboxes below will instantly check themselves!
                            </p>
                            <textarea
                              rows={3}
                              placeholder="VOLT-CH1001&#10;VOLT-CH1002"
                              value={s3BulkChassisPasted}
                              onChange={(e) => setS3BulkChassisPasted(e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-base sm:text-xs text-slate-800 font-sans focus:border-cyan-500 outline-none"
                            />
                          </div>

                          {/* Available matching stock list */}
                          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-3">
                            <div className="flex justify-between items-center text-[10px] font-sans">
                              <span className="text-slate-500 font-bold uppercase tracking-wide">Available Physical Stock</span>
                              <span className="text-cyan-700 font-bold bg-white px-2.5 py-1 rounded-full border border-slate-200 shadow-sm">
                                {s3BulkSelectedIds.length} / {availableBulkStock.length} Selected
                              </span>
                            </div>

                            <div className="max-h-[160px] overflow-y-auto border border-slate-200 rounded-xl text-[11px] font-sans bg-white">
                              {availableBulkStock.length === 0 ? (
                                <p className="p-4 text-center text-slate-500 text-xs italic font-medium">No matching frame stock is available in Stage 1/Warehouse.</p>
                              ) : (
                                <table className="w-full text-left">
                                  <thead className="bg-slate-100 text-slate-700 text-[9px] uppercase sticky top-0 font-bold">
                                    <tr>
                                      <th className="p-2 text-center w-8">Select</th>
                                      <th className="p-2">Chassis Number</th>
                                      <th className="p-2">Motor / Controller</th>
                                      <th className="p-2">Warehouse Batteries</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {availableBulkStock.map((unit) => {
                                      const isSelected = s3BulkSelectedIds.includes(unit.id);
                                      return (
                                        <tr 
                                          key={unit.id} 
                                          className={`cursor-pointer transition-colors ${
                                            isSelected ? 'bg-cyan-50/70 text-cyan-900' : 'hover:bg-slate-50 text-slate-700'
                                          }`}
                                          onClick={() => {
                                            if (isSelected) {
                                              setS3BulkSelectedIds(s3BulkSelectedIds.filter(id => id !== unit.id));
                                            } else {
                                              setS3BulkSelectedIds([...s3BulkSelectedIds, unit.id]);
                                            }
                                          }}
                                        >
                                          <td className="p-2 text-center" onClick={(e) => e.stopPropagation()}>
                                            <input
                                              type="checkbox"
                                              checked={isSelected}
                                              onChange={(e) => {
                                                if (e.target.checked) {
                                                  setS3BulkSelectedIds([...s3BulkSelectedIds, unit.id]);
                                                } else {
                                                  setS3BulkSelectedIds(s3BulkSelectedIds.filter(id => id !== unit.id));
                                                }
                                              }}
                                              className="rounded border-slate-300 bg-white text-cyan-600 focus:ring-0 h-3.5 w-3.5 cursor-pointer"
                                            />
                                          </td>
                                          <td className="p-2 font-bold text-slate-800">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                              <span>{unit.chassisNo}</span>
                                              {unit.status === 'hold' && (
                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                                                  🤝 HOLD: {unit.heldFor}
                                                </span>
                                              )}
                                            </div>
                                          </td>
                                          <td className="p-2 text-[10px] text-slate-500 font-medium">
                                            {unit.motorNo} / {unit.controllerNo}
                                          </td>
                                          <td className="p-2">
                                            {unit.batterySerials && unit.batterySerials.length > 0 ? (
                                              <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 font-bold">
                                                🔋 {unit.batterySerials.join(', ')}
                                              </span>
                                            ) : (
                                              <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100 font-bold">
                                                ❌ Needs batteries
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

                          {/* High volume wholesale sequential battery matching mapping */}
                          {s3BulkSelectedIds.length > 0 && (
                            <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-3.5">
                              <div className="flex justify-between items-center">
                                <span className="block text-[10px] font-bold text-emerald-700 font-sans tracking-wide uppercase">
                                  ⚡ Wholesale Battery Assign Engine
                                </span>
                                <span className="text-[9px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200 shadow-sm">
                                  Auto-Mapping System
                                </span>
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 font-sans">Batteries Per Scooter</label>
                                  <input
                                    type="number"
                                    min={1}
                                    max={6}
                                    value={s3BulkBatteriesPerScooter}
                                    onChange={(e) => setS3BulkBatteriesPerScooter(Math.max(1, Math.min(6, Number(e.target.value) || 1)))}
                                    className="w-full bg-white border border-slate-200 rounded-xl p-2 text-base sm:text-xs text-slate-800 focus:border-cyan-500 outline-none font-sans"
                                  />
                                </div>
                                <div className="text-[10px] text-slate-600 font-semibold flex items-center leading-relaxed">
                                  Only scooters missing pre-allocated warehouse batteries will get assigned cells from the block below.
                                </div>
                              </div>

                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide font-sans mb-1.5">
                                  Paste Battery Serial Numbers Block (one per line)
                                </label>
                                <textarea
                                  rows={4}
                                  placeholder="BAT-SER1001&#10;BAT-SER1002&#10;BAT-SER1003"
                                  value={s3BulkBatteriesRaw}
                                  onChange={(e) => setS3BulkBatteriesRaw(e.target.value)}
                                  className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-base sm:text-xs text-slate-800 font-sans focus:border-emerald-500 outline-none"
                                />
                              </div>

                              {/* Mapping visualizer */}
                              <div className="space-y-1.5 max-h-[140px] overflow-y-auto border border-slate-200 rounded-xl p-3 bg-white">
                                <span className="block text-[10px] font-bold text-slate-400 font-sans uppercase tracking-wide mb-2">Live Allocation Plan</span>
                                {bulkPOSBatteryAllocation.allocation.map((alloc, idx) => (
                                  <div key={idx} className="flex justify-between items-center bg-slate-50 border border-slate-100 px-3 py-2 rounded-xl text-[11px] font-sans">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-slate-400 font-bold">#{idx + 1}</span>
                                      <span className="text-slate-800 font-bold">{alloc.chassisNo}</span>
                                    </div>
                                    <div>
                                      {alloc.preassigned ? (
                                        <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 font-bold">
                                          Preassigned: {alloc.batteries.join(', ')}
                                        </span>
                                      ) : alloc.error ? (
                                        <span className="text-[10px] text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100 font-bold animate-pulse">
                                          ⚠️ {alloc.error}
                                        </span>
                                      ) : (
                                        <span className="text-[10px] text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded-full border border-cyan-100 font-bold">
                                          Allocated: {alloc.batteries.join(', ')}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                                {bulkPOSBatteryAllocation.unusedBatteries.length > 0 && (
                                  <div className="text-[10px] text-amber-700 font-semibold pt-1 font-sans">
                                    💡 {bulkPOSBatteryAllocation.unusedBatteries.length} extra battery serials pasted will be ignored.
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Buyer Details */}
                          <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-3.5">
                            <span className="block text-[10px] font-bold text-cyan-600 font-sans tracking-wide uppercase mb-1">
                              Wholesale Buyer Info
                            </span>

                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 font-sans">
                                Buyer Name (Search List / Custom)
                              </label>
                              <input
                                type="text"
                                placeholder="Enter or select buyer name"
                                list="buyers-autocomplete-bulk"
                                value={s3BuyerName}
                                onChange={(e) => setS3BuyerName(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-base sm:text-xs text-slate-800 focus:border-cyan-500 outline-none font-sans"
                                required
                              />
                              <datalist id="buyers-autocomplete-bulk">
                                {buyers.map(b => (
                                  <option key={b.id} value={b.name} />
                                ))}
                              </datalist>
                              {s3BuyerName.trim() !== '' && (
                                (() => {
                                  const exists = buyers.some(b => b.name.toLowerCase() === s3BuyerName.trim().toLowerCase());
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
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 font-sans">
                                  Contact / Email
                                </label>
                                <input
                                  type="text"
                                  placeholder="+91 9900..."
                                  value={s3BuyerContact}
                                  onChange={(e) => setS3BuyerContact(e.target.value)}
                                  className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-base sm:text-xs text-slate-800 focus:border-cyan-500 outline-none font-sans"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 font-sans">
                                  Physical Address / Location (Important) 📍
                                </label>
                                <input
                                  type="text"
                                  placeholder="Enter delivery address / location"
                                  value={s3BuyerAddress}
                                  onChange={(e) => setS3BuyerAddress(e.target.value)}
                                  className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-base sm:text-xs text-slate-800 focus:border-cyan-500 outline-none font-sans"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 font-sans">
                                  Bill Number *
                                </label>
                                <input
                                  type="text"
                                  placeholder="Enter wholesale bill number"
                                  value={s3BillNo}
                                  onChange={(e) => setS3BillNo(e.target.value)}
                                  className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-base sm:text-xs text-slate-800 focus:border-cyan-500 outline-none font-sans uppercase font-semibold"
                                  required
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 font-sans">
                                  Chalan (Challan) Number *
                                </label>
                                <input
                                  type="text"
                                  placeholder="Enter delivery chalan number"
                                  value={s3DeliveryChallanNo}
                                  onChange={(e) => setS3DeliveryChallanNo(e.target.value)}
                                  className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-base sm:text-xs text-slate-800 focus:border-cyan-500 outline-none font-sans uppercase font-semibold"
                                  required
                                />
                              </div>
                            </div>
                          </div>

                          {/* General Warranty Setup */}
                          <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-3.5">
                            <span className="block text-[10px] font-bold text-purple-700 font-sans tracking-wide uppercase">
                              Warranty Coverage
                            </span>

                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <label className="text-xs text-slate-700 font-bold flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={s5ScooterWarrantyActive}
                                    onChange={(e) => setS5ScooterWarrantyActive(e.target.checked)}
                                    className="rounded border-slate-300 bg-white text-cyan-600 focus:ring-0 h-3.5 w-3.5 cursor-pointer"
                                  />
                                  <span>Scooter Frame Warranty</span>
                                </label>
                                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${s5ScooterWarrantyActive ? 'bg-cyan-100 text-cyan-800 border-cyan-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                  {s5ScooterWarrantyActive ? 'Active' : 'No Warranty'}
                                </span>
                              </div>
                              {s5ScooterWarrantyActive && (
                                <div className="grid grid-cols-2 gap-2 pl-5">
                                  <div>
                                    <span className="block text-[9px] text-slate-500 font-sans uppercase font-bold mb-1">Expiry Date</span>
                                    <input
                                      type="date"
                                      value={s5ScooterExpiry}
                                      onChange={(e) => setS5ScooterExpiry(e.target.value)}
                                      className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs text-slate-800 font-sans"
                                      required
                                    />
                                  </div>
                                  <div className="flex items-end text-[10px] text-slate-500 italic">
                                    Defaults to 1 year
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="pt-1">
                              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 font-sans">
                                Warranty Notes / Remarks
                              </label>
                              <textarea
                                placeholder="Add terms, e.g., conditions, duration, etc."
                                value={s5Notes}
                                onChange={(e) => setS5Notes(e.target.value)}
                                rows={2}
                                className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-xs text-slate-800 focus:border-cyan-500 outline-none font-sans"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                          type="submit"
                          disabled={loading || s3BulkSelectedIds.length === 0}
                          className="py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-sans font-bold text-xs active:scale-[0.99] transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                        >
                          <ShoppingBag className="h-4.5 w-4.5" />
                          <span>Finalize Bulk Sale & Dispatch ({s3BulkSelectedIds.length} Items)</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleStage3BulkSubmit(undefined, 'hold')}
                          disabled={loading || s3BulkSelectedIds.length === 0}
                          className="py-3.5 rounded-2xl bg-amber-50 border border-amber-200 hover:bg-amber-100 text-amber-700 font-sans font-bold text-xs active:scale-[0.99] transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                        >
                          <User className="h-4.5 w-4.5 text-amber-600" />
                          <span>Place Selection on Hold / Reserve</span>
                        </button>
                      </div>
                    </form>
                  )}

                  {s3Mode === 'battery' && (
                    <BatterySalesManager
                      buyers={buyers}
                      batterySales={batterySales}
                      batteryImports={batteryImports}
                      scooterUnits={scooterUnits}
                      currentUser={currentUser}
                      onRefresh={onRefresh}
                      onSubmitBatterySale={onSubmitBatterySale}
                      batterySeriesList={batterySeriesList}
                      isPipelineView={true}
                      onAddBuyer={onAddBuyer}
                    />
                  )}

                  {s3Mode === 'charger' && (
                    <ChargerSalesManager
                      buyers={buyers}
                      chargerSales={chargerSales}
                      chargerImports={chargerImports}
                      chargerTypesList={chargerTypeList}
                      currentUser={currentUser}
                      onRefresh={onRefresh}
                      onSubmitChargerSale={onSubmitChargerSale}
                      onSubmitChargerImport={onSubmitChargerImport}
                      onReleaseHold={onReleaseChargerHold}
                      onFinalizeHold={onFinalizeChargerHold}
                      isPipelineView={true}
                      onAddBuyer={onAddBuyer}
                    />
                  )}
                </div>
              </motion.div>
            )}

            {/* STAGE 2 FORM: Retrofit Customizer (Optional, Last tab) */}
            {activeStepTab === 'stage2' && (
              <motion.div
                key="stage2_container"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-4"
              >
                <div className="p-3 bg-amber-500/5 border border-amber-500/10 rounded-lg text-xs text-slate-300">
                  <p>
                    <strong>Stage 2 Retrofit Customizer (Optional):</strong> Select any scooter in the registry. Allows changing model, color, tire config, and serial numbers. Changes any product parameters vice versa!
                  </p>
                </div>

                <form onSubmit={handleStage2Submit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 font-mono">
                      Select Scooter to Retrofit
                    </label>
                    <SearchableDropdown
                      options={scooterUnits.map((scoot) => ({
                        value: scoot.id,
                        label: `${scoot.modelName} (${scoot.color}) - Chassis: ${scoot.chassisNo} [${scoot.status.toUpperCase()}]`
                      }))}
                      value={selectedCustomizeScooterId}
                      onChange={(val) => handleCustomizeScooterSelect(val)}
                      placeholder="-- Choose Scooter frame --"
                      required
                    />
                  </div>

                  {selectedCustomizeScooterId && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-3 p-4 bg-slate-950/60 border border-slate-800/80 rounded-lg"
                    >
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 font-mono">
                          Retrofit Model Name
                        </label>
                        <SearchableDropdown
                          options={products.map((p) => ({ value: p.name, label: p.name }))}
                          value={customizeModel}
                          onChange={(val) => handleCustomizeModelChange(val)}
                          placeholder="Select Model..."
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 font-mono">
                          Retrofit Color Variant
                        </label>
                        <SearchableDropdown
                          options={customizeModel ? (products.find(p => p.name === customizeModel)?.colors || []) : []}
                          value={customizeColor}
                          onChange={(val) => setCustomizeColor(val)}
                          placeholder="Select Color..."
                          required
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 font-mono">
                            Retrofit Front Tyre
                          </label>
                          <select
                            value={customizeFrontTireSize}
                            onChange={(e) => setCustomizeFrontTireSize(e.target.value as '10-inch' | '12-inch')}
                            className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-white"
                            required
                          >
                            <option value="10-inch">10-inches</option>
                            <option value="12-inch">12-inches</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 font-mono">
                            Retrofit Rear Tyre
                          </label>
                          <select
                            value={customizeRearTireSize}
                            onChange={(e) => setCustomizeRearTireSize(e.target.value as '10-inch' | '12-inch')}
                            className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-white"
                            required
                          >
                            <option value="10-inch">10-inches</option>
                            <option value="12-inch">12-inches</option>
                          </select>
                        </div>
                      </div>

                      <div className="h-[1px] bg-slate-800 my-1"></div>

                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 font-mono">
                          Modify Chassis No
                        </label>
                        <input
                          type="text"
                          value={customizeChassisNo}
                          onChange={(e) => setCustomizeChassisNo(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-white font-mono uppercase"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 font-mono">
                            Modify Motor No
                          </label>
                          <input
                            type="text"
                            value={customizeMotorNo}
                            onChange={(e) => setCustomizeMotorNo(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-white font-mono uppercase"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 font-mono">
                            Modify Controller No
                          </label>
                          <input
                            type="text"
                            value={customizeControllerNo}
                            onChange={(e) => setCustomizeControllerNo(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-white font-mono uppercase"
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 font-mono">
                          Retrofit Comments / History Notes
                        </label>
                        <textarea
                          placeholder="Why was this retrofitted?"
                          value={customizeNotes}
                          onChange={(e) => setCustomizeNotes(e.target.value)}
                          rows={2}
                          className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-white"
                        />
                      </div>
                    </motion.div>
                  )}

                  <button
                    type="submit"
                    disabled={loading || !selectedCustomizeScooterId}
                    className="w-full py-2.5 rounded-lg bg-gradient-to-r from-amber-400 to-orange-500 hover:opacity-95 text-slate-950 font-sans font-bold text-xs active:scale-[0.99] transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <Hammer className="h-4 w-4" />
                    <span>Apply Custom Retrofit</span>
                  </button>
                </form>
              </motion.div>
            )}

          </AnimatePresence>

        </div>
      </div>

      {/* BOTTOM SECTION: Interactive Scooter Unit Registry with stages progress bar */}
      {s3Mode !== 'charger' && s3Mode !== 'battery' && (
        <div className="w-full space-y-6" id="right-workspace-panel">
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col h-full" id="registry-search-panel">
          
          {/* Header & View Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 font-sans">
                EV Scooter Units Registry
              </h3>
              <p className="text-xs text-slate-500 font-sans mt-0.5">
                Monitor stock details, physical preparation stages, and sales receipts
              </p>
            </div>

            {/* View Mode Segmented Controls */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 self-start sm:self-auto shadow-inner">
              <button
                type="button"
                onClick={() => setRegistryViewMode('list')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  registryViewMode === 'list'
                    ? 'bg-white text-cyan-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                <span>Detail List</span>
              </button>
              <button
                type="button"
                onClick={() => setRegistryViewMode('grid')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  registryViewMode === 'grid'
                    ? 'bg-white text-cyan-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span>Compact Grid</span>
              </button>
              <button
                type="button"
                onClick={() => setRegistryViewMode('board')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  registryViewMode === 'board'
                    ? 'bg-white text-cyan-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                <Kanban className="h-3.5 w-3.5" />
                <span>Stage Board</span>
              </button>
            </div>
          </div>

          {/* Interactive KPI Stats Grid - Sets statusFilter instantly! */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5" id="registry-kpis-grid">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-slate-50/50 border-slate-300 shadow-sm ring-1 ring-slate-200'
                  : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Units</span>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-2xl font-black text-slate-900 font-mono">{scooterUnits.length}</span>
                <span className="text-[10px] text-slate-500 font-medium font-sans">units</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('available')}
              className={`p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer ${
                statusFilter === 'available'
                  ? 'bg-cyan-50/50 border-cyan-300 shadow-sm ring-1 ring-cyan-200'
                  : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-600">In Warehouse</span>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-2xl font-black text-cyan-700 font-mono">
                  {scooterUnits.filter(u => u.status === 'available').length}
                </span>
                <span className="text-[10px] text-cyan-600 font-semibold font-sans">available</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('hold')}
              className={`p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer ${
                statusFilter === 'hold'
                  ? 'bg-amber-50/50 border-amber-300 shadow-sm ring-1 ring-amber-200'
                  : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Reserved Hold</span>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-2xl font-black text-amber-700 font-mono">
                  {scooterUnits.filter(u => u.status === 'hold').length}
                </span>
                <span className="text-[10px] text-amber-600 font-semibold font-sans">on hold</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('sold')}
              className={`p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer ${
                statusFilter === 'sold'
                  ? 'bg-emerald-50/50 border-emerald-300 shadow-sm ring-1 ring-emerald-200'
                  : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Sold / Shipped</span>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-2xl font-black text-emerald-700 font-mono">
                  {scooterUnits.filter(u => u.status === 'sold').length}
                </span>
                <span className="text-[10px] text-emerald-600 font-semibold font-sans">completed</span>
              </div>
            </button>
          </div>

          {/* Filtering */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5 bg-slate-50 p-3 rounded-2xl border border-slate-100" id="registry-filters">
            <div className="relative">
              <input
                type="text"
                placeholder="Search Chassis / Buyers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl py-2 pl-8 pr-3 text-xs text-slate-800 focus:border-cyan-500 outline-none font-sans"
              />
              <Search className="absolute left-2.5 top-3 h-3.5 w-3.5 text-slate-400" />
            </div>

            <div className="flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-700 outline-none cursor-pointer focus:border-cyan-500 font-sans"
              >
                <option value="all">All Statuses</option>
                <option value="available">In Warehouse (Available)</option>
                <option value="hold">On Hold (Reserved)</option>
                <option value="sold">Sold Out (POS Complete)</option>
              </select>
            </div>
          </div>

          {/* RENDER VIEW: Detail List View */}
          {registryViewMode === 'list' && (
            <div className="space-y-4 overflow-y-auto max-h-[550px] pr-1" id="scooter-units-ledger">
              {filteredScooters.length === 0 ? (
                <div className="text-center py-16 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200" id="empty-ledger">
                  <Layers className="h-10 w-10 text-slate-400 mx-auto mb-2" />
                  <span className="text-xs text-slate-600 font-semibold font-sans">No matching scooters found</span>
                  <p className="text-[10px] text-slate-400 mt-1 font-mono">Log production assembly records on the left!</p>
                </div>
              ) : (
                filteredScooters.map((scoot) => {
                  let progressPercent = '33%';
                  let progressText = 'Stage 1: Core Frame Assembly';
                  
                  if (scoot.status === 'sold') {
                    progressPercent = '100%';
                    progressText = 'Stage 3: POS Sold & Dispatched';
                  } else if (scoot.status === 'hold') {
                    progressPercent = '75%';
                    progressText = 'Stage 2.5: Reserved / On Hold';
                  } else if (scoot.batterySerials && scoot.batterySerials.length > 0) {
                    progressPercent = '66%';
                    progressText = 'Stage 1+ (Batteries Pre-Assigned)';
                  }

                  return (
                    <div 
                      key={scoot.id}
                      className="p-5 bg-slate-50/40 border border-slate-200/70 rounded-3xl hover:border-slate-200 hover:bg-slate-50 transition-all shadow-sm"
                      id={`scooter-card-${scoot.id}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Chassis Code</span>
                          <h4 className="text-base font-bold text-slate-900 tracking-tight font-mono">{scoot.chassisNo}</h4>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-sans px-2.5 py-1 rounded-full border font-bold ${
                            scoot.status === 'sold'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                              : scoot.status === 'hold'
                              ? 'bg-amber-50 text-amber-700 border-amber-100'
                              : 'bg-cyan-50 text-cyan-700 border-cyan-100'
                          }`}>
                            {scoot.status === 'sold' ? 'SOLD' : scoot.status === 'hold' ? '🤝 RESERVED' : 'AVAILABLE'}
                          </span>
                          
                          <span className="text-[10px] font-sans px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200 font-bold">
                            F: {scoot.frontTireSize === '10-inch' ? '10"' : '12"'} / R: {scoot.rearTireSize === '10-inch' ? '10"' : '12"'}{scoot.brakeType ? ` / ${scoot.brakeType}` : ''}
                          </span>
                        </div>
                      </div>

                      {/* Specifications */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-sans text-slate-600 bg-white p-4 rounded-2xl border border-slate-100 mb-4">
                        <div>Model: <span className="text-slate-900 font-bold">{scoot.modelName}</span></div>
                        <div>Color: <span className="text-slate-800 font-semibold">{scoot.color}</span></div>
                        <div>Front Tyre: <span className="text-slate-800 font-semibold">{scoot.frontTireSize === '10-inch' ? '10-inches' : '12-inches'}</span></div>
                        <div>Rear Tyre: <span className="text-slate-800 font-semibold">{scoot.rearTireSize === '10-inch' ? '10-inches' : '12-inches'}</span></div>
                        {scoot.brakeType && <div>Brakes: <span className="text-slate-800 font-semibold">{scoot.brakeType}</span></div>}
                        <div className="sm:col-span-1 font-sans">Motor No: <span className="text-slate-900 font-mono font-bold text-[11px]">{scoot.motorNo}</span></div>
                        <div className="sm:col-span-2 font-sans">Controller: <span className="text-slate-900 font-mono font-bold text-[11px]">{scoot.controllerNo}</span></div>
                        <div className="col-span-full border-t border-slate-100 pt-1.5 mt-0.5 text-[11px] text-slate-400">Registered By: <strong className="text-slate-600">{scoot.createdOperator}</strong></div>
                      </div>

                      {/* Progress tracking */}
                      <div className="space-y-1 mb-4">
                        <div className="flex justify-between items-center text-[10px] font-sans font-bold text-slate-400 uppercase tracking-wide">
                          <span>Assembly Stage Status</span>
                          <span className="text-cyan-600 font-bold">{progressText}</span>
                        </div>
                        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-300"
                            style={{ width: progressPercent }}
                          ></div>
                        </div>
                      </div>

                      {/* Battery details */}
                      {scoot.batterySerials && scoot.batterySerials.length > 0 ? (
                        <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl text-xs font-sans text-slate-700 mb-4 space-y-2">
                          <span className="block text-[10px] uppercase tracking-wider text-slate-500 font-sans font-extrabold">⚡ Allocated Battery Packs:</span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                            {scoot.batterySerials.map((serial, bidx) => {
                              const months = scoot.batteryWarrantyMonths 
                                ? scoot.batteryWarrantyMonths[bidx] 
                                : (scoot.batteryWarrantyFlags && scoot.batteryWarrantyFlags[bidx] === false ? 0 : 12);
                              
                              let expiryString = '';
                              if (scoot.saleDate && months > 0) {
                                const saleDateObj = new Date(scoot.saleDate);
                                saleDateObj.setMonth(saleDateObj.getMonth() + months);
                                expiryString = saleDateObj.toISOString().split('T')[0];
                              }
                              
                              return (
                                <div key={bidx} className="flex flex-col gap-1 bg-white p-2.5 rounded-xl border border-emerald-100/70 font-mono text-xs">
                                  <div className="flex items-center justify-between">
                                    <span className="text-slate-800 font-bold">{serial}</span>
                                    {months > 0 ? (
                                      <span className="text-emerald-700 font-bold flex items-center gap-0.5 text-[10px] bg-emerald-50 px-1.5 py-0.5 rounded-md">
                                        {months}M Warranty
                                      </span>
                                    ) : (
                                      <span className="text-slate-400 text-[10px]">No Warranty</span>
                                    )}
                                  </div>
                                  {scoot.status === 'sold' && months > 0 && expiryString && (
                                    <div className="text-[9px] text-slate-400 flex justify-between border-t border-slate-50 pt-1 mt-1 font-sans">
                                      <span>Expiry:</span>
                                      <span className="text-emerald-600 font-bold">{expiryString}</span>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 bg-amber-50/40 text-amber-800 border border-amber-100 rounded-2xl text-xs mb-4">
                          ⚠️ No battery pack assigned yet. (Configure in Stage 1 post-assembly or Stage 3 sell checkout)
                        </div>
                      )}

                      {/* Reservation details */}
                      {scoot.status === 'hold' && (
                        <div className="p-4 bg-amber-50/50 border border-amber-100 rounded-2xl text-xs text-slate-700 mb-4 space-y-1.5">
                          <div className="flex items-center justify-between font-sans text-[10px] text-amber-700 uppercase tracking-wider font-extrabold border-b border-amber-100 pb-1.5">
                            <span>🤝 Customer Reservation Hold</span>
                            <span>{scoot.holdDate ? new Date(scoot.holdDate).toLocaleDateString() : ''}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 pt-1 font-sans">
                            <div>Reserved For: <span className="text-amber-800 font-bold">{scoot.heldFor}</span></div>
                            <div>Reserved By: <span className="text-slate-700 font-medium">{scoot.heldBy || 'Operator'}</span></div>
                          </div>
                        </div>
                      )}

                      {/* Sales receipt details */}
                      {scoot.status === 'sold' && (
                        <div className="p-4 bg-cyan-50/50 border border-cyan-100 rounded-2xl text-xs text-slate-700 mb-4 space-y-1.5">
                          <div className="flex items-center justify-between font-sans text-[10px] text-cyan-700 uppercase tracking-wider font-extrabold border-b border-cyan-100 pb-1.5">
                            <span>Stage 3 Checkout Receipt</span>
                            <span>{scoot.saleDate ? new Date(scoot.saleDate).toLocaleDateString() : ''}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 pt-1 font-sans">
                            <div>Buyer: <span className="text-slate-900 font-bold">{scoot.buyerName}</span></div>
                            {scoot.buyerContact && <div>Contact: <span className="text-slate-800">{scoot.buyerContact}</span></div>}
                          </div>
                        </div>
                      )}

                      {/* Warranties */}
                      {(scoot.scooterWarrantyStatus !== 'None' || scoot.batteryWarrantyStatus !== 'None') && (
                        <div className="p-4 bg-purple-50/50 border border-purple-100 rounded-2xl text-xs text-slate-700 mb-4 space-y-1.5">
                          <div className="text-purple-700 text-[10px] font-sans font-extrabold uppercase tracking-wide flex items-center gap-1 pb-1.5 border-b border-purple-100">
                            <ShieldCheck className="h-4 w-4 shrink-0 text-purple-600" />
                            <span>Active Warranty Coverage</span>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5 font-sans">
                            <div>Scooter: <span className="text-purple-800 font-bold">{scoot.scooterWarrantyStatus}</span> (Exp: {scoot.scooterWarrantyExpiry || 'N/A'})</div>
                            <div>Batteries: <span className="text-emerald-700 font-bold">{scoot.batteryWarrantyStatus}</span> (Exp: {scoot.batteryWarrantyExpiry || 'N/A'})</div>
                          </div>
                        </div>
                      )}

                      {/* Context Actions */}
                      <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-100">
                        {scoot.status === 'available' && (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveStepTab('stage3');
                              setS3Mode('assign_battery');
                              handlePrepScooterSelect(scoot.id);
                            }}
                            className="flex-1 min-w-[120px] py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs text-emerald-800 font-sans rounded-xl cursor-pointer transition-all flex items-center justify-center gap-1.5"
                          >
                            <Battery className="h-4 w-4 text-emerald-600" />
                            <span>Assign Batteries</span>
                          </button>
                        )}

                        {scoot.status === 'available' && currentUser.role !== 'manufacturer' && (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveStepTab('stage3');
                              setS3Mode('single');
                              handlePOSScooterSelect(scoot.id);
                            }}
                            className="flex-1 min-w-[120px] py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs text-cyan-800 font-sans font-bold rounded-xl cursor-pointer transition-all flex items-center justify-center gap-1.5"
                          >
                            <ShoppingBag className="h-4 w-4 text-cyan-600" />
                            <span>Assign POS</span>
                          </button>
                        )}

                        {scoot.status === 'hold' && currentUser.role !== 'manufacturer' && (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveStepTab('stage3');
                              setS3Mode('single');
                              handlePOSScooterSelect(scoot.id);
                            }}
                            className="flex-1 min-w-[120px] py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs text-cyan-800 font-sans font-bold rounded-xl cursor-pointer transition-all flex items-center justify-center gap-1.5"
                          >
                            <ShoppingBag className="h-4 w-4 text-cyan-600" />
                            <span>Complete Sale</span>
                          </button>
                        )}

                        {scoot.status === 'hold' && (
                          <button
                            type="button"
                            onClick={() => handleReleaseHold(scoot.id)}
                            className="flex-1 min-w-[120px] py-2 bg-rose-50 hover:bg-rose-100 border border-rose-100 text-xs text-rose-700 font-sans rounded-xl cursor-pointer transition-all flex items-center justify-center gap-1.5"
                          >
                            <Trash className="h-4 w-4 text-rose-500" />
                            <span>Release Hold</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setActiveStepTab('stage2');
                            handleCustomizeScooterSelect(scoot.id);
                          }}
                          className="flex-1 min-w-[100px] py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs text-amber-700 font-sans rounded-xl cursor-pointer transition-all flex items-center justify-center gap-1.5"
                        >
                          <Settings className="h-4 w-4 text-amber-600" />
                          <span>Retrofit</span>
                        </button>
                      </div>

                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* RENDER VIEW: Compact Bento Grid View */}
          {registryViewMode === 'grid' && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 overflow-y-auto max-h-[550px] pr-1" id="scooter-units-grid">
              {filteredScooters.length === 0 ? (
                <div className="col-span-full text-center py-16 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200" id="empty-ledger">
                  <Layers className="h-10 w-10 text-slate-400 mx-auto mb-2" />
                  <span className="text-xs text-slate-600 font-semibold font-sans">No matching scooters found</span>
                </div>
              ) : (
                filteredScooters.map((scoot) => {
                  const hasBatteries = scoot.batterySerials && scoot.batterySerials.length > 0;
                  return (
                    <div 
                      key={scoot.id}
                      className="p-4 bg-white border border-slate-200 rounded-2xl hover:border-slate-300 hover:shadow-md transition-all flex flex-col justify-between shadow-sm"
                    >
                      <div>
                        {/* Compact Top Header */}
                        <div className="flex items-start justify-between gap-1 mb-2">
                          <div>
                            <span className="text-[9px] font-bold text-slate-400 font-mono block uppercase">Chassis</span>
                            <span className="text-sm font-extrabold text-slate-900 font-mono tracking-tight">{scoot.chassisNo}</span>
                          </div>
                          <span className={`text-[9px] font-sans px-2 py-0.5 rounded-full border font-bold ${
                            scoot.status === 'sold'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                              : scoot.status === 'hold'
                              ? 'bg-amber-50 text-amber-700 border-amber-100'
                              : 'bg-cyan-50 text-cyan-700 border-cyan-100'
                          }`}>
                            {scoot.status === 'sold' ? 'SOLD' : scoot.status === 'hold' ? 'RESERVED' : 'AVAIL'}
                          </span>
                        </div>

                        {/* Specs */}
                        <div className="text-xs text-slate-600 space-y-1 bg-slate-50/50 p-2.5 rounded-xl border border-slate-100 my-2">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Model/Color:</span>
                            <span className="font-bold text-slate-800">{scoot.modelName} ({scoot.color})</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Wheels (F/R):</span>
                            <span className="font-semibold text-slate-700">F: {scoot.frontTireSize === '10-inch' ? '10"' : '12"'} / R: {scoot.rearTireSize === '10-inch' ? '10"' : '12"'}</span>
                          </div>
                          {scoot.brakeType && (
                            <div className="flex justify-between">
                              <span className="text-slate-400">Brake Type:</span>
                              <span className="font-semibold text-slate-700">{scoot.brakeType}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-slate-400">Motor / Controller:</span>
                            <span className="font-mono text-[10px] text-slate-700 font-semibold">{scoot.motorNo} / {scoot.controllerNo}</span>
                          </div>
                          <div className="flex justify-between border-t border-slate-100/70 pt-1 mt-1">
                            <span className="text-slate-400">Batteries:</span>
                            {hasBatteries ? (
                              <span className="text-emerald-700 font-bold flex items-center gap-0.5 text-[11px]">
                                ⚡ {scoot.batterySerials.length} pack(s) linked
                              </span>
                            ) : (
                              <span className="text-amber-600 font-semibold text-[11px]">⚠️ Unassigned</span>
                            )}
                          </div>
                          {scoot.status === 'sold' && scoot.buyerName && (
                            <div className="flex justify-between border-t border-slate-100/70 pt-1 mt-1 text-[10px]">
                              <span className="text-slate-400">Buyer:</span>
                              <span className="font-bold text-slate-700 truncate max-w-[120px]">{scoot.buyerName}</span>
                            </div>
                          )}
                          {scoot.status === 'hold' && scoot.heldFor && (
                            <div className="flex justify-between border-t border-slate-100/70 pt-1 mt-1 text-[10px]">
                              <span className="text-slate-400">Hold For:</span>
                              <span className="font-bold text-amber-700 truncate max-w-[120px]">🤝 {scoot.heldFor}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Quick context action strip */}
                      <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-slate-100">
                        {scoot.status === 'available' && (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveStepTab('stage3');
                              setS3Mode('assign_battery');
                              handlePrepScooterSelect(scoot.id);
                            }}
                            className="flex-1 text-[10px] font-bold py-1 px-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-all"
                          >
                            <Battery className="h-3 w-3 text-emerald-600" />
                            <span>Battery</span>
                          </button>
                        )}
                        {scoot.status === 'available' && currentUser.role !== 'manufacturer' && (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveStepTab('stage3');
                              setS3Mode('single');
                              handlePOSScooterSelect(scoot.id);
                            }}
                            className="flex-1 text-[10px] font-bold py-1 px-1.5 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-all"
                          >
                            <ShoppingBag className="h-3 w-3 text-cyan-600" />
                            <span>POS Sell</span>
                          </button>
                        )}
                        {scoot.status === 'hold' && currentUser.role !== 'manufacturer' && (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveStepTab('stage3');
                              setS3Mode('single');
                              handlePOSScooterSelect(scoot.id);
                            }}
                            className="flex-1 text-[10px] font-bold py-1 px-1.5 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-all"
                          >
                            <ShoppingBag className="h-3 w-3 text-cyan-600" />
                            <span>Complete</span>
                          </button>
                        )}
                        {scoot.status === 'hold' && (
                          <button
                            type="button"
                            onClick={() => handleReleaseHold(scoot.id)}
                            className="text-[10px] font-bold py-1 px-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-100 text-rose-700 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-all"
                          >
                            <Trash className="h-3 w-3 text-rose-500" />
                            <span>Release</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setActiveStepTab('stage2');
                            handleCustomizeScooterSelect(scoot.id);
                          }}
                          className="text-[10px] font-bold py-1 px-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-all"
                        >
                          <Settings className="h-3 w-3 text-amber-600" />
                          <span>Retrofit</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* RENDER VIEW: Interactive Stage Kanban Board */}
          {registryViewMode === 'board' && (
            <div className="overflow-x-auto pb-4" id="scooter-units-board">
              <div className="flex gap-4 min-w-[960px] h-[550px]" id="kanban-scooter-pipeline">
                
                {/* COLUMN 1: Stage 1 - Frame Assembly */}
                <div className="flex-1 bg-slate-50/50 rounded-2xl border border-slate-200 p-3 flex flex-col h-full">
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200/60 px-1">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-400 block"></span>
                      <h4 className="text-xs font-bold text-slate-700 font-sans">Stage 1: Core Frame</h4>
                    </div>
                    <span className="bg-slate-200/80 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full font-mono">
                      {filteredScooters.filter(u => u.status === 'available' && (!u.batterySerials || u.batterySerials.length === 0)).length}
                    </span>
                  </div>
                  
                  <div className="space-y-2.5 overflow-y-auto flex-1 pr-1">
                    {filteredScooters.filter(u => u.status === 'available' && (!u.batterySerials || u.batterySerials.length === 0)).length === 0 ? (
                      <div className="text-center py-12 text-[11px] text-slate-400 font-sans border border-dashed border-slate-200 rounded-xl bg-white/40">
                        No frames in assembly
                      </div>
                    ) : (
                      filteredScooters.filter(u => u.status === 'available' && (!u.batterySerials || u.batterySerials.length === 0)).map((scoot) => (
                        <div key={scoot.id} className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow transition-all space-y-2">
                          <div className="flex justify-between items-start">
                            <span className="font-mono text-xs font-black text-slate-900">{scoot.chassisNo}</span>
                            <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold font-sans uppercase">{scoot.color}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-sans space-y-0.5">
                            <div>Model: <strong className="text-slate-800">{scoot.modelName}</strong></div>
                            <div className="text-amber-600 font-medium">⚠️ No battery cell assigned</div>
                          </div>
                          <div className="pt-2 border-t border-slate-100 flex gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveStepTab('stage3');
                                setS3Mode('assign_battery');
                                handlePrepScooterSelect(scoot.id);
                              }}
                              className="w-full text-[9px] font-extrabold py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-all"
                            >
                              <Battery className="h-2.5 w-2.5 text-emerald-600" />
                              <span>Assign Batteries</span>
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* COLUMN 2: Stage 1+ - Batteries Linked */}
                <div className="flex-1 bg-emerald-50/20 rounded-2xl border border-emerald-100/60 p-3 flex flex-col h-full">
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-emerald-100/40 px-1">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 block animate-pulse"></span>
                      <h4 className="text-xs font-bold text-emerald-800 font-sans">Stage 1+: Prepped & Linked</h4>
                    </div>
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full font-mono">
                      {filteredScooters.filter(u => u.status === 'available' && u.batterySerials && u.batterySerials.length > 0).length}
                    </span>
                  </div>
                  
                  <div className="space-y-2.5 overflow-y-auto flex-1 pr-1">
                    {filteredScooters.filter(u => u.status === 'available' && u.batterySerials && u.batterySerials.length > 0).length === 0 ? (
                      <div className="text-center py-12 text-[11px] text-slate-400 font-sans border border-dashed border-emerald-100/40 rounded-xl bg-white/40">
                        No prepped units ready
                      </div>
                    ) : (
                      filteredScooters.filter(u => u.status === 'available' && u.batterySerials && u.batterySerials.length > 0).map((scoot) => (
                        <div key={scoot.id} className="p-3 bg-white border border-emerald-100/50 rounded-xl shadow-sm hover:shadow transition-all space-y-2">
                          <div className="flex justify-between items-start">
                            <span className="font-mono text-xs font-black text-slate-900">{scoot.chassisNo}</span>
                            <span className="text-[9px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-bold font-sans uppercase">{scoot.color}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-sans space-y-0.5">
                            <div>Model: <strong className="text-slate-800">{scoot.modelName}</strong></div>
                            <div className="text-emerald-700 font-bold flex items-center gap-0.5 text-[10px]">
                              ⚡ {scoot.batterySerials.length} battery linked
                            </div>
                          </div>
                          {currentUser.role !== 'manufacturer' && (
                            <div className="pt-2 border-t border-slate-100 flex gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveStepTab('stage3');
                                  setS3Mode('single');
                                  handlePOSScooterSelect(scoot.id);
                                }}
                                className="w-full text-[9px] font-extrabold py-1 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-all"
                              >
                                <ShoppingBag className="h-2.5 w-2.5 text-cyan-600" />
                                <span>POS Checkout</span>
                              </button>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* COLUMN 3: Stage 2.5 - Reservation Hold */}
                <div className="flex-1 bg-amber-50/20 rounded-2xl border border-amber-100/60 p-3 flex flex-col h-full">
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-amber-100/40 px-1">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 block"></span>
                      <h4 className="text-xs font-bold text-amber-800 font-sans">Stage 2.5: Reserved</h4>
                    </div>
                    <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full font-mono">
                      {filteredScooters.filter(u => u.status === 'hold').length}
                    </span>
                  </div>
                  
                  <div className="space-y-2.5 overflow-y-auto flex-1 pr-1">
                    {filteredScooters.filter(u => u.status === 'hold').length === 0 ? (
                      <div className="text-center py-12 text-[11px] text-slate-400 font-sans border border-dashed border-amber-100/40 rounded-xl bg-white/40">
                        No units on hold
                      </div>
                    ) : (
                      filteredScooters.filter(u => u.status === 'hold').map((scoot) => (
                        <div key={scoot.id} className="p-3 bg-white border border-amber-150 rounded-xl shadow-sm hover:shadow transition-all space-y-2">
                          <div className="flex justify-between items-start">
                            <span className="font-mono text-xs font-black text-slate-900">{scoot.chassisNo}</span>
                            <span className="text-[9px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-bold font-sans uppercase">{scoot.color}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-sans space-y-0.5">
                            <div>Model: <strong className="text-slate-800">{scoot.modelName}</strong></div>
                            <div className="text-amber-800 font-semibold truncate">Held for: <strong>{scoot.heldFor}</strong></div>
                          </div>
                          <div className="pt-2 border-t border-slate-100 flex gap-1">
                            {currentUser.role !== 'manufacturer' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveStepTab('stage3');
                                  setS3Mode('single');
                                  handlePOSScooterSelect(scoot.id);
                                }}
                                className="flex-1 text-[9px] font-extrabold py-1 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-all"
                              >
                                <span>Dispatch Sale</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleReleaseHold(scoot.id)}
                              className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg cursor-pointer transition-all"
                              title="Release Hold"
                            >
                              <Trash className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* COLUMN 4: Stage 3 - Sold & Dispatched */}
                <div className="flex-1 bg-cyan-50/10 rounded-2xl border border-cyan-100/30 p-3 flex flex-col h-full">
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-cyan-100/30 px-1">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 block"></span>
                      <h4 className="text-xs font-bold text-cyan-800 font-sans">Stage 3: Dispatched</h4>
                    </div>
                    <span className="bg-cyan-50 text-cyan-800 text-[10px] font-bold px-2 py-0.5 rounded-full font-mono">
                      {filteredScooters.filter(u => u.status === 'sold').length}
                    </span>
                  </div>
                  
                  <div className="space-y-2.5 overflow-y-auto flex-1 pr-1">
                    {filteredScooters.filter(u => u.status === 'sold').length === 0 ? (
                      <div className="text-center py-12 text-[11px] text-slate-400 font-sans border border-dashed border-cyan-100/30 rounded-xl bg-white/40">
                        No dispatched sales yet
                      </div>
                    ) : (
                      filteredScooters.filter(u => u.status === 'sold').map((scoot) => (
                        <div key={scoot.id} className="p-3 bg-white border border-slate-100 rounded-xl shadow-sm hover:shadow transition-all space-y-2 opacity-85">
                          <div className="flex justify-between items-start">
                            <span className="font-mono text-xs font-black text-slate-900">{scoot.chassisNo}</span>
                            <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold font-sans uppercase">{scoot.color}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-sans space-y-0.5">
                            <div>Model: <strong className="text-slate-800">{scoot.modelName}</strong></div>
                            <div className="text-slate-800 truncate">Buyer: <strong>{scoot.buyerName}</strong></div>
                          </div>
                          <div className="pt-2 border-t border-slate-100 text-center text-[9px] text-slate-400 italic">
                            POS Checkout Logged
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}

        </div>
      </div>
      )}

      {/* Assembly/POS Serial Code Scanner Modal Overlay */}
      {assemblyScannerTarget && (
        <div className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <QRSerialScanner
            title={
              assemblyScannerTarget.type === 'charger_checkout'
                ? "🔌 Scan Charger Serial"
                : `🔋 Scan Battery Serial #${(assemblyScannerTarget.index ?? 0) + 1}`
            }
            type={assemblyScannerTarget.type === 'charger_checkout' ? 'charger' : 'battery'}
            existingSerials={
              assemblyScannerTarget.type === 'charger_checkout'
                ? (posChargerSerial ? [posChargerSerial] : [])
                : assemblyScannerTarget.type === 'battery_checkout'
                ? (s4Batteries[assemblyScannerTarget.index ?? 0] ? [s4Batteries[assemblyScannerTarget.index ?? 0]] : [])
                : (prepBatteries[assemblyScannerTarget.index ?? 0] ? [prepBatteries[assemblyScannerTarget.index ?? 0]] : [])
            }
            allRegisteredSerials={
              assemblyScannerTarget.type === 'charger_checkout'
                ? allRegisteredChargerSerialsInAssembly
                : allRegisteredBatterySerialsInAssembly
            }
            targetQuantity={1}
            onConfirm={(scannedSerials) => {
              const scannedValue = scannedSerials[0] || '';
              if (assemblyScannerTarget.type === 'charger_checkout') {
                setPosChargerSerial(scannedValue);
              } else if (assemblyScannerTarget.type === 'battery_checkout') {
                const idx = assemblyScannerTarget.index ?? 0;
                handleBatterySerialChange(idx, scannedValue);
              } else if (assemblyScannerTarget.type === 'battery_prep') {
                const idx = assemblyScannerTarget.index ?? 0;
                handlePrepBatteryChange(idx, scannedValue);
              }
              setAssemblyScannerTarget(null);
            }}
            onCancel={() => setAssemblyScannerTarget(null)}
          />
        </div>
      )}

    </div>
  );
}
