import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Compass, LayoutDashboard, Shuffle, ClipboardList, BookOpen, Cloud, LogOut, RefreshCw, User as UserIcon, Battery, Settings, Sparkles, Zap, Search, ShieldCheck, MoreHorizontal, X, Truck
} from 'lucide-react';

import { User, Product, Buyer, ScooterUnit, StockLog, SheetConfig, BatterySale, BatteryImport, ChargerSale, ChargerImport, WarrantyClaim } from './types';
import LoginScreen from './components/LoginScreen';
import DashboardStats from './components/DashboardStats';
import AssemblyPipeline from './components/AssemblyPipeline';
import StockAdjustment from './components/StockAdjustment';
import CatalogManager from './components/CatalogManager';
import BatterySalesManager from './components/BatterySalesManager';
import ChargerSalesManager from './components/ChargerSalesManager';
import SettingsPanel from './components/SettingsPanel';
import SenzoLogo from './components/SenzoLogo';
import SearchConsole from './components/SearchConsole';
import WarrantyClaimsManager from './components/WarrantyClaimsManager';
import { ChallanManager } from './components/ChallanManager';
import StaffUnifiedMap from './components/StaffUnifiedMap';

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
  const [warrantyClaims, setWarrantyClaims] = useState<WarrantyClaim[]>([]);

  // Navigation tab states
  const [activeTab, setActiveTab] = useState<'dashboard' | 'assembly' | 'stock' | 'catalog' | 'battery' | 'charger' | 'settings' | 'search' | 'claims' | 'challans' | 'location'>('dashboard');
  const [loading, setLoading] = useState(false);
  const [workerTab, setWorkerTab] = useState<'workspace' | 'charger' | 'dashboard'>('workspace');
  const [showMobileMoreMenu, setShowMobileMoreMenu] = useState(false);

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

  // Active mobile section indicator popup state
  const [mobileNotification, setMobileNotification] = useState<string | null>(null);

  // Geolocation enforcement state to prevent turning  // Global View States
  const [locationBlocked, setLocationBlocked] = useState<boolean>(false);
  const [checkingLocation, setCheckingLocation] = useState<boolean>(false);
  const [locationCheckError, setLocationCheckError] = useState<string | null>(null);

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

    const parseAndSet = async (res: Response, setter: (val: any) => void) => {
      try {
        if (res.ok) {
          const contentType = res.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const val = await res.json();
            if (val !== undefined && val !== null) {
              setter(val);
            }
          }
        }
      } catch (e) {
        console.error('Error parsing response as JSON:', e);
      }
    };

    try {
      const [pRes, bRes, sUnitRes, sLogRes, cRes, batRes, batImpRes, chgRes, chgImpRes, batTypeRes, chgTypeRes, claimsRes] = await Promise.all([
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
        fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/charger-types'),
        fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/warranty-claims')
      ]);

      await Promise.all([
        parseAndSet(pRes, setProducts),
        parseAndSet(bRes, setBuyers),
        parseAndSet(sUnitRes, setScooterUnits),
        parseAndSet(sLogRes, setStockLogs),
        parseAndSet(cRes, setSheetConfig),
        parseAndSet(batRes, setBatterySales),
        parseAndSet(batImpRes, setBatteryImports),
        parseAndSet(chgRes, setChargerSales),
        parseAndSet(chgImpRes, setChargerImports),
        parseAndSet(batTypeRes, setBatteryTypes),
        parseAndSet(chgTypeRes, setChargerTypes),
        parseAndSet(claimsRes, setWarrantyClaims)
      ]);
    } catch (err) {
      console.error('Error loading data from warehouse server:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [currentUser]);

  // Silent background location reporter (live location sync) with strict employee monitoring
  useEffect(() => {
    if (!currentUser) return;

    const isEmployee = currentUser.role === 'manufacturer' || currentUser.role === 'salesperson' || currentUser.role === 'manager';

    const reportLocation = async (lat: number, lng: number) => {
      try {
        await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/users/location', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: currentUser.username,
            latitude: lat,
            longitude: lng
          })
        });
      } catch (err) {
        console.warn('Quiet location telemetry update skipped:', err);
      }
    };

    const fetchIpLocation = async () => {
      try {
        const ipRes = await fetch('https://ipapi.co/json/');
        if (ipRes.ok) {
          const ipData = await ipRes.json();
          if (ipData.latitude && ipData.longitude) {
            await reportLocation(ipData.latitude, ipData.longitude);
          }
        }
      } catch (err) {
        console.warn('IP Geolocation fallback skipped:', err);
      }
    };

    const fetchCurrentPosition = (isStrictCheck = false) => {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setLocationBlocked(false);
            setLocationCheckError(null);
            reportLocation(pos.coords.latitude, pos.coords.longitude);
          },
          (err) => {
            console.warn('Silent location fetch skipped/failed, trying fallback/blocking:', err);
            if (isEmployee) {
              setLocationBlocked(true);
              if (err.code === err.PERMISSION_DENIED) {
                setLocationCheckError('Permission Denied: Location access has been disabled or blocked. Please allow location access in your browser settings.');
              } else if (err.code === err.POSITION_UNAVAILABLE) {
                setLocationCheckError('Position Unavailable: GPS signal is inactive or device location services are switched off.');
              } else if (err.code === err.TIMEOUT) {
                setLocationCheckError('Timeout: The request to acquire device GPS coordinates timed out. Ensure location is enabled with high accuracy.');
              } else {
                setLocationCheckError('Device Location Inaccessible: Please turn your physical device location services ON.');
              }
            } else {
              // Non-employees/admins fall back to IP Geolocation
              fetchIpLocation();
            }
          },
          { enableHighAccuracy: true, timeout: 8000 }
        );
      } else {
        if (isEmployee) {
          setLocationBlocked(true);
          setLocationCheckError('System Error: Geolocation is not supported by this browser terminal.');
        } else {
          fetchIpLocation();
        }
      }
    };

    fetchCurrentPosition(true);

    // Check every 10 seconds to catch location turning off instantly
    const intervalId = setInterval(() => {
      fetchCurrentPosition(false);
    }, 10000);

    // Scheduled strict re-verification audit every 5 minutes (300,000 ms)
    const fiveMinIntervalId = setInterval(() => {
      console.log('Running scheduled 5-minute strict physical location audit...');
      fetchCurrentPosition(true);
    }, 300000);

    return () => {
      if (intervalId !== null) clearInterval(intervalId);
      if (fiveMinIntervalId !== null) clearInterval(fiveMinIntervalId);
    };
  }, [currentUser]);

  // Periodic live location pull-request listener
  useEffect(() => {
    if (!currentUser) return;

    const checkPullRequestAndRespond = async () => {
      try {
        const res = await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + `/api/users/check-pull?username=${encodeURIComponent(currentUser.username)}`);
        if (res.ok) {
          const contentType = res.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const data = await res.json();
            if (data && data.pullRequested) {
            const reportPullResult = async (lat: number, lng: number) => {
              try {
                await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/users/location', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    username: currentUser.username,
                    latitude: lat,
                    longitude: lng
                  })
                });
              } catch (err) {
                console.warn('Failed to report live requested location:', err);
              }
            };

            const runIpPullFallback = async () => {
              try {
                const ipRes = await fetch('https://ipapi.co/json/');
                if (ipRes.ok) {
                  const ipData = await ipRes.json();
                  if (ipData.latitude && ipData.longitude) {
                    await reportPullResult(ipData.latitude, ipData.longitude);
                  }
                }
              } catch (err) {
                console.warn('IP Geolocation pull fallback skipped:', err);
              }
            };

            // Immediately pull the current physical coordinates of the device and report
            if ('geolocation' in navigator) {
              navigator.geolocation.getCurrentPosition(
                async (pos) => {
                  await reportPullResult(pos.coords.latitude, pos.coords.longitude);
                },
                async (err) => {
                  console.warn('Requested high-accuracy geolocation pull skipped, trying IP fallback:', err);
                  await runIpPullFallback();
                },
                { enableHighAccuracy: true, timeout: 10000 }
              );
            } else {
              await runIpPullFallback();
            }
          }
          }
        }
      } catch (err) {
        console.warn('Live location pull check skipped:', err);
      }
    };

    // Check immediately and then poll every 10 seconds
    checkPullRequestAndRespond();
    const intervalId = setInterval(checkPullRequestAndRespond, 10000);

    return () => clearInterval(intervalId);
  }, [currentUser]);



  // Auto background pull from sheet whenever user changes tabs to refresh and capture live sheet edits!
  useEffect(() => {
    if (!currentUser) return;

    const parseAndSet = async (res: Response, setter: (val: any) => void) => {
      try {
        if (res.ok) {
          const contentType = res.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const val = await res.json();
            if (val !== undefined && val !== null) {
              setter(val);
            }
          }
        }
      } catch (e) {
        console.error('Error parsing response as JSON:', e);
      }
    };
    
    const refreshData = async () => {
      try {
        const [pRes, bRes, sUnitRes, sLogRes, batRes, batImpRes, chgRes, chgImpRes, wClaimRes] = await Promise.all([
          fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/products'),
          fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/buyers'),
          fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/scooter-units'),
          fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/stock-logs'),
          fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/battery-sales'),
          fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/battery-imports'),
          fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/charger-sales'),
          fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/charger-imports'),
          fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/warranty-claims')
        ]);

        await Promise.all([
          parseAndSet(pRes, setProducts),
          parseAndSet(bRes, setBuyers),
          parseAndSet(sUnitRes, setScooterUnits),
          parseAndSet(sLogRes, setStockLogs),
          parseAndSet(batRes, setBatterySales),
          parseAndSet(batImpRes, setBatteryImports),
          parseAndSet(chgRes, setChargerSales),
          parseAndSet(chgImpRes, setChargerImports),
          parseAndSet(wClaimRes, setWarrantyClaims)
        ]);
      } catch (err) {
        console.warn('Background refresh deferred:', err);
      }
    };
    
    refreshData();
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
    billNo?: string;
    stockInNo?: string;
    serialNumbers?: string[];
    warrantyDurationMonths?: number;
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

  const handleBulkSeedProducts = async (mode: 'replace' | 'append'): Promise<boolean> => {
    try {
      const res = await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/products/bulk-seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, operator: currentUser?.name || currentUser?.username || 'system' }),
      });
      return res.ok;
    } catch (e) {
      return false;
    }
  };

  const handleAddBuyer = async (
    name: string,
    contact?: string,
    address?: string,
    gstNo?: string,
    addressProof?: string,
    buyerType?: 'retail' | 'wholesale'
  ): Promise<boolean> => {
    try {
      const res = await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/buyers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, contact, address, gstNo, addressProof, buyerType }),
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

  const handleFinalizeChargerHold = async (id: string, extraData?: any): Promise<boolean> => {
    try {
      const res = await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/charger-sales/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...extraData, operator: currentUser?.name || 'system' }),
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

  const handleReleaseBatteryHold = async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/battery-sales/release', {
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

  const handleFinalizeBatteryHold = async (id: string, extraData?: any): Promise<boolean> => {
    try {
      const res = await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/battery-sales/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...extraData, operator: currentUser?.name || 'system' }),
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

  const handleReleaseScooterHold = async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/scooter-units/release-hold', {
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

  const handleReleaseWholesalePackage = async (payload: {
    customerName: string;
    scooterIds?: string[];
    batteryIds?: string[];
    chargerIds?: string[];
  }): Promise<boolean> => {
    try {
      const res = await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/wholesale-package/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, operator: currentUser?.name || 'system' }),
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

  const handleFinalizeScooterHold = async (payload: any): Promise<boolean> => {
    try {
      const res = await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/scooter-units/finalize-hold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, operator: currentUser?.name || 'system' }),
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

  const handleUpdateBatteryHold = async (payload: any): Promise<boolean> => {
    try {
      const res = await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/battery-sales/update-hold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, operator: currentUser?.name || 'system' }),
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

  const handleUpdateChargerHold = async (payload: any): Promise<boolean> => {
    try {
      const res = await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/charger-sales/update-hold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, operator: currentUser?.name || 'system' }),
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

  if (locationBlocked) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-2xl font-sans" id="location-blocked-overlay">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="bg-white border border-slate-200 rounded-[32px] p-8 max-w-md w-full shadow-2xl text-center space-y-6 animate-fade-in"
          id="location-blocked-card"
        >
          <div className="mx-auto h-20 w-20 bg-rose-50 rounded-full border border-rose-100 flex items-center justify-center relative">
            <span className="absolute inset-0 rounded-full bg-rose-400/20 animate-ping"></span>
            <Compass className={`h-10 w-10 text-rose-500 ${checkingLocation ? 'animate-spin' : ''}`} style={{ animationDuration: checkingLocation ? '1s' : '6s' }} />
          </div>

          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-600 border border-rose-100 font-mono">
              ⚠️ Location Off
            </span>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Device Location Required</h2>
            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              To secure the Senzo Warehouse dispatch flow and comply with physical auditing procedures, your terminal must have physical location services enabled.
            </p>
          </div>

          {locationCheckError && (
            <div className="p-3.5 bg-rose-50 border border-rose-100 rounded-2xl text-[11px] text-rose-700 font-bold text-left space-y-1 animate-pulse" id="location-error-msg">
              <p className="flex items-center gap-1.5 font-extrabold uppercase text-[10px] tracking-wide text-rose-800">🚨 Location Status Check Failed</p>
              <p className="font-medium leading-normal">{locationCheckError}</p>
            </div>
          )}

          <div className="bg-slate-50 border border-slate-150 p-4 rounded-2xl text-left text-[11px] text-slate-600 space-y-2">
            <p className="font-bold text-slate-800">Please complete the following steps:</p>
            <ol className="list-decimal pl-4 space-y-1 font-medium">
              <li>Enable location permissions for this app in your browser settings.</li>
              <li>Make sure your system/device GPS location services are turned ON.</li>
            </ol>
          </div>

          <div className="flex flex-col gap-2.5 pt-2">
            <button
              onClick={() => {
                if (checkingLocation) return;
                setCheckingLocation(true);
                setLocationCheckError(null);

                if ('geolocation' in navigator) {
                  navigator.geolocation.getCurrentPosition(
                    (pos) => {
                      setCheckingLocation(false);
                      setLocationBlocked(false);
                      setLocationCheckError(null);
                      // Report verified coordinates
                      fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/users/location', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          username: currentUser.username,
                          latitude: pos.coords.latitude,
                          longitude: pos.coords.longitude
                        })
                      }).catch(() => {});
                    },
                    (err) => {
                      setCheckingLocation(false);
                      setLocationBlocked(true);
                      if (err.code === err.PERMISSION_DENIED) {
                        setLocationCheckError('Permission Denied: Location access remains disabled. Please allow location access in your browser settings.');
                      } else if (err.code === err.POSITION_UNAVAILABLE) {
                        setLocationCheckError('Position Unavailable: GPS services are still switched off on this device.');
                      } else if (err.code === err.TIMEOUT) {
                        setLocationCheckError('Timeout: Request timed out. Ensure GPS is enabled.');
                      } else {
                        setLocationCheckError('Verification Failed: Physical location services are still turned off.');
                      }
                    },
                    { enableHighAccuracy: true, timeout: 6000 }
                  );
                } else {
                  setCheckingLocation(false);
                  setLocationBlocked(true);
                  setLocationCheckError('System Error: Geolocation is not supported.');
                }
              }}
              disabled={checkingLocation}
              className={`w-full py-3 ${checkingLocation ? 'bg-slate-400 cursor-not-allowed' : 'bg-slate-900 hover:bg-slate-800 cursor-pointer'} text-white font-black text-xs rounded-2xl shadow-md transition-all active:scale-98 flex items-center justify-center gap-2`}
            >
              <RefreshCw className={`h-4 w-4 ${checkingLocation ? 'animate-spin' : ''}`} style={{ animationDuration: checkingLocation ? '1s' : '3s' }} />
              <span>{checkingLocation ? 'Checking Device GPS...' : 'Check Location Status'}</span>
            </button>

            <button
              onClick={handleLogout}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-extrabold text-xs rounded-2xl cursor-pointer"
            >
              Exit Terminal Session
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Get localized display values of roles
  const getRoleBadge = (r: string) => {
    switch (r) {
      case 'manufacturer': return { text: '🔧 Production Specialist', color: 'bg-emerald-50 text-emerald-700 border border-emerald-200' };
      case 'salesperson': return { text: '💵 Sales Representative', color: 'bg-cyan-50 text-cyan-700 border border-cyan-200' };
      case 'manager': return { text: '🛡️ Operations Manager', color: 'bg-teal-50 text-teal-700 border border-teal-200' };
			default: return { text: '👑 Warehouse Owner / Admin', color: 'bg-amber-50 text-amber-700 border border-amber-200' };
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
                  [...products]
                    .sort((a, b) => {
                      const remA = modelKitsRemaining[a.name] || 0;
                      const remB = modelKitsRemaining[b.name] || 0;
                      return remB - remA;
                    })
                    .map((p, pidx) => {
                      const remainingForModel = modelKitsRemaining[p.name] || 0;
                      return (
                        <div key={p.id || `prod-${pidx}`} className="border border-slate-150 bg-slate-50/50 rounded-2xl p-4 flex flex-col justify-between">
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
                              {p.colors.map((col, colidx) => {
                                const remainingForColor = getImportedStockRemaining(p.name, col);
                                return (
                                  <div key={`${col}-${colidx}`} className="bg-white px-2.5 py-1.5 rounded-xl border border-slate-100 flex items-center justify-between text-xs font-sans">
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
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 font-sans flex items-center gap-2">
              📝 My Recent Build Recordings
            </h3>
            <span className="text-[10px] text-slate-400 font-sans">Click on any log below to view full specifications</span>
          </div>
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
                  {myRecentRecordings.map((unit, uidx) => (
                    <tr 
                      key={unit.id || `build-rec-${uidx}`} 
                      onClick={() => setSelectedDetailScooter(unit)}
                      className="text-slate-700 hover:bg-slate-100/70 hover:text-slate-900 cursor-pointer transition-colors"
                      title="Click to view full detail specs"
                    >
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
      </div>
    );
  };

  // --- 2. Custom Salesperson Dashboard ---
  const renderSalespersonDashboard = () => {
    const soldByMe = scooterUnits.filter(u => u.status === 'sold' && u.lastUpdatedBy === currentUser.username).length;
    const totalSold = scooterUnits.filter(u => u.status === 'sold').length;
    const availableStock = scooterUnits.filter(u => u.status === 'available').length;

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
                {products.map((p, pidx) => (
                  <div key={p.id || `sales-prod-${pidx}`} className="border border-slate-100 bg-slate-50/50 rounded-2xl p-4">
                    <span className="text-[10px] font-extrabold text-slate-400 font-mono block uppercase tracking-wide mb-2">{p.name}</span>
                    <div className="space-y-2">
                      {p.colors.map((col, colidx) => {
                        const totalAvail = scooterUnits.filter(u => u.modelName === p.name && u.color === col && u.status === 'available').length;
                        const batteryAssigned = scooterUnits.filter(u => u.modelName === p.name && u.color === col && u.status === 'available' && u.batterySerials && u.batterySerials.length > 0).length;
                        const needsBattery = totalAvail - batteryAssigned;
 
                        return (
                          <div key={`${col}-${colidx}`} className="bg-white p-2.5 rounded-xl border border-slate-100 flex items-center justify-between text-xs font-sans">
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
                  {myRecentRecordings.map((unit, uidx) => (
                    <tr key={unit.id || `sales-rec-${uidx}`} className="text-slate-700 hover:bg-slate-50/50">
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
              <span>🛠️ Assemble Option</span>
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
              <span>📊 History of Logs</span>
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
                  onSelectDetailScooter={setSelectedDetailScooter}
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
                  onSelectDetailScooter={setSelectedDetailScooter}
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
              onClick={() => setActiveTab('search')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold tracking-wide transition-all cursor-pointer ${
                activeTab === 'search'
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              id="nav-search-btn"
            >
              <Search className="h-4 w-4 text-pink-500" />
              <span>🔍 Search</span>
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
              <span>🛠️ Assemble & Sell</span>
            </button>
            {(currentUser.role === 'admin' || currentUser.role === 'manager') && (
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
                <span>📦 Purchase</span>
              </button>
            )}
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
              onClick={() => setActiveTab('claims')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold tracking-wide transition-all cursor-pointer ${
                activeTab === 'claims'
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              id="nav-claims-btn"
            >
              <ShieldCheck className="h-4 w-4 text-cyan-600" />
              <span>🛡️ Claims</span>
            </button>
            <button
              onClick={() => setActiveTab('challans')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold tracking-wide transition-all cursor-pointer ${
                activeTab === 'challans'
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              id="nav-challans-btn"
            >
              <Truck className="h-4 w-4 text-cyan-400" />
              <span>🚚 Challans</span>
            </button>
            {currentUser.role === 'admin' && (
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
            )}
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
      <div className="md:hidden bg-white border-b border-slate-200 flex items-center justify-around py-2.5 px-3 relative z-40">
        <button
          onClick={() => { setActiveTab('dashboard'); setShowMobileMoreMenu(false); }}
          className={`flex flex-col items-center gap-1 p-1 cursor-pointer transition-all active:scale-95 ${activeTab === 'dashboard' ? 'text-slate-900 font-bold scale-105' : 'text-slate-400'}`}
        >
          <LayoutDashboard className="h-4.5 w-4.5 text-cyan-600" />
          <span className="text-[10px] font-sans font-bold">Dashboard</span>
        </button>
        <button
          onClick={() => { setActiveTab('search'); setShowMobileMoreMenu(false); }}
          className={`flex flex-col items-center gap-1 p-1 cursor-pointer transition-all active:scale-95 ${activeTab === 'search' ? 'text-slate-900 font-bold scale-105' : 'text-slate-400'}`}
        >
          <Search className="h-4.5 w-4.5 text-pink-500" />
          <span className="text-[10px] font-sans font-bold">Search</span>
        </button>
        <button
          onClick={() => { setActiveTab('assembly'); setShowMobileMoreMenu(false); }}
          className={`flex flex-col items-center gap-1 p-1 cursor-pointer transition-all active:scale-95 ${activeTab === 'assembly' ? 'text-slate-900 font-bold scale-105' : 'text-slate-400'}`}
        >
          <Shuffle className="h-4.5 w-4.5 text-emerald-600" />
          <span className="text-[10px] font-sans font-bold">Assemble</span>
        </button>
        {(currentUser.role === 'admin' || currentUser.role === 'manager') && (
          <button
            onClick={() => { setActiveTab('stock'); setShowMobileMoreMenu(false); }}
            className={`flex flex-col items-center gap-1 p-1 cursor-pointer transition-all active:scale-95 ${activeTab === 'stock' ? 'text-slate-900 font-bold scale-105' : 'text-slate-400'}`}
          >
            <ClipboardList className="h-4.5 w-4.5 text-blue-600" />
            <span className="text-[10px] font-sans font-bold">Purchase</span>
          </button>
        )}
        <button
          onClick={() => setShowMobileMoreMenu(!showMobileMoreMenu)}
          className={`flex flex-col items-center gap-1 p-1 cursor-pointer transition-all active:scale-95 ${showMobileMoreMenu ? 'text-slate-900 font-bold' : 'text-slate-400'}`}
        >
          <MoreHorizontal className={`h-4.5 w-4.5 text-indigo-500 transition-transform ${showMobileMoreMenu ? 'rotate-90' : ''}`} />
          <span className="text-[10px] font-sans font-bold">More</span>
        </button>
      </div>

      {/* Elegant Mobile More Menu Overlay Drawer */}
      <AnimatePresence>
        {showMobileMoreMenu && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMobileMoreMenu(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 md:hidden"
            />
            {/* Slide-up bottom card */}
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[32px] shadow-2xl z-50 border-t border-slate-100 p-6 md:hidden pb-10"
            >
              <div className="flex items-center justify-between mb-5 border-b border-slate-100 pb-3">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-black text-slate-900">More Operations</h3>
                  <p className="text-[11px] text-slate-500">Secondary management workflows</p>
                </div>
                <button
                  onClick={() => setShowMobileMoreMenu(false)}
                  className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 text-slate-500 active:scale-90 transition-all cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <button
                  onClick={() => { setActiveTab('catalog'); setShowMobileMoreMenu(false); }}
                  className={`flex flex-col items-start gap-2 p-4 rounded-2xl border text-left cursor-pointer transition-all active:scale-[0.97] ${
                    activeTab === 'catalog' ? 'bg-amber-50/50 border-amber-300 text-amber-950' : 'bg-slate-50/50 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <BookOpen className="h-5 w-5 text-amber-600" />
                  <div>
                    <p className="text-xs font-bold">🎨 Models</p>
                    <p className="text-[9px] text-slate-500 mt-0.5">Scooters & buyers catalog</p>
                  </div>
                </button>

                <button
                  onClick={() => { setActiveTab('battery'); setShowMobileMoreMenu(false); }}
                  className={`flex flex-col items-start gap-2 p-4 rounded-2xl border text-left cursor-pointer transition-all active:scale-[0.97] ${
                    activeTab === 'battery' ? 'bg-emerald-50/50 border-emerald-300 text-emerald-950' : 'bg-slate-50/50 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Battery className="h-5 w-5 text-emerald-600" />
                  <div>
                    <p className="text-xs font-bold">🔋 Batteries</p>
                    <p className="text-[9px] text-slate-500 mt-0.5">Battery wholesale & logs</p>
                  </div>
                </button>

                <button
                  onClick={() => { setActiveTab('claims'); setShowMobileMoreMenu(false); }}
                  className={`flex flex-col items-start gap-2 p-4 rounded-2xl border text-left cursor-pointer transition-all active:scale-[0.97] ${
                    activeTab === 'claims' ? 'bg-cyan-50/50 border-cyan-300 text-cyan-950' : 'bg-slate-50/50 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <ShieldCheck className="h-5 w-5 text-cyan-600" />
                  <div>
                    <p className="text-xs font-bold">🛡️ Claims</p>
                    <p className="text-[9px] text-slate-500 mt-0.5">Modular warranty claims</p>
                  </div>
                </button>

                <button
                  onClick={() => { setActiveTab('challans'); setShowMobileMoreMenu(false); }}
                  className={`flex flex-col items-start gap-2 p-4 rounded-2xl border text-left cursor-pointer transition-all active:scale-[0.97] ${
                    activeTab === 'challans' ? 'bg-cyan-50/50 border-cyan-300 text-cyan-950' : 'bg-slate-50/50 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Truck className="h-5 w-5 text-cyan-400" />
                  <div>
                    <p className="text-xs font-bold">🚚 Challans</p>
                    <p className="text-[9px] text-slate-500 mt-0.5">Delivery Challans & Dispatch</p>
                  </div>
                </button>

                {currentUser.role === 'admin' && (
                  <button
                    onClick={() => { setActiveTab('settings'); setShowMobileMoreMenu(false); }}
                    className={`flex flex-col items-start gap-2 p-4 rounded-2xl border text-left cursor-pointer transition-all active:scale-[0.97] ${
                      activeTab === 'settings' ? 'bg-purple-50/50 border-purple-300 text-purple-950' : 'bg-slate-50/50 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <Settings className="h-5 w-5 text-purple-600" />
                    <div>
                      <p className="text-xs font-bold">⚙️ Settings</p>
                      <p className="text-[9px] text-slate-500 mt-0.5">System configurations</p>
                    </div>
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

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
                chargerSales={chargerSales}
                chargerImports={chargerImports}
                onNavigateToAssembly={() => setActiveTab('assembly')}
                onNavigateToBatteries={() => setActiveTab('battery')}
                onNavigateToStock={() => setActiveTab('stock')}
                onNavigateToSearch={() => setActiveTab('search')}
                onNavigateToChargers={() => setActiveTab('charger')}
                onSubmitAssembly={handleSubmitScooterUnit}
                onReleaseBatteryHold={handleReleaseBatteryHold}
                onFinalizeBatteryHold={handleFinalizeBatteryHold}
                onReleaseChargerHold={handleReleaseChargerHold}
                onFinalizeChargerHold={handleFinalizeChargerHold}
                onReleaseScooterHold={handleReleaseScooterHold}
                onReleaseWholesalePackage={handleReleaseWholesalePackage}
                onFinalizeScooterHold={handleFinalizeScooterHold}
                onUpdateBatteryHold={handleUpdateBatteryHold}
                onUpdateChargerHold={handleUpdateChargerHold}
                buyers={buyers}
                onRefresh={fetchAllData}
                currentUser={currentUser}
              />
            )}

            {activeTab === 'search' && (
              <SearchConsole
                products={products}
                buyers={buyers}
                scooterUnits={scooterUnits}
                stockLogs={stockLogs}
                batteryImports={batteryImports}
                chargerImports={chargerImports}
                batterySales={batterySales}
                chargerSales={chargerSales}
                currentUser={currentUser}
                onRefresh={fetchAllData}
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
                onSelectDetailScooter={setSelectedDetailScooter}
                onShowMobileNotification={setMobileNotification}
              />
            )}

            {activeTab === 'stock' && (
              (currentUser.role === 'admin' || currentUser.role === 'manager') ? (
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
                  scooterUnits={scooterUnits}
                  onSubmitAssembly={handleSubmitScooterUnit}
                />
              ) : (
                <div className="bg-red-50 text-red-800 p-6 rounded-2xl border border-red-200 font-sans" id="stock-unauthorized">
                  <h3 className="text-lg font-bold mb-2">Access Denied</h3>
                  <p className="text-sm">Only administrator accounts are permitted to access the Purchase module.</p>
                </div>
              )
            )}

            {activeTab === 'catalog' && (
              <CatalogManager 
                products={products} 
                buyers={buyers} 
                onRefresh={fetchAllData}
                onAddProduct={handleAddProduct}
                onBulkSeedProducts={handleBulkSeedProducts}
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
                chargerSales={chargerSales}
                currentUser={currentUser}
                onRefresh={fetchAllData}
                onSubmitBatterySale={handleDirectBatterySale}
                batterySeriesList={batteryTypes}
                hideForm={true}
              />
            )}

            {activeTab === 'charger' && (
              <ChargerSalesManager 
                buyers={buyers}
                chargerSales={chargerSales}
                chargerImports={chargerImports}
                chargerTypesList={chargerTypes}
                scooterUnits={scooterUnits}
                batterySales={batterySales}
                currentUser={currentUser}
                onRefresh={fetchAllData}
                onSubmitChargerSale={handleDirectChargerSale}
                onSubmitChargerImport={handleDirectChargerImport}
                onReleaseHold={handleReleaseChargerHold}
                onFinalizeHold={handleFinalizeChargerHold}
              />
            )}

            {activeTab === 'claims' && (
              <WarrantyClaimsManager
                scooterUnits={scooterUnits}
                batterySales={batterySales}
                chargerSales={chargerSales}
                batteryImports={batteryImports}
                chargerImports={chargerImports}
                buyers={buyers}
                warrantyClaims={warrantyClaims}
                currentUser={currentUser}
                onRefresh={fetchAllData}
              />
            )}

            {activeTab === 'challans' && (
              <ChallanManager
                scooterUnits={scooterUnits}
                batterySales={batterySales}
                chargerSales={chargerSales}
                buyers={buyers}
                currentUser={currentUser}
                onRefresh={fetchAllData}
              />
            )}

            {activeTab === 'settings' && currentUser.role === 'admin' && (
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

      {/* Mobile Active Section Notification Alert popup */}
      <AnimatePresence>
        {mobileNotification && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 text-white text-xs font-black tracking-wide font-sans py-3.5 px-6 rounded-full shadow-2xl border border-slate-800 backdrop-blur-md flex items-center gap-2.5 whitespace-nowrap"
            id="mobile-section-notification"
          >
            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping"></span>
            <span>{mobileNotification}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
