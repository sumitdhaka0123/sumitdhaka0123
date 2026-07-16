import React, { useState, useEffect } from 'react';
import { AttendanceScreen } from './components/AttendanceScreen';
import { AdminAttendanceMap } from './components/AdminAttendanceMap';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Compass, LayoutDashboard, Shuffle, ClipboardList, BookOpen, Cloud, LogOut, RefreshCw, User as UserIcon, Battery, Settings, Sparkles, Zap
} from 'lucide-react';

import { User, Product, Buyer, ScooterUnit, StockLog, SheetConfig, BatterySale, BatteryImport, ChargerSale, ChargerImport } from './types';
import LoginScreen from './components/LoginScreen';
import DashboardStats from './components/DashboardStats';
import AssemblyPipeline from './components/AssemblyPipeline';
import StockAdjustment from './components/StockAdjustment';
import CatalogManager from './components/CatalogManager';
import BatterySalesManager from './components/BatterySalesManager';
import ChargerSalesManager from './components/ChargerSalesManager';
import SettingsPanel from './components/SettingsPanel';
import SenzoLogo from './components/SenzoLogo';

export default function App() {
  // Session State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [sessionToken, setSessionToken] = useState<string>('');

  // Domain States loaded from backend
  const [products, setProducts] = useState<Product[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [scooterUnits, setScooterUnits] = useState<ScooterUnit[]>([]);
  const [stockLogs, setStockLogs] = useState<StockLog[]>([]);
  const [sheetConfig, setSheetConfig] = useState<SheetConfig>({ webhookUrl: '', enabled: false });
  const [batterySales, setBatterySales] = useState<BatterySale[]>([]);
  const [batteryImports, setBatteryImports] = useState<BatteryImport[]>([]);
  const [chargerSales, setChargerSales] = useState<ChargerSale[]>([]);
  const [chargerImports, setChargerImports] = useState<ChargerImport[]>([]);
  const [batteryTypes, setBatteryTypes] = useState<string[]>([]);
  const [chargerTypes, setChargerTypes] = useState<string[]>([]);

  // Navigation tab states
  const [activeTab, setActiveTab] = useState<'dashboard' | 'assembly' | 'stock' | 'catalog' | 'battery' | 'charger' | 'settings'>('dashboard');
  const [loading, setLoading] = useState(false);
  const [workerTab, setWorkerTab] = useState<'workspace' | 'charger' | 'dashboard'>('workspace');

  // Salesperson add buyer form state
  const [salespersonNewBuyerName, setSalespersonNewBuyerName] = useState('');
  const [salespersonNewBuyerContact, setSalespersonNewBuyerContact] = useState('');
  const [salespersonBuyerStatus, setSalespersonBuyerStatus] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [salespersonSavingBuyer, setSalespersonSavingBuyer] = useState(false);
  const [showSalespersonAddBuyerForm, setShowSalespersonAddBuyerForm] = useState(false);

  // Separate Battery Sales Form State
  const [batteryBuyerName, setBatteryBuyerName] = useState('');
  const [batterySeries, setBatterySeries] = useState('Alpha');
  const [batteryStartNo, setBatteryStartNo] = useState('');
  const [batteryEndNo, setBatteryEndNo] = useState('');
  const [batteryQty, setBatteryQty] = useState('');
  const [batteryNotes, setBatteryNotes] = useState('');
  const [batterySaving, setBatterySaving] = useState(false);
  const [batteryStatus, setBatteryStatus] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [showBatterySaleForm, setShowBatterySaleForm] = useState(false);

  // Manufacturer Warehouse Stock Lookup States
  const [mfrSearchModel, setMfrSearchModel] = useState<string>('all');
  const [mfrSearchColor, setMfrSearchColor] = useState<string>('all');
  const [mfrSearchText, setMfrSearchText] = useState<string>('');
  const [selectedDetailScooter, setSelectedDetailScooter] = useState<ScooterUnit | null>(null);

  // Restore session on mount if any
  useEffect(() => {
    const savedUser = localStorage.getItem('voltstock_user');
    const savedToken = localStorage.getItem('voltstock_token');
    if (savedUser && savedToken) {
      try {
        setCurrentUser(JSON.parse(savedUser));
        setSessionToken(savedToken);
      } catch (e) {
        localStorage.removeItem('voltstock_user');
        localStorage.removeItem('voltstock_token');
      }
    }
  }, []);

  // Fetch all domain lists when user logs in
  const fetchAllData = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const [pRes, bRes, sUnitRes, sLogRes, cRes, batRes, batImpRes, chgRes, chgImpRes, batTypeRes, chgTypeRes] = await Promise.all([
        fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/products'),
        fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/buyers'),
        fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/scooter-units'),
        fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/stock-logs'),
        fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/sheet-config'),
        fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/battery-sales'),
        fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/battery-imports'),
        fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/charger-sales'),
        fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/charger-imports'),
        fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/battery-types'),
        fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/charger-types')
      ]);

      if (pRes.ok) setProducts(await pRes.json());
      if (bRes.ok) setBuyers(await bRes.json());
      if (sUnitRes.ok) setScooterUnits(await sUnitRes.json());
      if (sLogRes.ok) setStockLogs(await sLogRes.json());
      if (cRes.ok) setSheetConfig(await cRes.json());
      if (batRes.ok) setBatterySales(await batRes.json());
      if (batImpRes.ok) setBatteryImports(await batImpRes.json());
      if (chgRes.ok) setChargerSales(await chgRes.json());
      if (chgImpRes.ok) setChargerImports(await chgImpRes.json());
      if (batTypeRes.ok) setBatteryTypes(await batTypeRes.json());
      if (chgTypeRes.ok) setChargerTypes(await chgTypeRes.json());
    } catch (err) {
      console.error('Error loading data from warehouse server:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [currentUser]);

  // Auto background pull from sheet whenever user changes tabs to refresh and capture live sheet edits!
  useEffect(() => {
    if (!currentUser) return;
    
    const pullLatestAndRefresh = async () => {
      try {
        const pullRes = await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/sheet-config/pull-all', { method: 'POST' });
        if (pullRes.ok) {
          // Refresh all local React states
          const [pRes, bRes, sUnitRes, sLogRes, batRes, batImpRes] = await Promise.all([
            fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/products'),
            fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/buyers'),
            fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/scooter-units'),
            fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/stock-logs'),
            fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/battery-sales'),
            fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/battery-imports')
          ]);

          if (pRes.ok) setProducts(await pRes.json());
          if (bRes.ok) setBuyers(await bRes.json());
          if (sUnitRes.ok) setScooterUnits(await sUnitRes.json());
          if (sLogRes.ok) setStockLogs(await sLogRes.json());
          if (batRes.ok) setBatterySales(await batRes.json());
          if (batImpRes.ok) setBatteryImports(await batImpRes.json());
        }
      } catch (err) {
        console.error('Silent sheet synchronization error:', err);
      }
    };
    
    pullLatestAndRefresh();
  }, [activeTab, currentUser]);

  const handleLoginSuccess = (user: User, token: string) => {
    localStorage.setItem('voltstock_user', JSON.stringify(user));
    localStorage.setItem('voltstock_token', token);
    setCurrentUser(user);
    setSessionToken(token);
  };

  const handleLogout = () => {
    localStorage.removeItem('voltstock_user');
    localStorage.removeItem('voltstock_token');
    setCurrentUser(null);
    setSessionToken('');
  };

  const handleBatterySaleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batteryBuyerName || !batterySeries || !batteryStartNo || !batteryEndNo || !batteryQty) {
      setBatteryStatus({ type: 'error', text: 'Please fill in all battery details.' });
      return;
    }
    setBatterySaving(true);
    setBatteryStatus(null);
    try {
      const res = await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/battery-sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyerName: batteryBuyerName,
          batterySeries,
          startNo: batteryStartNo,
          endNo: batteryEndNo,
          quantity: Number(batteryQty),
          operator: currentUser?.name || currentUser?.username || 'system',
          notes: batteryNotes
        })
      });
      const data = await res.json();
      if (res.ok) {
        setBatteryStatus({ type: 'success', text: `Battery shipment logged successfully for ${batteryBuyerName}!` });
        setBatteryBuyerName('');
        setBatteryStartNo('');
        setBatteryEndNo('');
        setBatteryQty('');
        setBatteryNotes('');
        fetchAllData();
      } else {
        setBatteryStatus({ type: 'error', text: data.error || 'Failed to record battery sale.' });
      }
    } catch (err) {
      setBatteryStatus({ type: 'error', text: 'Network error recording battery transaction.' });
    } finally {
      setBatterySaving(false);
    }
  };

  // API Call helper wrappers
  const handleDirectBatterySale = async (data: {
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
  }): Promise<boolean> => {
    try {
      const res = await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/battery-sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          operator: currentUser?.name || currentUser?.username || 'system'
        })
      });
      return res.ok;
    } catch (err) {
      return false;
    }
  };

  const handleDirectBatteryImport = async (data: {
    batterySeries: string;
    startNo: string;
    endNo: string;
    quantity: number;
    supplierName?: string;
    containerId?: string;
    notes?: string;
  }): Promise<boolean> => {
    try {
      const res = await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/battery-imports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          operator: currentUser?.name || currentUser?.username || 'system'
        })
      });
      return res.ok;
    } catch (err) {
      return false;
    }
  };

  const handleAddProduct = async (name: string, colors: string[]): Promise<boolean> => {
    try {
      const res = await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, colors }),
      });
      return res.ok;
    } catch (e) {
      return false;
    }
  };

  const handleAddBuyer = async (name: string, contact?: string): Promise<boolean> => {
    try {
      const res = await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/buyers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, contact }),
      });
      return res.ok;
    } catch (e) {
      return false;
    }
  };

  const handleSubmitScooterUnit = async (payload: any): Promise<boolean> => {
    try {
      const res = await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/scooter-units', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return res.ok;
    } catch (e) {
      return false;
    }
  };

  const handleSubmitStockLog = async (payload: any): Promise<boolean> => {
    try {
      const res = await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/stock-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return res.ok;
    } catch (e) {
      return false;
    }
  };

  const handleSaveSheetConfig = async (webhookUrl: string, enabled: boolean): Promise<boolean> => {
    try {
      const res = await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/sheet-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl, enabled }),
      });
      if (res.ok) {
        setSheetConfig({ webhookUrl, enabled });
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  };

  const handleTriggerSyncAll = async () => {
    try {
      const res = await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/sheet-config/sync-all', { method: 'POST' });
      return await res.json();
    } catch (e) {
      return { success: false, error: 'Network error communicating with warehouse server.' };
    }
  };

  const handleTriggerPullAll = async () => {
    try {
      const res = await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/sheet-config/pull-all', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        await fetchAllData();
      }
      return data;
    } catch (e) {
      return { success: false, error: 'Network error communicating with warehouse server.' };
    }
  };

  const handleUpdateProduct = async (id: string, name: string, colors: string[]): Promise<boolean> => {
    try {
      const res = await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/products/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name, colors, operator: currentUser?.name || 'system' }),
      });
      if (res.ok) {
        await fetchAllData();
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  };

  const handleUpdateBuyer = async (id: string, name: string, contact?: string): Promise<boolean> => {
    try {
      const res = await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/buyers/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name, contact, operator: currentUser?.name || 'system' }),
      });
      if (res.ok) {
        await fetchAllData();
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  };

  const handleDeleteProduct = async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/products/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, operator: currentUser?.name || 'system' }),
      });
      if (res.ok) {
        await fetchAllData();
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  };

  const handleDeleteBuyer = async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/buyers/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, operator: currentUser?.name || 'system' }),
      });
      if (res.ok) {
        await fetchAllData();
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  };

  const handleUpdateBatteryTypes = async (newList: string[]): Promise<boolean> => {
    try {
      const res = await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/battery-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ list: newList, operator: currentUser?.name || 'system' }),
      });
      if (res.ok) {
        setBatteryTypes(await res.json());
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  };

  const handleUpdateChargerTypes = async (newList: string[]): Promise<boolean> => {
    try {
      const res = await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/charger-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ list: newList, operator: currentUser?.name || 'system' }),
      });
      if (res.ok) {
        setChargerTypes(await res.json());
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  };

  const handleDirectChargerSale = async (data: any): Promise<boolean> => {
    try {
      const res = await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/charger-sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, operator: currentUser?.name || 'system' }),
      });
      if (res.ok) {
        await fetchAllData();
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  };

  const handleDirectChargerImport = async (data: any): Promise<boolean> => {
    try {
      const res = await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/charger-imports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, operator: currentUser?.name || 'system' }),
      });
      if (res.ok) {
        await fetchAllData();
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  };

  const handleReleaseChargerHold = async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/charger-sales/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, operator: currentUser?.name || 'system' }),
      });
      if (res.ok) {
        await fetchAllData();
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  };

  const handleFinalizeChargerHold = async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/charger-sales/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, operator: currentUser?.name || 'system' }),
      });
      if (res.ok) {
        await fetchAllData();
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  };

  if (!currentUser) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  // Get localized display values of roles
  const getRoleBadge = (r: string) => {
    switch (r) {
      case 'manufacturer': return { text: '🔧 Production Specialist', color: 'bg-emerald-50 text-emerald-700 border border-emerald-200' };
      case 'salesperson': return { text: '💵 Sales Representative', color: 'bg-cyan-50 text-cyan-700 border border-cyan-200' };
      default: return { text: '👑 Warehouse Manager / Admin', color: 'bg-amber-50 text-amber-700 border border-amber-200' };
    }
  };

  const roleDetails = getRoleBadge(currentUser.role);

  // Helper to compute remaining unassembled imported stock for a given model and color
  const getImportedStockRemaining = (model: string, color: string) => {
    const totalImported = stockLogs
      .filter(log => log.modelName === model && log.color === color && log.type === 'in')
      .reduce((sum, log) => sum + log.quantity, 0);

    const totalAssembled = scooterUnits.filter(
      u => u.modelName === model && u.color === color
    ).length;

    return Math.max(0, totalImported - totalAssembled);
  };

  // --- 1. Custom Manufacturer Dashboard ---
  const renderManufacturerDashboard = () => {
    const builtByMe = scooterUnits.filter(u => u.createdOperator === currentUser.username).length;
    const totalBuilt = scooterUnits.length;
    const pendingBatteries = scooterUnits.filter(u => u.status === 'available' && u.batterySerials.length === 0).length;
    const availableStock = scooterUnits.filter(u => u.status === 'available').length;

    const myRecentRecordings = scooterUnits
      .filter(u => u.createdOperator === currentUser.username)
      .slice(-5)
      .reverse();

    return (
      <div className="space-y-6 mb-8">
        {/* Welcome Block */}
        <div className="bg-gradient-to-r from-emerald-500/5 via-teal-500/5 to-cyan-500/5 border border-emerald-500/15 rounded-3xl p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            🔧 Assembly & Production Desk
          </h2>
          <p className="text-xs text-slate-600 mt-1">
            Logged in as operator <strong className="text-emerald-700 font-bold">{currentUser.name}</strong>. Here you can build scooter frames, assign physical identifiers (Chassis, Motor, Controller No), and prep battery configurations.
          </p>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-emerald-100 rounded-3xl p-5 shadow-sm">
            <div className="flex items-center justify-between text-emerald-600 mb-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider">My Built Frames</span>
              <div className="p-1.5 bg-emerald-50 rounded-xl">
                <Compass className="h-4 w-4" />
              </div>
            </div>
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight">{builtByMe}</span>
            <p className="text-[10px] text-slate-500 mt-1 font-semibold">Total scooters assembled by you</p>
          </div>

          <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider">Total Warehouse Built</span>
              <div className="p-1.5 bg-slate-50 rounded-xl">
                <LayoutDashboard className="h-4 w-4" />
              </div>
            </div>
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight">{totalBuilt}</span>
            <p className="text-[10px] text-slate-500 mt-1 font-semibold">Scooters assembled globally</p>
          </div>

          <div className="bg-white border border-amber-100 rounded-3xl p-5 shadow-sm">
            <div className="flex items-center justify-between text-amber-600 mb-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider">Pending Battery Prep</span>
              <div className="p-1.5 bg-amber-50 rounded-xl">
                <RefreshCw className="h-4 w-4" />
              </div>
            </div>
            <span className="text-3xl font-extrabold text-amber-600 tracking-tight">{pendingBatteries}</span>
            <p className="text-[10px] text-slate-500 mt-1 font-semibold">Frames awaiting batteries in warehouse</p>
          </div>

          <div className="bg-white border border-cyan-100 rounded-3xl p-5 shadow-sm">
            <div className="flex items-center justify-between text-cyan-600 mb-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider">Ready / Available Stock</span>
              <div className="p-1.5 bg-cyan-50 rounded-xl">
                <ClipboardList className="h-4 w-4" />
              </div>
            </div>
            <span className="text-3xl font-extrabold text-cyan-600 tracking-tight">{availableStock}</span>
            <p className="text-[10px] text-slate-500 mt-1 font-semibold">Ready-to-sell stock in warehouse</p>
          </div>
        </div>

        {/* Dynamic Production Backlog Section */}
        {(() => {
          let totalKitsRemaining = 0;
          const modelKitsRemaining: { [model: string]: number } = {};
          products.forEach(p => {
            let modelTotal = 0;
            p.colors.forEach(col => {
              const remaining = getImportedStockRemaining(p.name, col);
              totalKitsRemaining += remaining;
              modelTotal += remaining;
            });
            modelKitsRemaining[p.name] = modelTotal;
          });

          return (
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 pb-4 border-b border-slate-100 gap-3">
                <div>
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 font-sans flex items-center gap-1.5">
                    🔧 Production Backlog (Kits Left to Build)
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Live counts of imported shipping kits awaiting assembly and registration.
                  </p>
                </div>
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 px-3 py-1.5 rounded-2xl shrink-0">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700 font-sans">Total Left to Build:</span>
                  <span className="text-sm font-black text-amber-800 font-mono">{totalKitsRemaining} kits</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {products.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center col-span-full">No products catalogued yet.</p>
                ) : (
                  products.map(p => {
                    const remainingForModel = modelKitsRemaining[p.name] || 0;
                    return (
                      <div key={p.id} className="border border-slate-150 bg-slate-50/50 rounded-2xl p-4 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                            <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">
                              {p.name}
                            </span>
                            <span className={`px-2.5 py-0.5 text-[10px] font-extrabold rounded-full border ${remainingForModel > 0 ? 'bg-amber-50 text-amber-700 border-amber-150' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                              {remainingForModel} left
                            </span>
                          </div>

                          {/* Color breakdown */}
                          <div className="space-y-1.5">
                            {p.colors.map(col => {
                              const remainingForColor = getImportedStockRemaining(p.name, col);
                              return (
                                <div key={col} className="bg-white px-2.5 py-1.5 rounded-xl border border-slate-100 flex items-center justify-between text-xs font-sans">
                                  <span className="font-semibold text-slate-600">{col}</span>
                                  <span className={`font-mono font-bold text-[10px] px-2 py-0.5 rounded-full ${remainingForColor > 0 ? 'text-amber-800 bg-amber-50 border border-amber-100' : 'text-slate-400 bg-slate-50 border border-slate-100'}`}>
                                    {remainingForColor} kits
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })()}

        {/* Build History */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-4 font-sans flex items-center gap-2">
            📝 My Recent Build Recordings
          </h3>
          {myRecentRecordings.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-xs font-semibold">
              No recent frames assembled by you yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">Scooter model</th>
                    <th className="py-3 px-4">Color</th>
                    <th className="py-3 px-4">Chassis No</th>
                    <th className="py-3 px-4">Motor No</th>
                    <th className="py-3 px-4">Batteries Allocation</th>
                    <th className="py-3 px-4">Warehouse Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {myRecentRecordings.map((unit) => (
                    <tr key={unit.id} className="text-slate-700 hover:bg-slate-50/50">
                      <td className="py-3.5 px-4 font-extrabold text-slate-900">{unit.modelName}</td>
                      <td className="py-3.5 px-4 font-medium">{unit.color}</td>
                      <td className="py-3.5 px-4 font-mono font-bold text-[11px] text-slate-900">{unit.chassisNo}</td>
                      <td className="py-3.5 px-4 font-mono text-[11px]">{unit.motorNo}</td>
                      <td className="py-3.5 px-4">
                        {unit.batterySerials.length > 0 ? (
                          <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-full">
                            🔋 {unit.batterySerials.length} Batteries Prepped
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-bold rounded-full animate-pulse">
                            ⏳ Missing Batteries
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {unit.status === 'sold' ? (
                          <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded-full">Dispatched (Sold)</span>
                        ) : (
                          <span className="px-2.5 py-0.5 bg-cyan-50 text-cyan-700 text-[10px] font-bold rounded-full">In Warehouse</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* --- LIVE WAREHOUSE STOCK LOOKUP (STOCK STANDING IN WAREHOUSE) --- */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6" id="warehouse-stock-lookup">
          <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-100 gap-4">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 font-sans tracking-tight flex items-center gap-2">
                🔍 Live Warehouse Stock Matcher
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Scan, filter, and match active physical scooter stock standing in the warehouse.
              </p>
            </div>
            
            {/* Quick Summary Badge */}
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-150 px-3 py-1.5 rounded-2xl self-start md:self-auto">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 font-sans">Active Warehouse Units:</span>
              <span className="text-sm font-black text-emerald-900 font-mono">
                {scooterUnits.filter(u => u.status !== 'sold').length} units
              </span>
            </div>
          </div>

          {/* Interactive Filters Block */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-150" id="stock-lookup-filters">
            {/* Model Filter */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-sans">Model Name</label>
              <select
                value={mfrSearchModel}
                onChange={(e) => {
                  setMfrSearchModel(e.target.value);
                  setMfrSearchColor('all'); // Reset color when model changes
                }}
                className="w-full bg-white border border-slate-200 text-xs font-semibold rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-emerald-500 transition-all"
              >
                <option value="all">All Models</option>
                {products.map(p => (
                  <option key={p.id} value={p.name}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Color Filter */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-sans">Color Option</label>
              <select
                value={mfrSearchColor}
                onChange={(e) => setMfrSearchColor(e.target.value)}
                className="w-full bg-white border border-slate-200 text-xs font-semibold rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-emerald-500 transition-all"
                disabled={mfrSearchModel === 'all'}
              >
                <option value="all">All Colors</option>
                {mfrSearchModel !== 'all' && products.find(p => p.name === mfrSearchModel)?.colors.map(col => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
            </div>

            {/* Search Input */}
            <div className="space-y-1 sm:col-span-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-sans">Search Identifiers</label>
              <div className="relative">
                <input
                  type="text"
                  value={mfrSearchText}
                  onChange={(e) => setMfrSearchText(e.target.value)}
                  placeholder="Type Chassis, Motor, or Controller No..."
                  className="w-full bg-white border border-slate-200 text-xs font-semibold rounded-xl pl-8 pr-3 py-2 text-slate-800 focus:outline-none focus:border-emerald-500 transition-all placeholder:text-slate-400"
                />
                <div className="absolute left-2.5 top-2.5 text-slate-400">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Filtered List */}
          {(() => {
            const filtered = scooterUnits.filter(u => {
              // Only match warehouse stock standing (status !== 'sold')
              if (u.status === 'sold') return false;

              // Model filter
              if (mfrSearchModel !== 'all' && u.modelName !== mfrSearchModel) return false;

              // Color filter
              if (mfrSearchColor !== 'all' && u.color !== mfrSearchColor) return false;

              // Text search (Chassis No, Motor No, Controller No)
              if (mfrSearchText.trim()) {
                const search = mfrSearchText.toLowerCase();
                const chassisMatch = String(u.chassisNo || '').toLowerCase().includes(search);
                const motorMatch = String(u.motorNo || '').toLowerCase().includes(search);
                const controllerMatch = String(u.controllerNo || '').toLowerCase().includes(search);
                if (!chassisMatch && !motorMatch && !controllerMatch) return false;
              }

              return true;
            });

            if (filtered.length === 0) {
              return (
                <div className="text-center py-10 bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
                  <div className="text-slate-400 font-sans font-semibold text-xs">No matching warehouse stock found.</div>
                  <p className="text-[10px] text-slate-400 mt-1">Try adjusting your filters or search terms.</p>
                </div>
              );
            }

            return (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="warehouse-matched-list">
                {filtered.map(unit => (
                  <div
                    key={unit.id}
                    onClick={() => setSelectedDetailScooter(unit)}
                    className="group border border-slate-200 bg-white hover:border-emerald-500 rounded-2xl p-4 shadow-sm hover:shadow transition-all cursor-pointer flex flex-col justify-between hover:scale-[1.01]"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-extrabold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100 uppercase tracking-wide">
                          {unit.modelName}
                        </span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                          unit.status === 'hold' 
                            ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                            : 'bg-cyan-50 text-cyan-700 border border-cyan-200'
                        }`}>
                          {unit.status.toUpperCase()}
                        </span>
                      </div>

                      <h4 className="text-xs font-black text-slate-900 tracking-tight mb-2 flex items-center gap-1.5 font-mono">
                        <span>Chassis No:</span>
                        <span className="text-slate-700 font-bold group-hover:text-emerald-700 transition-colors">{unit.chassisNo}</span>
                      </h4>

                      <div className="space-y-1 text-[10px] text-slate-500 font-sans border-t border-slate-100 pt-2">
                        <div className="flex justify-between">
                          <span>Color:</span>
                          <strong className="text-slate-700">{unit.color}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Motor No:</span>
                          <strong className="text-slate-700 font-mono">{unit.motorNo}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Controller No:</span>
                          <strong className="text-slate-700 font-mono">{unit.controllerNo}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Batteries Linked:</span>
                          <span className={`font-bold ${unit.batterySerials.length > 0 ? 'text-emerald-700' : 'text-amber-700 animate-pulse'}`}>
                            {unit.batterySerials.length > 0 ? `🔋 ${unit.batterySerials.length} linked` : '⏳ Missing'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-50 flex items-center justify-between text-[10px] font-sans text-slate-400 group-hover:text-emerald-600 transition-colors">
                      <span>Click for full specs & details</span>
                      <svg className="h-3.5 w-3.5 transform group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </div>
    );
  };

  // --- 2. Custom Salesperson Dashboard ---
  const renderSalespersonDashboard = () => {
    const soldByMe = scooterUnits.filter(u => u.status === 'sold' && u.lastUpdatedBy === currentUser.username).length;
    const totalSold = scooterUnits.filter(u => u.status === 'sold').length;
    const availableStock = scooterUnits.filter(u => u.status === 'available').length;
    const myRevenue = scooterUnits
      .filter(u => u.status === 'sold' && u.lastUpdatedBy === currentUser.username)
      .reduce((sum, u) => sum + (u.salesPrice || 0), 0);

    const myRecentRecordings = scooterUnits
      .filter(u => u.status === 'sold' && u.lastUpdatedBy === currentUser.username)
      .slice(-5)
      .reverse();

    // Helper to compute remaining unassembled imported stock for a given model and color
    const getImportedStockRemaining = (model: string, color: string) => {
      const totalImported = stockLogs
        .filter(log => log.modelName === model && log.color === color && log.type === 'in')
        .reduce((sum, log) => sum + log.quantity, 0);

      const totalAssembled = scooterUnits.filter(
        u => u.modelName === model && u.color === color
      ).length;

      return Math.max(0, totalImported - totalAssembled);
    };

    const handleSalespersonBuyerSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!salespersonNewBuyerName.trim()) return;
      setSalespersonSavingBuyer(true);
      setSalespersonBuyerStatus(null);
      const ok = await handleAddBuyer(salespersonNewBuyerName.trim(), salespersonNewBuyerContact.trim());
      setSalespersonSavingBuyer(false);
      if (ok) {
        setSalespersonBuyerStatus({ type: 'success', text: `Buyer "${salespersonNewBuyerName}" registered successfully!` });
        setSalespersonNewBuyerName('');
        setSalespersonNewBuyerContact('');
        fetchAllData();
      } else {
        setSalespersonBuyerStatus({ type: 'error', text: 'Failed to add buyer. They might already exist.' });
      }
    };

    return (
      <div className="space-y-6 mb-8">
        {/* Welcome Block */}
        <div className="bg-gradient-to-r from-cyan-500/5 via-blue-500/5 to-purple-500/5 border border-cyan-500/15 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              💵 Sales Desk & Deliveries
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              Logged in as sales representative <strong className="text-cyan-700 font-bold">{currentUser.name}</strong>. Here you can checkout customers (POS Sales), record buyers, configure active warranties, and monitor inventory levels.
            </p>
          </div>
          <button
            onClick={() => setShowSalespersonAddBuyerForm(!showSalespersonAddBuyerForm)}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs rounded-2xl flex items-center gap-1.5 transition-all shadow-sm shrink-0 cursor-pointer"
          >
            {showSalespersonAddBuyerForm ? 'Close Buyer Form' : '➕ Register New Buyer'}
          </button>
        </div>

        {/* Collapsible Register New Buyer Form */}
        {showSalespersonAddBuyerForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="bg-white border border-cyan-100 rounded-3xl p-6 shadow-sm"
          >
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-cyan-700 mb-3 font-sans">
              👤 Register New Buyer to Database
            </h3>
            <form onSubmit={handleSalespersonBuyerSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 font-sans">Buyer Full Name</label>
                <input
                  type="text"
                  placeholder="Enter buyer's full name"
                  value={salespersonNewBuyerName}
                  onChange={(e) => setSalespersonNewBuyerName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:border-cyan-500 outline-none font-sans"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 font-sans">Contact Details / Email</label>
                <input
                  type="text"
                  placeholder="e.g. +91 99001 23456"
                  value={salespersonNewBuyerContact}
                  onChange={(e) => setSalespersonNewBuyerContact(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:border-cyan-500 outline-none font-sans"
                />
              </div>
              <button
                type="submit"
                disabled={salespersonSavingBuyer}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-sans font-bold text-xs rounded-xl cursor-pointer disabled:opacity-50"
              >
                {salespersonSavingBuyer ? 'Saving...' : 'Register Buyer'}
              </button>
            </form>
            {salespersonBuyerStatus && (
              <p className={`text-xs font-semibold mt-3 ${salespersonBuyerStatus.type === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>
                {salespersonBuyerStatus.text}
              </p>
            )}
          </motion.div>
        )}

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-cyan-100 rounded-3xl p-5 shadow-sm">
            <div className="flex items-center justify-between text-cyan-600 mb-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider">My Sold Units</span>
              <div className="p-1.5 bg-cyan-50 rounded-xl">
                <Compass className="h-4 w-4" />
              </div>
            </div>
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight">{soldByMe}</span>
            <p className="text-[10px] text-slate-500 mt-1 font-semibold">Sales transactions you completed</p>
          </div>

          <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider">Total Warehouse Sales</span>
              <div className="p-1.5 bg-slate-50 rounded-xl">
                <LayoutDashboard className="h-4 w-4" />
              </div>
            </div>
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight">{totalSold}</span>
            <p className="text-[10px] text-slate-500 mt-1 font-semibold">Total dispatched units globally</p>
          </div>

          <div className="bg-white border border-amber-100 rounded-3xl p-5 shadow-sm">
            <div className="flex items-center justify-between text-amber-600 mb-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider">Available Stock to Sell</span>
              <div className="p-1.5 bg-amber-50 rounded-xl">
                <ClipboardList className="h-4 w-4" />
              </div>
            </div>
            <span className="text-3xl font-extrabold text-amber-600 tracking-tight">{availableStock}</span>
            <p className="text-[10px] text-slate-500 mt-1 font-semibold">Assembled units ready to purchase</p>
          </div>
        </div>

        {/* Dynamic Stock Availability Section */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 font-sans flex items-center gap-1.5">
              📦 Stock Availability (Built & Ready)
            </h3>
            <span className="text-[10px] font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
              Live Warehouse Inventory
            </span>
          </div>

          <div className="divide-y divide-slate-100 max-h-[350px] overflow-y-auto pr-1">
            {products.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No products catalogued yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 py-2">
                {products.map(p => (
                  <div key={p.id} className="border border-slate-100 bg-slate-50/50 rounded-2xl p-4">
                    <span className="text-[10px] font-extrabold text-slate-400 font-mono block uppercase tracking-wide mb-2">{p.name}</span>
                    <div className="space-y-2">
                      {p.colors.map(col => {
                        const totalAvail = scooterUnits.filter(u => u.modelName === p.name && u.color === col && u.status === 'available').length;
                        const batteryAssigned = scooterUnits.filter(u => u.modelName === p.name && u.color === col && u.status === 'available' && u.batterySerials && u.batterySerials.length > 0).length;
                        const needsBattery = totalAvail - batteryAssigned;

                        return (
                          <div key={col} className="bg-white p-2.5 rounded-xl border border-slate-100 flex items-center justify-between text-xs font-sans">
                            <div>
                              <span className="font-bold text-slate-800">{col}</span>
                              <div className="text-[10px] text-slate-500 mt-0.5 font-medium">
                                🔋 {batteryAssigned} Ready / ❌ {needsBattery} No Battery
                              </div>
                            </div>
                            <span className={`px-2.5 py-1 text-[11px] font-extrabold rounded-xl border ${totalAvail > 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
                              {totalAvail} units
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sales History */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-4 font-sans flex items-center gap-2">
            📝 My Recent Sales Recordings
          </h3>
          {myRecentRecordings.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-xs font-semibold">
              No sales recorded by you yet. Complete a checkout below!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">Scooter model</th>
                    <th className="py-3 px-4">Color</th>
                    <th className="py-3 px-4">Chassis No</th>
                    <th className="py-3 px-4">Buyer Name</th>
                    <th className="py-3 px-4">Dispatch Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {myRecentRecordings.map((unit) => (
                    <tr key={unit.id} className="text-slate-700 hover:bg-slate-50/50">
                      <td className="py-3.5 px-4 font-extrabold text-slate-900">{unit.modelName}</td>
                      <td className="py-3.5 px-4 font-medium">{unit.color}</td>
                      <td className="py-3.5 px-4 font-mono font-bold text-[11px] text-slate-900">{unit.chassisNo}</td>
                      <td className="py-3.5 px-4 font-semibold text-slate-800">{unit.buyerName}</td>
                      <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                        {unit.saleDate ? new Date(unit.saleDate).toLocaleDateString() : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  };

  // --- 3. Role-Based Rendering Block ---
  if (currentUser.role === 'manufacturer') {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans" id="terminal-layout">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <SenzoLogo layout="compact" />
              <div className="h-4 w-[1px] bg-slate-200 hidden sm:block"></div>
              <p className="text-[10px] text-slate-500 font-mono hidden sm:block">Assembly Station</p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex flex-col items-end">
                <span className="text-xs font-bold text-slate-800">{currentUser.name}</span>
                <span className={`text-[9px] font-sans font-semibold px-2.5 py-0.5 rounded-full mt-0.5 ${roleDetails.color}`}>
                  {roleDetails.text}
                </span>
              </div>
              
              <button
                onClick={fetchAllData}
                disabled={loading}
                title="Refresh warehouse data"
                className="p-2 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer transition-colors"
                id="refresh-btn"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-cyan-600' : ''}`} />
              </button>

              <button
                onClick={handleLogout}
                title="Deauthenticate terminal session"
                className="p-2 text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl cursor-pointer transition-colors"
                id="logout-btn"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Worker Switchable Tabs - Desktop and Phone Optimized */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4 w-full">
          <div className="grid grid-cols-2 gap-1 bg-slate-200/50 p-1.5 rounded-2xl border border-slate-200" id="worker-tab-navigation">
            <button
              onClick={() => setWorkerTab('workspace')}
              className={`py-3 text-xs font-extrabold tracking-wide rounded-xl font-sans uppercase flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                workerTab === 'workspace'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Shuffle className="h-4 w-4 text-emerald-500 shrink-0" />
              <span>🛠️ Log stages</span>
            </button>
            <button
              onClick={() => setWorkerTab('dashboard')}
              className={`py-3 text-xs font-extrabold tracking-wide rounded-xl font-sans uppercase flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                workerTab === 'dashboard'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutDashboard className="h-4 w-4 text-cyan-500 shrink-0" />
              <span>📊 Stats & History</span>
            </button>
          </div>
        </div>

        <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
          <AnimatePresence mode="wait">
            {workerTab === 'workspace' ? (
              <motion.div
                key="workspace"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
              >
                <AssemblyPipeline 
                  products={products} 
                  buyers={buyers}
                  scooterUnits={scooterUnits} 
                  stockLogs={stockLogs}
                  currentUser={currentUser} 
                  onRefresh={fetchAllData}
                  onSubmitAssembly={handleSubmitScooterUnit}
                  onAddBuyer={handleAddBuyer}
                  batterySales={batterySales}
                  batteryImports={batteryImports}
                  onSubmitBatterySale={handleDirectBatterySale}
                  onSubmitBatteryImport={handleDirectBatteryImport}
                  batterySeriesList={batteryTypes}
                  chargerSales={chargerSales}
                  chargerImports={chargerImports}
                  onSubmitChargerSale={handleDirectChargerSale}
                  onSubmitChargerImport={handleDirectChargerImport}
                  chargerTypeList={chargerTypes}
                  onReleaseChargerHold={handleReleaseChargerHold}
                  onFinalizeChargerHold={handleFinalizeChargerHold}
                />
              </motion.div>
            ) : (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
              >
                {renderManufacturerDashboard()}
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* --- SCOOTER UNIT SPECIFICATION MODAL --- */}
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
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Scrollable details */}
                <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
                  {/* Visual Status row */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-150">
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

                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-150 col-span-1 sm:col-span-2">
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
                        <strong className="text-slate-900 font-mono select-all bg-slate-50 px-2 py-0.5 rounded border border-slate-150">{selectedDetailScooter.chassisNo}</strong>
                      </div>

                      <div className="flex justify-between items-center text-xs py-1">
                        <span className="text-slate-500 font-semibold">Motor Number</span>
                        <strong className="text-slate-900 font-mono select-all bg-slate-50 px-2 py-0.5 rounded border border-slate-150">{selectedDetailScooter.motorNo}</strong>
                      </div>

                      <div className="flex justify-between items-center text-xs py-1">
                        <span className="text-slate-500 font-semibold">Controller Number</span>
                        <strong className="text-slate-900 font-mono select-all bg-slate-50 px-2 py-0.5 rounded border border-slate-150">{selectedDetailScooter.controllerNo}</strong>
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
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-150 space-y-3">
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
                      <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-150 text-xs text-slate-600 leading-relaxed font-sans font-medium whitespace-pre-wrap">
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

        <footer className="py-5 border-t border-slate-200 bg-white mt-12 text-center text-slate-400 text-xs font-semibold">
          ✨ Senzo Warehouse Manager — Production Terminal — {new Date().getFullYear()}
        </footer>
      </div>
    );
  }

  if (currentUser.role === 'salesperson') {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans" id="terminal-layout">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <SenzoLogo layout="compact" />
              <div className="h-4 w-[1px] bg-slate-200 hidden sm:block"></div>
              <p className="text-[10px] text-slate-500 font-mono hidden sm:block">Sales Desk</p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex flex-col items-end">
                <span className="text-xs font-bold text-slate-800">{currentUser.name}</span>
                <span className={`text-[9px] font-sans font-semibold px-2.5 py-0.5 rounded-full mt-0.5 ${roleDetails.color}`}>
                  {roleDetails.text}
                </span>
              </div>
              
              <button
                onClick={fetchAllData}
                disabled={loading}
                title="Refresh warehouse data"
                className="p-2 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer transition-colors"
                id="refresh-btn"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-cyan-600' : ''}`} />
              </button>

              <button
                onClick={handleLogout}
                title="Deauthenticate terminal session"
                className="p-2 text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl cursor-pointer transition-colors"
                id="logout-btn"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Worker Switchable Tabs - Desktop and Phone Optimized */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4 w-full">
          <div className="grid grid-cols-2 gap-1 bg-slate-200/50 p-1.5 rounded-2xl border border-slate-200" id="worker-tab-navigation-sales">
            <button
              onClick={() => setWorkerTab('workspace')}
              className={`py-3 text-xs font-extrabold tracking-wide rounded-xl font-sans uppercase flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                workerTab === 'workspace'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Shuffle className="h-4 w-4 text-emerald-500 shrink-0" />
              <span>🛠️ Log stages</span>
            </button>
            <button
              onClick={() => setWorkerTab('dashboard')}
              className={`py-3 text-xs font-extrabold tracking-wide rounded-xl font-sans uppercase flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                workerTab === 'dashboard'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutDashboard className="h-4 w-4 text-cyan-500 shrink-0" />
              <span>📊 Stats & History</span>
            </button>
          </div>
        </div>

        <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
          <AnimatePresence mode="wait">
            {workerTab === 'workspace' ? (
              <motion.div
                key="workspace-sales"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
                className="space-y-8"
              >
                <AssemblyPipeline 
                  products={products} 
                  buyers={buyers}
                  scooterUnits={scooterUnits} 
                  stockLogs={stockLogs}
                  currentUser={currentUser} 
                  onRefresh={fetchAllData}
                  onSubmitAssembly={handleSubmitScooterUnit}
                  onAddBuyer={handleAddBuyer}
                  batterySales={batterySales}
                  batteryImports={batteryImports}
                  onSubmitBatterySale={handleDirectBatterySale}
                  onSubmitBatteryImport={handleDirectBatteryImport}
                  batterySeriesList={batteryTypes}
                  chargerSales={chargerSales}
                  chargerImports={chargerImports}
                  onSubmitChargerSale={handleDirectChargerSale}
                  onSubmitChargerImport={handleDirectChargerImport}
                  chargerTypeList={chargerTypes}
                  onReleaseChargerHold={handleReleaseChargerHold}
                  onFinalizeChargerHold={handleFinalizeChargerHold}
                />
              </motion.div>
            ) : (
              <motion.div
                key="dashboard-sales"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
              >
                {renderSalespersonDashboard()}
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        <footer className="py-5 border-t border-slate-200 bg-white mt-12 text-center text-slate-400 text-xs font-semibold">
          ✨ Senzo Warehouse Manager — Sales Terminal — {new Date().getFullYear()}
        </footer>
      </div>
    );
  }

  // --- 4. Admin / Owner Layout (Standard tabs switcher) ---
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans" id="terminal-layout">
      {/* 1. Header / Navigation bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Brand Logo / Info */}
          <div className="flex items-center gap-3">
            <SenzoLogo layout="compact" />
            <div className="h-4 w-[1px] bg-slate-200 hidden sm:block"></div>
            <p className="text-[10px] text-slate-500 font-mono hidden sm:block">Warehouse Manager v3.0</p>
          </div>

          {/* Navigation Items */}
          <nav className="hidden md:flex items-center gap-1">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold tracking-wide transition-all cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              id="nav-overview-btn"
            >
              <LayoutDashboard className="h-4 w-4 text-cyan-600" />
              <span>📊 Dashboard</span>
            </button>
            <button
              onClick={() => setActiveTab('assembly')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold tracking-wide transition-all cursor-pointer ${
                activeTab === 'assembly'
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              id="nav-registry-btn"
            >
              <Shuffle className="h-4 w-4 text-emerald-600" />
              <span>🛠️ Build & Sell</span>
            </button>
            <button
              onClick={() => setActiveTab('stock')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold tracking-wide transition-all cursor-pointer ${
                activeTab === 'stock'
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              id="nav-ledger-btn"
            >
              <ClipboardList className="h-4 w-4 text-blue-600" />
              <span>📦 Import Stock</span>
            </button>
            <button
              onClick={() => setActiveTab('catalog')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold tracking-wide transition-all cursor-pointer ${
                activeTab === 'catalog'
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              id="nav-blueprints-btn"
            >
              <BookOpen className="h-4 w-4 text-amber-600" />
              <span>🎨 Models & Buyers</span>
            </button>
            <button
              onClick={() => setActiveTab('battery')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold tracking-wide transition-all cursor-pointer ${
                activeTab === 'battery'
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              id="nav-battery-btn"
            >
              <Battery className="h-4 w-4 text-emerald-500 fill-emerald-500" />
              <span>🔋 Battery Sales</span>
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold tracking-wide transition-all cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              id="nav-settings-btn"
            >
              <Settings className="h-4 w-4 text-purple-600" />
              <span>⚙️ Settings</span>
            </button>
          </nav>

          {/* User Profile & Actions */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-xs font-bold text-slate-800">{currentUser.name}</span>
              <span className={`text-[9px] font-sans font-semibold px-2.5 py-0.5 rounded-full mt-0.5 ${roleDetails.color}`}>
                {roleDetails.text}
              </span>
            </div>
            
            <button
              onClick={fetchAllData}
              disabled={loading}
              title="Refresh warehouse data"
              className="p-2 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer transition-colors"
              id="refresh-btn"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-cyan-600' : ''}`} />
            </button>

            <button
              onClick={handleLogout}
              title="Deauthenticate terminal session"
              className="p-2 text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl cursor-pointer transition-colors"
              id="logout-btn"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>

        </div>
      </header>

      {/* 2. Mobile Tab Bar */}
      <div className="md:hidden bg-white border-b border-slate-200 flex items-center justify-around py-2.5 px-2">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center gap-1 p-1 cursor-pointer ${activeTab === 'dashboard' ? 'text-slate-900' : 'text-slate-400'}`}
        >
          <LayoutDashboard className="h-4.5 w-4.5 text-cyan-600" />
          <span className="text-[10px] font-bold font-sans">📊 Dashboard</span>
        </button>
        <button
          onClick={() => setActiveTab('assembly')}
          className={`flex flex-col items-center gap-1 p-1 cursor-pointer ${activeTab === 'assembly' ? 'text-slate-900' : 'text-slate-400'}`}
        >
          <Shuffle className="h-4.5 w-4.5 text-emerald-600" />
          <span className="text-[10px] font-bold font-sans">🛠️ Build & Sell</span>
        </button>
        <button
          onClick={() => setActiveTab('stock')}
          className={`flex flex-col items-center gap-1 p-1 cursor-pointer ${activeTab === 'stock' ? 'text-slate-900' : 'text-slate-400'}`}
        >
          <ClipboardList className="h-4.5 w-4.5 text-blue-600" />
          <span className="text-[10px] font-bold font-sans">📦 Import</span>
        </button>
        <button
          onClick={() => setActiveTab('catalog')}
          className={`flex flex-col items-center gap-1 p-1 cursor-pointer ${activeTab === 'catalog' ? 'text-slate-900' : 'text-slate-400'}`}
        >
          <BookOpen className="h-4.5 w-4.5 text-amber-600" />
          <span className="text-[10px] font-bold font-sans">🎨 Models</span>
        </button>
        <button
          onClick={() => setActiveTab('battery')}
          className={`flex flex-col items-center gap-1 p-1 cursor-pointer ${activeTab === 'battery' ? 'text-slate-900' : 'text-slate-400'}`}
        >
          <Battery className="h-4.5 w-4.5 text-emerald-500" />
          <span className="text-[10px] font-bold font-sans">🔋 Batteries</span>
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex flex-col items-center gap-1 p-1 cursor-pointer ${activeTab === 'settings' ? 'text-slate-900' : 'text-slate-400'}`}
        >
          <Settings className="h-4.5 w-4.5 text-purple-600" />
          <span className="text-[10px] font-bold font-sans">⚙️ Settings</span>
        </button>
      </div>

      {/* 3. Main Workspace Area */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'dashboard' && (
              <DashboardStats 
                products={products} 
                scooterUnits={scooterUnits} 
                stockLogs={stockLogs} 
                batterySales={batterySales}
                batteryImports={batteryImports}
                onNavigateToAssembly={() => setActiveTab('assembly')}
                onNavigateToBatteries={() => setActiveTab('battery')}
                onNavigateToStock={() => setActiveTab('stock')}
              />
            )}

            {activeTab === 'assembly' && (
              <AssemblyPipeline 
                products={products} 
                buyers={buyers}
                scooterUnits={scooterUnits} 
                stockLogs={stockLogs}
                currentUser={currentUser} 
                onRefresh={fetchAllData}
                onSubmitAssembly={handleSubmitScooterUnit}
                onAddBuyer={handleAddBuyer}
                batterySales={batterySales}
                batteryImports={batteryImports}
                onSubmitBatterySale={handleDirectBatterySale}
                onSubmitBatteryImport={handleDirectBatteryImport}
                batterySeriesList={batteryTypes}
                chargerSales={chargerSales}
                chargerImports={chargerImports}
                onSubmitChargerSale={handleDirectChargerSale}
                onSubmitChargerImport={handleDirectChargerImport}
                chargerTypeList={chargerTypes}
                onReleaseChargerHold={handleReleaseChargerHold}
                onFinalizeChargerHold={handleFinalizeChargerHold}
              />
            )}

            {activeTab === 'stock' && (
              <StockAdjustment 
                products={products} 
                buyers={buyers} 
                stockLogs={stockLogs} 
                currentUser={currentUser} 
                onRefresh={fetchAllData}
                onSubmitStockLog={handleSubmitStockLog}
                batteryImports={batteryImports}
                onSubmitBatteryImport={handleDirectBatteryImport}
                chargerImports={chargerImports}
                onSubmitChargerImport={handleDirectChargerImport}
                chargerTypeList={chargerTypes}
              />
            )}

            {activeTab === 'catalog' && (
              <CatalogManager 
                products={products} 
                buyers={buyers} 
                onRefresh={fetchAllData}
                onAddProduct={handleAddProduct}
                onAddBuyer={handleAddBuyer}
                onUpdateProduct={handleUpdateProduct}
                onUpdateBuyer={handleUpdateBuyer}
                onDeleteProduct={handleDeleteProduct}
                onDeleteBuyer={handleDeleteBuyer}
                batterySeriesList={batteryTypes}
                chargerTypeList={chargerTypes}
                onUpdateBatteryTypes={handleUpdateBatteryTypes}
                onUpdateChargerTypes={handleUpdateChargerTypes}
              />
            )}

            {activeTab === 'battery' && (
              <BatterySalesManager 
                buyers={buyers}
                batterySales={batterySales}
                batteryImports={batteryImports}
                scooterUnits={scooterUnits}
                currentUser={currentUser}
                onRefresh={fetchAllData}
                onSubmitBatterySale={handleDirectBatterySale}
                batterySeriesList={batteryTypes}
              />
            )}

            {activeTab === 'charger' && (
              <ChargerSalesManager 
                buyers={buyers}
                chargerSales={chargerSales}
                chargerImports={chargerImports}
                chargerTypesList={chargerTypes}
                currentUser={currentUser}
                onRefresh={fetchAllData}
                onSubmitChargerSale={handleDirectChargerSale}
                onSubmitChargerImport={handleDirectChargerImport}
                onReleaseHold={handleReleaseChargerHold}
                onFinalizeHold={handleFinalizeChargerHold}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsPanel 
                sheetConfig={sheetConfig} 
                onSaveConfig={handleSaveSheetConfig} 
                onTriggerSyncAll={handleTriggerSyncAll}
                onTriggerPullAll={handleTriggerPullAll}
                scooterUnits={scooterUnits}
                batterySales={batterySales}
                batteryImports={batteryImports}
                stockLogs={stockLogs}
                currentUser={currentUser}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* 4. Footer */}
      <footer className="py-5 border-t border-slate-200 bg-white mt-12 text-center text-slate-400 text-xs font-semibold">
        ✨ Senzo Warehouse Manager — Simple & Powerful — {new Date().getFullYear()}
      </footer>
    </div>
  );
}
