import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, UserPlus, Shield, ClipboardList, RefreshCw, Key, Trash2, Edit2, 
  Check, AlertCircle, Cloud, Activity, Search, Sparkles, User, Briefcase,
  Lock, Unlock, Printer, FileSpreadsheet, Calendar, ArrowDown, Filter, Clock,
  Plus, X, Eye, EyeOff, MapPin, Compass, Navigation, Map
} from 'lucide-react';
import { SheetConfig, ScooterUnit, StockLog, BatterySale, BatteryImport, User as SessionUser } from '../types';
import { formatUserMessage } from '../utils/errorHelper';
import SheetSyncPanel from './SheetSyncPanel';
import EmployeeMap from './EmployeeMap';
import StaffUnifiedMap from './StaffUnifiedMap';
import LocationTrailsMap from './LocationTrailsMap';

interface SettingsPanelProps {
  sheetConfig: SheetConfig;
  onSaveConfig: (url: string, enabled: boolean) => Promise<boolean>;
  onTriggerSyncAll: () => Promise<{ success: boolean; message?: string; error?: string }>;
  onTriggerPullAll?: () => Promise<{ success: boolean; message?: string; error?: string }>;
  scooterUnits: ScooterUnit[];
  batterySales: BatterySale[];
  batteryImports: BatteryImport[];
  stockLogs: StockLog[];
  currentUser: SessionUser;
}

interface DBUser {
  id: string;
  username: string;
  role: 'admin' | 'manufacturer' | 'salesperson' | 'manager';
  name: string;
  locked?: boolean;
  failedAttempts?: number;
  approved?: boolean;
  passwordText?: string;
  latitude?: number;
  longitude?: number;
  locationTimestamp?: string;
}

interface SystemAuditLog {
  id: string;
  timestamp: string;
  operator: string;
  operatorRole: string;
  action: string;
  details: string;
}

