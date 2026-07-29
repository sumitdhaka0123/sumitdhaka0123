import React, { useState, useMemo, useEffect } from 'react';
import { groupSerialsIntoRangesAndIndividuals, generateSerialRangeHelper } from '../utils/serialUtils';
import { 
  ScooterUnit, 
  BatterySale, 
  ChargerSale, 
  Buyer, 
  User,
  AuditLog 
} from '../types';
import { 
  Truck, 
  CheckCircle2, 
  Clock, 
  FileText, 
  Search, 
  Edit3, 
  ShieldAlert, 
  Printer, 
  X, 
  ChevronDown, 
  ChevronUp, 
  AlertCircle,
  Building2,
  Calendar,
  Lock,
  Sparkles,
  Zap,
  Trash2,
  PlusCircle,
  Plus,
  History,
  FileClock,
  Filter,
  RefreshCw,
  UserCheck,
  PackagePlus,
  PackageMinus,
  CheckCheck,
  Tag
} from 'lucide-react';

interface ChallanManagerProps {
  scooterUnits: ScooterUnit[];
  batterySales: BatterySale[];
  chargerSales: ChargerSale[];
  buyers: Buyer[];
  currentUser: User;
  onRefresh: () => void;
}

export interface GroupedChallan {
  challanNo: string;
  buyerName: string;
  buyerContact: string;
  salesBillNo: string;
  status: 'pending' | 'finished';
  finishedBy?: string;
  finishedTimestamp?: string;
  date: string;
  scooters: ScooterUnit[];
  batteries: BatterySale[];
  chargers: ChargerSale[];
  totalItemsCount: number;
}

