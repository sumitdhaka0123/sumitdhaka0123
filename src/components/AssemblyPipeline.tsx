import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Layers, Settings, ShoppingBag, Battery, ShieldCheck, Search, Calendar, 
  ChevronRight, Plus, Trash, Trash2, PlusCircle, CheckCircle2, Sparkles, Filter, Info, AlertTriangle, Hammer, AlertCircle, User,
  LayoutGrid, Kanban, ClipboardList, RefreshCw, Store
} from 'lucide-react';
import { ScooterUnit, Product, Buyer, User as SessionUser, StockLog, BatterySale, BatteryImport, ChargerSale, ChargerImport, SalesOrder } from '../types';
import { formatUserMessage } from '../utils/errorHelper';
import BatterySalesManager from './BatterySalesManager';
import ChargerSalesManager from './ChargerSalesManager';
import { SalesOrderTerminal } from './SalesOrderTerminal';
import { SearchableDropdown } from './SearchableDropdown';
import { inspectChallanNumber } from '../utils/challanUtils';
import { ChallanStatusCard } from './ChallanStatusCard';
import { generateSerialRangeHelper } from '../utils/serialUtils';

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
  salesOrders?: SalesOrder[];
  onReleaseChargerHold?: (id: string) => Promise<boolean>;
  onFinalizeChargerHold?: (id: string) => Promise<boolean>;
  onSelectDetailScooter?: (scooter: ScooterUnit) => void;
  onShowMobileNotification?: (message: string) => void;
  initialTab?: 'stage1' | 'stage3' | 'stage2';
}