export default function SettingsPanel({
  sheetConfig,
  onSaveConfig,
  onTriggerSyncAll,
  onTriggerPullAll,
  scooterUnits,
  batterySales,
  batteryImports,
  stockLogs,
  currentUser
}: SettingsPanelProps) {
  const [subTab, setSubTab] = useState<'employees' | 'sheets' | 'audit' | 'tracking' | 'trails'>('employees');
  
  // Employees list state
  const [employees, setEmployees] = useState<DBUser[]>([]);
  const uniqueEmployees = useMemo(() => {
    const seen = new Set();
    return employees.filter(e => {
      if (!e.id) return false;
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });
  }, [employees]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected employee for detailed intelligence
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  // Live employee location tracking states
  const [showLocationMap, setShowLocationMap] = useState<boolean>(true);
  const [isPullingLocation, setIsPullingLocation] = useState<boolean>(false);

  const handlePullLocation = async (username: string) => {
    setIsPullingLocation(true);
    setSuccessMsg(`Sending satellite ping to @${username}'s device...`);
    try {
      const res = await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/users/pull-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });

      if (res.ok) {
        setSuccessMsg(`Pinging device @${username} live. Waiting for high-accuracy GPS coordinates...`);
        // Poll the server every 1.5s for 9 seconds to catch the updated coordinates
        let attempts = 0;
        const maxAttempts = 6;
        const intervalId = setInterval(async () => {
          attempts++;
          await fetchEmployees();
          if (attempts >= maxAttempts) {
            clearInterval(intervalId);
            setIsPullingLocation(false);
            setSuccessMsg(`Device ping sequence complete. Showing most up-to-date coordinate of @${username}.`);
            setTimeout(() => setSuccessMsg(''), 5000);
          }
        }, 1500);
      } else {
        setErrorMsg(`Failed to establish connection to @${username}'s GPS transmitter.`);
        setIsPullingLocation(false);
        setTimeout(() => setErrorMsg(''), 4000);
      }
    } catch (err) {
      setErrorMsg('Error requesting live GPS coordinate pull.');
      setIsPullingLocation(false);
      setTimeout(() => setErrorMsg(''), 4000);
    }
  };

  // Helper: Haversine distance calculator
  const getDistanceKM = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Form states (Add & Edit)
  const [formMode, setFormMode] = useState<'idle' | 'add' | 'edit'>('idle');
  const [formId, setFormId] = useState('');
  const [formName, setFormName] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<'admin' | 'manufacturer' | 'salesperson' | 'manager'>('manufacturer');
  const [submittingForm, setSubmittingForm] = useState(false);

  // Delete User Confirmation Modal States
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<{ id: string; name: string } | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);

  // Password Visibility States
  const [showPasswordsInList, setShowPasswordsInList] = useState(false);
  const [showFormPassword, setShowFormPassword] = useState(false);

  // System Audit Trail States
  const [auditLogs, setAuditLogs] = useState<SystemAuditLog[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditUserFilter, setAuditUserFilter] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('');
  const [auditStartDate, setAuditStartDate] = useState('');
  const [auditEndDate, setAuditEndDate] = useState('');

  // Load employees from server
  const fetchEmployees = async (silent = false) => {
    if (!silent) setLoadingEmployees(true);
    try {
      const res = await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/users');
      if (res.ok) {
        const data = await res.json();
        setEmployees(data);
        // Default select current logged in user or first admin if none selected
        if (data.length > 0 && !selectedEmployeeId) {
          const currentInList = data.find((u: DBUser) => u.id === currentUser.id);
          setSelectedEmployeeId(currentInList ? currentInList.id : data[0].id);
        }
      } else {
        if (!silent) setErrorMsg('Failed to load employee directory.');
      }
    } catch (err) {
      if (!silent) setErrorMsg('Error contacting server for employees.');
    } finally {
      if (!silent) setLoadingEmployees(false);
    }
  };

  // Load complete audit trail from server
  const fetchAuditLogs = async () => {
    setLoadingAudit(true);
    try {
      const res = await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/audit-logs');
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data);
      } else {
        setErrorMsg('Failed to fetch system audit statements.');
      }
    } catch (err) {
      setErrorMsg('Error contacting server for system logs.');
    } finally {
      setLoadingAudit(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  // Poll employee location updates seamlessly in real-time every 10 seconds while tracking/trails maps are open
  useEffect(() => {
    if (subTab === 'tracking' || subTab === 'trails') {
      const intervalId = setInterval(() => {
        fetchEmployees(true);
      }, 10000);
      return () => clearInterval(intervalId);
    }
  }, [subTab, selectedEmployeeId]);

  useEffect(() => {
    if (subTab === 'audit') {
      fetchAuditLogs();
    }
  }, [subTab]);

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

  // Unlock Locked Account
  const handleUnlockUser = async (username: string) => {
    try {
      const res = await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/users/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          operator: currentUser.name
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        triggerAlert('success', `Successfully unlocked employee account @${username}!`);
        await fetchEmployees();
        if (subTab === 'audit') {
          await fetchAuditLogs();
        }
      } else {
        triggerAlert('error', data.error || 'Failed to unlock employee.');
      }
    } catch (err) {
      triggerAlert('error', 'Network error during account unlocking.');
    }
  };

  // Approve Pending User Registration
  const handleApproveUser = async (id: string, name: string) => {
    try {
      const res = await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/users/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          operator: currentUser.name
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        triggerAlert('success', `Granted access for ${name}! 🎉`);
        await fetchEmployees();
      } else {
        triggerAlert('error', data.error || 'Failed to approve user.');
      }
    } catch (err) {
      triggerAlert('error', 'Network error during approval.');
    }
  };

  // Reject / Deny Pending User Registration
  const handleRejectUser = async (id: string, name: string) => {
    try {
      const res = await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/users/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          operator: currentUser.name
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        triggerAlert('success', `Rejected and deleted registration request for ${name}.`);
        await fetchEmployees();
      } else {
        triggerAlert('error', data.error || 'Failed to reject user.');
      }
    } catch (err) {
      triggerAlert('error', 'Network error during rejection.');
    }
  };

  // Submit new employee (Add)
  const handleAddEmployeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formUsername.trim() || !formPassword.trim()) {
      triggerAlert('error', 'Please fill in all fields to create an employee.');
      return;
    }

    setSubmittingForm(true);
    try {
      const res = await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          username: formUsername.trim().toLowerCase(),
          password: formPassword,
          role: formRole,
          approved: true
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        triggerAlert('success', `Employee ${formName} (${formRole}) added successfully!`);
        resetForm();
        await fetchEmployees();
      } else {
        triggerAlert('error', data.error || 'Failed to register employee.');
      }
    } catch (err) {
      triggerAlert('error', 'Network error registering employee.');
    } finally {
      setSubmittingForm(false);
    }
  };

  // Submit employee update (Edit)
  const handleEditEmployeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formUsername.trim()) {
      triggerAlert('error', 'Name and username are required.');
      return;
    }

    setSubmittingForm(true);
    try {
      const res = await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/users/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: formId,
          name: formName.trim(),
          username: formUsername.trim().toLowerCase(),
          password: formPassword.trim() !== '' ? formPassword : undefined,
          role: formRole
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        triggerAlert('success', `Employee profile updated successfully!`);
        resetForm();
        await fetchEmployees();
      } else {
        triggerAlert('error', data.error || 'Failed to update employee.');
      }
    } catch (err) {
      triggerAlert('error', 'Network error updating employee profile.');
    } finally {
      setSubmittingForm(false);
    }
  };

  // Delete employee
  const handleDeleteEmployee = (id: string, name: string) => {
    if (id === currentUser.id) {
      triggerAlert('error', 'You cannot delete your own active session account.');
      return;
    }
    setDeleteConfirmUser({ id, name });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmUser) return;
    const { id, name } = deleteConfirmUser;

    setDeletingUser(true);
    try {
      const res = await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/users/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        triggerAlert('success', `Successfully deleted employee account for "${name}".`);
        if (selectedEmployeeId === id) {
          setSelectedEmployeeId(currentUser.id);
        }
        await fetchEmployees();
      } else {
        triggerAlert('error', data.error || 'Failed to delete employee account.');
      }
    } catch (err) {
      triggerAlert('error', 'Network error during deletion.');
    } finally {
      setDeletingUser(false);
      setDeleteConfirmUser(null);
    }
  };

  const handleStartEdit = (emp: DBUser) => {
    setFormMode('edit');
    setFormId(emp.id);
    setFormName(emp.name);
    setFormUsername(emp.username);
    setFormPassword(''); // leave blank for no change
    setFormRole(emp.role);
    window.scrollTo({ top: 120, behavior: 'smooth' });
  };

  const resetForm = () => {
    setFormMode('idle');
    setFormId('');
    setFormName('');
    setFormUsername('');
    setFormPassword('');
    setFormRole('manufacturer');
  };

  // Filter employees based on search query
  const filteredEmployees = useMemo(() => {
    if (!searchQuery.trim()) return uniqueEmployees;
    const q = searchQuery.toLowerCase();
    return uniqueEmployees.filter(
      emp => emp.name.toLowerCase().includes(q) || 
             emp.username.toLowerCase().includes(q) || 
             emp.role.toLowerCase().includes(q)
    );
  }, [uniqueEmployees, searchQuery]);

  const pendingEmployees = useMemo(() => {
    return filteredEmployees.filter(emp => emp.approved === false);
  }, [filteredEmployees]);

  const activeEmployees = useMemo(() => {
    return filteredEmployees.filter(emp => emp.approved !== false);
  }, [filteredEmployees]);

  // Find currently selected employee object
  const selectedEmployee = useMemo(() => {
    return uniqueEmployees.find(emp => emp.id === selectedEmployeeId) || null;
  }, [uniqueEmployees, selectedEmployeeId]);

  // Strictly prune employee location history to the last 24 hours only
  const last24hHistory = useMemo(() => {
    if (!selectedEmployee || !selectedEmployee.locationHistory) return [];
    const limitTime = Date.now() - 24 * 60 * 60 * 1000;
    return selectedEmployee.locationHistory.filter(
      entry => new Date(entry.timestamp).getTime() >= limitTime
    );
  }, [selectedEmployee]);

  // Trace Employee Contributions / What they have done
  const employeeStats = useMemo(() => {
    if (!selectedEmployee) return null;
    const nameLower = selectedEmployee.name.toLowerCase().trim();
    const usernameLower = selectedEmployee.username.toLowerCase().trim();

    // Helper to check match
    const isMatch = (opName: string | undefined | null) => {
      if (!opName) return false;
      const cleanOp = opName.toLowerCase().trim();
      return cleanOp === nameLower || cleanOp === usernameLower || cleanOp.includes(nameLower) || nameLower.includes(cleanOp);
    };

    // 1. Scooter Assemblies
    const assembledUnits = scooterUnits.filter(u => isMatch(u.createdOperator));
    
    // 2. Customizations/Stage 2 Operations (and updates)
    const customizedUnits = scooterUnits.filter(u => isMatch(u.lastUpdatedBy) && u.createdOperator !== u.lastUpdatedBy);

    // 3. Scooter Sales POS Dispatch (Stage 3 & 4)
    const salesPOSUnits = scooterUnits.filter(u => u.status === 'sold' && isMatch(u.lastUpdatedBy));

    // 4. Standalone Battery Sales
    const standaloneBatterySales = batterySales.filter(s => isMatch(s.operator));

    // 5. Raw Battery Imports
    const rawBatteryImports = batteryImports.filter(i => isMatch(i.operator));

    // 6. Stock Movements (Logs)
    const loggedStockLogs = stockLogs.filter(l => isMatch(l.operator));

    // Build Activity feed chronological order
    const feed: { id: string; type: string; title: string; timestamp: string; details: string; color: string }[] = [];

    assembledUnits.forEach(u => {
      feed.push({
        id: `feed-assemble-${u.id}`,
        type: 'assembly',
        title: 'Assembled Scooter Frame',
        timestamp: u.createdTimestamp,
        details: `Model: ${u.modelName} (${u.color}) — Chassis: ${u.chassisNo}`,
        color: 'border-l-emerald-500 text-emerald-800 bg-emerald-50/40'
      });
    });

    customizedUnits.forEach(u => {
      feed.push({
        id: `feed-custom-${u.id}-${u.lastUpdatedTimestamp}`,
        type: 'customization',
        title: 'Updated / Customized Unit',
        timestamp: u.lastUpdatedTimestamp,
        details: `Model: ${u.modelName} — Tires: ${u.tireSize} — Notes: ${u.customizationNotes || 'None'}`,
        color: 'border-l-cyan-500 text-cyan-800 bg-cyan-50/40'
      });
    });

    salesPOSUnits.forEach(u => {
      feed.push({
        id: `feed-sale-${u.id}-${u.saleDate}`,
        type: 'sale',
        title: 'Dispatched POS Scooter Sale',
        timestamp: u.saleDate || u.lastUpdatedTimestamp,
        details: `Sold to: ${u.buyerName} — Batteries: ${u.batterySerials.join(', ') || 'None'}`,
        color: 'border-l-indigo-500 text-indigo-800 bg-indigo-50/40'
      });
    });

    standaloneBatterySales.forEach(s => {
      feed.push({
        id: `feed-batsale-${s.id}`,
        type: 'battery_sale',
        title: 'Logged Standalone Battery Sales',
        timestamp: s.saleDate,
        details: `Sent ${s.quantity} ${s.batterySeries} packs (${s.startNo}➔${s.endNo}) to ${s.buyerName}`,
        color: 'border-l-amber-500 text-amber-800 bg-amber-50/40'
      });
    });

    rawBatteryImports.forEach(i => {
      feed.push({
        id: `feed-import-${i.id}`,
        type: 'battery_import',
        title: 'Imported Overseas Battery Shipment',
        timestamp: i.importDate,
        details: `Logged ${i.quantity} ${i.batterySeries} packs (${i.startNo}➔${i.endNo}) from ${i.supplierName || 'Foreign Supplier'}`,
        color: 'border-l-teal-500 text-teal-800 bg-teal-50/40'
      });
    });

    loggedStockLogs.forEach(l => {
      feed.push({
        id: `feed-stock-${l.id}`,
        type: 'stock_log',
        title: `Logged Stock Movement (${l.type.toUpperCase()})`,
        timestamp: l.timestamp,
        details: `${l.quantity} units of ${l.modelName} (${l.color}) — Channel: ${l.sourceChannel} — ${l.notes || ''}`,
        color: 'border-l-slate-500 text-slate-800 bg-slate-50/40'
      });
    });

    // Sort feed latest first
    feed.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return {
      assembledCount: assembledUnits.length,
      customizedCount: customizedUnits.length,
      salesCount: salesPOSUnits.length,
      batterySalesCount: standaloneBatterySales.reduce((acc, s) => acc + s.quantity, 0),
      batterySalesBatches: standaloneBatterySales.length,
      batteryImportCount: rawBatteryImports.reduce((acc, i) => acc + i.quantity, 0),
      batteryImportBatches: rawBatteryImports.length,
      stockMovementCount: loggedStockLogs.length,
      totalLoggedActions: assembledUnits.length + customizedUnits.length + salesPOSUnits.length + standaloneBatterySales.length + rawBatteryImports.length + loggedStockLogs.length,
      feed: feed.slice(0, 30) // Show latest 30 actions
    };
  }, [selectedEmployee, scooterUnits, batterySales, batteryImports, stockLogs]);

  // SYSTEM AUDIT LEDGER FILTERS AND SEARCH
  const filteredAuditLogs = useMemo(() => {
    let result = [...auditLogs];

    // 1. Text Search
    if (auditSearch.trim()) {
      const q = auditSearch.toLowerCase();
      result = result.filter(log => 
        (log.details || '').toLowerCase().includes(q) ||
        (log.operator || '').toLowerCase().includes(q) ||
        (log.action || '').toLowerCase().includes(q) ||
        (log.username || '').toLowerCase().includes(q)
      );
    }

    // 2. Employee Operator Filter
    if (auditUserFilter) {
      const uf = auditUserFilter.toLowerCase().trim();
      result = result.filter(log => 
        (log.operator || '').toLowerCase().trim() === uf ||
        (log.username || '').toLowerCase().trim() === uf ||
        (log.operatorName || '').toLowerCase().trim() === uf
      );
    }

    // 3. Action Category Filter
    if (auditActionFilter) {
      result = result.filter(log => {
        const action = (log.action || '').toLowerCase();
        if (auditActionFilter === 'auth') {
          return action.includes('login') || action.includes('logout') || action.includes('user_unlocked');
        }
        if (auditActionFilter === 'scooter') {
          return action.includes('assemble') || action.includes('scooter') || action.includes('customize');
        }
        if (auditActionFilter === 'pos') {
          return action.includes('pos') || action.includes('sale') || action.includes('wholesale') || action.includes('hold');
        }
        if (auditActionFilter === 'battery') {
          return action.includes('battery') || action.includes('charger');
        }
        if (auditActionFilter === 'admin') {
          return action.includes('user') || action.includes('admin') || action.includes('cleared') || action.includes('sheet') || action.includes('config');
        }
        if (auditActionFilter === 'challan') {
          return action.includes('challan') || action.includes('dispatch') || action.includes('finish');
        }
        return true;
      });
    }

    // 4. Date Range filters
    if (auditStartDate) {
      const startMs = new Date(auditStartDate).getTime();
      result = result.filter(log => new Date(log.timestamp).getTime() >= startMs);
    }
    if (auditEndDate) {
      // Add one day to end date to make it inclusive
      const endMs = new Date(auditEndDate).getTime() + (24 * 60 * 60 * 1000);
      result = result.filter(log => new Date(log.timestamp).getTime() <= endMs);
    }

    // Return sorted newest first
    return result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [auditLogs, auditSearch, auditUserFilter, auditActionFilter, auditStartDate, auditEndDate]);

  // Clear system audit logs
  const handleClearAuditLogs = async () => {
    if (!window.confirm('Are you sure you want to clear all system audit log history? This action cannot be undone.')) {
      return;
    }
    try {
      const res = await fetch('/api/audit-logs/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operator: currentUser.username || 'admin' })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        triggerAlert('success', 'System audit log history cleared successfully.');
        fetchAuditLogs();
      } else {
        triggerAlert('error', data.error || 'Failed to clear audit logs.');
      }
    } catch (err) {
      triggerAlert('error', 'Network error clearing audit logs.');
    }
  };

  // Aggregate Audit trail statistics
  const auditStats = useMemo(() => {
    const total = auditLogs.length;
    const logins = auditLogs.filter(l => l.action === 'login_success').length;
    const lockouts = auditLogs.filter(l => l.action === 'login_locked').length;
    const failedLogins = auditLogs.filter(l => l.action === 'login_failed').length;
    const actionsCount = auditLogs.filter(l => !l.action.startsWith('login_')).length;

    return { total, logins, lockouts, failedLogins, actionsCount };
  }, [auditLogs]);

  // Export filtered logs as CSV
  const handleExportCSV = () => {
    if (filteredAuditLogs.length === 0) {
      triggerAlert('error', 'No records found to export.');
      return;
    }
    const headers = ['Timestamp/Time', 'Operator', 'Role/Type', 'Action Category', 'System Narrative'];
    const csvRows = [
      headers.join(','),
      ...filteredAuditLogs.map(log => {
        const timeStr = new Date(log.timestamp).toISOString();
        const op = `"${(log.operator || 'system').replace(/"/g, '""')}"`;
        const role = `"${(log.operatorRole || 'N/A').replace(/"/g, '""')}"`;
        const act = `"${(log.action || '').replace(/"/g, '""')}"`;
        const details = `"${(log.details || '').replace(/"/g, '""')}"`;
        return [timeStr, op, role, act, details].join(',');
      })
    ];
    
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `system_audit_statement_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerAlert('success', 'Audit statement exported to CSV spreadsheet.');
  };

  // Printable Bank Statement handler
  const handlePrintStatement = () => {
    window.print();
  };

  return (
    <div className="space-y-6" id="settings-component">
      
      {/* CSS injection for clean print formatting of bank statements */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-audit-statement, #printable-audit-statement * {
            visibility: visible !important;
          }
          #printable-audit-statement {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            display: block !important;
            background: white !important;
            color: black !important;
            font-size: 11px !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Alert Notices */}
      <AnimatePresence>
        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-emerald-500 text-white rounded-2xl flex items-center gap-2.5 shadow-md text-xs font-sans font-bold no-print"
          >
            <Check className="h-4.5 w-4.5" />
            <span>{successMsg}</span>
          </motion.div>
        )}
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-rose-500 text-white rounded-2xl flex items-center gap-2.5 shadow-md text-xs font-sans font-bold no-print"
          >
            <AlertCircle className="h-4.5 w-4.5" />
            <span>{errorMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Level Sub-Tab Control */}
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200 w-full overflow-x-auto whitespace-nowrap hide-scrollbar mb-4 no-print animate-fade-in" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }} id="settings-subtabs">
        <button
          type="button"
          onClick={() => setSubTab('employees')}
          className={`flex-shrink-0 px-4 py-2 text-xs font-bold rounded-xl font-sans uppercase transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            subTab === 'employees' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="h-4 w-4" />
          <span>👥 Employees</span>
        </button>
        <button
          type="button"
          onClick={() => setSubTab('audit')}
          className={`flex-shrink-0 px-4 py-2 text-xs font-bold rounded-xl font-sans uppercase transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            subTab === 'audit' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <ClipboardList className="h-4 w-4" />
          <span>📋 Audit</span>
        </button>
        <button
          type="button"
          onClick={() => setSubTab('tracking')}
          className={`flex-shrink-0 px-4 py-2 text-xs font-bold rounded-xl font-sans uppercase transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            subTab === 'tracking' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Compass className="h-4.5 w-4.5" />
          <span>🛰️ Telemetry</span>
        </button>
        <button
          type="button"
          onClick={() => setSubTab('trails')}
          className={`flex-shrink-0 px-4 py-2 text-xs font-bold rounded-xl font-sans uppercase transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            subTab === 'trails' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <MapPin className="h-4 w-4" />
          <span>📍 Trails</span>
        </button>
        <button
          type="button"
          onClick={() => setSubTab('sheets')}
          className={`flex-shrink-0 px-4 py-2 text-xs font-bold rounded-xl font-sans uppercase transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            subTab === 'sheets' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Cloud className="h-4 w-4" />
          <span>☁️ Sheets</span>
        </button>
      </div>

      {subTab === 'employees' ? (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 no-print">
          {/* Staff Directory Panel */}
          <div className="xl:col-span-2 bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between min-h-[500px]" id="employees-directory-section">
            <div className="space-y-4">
              <div className="flex justify-between items-center gap-4 flex-wrap">
                <div>
                  <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                    👥 Staff Directory & Approvals
                  </h2>
                  <p className="text-xs text-slate-500">Manage employee accounts, approve registrations, and unlock locked accounts.</p>
                </div>
                
                {/* Search Bar */}
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by name, @username..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>

              {/* Directory List */}
              <div className="space-y-4 max-h-[450px] overflow-y-auto pr-1">
                {loadingEmployees ? (
                  <div className="flex flex-col items-center py-8 text-xs text-slate-400 italic">
                    <RefreshCw className="h-5 w-5 animate-spin text-slate-400 mb-2" />
                    Fetching employee records...
                  </div>
                ) : filteredEmployees.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400 italic bg-slate-50/50 rounded-2xl border border-dashed border-slate-250">
                    No employees match your search query.
                  </div>
                ) : (
                  <>
                    {/* SECTION 1: Pending Owner Approvals */}
                    {pendingEmployees.length > 0 && (
                      <div className="space-y-2 border-b border-dashed border-amber-200 pb-4">
                        <div className="flex items-center gap-1.5 text-amber-700 font-extrabold text-[10px] uppercase tracking-wider mb-2">
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                          ⏳ Pending Access Requests ({pendingEmployees.length})
                        </div>
                        {pendingEmployees.map((emp) => {
                          const isSelected = emp.id === selectedEmployeeId;
                          let roleBadgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-100';
                          if (emp.role === 'admin') roleBadgeColor = 'bg-amber-50 text-amber-700 border-amber-100';
                          if (emp.role === 'salesperson') roleBadgeColor = 'bg-indigo-50 text-indigo-700 border-indigo-100';
                          if (emp.role === 'manager') roleBadgeColor = 'bg-teal-50 text-teal-700 border-teal-100';

                          return (
                            <div 
                              key={emp.id}
                              onClick={() => setSelectedEmployeeId(emp.id)}
                              className={`p-3 rounded-2xl border transition-all cursor-pointer flex justify-between items-center bg-amber-50/70 border-amber-250 text-slate-800 ${
                                isSelected ? 'ring-2 ring-amber-500 bg-amber-50' : 'hover:bg-amber-50'
                              }`}
                            >
                              <div className="space-y-0.5 min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-extrabold text-xs truncate font-sans">
                                    {emp.name}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 text-[10px] font-mono opacity-80 flex-wrap">
                                  <span>@{emp.username}</span>
                                  {showPasswordsInList && emp.passwordText && (
                                    <>
                                      <span>•</span>
                                      <span className="text-rose-600 font-bold font-sans">🔑 {emp.passwordText}</span>
                                    </>
                                  )}
                                  <span>•</span>
                                  <span className={`text-[8px] px-1 py-0.5 rounded-md border font-semibold uppercase ${roleBadgeColor}`}>
                                    {emp.role === 'admin' ? 'Owner' : emp.role === 'manager' ? 'Manager' : emp.role === 'manufacturer' ? 'Production' : 'Sales'}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 ml-2" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() => handleApproveUser(emp.id, emp.name)}
                                  className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[9px] font-bold shadow-sm cursor-pointer transition-all flex items-center gap-0.5"
                                >
                                  <Check className="h-3 w-3" /> Yes
                                </button>
                                <button
                                  onClick={() => handleRejectUser(emp.id, emp.name)}
                                  className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[9px] font-bold shadow-sm cursor-pointer transition-all flex items-center gap-0.5"
                                >
                                  <X className="h-3 w-3" /> No
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* SECTION 2: Active Employee Directory */}
                    <div className="space-y-2">
                      {pendingEmployees.length > 0 && activeEmployees.length > 0 && (
                        <div className="text-slate-400 font-extrabold text-[10px] uppercase tracking-wider mb-2">
                          👥 Active Registered Staff ({activeEmployees.length})
                        </div>
                      )}
                      {activeEmployees.map((emp) => {
                        const isSelected = emp.id === selectedEmployeeId;
                        const isSelf = emp.id === currentUser.id;
                        const isLocked = emp.locked;
                        
                        let roleBadgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-100';
                        if (emp.role === 'admin') roleBadgeColor = 'bg-amber-50 text-amber-700 border-amber-100';
                        if (emp.role === 'salesperson') roleBadgeColor = 'bg-indigo-50 text-indigo-700 border-indigo-100';
                        if (emp.role === 'manager') roleBadgeColor = 'bg-teal-50 text-teal-700 border-teal-100';

                        return (
                          <div 
                            key={emp.id}
                            onClick={() => setSelectedEmployeeId(emp.id)}
                            className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex justify-between items-center ${
                              isSelected 
                                ? 'bg-slate-900 border-slate-900 text-white shadow-sm' 
                                : 'bg-slate-50/50 hover:bg-slate-50 border-slate-200 text-slate-800'
                            }`}
                          >
                            <div className="space-y-0.5 min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-extrabold text-xs truncate font-sans flex items-center gap-1.5">
                                  {emp.name} {isSelf && <span className="text-[9px] opacity-75 font-normal">(You)</span>}
                                </span>
                                {isLocked && (
                                  <span className="bg-rose-500 text-white text-[8px] font-extrabold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow-sm animate-pulse">
                                    <Lock className="h-2 w-2" /> LOCKED
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 text-[10px] font-mono opacity-80 flex-wrap">
                                <span>@{emp.username}</span>
                                {showPasswordsInList && emp.passwordText && (
                                  <>
                                    <span>•</span>
                                    <span className={isSelected ? "text-cyan-300 font-bold font-sans" : "text-rose-600 font-bold font-sans"}>🔑 {emp.passwordText}</span>
                                  </>
                                )}
                                <span>•</span>
                                <span className={`text-[8px] px-1.5 py-0.5 rounded-md border font-semibold uppercase ${
                                  isSelected ? 'bg-slate-800 border-slate-700 text-slate-100' : roleBadgeColor
                                }`}>
                                  {emp.role === 'admin' ? 'Owner' : emp.role === 'manager' ? 'Manager' : emp.role === 'manufacturer' ? 'Production' : 'Sales'}
                                </span>
                              </div>
                            </div>

                            {/* Edit / Delete quick controls */}
                            <div className="flex items-center gap-1 ml-2" onClick={(e) => e.stopPropagation()}>
                              
                              {/* Unlock trigger directly in row */}
                              {isLocked && (
                                <button
                                  onClick={() => handleUnlockUser(emp.username)}
                                  title="Unlock account password attempts"
                                  className="p-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 border border-rose-200 transition-colors cursor-pointer mr-1 flex items-center gap-0.5 text-[9px] font-bold"
                                >
                                  <Unlock className="h-3 w-3" /> Unlock
                                </button>
                              )}

                              <button
                                onClick={() => handleStartEdit(emp)}
                                title="Edit profile credentials"
                                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                  isSelected 
                                    ? 'text-slate-400 hover:text-white hover:bg-slate-800' 
                                    : 'text-slate-400 hover:text-cyan-700 hover:bg-slate-100'
                                }`}
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              {emp.username !== 'admin' && (
                                <button
                                  onClick={() => handleDeleteEmployee(emp.id, emp.name)}
                                  title="Delete login profile"
                                  disabled={isSelf}
                                  className={`p-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-20 ${
                                    isSelected 
                                      ? 'text-slate-400 hover:text-rose-400 hover:bg-slate-800' 
                                      : 'text-slate-400 hover:text-rose-600 hover:bg-slate-100'
                                  }`}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          
          {/* Side action controls (Add/Edit Form) */}
          <div className="xl:col-span-1 space-y-6">
            <div className="bg-slate-50 rounded-3xl border border-slate-250 p-6 flex flex-col justify-between" id="employee-detail-card">
              <div>
                <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-1.5 mb-3.5 font-sans">
                  <Briefcase className="h-4 w-4 text-slate-400" /> SELECTED STAFF INTELLIGENCE
                </h3>
                {selectedEmployee ? (
                  <div className="space-y-4">
                    <div className="border-b border-slate-200 pb-3">
                      <div className="text-sm font-extrabold text-slate-900 font-sans">{selectedEmployee.name}</div>
                      <div className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
                        <span>@{selectedEmployee.username}</span>
                        <span>•</span>
                        <span className="font-bold text-slate-700 uppercase">{selectedEmployee.role}</span>
                      </div>
                    </div>
                    
                    {/* Visual metrics panel */}
                    <div className="grid grid-cols-2 gap-3" id="employee-metrics-grid">
                      <div className="p-3 bg-white border border-slate-200 rounded-2xl">
                        <div className="text-[9px] text-slate-400 uppercase font-extrabold">Scooter Sales</div>
                        <div className="text-xs font-bold text-slate-800 mt-1">
                          {scooterUnits.filter(u => u.status === 'sold' && (u.lastUpdatedBy === selectedEmployee.username || u.lastUpdatedBy === selectedEmployee.name)).length} units
                        </div>
                      </div>
                      <div className="p-3 bg-white border border-slate-200 rounded-2xl">
                        <div className="text-[9px] text-slate-400 uppercase font-extrabold">Assembly Logs</div>
                        <div className="text-xs font-bold text-slate-800 mt-1">
                          {scooterUnits.filter(u => u.createdOperator === selectedEmployee.username || u.createdOperator === selectedEmployee.name).length} units
                        </div>
                      </div>
                      <div className="p-3 bg-white border border-slate-200 rounded-2xl col-span-2">
                        <div className="text-[9px] text-slate-400 uppercase font-extrabold">Audit Incidents</div>
                        <div className="text-xs font-bold text-slate-800 mt-1">
                          {auditLogs.filter(log => log.operator.toLowerCase() === selectedEmployee.username.toLowerCase()).length} recorded
                        </div>
                      </div>
                    </div>

                    {/* Live Geolocation Tracker Block */}
                    {(selectedEmployee.role === 'manufacturer' || selectedEmployee.role === 'salesperson' || selectedEmployee.role === 'manager') && (
                      <div className="border-t border-slate-200 pt-4 mt-4 space-y-3" id="employee-location-monitoring">
                        <div className="flex justify-between items-center">
                          <h4 className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                            <Compass className="h-3.5 w-3.5 text-cyan-600 animate-spin-slow" /> LIVE GEOLOCATION 24/7
                          </h4>
                          {selectedEmployee.latitude && selectedEmployee.longitude && (
                            <button
                              type="button"
                              onClick={() => setShowLocationMap(!showLocationMap)}
                              className="text-[9px] font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer bg-slate-200/50 hover:bg-slate-200 px-2 py-0.5 rounded-md transition-colors"
                            >
                              <Map className="h-3 w-3" /> {showLocationMap ? 'Hide Map' : 'Show Map'}
                            </button>
                          )}
                        </div>

                        {selectedEmployee.latitude && selectedEmployee.longitude ? (
                          <div className="space-y-3 animate-fade-in">
                            <div className="bg-slate-100 p-3 rounded-2xl border border-slate-200/80 space-y-1">
                              <div className="flex justify-between items-center text-[10px] text-slate-600">
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3.5 w-3.5 text-rose-500" />
                                  Coordinates
                                </span>
                                <span className="font-mono bg-white px-2 py-0.5 rounded-md border border-slate-200 text-slate-800 font-bold">
                                  {selectedEmployee.latitude.toFixed(5)}, {selectedEmployee.longitude.toFixed(5)}
                                </span>
                              </div>
                              {selectedEmployee.locationTimestamp && (
                                <div className="flex justify-between items-center text-[10px] text-slate-500">
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    Last Active Ping
                                  </span>
                                  <span className="font-sans text-[10px] text-slate-800 font-medium">
                                    {new Date(selectedEmployee.locationTimestamp).toLocaleString()}
                                  </span>
                                </div>
                              )}
                            </div>

                            {showLocationMap && (
                              <EmployeeMap
                                latitude={selectedEmployee.latitude}
                                longitude={selectedEmployee.longitude}
                                employeeName={selectedEmployee.name}
                              />
                            )}

                            <button
                              type="button"
                              disabled={isPullingLocation}
                              onClick={() => handlePullLocation(selectedEmployee.username)}
                              className="w-full text-center py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-extrabold rounded-xl text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
                            >
                              <Compass className="h-3.5 w-3.5 text-cyan-400 animate-spin-slow" />
                              {isPullingLocation ? 'Establishing satellite connection...' : '🛰️ Pull Device Live Location'}
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="text-center py-5 px-3 bg-slate-100 border border-slate-200 rounded-2xl">
                              <div className="text-[20px] mb-1">📡</div>
                              <div className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wide">No Telemetry Received Yet</div>
                              <p className="text-[9px] text-slate-500 mt-0.5 max-w-[200px] mx-auto leading-relaxed">
                                Location can be requested directly. Once the employee is active, their physical GPS transmitter will report.
                              </p>
                            </div>

                            <button
                              type="button"
                              disabled={isPullingLocation}
                              onClick={() => handlePullLocation(selectedEmployee.username)}
                              className="w-full text-center py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-extrabold rounded-xl text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
                            >
                              <Compass className="h-3.5 w-3.5 text-cyan-400 animate-spin-slow" />
                              {isPullingLocation ? 'Pinging device...' : '🛰️ Pull Live Location & Spawn Map'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 italic py-6">Select an employee from the list to view interactive metrics.</div>
                )}
              </div>
            </div>

            {formMode === 'idle' ? (
              <button
                onClick={() => {
                  setFormMode('add');
                  setFormId('');
                  setFormName('');
                  setFormUsername('');
                  setFormPassword('');
                  setFormRole('manufacturer');
                }}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-extrabold rounded-2xl text-xs uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                id="add-employee-button"
              >
                <UserPlus className="h-4.5 w-4.5" /> Register New Account
              </button>
            ) : (
              <div className="bg-white rounded-3xl border border-slate-250 p-6 shadow-sm" id="employee-form-card">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-widest flex items-center gap-1 font-sans">
                    <Shield className="h-4.5 w-4.5 text-cyan-500" />
                    {formMode === 'add' ? 'Create Staff Profile' : 'Edit Staff Profile'}
                  </h3>
                  <button onClick={() => setFormMode('idle')} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 cursor-pointer">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <form onSubmit={formMode === 'add' ? handleAddEmployeeSubmit : handleEditEmployeeSubmit} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 font-sans">
                      Full Display Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. John Doe"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      required
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 font-sans">
                      Account Username
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. johndoe"
                      value={formUsername}
                      onChange={(e) => setFormUsername(e.target.value)}
                      required
                      disabled={formMode === 'edit' && (formUsername === 'admin' || formId === 'u-admin')}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:opacity-50"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 font-sans">
                      Account Password {formMode === 'edit' && <span className="text-slate-400 normal-case">(leave blank to keep current)</span>}
                    </label>
                    <div className="relative">
                      <input
                        type={showFormPassword ? "text" : "password"}
                        placeholder={formMode === 'add' ? "Minimum 4 characters" : "••••••••"}
                        value={formPassword}
                        onChange={(e) => setFormPassword(e.target.value)}
                        required={formMode === 'add'}
                        className="w-full pl-3 pr-10 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
                      />
                      <button
                        type="button"
                        onClick={() => setShowFormPassword(!showFormPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                        title={showFormPassword ? "Hide Password" : "Show Password"}
                      >
                        {showFormPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 font-sans">
                      Access Role / Security Clearance
                    </label>
                    <select
                      value={formRole}
                      onChange={(e) => setFormRole(e.target.value as any)}
                      disabled={formUsername === 'admin'}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:opacity-50"
                    >
                      <option value="manufacturer">Production (Assembly Logs, Standalone Units)</option>
                      <option value="salesperson">Sales Team (Register Sales & Dispatches)</option>
                      <option value="manager">Manager (Full Operations except Settings)</option>
                      <option value="admin">Owner / Administrator (Full Clearance)</option>
                    </select>
                  </div>

                  <div className="flex gap-2.5 pt-2">
                    <button
                      type="submit"
                      disabled={submittingForm}
                      className="flex-1 py-2 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs uppercase tracking-wider shadow-sm cursor-pointer transition-all disabled:opacity-50"
                    >
                      {submittingForm ? 'Saving...' : formMode === 'add' ? 'Register Account' : 'Save Credentials'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormMode('idle')}
                      className="py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-xs uppercase tracking-wider cursor-pointer transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      ) : subTab === 'sheets' ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm no-print">
          <div className="mb-4">
            <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              ☁️ Enterprise Google Sheets Sync
            </h2>
            <p className="text-xs text-slate-500">
              Your Google Sheets webhook URL configuration is now securely centralized inside the owner settings panel to maintain a clean operational layout.
            </p>
          </div>
          <SheetSyncPanel
            sheetConfig={sheetConfig}
            onSaveConfig={onSaveConfig}
            onTriggerSyncAll={onTriggerSyncAll}
            onTriggerPullAll={onTriggerPullAll}
          />
        </div>
      ) : subTab === 'tracking' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 no-print animate-fade-in" id="unified-tracking-dashboard">
          {/* Sidebar Navigation and Control Panel */}
          <div className="lg:col-span-1 bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex flex-col justify-between min-h-[500px]" id="tracking-sidebar">
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-1.5 font-sans">
                  <Compass className="h-4.5 w-4.5 text-cyan-600 animate-spin-slow" /> ACTIVE STAFF DIRECTORY
                </h3>
                <p className="text-[10px] text-slate-400 mt-1 leading-relaxed font-sans">
                  Select a salesperson or assembler to lock onto their satellite beacon and see their real-time telemetry on the tracking map.
                </p>
              </div>

              {/* Search / Filter bar */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Filter active employees..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 font-sans"
                />
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              </div>

              {/* Employee list */}
              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {uniqueEmployees
                  .filter(e => e.role === 'salesperson' || e.role === 'manufacturer' || e.role === 'manager')
                  .filter(e => {
                    const term = searchQuery.toLowerCase().trim();
                    return e.name.toLowerCase().includes(term) || e.username.toLowerCase().includes(term);
                  })
                  .map(emp => {
                    const hasLocation = emp.latitude !== undefined && emp.longitude !== undefined;
                    const isSelected = selectedEmployeeId === emp.id;

                    return (
                      <div
                        key={emp.id}
                        onClick={() => {
                          setSelectedEmployeeId(emp.id);
                        }}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer flex flex-col gap-1.5 ${
                          isSelected
                            ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <div className="text-xs font-bold font-sans flex items-center gap-1.5">
                              {emp.name}
                              <span className={`text-[8px] font-sans font-semibold px-2 py-0.5 rounded-full ${
                                emp.role === 'salesperson' 
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                                  : emp.role === 'manager'
                                  ? 'bg-teal-100 text-teal-800 border border-teal-200'
                                  : 'bg-cyan-100 text-cyan-800 border border-cyan-200'
                              } ${isSelected ? 'brightness-90 text-slate-900 bg-white border-transparent' : ''}`}>
                                {emp.role === 'salesperson' ? '💼 Sales' : emp.role === 'manager' ? '📈 Manager' : '🛠️ Assembly'}
                              </span>
                            </div>
                            <div className={`text-[10px] ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                              @{emp.username}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1 shrink-0">
                            <span className={`h-2 w-2 rounded-full ${hasLocation ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                            <span className={`text-[9px] font-bold ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                              {hasLocation ? 'Online' : 'No Ping'}
                            </span>
                          </div>
                        </div>

                        {hasLocation && (
                          <div className="flex items-center justify-between text-[9px] font-mono border-t pt-1.5 border-dashed border-slate-300/30">
                            <span>{emp.latitude?.toFixed(4)}, {emp.longitude?.toFixed(4)}</span>
                            {emp.locationTimestamp && (
                              <span className="opacity-80">
                                {new Date(emp.locationTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="pt-4 border-t border-slate-100 space-y-2">
              <button
                type="button"
                onClick={async () => {
                  setLoadingEmployees(true);
                  await fetchEmployees();
                  setLoadingEmployees(false);
                  triggerAlert('success', 'Satellite telemetry maps synchronized with master database feeds.');
                }}
                disabled={loadingEmployees}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingEmployees ? 'animate-spin' : ''}`} />
                <span>Sync Active Geofences</span>
              </button>
            </div>
          </div>

          {/* Unified Map Panel */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex flex-col justify-between space-y-4" id="tracking-map-panel">
            <div className="flex justify-between items-center flex-wrap gap-3">
              <div>
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5 font-sans">
                  <Navigation className="h-4 w-4 text-cyan-600 animate-bounce" /> Unified Sat-Track Grid
                </h2>
                <p className="text-[10px] text-slate-400 mt-1 leading-relaxed font-sans">
                  Secure localized satellite map of your workspace fleet in real-time. Click an employee on the sidebar or map pin to center visual coordinate trackers.
                </p>
              </div>

              {/* Action buttons */}
              {selectedEmployeeId && (
                <button
                  type="button"
                  disabled={isPullingLocation}
                  onClick={async () => {
                    const emp = uniqueEmployees.find(e => e.id === selectedEmployeeId);
                    if (emp) {
                      await handlePullLocation(emp.username);
                    }
                  }}
                  className="bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-wider px-3.5 py-1.5 rounded-xl transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
                >
                  <Compass className="h-3.5 w-3.5 text-cyan-400 animate-spin-slow" />
                  {isPullingLocation ? 'Pinging Live Location...' : '🛰️ Pull Live Location'}
                </button>
              )}
            </div>

            {/* Map viewport */}
            <div className="flex-1 min-h-[400px]">
              <StaffUnifiedMap
                employees={uniqueEmployees.filter(e => e.role === 'salesperson' || e.role === 'manufacturer' || e.role === 'manager')}
                focusedEmployeeId={selectedEmployeeId}
                onSelectEmployee={(id) => setSelectedEmployeeId(id)}
              />
            </div>

            {/* Help guidelines banner */}
            <div className="bg-slate-50 border border-slate-150 p-4 rounded-2xl flex items-start gap-3">
              <span className="text-xl shrink-0">💡</span>
              <p className="text-[10px] text-slate-500 leading-relaxed font-sans">
                <strong>Operational Privacy Protocol:</strong> Location coordinates are silently tracked only for active <strong>Assembly Operators (Manufacturers)</strong>, <strong>Sales Agents</strong>, and <strong>Managers</strong> inside their local browser tabs. Geolocation updates are absolutely hidden and fully invisible on the operator’s client side.
              </p>
            </div>
          </div>
        </div>
      ) : subTab === 'trails' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 no-print animate-fade-in" id="location-trails-dashboard">
          {/* Tracking Sidebar Panel */}
          <div className="lg:col-span-1 bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex flex-col justify-between min-h-[500px]" id="trails-sidebar">
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-1.5 font-sans">
                  <MapPin className="h-4.5 w-4.5 text-rose-500 animate-pulse" /> 24-HOUR MOVEMENT FLEET
                </h3>
                <p className="text-[10px] text-slate-400 mt-1 leading-relaxed font-sans">
                  Choose an operator or agent to analyze their movement path, total distance, and chronological pings over the last 24 hours.
                </p>
              </div>

              {/* Search input */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Filter active employees..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 font-sans"
                />
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              </div>

              {/* Employee list with breadcrumbs stats */}
              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {uniqueEmployees
                  .filter(e => e.role === 'salesperson' || e.role === 'manufacturer' || e.role === 'manager')
                  .filter(e => {
                    const term = searchQuery.toLowerCase().trim();
                    return e.name.toLowerCase().includes(term) || e.username.toLowerCase().includes(term);
                  })
                  .map(emp => {
                    const trailCount = emp.locationHistory?.length || 0;
                    const isSelected = selectedEmployeeId === emp.id;

                    return (
                      <div
                        key={emp.id}
                        onClick={() => setSelectedEmployeeId(emp.id)}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer flex flex-col gap-1.5 ${
                          isSelected
                            ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <div className="text-xs font-bold font-sans flex items-center gap-1.5">
                              {emp.name}
                              <span className={`text-[8px] font-sans font-semibold px-2 py-0.5 rounded-full ${
                                emp.role === 'salesperson' 
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                                  : emp.role === 'manager'
                                  ? 'bg-teal-100 text-teal-800 border border-teal-200'
                                  : 'bg-cyan-100 text-cyan-800 border border-cyan-200'
                              } ${isSelected ? 'brightness-90 text-slate-900 bg-white border-transparent' : ''}`}>
                                {emp.role === 'salesperson' ? '💼 Sales' : emp.role === 'manager' ? '📈 Manager' : '🛠️ Assembly'}
                              </span>
                            </div>
                            <div className={`text-[10px] ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                              @{emp.username}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1 shrink-0">
                            <span className={`h-2 w-2 rounded-full ${trailCount > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                            <span className={`text-[9px] font-bold ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                              {trailCount > 0 ? `${trailCount} points` : 'No history'}
                            </span>
                          </div>
                        </div>

                        {trailCount > 0 && emp.locationTimestamp && (
                          <div className="flex items-center justify-between text-[9px] font-sans border-t pt-1.5 border-dashed border-slate-300/30 opacity-80">
                            <span>Last Ping:</span>
                            <span>{new Date(emp.locationTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Force DB Refresh */}
            <div className="pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={async () => {
                  setLoadingEmployees(true);
                  await fetchEmployees();
                  setLoadingEmployees(false);
                  triggerAlert('success', 'Synchronized historical movement databases.');
                }}
                disabled={loadingEmployees}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingEmployees ? 'animate-spin' : ''}`} />
                <span>Sync Trails Data</span>
              </button>
            </div>
          </div>

          {/* Map & Trails Detail Panel */}
          <div className="lg:col-span-2 space-y-6">
            {selectedEmployee ? (
              <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
                <div className="flex justify-between items-center flex-wrap gap-3">
                  <div>
                    <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5 font-sans">
                      <MapPin className="h-4 w-4 text-cyan-600" /> Location Trail: {selectedEmployee.name}
                    </h2>
                    <p className="text-[10px] text-slate-400 mt-1 leading-relaxed font-sans">
                      Viewing 24-hour location breadcrumbs for <strong>@{selectedEmployee.username}</strong> ({selectedEmployee.role}).
                    </p>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-[10px] font-semibold text-slate-500 flex items-center gap-1">
                    <span className="text-cyan-500">🛡️</span> Real Device GPS Stream Only
                  </div>
                </div>

                {/* Trail statistics */}
                {last24hHistory.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3.5 bg-slate-50 border border-slate-150 rounded-2xl">
                      <div className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">Total Points Tracked</div>
                      <div className="text-xl font-black text-slate-900 font-mono mt-0.5">{last24hHistory.length}</div>
                    </div>
                    
                    <div className="p-3.5 bg-slate-50 border border-slate-150 rounded-2xl">
                      <div className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">Accumulated Distance</div>
                      <div className="text-xl font-black text-slate-900 font-mono mt-0.5">
                        {(() => {
                          let dist = 0;
                          const hist = last24hHistory;
                          for (let i = 0; i < hist.length - 1; i++) {
                            dist += getDistanceKM(hist[i].latitude, hist[i].longitude, hist[i+1].latitude, hist[i+1].longitude);
                          }
                          return `${dist.toFixed(2)} km`;
                        })()}
                      </div>
                    </div>

                    <div className="p-3.5 bg-slate-50 border border-slate-150 rounded-2xl">
                      <div className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">Active Span (24h)</div>
                      <div className="text-xl font-black text-slate-900 font-sans mt-0.5">
                        {(() => {
                          const hist = last24hHistory;
                          if (hist.length < 2) return 'N/A';
                          const tStart = new Date(hist[0].timestamp).getTime();
                          const tEnd = new Date(hist[hist.length - 1].timestamp).getTime();
                          const diffMs = Math.abs(tEnd - tStart);
                          const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
                          const diffMins = Math.round((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                          return `${diffHrs}h ${diffMins}m`;
                        })()}
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* Map component */}
                {last24hHistory.length > 0 ? (
                  <div className="space-y-4">
                    <LocationTrailsMap
                      history={last24hHistory}
                      employeeName={selectedEmployee.name}
                    />

                    {/* Timeline Table of movement */}
                    <div>
                      <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-wider mb-2 font-sans flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" /> CHRONOLOGICAL TRAVEL TIMELINE (LAST 24 HOURS ONLY)
                      </h3>
                      <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                        <table className="min-w-full divide-y divide-slate-100 text-left text-xs font-sans">
                          <thead className="bg-slate-50 text-[9px] font-extrabold uppercase text-slate-500 tracking-wider">
                            <tr>
                              <th className="py-2.5 px-4">Stop / Ping</th>
                              <th className="py-2.5 px-4">Local Timestamp</th>
                              <th className="py-2.5 px-4">Coordinates</th>
                              <th className="py-2.5 px-4">Interval distance</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-sans text-slate-700 bg-white">
                            {last24hHistory.map((point, index) => {
                              const isFirst = index === 0;
                              const isLatest = index === last24hHistory.length - 1;
                              
                              let distText = '-';
                              if (index > 0) {
                                const prev = last24hHistory[index - 1];
                                const d = getDistanceKM(prev.latitude, prev.longitude, point.latitude, point.longitude);
                                distText = `+${d.toFixed(2)} km`;
                              }

                              return (
                                <tr key={index} className="hover:bg-slate-50/50">
                                  <td className="py-2.5 px-4 font-bold flex items-center gap-1.5 text-xs text-slate-900">
                                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] ${
                                      isFirst 
                                        ? 'bg-blue-100 text-blue-800' 
                                        : isLatest 
                                          ? 'bg-emerald-100 text-emerald-800' 
                                          : 'bg-slate-100 text-slate-700'
                                    }`}>
                                      {isFirst ? '🏁' : isLatest ? '🛰️' : index + 1}
                                    </span>
                                    <span>
                                      {isFirst ? 'Start Point' : isLatest ? 'Current Target' : `Milestone #${index + 1}`}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-4 text-slate-600 font-medium text-[11px]">
                                    {new Date(point.timestamp).toLocaleString()}
                                  </td>
                                  <td className="py-2.5 px-4 font-mono text-[10px] text-slate-500">
                                    {point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}
                                  </td>
                                  <td className="py-2.5 px-4 text-[10px] font-extrabold text-cyan-600 font-mono">
                                    {distText}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-10 px-4 border border-dashed border-slate-200 rounded-3xl bg-slate-50 space-y-3">
                    <span className="text-3xl">📡</span>
                    <h3 className="text-xs font-black uppercase text-slate-700 tracking-wider">No Location History Recorded</h3>
                    <p className="text-[10px] text-slate-500 max-w-[320px] mx-auto leading-relaxed">
                      This worker hasn't logged any location events in the last 24 hours. Click "Pull Live Location" on the tracking panel or active list to request real-time satellite coordinates directly from their device.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-16 bg-white border border-slate-200 rounded-3xl p-5 shadow-sm text-slate-400 font-sans font-bold flex flex-col items-center justify-center">
                <span className="text-4xl mb-2">📍</span>
                <span className="text-xs uppercase tracking-wider text-slate-600">Select an employee from the list</span>
                <p className="text-[10px] text-slate-400 font-normal mt-1 max-w-[280px] leading-relaxed">
                  Lock onto any fleet operator or agent to inspect their chronological satellite breadcrumb history.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : subTab === 'audit' ? (
        /* SYSTEM AUDIT TRAIL BANK STATEMENT LEDGER VIEW */
        <div className="space-y-6 animate-fade-in" id="audit-trail-view">
          
          {/* Summary KPIs Banner */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 no-print">
            <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-1">
              <span className="block text-[9px] font-bold uppercase opacity-60">
                Total Logs Recorded
              </span>
              <span className="block text-2xl font-black font-mono">
                {auditStats.total}
              </span>
            </div>
            <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-900 rounded-2xl space-y-1">
              <span className="block text-[9px] font-bold uppercase text-emerald-600">
                Successful Logins
              </span>
              <span className="block text-2xl font-black font-mono text-emerald-800">
                {auditStats.logins}
              </span>
            </div>
            <div className="p-4 bg-amber-50 border border-amber-100 text-amber-900 rounded-2xl space-y-1">
              <span className="block text-[9px] font-bold uppercase text-amber-600">
                System operations
              </span>
              <span className="block text-2xl font-black font-mono text-amber-800">
                {auditStats.actionsCount}
              </span>
            </div>
            <div className="p-4 bg-rose-50 border border-rose-100 text-rose-900 rounded-2xl space-y-1">
              <span className="block text-[9px] font-bold uppercase text-rose-600">
                Failed Password entries
              </span>
              <span className="block text-2xl font-black font-mono text-rose-800">
                {auditStats.failedLogins}
              </span>
            </div>
            <div className="p-4 bg-red-50 border border-red-100 text-red-900 rounded-2xl space-y-1 col-span-2 md:col-span-1">
              <span className="block text-[9px] font-bold uppercase text-red-600">
                Accounts Locked Out
              </span>
              <span className="block text-2xl font-black font-mono text-red-800">
                {auditStats.lockouts}
              </span>
            </div>
          </div>

          {/* Filtering Console Card */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4 no-print">
            <div className="flex items-center gap-1 text-slate-800 pb-1 border-b border-slate-100">
              <Filter className="h-4 w-4 text-slate-500" />
              <h3 className="text-xs font-black uppercase tracking-wider">
                Bank Statement Query Filters
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
              
              {/* Search String */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                  Details Keyword Search
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    placeholder="Search logs details..."
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-cyan-500 text-slate-700 font-sans"
                  />
                </div>
              </div>

              {/* Employee list filter */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                  Filter by Employee / Operator
                </label>
                <select
                  value={auditUserFilter}
                  onChange={(e) => setAuditUserFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 outline-none focus:bg-white focus:border-cyan-500 font-sans cursor-pointer"
                >
                  <option value="">-- All Employees --</option>
                  {uniqueEmployees.map(e => (
                    <option key={e.id} value={e.name}>{e.name} (@{e.username})</option>
                  ))}
                  <option value="system">System Daemon</option>
                </select>
              </div>

              {/* Action type filter */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                  Filter by System Action
                </label>
                <select
                  value={auditActionFilter}
                  onChange={(e) => setAuditActionFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 outline-none focus:bg-white focus:border-cyan-500 font-sans cursor-pointer"
                >
                  <option value="">-- All Categories --</option>
                  <option value="auth">🔐 Security & Logins (Attempts, Lockouts)</option>
                  <option value="scooter">🛠️ Production (Assembling, Customizing)</option>
                  <option value="pos">💼 Retail & POS Checkout Dispatches</option>
                  <option value="battery">🔋 Battery Warehousing (Sales, Hold, Import)</option>
                  <option value="admin">⚙️ Owner Administrative Overrides</option>
                </select>
              </div>

              {/* Date Filters Grid */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                  Date Ledger Range
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={auditStartDate}
                    onChange={(e) => setAuditStartDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-[10px] text-slate-800 outline-none focus:bg-white focus:border-cyan-500 font-mono"
                  />
                  <input
                    type="date"
                    value={auditEndDate}
                    onChange={(e) => setAuditEndDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-[10px] text-slate-800 outline-none focus:bg-white focus:border-cyan-500 font-mono"
                  />
                </div>
              </div>

            </div>

            {/* Quick action buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
              <span className="text-[10px] font-medium text-slate-400">
                Filtered: <strong>{filteredAuditLogs.length}</strong> rows of system logs
              </span>
              <div className="flex items-center gap-2">
                {auditSearch || auditUserFilter || auditActionFilter || auditStartDate || auditEndDate ? (
                  <button
                    onClick={() => {
                      setAuditSearch('');
                      setAuditUserFilter('');
                      setAuditActionFilter('');
                      setAuditStartDate('');
                      setAuditEndDate('');
                    }}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl transition-all cursor-pointer"
                  >
                    Reset Filters
                  </button>
                ) : null}
                <button
                  onClick={handleExportCSV}
                  className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer border border-indigo-150"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  <span>Export Spreadsheet</span>
                </button>
                <button
                  onClick={handlePrintStatement}
                  className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Print Audit Statement</span>
                </button>
                {(currentUser.role === 'admin' || currentUser.role === 'manager') && (
                  <button
                    onClick={handleClearAuditLogs}
                    className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                    title="Clear all audit history logs"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Clear History</span>
                  </button>
                )}
              </div>
            </div>

          </div>

          {/* MAIN PRINTABLE BANK STATEMENT LEDGER CONTAINER */}
          <div 
            id="printable-audit-statement"
            className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm space-y-6"
          >
            {/* Header: Bank Statement Logo & Corporate Metadata */}
            <div className="border-b-2 border-slate-950 pb-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h1 className="text-xl font-black uppercase text-slate-900 tracking-tight font-sans">
                  Chakra Electric Vehicles
                </h1>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-0.5">
                  Corporate Warehouse Registry & Ledger Statement
                </p>
                <div className="text-[9px] text-slate-500 font-mono mt-1 space-y-0.5">
                  <p>Reg Address: IND-411014 Pune Corporate Zone, MH</p>
                  <p>Database Integrity Hash: SHA-256 Auth Secured</p>
                </div>
              </div>
              
              <div className="text-left md:text-right space-y-1 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
                <span className="inline-block bg-slate-900 text-white text-[9px] font-bold px-2 py-0.5 rounded-md uppercase font-sans">
                  Official Statement
                </span>
                <p className="text-xs font-extrabold text-slate-900 font-sans">
                  SYSTEM ACTIVITY AUDIT JOURNAL
                </p>
                <p className="text-[9px] text-slate-400 font-mono">
                  Statement Period: Genesis to Present
                </p>
                <p className="text-[9px] text-slate-500 font-mono">
                  Generated by Admin Operator: {currentUser.name}
                </p>
              </div>
            </div>

            {/* Print Header Description */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row justify-between gap-4">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-wide">Statement Summary</p>
                <p className="text-xs text-slate-600 leading-relaxed font-sans max-w-lg">
                  This document serves as the official cryptographic system journal for Chakra Electric Vehicles. Every transaction, user authentication, frame creation, customization, and sales event is logged with operator identification.
                </p>
              </div>
              <div className="text-left sm:text-right space-y-0.5 font-mono text-[10px] text-slate-500 justify-end flex flex-col">
                <p>Generation Time: {new Date().toLocaleString()}</p>
                <p>Filter Status: {auditUserFilter ? `@${auditUserFilter}` : 'All Operators'}</p>
                <p>Ledger Entries Printed: {filteredAuditLogs.length} rows</p>
              </div>
            </div>

            {/* Table/Timeline Block */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-slate-950 text-[10px] font-black uppercase text-slate-800 tracking-wider">
                    <th className="py-3 px-3">Date / Timestamp</th>
                    <th className="py-3 px-3">Operator</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-3">Details / Narrative Audit Trace</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150">
                  {loadingAudit ? (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-xs text-slate-400 italic">
                        <RefreshCw className="h-5 w-5 animate-spin text-slate-400 mx-auto mb-2" />
                        Loading complete audit ledger statement...
                      </td>
                    </tr>
                  ) : filteredAuditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-xs text-slate-400 italic">
                        No system activity audit records match your selected criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredAuditLogs.map((log, index) => {
                      let tagColor = 'bg-slate-100 text-slate-700 border-slate-200';
                      let actionText = log.action || '';
                      
                      if (log.action === 'login_success') {
                        tagColor = 'bg-emerald-50 text-emerald-800 border-emerald-100';
                        actionText = '🔑 LOGIN';
                      } else if (log.action === 'login_failed') {
                        tagColor = 'bg-red-50 text-red-800 border-red-150';
                        actionText = '🚨 FAIL_PASS';
                      } else if (log.action === 'login_locked') {
                        tagColor = 'bg-rose-100 text-rose-800 border-rose-200 font-bold';
                        actionText = '🛑 LOCKOUT';
                      } else if (log.action === 'user_unlocked') {
                        tagColor = 'bg-amber-50 text-amber-800 border-amber-200';
                        actionText = '🔓 UNLOCKED';
                      } else if (log.action === 'assemble_scooter' || log.action === 'bulk_assemble_scooters') {
                        tagColor = 'bg-green-50 text-green-800 border-green-100';
                        actionText = '🛠️ ASSEMBLE';
                      } else if (log.action === 'customize_scooter') {
                        tagColor = 'bg-cyan-50 text-cyan-800 border-cyan-150';
                        actionText = '🔧 CUSTOMIZE';
                      } else if (log.action === 'pos_scooter_sale' || log.action === 'bulk_scooter_sale') {
                        tagColor = 'bg-indigo-50 text-indigo-800 border-indigo-150';
                        actionText = '💼 SALE_POS';
                      } else if (log.action === 'battery_sale') {
                        tagColor = 'bg-amber-50 text-amber-800 border-amber-100';
                        actionText = '🔋 BAT_SALE';
                      } else if (log.action === 'battery_import') {
                        tagColor = 'bg-teal-50 text-teal-800 border-teal-100';
                        actionText = '🚢 BAT_IMPORT';
                      }

                      return (
                        <tr 
                          key={log.id || `audit-${index}`} 
                          className={`text-xs hover:bg-slate-50/50 transition-colors ${
                            index % 2 === 1 ? 'bg-slate-50/20' : 'bg-white'
                          }`}
                        >
                          {/* Timestamp */}
                          <td className="py-2.5 px-3 font-mono text-[10px] text-slate-500 shrink-0 whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleString()}
                          </td>
                          
                          {/* Operator */}
                          <td className="py-2.5 px-3 font-sans">
                            <span className="font-extrabold text-slate-800 block text-[11px]">{log.operator}</span>
                            <span className="text-[9px] text-slate-400 uppercase tracking-wider">{log.operatorRole || 'User'}</span>
                          </td>

                          {/* Action Code */}
                          <td className="py-2.5 px-3">
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-md border font-mono font-bold tracking-tight uppercase ${tagColor}`}>
                              {actionText}
                            </span>
                          </td>

                          {/* Detail Narrative */}
                          <td className="py-2.5 px-3 font-sans text-[11px] text-slate-700 leading-normal">
                            {log.details}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Statement Footer */}
            <div className="pt-6 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center text-[9px] text-slate-400 font-mono gap-4">
              <p>Chakra Warehouse Registry Cryptographic Ledger — System Audit Trail statement. Continuous block tracking enabled.</p>
              <p className="no-print">Page 1 of 1</p>
            </div>

          </div>

        </div>
      ) : (
        /* STANDARD EMPLOYEES DIRECTORY SUBTAB */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in" id="employees-view">
          
          {/* LEFT PANEL: Directory & Controls (5 Cols) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Quick Add / Edit Form Block */}
            {formMode !== 'idle' ? (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-1.5">
                    {formMode === 'add' ? <UserPlus className="h-4 w-4 text-emerald-600" /> : <Edit2 className="h-4 w-4 text-cyan-600" />}
                    {formMode === 'add' ? 'Add New Employee' : 'Edit Employee Profile'}
                  </h3>
                  <button 
                    onClick={resetForm}
                    className="text-[10px] font-bold text-slate-400 hover:text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>

                <form onSubmit={formMode === 'add' ? handleAddEmployeeSubmit : handleEditEmployeeSubmit} className="space-y-3.5">
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                      Full Legal Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. John Doe"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-cyan-500 outline-none font-sans"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                        Login Username
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. johndoe"
                        value={formUsername}
                        onChange={(e) => setFormUsername(e.target.value)}
                        disabled={formMode === 'edit' && formId === 'u-admin'} // prevent lockout
                        className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-cyan-500 outline-none font-sans disabled:opacity-50"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                        Employee Role (Type)
                      </label>
                      <select
                        value={formRole}
                        onChange={(e) => setFormRole(e.target.value as any)}
                        disabled={formMode === 'edit' && formUsername === 'admin'} // lock original admin
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:border-cyan-500 outline-none font-sans cursor-pointer"
                      >
                        <option value="admin">👑 Owner / Admin</option>
                        <option value="manager">🛡️ Operations Manager</option>
                        <option value="manufacturer">🛠️ Assembly Operator</option>
                        <option value="salesperson">💼 Sales Agent</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                      Login Password {formMode === 'edit' && <span className="text-slate-400 font-normal capitalize">(Leave empty to keep existing)</span>}
                    </label>
                    <div className="relative">
                      <input
                        type={showFormPassword ? "text" : "password"}
                        placeholder={formMode === 'edit' ? "••••••••" : "Enter temporary password"}
                        value={formPassword}
                        onChange={(e) => setFormPassword(e.target.value)}
                        className="w-full bg-slate-50/50 border border-slate-200 rounded-xl pl-3 pr-10 py-2 text-xs text-slate-800 focus:bg-white focus:border-cyan-500 outline-none font-mono"
                        required={formMode === 'add'}
                      />
                      <button
                        type="button"
                        onClick={() => setShowFormPassword(!showFormPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                        title={showFormPassword ? "Hide Password" : "Show Password"}
                      >
                        {showFormPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submittingForm}
                    className={`w-full py-2.5 rounded-xl text-white text-xs font-bold tracking-wide transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                      formMode === 'add' ? 'bg-emerald-900 hover:bg-emerald-800' : 'bg-cyan-900 hover:bg-cyan-800'
                    }`}
                  >
                    {submittingForm ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        <span>{formMode === 'add' ? 'Add Employee Credentials' : 'Save Profile Changes'}</span>
                      </>
                    )}
                  </button>
                </form>
              </motion.div>
            ) : null}

            {/* Employee Directory Panel */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider">
                    👥 Employee Directory
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Click an employee to view their audit contributions and history.
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowPasswordsInList(!showPasswordsInList)}
                    className="px-2.5 py-1.5 border border-slate-250 hover:bg-slate-50 text-slate-600 rounded-xl text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all shadow-sm"
                    title={showPasswordsInList ? "Hide passwords" : "Show passwords"}
                  >
                    {showPasswordsInList ? <EyeOff className="h-3 w-3 text-rose-500" /> : <Eye className="h-3 w-3 text-cyan-600" />}
                    <span>{showPasswordsInList ? 'Hide Pins' : 'Show Pins'}</span>
                  </button>
                  {formMode === 'idle' && (
                    <button
                      onClick={() => setFormMode('add')}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all shadow-sm"
                    >
                      <UserPlus className="h-3 w-3" />
                      <span>Add</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Search filter */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter by name, username, role..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-cyan-500 transition-colors text-slate-700 font-sans"
                />
              </div>

              {/* Directory List */}
              <div className="space-y-4 max-h-[450px] overflow-y-auto pr-1">
                {loadingEmployees ? (
                  <div className="flex flex-col items-center py-8 text-xs text-slate-400 italic">
                    <RefreshCw className="h-5 w-5 animate-spin text-slate-400 mb-2" />
                    <span>Loading employee directory...</span>
                  </div>
                ) : filteredEmployees.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400 italic">
                    No employees match your search query.
                  </div>
                ) : (
                  <>
                    {/* SECTION 1: Pending Owner Approvals */}
                    {pendingEmployees.length > 0 && (
                      <div className="space-y-2 border-b border-dashed border-amber-200 pb-4">
                        <div className="flex items-center gap-1.5 text-amber-700 font-extrabold text-[10px] uppercase tracking-wider mb-2">
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                          ⏳ Pending Access Requests ({pendingEmployees.length})
                        </div>
                        {pendingEmployees.map((emp) => {
                          const isSelected = emp.id === selectedEmployeeId;
                          let roleBadgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-100';
                          if (emp.role === 'admin') roleBadgeColor = 'bg-amber-50 text-amber-700 border-amber-100';
                          if (emp.role === 'salesperson') roleBadgeColor = 'bg-indigo-50 text-indigo-700 border-indigo-100';
                          if (emp.role === 'manager') roleBadgeColor = 'bg-teal-50 text-teal-700 border-teal-100';

                          return (
                            <div 
                              key={emp.id}
                              onClick={() => setSelectedEmployeeId(emp.id)}
                              className={`p-3 rounded-2xl border transition-all cursor-pointer flex justify-between items-center bg-amber-50/70 border-amber-250 text-slate-800 ${
                                isSelected ? 'ring-2 ring-amber-500 bg-amber-50' : 'hover:bg-amber-50'
                              }`}
                            >
                              <div className="space-y-0.5 min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-extrabold text-xs truncate font-sans">
                                    {emp.name}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 text-[10px] font-mono opacity-80">
                                  <span>@{emp.username}</span>
                                  <span>•</span>
                                  <span className={`text-[8px] px-1 py-0.5 rounded-md border font-semibold uppercase ${roleBadgeColor}`}>
                                    {emp.role === 'admin' ? 'Owner' : emp.role === 'manager' ? 'Manager' : emp.role === 'manufacturer' ? 'Production' : 'Sales'}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 ml-2" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() => handleApproveUser(emp.id, emp.name)}
                                  className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[9px] font-bold shadow-sm cursor-pointer transition-all flex items-center gap-0.5"
                                >
                                  <Check className="h-3 w-3" /> Yes
                                </button>
                                <button
                                  onClick={() => handleRejectUser(emp.id, emp.name)}
                                  className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[9px] font-bold shadow-sm cursor-pointer transition-all flex items-center gap-0.5"
                                >
                                  <X className="h-3 w-3" /> No
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* SECTION 2: Active Employee Directory */}
                    <div className="space-y-2">
                      {pendingEmployees.length > 0 && activeEmployees.length > 0 && (
                        <div className="text-slate-400 font-extrabold text-[10px] uppercase tracking-wider mb-2">
                          👥 Active Registered Staff ({activeEmployees.length})
                        </div>
                      )}
                      {activeEmployees.map((emp) => {
                        const isSelected = emp.id === selectedEmployeeId;
                        const isSelf = emp.id === currentUser.id;
                        const isLocked = emp.locked;
                        
                        let roleBadgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-100';
                        if (emp.role === 'admin') roleBadgeColor = 'bg-amber-50 text-amber-700 border-amber-100';
                        if (emp.role === 'salesperson') roleBadgeColor = 'bg-indigo-50 text-indigo-700 border-indigo-100';
                        if (emp.role === 'manager') roleBadgeColor = 'bg-teal-50 text-teal-700 border-teal-100';

                        return (
                          <div 
                            key={emp.id}
                            onClick={() => setSelectedEmployeeId(emp.id)}
                            className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex justify-between items-center ${
                              isSelected 
                                ? 'bg-slate-900 border-slate-900 text-white shadow-sm' 
                                : 'bg-slate-50/50 hover:bg-slate-50 border-slate-200 text-slate-800'
                            }`}
                          >
                            <div className="space-y-0.5 min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-extrabold text-xs truncate font-sans flex items-center gap-1.5">
                                  {emp.name} {isSelf && <span className="text-[9px] opacity-75 font-normal">(You)</span>}
                                </span>
                                {isLocked && (
                                  <span className="bg-rose-500 text-white text-[8px] font-extrabold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow-sm animate-pulse">
                                    <Lock className="h-2 w-2" /> LOCKED
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 text-[10px] font-mono opacity-80 flex-wrap">
                                <span>@{emp.username}</span>
                                {showPasswordsInList && emp.passwordText && (
                                  <>
                                    <span>•</span>
                                    <span className={isSelected ? "text-cyan-300 font-bold font-sans" : "text-rose-600 font-bold font-sans"}>🔑 {emp.passwordText}</span>
                                  </>
                                )}
                                <span>•</span>
                                <span className={`text-[8px] px-1.5 py-0.5 rounded-md border font-semibold uppercase ${
                                  isSelected ? 'bg-slate-800 border-slate-700 text-slate-100' : roleBadgeColor
                                }`}>
                                  {emp.role === 'admin' ? 'Owner' : emp.role === 'manager' ? 'Manager' : emp.role === 'manufacturer' ? 'Production' : 'Sales'}
                                </span>
                              </div>
                            </div>

                            {/* Edit / Delete quick controls */}
                            <div className="flex items-center gap-1 ml-2" onClick={(e) => e.stopPropagation()}>
                              
                              {/* Unlock trigger directly in row */}
                              {isLocked && (
                                <button
                                  onClick={() => handleUnlockUser(emp.username)}
                                  title="Unlock account password attempts"
                                  className="p-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 border border-rose-200 transition-colors cursor-pointer mr-1 flex items-center gap-0.5 text-[9px] font-bold"
                                >
                                  <Unlock className="h-3 w-3" /> Unlock
                                </button>
                              )}

                              <button
                                onClick={() => handleStartEdit(emp)}
                                title="Edit profile credentials"
                                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                  isSelected 
                                    ? 'text-slate-400 hover:text-white hover:bg-slate-800' 
                                    : 'text-slate-400 hover:text-cyan-700 hover:bg-slate-100'
                                }`}
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              {emp.username !== 'admin' && (
                                <button
                                  onClick={() => handleDeleteEmployee(emp.id, emp.name)}
                                  title="Delete login profile"
                                  disabled={isSelf}
                                  className={`p-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-20 ${
                                    isSelected 
                                      ? 'text-slate-400 hover:text-rose-400 hover:bg-slate-800' 
                                      : 'text-slate-400 hover:text-rose-600 hover:bg-slate-100'
                                  }`}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT PANEL: Employee Audit Intelligence & Contributions (7 Cols) */}
          <div className="lg:col-span-7">
            {selectedEmployee ? (
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
                
                {/* Employee Header */}
                <div className="border-b border-slate-100 pb-4 flex justify-between items-start gap-4 flex-wrap">
                  <div>
                    <span className="text-[10px] font-black uppercase text-amber-500 tracking-wider flex items-center gap-1 font-sans">
                      <Sparkles className="h-3 w-3 fill-amber-400 stroke-amber-500" />
                      OPERATOR AUDIT & HISTORY
                    </span>
                    <h2 className="text-base font-extrabold text-slate-900 mt-1 flex items-center gap-1.5 font-sans">
                      {selectedEmployee.name}
                    </h2>
                    <p className="text-xs text-slate-400 font-mono">
                      Username: @{selectedEmployee.username} — Role: {selectedEmployee.role.toUpperCase()}{selectedEmployee.passwordText ? ` — PIN: ${selectedEmployee.passwordText}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedEmployee.locked && (
                      <span className="bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold px-3 py-1 rounded-xl flex items-center gap-1">
                        <Lock className="h-3.5 w-3.5" /> Locked Out
                      </span>
                    )}
                    <div className="bg-slate-100 p-2.5 rounded-2xl flex items-center justify-center">
                      <User className="h-6 w-6 text-slate-500" />
                    </div>
                  </div>
                </div>

                {/* Lockout Warning Box */}
                {selectedEmployee.locked && (
                  <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm animate-pulse">
                    <div className="flex items-center gap-2 text-rose-800">
                      <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
                      <div className="text-xs">
                        <p className="font-bold">This Account is Locked Out</p>
                        <p className="opacity-90">3 incorrect password attempts was reached on this account.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUnlockUser(selectedEmployee.username)}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold rounded-xl flex items-center gap-1 shadow-md cursor-pointer transition-all self-start sm:self-center"
                    >
                      <Key className="h-3.5 w-3.5" />
                      Unlock Credentials Now
                    </button>
                  </div>
                )}

                {/* Contribution Metrics Grid */}
                {employeeStats ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      
                      <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-center space-y-1">
                        <span className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wide">
                          Total Operations
                        </span>
                        <span className="block text-xl font-black text-slate-900 font-mono">
                          {employeeStats.totalLoggedActions}
                        </span>
                        <span className="block text-[9px] text-slate-400">
                          database records
                        </span>
                      </div>

                      <div className="p-3.5 bg-emerald-50/50 border border-emerald-100 rounded-2xl text-center space-y-1">
                        <span className="block text-[9px] font-extrabold text-emerald-600 uppercase tracking-wide">
                          Frames Built
                        </span>
                        <span className="block text-xl font-black text-emerald-800 font-mono">
                          {employeeStats.assembledCount}
                        </span>
                        <span className="block text-[9px] text-emerald-500">
                          scooter registry
                        </span>
                      </div>

                      <div className="p-3.5 bg-cyan-50/50 border border-cyan-100 rounded-2xl text-center space-y-1">
                        <span className="block text-[9px] font-extrabold text-cyan-600 uppercase tracking-wide">
                          Customizations
                        </span>
                        <span className="block text-xl font-black text-cyan-800 font-mono">
                          {employeeStats.customizedCount}
                        </span>
                        <span className="block text-[9px] text-cyan-500 font-sans">
                          spec modifications
                        </span>
                      </div>

                      <div className="p-3.5 bg-indigo-50/50 border border-indigo-100 rounded-2xl text-center space-y-1">
                        <span className="block text-[9px] font-extrabold text-indigo-600 uppercase tracking-wide">
                          POS Scooter Sales
                        </span>
                        <span className="block text-xl font-black text-indigo-800 font-mono">
                          {employeeStats.salesCount}
                        </span>
                        <span className="block text-[9px] text-indigo-500 font-sans">
                          sold dispatches
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-4 bg-amber-50/40 border border-amber-100 rounded-2xl flex items-center justify-between">
                        <div>
                          <span className="block text-[10px] font-bold text-amber-700 uppercase tracking-wider">
                            Standalone Battery Sales
                          </span>
                          <span className="text-xs text-slate-500 mt-1 block">
                            Logged dispatches for {employeeStats.batterySalesBatches} raw battery shipments.
                          </span>
                        </div>
                        <div className="text-right pl-3">
                          <span className="block text-lg font-black text-amber-800 font-mono">
                            {employeeStats.batterySalesCount}
                          </span>
                          <span className="block text-[9px] text-amber-600">packs dispatched</span>
                        </div>
                      </div>

                      <div className="p-4 bg-teal-50/40 border border-teal-100 rounded-2xl flex items-center justify-between">
                        <div>
                          <span className="block text-[10px] font-bold text-teal-700 uppercase tracking-wider">
                            Overseas Battery Imports
                          </span>
                          <span className="text-xs text-slate-500 mt-1 block">
                            Registered {employeeStats.batteryImportBatches} overseas batch containers.
                          </span>
                        </div>
                        <div className="text-right pl-3">
                          <span className="block text-lg font-black text-teal-800 font-mono">
                            {employeeStats.batteryImportCount}
                          </span>
                          <span className="block text-[9px] text-teal-600">packs logged</span>
                        </div>
                      </div>
                    </div>

                    {/* Operational Activities Ledger / Timeline */}
                    <div className="space-y-3.5">
                      <div>
                        <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 font-sans">
                          <Activity className="h-4 w-4 text-emerald-800" />
                          Recent System Activity Log ({employeeStats.feed.length} rows)
                        </h4>
                        <p className="text-[10px] text-slate-400">
                          A complete historical audit list of database updates stamped with this operator name.
                        </p>
                      </div>

                      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1.5">
                        {employeeStats.feed.length === 0 ? (
                          <div className="text-center py-10 text-xs text-slate-400 italic">
                            No recorded system operations for this employee.
                          </div>
                        ) : (
                          employeeStats.feed.map((act) => (
                            <div key={act.id} className={`p-3 rounded-2xl border-l-[3.5px] border-y border-r border-slate-100 ${act.color} flex justify-between gap-3 items-start transition-all hover:translate-x-0.5`}>
                              <div className="space-y-0.5">
                                <span className="block text-xs font-extrabold font-sans">
                                  {act.title}
                                </span>
                                <span className="block text-[10px] opacity-85 font-sans">
                                  {act.details}
                                </span>
                              </div>
                              <span className="text-[9px] font-mono opacity-60 shrink-0 text-right">
                                {new Date(act.timestamp).toLocaleDateString()} <br />
                                {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                  </div>
                ) : null}

              </div>
            ) : (
              <div className="bg-slate-50 border border-dashed border-slate-200 rounded-3xl p-12 text-center text-slate-400 italic text-xs">
                Select an employee from the directory list to analyze their performance intelligence.
              </div>
            )}
          </div>

        </div>
      )}

      {/* Delete Employee Custom Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm no-print">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-md overflow-hidden flex flex-col p-6 space-y-4"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 bg-rose-50 rounded-2xl text-rose-600 border border-rose-100 shrink-0">
                  <Trash2 className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-extrabold text-slate-900 font-sans">
                    Delete Employee Account?
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed font-sans">
                    Are you sure you want to permanently delete employee <strong>"{deleteConfirmUser.name}"</strong>? They will instantly lose access to login and any session credentials will be revoked. This operation is irreversible.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmUser(null)}
                  disabled={deletingUser}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={deletingUser}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  {deletingUser ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Permanently Delete</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