export const ChallanManager: React.FC<ChallanManagerProps> = ({
  scooterUnits,
  batterySales,
  chargerSales,
  buyers,
  currentUser,
  onRefresh
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'finished'>('all');
  const [expandedChallans, setExpandedChallans] = useState<Record<string, boolean>>({});

  // Editing modal state
  const [editingChallan, setEditingChallan] = useState<GroupedChallan | null>(null);
  const [editBuyerName, setEditBuyerName] = useState('');
  const [editBuyerContact, setEditBuyerContact] = useState('');
  const [editBillNo, setEditBillNo] = useState('');
  const [editChallanNo, setEditChallanNo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Print modal state
  const [printChallan, setPrintChallan] = useState<GroupedChallan | null>(null);

  // Delete confirmation modal state
  const [deleteConfirmationTarget, setDeleteConfirmationTarget] = useState<{
    type: 'entire' | 'item';
    challanNo: string;
    itemType?: 'scooter' | 'battery' | 'charger';
    itemId?: string;
    itemLabel?: string;
  } | null>(null);

  // Finish confirmation modal state
  const [finishConfirmationTarget, setFinishConfirmationTarget] = useState<GroupedChallan | null>(null);

  // Add Item Modal state
  const [addItemModalTarget, setAddItemModalTarget] = useState<GroupedChallan | null>(null);
  const [addItemType, setAddItemType] = useState<'scooter' | 'battery' | 'charger'>('scooter');
  const [selectedItemId, setSelectedItemId] = useState<string>('');

  // Sub-tab Navigation state ('challans' or 'audit_trail')
  const [activeTab, setActiveTab] = useState<'challans' | 'audit_trail'>('challans');

  // Audit Trail State
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoadingAuditLogs, setIsLoadingAuditLogs] = useState(false);
  const [auditSearchTerm, setAuditSearchTerm] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState<'all' | 'attach' | 'remove' | 'update' | 'finish' | 'delete'>('all');
  const [selectedChallanAuditModal, setSelectedChallanAuditModal] = useState<string | null>(null);

  const fetchAuditLogs = async () => {
    setIsLoadingAuditLogs(true);
    try {
      const res = await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/audit-logs');
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data || []);
      }
    } catch (err) {
      console.warn('Failed to fetch audit logs:', err);
    } finally {
      setIsLoadingAuditLogs(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const challanAuditLogs = useMemo(() => {
    return auditLogs.filter(log => {
      const action = (log.action || '').toLowerCase();
      const details = (log.details || '').toLowerCase();
      const isChallanRelated = action.includes('challan') || details.includes('challan') || details.includes('delivery');
      if (!isChallanRelated) return false;

      // Action type filter
      if (auditActionFilter === 'attach' && !action.includes('attach') && !details.includes('attached')) return false;
      if (auditActionFilter === 'remove' && !action.includes('remove') && !details.includes('removed')) return false;
      if (auditActionFilter === 'update' && !action.includes('update') && !details.includes('updated')) return false;
      if (auditActionFilter === 'finish' && !action.includes('finish') && !details.includes('finished')) return false;
      if (auditActionFilter === 'delete' && !action.includes('delete') && !details.includes('deleted')) return false;

      // Search term
      if (auditSearchTerm.trim()) {
        const q = auditSearchTerm.toLowerCase().trim();
        const match = (
          (log.username || '').toLowerCase().includes(q) ||
          (log.operator || '').toLowerCase().includes(q) ||
          (log.operatorName || '').toLowerCase().includes(q) ||
          (log.operatorRole || '').toLowerCase().includes(q) ||
          action.includes(q) ||
          details.includes(q)
        );
        if (!match) return false;
      }

      return true;
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [auditLogs, auditActionFilter, auditSearchTerm]);

  const getModalChallanLogs = (challanNo: string) => {
    const cleanNo = challanNo.toLowerCase().trim();
    return auditLogs.filter(log => {
      const details = (log.details || '').toLowerCase();
      const action = (log.action || '').toLowerCase();
      return details.includes(cleanNo) || action.includes(cleanNo);
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  };

  const availableScooterOptions = useMemo(() => {
    return scooterUnits.filter(u => u.status === 'available' || !u.deliveryChallanNo || u.deliveryChallanNo.trim() === '');
  }, [scooterUnits]);

  const availableBatteryOptions = useMemo(() => {
    return batterySales.filter(b => !b.deliveryChallanNo || b.deliveryChallanNo.trim() === '');
  }, [batterySales]);

  const availableChargerOptions = useMemo(() => {
    return chargerSales.filter(c => !c.deliveryChallanNo || c.deliveryChallanNo.trim() === '');
  }, [chargerSales]);

  const handleAttachItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addItemModalTarget || !selectedItemId) {
      setStatusMessage({ type: 'error', text: 'Please select an item to attach.' });
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/challans/attach-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deliveryChallanNo: addItemModalTarget.challanNo,
          itemType: addItemType,
          itemId: selectedItemId,
          operator: currentUser.name || currentUser.username || 'system',
          userRole: currentUser.role,
          buyerName: addItemModalTarget.buyerName,
          buyerContact: addItemModalTarget.buyerContact,
          salesBillNo: addItemModalTarget.salesBillNo
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to attach item');
      setStatusMessage({ type: 'success', text: data.message || `Item attached to Challan #${addItemModalTarget.challanNo} successfully!` });
      setAddItemModalTarget(null);
      setSelectedItemId('');
      onRefresh();
      fetchAuditLogs();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Error attaching item to challan.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Group items by Delivery Challan Number
  const groupedChallans = useMemo(() => {
    const map = new Map<string, GroupedChallan>();

    // Helper to format/get or create challan group
    const getOrCreateGroup = (challanNo: string, defaultBuyer: string, defaultContact: string, defaultBillNo: string, defaultDate: string) => {
      const cleanNo = challanNo.trim().toUpperCase();
      if (!map.has(cleanNo)) {
        map.set(cleanNo, {
          challanNo: cleanNo,
          buyerName: defaultBuyer || 'Unspecified Buyer',
          buyerContact: defaultContact || '',
          salesBillNo: defaultBillNo || '',
          status: 'pending',
          date: defaultDate || new Date().toISOString(),
          scooters: [],
          batteries: [],
          chargers: [],
          totalItemsCount: 0
        });
      }
      return map.get(cleanNo)!;
    };

    // 1. Scooter Units
    scooterUnits.forEach(u => {
      if (u.status === 'hold' || (u as any).saleStatus === 'hold') return;
      if (u.deliveryChallanNo && u.deliveryChallanNo.trim()) {
        const group = getOrCreateGroup(u.deliveryChallanNo, u.buyerName || '', u.buyerContact || '', u.salesBillNo || '', u.saleDate || u.holdDate || '');
        group.scooters.push(u);
        group.totalItemsCount += 1;
        if (u.buyerName && group.buyerName === 'Unspecified Buyer') group.buyerName = u.buyerName;
        if (u.buyerContact && !group.buyerContact) group.buyerContact = u.buyerContact;
        if (u.salesBillNo && !group.salesBillNo) group.salesBillNo = u.salesBillNo;
        if (u.challanStatus === 'finished') {
          group.status = 'finished';
          group.finishedBy = u.challanFinishedBy || group.finishedBy;
          group.finishedTimestamp = u.challanFinishedTimestamp || group.finishedTimestamp;
        }
      }
    });

    // 2. Standalone Battery Sales
    (batterySales || []).forEach(b => {
      if ((b as any).status === 'hold' || (b as any).saleStatus === 'hold') return;
      if (b.deliveryChallanNo && b.deliveryChallanNo.trim()) {
        const group = getOrCreateGroup(b.deliveryChallanNo, b.buyerName || '', b.buyerContact || '', b.billNo || '', b.saleDate || '');
        group.batteries.push(b);
        group.totalItemsCount += (b.quantity || 1);
        if (b.buyerName && group.buyerName === 'Unspecified Buyer') group.buyerName = b.buyerName;
        if (b.buyerContact && !group.buyerContact) group.buyerContact = b.buyerContact;
        if (b.billNo && !group.salesBillNo) group.salesBillNo = b.billNo;
        if (b.challanStatus === 'finished') {
          group.status = 'finished';
          group.finishedBy = b.challanFinishedBy || group.finishedBy;
          group.finishedTimestamp = b.challanFinishedTimestamp || group.finishedTimestamp;
        }
      }
    });

    // 3. Standalone Charger Sales
    (chargerSales || []).forEach(c => {
      if ((c as any).status === 'hold' || (c as any).saleStatus === 'hold') return;
      if (c.deliveryChallanNo && c.deliveryChallanNo.trim()) {
        const group = getOrCreateGroup(c.deliveryChallanNo, c.buyerName || '', c.buyerContact || '', c.billNo || '', c.saleDate || '');
        group.chargers.push(c);
        group.totalItemsCount += (c.quantity || 1);
        if (c.buyerName && group.buyerName === 'Unspecified Buyer') group.buyerName = c.buyerName;
        if (c.buyerContact && !group.buyerContact) group.buyerContact = c.buyerContact;
        if (c.billNo && !group.salesBillNo) group.salesBillNo = c.billNo;
        if (c.challanStatus === 'finished') {
          group.status = 'finished';
          group.finishedBy = c.challanFinishedBy || group.finishedBy;
          group.finishedTimestamp = c.challanFinishedTimestamp || group.finishedTimestamp;
        }
      }
    });

    // Convert map to array sorted by date descending
    return Array.from(map.values()).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [scooterUnits, batterySales, chargerSales]);

  // Filtered list
  const filteredChallans = useMemo(() => {
    return groupedChallans.filter(g => {
      // Status check
      if (statusFilter === 'pending' && g.status !== 'pending') return false;
      if (statusFilter === 'finished' && g.status !== 'finished') return false;

      // Search check
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase().trim();
      return (
        g.challanNo.toLowerCase().includes(q) ||
        g.buyerName.toLowerCase().includes(q) ||
        g.salesBillNo.toLowerCase().includes(q) ||
        g.scooters.some(s => s.chassisNo.toLowerCase().includes(q) || s.motorNo.toLowerCase().includes(q) || s.controllerNo.toLowerCase().includes(q)) ||
        g.batteries.some(b => (b.serialNumbers || []).some(sn => sn.toLowerCase().includes(q)) || b.batterySeries.toLowerCase().includes(q)) ||
        g.chargers.some(c => (c.serialNumbers || []).some(sn => sn.toLowerCase().includes(q)) || c.chargerType.toLowerCase().includes(q))
      );
    });
  }, [groupedChallans, statusFilter, searchTerm]);

  // Metrics
  const metrics = useMemo(() => {
    const totalCount = groupedChallans.length;
    const pendingCount = groupedChallans.filter(g => g.status === 'pending').length;
    const finishedCount = groupedChallans.filter(g => g.status === 'finished').length;
    let totalScootersDispatched = 0;
    let totalBatteriesDispatched = 0;
    let totalChargersDispatched = 0;

    groupedChallans.forEach(g => {
      totalScootersDispatched += g.scooters.length;
      totalBatteriesDispatched += g.batteries.reduce((acc, b) => acc + b.quantity, 0);
      totalChargersDispatched += g.chargers.reduce((acc, c) => acc + c.quantity, 0);
    });

    return {
      totalCount,
      pendingCount,
      finishedCount,
      totalScootersDispatched,
      totalBatteriesDispatched,
      totalChargersDispatched
    };
  }, [groupedChallans]);

  const toggleExpand = (challanNo: string) => {
    setExpandedChallans(prev => ({ ...prev, [challanNo]: !prev[challanNo] }));
  };

  const handleFinishChallan = async (challan: GroupedChallan) => {
    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const res = await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/challans/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deliveryChallanNo: challan.challanNo,
          operator: currentUser.name || currentUser.username
        })
      });

      const data = await res.json();
      if (res.ok) {
        setStatusMessage({ type: 'success', text: `Challan #${challan.challanNo} marked as Finished & Verified!` });
        setFinishConfirmationTarget(null);
        onRefresh();
        fetchAuditLogs();
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Failed to verify challan.' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Network error verifying challan.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEdit = (challan: GroupedChallan) => {
    setEditingChallan(challan);
    setEditBuyerName(challan.buyerName);
    setEditBuyerContact(challan.buyerContact);
    setEditBillNo(challan.salesBillNo);
    setEditChallanNo(challan.challanNo);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingChallan) return;

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const res = await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/challans/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deliveryChallanNo: editingChallan.challanNo,
          newChallanNo: editChallanNo.trim().toUpperCase(),
          buyerName: editBuyerName.trim(),
          buyerContact: editBuyerContact.trim(),
          billNo: editBillNo.trim().toUpperCase(),
          operator: currentUser.name || currentUser.username,
          userRole: currentUser.role
        })
      });

      const data = await res.json();
      if (res.ok) {
        setStatusMessage({ type: 'success', text: `Challan details updated successfully!` });
        setEditingChallan(null);
        onRefresh();
        fetchAuditLogs();
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Failed to update challan details.' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Network error updating challan.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveItem = (challanNo: string, itemType: 'scooter' | 'battery' | 'charger', itemId: string, itemLabel?: string) => {
    setDeleteConfirmationTarget({
      type: 'item',
      challanNo,
      itemType,
      itemId,
      itemLabel
    });
  };

  const handleDeleteEntireChallan = (challanNo: string) => {
    setDeleteConfirmationTarget({
      type: 'entire',
      challanNo
    });
  };

  const executeDeleteAction = async () => {
    if (!deleteConfirmationTarget) return;
    setIsSubmitting(true);
    setStatusMessage(null);

    const { type, challanNo, itemType, itemId } = deleteConfirmationTarget;
    try {
      if (type === 'item' && itemType && itemId) {
        const res = await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/challans/remove-item', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deliveryChallanNo: challanNo,
            itemType,
            itemId,
            operator: currentUser.name || currentUser.username || 'system',
            userRole: currentUser.role
          })
        });
        const data = await res.json();
        if (res.ok) {
          setStatusMessage({ type: 'success', text: data.message || 'Item removed from challan.' });
          onRefresh();
          fetchAuditLogs();
        } else {
          setStatusMessage({ type: 'error', text: data.error || 'Failed to remove item.' });
        }
      } else if (type === 'entire') {
        const res = await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/challans/delete-entire', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deliveryChallanNo: challanNo,
            operator: currentUser.name || currentUser.username || 'system',
            userRole: currentUser.role
          })
        });
        const data = await res.json();
        if (res.ok) {
          setStatusMessage({ type: 'success', text: data.message || `Delivery Challan #${challanNo} deleted successfully.` });
          onRefresh();
          fetchAuditLogs();
        } else {
          setStatusMessage({ type: 'error', text: data.error || 'Failed to delete entire challan.' });
        }
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: 'Network error processing deletion request.' });
    } finally {
      setIsSubmitting(false);
      setDeleteConfirmationTarget(null);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Top Banner & Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-cyan-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 opacity-10 pointer-events-none flex items-center pr-8">
          <Truck className="h-48 w-48 text-cyan-400" />
        </div>

        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/20 border border-cyan-400/30 text-cyan-300 text-xs font-bold uppercase tracking-wider">
            <Truck className="h-3.5 w-3.5" />
            <span>Truck Dispatches & Delivery Challans</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            Finished Sales & Challan Manager
          </h1>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-medium">
            Monitor truck shipment delivery challans containing Scooters, Batteries, and Chargers. 
            Managers verify items against paper gate passes, edit details during pending stage, and finalize sales. 
            Finished sales are locked and protected for owner audit.
          </p>
        </div>
      </div>

      {/* Global Status Banner Alert */}
      {statusMessage && (
        <div 
          className={`p-4 rounded-2xl border flex items-center justify-between text-xs font-bold ${
            statusMessage.type === 'success' 
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200' 
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            ) : (
              <AlertCircle className="h-5 w-5 text-rose-600" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button 
            onClick={() => setStatusMessage(null)} 
            className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Sub-Tab Navigation Bar */}
      <div className="flex items-center justify-between flex-wrap gap-3 p-2 bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('challans')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'challans'
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Truck className="h-4 w-4 text-cyan-400" />
            <span>Delivery Challans ({groupedChallans.length})</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('audit_trail');
              fetchAuditLogs();
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'audit_trail'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <History className="h-4 w-4 text-indigo-300" />
            <span>📜 Challan Audit Trail</span>
            {challanAuditLogs.length > 0 && (
              <span className="bg-indigo-500/30 text-indigo-100 px-2 py-0.5 rounded-full text-[10px] font-mono">
                {challanAuditLogs.length}
              </span>
            )}
          </button>
        </div>

        <button
          onClick={() => {
            onRefresh();
            fetchAuditLogs();
          }}
          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer border border-slate-200"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${isLoadingAuditLogs ? 'animate-spin' : ''}`} />
          <span>Refresh Logs</span>
        </button>
      </div>

      {activeTab === 'challans' && (
        <>
          {/* Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
              <div className="p-3 rounded-xl bg-cyan-50 text-cyan-600 border border-cyan-100">
                <Truck className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Total Delivery Challans</p>
                <p className="text-xl font-black text-slate-800">{metrics.totalCount}</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
              <div className="p-3 rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
                <Clock className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Pending Verification</p>
                <p className="text-xl font-black text-amber-700">{metrics.pendingCount}</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
              <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Finished & Verified</p>
                <p className="text-xl font-black text-emerald-700">{metrics.finishedCount}</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
              <div className="p-3 rounded-xl bg-purple-50 text-purple-600 border border-purple-100">
                <Zap className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Total Units Dispatched</p>
                <p className="text-lg font-black text-purple-900 leading-tight">
                  {metrics.totalScootersDispatched + metrics.totalBatteriesDispatched + metrics.totalChargersDispatched} <span className="text-xs text-slate-500 font-normal">Total Items</span>
                </p>
                <p className="text-[10px] text-purple-700 font-semibold mt-0.5">
                  {metrics.totalScootersDispatched} Scooters • {metrics.totalBatteriesDispatched} Batteries • {metrics.totalChargersDispatched} Chargers
                </p>
              </div>
            </div>
          </div>

      {/* Control Bar: Search & Status Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 justify-between items-center">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search Challan No, Buyer, Bill No, Chassis..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:border-cyan-500 outline-none"
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')} 
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
            >
              Clear
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 w-full sm:w-auto text-xs font-bold">
          <button
            onClick={() => setStatusFilter('all')}
            className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg transition-all cursor-pointer ${
              statusFilter === 'all' 
                ? 'bg-white text-slate-900 shadow-sm' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            All ({groupedChallans.length})
          </button>
          <button
            onClick={() => setStatusFilter('pending')}
            className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              statusFilter === 'pending' 
                ? 'bg-amber-50 text-amber-900 border border-amber-200 shadow-sm' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clock className="h-3.5 w-3.5 text-amber-600" />
            <span>Pending ({metrics.pendingCount})</span>
          </button>
          <button
            onClick={() => setStatusFilter('finished')}
            className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              statusFilter === 'finished' 
                ? 'bg-emerald-50 text-emerald-900 border border-emerald-200 shadow-sm' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            <span>Finished & Verified ({metrics.finishedCount})</span>
          </button>
        </div>
      </div>

      {/* Delivery Challans List */}
      <div className="space-y-4">
        {filteredChallans.length === 0 ? (
          <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-3">
            <Truck className="h-12 w-12 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-700">No Delivery Challans Found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              No delivery challans match your search or filter options. Create wholesale sales or battery/charger sales with a Delivery Challan Number to see them here!
            </p>
          </div>
        ) : (
          filteredChallans.map((challan) => {
            const isExpanded = !!expandedChallans[challan.challanNo];
            const isFinished = challan.status === 'finished';
            const isOwner = currentUser.role === 'owner' || currentUser.role === 'admin' || currentUser.username?.toLowerCase() === 'admin' || currentUser.username?.toLowerCase() === 'owner';
            
            const canEdit = !isFinished ? (currentUser.role === 'admin' || currentUser.role === 'manager' || currentUser.role === 'owner') : isOwner;
            const canRemoveItems = !isFinished ? (currentUser.role === 'admin' || currentUser.role === 'manager' || currentUser.role === 'owner') : isOwner;
            const canDeleteChallan = !isFinished ? (currentUser.role === 'admin' || currentUser.role === 'manager' || currentUser.role === 'owner') : isOwner;
            const canAddItem = !isFinished ? (currentUser.role === 'admin' || currentUser.role === 'manager' || currentUser.role === 'owner') : isOwner;

            return (
              <div 
                key={challan.challanNo}
                className={`bg-white rounded-2xl border transition-all shadow-sm ${
                  isFinished ? 'border-emerald-200 hover:border-emerald-300' : 'border-amber-200 hover:border-amber-300'
                }`}
              >
                {/* Card Header */}
                <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className={`p-3 rounded-2xl border ${
                      isFinished 
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                        : 'bg-amber-50 border-amber-200 text-amber-700'
                    }`}>
                      <Truck className="h-6 w-6" />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-black text-slate-900 tracking-tight">
                          Challan #{challan.challanNo}
                        </span>

                        {isFinished ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                            <span>Sale Finished & Verified</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                            <Clock className="h-3 w-3 text-amber-600 animate-spin" />
                            <span>Pending Manager Check</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-xs font-semibold text-slate-500 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3.5 w-3.5 text-slate-400" />
                          <strong className="text-slate-800">{challan.buyerName}</strong>
                          {challan.buyerContact && ` (${challan.buyerContact})`}
                        </span>

                        {challan.salesBillNo && (
                          <span className="flex items-center gap-1">
                            <FileText className="h-3.5 w-3.5 text-slate-400" />
                            <span>Bill #: <strong className="text-slate-800">{challan.salesBillNo}</strong></span>
                          </span>
                        )}

                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          <span>{new Date(challan.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        </span>
                      </div>

                      {/* Items Pill Summary */}
                      <div className="flex items-center gap-2 pt-1 font-sans text-[11px] font-bold">
                        {challan.scooters.length > 0 && (
                          <span className="px-2.5 py-0.5 rounded-md bg-cyan-50 text-cyan-800 border border-cyan-200">
                            🛵 {challan.scooters.length} Scooters
                          </span>
                        )}
                        {challan.batteries.length > 0 && (
                          <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                            🔋 {challan.batteries.reduce((a, b) => a + b.quantity, 0)} Batteries
                          </span>
                        )}
                        {challan.chargers.length > 0 && (
                          <span className="px-2.5 py-0.5 rounded-md bg-purple-50 text-purple-800 border border-purple-200">
                            ⚡ {challan.chargers.reduce((a, c) => a + c.quantity, 0)} Chargers
                          </span>
                        )}
                      </div>

                      {isFinished && challan.finishedBy && (
                        <p className="text-[10px] text-emerald-700 font-bold pt-0.5">
                          Verified by {challan.finishedBy} {challan.finishedTimestamp && `on ${new Date(challan.finishedTimestamp).toLocaleDateString()}`}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => setPrintChallan(challan)}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Print Official Delivery Challan Pass"
                    >
                      <Printer className="h-4 w-4" />
                      <span>Print Pass</span>
                    </button>

                    <button
                      onClick={() => setSelectedChallanAuditModal(challan.challanNo)}
                      className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="View modification audit trail for this challan"
                    >
                      <History className="h-4 w-4 text-indigo-600" />
                      <span>Audit Trail</span>
                    </button>

                    {canEdit ? (
                      <button
                        onClick={() => handleOpenEdit(challan)}
                        className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Edit3 className="h-4 w-4" />
                        <span>Edit Details</span>
                      </button>
                    ) : (
                      <span className="px-3 py-2 bg-slate-100 text-slate-400 text-[10px] font-bold rounded-xl flex items-center gap-1 cursor-not-allowed">
                        <Lock className="h-3.5 w-3.5" />
                        <span>Verified (Owner Only Edit)</span>
                      </span>
                    )}

                    {canAddItem && (
                      <button
                        onClick={() => { setAddItemModalTarget(challan); setSelectedItemId(''); }}
                        className="px-3 py-2 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Add an item (Scooter, Battery, Charger) to this Delivery Challan"
                      >
                        <PlusCircle className="h-4 w-4 text-cyan-600" />
                        <span>Add Item</span>
                      </button>
                    )}

                    {!isFinished && (currentUser.role === 'admin' || currentUser.role === 'manager' || currentUser.role === 'owner') && (
                      <button
                        onClick={() => setFinishConfirmationTarget(challan)}
                        disabled={isSubmitting}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Finish & Verify Sale</span>
                      </button>
                    )}

                    {canDeleteChallan && (
                      <button
                        onClick={() => handleDeleteEntireChallan(challan.challanNo)}
                        disabled={isSubmitting}
                        className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                        title="Delete entire delivery challan and unassign items"
                      >
                        <Trash2 className="h-4 w-4 text-rose-600" />
                        <span>Delete Entire Challan</span>
                      </button>
                    )}

                    <button
                      onClick={() => toggleExpand(challan.challanNo)}
                      className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-600 cursor-pointer"
                      title="Toggle Details"
                    >
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Details Panel */}
                {isExpanded && (
                  <div className="border-t border-slate-100 p-4 sm:p-6 bg-slate-50/50 rounded-b-2xl space-y-5">
                    {/* Scooters Breakdown */}
                    {challan.scooters.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-black text-cyan-900 uppercase tracking-wide flex items-center gap-2">
                          <span>🛵 Dispatched Scooter Units ({challan.scooters.length})</span>
                        </h4>
                        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-100 text-slate-600 text-[10px] font-bold uppercase">
                              <tr>
                                <th className="p-2.5">Model & Color</th>
                                <th className="p-2.5">Chassis Number</th>
                                <th className="p-2.5">Motor / Controller</th>
                                <th className="p-2.5">Assigned Batteries</th>
                                <th className="p-2.5">Scooter Warranty</th>
                                <th className="p-2.5 text-right">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                              {challan.scooters.map((scoot) => (
                                <tr key={scoot.id} className="hover:bg-slate-50">
                                  <td className="p-2.5">
                                    <span className="font-bold">{scoot.modelName}</span>
                                    <span className="text-[10px] text-slate-400 block font-normal">{scoot.color}</span>
                                  </td>
                                  <td className="p-2.5 font-bold font-mono text-cyan-800">
                                    <span className="bg-cyan-50 text-cyan-900 border border-cyan-200 px-2 py-0.5 rounded font-black text-xs">
                                      {scoot.chassisNo}
                                    </span>
                                  </td>
                                  <td className="p-2.5 text-[11px] text-slate-700 font-mono space-y-0.5">
                                    <div><span className="text-slate-400 font-normal">Motor:</span> <strong className="text-slate-900">{scoot.motorNo || 'N/A'}</strong></div>
                                    <div><span className="text-slate-400 font-normal">Ctrl:</span> <strong className="text-slate-900">{scoot.controllerNo || 'N/A'}</strong></div>
                                  </td>
                                  <td className="p-2.5">
                                    {scoot.batterySerials && scoot.batterySerials.length > 0 ? (
                                      <div className="space-y-1">
                                        <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                          🔋 {scoot.batterySerials.length} Battery Serial(s)
                                        </span>
                                        <div className="font-mono text-[10px] font-bold text-slate-800">
                                          {scoot.batterySerials.join(', ')}
                                        </div>
                                      </div>
                                    ) : (
                                      <span className="text-[10px] text-amber-600 italic font-mono">No battery linked</span>
                                    )}
                                  </td>
                                  <td className="p-2.5 text-[11px]">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      scoot.scooterWarrantyStatus === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                                    }`}>
                                      {scoot.scooterWarrantyStatus || 'None'} {scoot.scooterWarrantyExpiry && `(Exp: ${scoot.scooterWarrantyExpiry})`}
                                    </span>
                                  </td>
                                  <td className="p-2.5 text-right">
                                    <button
                                      type="button"
                                      disabled={isSubmitting || !canRemoveItems}
                                      onClick={() => handleRemoveItem(challan.challanNo, 'scooter', scoot.id)}
                                      title="Remove Scooter from this Challan"
                                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer disabled:opacity-30"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Batteries Breakdown */}
                    {challan.batteries.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-black text-emerald-900 uppercase tracking-wide flex items-center gap-2">
                          <span>🔋 Standalone Wholesale Battery Packs</span>
                        </h4>
                        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-100 text-slate-600 text-[10px] font-bold uppercase">
                              <tr>
                                <th className="p-2.5">Series</th>
                                <th className="p-2.5">Quantity</th>
                                <th className="p-2.5">Serial Numbers / Block</th>
                                <th className="p-2.5">Warranty Duration</th>
                                <th className="p-2.5 text-right">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                              {challan.batteries.map((bat) => {
                                const serialGroup = groupSerialsIntoRangesAndIndividuals(
                                  bat.serialNumbers,
                                  bat.startNo,
                                  bat.endNo,
                                  bat.quantity,
                                  bat.batterySeries
                                );

                                return (
                                  <tr key={bat.id} className="hover:bg-slate-50">
                                    <td className="p-2.5 font-bold">{bat.batterySeries}</td>
                                    <td className="p-2.5 font-black text-emerald-800 bg-emerald-50/70 rounded-lg">
                                      {bat.quantity} {bat.quantity === 1 ? 'Battery' : 'Batteries'}
                                    </td>
                                    <td className="p-2.5 text-[11px]">
                                      {serialGroup.allSerials.length > 0 ? (
                                        <div className="space-y-1.5 py-1">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            {serialGroup.ranges.map((r, rIdx) => (
                                              <span key={`range-${rIdx}`} className="text-[10px] font-extrabold bg-cyan-100 text-cyan-950 px-2 py-0.5 rounded border border-cyan-300 flex items-center gap-1">
                                                <span>In Series:</span>
                                                <span className="font-mono">{r.text}</span>
                                                <span className="opacity-80">({r.count} {r.count === 1 ? 'Battery' : 'Batteries'})</span>
                                              </span>
                                            ))}
                                            {serialGroup.standalone.length > 0 && (
                                              <span className="text-[10px] font-extrabold bg-amber-100 text-amber-950 px-2 py-0.5 rounded border border-amber-300">
                                                Individual: {serialGroup.standalone.join(', ')}
                                              </span>
                                            )}
                                          </div>
                                          <div className="font-mono text-slate-800 text-[10px] bg-slate-50 p-2 rounded-xl border border-slate-200 flex flex-wrap gap-1 max-h-36 overflow-y-auto">
                                            {serialGroup.allSerials.map((s, idx) => (
                                              <span key={idx} className="bg-white text-slate-900 px-1.5 py-0.5 rounded-md border border-slate-200 font-bold shadow-2xs">
                                                {s}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      ) : (
                                        <span className="text-slate-500 font-mono italic">
                                          Bulk Batch ({bat.quantity} {bat.quantity === 1 ? 'Battery' : 'Batteries'} of Series {bat.batterySeries})
                                        </span>
                                      )}
                                    </td>
                                    <td className="p-2.5 text-[11px]">
                                      {bat.isUnderWarranty ? `${bat.warrantyDurationMonths || 12} Months Warranty` : 'No Warranty'}
                                    </td>
                                    <td className="p-2.5 text-right">
                                      <button
                                        type="button"
                                        disabled={isSubmitting || !canRemoveItems}
                                        onClick={() => handleRemoveItem(challan.challanNo, 'battery', bat.id)}
                                        title="Remove Battery Pack from this Challan"
                                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer disabled:opacity-30"
                                      >
                                        <Trash2 className="h-4 w-4" />
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

                    {/* Chargers Breakdown */}
                    {challan.chargers.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-black text-purple-900 uppercase tracking-wide flex items-center gap-2">
                          <span>⚡ Standalone Wholesale Chargers</span>
                        </h4>
                        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-100 text-slate-600 text-[10px] font-bold uppercase">
                              <tr>
                                <th className="p-2.5">Charger Type</th>
                                <th className="p-2.5">Quantity</th>
                                <th className="p-2.5">Serial Numbers / Range</th>
                                <th className="p-2.5">Warranty</th>
                                <th className="p-2.5 text-right">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                              {challan.chargers.map((chg) => {
                                const serialGroup = groupSerialsIntoRangesAndIndividuals(
                                  chg.serialNumbers,
                                  chg.startNo,
                                  chg.endNo,
                                  chg.quantity,
                                  chg.chargerType
                                );

                                return (
                                  <tr key={chg.id} className="hover:bg-slate-50">
                                    <td className="p-2.5 font-bold">{chg.chargerType}</td>
                                    <td className="p-2.5 font-black text-purple-800 bg-purple-50/70 rounded-lg">
                                      {chg.quantity} {chg.quantity === 1 ? 'Unit' : 'Units'}
                                    </td>
                                    <td className="p-2.5 text-[11px]">
                                      <div className="space-y-1.5 py-1 font-sans">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          {serialGroup.ranges.map((r, rIdx) => (
                                            <span key={`chg-range-${rIdx}`} className="text-[10px] font-extrabold bg-purple-100 text-purple-950 px-2 py-0.5 rounded border border-purple-300 flex items-center gap-1">
                                              <span>In Series:</span>
                                              <span className="font-mono">{r.text}</span>
                                              <span className="opacity-80">({r.count} {r.count === 1 ? 'Unit' : 'Units'})</span>
                                            </span>
                                          ))}
                                          {serialGroup.standalone.length > 0 && (
                                            <span className="text-[10px] font-extrabold bg-amber-100 text-amber-950 px-2 py-0.5 rounded border border-amber-300">
                                              Individual: {serialGroup.standalone.join(', ')}
                                            </span>
                                          )}
                                        </div>
                                        <div className="font-mono text-slate-800 text-[10px] bg-slate-50 p-2 rounded-xl border border-slate-200 flex flex-wrap gap-1 max-h-36 overflow-y-auto">
                                          {serialGroup.allSerials.map((s, idx) => (
                                            <span key={idx} className="bg-white text-slate-900 px-1.5 py-0.5 rounded-md border border-slate-200 font-bold shadow-2xs">
                                              {s}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    </td>
                                    <td className="p-2.5 text-[11px]">
                                      {chg.isUnderWarranty ? `${chg.warrantyDurationMonths || 12} Months Warranty` : 'No Warranty'}
                                    </td>
                                    <td className="p-2.5 text-right">
                                      <button
                                        type="button"
                                        disabled={isSubmitting || !canRemoveItems}
                                        onClick={() => handleRemoveItem(challan.challanNo, 'charger', chg.id)}
                                        title="Remove Charger from this Challan"
                                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer disabled:opacity-30"
                                      >
                                        <Trash2 className="h-4 w-4" />
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
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      </>
      )}

      {/* Audit Trail Section */}
      {activeTab === 'audit_trail' && (
        <div className="space-y-4 font-sans">
          {/* Audit Control Bar: Search & Action Filters */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 justify-between items-center">
            {/* Search */}
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by Challan #, Operator, Role, or Item details..."
                value={auditSearchTerm}
                onChange={(e) => setAuditSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:border-indigo-500 outline-none"
              />
              {auditSearchTerm && (
                <button
                  onClick={() => setAuditSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Action Filters */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 w-full md:w-auto text-xs font-bold flex-wrap gap-1">
              <button
                onClick={() => setAuditActionFilter('all')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  auditActionFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                All Events ({challanAuditLogs.length})
              </button>
              <button
                onClick={() => setAuditActionFilter('attach')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                  auditActionFilter === 'attach' ? 'bg-emerald-50 text-emerald-900 border border-emerald-200 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <PackagePlus className="h-3.5 w-3.5 text-emerald-600" />
                <span>Added</span>
              </button>
              <button
                onClick={() => setAuditActionFilter('remove')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                  auditActionFilter === 'remove' ? 'bg-rose-50 text-rose-900 border border-rose-200 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <PackageMinus className="h-3.5 w-3.5 text-rose-600" />
                <span>Removed</span>
              </button>
              <button
                onClick={() => setAuditActionFilter('update')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                  auditActionFilter === 'update' ? 'bg-sky-50 text-sky-900 border border-sky-200 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Edit3 className="h-3.5 w-3.5 text-sky-600" />
                <span>Updated</span>
              </button>
              <button
                onClick={() => setAuditActionFilter('finish')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                  auditActionFilter === 'finish' ? 'bg-emerald-50 text-emerald-900 border border-emerald-200 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <CheckCheck className="h-3.5 w-3.5 text-emerald-600" />
                <span>Finished</span>
              </button>
              <button
                onClick={() => setAuditActionFilter('delete')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                  auditActionFilter === 'delete' ? 'bg-amber-50 text-amber-900 border border-amber-200 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Trash2 className="h-3.5 w-3.5 text-amber-600" />
                <span>Deleted</span>
              </button>
            </div>
          </div>

          {/* Audit Logs List / Timeline */}
          {challanAuditLogs.length === 0 ? (
            <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-3">
              <FileClock className="h-12 w-12 text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-slate-700">No Challan Audit Logs Found</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                No historical modification events match your current filter criteria. Actions such as adding items, removing items, updating details, or finishing challans will automatically generate audit entries here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {challanAuditLogs.map((log) => {
                const action = (log.action || '').toLowerCase();
                const isAttach = action.includes('attach') || (log.details || '').toLowerCase().includes('attached');
                const isRemove = action.includes('remove') || (log.details || '').toLowerCase().includes('removed');
                const isFinish = action.includes('finish') || (log.details || '').toLowerCase().includes('finished');
                const isUpdate = action.includes('update') || (log.details || '').toLowerCase().includes('updated');
                const isDelete = action.includes('delete') || (log.details || '').toLowerCase().includes('deleted');

                let badgeBg = 'bg-slate-100 text-slate-800 border-slate-200';
                let actionLabel = log.action || 'Modification';
                let icon = <FileClock className="h-4 w-4 text-slate-600" />;

                if (isAttach) {
                  badgeBg = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                  actionLabel = 'Item Attached';
                  icon = <PackagePlus className="h-4 w-4 text-emerald-600" />;
                } else if (isRemove) {
                  badgeBg = 'bg-rose-50 text-rose-800 border-rose-200';
                  actionLabel = 'Item Removed';
                  icon = <PackageMinus className="h-4 w-4 text-rose-600" />;
                } else if (isFinish) {
                  badgeBg = 'bg-emerald-100 text-emerald-900 border-emerald-300';
                  actionLabel = 'Challan Finished & Verified';
                  icon = <CheckCheck className="h-4 w-4 text-emerald-700" />;
                } else if (isUpdate) {
                  badgeBg = 'bg-sky-50 text-sky-800 border-sky-200';
                  actionLabel = 'Details Updated';
                  icon = <Edit3 className="h-4 w-4 text-sky-600" />;
                } else if (isDelete) {
                  badgeBg = 'bg-amber-50 text-amber-900 border-amber-200';
                  actionLabel = 'Challan Deleted';
                  icon = <Trash2 className="h-4 w-4 text-amber-600" />;
                }

                return (
                  <div
                    key={log.id}
                    className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-indigo-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3.5">
                      <div className={`p-3 rounded-2xl border shrink-0 ${badgeBg}`}>
                        {icon}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badgeBg}`}>
                            {actionLabel}
                          </span>
                          <span className="text-xs font-semibold text-slate-500">
                            • {new Date(log.timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                          </span>
                        </div>

                        <p className="text-xs font-bold text-slate-800 leading-relaxed">
                          {log.details || 'No detailed log provided.'}
                        </p>

                        <div className="flex items-center gap-3 text-[11px] font-medium text-slate-500 pt-0.5 flex-wrap">
                          <span className="flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-semibold border border-slate-200">
                            <UserCheck className="h-3 w-3 text-slate-500" />
                            <span>{log.operator || log.operatorName || log.username || 'System'}</span>
                            {log.operatorRole && (
                              <span className="text-[10px] bg-slate-200 text-slate-800 px-1.5 rounded uppercase font-bold">
                                {log.operatorRole}
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* EDIT MODAL */}
      {editingChallan && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden space-y-4">
            <div className="bg-slate-900 text-white p-6 flex justify-between items-center">
              <div>
                <h3 className="text-base font-black">Edit Delivery Challan Details</h3>
                <p className="text-xs text-slate-400 mt-0.5">Modify buyer information or bill numbers for Challan #{editingChallan.challanNo}</p>
              </div>
              <button 
                onClick={() => setEditingChallan(null)} 
                className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4 font-sans text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                  Delivery Challan Number
                </label>
                <input
                  type="text"
                  value={editChallanNo}
                  onChange={(e) => setEditChallanNo(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 font-bold focus:border-cyan-500 outline-none uppercase"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                  Buyer Name
                </label>
                <input
                  type="text"
                  value={editBuyerName}
                  onChange={(e) => setEditBuyerName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 font-bold focus:border-cyan-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                  Buyer Contact Number
                </label>
                <input
                  type="text"
                  value={editBuyerContact}
                  onChange={(e) => setEditBuyerContact(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 font-bold focus:border-cyan-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                  Sales Bill Number
                </label>
                <input
                  type="text"
                  value={editBillNo}
                  onChange={(e) => setEditBillNo(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 font-bold focus:border-cyan-500 outline-none uppercase"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingChallan(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD ITEM TO CHALLAN MODAL */}
      {addItemModalTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden space-y-4">
            <div className="bg-slate-900 text-white p-6 flex justify-between items-center">
              <div>
                <h3 className="text-base font-black">Add Item to Delivery Challan</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Attach an unassigned Scooter, Battery, or Charger to Challan #{addItemModalTarget.challanNo}
                </p>
              </div>
              <button 
                onClick={() => { setAddItemModalTarget(null); setSelectedItemId(''); }} 
                className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAttachItem} className="p-6 space-y-4 font-sans text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                  Select Item Category
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => { setAddItemType('scooter'); setSelectedItemId(''); }}
                    className={`p-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer border ${
                      addItemType === 'scooter' ? 'bg-cyan-50 border-cyan-500 text-cyan-900 font-extrabold' : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <span>🛵 Scooter</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAddItemType('battery'); setSelectedItemId(''); }}
                    className={`p-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer border ${
                      addItemType === 'battery' ? 'bg-emerald-50 border-emerald-500 text-emerald-900 font-extrabold' : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <span>🔋 Battery</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAddItemType('charger'); setSelectedItemId(''); }}
                    className={`p-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer border ${
                      addItemType === 'charger' ? 'bg-purple-50 border-purple-500 text-purple-900 font-extrabold' : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <span>⚡ Charger</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                  Choose Item to Attach
                </label>
                {addItemType === 'scooter' && (
                  availableScooterOptions.length === 0 ? (
                    <p className="p-3 bg-amber-50 text-amber-800 rounded-xl text-xs border border-amber-200">
                      No unassigned available scooters found.
                    </p>
                  ) : (
                    <select
                      value={selectedItemId}
                      onChange={(e) => setSelectedItemId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 font-bold focus:border-cyan-500 outline-none"
                      required
                    >
                      <option value="">-- Select Available Scooter --</option>
                      {availableScooterOptions.map((s) => (
                        <option key={s.id} value={s.id}>
                          Chassis: {s.chassisNo} | Model: {s.modelName} ({s.color})
                        </option>
                      ))}
                    </select>
                  )
                )}

                {addItemType === 'battery' && (
                  availableBatteryOptions.length === 0 ? (
                    <p className="p-3 bg-amber-50 text-amber-800 rounded-xl text-xs border border-amber-200">
                      No unassigned standalone battery sales found.
                    </p>
                  ) : (
                    <select
                      value={selectedItemId}
                      onChange={(e) => setSelectedItemId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 font-bold focus:border-cyan-500 outline-none"
                      required
                    >
                      <option value="">-- Select Battery Sale/Hold --</option>
                      {availableBatteryOptions.map((b) => (
                        <option key={b.id} value={b.id}>
                          Series: {b.batterySeries} | Qty: {b.quantity} (Buyer: {b.buyerName})
                        </option>
                      ))}
                    </select>
                  )
                )}

                {addItemType === 'charger' && (
                  availableChargerOptions.length === 0 ? (
                    <p className="p-3 bg-amber-50 text-amber-800 rounded-xl text-xs border border-amber-200">
                      No unassigned standalone charger sales found.
                    </p>
                  ) : (
                    <select
                      value={selectedItemId}
                      onChange={(e) => setSelectedItemId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 font-bold focus:border-cyan-500 outline-none"
                      required
                    >
                      <option value="">-- Select Charger Sale/Hold --</option>
                      {availableChargerOptions.map((c) => (
                        <option key={c.id} value={c.id}>
                          Type: {c.chargerType} | Qty: {c.quantity} (Buyer: {c.buyerName})
                        </option>
                      ))}
                    </select>
                  )
                )}
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setAddItemModalTarget(null); setSelectedItemId(''); }}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !selectedItemId}
                  className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Attaching...' : 'Attach Item to Challan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINT MODAL */}
      {printChallan && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
            <div className="bg-slate-900 text-white p-4 flex justify-between items-center print:hidden">
              <span className="text-xs font-bold flex items-center gap-2">
                <Printer className="h-4 w-4 text-cyan-400" /> Print Delivery Challan Pass
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-cyan-600 text-white text-xs font-bold rounded-xl hover:bg-cyan-500 cursor-pointer"
                >
                  Print
                </button>
                <button
                  onClick={() => setPrintChallan(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Printable Pass */}
            <div className="p-8 space-y-6 font-sans text-slate-800">
              {/* Header Pass Title */}
              <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">SENZO EV WAREHOUSE</h2>
                  <p className="text-xs text-slate-500">Official Truck Dispatch Gate Pass & Delivery Challan</p>
                </div>
                <div className="text-right">
                  <span className="text-lg font-black text-cyan-900 block">CHALLAN #{printChallan.challanNo}</span>
                  <span className="text-xs text-slate-500">Date: {new Date(printChallan.date).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Consignee / Buyer</p>
                  <p className="font-bold text-slate-900 text-sm">{printChallan.buyerName}</p>
                  {printChallan.buyerContact && <p className="text-slate-600">Contact: {printChallan.buyerContact}</p>}
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Sales Bill Reference</p>
                  <p className="font-bold text-slate-900 text-sm">{printChallan.salesBillNo || 'N/A'}</p>
                  <p className="text-slate-600">Verification Status: <strong>{printChallan.status.toUpperCase()}</strong></p>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase text-slate-700 tracking-wider">Dispatched Cargo Manifest</h4>

                {printChallan.scooters.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold text-slate-600 mb-1">Scooter Vehicles ({printChallan.scooters.length} Units):</p>
                    <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
                      <thead className="bg-slate-100 text-[10px] font-bold uppercase">
                        <tr>
                          <th className="p-2">Model</th>
                          <th className="p-2">Color</th>
                          <th className="p-2">Chassis No</th>
                          <th className="p-2">Motor No</th>
                          <th className="p-2">Controller No</th>
                          <th className="p-2">Batteries</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {printChallan.scooters.map((s) => (
                          <tr key={s.id}>
                            <td className="p-2 font-bold">{s.modelName}</td>
                            <td className="p-2">{s.color}</td>
                            <td className="p-2 font-mono font-bold text-cyan-900">{s.chassisNo}</td>
                            <td className="p-2 text-[10px]">{s.motorNo}</td>
                            <td className="p-2 text-[10px]">{s.controllerNo}</td>
                            <td className="p-2 text-[10px] font-bold text-emerald-800">
                              {(s.batterySerials || []).join(', ') || 'None'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {printChallan.batteries.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold text-slate-600 mb-1">Standalone Battery Packs:</p>
                    <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
                      <thead className="bg-slate-100 text-[10px] font-bold uppercase">
                        <tr>
                          <th className="p-2">Series</th>
                          <th className="p-2">Quantity</th>
                          <th className="p-2">Serial Numbers / Barcodes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {printChallan.batteries.map((b) => {
                          const serialGroup = groupSerialsIntoRangesAndIndividuals(
                            b.serialNumbers,
                            b.startNo,
                            b.endNo,
                            b.quantity,
                            b.batterySeries
                          );

                          return (
                            <tr key={b.id}>
                              <td className="p-2 font-bold">{b.batterySeries}</td>
                              <td className="p-2 font-black text-emerald-700">{b.quantity} {b.quantity === 1 ? 'Unit' : 'Units'}</td>
                              <td className="p-2 text-[10px] font-mono">
                                {serialGroup.allSerials.length > 0 ? (
                                  <div className="space-y-1">
                                    {serialGroup.ranges.length > 0 && (
                                      <div className="font-bold text-slate-800">
                                        In Series: {serialGroup.ranges.map(r => `${r.text} (${r.count} ${r.count === 1 ? 'Unit' : 'Units'})`).join(', ')}
                                      </div>
                                    )}
                                    {serialGroup.standalone.length > 0 && (
                                      <div className="font-bold text-amber-800">
                                        Individual: {serialGroup.standalone.join(', ')}
                                      </div>
                                    )}
                                    <div className="leading-relaxed bg-slate-50 p-1.5 rounded border border-slate-200 font-bold text-slate-700 mt-1">
                                      {serialGroup.allSerials.join(', ')}
                                    </div>
                                  </div>
                                ) : (
                                  `Bulk Batch (${b.quantity} ${b.quantity === 1 ? 'Unit' : 'Units'})`
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {printChallan.chargers.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold text-slate-600 mb-1">Standalone Chargers:</p>
                    <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
                      <thead className="bg-slate-100 text-[10px] font-bold uppercase">
                        <tr>
                          <th className="p-2">Charger Type</th>
                          <th className="p-2">Quantity</th>
                          <th className="p-2">Serial Numbers / Barcodes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {printChallan.chargers.map((c) => {
                          const serialGroup = groupSerialsIntoRangesAndIndividuals(
                            c.serialNumbers,
                            c.startNo,
                            c.endNo,
                            c.quantity,
                            c.chargerType
                          );

                          return (
                            <tr key={c.id}>
                              <td className="p-2 font-bold">{c.chargerType}</td>
                              <td className="p-2 font-black text-purple-700">{c.quantity} {c.quantity === 1 ? 'Unit' : 'Units'}</td>
                              <td className="p-2 text-[10px] font-mono">
                                <div className="space-y-1">
                                  {serialGroup.ranges.length > 0 && (
                                    <div className="font-bold text-slate-800">
                                      In Series: {serialGroup.ranges.map(r => `${r.text} (${r.count} ${r.count === 1 ? 'Unit' : 'Units'})`).join(', ')}
                                    </div>
                                  )}
                                  {serialGroup.standalone.length > 0 && (
                                    <div className="font-bold text-amber-800">
                                      Individual: {serialGroup.standalone.join(', ')}
                                    </div>
                                  )}
                                  <div className="leading-relaxed bg-slate-50 p-1.5 rounded border border-slate-200 font-bold text-slate-700 mt-1">
                                    {serialGroup.allSerials.join(', ')}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Signatures */}
              <div className="pt-12 grid grid-cols-2 gap-8 text-xs font-bold text-slate-500">
                <div className="border-t border-slate-300 pt-2 text-center">
                  <span>Authorized Warehouse Manager Signature</span>
                </div>
                <div className="border-t border-slate-300 pt-2 text-center">
                  <span>Truck Driver / Recipient Signature</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Finish & Verify Confirmation Modal */}
      {finishConfirmationTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 font-sans space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-3 text-emerald-600">
              <div className="p-3 bg-emerald-100 rounded-2xl shrink-0">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Finish &amp; Verify Sale?
                </h3>
                <p className="text-xs text-slate-500 font-medium">Delivery Challan Verification</p>
              </div>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-xs text-emerald-900 space-y-2">
              <p className="font-bold">
                Are you sure you want to Mark Sale as Finished &amp; Verified for Challan #{finishConfirmationTarget.challanNo}?
              </p>
              <p className="text-emerald-800 leading-relaxed font-medium">
                Once verified, managers cannot edit this sale. Only Admin/Owner can make modifications.
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600 space-y-1">
              <div className="flex justify-between font-semibold">
                <span>Buyer Name:</span>
                <span className="text-slate-900 font-bold">{finishConfirmationTarget.buyerName}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Challan Number:</span>
                <span className="font-mono font-bold text-cyan-800">#{finishConfirmationTarget.challanNo}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Items Included:</span>
                <span className="text-slate-900 font-bold">{finishConfirmationTarget.totalItemsCount} Total Items</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setFinishConfirmationTarget(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleFinishChallan(finishConfirmationTarget)}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold text-xs rounded-xl cursor-pointer transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>{isSubmitting ? 'Verifying...' : 'Yes, Finish & Verify Sale'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmationTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 font-sans space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-3 bg-rose-100 rounded-2xl shrink-0">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  {deleteConfirmationTarget.type === 'entire' ? 'Delete Entire Delivery Challan?' : 'Remove Item from Challan?'}
                </h3>
                <p className="text-xs text-slate-500 font-medium">Permission &amp; Confirmation Required</p>
              </div>
            </div>

            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs text-rose-900 space-y-2">
              {deleteConfirmationTarget.type === 'entire' ? (
                <>
                  <p className="font-bold">
                    ⚠️ You are about to DELETE the ENTIRE Delivery Challan #{deleteConfirmationTarget.challanNo}.
                  </p>
                  <p className="text-rose-800 leading-relaxed font-medium">
                    This action will unassign all scooters, batteries, and chargers from this challan and reset their inventory status back to available.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-bold">
                    You are about to remove this {deleteConfirmationTarget.itemType} {deleteConfirmationTarget.itemLabel ? `(${deleteConfirmationTarget.itemLabel})` : ''} from Delivery Challan #{deleteConfirmationTarget.challanNo}.
                  </p>
                  <p className="text-rose-800 leading-relaxed font-medium">
                    The item will be detached and returned to available inventory.
                  </p>
                </>
              )}
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600 space-y-1">
              <div className="flex justify-between font-semibold">
                <span>Requested By:</span>
                <span className="text-slate-900 font-bold">{currentUser.name || currentUser.username} ({currentUser.role || 'operator'})</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Target Challan:</span>
                <span className="font-mono font-bold text-cyan-800">#{deleteConfirmationTarget.challanNo}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setDeleteConfirmationTarget(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={executeDeleteAction}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-extrabold text-xs rounded-xl cursor-pointer transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                <span>{isSubmitting ? 'Deleting...' : 'Yes, Confirm Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PER-CHALLAN AUDIT LOG MODAL */}
      {selectedChallanAuditModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 font-sans space-y-4 max-h-[85vh] flex flex-col animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-2xl">
                  <History className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight">
                    Audit Trail: Delivery Challan #{selectedChallanAuditModal}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">Historical Log of Modifications &amp; Item Changes</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedChallanAuditModal(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-3 flex-1 pr-1">
              {getModalChallanLogs(selectedChallanAuditModal).length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <FileClock className="h-10 w-10 text-slate-300 mx-auto" />
                  <p className="text-xs font-bold text-slate-600">No specific historical logs found for Challan #{selectedChallanAuditModal}</p>
                  <p className="text-[11px] text-slate-400">Future changes made to this challan will automatically appear here.</p>
                </div>
              ) : (
                getModalChallanLogs(selectedChallanAuditModal).map((log) => {
                  const action = (log.action || '').toLowerCase();
                  const isAttach = action.includes('attach') || (log.details || '').toLowerCase().includes('attached');
                  const isRemove = action.includes('remove') || (log.details || '').toLowerCase().includes('removed');
                  const isFinish = action.includes('finish') || (log.details || '').toLowerCase().includes('finished');

                  let badgeBg = 'bg-slate-100 text-slate-800 border-slate-200';
                  if (isAttach) badgeBg = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                  else if (isRemove) badgeBg = 'bg-rose-50 text-rose-800 border-rose-200';
                  else if (isFinish) badgeBg = 'bg-emerald-100 text-emerald-900 border-emerald-300';

                  return (
                    <div key={log.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold border ${badgeBg}`}>
                          {log.action}
                        </span>
                        <span className="font-mono text-slate-400">
                          {new Date(log.timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                        </span>
                      </div>
                      <p className="font-bold text-slate-800 leading-relaxed">
                        {log.details || 'No detailed log.'}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 pt-1 font-semibold">
                        <UserCheck className="h-3 w-3 text-slate-400" />
                        <span>Changed by <strong className="text-slate-800">{log.operator || log.operatorName || log.username}</strong> ({log.operatorRole || 'User'})</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedChallanAuditModal(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl cursor-pointer"
              >
                Close Log
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