export default function AssemblyPipeline({ 
  products, 
  buyers = [], 
  scooterUnits, 
  stockLogs = [],
  currentUser, 
  salesOrders = [],
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
  onShowMobileNotification,
  initialTab
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
    initialTab || (currentUser.role === 'salesperson' ? 'stage3' : 'stage1')
  );

  useEffect(() => {
    if (initialTab) {
      setActiveStepTab(initialTab);
    }
  }, [initialTab]);

  // Sub-navigation inside Stage 3 (Sell) tab: B2B Sales Orders (Salesman Terminal) vs Retail POS
  const [sellTabMode, setSellTabMode] = useState<'b2b' | 'retail'>(
    currentUser.role === 'salesperson' ? 'retail' : 'b2b'
  );


  
  // Sub-navigation inside Stage 1 tab
  const [stage1SubTab, setStage1SubTab] = useState<'assemble_single' | 'assemble_bulk'>('assemble_bulk');

  // Status feedback
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  
  // Filters and Searching
  const [searchQuery, setSearchQuery] = useState('');
  const [searchTargetFilter, setSearchTargetFilter] = useState<'all' | 'buyer' | 'chassis' | 'motor' | 'controller' | 'model' | 'color'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'sold' | 'hold'>('all');
  const [tireFilter, setTireFilter] = useState<'all' | '10-inch' | '12-inch'>('all');
  const [registryViewMode, setRegistryViewMode] = useState<'list' | 'grid' | 'board'>('list');

  // --- LOCAL DRAFT PERSISTENCE MECHANISM ---
  // Guarantees filled chassis, motor, and form data survive location checks, re-renders, and page refreshes
  const initialDraft = React.useMemo(() => {
    try {
      const saved = localStorage.getItem('voltstock_assembly_draft_v2');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {}
    return null;
  }, []);

  // --- STAGE 1A FORM STATE: CORE FRAME ASSEMBLY ---
  const [s1Model, setS1Model] = useState<string>(initialDraft?.s1Model || '');
  const [s1Color, setS1Color] = useState<string>(initialDraft?.s1Color || '');
  const [s1Chassis, setS1Chassis] = useState<string>(initialDraft?.s1Chassis || '');
  const [s1Motor, setS1Motor] = useState<string>(initialDraft?.s1Motor || '');
  const [s1Controller, setS1Controller] = useState<string>(initialDraft?.s1Controller || '');
  // Serial Number Prefix Bar / Starting Series for fast entry
  const [s1ChassisPrefix, setS1ChassisPrefix] = useState<string>(initialDraft?.s1ChassisPrefix || '');
  const [s1MotorPrefix, setS1MotorPrefix] = useState<string>(initialDraft?.s1MotorPrefix || '');
  const [s1ControllerPrefix, setS1ControllerPrefix] = useState<string>(initialDraft?.s1ControllerPrefix || '');
  const [s1FrontTireSize, setS1FrontTireSize] = useState<'10-inch' | '12-inch'>(initialDraft?.s1FrontTireSize || '12-inch');
  const [s1RearTireSize, setS1RearTireSize] = useState<'10-inch' | '12-inch'>(initialDraft?.s1RearTireSize || '12-inch');
  const [s1Source, setS1Source] = useState<'container_freight' | 'local_seller'>(initialDraft?.s1Source || 'container_freight');

  // Dynamic list of bulk scooter slots (persisted in draft)
  const [s1BulkScooters, setS1BulkScooters] = useState<{ chassisNo: string; motorNo: string; controllerNo: string }[]>(
    initialDraft?.s1BulkScooters && Array.isArray(initialDraft.s1BulkScooters) && initialDraft.s1BulkScooters.length > 0
      ? initialDraft.s1BulkScooters
      : [{ chassisNo: '', motorNo: '', controllerNo: '' }]
  );

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

  // Helper to generate incremented serial numbers preserving letters/prefixes and padding
  const generateSequentialSerial = (startStr: string, index: number): string => {
    if (!startStr || !startStr.trim()) return '';
    const str = startStr.trim().toUpperCase();
    const match = str.match(/^(.*?)(0*(\d+))$/);
    if (!match) {
      return index === 0 ? str : `${str}-${index + 1}`;
    }
    const prefix = match[1];
    const fullNumStr = match[2];
    const startNum = parseInt(match[3], 10);
    const targetNum = startNum + index;
    const numLength = fullNumStr.length;
    const newNumStr = targetNum.toString().padStart(numLength, '0');
    return `${prefix}${newNumStr}`;
  };

  const autoSequenceAllSlots = () => {
    const startChassis = s1ChassisPrefix || (s1BulkScooters[0] ? s1BulkScooters[0].chassisNo : '');
    const startMotor = s1MotorPrefix || (s1BulkScooters[0] ? s1BulkScooters[0].motorNo : '');
    const startController = s1ControllerPrefix || (s1BulkScooters[0] ? s1BulkScooters[0].controllerNo : '');

    if (!startChassis && !startMotor && !startController) {
      triggerAlert('error', 'Please enter a starting number in at least one column (or Slot #1) to auto-generate sequence.');
      return;
    }

    const updated = s1BulkScooters.map((scoot, idx) => {
      const newChassis = startChassis ? generateSequentialSerial(startChassis, idx) : scoot.chassisNo;
      const newMotor = startMotor ? generateSequentialSerial(startMotor, idx) : scoot.motorNo;
      const newController = startController ? generateSequentialSerial(startController, idx) : scoot.controllerNo;
      return {
        chassisNo: newChassis,
        motorNo: newMotor,
        controllerNo: newController
      };
    });
    setS1BulkScooters(updated);
    triggerAlert('success', `Auto-generated sequential numbers for Chassis, Motor & Controller across all ${s1BulkScooters.length} slots!`);
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
  const [s3BuyerName, setS3BuyerName] = useState<string>(initialDraft?.s3BuyerName || '');
  const [s3BuyerContact, setS3BuyerContact] = useState<string>(initialDraft?.s3BuyerContact || '');
  const [s3BuyerAddress, setS3BuyerAddress] = useState<string>(initialDraft?.s3BuyerAddress || '');
  const [s3BillNo, setS3BillNo] = useState<string>(initialDraft?.s3BillNo || '');
  const [s3DeliveryChallanNo, setS3DeliveryChallanNo] = useState<string>(initialDraft?.s3DeliveryChallanNo || '');
  const [s3DispatchMode, setS3DispatchMode] = useState<'sold' | 'hold'>('sold');

  // Inspect Stage 3 Delivery Challan Number
  const s3ChallanInfo = useMemo(() => {
    return inspectChallanNumber(s3DeliveryChallanNo, scooterUnits, batterySales, chargerSales);
  }, [s3DeliveryChallanNo, scooterUnits, batterySales, chargerSales]);

  // Active pending delivery challan numbers for Stage 3 Wholesale POS
  const s3ActiveChallanNumbers = useMemo(() => {
    const set = new Set<string>();
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
    if (chargerSales) {
      chargerSales.forEach(c => {
        if (c.deliveryChallanNo && c.challanStatus !== 'finished') set.add(c.deliveryChallanNo.toUpperCase());
      });
    }
    return Array.from(set);
  }, [scooterUnits, batterySales, chargerSales]);

  // Auto-fill buyer details and bill number if an active pending challan is entered in Stage 3
  useEffect(() => {
    if (s3ChallanInfo.exists && !s3ChallanInfo.isFinished) {
      if (s3ChallanInfo.buyerName) {
        setS3BuyerName(s3ChallanInfo.buyerName);
      }
      if (s3ChallanInfo.buyerContact) {
        setS3BuyerContact(s3ChallanInfo.buyerContact);
      }
      if (s3ChallanInfo.billNo) {
        setS3BillNo(s3ChallanInfo.billNo);
      }
    }
  }, [s3ChallanInfo]);

  // Integrated retail sales options
  const [s3ModelSelected, setS3ModelSelected] = useState('');
  const [posIncludeScooter, setPosIncludeScooter] = useState(true);
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
  
  const posBatteryStockMap = useMemo(() => {
    const map: Record<string, { imported: number; sold: number; assignedToScooters: number; available: number }> = {};
    if (batteryImports && Array.isArray(batteryImports)) {
      batteryImports.forEach(imp => {
        const series = (imp.batterySeries || 'Standard Series').trim();
        if (!map[series]) map[series] = { imported: 0, sold: 0, assignedToScooters: 0, available: 0 };
        map[series].imported += (imp.quantity || (imp.serialNumbers ? imp.serialNumbers.length : 0) || 0);
      });
    }
    if (batterySales && Array.isArray(batterySales)) {
      batterySales.forEach(sale => {
        const series = (sale.batterySeries || 'Standard Series').trim();
        if (!map[series]) map[series] = { imported: 0, sold: 0, assignedToScooters: 0, available: 0 };
        map[series].sold += (sale.quantity || (sale.serialNumbers ? sale.serialNumbers.length : 0) || 0);
      });
    }
    if (scooterUnits && Array.isArray(scooterUnits)) {
      scooterUnits.forEach(u => {
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
    }
    Object.keys(map).forEach(k => {
      map[k].available = Math.max(0, map[k].imported - map[k].sold - map[k].assignedToScooters);
    });
    return map;
  }, [batteryImports, batterySales, scooterUnits]);

  const posChargerStockMap = useMemo(() => {
    const map: Record<string, { imported: number; sold: number; assignedToScooters: number; available: number }> = {};
    if (chargerImports && Array.isArray(chargerImports)) {
      chargerImports.forEach(imp => {
        const type = (imp.chargerType || 'Standard Charger').trim();
        if (!map[type]) map[type] = { imported: 0, sold: 0, assignedToScooters: 0, available: 0 };
        map[type].imported += (imp.quantity || (imp.serialNumbers ? imp.serialNumbers.length : 0) || 0);
      });
    }
    if (chargerSales && Array.isArray(chargerSales)) {
      chargerSales.forEach(sale => {
        const type = (sale.chargerType || 'Standard Charger').trim();
        if (!map[type]) map[type] = { imported: 0, sold: 0, assignedToScooters: 0, available: 0 };
        map[type].sold += (sale.quantity || (sale.serialNumbers ? sale.serialNumbers.length : 0) || 0);
      });
    }
    if (scooterUnits && Array.isArray(scooterUnits)) {
      scooterUnits.forEach(u => {
        if (u.chargerIncluded || u.chargerType || u.chargerSerial) {
          const type = (u.chargerType || 'Standard Charger').trim();
          if (map[type]) map[type].assignedToScooters += 1;
        }
      });
    }
    Object.keys(map).forEach(k => {
      map[k].available = Math.max(0, map[k].imported - map[k].sold - map[k].assignedToScooters);
    });
    return map;
  }, [chargerImports, chargerSales, scooterUnits]);

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
  const [s1BulkCSV, setS1BulkCSV] = useState<string>(initialDraft?.s1BulkCSV || '');
  const [s1BulkChassisList, setS1BulkChassisList] = useState<string>(initialDraft?.s1BulkChassisList || '');
  const [s1BulkMotorList, setS1BulkMotorList] = useState<string>(initialDraft?.s1BulkMotorList || '');
  const [s1BulkControllerList, setS1BulkControllerList] = useState<string>(initialDraft?.s1BulkControllerList || '');

  // Auto-save form draft to localStorage whenever fields change
  React.useEffect(() => {
    try {
      const hasAnyData = s1Model || s1Color || s1Chassis || s1Motor || s1Controller ||
        s1BulkScooters.some(s => s.chassisNo || s.motorNo || s.controllerNo) ||
        s1BulkCSV || s1BulkChassisList || s1BulkMotorList || s1BulkControllerList ||
        s3BuyerName || s3BuyerContact || s3BuyerAddress || s3BillNo || s3DeliveryChallanNo;

      if (hasAnyData) {
        const draft = {
          s1Model,
          s1Color,
          s1Chassis,
          s1Motor,
          s1Controller,
          s1ChassisPrefix,
          s1MotorPrefix,
          s1ControllerPrefix,
          s1FrontTireSize,
          s1RearTireSize,
          s1Source,
          s1BulkScooters,
          s1BulkCSV,
          s1BulkChassisList,
          s1BulkMotorList,
          s1BulkControllerList,
          s3BuyerName,
          s3BuyerContact,
          s3BuyerAddress,
          s3BillNo,
          s3DeliveryChallanNo
        };
        localStorage.setItem('voltstock_assembly_draft_v2', JSON.stringify(draft));
      }
    } catch (e) {
      console.error('Failed to auto-save assembly draft:', e);
    }
  }, [
    s1Model, s1Color, s1Chassis, s1Motor, s1Controller,
    s1FrontTireSize, s1RearTireSize, s1Source, s1BulkScooters,
    s1BulkCSV, s1BulkChassisList, s1BulkMotorList, s1BulkControllerList,
    s3BuyerName, s3BuyerContact, s3BuyerAddress, s3BillNo, s3DeliveryChallanNo
  ]);

  const handleClearAssemblyDraft = () => {
    try {
      localStorage.removeItem('voltstock_assembly_draft_v2');
    } catch (e) {}
    setS1Model('');
    setS1Color('');
    setS1Chassis('');
    setS1Motor('');
    setS1Controller('');
    setS1BulkScooters([{ chassisNo: '', motorNo: '', controllerNo: '' }]);
    setS1BulkCSV('');
    setS1BulkChassisList('');
    setS1BulkMotorList('');
    setS1BulkControllerList('');
    setS3BuyerName('');
    setS3BuyerContact('');
    setS3BuyerAddress('');
    setS3BillNo('');
    setS3DeliveryChallanNo('');
  };

  // Bulk POS Sales Checkout (Stage 3)
  const [s3IsBulk, setS3IsBulk] = useState(false);
  const [s3Mode, setS3Mode] = useState<'single' | 'bulk'>('single');
  const [s3BulkModel, setS3BulkModel] = useState('ALL');
  const [s3BulkColor, setS3BulkColor] = useState('ALL');
  const [s3BulkSearchTerm, setS3BulkSearchTerm] = useState('');
  const [s3BulkChassisPasted, setS3BulkChassisPasted] = useState('');
  const [s3BulkSelectedIds, setS3BulkSelectedIds] = useState<string[]>([]);
  const [s3BulkBatteriesRaw, setS3BulkBatteriesRaw] = useState('');
  const [s3BulkBatteriesPerScooter, setS3BulkBatteriesPerScooter] = useState(1);

  // Wholesale Battery & Charger State in Challan POS (Wholesale level)
  const [s3WholesaleBatterySeries, setS3WholesaleBatterySeries] = useState('Alpha');
  const [s3WholesaleBatteryStartNo, setS3WholesaleBatteryStartNo] = useState('');
  const [s3WholesaleBatteryEndNo, setS3WholesaleBatteryEndNo] = useState('');
  const [s3WholesaleBatteryQty, setS3WholesaleBatteryQty] = useState('1');
  const [s3WholesaleBatteryWarrantyActive, setS3WholesaleBatteryWarrantyActive] = useState(true);
  const [s3WholesaleBatteryWarrantyMonths, setS3WholesaleBatteryWarrantyMonths] = useState(12);

  const [s3WholesaleChargerType, setS3WholesaleChargerType] = useState('60V Charger');
  const [s3WholesaleChargerStartNo, setS3WholesaleChargerStartNo] = useState('');
  const [s3WholesaleChargerEndNo, setS3WholesaleChargerEndNo] = useState('');
  const [s3WholesaleChargerQty, setS3WholesaleChargerQty] = useState('1');
  const [s3WholesaleChargerSerials, setS3WholesaleChargerSerials] = useState('');
  const [s3WholesaleChargerWarrantyActive, setS3WholesaleChargerWarrantyActive] = useState(true);
  const [s3WholesaleChargerWarrantyMonths, setS3WholesaleChargerWarrantyMonths] = useState(12);

  // Default to ALL models and ALL colors for flexible multi-model wholesale
  React.useEffect(() => {
    if (!s3BulkModel) {
      setS3BulkModel('ALL');
    }
    if (!s3BulkColor) {
      setS3BulkColor('ALL');
    }
  }, []);

  // Adjust bulk POS color when model changes without clearing multi-model selection queue
  const handleBulkPOSModelChange = (modelName: string) => {
    setS3BulkModel(modelName);
    if (modelName !== 'ALL') {
      const prod = products.find(p => p.name === modelName);
      if (prod && prod.colors.length > 0) {
        setS3BulkColor('ALL');
      } else {
        setS3BulkColor('ALL');
      }
    } else {
      setS3BulkColor('ALL');
    }
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

  // Filter stock for bulk sales with multi-model, multi-color, and search features
  const availableBulkStock = React.useMemo(() => {
    return scooterUnits.filter(u => {
      if (u.status !== 'available' && u.status !== 'hold') return false;

      // Model filter
      if (s3BulkModel && s3BulkModel !== 'ALL' && u.modelName !== s3BulkModel) {
        return false;
      }

      // Color filter
      if (s3BulkColor && s3BulkColor !== 'ALL' && u.color !== s3BulkColor) {
        return false;
      }

      // Text search filter (Chassis, Motor, or Controller No)
      if (s3BulkSearchTerm && s3BulkSearchTerm.trim()) {
        const q = s3BulkSearchTerm.trim().toLowerCase();
        const matchChassis = u.chassisNo && u.chassisNo.toLowerCase().includes(q);
        const matchMotor = u.motorNo && u.motorNo.toLowerCase().includes(q);
        const matchController = u.controllerNo && u.controllerNo.toLowerCase().includes(q);
        if (!matchChassis && !matchMotor && !matchController) {
          return false;
        }
      }

      return true;
    });
  }, [scooterUnits, s3BulkModel, s3BulkColor, s3BulkSearchTerm]);

  // Handle chassis, motor, or controller pasting auto-selection across warehouse inventory
  React.useEffect(() => {
    if (!s3BulkChassisPasted) return;
    const pastedList = s3BulkChassisPasted
      .split(/[\n,;\t\r]+/)
      .map(s => s.trim().toUpperCase())
      .filter(Boolean);
    
    if (pastedList.length === 0) return;

    // Search across all available warehouse stock
    const availableStock = scooterUnits.filter(u => u.status === 'available' || u.status === 'hold');
    const matchedIds = availableStock
      .filter(u => 
        pastedList.includes(u.chassisNo.toUpperCase()) ||
        (u.motorNo && pastedList.includes(u.motorNo.toUpperCase())) ||
        (u.controllerNo && pastedList.includes(u.controllerNo.toUpperCase()))
      )
      .map(u => u.id);

    if (matchedIds.length > 0) {
      setS3BulkSelectedIds(prev => Array.from(new Set([...prev, ...matchedIds])));
    }
  }, [s3BulkChassisPasted, scooterUnits]);

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

  // Wholesale Challan POS checkout submit (Truck Dispatch)
  const handleStage3BulkSubmit = async (e?: React.FormEvent, submitStatus: 'sold' | 'hold' = 'sold') => {
    if (e) e.preventDefault();

    if (!posIncludeScooter && !posIncludeBattery && !posIncludeCharger) {
      triggerAlert('error', 'Please select at least one item category (Scooter, Battery, or Charger) for Wholesale Challan Dispatch.');
      return;
    }

    if (posIncludeScooter && s3BulkSelectedIds.length === 0) {
      triggerAlert('error', `Please select at least one scooter frame from inventory to ${submitStatus === 'hold' ? 'hold' : 'dispatch'}.`);
      return;
    }

    if (!s3BuyerName.trim()) {
      triggerAlert('error', `Buyer Name is required for wholesale ${submitStatus === 'hold' ? 'holding' : 'challan dispatch'}.`);
      return;
    }

    if (submitStatus === 'sold' && !s3DeliveryChallanNo.trim()) {
      triggerAlert('error', 'Delivery Challan Number is required to finalize wholesale dispatch.');
      return;
    }

    if (s3ChallanInfo.cleanNo && s3ChallanInfo.isFinished) {
      triggerAlert('error', `⛔ Delivery Challan #${s3ChallanInfo.cleanNo} is FINISHED & VERIFIED! This challan is locked. You cannot attach items to a finished challan. Please use a NEW, unique Delivery Challan Number.`);
      return;
    }

    setLoading(true);
    let overallSuccess = true;
    const dispatchedSummary: string[] = [];

    try {
      // Auto-register new buyer if they are not in the database
      const finalBuyerName = s3BuyerName.trim();
      if (finalBuyerName) {
        const buyerExists = buyers.some(b => b.name.toLowerCase() === finalBuyerName.toLowerCase());
        if (!buyerExists && onAddBuyer) {
          await onAddBuyer(finalBuyerName, s3BuyerContact.trim() || undefined, s3BuyerAddress.trim() || undefined, undefined, undefined, 'wholesale');
        }
      }

      // 1. Process Wholesale Scooters if enabled
      if (posIncludeScooter && s3BulkSelectedIds.length > 0) {
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
            buyerName: s3BuyerName.trim(),
            buyerContact: s3BuyerContact.trim(),
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

        if (res.ok) {
          dispatchedSummary.push(`${s3BulkSelectedIds.length} Vehicles`);
        } else {
          overallSuccess = false;
        }
      }

      // 2. Process Wholesale Batteries if enabled
      // 2. Process Wholesale Batteries if enabled
      if (posIncludeBattery) {
        let cleanBatSerials = s3BulkBatteriesRaw
          .split(/[\n,;\t\r]+/)
          .map(b => b.trim())
          .filter(Boolean);

        const batStart = s3WholesaleBatteryStartNo.trim().toUpperCase();
        const batEnd = s3WholesaleBatteryEndNo.trim().toUpperCase();
        const seriesName = s3WholesaleBatterySeries.trim() || 'Senzo';

        let parsedQty = Math.max(1, parseInt(s3WholesaleBatteryQty, 10) || 1);

        const startMatch = batStart.match(/^(.*?[\s\-_/\\#]*?)(\d+)$/i);
        const endMatch = batEnd.match(/^(.*?[\s\-_/\\#]*?)(\d+)$/i);
        if (startMatch && endMatch) {
          const sNum = parseInt(startMatch[2], 10);
          const eNum = parseInt(endMatch[2], 10);
          if (eNum >= sNum) {
            parsedQty = Math.max(parsedQty, eNum - sNum + 1);
          }
        }

        if (cleanBatSerials.length === 0 && batStart !== '') {
          cleanBatSerials = generateSerialRangeHelper(batStart, batEnd, parsedQty, seriesName);
        }

        parsedQty = Math.max(parsedQty, cleanBatSerials.length);

        const batPayload = {
          buyerName: s3BuyerName.trim(),
          buyerContact: s3BuyerContact.trim(),
          buyerAddress: s3BuyerAddress.trim(),
          batterySeries: seriesName,
          startNo: batStart || (cleanBatSerials[0] || 'N/A'),
          endNo: batEnd || (cleanBatSerials[cleanBatSerials.length - 1] || 'N/A'),
          quantity: parsedQty,
          serialNumbers: cleanBatSerials,
          notes: s5Notes,
          salesBillNo: s3BillNo.trim(),
          deliveryChallanNo: s3DeliveryChallanNo.trim(),
          isUnderWarranty: s3WholesaleBatteryWarrantyActive,
          warrantyDurationMonths: s3WholesaleBatteryWarrantyActive ? s3WholesaleBatteryWarrantyMonths : 0,
          status: submitStatus as any
        };

        if (onSubmitBatterySale) {
          const batOk = await onSubmitBatterySale(batPayload as any);
          if (batOk) dispatchedSummary.push(`${parsedQty} Battery Packs`);
          else overallSuccess = false;
        } else {
          const res = await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/battery-sales', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...batPayload, operator: currentUser.username })
          });
          if (res.ok) dispatchedSummary.push(`${parsedQty} Battery Packs`);
          else overallSuccess = false;
        }
      }

      // 3. Process Wholesale Chargers if enabled
      if (posIncludeCharger) {
        let cleanChgSerials = s3WholesaleChargerSerials
          .split(/[\n,;\t\r]+/)
          .map(c => c.trim().toUpperCase())
          .filter(Boolean);

        const chgStart = s3WholesaleChargerStartNo.trim().toUpperCase();
        const chgEnd = s3WholesaleChargerEndNo.trim().toUpperCase();
        const chgType = s3WholesaleChargerType.trim() || '60V Charger';

        let parsedChgQty = Math.max(1, parseInt(s3WholesaleChargerQty, 10) || 1);

        const chgStartMatch = chgStart.match(/^(.*?[\s\-_/\\#]*?)(\d+)$/i);
        const chgEndMatch = chgEnd.match(/^(.*?[\s\-_/\\#]*?)(\d+)$/i);
        if (chgStartMatch && chgEndMatch) {
          const sNum = parseInt(chgStartMatch[2], 10);
          const eNum = parseInt(chgEndMatch[2], 10);
          if (eNum >= sNum) {
            parsedChgQty = Math.max(parsedChgQty, eNum - sNum + 1);
          }
        }

        if (cleanChgSerials.length === 0 && chgStart !== '') {
          cleanChgSerials = generateSerialRangeHelper(chgStart, chgEnd, parsedChgQty, chgType);
        }

        parsedChgQty = Math.max(parsedChgQty, cleanChgSerials.length);

        const chgPayload = {
          buyerName: s3BuyerName.trim(),
          buyerContact: s3BuyerContact.trim(),
          buyerAddress: s3BuyerAddress.trim(),
          chargerType: chgType,
          startNo: chgStart || (cleanChgSerials[0] || 'N/A'),
          endNo: chgEnd || (cleanChgSerials[cleanChgSerials.length - 1] || 'N/A'),
          quantity: parsedChgQty,
          serialNumbers: cleanChgSerials,
          notes: s5Notes,
          salesBillNo: s3BillNo.trim(),
          deliveryChallanNo: s3DeliveryChallanNo.trim(),
          isUnderWarranty: s3WholesaleChargerWarrantyActive,
          warrantyDurationMonths: s3WholesaleChargerWarrantyActive ? s3WholesaleChargerWarrantyMonths : 0,
          status: submitStatus as any
        };

        if (onSubmitChargerSale) {
          const chgOk = await onSubmitChargerSale(chgPayload as any);
          if (chgOk) dispatchedSummary.push(`${parsedChgQty} Chargers`);
          else overallSuccess = false;
        } else {
          const res = await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/charger-sales', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...chgPayload, operator: currentUser.username })
          });
          if (res.ok) dispatchedSummary.push(`${parsedChgQty} Chargers`);
          else overallSuccess = false;
        }
      }

      if (overallSuccess) {
        if (submitStatus === 'hold') {
          triggerAlert('success', `🤝 Reservation Hold Created! Items reserved for ${s3BuyerName.toUpperCase()} [Included: ${dispatchedSummary.length > 0 ? dispatchedSummary.join(' + ') : 'Selection'}].`);
        } else {
          triggerAlert('success', `🚚 Wholesale Delivery Challan #${s3DeliveryChallanNo.toUpperCase()} Dispatched Successfully! Included: [${dispatchedSummary.length > 0 ? dispatchedSummary.join(' + ') : 'Wholesale Items'}]`);
        }
        setS3BulkSelectedIds([]);
        setS3BulkChassisPasted('');
        setS3BulkBatteriesRaw('');
        setS3BuyerName('');
        setS3BuyerContact('');
        setS3BuyerAddress('');
        setS3BillNo('');
        setS3DeliveryChallanNo('');
        setS5Notes('');
        setS3WholesaleBatteryStartNo('');
        setS3WholesaleBatteryEndNo('');
        setS3WholesaleBatteryQty('1');
        setS3WholesaleChargerSerials('');
        setS3WholesaleChargerQty('1');
        setS5ScooterWarrantyActive(true);
        setS5ScooterExpiry(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
        setS3WholesaleBatteryWarrantyActive(true);
        setS3WholesaleBatteryWarrantyMonths('12');
        setS3WholesaleChargerWarrantyActive(true);
        setS3WholesaleChargerWarrantyMonths('12');
        setPosIncludeScooter(true);
        setPosIncludeBattery(false);
        setPosIncludeCharger(false);
        onRefresh();
      } else {
        triggerAlert('error', 'Wholesale Challan dispatch completed with errors. Please verify data.');
      }
    } catch (err) {
      triggerAlert('error', `Network error during wholesale dispatch.`);
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
      try { localStorage.removeItem('voltstock_assembly_draft_v2'); } catch(e) {}
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
      const combineWithPrefix = (prefix: string, rawVal: string) => {
        const p = prefix.trim().toUpperCase();
        const v = rawVal.trim().toUpperCase();
        if (!v) return '';
        if (p && !v.startsWith(p)) {
          return `${p}${v}`;
        }
        return v;
      };

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
            chassisNo: combineWithPrefix(s1ChassisPrefix, item.chassisNo),
            motorNo: combineWithPrefix(s1MotorPrefix, item.motorNo),
            controllerNo: combineWithPrefix(s1ControllerPrefix, item.controllerNo)
          })),
          operator: currentUser.username
        })
      });

      const data = await res.json();
      if (res.ok) {
        triggerAlert('success', `Bulk Assembly Success! Registered ${data.count} units of ${s1Model} (${s1Color}) in warehouse inventory.`);
        setS1BulkScooters([{ chassisNo: '', motorNo: '', controllerNo: '' }]);
        try { localStorage.removeItem('voltstock_assembly_draft_v2'); } catch(e) {}
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
    if (!impQuantity) {
      triggerAlert('error', 'Please enter a valid battery quantity.');
      return;
    }

    const cleanSeries = impBatterySeries?.trim() || 'Standard';

    setLoading(true);
    const success = await onSubmitBatteryImport?.({
      batterySeries: cleanSeries,
      startNo: impStartNo.trim() || 'N/A',
      endNo: impEndNo.trim() || 'N/A',
      quantity: Number(impQuantity),
      supplierName: impSupplier,
      containerId: impContainerId,
      notes: impNotes
    });

    setLoading(false);
    if (success) {
      triggerAlert('success', `Success: Logged import of ${impQuantity} ${cleanSeries} batteries from abroad.`);
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

  // Stage 3: POS Checkout & Deliver (Challan Sales Chain)
  const handleStage3Submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!posIncludeScooter && !posIncludeBattery && !posIncludeCharger) {
      triggerAlert('error', 'Please select at least one item category (Scooter, Battery, or Charger) to process a Challan Sale.');
      return;
    }

    if (posIncludeScooter && !selectedPOSScooterId) {
      triggerAlert('error', 'Please choose a scooter chassis to include in this dispatch.');
      return;
    }

    if (!s3BuyerName.trim()) {
      triggerAlert('error', 'Buyer Name is required to process this transaction.');
      return;
    }

    if (!s3BillNo.trim()) {
      triggerAlert('error', 'Sales Bill Number is required to process this transaction.');
      return;
    }

    if (!s3DeliveryChallanNo.trim()) {
      triggerAlert('error', 'Delivery Challan Number is required to process this transaction.');
      return;
    }

    if (s3ChallanInfo.cleanNo && s3ChallanInfo.isFinished) {
      triggerAlert('error', `⛔ Delivery Challan #${s3ChallanInfo.cleanNo} is FINISHED & VERIFIED! This challan is locked. You cannot attach items to a finished challan. Please use a NEW, unique Delivery Challan Number.`);
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

    let overallSuccess = true;

    // 1. IF SCOOTER IS INCLUDED: Submit via assembly pipeline POS
    if (posIncludeScooter && selectedPOSScooterId) {
      const scooterWarrantyStatus = s5ScooterWarrantyActive ? 'Active' : 'None';
      const cleanBatteries = posIncludeBattery ? s4Batteries.filter(b => b && b.trim() !== '') : [];
      const cleanBatteryFlags = posIncludeBattery ? s4BatteryWarranties : [];
      const cleanBatteryMonths = posIncludeBattery ? s4BatteryWarrantyMonths.map(() => posBatteryWarrantyActive ? posBatteryWarrantyDuration : 0) : [];

      const scootSuccess = await onSubmitAssembly({
        id: selectedPOSScooterId,
        actionType: 'pos_stage3_4',
        buyerName: s3BuyerName.trim(),
        buyerContact: s3BuyerContact.trim(),
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

      if (!scootSuccess) overallSuccess = false;
    }

    // 2. IF SCOOTER IS NOT INCLUDED (Standalone Battery / Charger sale or combination)
    if (!posIncludeScooter) {
      // Dispatch Battery sale if enabled
      const cleanBatteries = s4Batteries.filter(b => b && b.trim() !== '');
      const parsedBatQty = Math.max(parseInt(s3WholesaleBatteryQty, 10) || 1, cleanBatteries.length);
      const batSeries = s3WholesaleBatterySeries || 'Alpha';
      const startNoVal = s3WholesaleBatteryStartNo.trim().toUpperCase() || (cleanBatteries[0] || 'N/A');
      const endNoVal = s3WholesaleBatteryEndNo.trim().toUpperCase() || (cleanBatteries[cleanBatteries.length - 1] || 'N/A');

      let finalSerials = cleanBatteries;
      if (cleanBatteries.length === 0 && startNoVal !== 'N/A' && endNoVal !== 'N/A') {
        finalSerials = generateSerialRangeHelper(startNoVal, endNoVal, parsedBatQty, batSeries);
      } else if (cleanBatteries.length > 0 && cleanBatteries.length < parsedBatQty && startNoVal !== 'N/A' && endNoVal !== 'N/A') {
        const generatedRange = generateSerialRangeHelper(startNoVal, endNoVal, parsedBatQty, batSeries);
        if (generatedRange.length >= parsedBatQty) {
          finalSerials = generatedRange;
        }
      }

      if (posIncludeBattery && (cleanBatteries.length > 0 || parsedBatQty > 0)) {
        const batPayload = {
          buyerName: s3BuyerName.trim(),
          buyerContact: s3BuyerContact.trim(),
          buyerAddress: s3BuyerAddress.trim(),
          batterySeries: batSeries,
          startNo: startNoVal,
          endNo: endNoVal,
          quantity: parsedBatQty,
          serialNumbers: finalSerials.length > 0 ? finalSerials : undefined,
          notes: s5Notes,
          salesBillNo: s3BillNo.trim(),
          deliveryChallanNo: s3DeliveryChallanNo.trim(),
          isUnderWarranty: posBatteryWarrantyActive,
          warrantyDurationMonths: posBatteryWarrantyActive ? posBatteryWarrantyDuration : 0,
          status: 'sold' as const
        };

        if (onSubmitBatterySale) {
          const batSuccess = await onSubmitBatterySale(batPayload as any);
          if (!batSuccess) overallSuccess = false;
        } else {
          try {
            const res = await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/battery-sales', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...batPayload, operator: currentUser.username })
            });
            if (!res.ok) overallSuccess = false;
          } catch (err) {
            overallSuccess = false;
          }
        }
      }

      // Dispatch Charger sale if enabled
      if (posIncludeCharger) {
        const cleanChargerSerial = posChargerSerial.trim().toUpperCase();
        const chgType = posChargerType || '60V Standard Charger';
        const chgStart = s3WholesaleChargerStartNo.trim().toUpperCase() || cleanChargerSerial || 'N/A';
        const chgEnd = s3WholesaleChargerEndNo.trim().toUpperCase() || cleanChargerSerial || 'N/A';
        
        let parsedChgQty = Math.max(1, parseInt(s3WholesaleChargerQty, 10) || 1);
        let chgSerials = cleanChargerSerial ? [cleanChargerSerial] : [];
        if (s3WholesaleChargerSerials.trim()) {
          const splitSerials = s3WholesaleChargerSerials.split(/[\n,;\t\r]+/).map(s => s.trim().toUpperCase()).filter(Boolean);
          if (splitSerials.length > 0) {
            chgSerials = splitSerials;
          }
        }
        if (chgSerials.length === 0 && chgStart !== 'N/A') {
          chgSerials = generateSerialRangeHelper(chgStart, chgEnd, parsedChgQty, chgType);
        }
        parsedChgQty = Math.max(parsedChgQty, chgSerials.length);

        const chgPayload = {
          buyerName: s3BuyerName.trim(),
          buyerContact: s3BuyerContact.trim(),
          buyerAddress: s3BuyerAddress.trim(),
          chargerType: chgType,
          startNo: chgStart,
          endNo: chgEnd,
          quantity: parsedChgQty,
          serialNumbers: chgSerials.length > 0 ? chgSerials : undefined,
          notes: s5Notes,
          salesBillNo: s3BillNo.trim(),
          deliveryChallanNo: s3DeliveryChallanNo.trim(),
          isUnderWarranty: posChargerWarrantyActive,
          warrantyDurationMonths: posChargerWarrantyActive ? posChargerWarrantyDuration : 0,
          status: 'sold' as const
        };

        if (onSubmitChargerSale) {
          const chgSuccess = await onSubmitChargerSale(chgPayload as any);
          if (!chgSuccess) overallSuccess = false;
        } else {
          try {
            const res = await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/charger-sales', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...chgPayload, operator: currentUser.username })
            });
            if (!res.ok) overallSuccess = false;
          } catch (err) {
            overallSuccess = false;
          }
        }
      }
    }

    if (overallSuccess) {
      const itemTypes = [];
      if (posIncludeScooter) itemTypes.push('Scooter');
      if (posIncludeBattery) itemTypes.push('Battery');
      if (posIncludeCharger) itemTypes.push('Charger');

      triggerAlert('success', `Challan Sale Completed! Dispatched [${itemTypes.join(' + ')}] under Delivery Challan #${s3DeliveryChallanNo.toUpperCase()}.`);
      setS3BuyerName('');
      setS3BuyerContact('');
      setS3BuyerAddress('');
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
      setPosIncludeScooter(true);
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
      triggerAlert('error', 'Checkout transaction failed. Please check field inputs and try again.');
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

    let matchesSearch = true;
    if (query) {
      if (searchTargetFilter === 'buyer') {
        const buyer = String(scoot.buyerName || scoot.heldFor || '').toLowerCase();
        matchesSearch = buyer.includes(query);
      } else if (searchTargetFilter === 'chassis') {
        matchesSearch = String(scoot.chassisNo || '').toLowerCase().includes(query);
      } else if (searchTargetFilter === 'motor') {
        matchesSearch = String(scoot.motorNo || '').toLowerCase().includes(query);
      } else if (searchTargetFilter === 'controller') {
        matchesSearch = String(scoot.controllerNo || '').toLowerCase().includes(query);
      } else if (searchTargetFilter === 'model') {
        matchesSearch = String(scoot.modelName || '').toLowerCase().includes(query);
      } else if (searchTargetFilter === 'color') {
        matchesSearch = String(scoot.color || '').toLowerCase().includes(query);
      } else { // 'all'
        matchesSearch = 
          String(scoot.chassisNo || '').toLowerCase().includes(query) ||
          String(scoot.motorNo || '').toLowerCase().includes(query) ||
          String(scoot.controllerNo || '').toLowerCase().includes(query) ||
          String(scoot.modelName || '').toLowerCase().includes(query) ||
          String(scoot.color || '').toLowerCase().includes(query) ||
          (scoot.buyerName && String(scoot.buyerName || '').toLowerCase().includes(query)) ||
          (scoot.heldFor && String(scoot.heldFor || '').toLowerCase().includes(query));
      }
    } else {
      // If query is empty but filter is explicitly set to 'buyer', show only units with buyer/reservation
      if (searchTargetFilter === 'buyer') {
        matchesSearch = !!(scoot.buyerName || scoot.heldFor);
      }
    }

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
            
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                🛡️ Form Safe (Auto-Saved)
              </span>
              {(s1Chassis || s1Motor || s1Controller || s1Model || s1BulkScooters.some(s => s.chassisNo || s.motorNo || s.controllerNo) || s1BulkCSV) && (
                <button
                  type="button"
                  onClick={handleClearAssemblyDraft}
                  className="text-[10px] font-bold text-slate-500 hover:text-rose-600 bg-slate-100 hover:bg-rose-50 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                  title="Clear auto-saved form draft"
                >
                  Clear Form Draft
                </button>
              )}
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
                      
                      {/* 3 Column Prefix & Starting Series Assistant Bar */}
                      <div className="p-3.5 bg-cyan-50/80 border border-cyan-200 rounded-2xl space-y-2.5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <span className="text-[11px] font-black uppercase text-cyan-900 font-sans tracking-wide flex items-center gap-1.5">
                            <span>🚀 Batch Starting Series & Prefix Assistant (3-Column Hardware Fast-Entry)</span>
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={autoSequenceAllSlots}
                              className="px-3 py-1 bg-cyan-600 hover:bg-cyan-700 active:bg-cyan-800 text-white text-[11px] font-bold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1 font-sans"
                            >
                              <span>⚡ Auto-Sequence All Units</span>
                            </button>
                            {(s1ChassisPrefix || s1MotorPrefix || s1ControllerPrefix) && (
                              <button
                                type="button"
                                onClick={() => {
                                  setS1ChassisPrefix('');
                                  setS1MotorPrefix('');
                                  setS1ControllerPrefix('');
                                }}
                                className="text-[10px] font-bold text-cyan-700 hover:text-cyan-900 underline cursor-pointer"
                              >
                                Clear
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-[10px] text-cyan-800 font-sans">
                          Enter starting serial numbers or prefixes (e.g. Chassis: <strong>CHS-1001</strong>, Motor: <strong>MTR-5001</strong>, Controller: <strong>CTL-8001</strong>). Click <strong>⚡ Auto-Sequence All Units</strong> to automatically fill incrementing serial numbers across all active hardware slots!
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
                          <div>
                            <label className="block text-[9px] font-extrabold text-cyan-900 uppercase mb-1 font-sans">
                              Starting Chassis Series / Prefix
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. CHS-1001 or CHS-2026-"
                              value={s1ChassisPrefix}
                              onChange={(e) => setS1ChassisPrefix(e.target.value.toUpperCase())}
                              className="w-full bg-white border border-cyan-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:border-cyan-600 outline-none uppercase"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-extrabold text-cyan-900 uppercase mb-1 font-sans">
                              Starting Motor Series / Prefix
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. MTR-5001 or MTR-8899-"
                              value={s1MotorPrefix}
                              onChange={(e) => setS1MotorPrefix(e.target.value.toUpperCase())}
                              className="w-full bg-white border border-cyan-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:border-cyan-600 outline-none uppercase"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-extrabold text-cyan-900 uppercase mb-1 font-sans">
                              Starting Controller Series / Prefix
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. CTL-8001 or CTL-3322-"
                              value={s1ControllerPrefix}
                              onChange={(e) => setS1ControllerPrefix(e.target.value.toUpperCase())}
                              className="w-full bg-white border border-cyan-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:border-cyan-600 outline-none uppercase"
                            />
                          </div>
                        </div>
                      </div>

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
                                <div className="relative flex items-center">
                                  {s1ChassisPrefix && (
                                    <span className="bg-cyan-100 text-cyan-900 text-[10px] font-black font-mono px-2 py-2 sm:py-1.5 rounded-l-xl border-y border-l border-cyan-300 shrink-0">
                                      {s1ChassisPrefix}
                                    </span>
                                  )}
                                  <input
                                    type="text"
                                    placeholder={s1ChassisPrefix ? "Last 4-6 digits" : `CHASSIS-${1001 + idx}`}
                                    value={scoot.chassisNo}
                                    onChange={(e) => handleBulkScooterChange(idx, 'chassisNo', e.target.value)}
                                    className={`w-full bg-slate-50 border border-slate-200 ${s1ChassisPrefix ? 'rounded-r-xl border-l-0' : 'rounded-xl'} px-3 py-3 sm:py-2 text-base sm:text-xs text-slate-800 font-sans uppercase focus:border-cyan-500 outline-none`}
                                    required
                                  />
                                </div>
                                {scoot.chassisNo.trim() && (
                                  <span className="text-[10px] text-cyan-700 font-mono font-bold mt-1 block">
                                    Full: {s1ChassisPrefix && !scoot.chassisNo.toUpperCase().startsWith(s1ChassisPrefix) ? `${s1ChassisPrefix}${scoot.chassisNo.toUpperCase()}` : scoot.chassisNo.toUpperCase()}
                                  </span>
                                )}
                              </div>
                              <div>
                                <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wide mb-1 font-sans">
                                  Motor Number
                                </label>
                                <div className="relative flex items-center">
                                  {s1MotorPrefix && (
                                    <span className="bg-cyan-100 text-cyan-900 text-[10px] font-black font-mono px-2 py-2 sm:py-1.5 rounded-l-xl border-y border-l border-cyan-300 shrink-0">
                                      {s1MotorPrefix}
                                    </span>
                                  )}
                                  <input
                                    type="text"
                                    placeholder={s1MotorPrefix ? "Last 4-6 digits" : `MOTOR-${1001 + idx}`}
                                    value={scoot.motorNo}
                                    onChange={(e) => handleBulkScooterChange(idx, 'motorNo', e.target.value)}
                                    className={`w-full bg-slate-50 border border-slate-200 ${s1MotorPrefix ? 'rounded-r-xl border-l-0' : 'rounded-xl'} px-3 py-3 sm:py-2 text-base sm:text-xs text-slate-800 font-sans uppercase focus:border-cyan-500 outline-none`}
                                    required
                                  />
                                </div>
                                {scoot.motorNo.trim() && (
                                  <span className="text-[10px] text-cyan-700 font-mono font-bold mt-1 block">
                                    Full: {s1MotorPrefix && !scoot.motorNo.toUpperCase().startsWith(s1MotorPrefix) ? `${s1MotorPrefix}${scoot.motorNo.toUpperCase()}` : scoot.motorNo.toUpperCase()}
                                  </span>
                                )}
                              </div>
                              <div>
                                <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wide mb-1 font-sans">
                                  Controller Number
                                </label>
                                <div className="relative flex items-center">
                                  {s1ControllerPrefix && (
                                    <span className="bg-cyan-100 text-cyan-900 text-[10px] font-black font-mono px-2 py-2 sm:py-1.5 rounded-l-xl border-y border-l border-cyan-300 shrink-0">
                                      {s1ControllerPrefix}
                                    </span>
                                  )}
                                  <input
                                    type="text"
                                    placeholder={s1ControllerPrefix ? "Last 4-6 digits" : `CTRL-${1001 + idx}`}
                                    value={scoot.controllerNo}
                                    onChange={(e) => handleBulkScooterChange(idx, 'controllerNo', e.target.value)}
                                    className={`w-full bg-slate-50 border border-slate-200 ${s1ControllerPrefix ? 'rounded-r-xl border-l-0' : 'rounded-xl'} px-3 py-3 sm:py-2 text-base sm:text-xs text-slate-800 font-sans uppercase focus:border-cyan-500 outline-none`}
                                    required
                                  />
                                </div>
                                {scoot.controllerNo.trim() && (
                                  <span className="text-[10px] text-cyan-700 font-mono font-bold mt-1 block">
                                    Full: {s1ControllerPrefix && !scoot.controllerNo.toUpperCase().startsWith(s1ControllerPrefix) ? `${s1ControllerPrefix}${scoot.controllerNo.toUpperCase()}` : scoot.controllerNo.toUpperCase()}
                                  </span>
                                )}
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
                {/* Sub-tab mode switcher: B2B Sales Orders (Salesman Terminal) vs Direct Retail Checkout */}
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200" id="sell-stage-mode-switcher">
                  <button
                    type="button"
                    onClick={() => setSellTabMode('b2b')}
                    className={`py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                      sellTabMode === 'b2b'
                        ? 'bg-cyan-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                    id="sell-b2b-tab-btn"
                  >
                    <ShoppingBag className="h-4 w-4" />
                    <span>🛒 B2B / Wholesale Sales Orders</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSellTabMode('retail')}
                    className={`py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                      sellTabMode === 'retail'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                    id="sell-retail-tab-btn"
                  >
                    <Store className="h-4 w-4" />
                    <span>🏪 Instant Direct Retail Store Sale</span>
                  </button>
                </div>

                {sellTabMode === 'b2b' ? (
                  <div className="p-2 sm:p-4 bg-white border border-slate-200 rounded-3xl shadow-xs">
                    <SalesOrderTerminal 
                      products={products}
                      buyers={buyers}
                      batteryTypes={batterySeriesList}
                      chargerTypes={chargerTypeList}
                      currentUser={currentUser}
                      salesOrders={salesOrders}
                      onRefresh={onRefresh}
                    />
                  </div>
                ) : (
                  <>
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
                  {s3Mode === 'single' && (
                    <form onSubmit={handleStage3Submit} className="space-y-4">
                      {/* 1. MODEL & CHASSIS SELECTION */}
                      {posIncludeScooter && (
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
                                  label: `Chassis: ${scoot.chassisNo} — Model: ${scoot.modelName} (${scoot.color})${scoot.status === 'hold' ? ` [🤝 HELD FOR ${scoot.heldFor?.toUpperCase()}]` : ''}`
                                }))}
                              value={selectedPOSScooterId}
                              onChange={(val) => handlePOSScooterSelect(val)}
                              placeholder="-- Choose Chassis --"
                              required
                            />
                          </div>
                        </div>
                      )}

                      {(posIncludeScooter ? Boolean(selectedPOSScooterId) : (posIncludeBattery || posIncludeCharger)) && (
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
                                      Bill Number * <span className="text-[9px] text-amber-600 font-normal lowercase">(Optional for Hold)</span>
                                    </label>
                                    <input
                                      type="text"
                                      placeholder="Enter sales bill number"
                                      value={s3BillNo}
                                      onChange={(e) => setS3BillNo(e.target.value)}
                                      className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-base sm:text-xs text-slate-800 focus:border-cyan-500 outline-none font-sans uppercase font-semibold"
                                    />
                                  </div>

                                  <div>
                                    <div className="flex items-center justify-between mb-1 font-sans">
                                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                                        Chalan (Challan) Number * <span className="text-[9px] text-amber-600 font-normal lowercase">(Optional for Hold)</span>
                                      </label>
                                      {s3DeliveryChallanNo ? (
                                        <span className="text-[11px] font-mono font-black text-cyan-800 bg-cyan-100 border border-cyan-300 px-2 py-0.5 rounded-md shadow-2xs">
                                          [ Challan #{s3DeliveryChallanNo.toUpperCase()} ]
                                        </span>
                                      ) : (
                                        <span className="text-[10px] font-mono text-slate-400 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                                          [ No Challan Selected ]
                                        </span>
                                      )}
                                    </div>

                                    {/* Clickable Active Pending Challans Bar */}
                                    {s3ActiveChallanNumbers.length > 0 && (
                                      <div className="mb-2 p-2 bg-cyan-50 border border-cyan-200 rounded-xl">
                                        <span className="block text-[10px] font-extrabold text-cyan-900 uppercase tracking-wider mb-1 font-sans">
                                          📋 Click to auto-fill pending Delivery Challan:
                                        </span>
                                        <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                                          {s3ActiveChallanNumbers.map((cNo) => (
                                            <button
                                              key={cNo}
                                              type="button"
                                              onClick={() => setS3DeliveryChallanNo(cNo)}
                                              className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer border ${
                                                s3DeliveryChallanNo.toUpperCase() === cNo
                                                  ? 'bg-cyan-600 text-white border-cyan-700 shadow-xs scale-105'
                                                  : 'bg-white text-cyan-800 border-cyan-200 hover:bg-cyan-100'
                                              }`}
                                            >
                                              #{cNo}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    <input
                                      type="text"
                                      placeholder="Enter delivery chalan number (or click active above)"
                                      list="s3-active-challans-list"
                                      value={s3DeliveryChallanNo}
                                      onChange={(e) => setS3DeliveryChallanNo(e.target.value)}
                                      className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-base sm:text-xs text-slate-800 focus:border-cyan-500 outline-none font-sans uppercase font-semibold"
                                    />
                                    <datalist id="s3-active-challans-list">
                                      {s3ActiveChallanNumbers.map(cNo => (
                                        <option key={cNo} value={cNo} />
                                      ))}
                                    </datalist>
                                    <ChallanStatusCard info={s3ChallanInfo} currentUser={currentUser} />
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
                                        onClick={() => {}}
                                        className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg cursor-pointer transition-all flex items-center justify-center shrink-0 text-sm"
                                        title="Scan QR Code" hidden
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

                          {/* 5. SCOOTER WARRANTY SELECTION */}
                          {posIncludeScooter && (
                            <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-3.5">
                              <span className="block text-[10px] font-bold text-purple-700 font-sans tracking-wide uppercase">
                                🛡️ Scooter Warranty Coverage
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
                                    <span>Include Scooter Warranty</span>
                                  </label>
                                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${s5ScooterWarrantyActive ? 'bg-purple-100 text-purple-800 border-purple-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                    {s5ScooterWarrantyActive ? `${posScooterWarrantyDuration} Months` : 'No Warranty'}
                                  </span>
                                </div>

                                {s5ScooterWarrantyActive && (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white border border-slate-200 rounded-xl p-3">
                                    <div>
                                      <label className="block text-[9px] text-slate-500 font-sans uppercase font-bold mb-1">
                                        Scooter Warranty Duration
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
                          )}

                          {/* 6. TERMS & CONDITIONS (MANDATORY APPLICABILITY NOTICE) */}
                          <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl space-y-2.5">
                            <div className="text-xs font-semibold text-amber-900 flex items-center gap-1.5">
                              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                              <span>Terms & Conditions Apply *</span>
                            </div>
                            <p className="text-[11px] text-amber-800 leading-relaxed font-sans">
                              Warranties issued for Scooter, Battery cells, and Charger units are strictly subject to standard manufacturer conditions and customer service policies.
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

                      {posIncludeScooter && selectedPOSScooterId && scooterUnits.find(u => u.id === selectedPOSScooterId)?.status === 'hold' && (
                        <div className="p-3.5 bg-amber-500/5 border border-amber-500/15 text-amber-800 rounded-2xl text-xs flex items-center gap-2">
                          <Info className="h-4 w-4 text-amber-600 shrink-0" />
                          <span>This scooter is currently <strong>Reserved / On Hold</strong> for <strong>{scooterUnits.find(u => u.id === selectedPOSScooterId)?.heldFor}</strong>. Finalizing the sale will complete the POS and transition status to SOLD.</span>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                          type="submit"
                          disabled={loading || (posIncludeScooter && !selectedPOSScooterId) || s3ChallanInfo.isFinished || (!posIncludeScooter && !posIncludeBattery && !posIncludeCharger)}
                          className="py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-sans font-bold text-xs active:scale-[0.99] transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-sm animate-pulse-slow"
                        >
                          <ShoppingBag className="h-4.5 w-4.5" />
                          <span>
                            {posIncludeScooter 
                              ? 'Finalize Sale & Dispatch' 
                              : `Dispatch ${[posIncludeBattery && 'Battery', posIncludeCharger && 'Charger'].filter(Boolean).join(' & ')} Sale`}
                          </span>
                        </button>

                        {posIncludeScooter && (
                          <button
                            type="button"
                            onClick={handlePlaceOnHold}
                            disabled={loading || !selectedPOSScooterId || scooterUnits.find(u => u.id === selectedPOSScooterId)?.status === 'hold' || s3ChallanInfo.isFinished}
                            className="py-3.5 rounded-2xl bg-amber-50 border border-amber-200 hover:bg-amber-100 text-amber-700 font-sans font-bold text-xs active:scale-[0.99] transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                          >
                            <User className="h-4.5 w-4.5 text-amber-600" />
                            <span>Place on Hold / Reserve</span>
                          </button>
                        )}
                      </div>
                    </form>
                  )}

                  {s3Mode === 'bulk' && (
                    // BULK WHOLESALE SALES FORM CONTAINER
                    <div className="space-y-4">
                      {/* Item Inclusion Toggle Bar for Wholesale Challan Sales Chain */}
                      <div className="p-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl shadow-md space-y-3 font-sans">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="p-1.5 bg-cyan-500/20 text-cyan-400 rounded-lg">
                              <ClipboardList className="h-4 w-4" />
                            </span>
                            <div>
                              <h4 className="text-xs font-black uppercase tracking-wider text-white">Challan Sales Chain (Truck Dispatch)</h4>
                              <p className="text-[10px] text-slate-300">Select wholesale item categories to include on this truck Delivery Challan:</p>
                            </div>
                          </div>
                          <span className="hidden sm:inline-block text-[10px] font-mono text-cyan-300 bg-cyan-950/80 px-2.5 py-1 rounded-lg border border-cyan-800/60 font-bold">
                            [ Wholesale Chain Active ]
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          {/* Scooter Checkbox */}
                          <label className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none ${
                            posIncludeScooter 
                              ? 'bg-cyan-500/20 border-cyan-400 text-white shadow-xs font-extrabold ring-1 ring-cyan-400/50' 
                              : 'bg-slate-800/80 border-slate-700/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                          }`}>
                            <input
                              type="checkbox"
                              checked={posIncludeScooter}
                              onChange={(e) => setPosIncludeScooter(e.target.checked)}
                              className="h-4.5 w-4.5 rounded border-slate-600 text-cyan-500 focus:ring-cyan-400 accent-cyan-500 cursor-pointer"
                            />
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-lg">🛴</span>
                              <span>Vehicle / Scooter Batch</span>
                            </div>
                          </label>

                          {/* Battery Checkbox */}
                          <label className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none ${
                            posIncludeBattery 
                              ? 'bg-emerald-500/20 border-emerald-400 text-white shadow-xs font-extrabold ring-1 ring-emerald-400/50' 
                              : 'bg-slate-800/80 border-slate-700/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                          }`}>
                            <input
                              type="checkbox"
                              checked={posIncludeBattery}
                              onChange={(e) => setPosIncludeBattery(e.target.checked)}
                              className="h-4.5 w-4.5 rounded border-slate-600 text-emerald-500 focus:ring-emerald-400 accent-emerald-500 cursor-pointer"
                            />
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-lg">🔋</span>
                              <span>Battery Pack Batch</span>
                            </div>
                          </label>

                          {/* Charger Checkbox */}
                          <label className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none ${
                            posIncludeCharger 
                              ? 'bg-amber-500/20 border-amber-400 text-white shadow-xs font-extrabold ring-1 ring-amber-400/50' 
                              : 'bg-slate-800/80 border-slate-700/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                          }`}>
                            <input
                              type="checkbox"
                              checked={posIncludeCharger}
                              onChange={(e) => setPosIncludeCharger(e.target.checked)}
                              className="h-4.5 w-4.5 rounded border-slate-600 text-amber-500 focus:ring-amber-400 accent-amber-500 cursor-pointer"
                            />
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-lg">⚡</span>
                              <span>Charger Unit Batch</span>
                            </div>
                          </label>
                        </div>

                        {!posIncludeScooter && !posIncludeBattery && !posIncludeCharger && (
                          <div className="p-2.5 bg-rose-500/20 border border-rose-500/40 rounded-xl text-rose-200 text-xs text-center font-bold">
                            ⚠️ Please select at least one item category above (Scooter, Battery, or Charger) to build your Wholesale Delivery Challan!
                          </div>
                        )}
                      </div>
                      {posIncludeScooter && (
                        <div className="space-y-4">
                          <div className="p-4 bg-cyan-50 border border-cyan-100 rounded-2xl text-xs text-cyan-800">
                            <p><strong>Wholesale Dispatch Engine:</strong> Select items across multiple models and colors. Use the search bar to find chassis, motor, or controller numbers. Selected items accumulate in your dispatch list below.</p>
                          </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 font-sans">
                            Scooter Model Filter
                          </label>
                          <SearchableDropdown
                            options={[
                              { value: 'ALL', label: '⚡ ALL MODELS (Mixed Wholesale)' },
                              ...products.map((p) => ({ value: p.name, label: p.name }))
                            ]}
                            value={s3BulkModel}
                            onChange={(val) => handleBulkPOSModelChange(val)}
                            placeholder="-- Choose Model --"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 font-sans">
                            Color Filter
                          </label>
                          <SearchableDropdown
                            options={[
                              { value: 'ALL', label: '🌈 ALL COLORS' },
                              ...(s3BulkModel && s3BulkModel !== 'ALL' 
                                ? (products.find(p => p.name === s3BulkModel)?.colors || []).map(c => ({ value: c, label: c }))
                                : Array.from(new Set(products.flatMap(p => p.colors))).map(c => ({ value: c, label: c }))
                              )
                            ]}
                            value={s3BulkColor}
                            onChange={(val) => setS3BulkColor(val)}
                            placeholder="-- Choose Color --"
                            required
                          />
                        </div>
                      </div>

                      {/* Direct Search Bar for Chassis, Motor, or Controller Number */}
                      <div className="p-3 bg-white border border-slate-200 rounded-2xl shadow-sm flex items-center gap-2">
                        <Search className="h-4 w-4 text-cyan-600 flex-shrink-0" />
                        <input
                          type="text"
                          placeholder="Search Chassis No, Motor No, or Controller No..."
                          value={s3BulkSearchTerm}
                          onChange={(e) => setS3BulkSearchTerm(e.target.value)}
                          className="w-full bg-transparent text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none font-sans"
                        />
                        {s3BulkSearchTerm && (
                          <button
                            type="button"
                            onClick={() => setS3BulkSearchTerm('')}
                            className="text-[10px] font-bold text-slate-400 hover:text-slate-600 px-1.5 py-0.5 rounded bg-slate-100"
                          >
                            Clear
                          </button>
                        )}
                      </div>

                      <div className="space-y-3">
                        {/* Search & Paste Chassis numbers for quick selection */}
                        <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-2">
                          <label className="block text-[10px] font-bold text-cyan-700 font-sans uppercase tracking-wide">
                            🔍 Batch Auto-Select Chassis / Motor / Controller Serials
                          </label>
                          <p className="text-[10px] text-slate-600 leading-relaxed font-semibold">
                            Paste a list of Chassis, Motor, or Controller serial numbers (one per line or separated by commas/tabs). Matching warehouse stock will auto-check into your dispatch cart!
                          </p>
                          <textarea
                            rows={2}
                            placeholder="VOLT-CH1001&#10;VOLT-CH1002"
                            value={s3BulkChassisPasted}
                            onChange={(e) => setS3BulkChassisPasted(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-base sm:text-xs text-slate-800 font-sans focus:border-cyan-500 outline-none"
                          />
                        </div>

                        {/* Selected Dispatch Queue / Cart Table */}
                        {s3BulkSelectedIds.length > 0 && (
                          <div className="p-4 bg-cyan-900 text-white rounded-2xl space-y-3 shadow-md">
                            <div className="flex justify-between items-center text-xs font-bold font-sans">
                              <span className="flex items-center gap-1.5">
                                🛒 Selected Dispatch List ({s3BulkSelectedIds.length} Vehicles Chosen)
                              </span>
                              <button
                                type="button"
                                onClick={() => setS3BulkSelectedIds([])}
                                className="text-[10px] font-bold bg-cyan-800 hover:bg-cyan-700 text-cyan-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                              >
                                Clear All Selections
                              </button>
                            </div>

                            <div className="max-h-[140px] overflow-y-auto border border-cyan-800 rounded-xl bg-cyan-950 text-[11px] font-sans">
                              <table className="w-full text-left">
                                <thead className="bg-cyan-900 text-cyan-200 text-[9px] uppercase sticky top-0 font-bold">
                                  <tr>
                                    <th className="p-2">Model & Color</th>
                                    <th className="p-2">Chassis No</th>
                                    <th className="p-2">Motor / Controller</th>
                                    <th className="p-2 text-center">Action</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-cyan-900/50">
                                  {s3BulkSelectedIds.map((id) => {
                                    const u = scooterUnits.find(unit => unit.id === id);
                                    if (!u) return null;
                                    return (
                                      <tr key={id} className="hover:bg-cyan-900/30">
                                        <td className="p-2 font-bold text-white">
                                          {u.modelName} <span className="text-[10px] text-cyan-300 font-normal">({u.color})</span>
                                        </td>
                                        <td className="p-2 font-mono font-bold text-cyan-300">{u.chassisNo}</td>
                                        <td className="p-2 text-[10px] text-cyan-200">{u.motorNo} / {u.controllerNo}</td>
                                        <td className="p-2 text-center">
                                          <button
                                            type="button"
                                            onClick={() => setS3BulkSelectedIds(s3BulkSelectedIds.filter(i => i !== id))}
                                            className="p-1 text-rose-300 hover:text-rose-100 rounded cursor-pointer"
                                            title="Remove from dispatch cart"
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </button>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Available matching stock list */}
                        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-3">
                          <div className="flex justify-between items-center text-[10px] font-sans">
                            <span className="text-slate-500 font-bold uppercase tracking-wide">Available Warehouse Inventory</span>
                            <span className="text-cyan-700 font-bold bg-white px-2.5 py-1 rounded-full border border-slate-200 shadow-sm">
                              {s3BulkSelectedIds.length} Selected / {availableBulkStock.length} Visible Stock
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
                                    <th className="p-2">Model & Color</th>
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
                                          isSelected ? 'bg-cyan-50/70 text-cyan-900 font-bold' : 'hover:bg-slate-50 text-slate-700'
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
                                        <td className="p-2">
                                          <span className="font-bold text-slate-800">{unit.modelName}</span>
                                          <span className="text-[10px] text-slate-400 block font-normal">{unit.color}</span>
                                        </td>
                                        <td className="p-2 font-bold text-slate-800">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="font-mono text-cyan-900">{unit.chassisNo}</span>
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

                          {/* Scooter Warranty Configuration - ONLY shown when Scooter section is checked */}
                          <div className="p-3.5 bg-cyan-900/10 border border-cyan-200 rounded-2xl space-y-2 font-sans">
                            <div className="flex items-center justify-between">
                              <label className="text-xs text-slate-800 font-bold flex items-center gap-2 cursor-pointer font-sans">
                                <input
                                  type="checkbox"
                                  checked={s5ScooterWarrantyActive}
                                  onChange={(e) => setS5ScooterWarrantyActive(e.target.checked)}
                                  className="rounded border-slate-300 bg-white text-cyan-600 focus:ring-0 h-4 w-4 cursor-pointer"
                                />
                                <span>🛵 Scooter Warranty Active</span>
                              </label>
                              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border font-sans ${s5ScooterWarrantyActive ? 'bg-cyan-100 text-cyan-800 border-cyan-300' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                {s5ScooterWarrantyActive ? 'Active' : 'No Warranty'}
                              </span>
                            </div>
                            {s5ScooterWarrantyActive && (
                              <div className="grid grid-cols-2 gap-2 pt-1 font-sans">
                                <div>
                                  <span className="block text-[10px] text-slate-600 font-bold uppercase tracking-wider mb-1">Scooter Warranty Expiry Date</span>
                                  <input
                                    type="date"
                                    value={s5ScooterExpiry}
                                    onChange={(e) => setS5ScooterExpiry(e.target.value)}
                                    className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs text-slate-800 font-sans"
                                    required
                                  />
                                </div>
                                <div className="flex items-end text-[10px] text-slate-500 italic pb-1">
                                  Defaults to 1 year from dispatch date
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                      {/* 2. BATTERY PACK BATCH MANAGER (When Battery is checked) */}
                      {posIncludeBattery && (
                        <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-3xl space-y-3 font-sans">
                          <div className="flex items-center justify-between px-1">
                            <span className="text-xs font-black text-emerald-900 uppercase tracking-wide flex items-center gap-1.5 font-sans">
                              🔋 Wholesale Battery Pack Batch Manager
                            </span>
                            <span className="text-[10px] text-emerald-800 font-bold bg-white px-2.5 py-1 rounded-full border border-emerald-200 shadow-2xs font-sans">
                              Range + Serials + Warranty
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white p-3.5 rounded-2xl border border-emerald-100">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wide mb-1 font-sans">
                                Battery Series
                              </label>
                              <SearchableDropdown
                                options={[
                                  ...batterySeriesList.map(s => ({ value: s, label: `${s} Series` })),
                                  { value: 'custom', label: '✏️ Enter Custom Series Name' }
                                ]}
                                value={s3WholesaleBatterySeries}
                                onChange={(val) => setS3WholesaleBatterySeries(val)}
                                placeholder="Select Battery Series"
                              />
                              {s3WholesaleBatterySeries && (
                                <div className="mt-1.5 p-2 rounded-xl bg-emerald-50/90 border border-emerald-200 text-[11px] font-sans flex items-center justify-between">
                                  <span className="font-bold text-emerald-950 flex items-center gap-1">
                                    📦 Available Stock:
                                  </span>
                                  <span className="font-mono text-emerald-800 font-extrabold text-xs">
                                    {posBatteryStockMap[s3WholesaleBatterySeries]?.available ?? 0} Packs
                                  </span>
                                </div>
                              )}
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wide mb-1 font-sans">
                                Total Battery Pack Quantity {s3WholesaleBatteryWarrantyActive && <span className="text-emerald-700 font-bold">(🔒 Warranty Auto-Derived)</span>}
                              </label>
                              <input
                                type="number"
                                min="1"
                                placeholder="Qty e.g. 20"
                                value={s3WholesaleBatteryQty}
                                onChange={(e) => !s3WholesaleBatteryWarrantyActive && setS3WholesaleBatteryQty(e.target.value)}
                                readOnly={s3WholesaleBatteryWarrantyActive}
                                className={`w-full border rounded-xl p-2.5 text-xs font-bold font-sans outline-none ${
                                  s3WholesaleBatteryWarrantyActive
                                    ? 'bg-emerald-50/80 border-emerald-300 text-emerald-900 cursor-not-allowed'
                                    : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-emerald-500'
                                }`}
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wide mb-1 font-sans">
                                Start Serial Number (e.g. SENZO 201)
                              </label>
                              <input
                                type="text"
                                placeholder="Start Serial No"
                                value={s3WholesaleBatteryStartNo}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setS3WholesaleBatteryStartNo(val);
                                  const qty = parseInt(s3WholesaleBatteryQty, 10) || 1;
                                  const match = val.match(/^(.*?[\s\-_/\\#]*?)(\d+)$/i);
                                  if (match) {
                                    const pfx = match[1];
                                    const sNum = parseInt(match[2], 10);
                                    const pLen = match[2].length;
                                    const eNum = sNum + qty - 1;
                                    setS3WholesaleBatteryEndNo(`${pfx}${String(eNum).padStart(pLen, '0')}`);
                                  }
                                }}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 uppercase outline-none focus:border-emerald-500"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wide mb-1 font-sans">
                                End Serial Number (e.g. SENZO 220)
                              </label>
                              <input
                                type="text"
                                placeholder="End Serial No"
                                value={s3WholesaleBatteryEndNo}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setS3WholesaleBatteryEndNo(val);
                                  const sMatch = s3WholesaleBatteryStartNo.match(/^(.*?[\s\-_/\\#]*?)(\d+)$/i);
                                  const eMatch = val.match(/^(.*?[\s\-_/\\#]*?)(\d+)$/i);
                                  if (sMatch && eMatch) {
                                    const sNum = parseInt(sMatch[2], 10);
                                    const eNum = parseInt(eMatch[2], 10);
                                    if (eNum >= sNum) {
                                      setS3WholesaleBatteryQty(String(eNum - sNum + 1));
                                    }
                                  }
                                }}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 uppercase outline-none focus:border-emerald-500"
                              />
                            </div>
                          </div>

                          {/* Warranty setup */}
                          <div className="bg-white p-3.5 rounded-2xl border border-emerald-100 grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={s3WholesaleBatteryWarrantyActive}
                                onChange={(e) => setS3WholesaleBatteryWarrantyActive(e.target.checked)}
                                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                              />
                              <span className="text-xs font-bold text-slate-800 font-sans">
                                Enable Battery Warranty
                              </span>
                            </label>

                            {s3WholesaleBatteryWarrantyActive && (
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 font-sans">
                                  Warranty Duration
                                </label>
                                <select
                                  value={s3WholesaleBatteryWarrantyMonths}
                                  onChange={(e) => setS3WholesaleBatteryWarrantyMonths(Number(e.target.value))}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold text-slate-800 outline-none focus:border-emerald-500"
                                >
                                  <option value={6}>6 Months Warranty</option>
                                  <option value={12}>12 Months (1 Year) Warranty</option>
                                  <option value={13}>13 Months (1 Year + 1 Mo) Warranty</option>
                                  <option value={18}>18 Months Warranty</option>
                                  <option value={24}>24 Months (2 Years) Warranty</option>
                                </select>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* 3. CHARGER UNIT BATCH MANAGER (When Charger is checked) */}
                      {posIncludeCharger && (
                        <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-3xl space-y-3 font-sans">
                          <div className="flex items-center justify-between px-1">
                            <span className="text-xs font-black text-amber-900 uppercase tracking-wide flex items-center gap-1.5 font-sans">
                              ⚡ Wholesale Charger Unit Batch Manager
                            </span>
                            <span className="text-[10px] text-amber-800 font-bold bg-white px-2.5 py-1 rounded-full border border-amber-200 shadow-2xs font-sans">
                              Serials + Range + Warranty
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white p-3.5 rounded-2xl border border-amber-100">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wide mb-1 font-sans">
                                Charger Model / Type
                              </label>
                              <SearchableDropdown
                                options={chargerTypeList.map(t => ({ value: t, label: t }))}
                                value={s3WholesaleChargerType}
                                onChange={(val) => setS3WholesaleChargerType(val)}
                                placeholder="Select Charger Type"
                              />
                              {s3WholesaleChargerType && (
                                <div className="mt-1.5 p-2 rounded-xl bg-amber-50/90 border border-amber-200 text-[11px] font-sans flex items-center justify-between">
                                  <span className="font-bold text-amber-950 flex items-center gap-1">
                                    ⚡ Available Stock:
                                  </span>
                                  <span className="font-mono text-amber-800 font-extrabold text-xs">
                                    {posChargerStockMap[s3WholesaleChargerType]?.available ?? 0} Units
                                  </span>
                                </div>
                              )}
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wide mb-1 font-sans">
                                Total Charger Units Quantity {s3WholesaleChargerWarrantyActive && <span className="text-amber-800 font-bold">(🔒 Warranty Auto-Derived)</span>}
                              </label>
                              <input
                                type="number"
                                min="1"
                                placeholder="Qty e.g. 10"
                                value={s3WholesaleChargerQty}
                                onChange={(e) => !s3WholesaleChargerWarrantyActive && setS3WholesaleChargerQty(e.target.value)}
                                readOnly={s3WholesaleChargerWarrantyActive}
                                className={`w-full border rounded-xl p-2.5 text-xs font-bold font-sans outline-none ${
                                  s3WholesaleChargerWarrantyActive
                                    ? 'bg-amber-50/80 border-amber-300 text-amber-900 cursor-not-allowed'
                                    : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-amber-500'
                                }`}
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wide mb-1 font-sans">
                                Start Serial Number (e.g. CHG-2001)
                              </label>
                              <input
                                type="text"
                                placeholder="Start Serial No"
                                value={s3WholesaleChargerStartNo}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setS3WholesaleChargerStartNo(val);
                                  const qty = parseInt(s3WholesaleChargerQty, 10) || 1;
                                  const match = val.match(/^(.*?[\s\-_/\\#]*?)(\d+)$/i);
                                  if (match) {
                                    const pfx = match[1];
                                    const sNum = parseInt(match[2], 10);
                                    const pLen = match[2].length;
                                    const eNum = sNum + qty - 1;
                                    setS3WholesaleChargerEndNo(`${pfx}${String(eNum).padStart(pLen, '0')}`);
                                  }
                                }}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 uppercase outline-none focus:border-amber-500"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wide mb-1 font-sans">
                                End Serial Number (e.g. CHG-2010)
                              </label>
                              <input
                                type="text"
                                placeholder="End Serial No"
                                value={s3WholesaleChargerEndNo}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setS3WholesaleChargerEndNo(val);
                                  const sMatch = s3WholesaleChargerStartNo.match(/^(.*?[\s\-_/\\#]*?)(\d+)$/i);
                                  const eMatch = val.match(/^(.*?[\s\-_/\\#]*?)(\d+)$/i);
                                  if (sMatch && eMatch) {
                                    const sNum = parseInt(sMatch[2], 10);
                                    const eNum = parseInt(eMatch[2], 10);
                                    if (eNum >= sNum) {
                                      setS3WholesaleChargerQty(String(eNum - sNum + 1));
                                    }
                                  }
                                }}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 uppercase outline-none focus:border-amber-500"
                              />
                            </div>

                            <div className="sm:col-span-2">
                              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wide mb-1 font-sans">
                                Paste / Scan Specific Charger Serials (Optional)
                              </label>
                              <textarea
                                rows={2}
                                placeholder="Paste or scan serial numbers separated by commas or line breaks..."
                                value={s3WholesaleChargerSerials}
                                onChange={(e) => {
                                  setS3WholesaleChargerSerials(e.target.value);
                                  const count = e.target.value.split(/[\n,;\t\r]+/).map(s => s.trim()).filter(Boolean).length;
                                  if (count > 0) {
                                    setS3WholesaleChargerQty(String(count));
                                  }
                                }}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-mono font-bold text-slate-800 uppercase outline-none focus:border-amber-500"
                              />
                            </div>
                          </div>

                          {/* Warranty setup */}
                          <div className="bg-white p-3.5 rounded-2xl border border-amber-100 grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={s3WholesaleChargerWarrantyActive}
                                onChange={(e) => setS3WholesaleChargerWarrantyActive(e.target.checked)}
                                className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                              />
                              <span className="text-xs font-bold text-slate-800 font-sans">
                                Enable Charger Warranty
                              </span>
                            </label>

                            {s3WholesaleChargerWarrantyActive && (
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 font-sans">
                                  Warranty Duration
                                </label>
                                <select
                                  value={s3WholesaleChargerWarrantyMonths}
                                  onChange={(e) => setS3WholesaleChargerWarrantyMonths(Number(e.target.value))}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold text-slate-800 outline-none focus:border-amber-500"
                                >
                                  <option value={6}>6 Months Warranty</option>
                                  <option value={12}>12 Months (1 Year) Warranty</option>
                                  <option value={18}>18 Months Warranty</option>
                                  <option value={24}>24 Months (2 Years) Warranty</option>
                                </select>
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
                                  Bill Number (Optional)
                                </label>
                                <input
                                  type="text"
                                  placeholder="Enter wholesale bill number (optional)"
                                  value={s3BillNo}
                                  onChange={(e) => setS3BillNo(e.target.value)}
                                  className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-base sm:text-xs text-slate-800 focus:border-cyan-500 outline-none font-sans uppercase font-semibold"
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 font-sans">
                                  Chalan (Challan) Number {s3DispatchMode === 'hold' ? '(Optional for Hold)' : '*'}
                                </label>

                                {/* Clickable Active Pending Challans Bar */}
                                {s3ActiveChallanNumbers.length > 0 && (
                                  <div className="mb-2 p-2 bg-cyan-50 border border-cyan-200 rounded-xl">
                                    <span className="block text-[10px] font-extrabold text-cyan-900 uppercase tracking-wider mb-1 font-sans">
                                      📋 Click to auto-fill pending Delivery Challan:
                                    </span>
                                    <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                                      {s3ActiveChallanNumbers.map((cNo) => (
                                        <button
                                          key={cNo}
                                          type="button"
                                          onClick={() => setS3DeliveryChallanNo(cNo)}
                                          className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer border ${
                                            s3DeliveryChallanNo.toUpperCase() === cNo
                                              ? 'bg-cyan-600 text-white border-cyan-700 shadow-xs scale-105'
                                              : 'bg-white text-cyan-800 border-cyan-200 hover:bg-cyan-100'
                                          }`}
                                        >
                                          #{cNo}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                <input
                                  type="text"
                                  placeholder="Enter delivery chalan number (or click active above)"
                                  list="s3-active-challans-list-bulk"
                                  value={s3DeliveryChallanNo}
                                  onChange={(e) => setS3DeliveryChallanNo(e.target.value)}
                                  className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-base sm:text-xs text-slate-800 focus:border-cyan-500 outline-none font-sans uppercase font-semibold"
                                  required={s3DispatchMode !== 'hold'}
                                />
                                <datalist id="s3-active-challans-list-bulk">
                                  {s3ActiveChallanNumbers.map(cNo => (
                                    <option key={cNo} value={cNo} />
                                  ))}
                                </datalist>
                                <ChallanStatusCard info={s3ChallanInfo} currentUser={currentUser} />
                              </div>
                            </div>
                          </div>

                          {/* Challan Remarks & Notes */}
                          <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-2 font-sans">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 font-sans">
                              Challan Notes / Dispatch Remarks
                            </label>
                            <textarea
                              placeholder="Add wholesale dispatch remarks, custom terms, or conditions..."
                              value={s5Notes}
                              onChange={(e) => setS5Notes(e.target.value)}
                              rows={2}
                              className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-xs text-slate-800 focus:border-cyan-500 outline-none font-sans"
                            />
                          </div>

                      <div className="space-y-3 pt-2">
                        {/* Action Mode Toggle */}
                        <div className="bg-slate-100 p-2.5 rounded-2xl border border-slate-200/80 space-y-1.5">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide font-sans px-1">
                            Final Action Type Selection:
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setS3DispatchMode('sold')}
                              className={`py-2.5 px-3 rounded-xl font-sans font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                s3DispatchMode === 'sold'
                                  ? 'bg-slate-900 text-white shadow-sm'
                                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-200'
                              }`}
                            >
                              <ShoppingBag className="h-3.5 w-3.5" />
                              <span>Finish Dispatch & Sale</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setS3DispatchMode('hold')}
                              className={`py-2.5 px-3 rounded-xl font-sans font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                s3DispatchMode === 'hold'
                                  ? 'bg-amber-600 text-white shadow-sm'
                                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-200'
                              }`}
                            >
                              <User className="h-3.5 w-3.5" />
                              <span>Put Selection on Hold</span>
                            </button>
                          </div>
                        </div>

                        {/* Single Finishing Action Button */}
                        <button
                          type="button"
                          onClick={(e) => handleStage3BulkSubmit(e, s3DispatchMode)}
                          disabled={loading || (posIncludeScooter && s3BulkSelectedIds.length === 0) || (!posIncludeScooter && !posIncludeBattery && !posIncludeCharger) || s3ChallanInfo.isFinished}
                          className={`w-full py-4 rounded-2xl font-sans font-extrabold text-xs sm:text-sm text-white transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-md active:scale-[0.99] ${
                            s3DispatchMode === 'hold'
                              ? 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800'
                              : 'bg-slate-900 hover:bg-slate-800 active:bg-black'
                          }`}
                        >
                          {loading ? (
                            <>
                              <RefreshCw className="h-4.5 w-4.5 animate-spin" />
                              <span>Processing Wholesale Order...</span>
                            </>
                          ) : s3DispatchMode === 'hold' ? (
                            <>
                              <User className="h-4.5 w-4.5" />
                              <span>Place Selection on Reservation Hold</span>
                            </>
                          ) : (
                            <>
                              <ShoppingBag className="h-4.5 w-4.5" />
                              <span>Finalize Wholesale Truck Dispatch</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                </>
                )}
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
                        label: `Chassis: ${scoot.chassisNo} — Model: ${scoot.modelName} (${scoot.color}) [${scoot.status.toUpperCase()}]`
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5 bg-slate-50 p-3 rounded-2xl border border-slate-100" id="registry-filters">
            <div className="relative">
              <input
                type="text"
                placeholder={searchTargetFilter === 'buyer' ? "Search Buyer Name..." : searchTargetFilter === 'chassis' ? "Search Chassis No..." : "Search Records..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl py-2 pl-8 pr-3 text-xs text-slate-800 focus:border-cyan-500 outline-none font-sans"
              />
              <Search className="absolute left-2.5 top-3 h-3.5 w-3.5 text-slate-400" />
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-500 shrink-0 font-sans">Field:</span>
              <select
                value={searchTargetFilter}
                onChange={(e) => setSearchTargetFilter(e.target.value as any)}
                className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-700 font-semibold outline-none cursor-pointer focus:border-cyan-500 font-sans"
              >
                <option value="all">🔍 Search All Fields</option>
                <option value="buyer">👤 Buyer / Customer Name Only</option>
                <option value="chassis">🆔 Chassis Number Only</option>
                <option value="motor">⚡ Motor Number Only</option>
                <option value="controller">🔌 Controller Number Only</option>
                <option value="model">🛵 Model Name Only</option>
                <option value="color">🎨 Color Only</option>
              </select>
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
                            F: {scoot.frontTireSize === '10-inch' ? '10"' : '12"'} / R: {scoot.rearTireSize === '10-inch' ? '10"' : '12"'}
                          </span>
                        </div>
                      </div>

                      {/* Specifications */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-sans text-slate-600 bg-white p-4 rounded-2xl border border-slate-100 mb-4">
                        <div>Model: <span className="text-slate-900 font-bold">{scoot.modelName}</span></div>
                        <div>Color: <span className="text-slate-800 font-semibold">{scoot.color}</span></div>
                        <div>Front Tyre: <span className="text-slate-800 font-semibold">{scoot.frontTireSize === '10-inch' ? '10-inches' : '12-inches'}</span></div>
                        <div>Rear Tyre: <span className="text-slate-800 font-semibold">{scoot.rearTireSize === '10-inch' ? '10-inches' : '12-inches'}</span></div>
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

    </div>
  );
}
