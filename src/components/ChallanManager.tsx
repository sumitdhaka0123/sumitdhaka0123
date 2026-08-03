import { getApiBaseUrl } from '../utils/apiConfig';
import React, { useState, useMemo, useEffect } from 'react';
import { groupSerialsIntoRangesAndIndividuals, generateSerialRangeHelper } from '../utils/serialUtils';
import { 
  ScooterUnit, 
  BatterySale, 
  ChargerSale, 
  Buyer, 
  User,
  AuditLog,
  SalesOrder,
  SalesOrderItem,
  Product
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
  Tag,
  MapPin,
  Minus,
  Save,
  Check
} from 'lucide-react';

interface ChallanManagerProps {
  products: Product[];
  scooterUnits: ScooterUnit[];
  batterySales: BatterySale[];
  chargerSales: ChargerSale[];
  buyers: Buyer[];
  currentUser: User;
  salesOrders?: SalesOrder[];
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

export interface DisplayOrderChallan {
  id: string;
  isSalesOrder: boolean;
  originalOrder?: SalesOrder;
  orderNo?: string;
  challanNo: string;
  salesBillNo: string;
  buyerName: string;
  buyerContact: string;
  deliveryLocation: string;
  salespersonName: string;
  date: string;
  status: 'pending' | 'prepared' | 'dispatched' | 'challan_generated' | 'cancelled';
  isFinished: boolean;
  items: SalesOrderItem[];
  groupedRepresentation: GroupedChallan;
}

function salesOrderToGroupedChallan(order: SalesOrder, allScooters: ScooterUnit[] = []): GroupedChallan {
  const scooters: ScooterUnit[] = [];
  const batteries: BatterySale[] = [];
  const chargers: ChargerSale[] = [];
  let totalItemsCount = 0;

  (order.items || []).forEach(it => {
    totalItemsCount += (it.quantity || 1);
    if (it.itemType === 'scooter') {
      const count = it.quantity || (it.chassisNumbers ? it.chassisNumbers.length : 1);
      for (let i = 0; i < count; i++) {
        const chassis = (it.chassisNumbers && it.chassisNumbers[i]) || `SLOT-${i+1}`;
        const realScooter = allScooters.find(u => u.chassisNo === chassis);
        scooters.push({
          id: `${order.id}-scoot-${i}`,
          modelName: it.productName || 'Scooter',
          color: it.color || 'Standard',
          chassisNo: chassis,
          motorNo: realScooter?.motorNo || 'N/A',
          controllerNo: realScooter?.controllerNo || 'N/A',
          tireSize: realScooter?.tireSize || '10-inch',
          batterySerials: realScooter?.batterySerials?.length ? realScooter.batterySerials : (it.serialNumbers || []),
          status: order.status === 'challan_generated' ? 'sold' : 'hold',
          scooterWarrantyStatus: realScooter?.scooterWarrantyStatus || 'None',
          batteryWarrantyStatus: realScooter?.batteryWarrantyStatus || 'None',
          buyerName: order.buyerName,
          buyerContact: order.buyerContact,
          deliveryChallanNo: order.challanNo,
          salesBillNo: order.salesBillNo,
          createdOperator: order.salespersonName || 'sales',
          createdTimestamp: order.createdTimestamp,
          lastUpdatedTimestamp: order.createdTimestamp
        });
      }
    } else if (it.itemType === 'battery') {
      batteries.push({
        id: `${order.id}-bat`,
        buyerName: order.buyerName,
        buyerContact: order.buyerContact,
        batterySeries: it.batteryType || it.productName || 'Battery',
        startNo: it.startNo || '',
        endNo: it.endNo || '',
        quantity: it.quantity || 1,
        saleDate: order.createdTimestamp.split('T')[0],
        operator: order.salespersonName || 'sales',
        deliveryChallanNo: order.challanNo,
        billNo: order.salesBillNo,
        serialNumbers: it.serialNumbers || [],
        isUnderWarranty: it.isUnderWarranty,
        warrantyDurationMonths: it.warrantyMonths
      });
    } else if (it.itemType === 'charger') {
      chargers.push({
        id: `${order.id}-chg`,
        buyerName: order.buyerName,
        buyerContact: order.buyerContact,
        chargerType: it.chargerType || it.productName || 'Charger',
        startNo: it.startNo || '',
        endNo: it.endNo || '',
        quantity: it.quantity || 1,
        saleDate: order.createdTimestamp.split('T')[0],
        operator: order.salespersonName || 'sales',
        deliveryChallanNo: order.challanNo,
        billNo: order.salesBillNo,
        serialNumbers: it.serialNumbers || [],
        isUnderWarranty: it.isUnderWarranty,
        warrantyDurationMonths: it.warrantyMonths
      });
    }
  });

  return {
    challanNo: order.challanNo || order.orderNo,
    buyerName: order.buyerName,
    buyerContact: order.buyerContact || '',
    salesBillNo: order.salesBillNo || '',
    status: order.status === 'challan_generated' ? 'finished' : 'pending',
    finishedBy: order.challanFinishedBy,
    finishedTimestamp: order.challanFinishedTimestamp,
    date: order.createdTimestamp,
    scooters,
    batteries,
    chargers,
    totalItemsCount
  };
}

export const ChallanManager: React.FC<ChallanManagerProps> = ({
  scooterUnits,
  batterySales,
  chargerSales,
  buyers,
  currentUser,
  salesOrders = [],
  products = [],
  onRefresh
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'finished'>('all');
  const [expandedChallans, setExpandedChallans] = useState<Record<string, boolean>>({});

  // Submitting & status message
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Print modal state
  const [printChallan, setPrintChallan] = useState<GroupedChallan | null>(null);

  // Manager Sales Order / Challan Editor Modal State
  const [editingOrder, setEditingOrder] = useState<SalesOrder | null>(null);
  const [soBuyerName, setSoBuyerName] = useState('');
  const [soBuyerContact, setSoBuyerContact] = useState('');
  const [soDeliveryLocation, setSoDeliveryLocation] = useState('');
  const [soChallanNo, setSoChallanNo] = useState('');
  const [soSalesBillNo, setSoSalesBillNo] = useState('');
  const [soNotes, setSoNotes] = useState('');
  const [soItems, setSoItems] = useState<SalesOrderItem[]>([]);

  // Legacy Challan Edit Modal State
  const [editingChallan, setEditingChallan] = useState<GroupedChallan | null>(null);
  const [editBuyerName, setEditBuyerName] = useState('');
  const [editBuyerContact, setEditBuyerContact] = useState('');
  const [editBillNo, setEditBillNo] = useState('');
  const [editChallanNo, setEditChallanNo] = useState('');

  // Delete confirmation modal state
  const [deleteConfirmationTarget, setDeleteConfirmationTarget] = useState<{
    type: 'entire' | 'item';
    challanNo: string;
    itemType?: 'scooter' | 'battery' | 'charger';
    itemId?: string;
    itemLabel?: string;
  } | null>(null);

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
      const res = await fetch(getApiBaseUrl() + '/api/audit-logs');
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
      const isChallanRelated = action.includes('challan') || details.includes('challan') || details.includes('delivery') || details.includes('order');
      if (!isChallanRelated) return false;

      // Action type filter
      if (auditActionFilter === 'attach' && !action.includes('attach') && !details.includes('attached')) return false;
      if (auditActionFilter === 'remove' && !action.includes('remove') && !details.includes('removed')) return false;
      if (auditActionFilter === 'update' && !action.includes('update') && !details.includes('updated')) return false;
      if (auditActionFilter === 'finish' && !action.includes('finish') && !details.includes('finished') && !details.includes('verified')) return false;
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

  // Group standalone items by Delivery Challan Number
  const legacyGroupedChallans = useMemo(() => {
    const map = new Map<string, GroupedChallan>();

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

    return Array.from(map.values());
  }, [scooterUnits, batterySales, chargerSales]);

  // Unified List of Dispatches & Challans
  const displayOrdersAndChallans = useMemo<DisplayOrderChallan[]>(() => {
    const list: DisplayOrderChallan[] = [];

    // 1. Convert Sales Orders
    (salesOrders || []).forEach(order => {
      if (order.status === 'cancelled') return;
      const isFinished = order.status === 'challan_generated' || (!!order.challanNo && !!order.salesBillNo);
      list.push({
        id: order.id,
        isSalesOrder: true,
        originalOrder: order,
        orderNo: order.orderNo,
        challanNo: order.challanNo || order.orderNo,
        salesBillNo: order.salesBillNo || '',
        buyerName: order.buyerName,
        buyerContact: order.buyerContact || '',
        deliveryLocation: order.deliveryLocation || '',
        salespersonName: order.salespersonName || '',
        date: order.createdTimestamp,
        status: order.status,
        isFinished,
        items: order.items || [],
        groupedRepresentation: salesOrderToGroupedChallan(order, scooterUnits)
      });
    });

    // 2. Add legacy grouped challans if not matching a sales order
    legacyGroupedChallans.forEach(g => {
      if (!list.some(item => item.challanNo.toUpperCase() === g.challanNo.toUpperCase())) {
        list.push({
          id: `legacy-${g.challanNo}`,
          isSalesOrder: false,
          challanNo: g.challanNo,
          salesBillNo: g.salesBillNo,
          buyerName: g.buyerName,
          buyerContact: g.buyerContact,
          deliveryLocation: '',
          salespersonName: '',
          date: g.date,
          status: g.status === 'finished' ? 'challan_generated' : 'dispatched',
          isFinished: g.status === 'finished',
          items: [],
          groupedRepresentation: g
        });
      }
    });

    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [salesOrders, legacyGroupedChallans]);

  // Filtered List
  const filteredDisplayList = useMemo(() => {
    return displayOrdersAndChallans.filter(item => {
      if (statusFilter === 'pending' && item.isFinished) return false;
      if (statusFilter === 'finished' && !item.isFinished) return false;

      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase().trim();
      return (
        item.challanNo.toLowerCase().includes(q) ||
        (item.orderNo || '').toLowerCase().includes(q) ||
        item.buyerName.toLowerCase().includes(q) ||
        item.salesBillNo.toLowerCase().includes(q) ||
        (item.deliveryLocation || '').toLowerCase().includes(q) ||
        item.items.some(it => (it.productName || '').toLowerCase().includes(q) || (it.chassisNumbers || []).some(c => c.toLowerCase().includes(q)))
      );
    });
  }, [displayOrdersAndChallans, statusFilter, searchTerm]);

  // Metrics
  const metrics = useMemo(() => {
    const totalCount = displayOrdersAndChallans.length;
    const pendingCount = displayOrdersAndChallans.filter(d => !d.isFinished).length;
    const finishedCount = displayOrdersAndChallans.filter(d => d.isFinished).length;
    
    let totalItems = 0;
    displayOrdersAndChallans.forEach(d => {
      totalItems += d.groupedRepresentation.totalItemsCount;
    });

    return { totalCount, pendingCount, finishedCount, totalItems };
  }, [displayOrdersAndChallans]);

  // Helper to close and reset editor modal states
  const closeAndResetEditModal = () => {
    setEditingOrder(null);
    setSoBuyerName('');
    setSoBuyerContact('');
    setSoDeliveryLocation('');
    setSoChallanNo('');
    setSoSalesBillNo('');
    setSoNotes('');
    setSoItems([]);
  };

  // Open Sales Order Manager Editor
  const handleOpenSalesOrderEdit = (order: SalesOrder) => {
    setEditingOrder(order);
    setSoBuyerName(order.buyerName || '');
    setSoBuyerContact(order.buyerContact || '');
    setSoDeliveryLocation(order.deliveryLocation || '');
    setSoChallanNo(order.challanNo || '');
    setSoSalesBillNo(order.salesBillNo || '');
    setSoNotes(order.notes || '');
    setSoItems(JSON.parse(JSON.stringify(order.items || [])));
  };

  // Save Sales Order
  const handleSaveSalesOrder = async (finalizeSale: boolean) => {
    if (!editingOrder) return;

    if (finalizeSale) {
      if (!soChallanNo || !soChallanNo.trim()) {
        setStatusMessage({
          type: 'error',
          text: 'Delivery Challan Number is required to finalize sale. Never sell without a Challan Number!'
        });
        return;
      }
      if (!soSalesBillNo || !soSalesBillNo.trim()) {
        setStatusMessage({
          type: 'error',
          text: 'Bill / Invoice Number is required to finalize sale.'
        });
        return;
      }
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const res = await fetch(getApiBaseUrl() + `/api/sales-orders/${editingOrder.id}/manager-update`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyerName: soBuyerName.trim(),
          buyerContact: soBuyerContact.trim(),
          deliveryLocation: soDeliveryLocation.trim(),
          notes: soNotes,
          challanNo: soChallanNo.trim().toUpperCase(),
          salesBillNo: soSalesBillNo.trim().toUpperCase(),
          items: soItems,
          finalizeSale,
          operator: currentUser.name || currentUser.username,
          operatorRole: currentUser.role
        })
      });

      const data = await res.json();
      if (res.ok) {
        setStatusMessage({
          type: 'success',
          text: finalizeSale 
            ? `Sale finalized & Delivery Challan #${soChallanNo.trim().toUpperCase()} issued successfully!`
            : `Order #${editingOrder.orderNo} progress saved successfully!`
        });
        closeAndResetEditModal();
        onRefresh();
        fetchAuditLogs();
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Failed to update order.' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Network error updating order.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper functions for updating soItems in editor
  const updateItemQuantity = (index: number, newQty: number) => {
    const qty = Math.max(1, newQty);
    setSoItems(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], quantity: qty };
      if (copy[index].itemType === 'scooter') {
        const chassisArr = [...(copy[index].chassisNumbers || [])];
        if (chassisArr.length < qty) {
          while (chassisArr.length < qty) chassisArr.push('');
        }
        copy[index].chassisNumbers = chassisArr;
      }
      return copy;
    });
  };

  const updateItemField = (index: number, field: keyof SalesOrderItem, value: any) => {
    setSoItems(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const updateChassisNumber = (itemIdx: number, chassisIdx: number, val: string) => {
    setSoItems(prev => {
      const copy = [...prev];
      const item = { ...copy[itemIdx] };
      const chassisArr = [...(item.chassisNumbers || [])];
      chassisArr[chassisIdx] = val;
      item.chassisNumbers = chassisArr;
      copy[itemIdx] = item;
      return copy;
    });
  };

  const addChassisSlot = (itemIdx: number) => {
    setSoItems(prev => {
      const copy = [...prev];
      const item = { ...copy[itemIdx] };
      const chassisArr = [...(item.chassisNumbers || []), ''];
      item.chassisNumbers = chassisArr;
      item.quantity = chassisArr.length;
      copy[itemIdx] = item;
      return copy;
    });
  };

  const removeChassisSlot = (itemIdx: number, chassisIdx: number) => {
    setSoItems(prev => {
      const copy = [...prev];
      const item = { ...copy[itemIdx] };
      const chassisArr = [...(item.chassisNumbers || [])];
      chassisArr.splice(chassisIdx, 1);
      item.chassisNumbers = chassisArr;
      if (chassisArr.length > 0) item.quantity = chassisArr.length;
      copy[itemIdx] = item;
      return copy;
    });
  };

  const removeItemLine = (index: number) => {
    setSoItems(prev => prev.filter((_, i) => i !== index));
  };

  const addNewItemLine = () => {
    setSoItems(prev => [
      ...prev,
      {
        id: `soi-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        itemType: 'scooter',
        productName: 'City XL',
        color: 'Matte Black',
        quantity: 1,
        chassisNumbers: [''],
        serialNumbers: [],
        startNo: '',
        endNo: '',
        isUnderWarranty: false,
        warrantyMonths: 0
      }
    ]);
  };

  const toggleExpand = (id: string) => {
    setExpandedChallans(prev => ({ ...prev, [id]: !prev[id] }));
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
            Review truck dispatches and bulk sales orders. 
            Managers assign mandatory Challan &amp; Bill Numbers, adjust last-minute item quantities, update chassis and serial numbers, and finalize bulk sales.
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
            <span>Delivery Challans &amp; Orders ({displayOrdersAndChallans.length})</span>
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
          <span>Refresh Data</span>
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
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Total Sales &amp; Dispatches</p>
                <p className="text-xl font-black text-slate-800">{metrics.totalCount}</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
              <div className="p-3 rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
                <Clock className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Pending Challan &amp; Bill</p>
                <p className="text-xl font-black text-amber-700">{metrics.pendingCount}</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
              <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Finished &amp; Issued</p>
                <p className="text-xl font-black text-emerald-700">{metrics.finishedCount}</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
              <div className="p-3 rounded-xl bg-purple-50 text-purple-600 border border-purple-100">
                <Zap className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Total Dispatched Units</p>
                <p className="text-xl font-black text-purple-900">{metrics.totalItems}</p>
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
                placeholder="Search Order No, Challan No, Buyer, Bill No, Chassis..."
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
                All ({displayOrdersAndChallans.length})
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
                <span>Finished &amp; Verified ({metrics.finishedCount})</span>
              </button>
            </div>
          </div>

          {/* List of Orders & Delivery Challans */}
          <div className="space-y-4">
            {filteredDisplayList.length === 0 ? (
              <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-3">
                <Truck className="h-12 w-12 text-slate-300 mx-auto" />
                <h3 className="text-sm font-bold text-slate-700">No Dispatches or Challans Found</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  No orders match your search or filter options. Dispatched sales orders created by salespeople or dispatchers will appear here for manager verification.
                </p>
              </div>
            ) : (
              filteredDisplayList.map((item) => {
                const isExpanded = !!expandedChallans[item.id];
                const isFinished = item.isFinished;
                const isOwner = currentUser.role === 'admin' || currentUser.role === 'owner';
                const canEdit = !isFinished || isOwner;

                return (
                  <div 
                    key={item.id}
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
                            {item.orderNo && (
                              <span className="text-base font-black text-slate-900 tracking-tight">
                                Order #{item.orderNo}
                              </span>
                            )}

                            <span className="font-mono text-xs font-bold text-cyan-800 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200">
                              Challan #: {item.challanNo}
                            </span>

                            {isFinished ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                <span>Sale Finished &amp; Issued</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                                <Clock className="h-3 w-3 text-amber-600 animate-spin" />
                                <span>Awaiting Manager Challan &amp; Bill No</span>
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-4 text-xs font-semibold text-slate-500 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Building2 className="h-3.5 w-3.5 text-slate-400" />
                              <strong className="text-slate-800">{item.buyerName}</strong>
                              {item.buyerContact && ` (${item.buyerContact})`}
                            </span>

                            {item.deliveryLocation && (
                              <span className="flex items-center gap-1 text-slate-600">
                                <MapPin className="h-3.5 w-3.5 text-slate-400" />
                                <span>{item.deliveryLocation}</span>
                              </span>
                            )}

                            {item.salesBillNo ? (
                              <span className="flex items-center gap-1">
                                <FileText className="h-3.5 w-3.5 text-slate-400" />
                                <span>Bill #: <strong className="text-slate-800">{item.salesBillNo}</strong></span>
                              </span>
                            ) : (
                              <span className="text-amber-700 text-[11px] font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                ⚠️ Missing Bill No
                              </span>
                            )}

                            <span className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5 text-slate-400" />
                              <span>{new Date(item.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                            </span>
                          </div>

                          {/* Items Summary */}
                          <div className="flex items-center gap-2 pt-1 font-sans text-[11px] font-bold flex-wrap">
                            {item.groupedRepresentation.scooters.length > 0 && (
                              <span className="px-2.5 py-0.5 rounded-md bg-cyan-50 text-cyan-800 border border-cyan-200">
                                🛵 {item.groupedRepresentation.scooters.length} Scooters
                              </span>
                            )}
                            {item.groupedRepresentation.batteries.length > 0 && (
                              <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                                🔋 {item.groupedRepresentation.batteries.reduce((a, b) => a + b.quantity, 0)} Batteries
                              </span>
                            )}
                            {item.groupedRepresentation.chargers.length > 0 && (
                              <span className="px-2.5 py-0.5 rounded-md bg-purple-50 text-purple-800 border border-purple-200">
                                ⚡ {item.groupedRepresentation.chargers.reduce((a, c) => a + c.quantity, 0)} Chargers
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => setPrintChallan(item.groupedRepresentation)}
                          className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                          title="Print Official Delivery Challan Pass"
                        >
                          <Printer className="h-4 w-4" />
                          <span>Print Pass</span>
                        </button>

                        <button
                          onClick={() => setSelectedChallanAuditModal(item.challanNo)}
                          className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                          title="View modification audit trail"
                        >
                          <History className="h-4 w-4 text-indigo-600" />
                          <span>Audit Trail</span>
                        </button>

                        {canEdit && item.isSalesOrder && item.originalOrder ? (
                          <button
                            onClick={() => handleOpenSalesOrderEdit(item.originalOrder!)}
                            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                          >
                            <Edit3 className="h-4 w-4 text-cyan-400" />
                            <span>Edit Order &amp; Challan</span>
                          </button>
                        ) : canEdit && !item.isSalesOrder ? (
                          <button
                            onClick={() => {
                              setEditingChallan(item.groupedRepresentation);
                              setEditBuyerName(item.buyerName);
                              setEditBuyerContact(item.buyerContact);
                              setEditBillNo(item.salesBillNo);
                              setEditChallanNo(item.challanNo);
                            }}
                            className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Edit3 className="h-4 w-4" />
                            <span>Edit Details</span>
                          </button>
                        ) : (
                          <span className="px-3 py-2 bg-slate-100 text-slate-400 text-[10px] font-bold rounded-xl flex items-center gap-1 cursor-not-allowed">
                            <Lock className="h-3.5 w-3.5" />
                            <span>Verified (Owner Lock)</span>
                          </span>
                        )}

                        <button
                          onClick={() => toggleExpand(item.id)}
                          className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-600 cursor-pointer"
                          title="Toggle Breakdown Details"
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Expanded Details Breakdown */}
                    {isExpanded && (
                      <div className="border-t border-slate-100 p-4 sm:p-6 bg-slate-50/50 rounded-b-2xl space-y-5">
                        {item.groupedRepresentation.scooters.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-xs font-black text-cyan-900 uppercase tracking-wide flex items-center gap-2">
                              <span>🛵 Scooter Units ({item.groupedRepresentation.scooters.length})</span>
                            </h4>
                            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                              <table className="w-full text-left text-xs">
                                <thead className="bg-slate-100 text-slate-600 text-[10px] font-bold uppercase">
                                  <tr>
                                    <th className="p-2.5">Model &amp; Color</th>
                                    <th className="p-2.5">Chassis Number</th>
                                    <th className="p-2.5">Motor / Controller</th>
                                    <th className="p-2.5">Batteries &amp; Charger</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                                  {item.groupedRepresentation.scooters.map((scoot, sIdx) => (
                                    <tr key={scoot.id || sIdx} className="hover:bg-slate-50">
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
                                      <td className="p-2.5 text-[11px]">
                                        {scoot.batterySerials && scoot.batterySerials.length > 0 ? (
                                          <span className="text-[10px] font-bold text-slate-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                            🔋 Serials: {scoot.batterySerials.join(', ')}
                                          </span>
                                        ) : (
                                          <span className="text-slate-400 italic">No battery serials linked</span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {item.groupedRepresentation.batteries.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-xs font-black text-emerald-900 uppercase tracking-wide">
                              🔋 Standalone Batteries ({item.groupedRepresentation.batteries.reduce((a, b) => a + b.quantity, 0)})
                            </h4>
                            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                              <table className="w-full text-left text-xs">
                                <thead className="bg-slate-100 text-slate-600 text-[10px] font-bold uppercase">
                                  <tr>
                                    <th className="p-2.5">Battery Series</th>
                                    <th className="p-2.5">Quantity</th>
                                    <th className="p-2.5">Serials</th>
                                    <th className="p-2.5">Warranty</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                                  {item.groupedRepresentation.batteries.map((bat, bIdx) => (
                                    <tr key={bat.id || bIdx} className="hover:bg-slate-50">
                                      <td className="p-2.5 font-bold">{bat.batterySeries}</td>
                                      <td className="p-2.5 font-black text-emerald-800 bg-emerald-50/70 rounded-lg">
                                        {bat.quantity} Units
                                      </td>
                                      <td className="p-2.5 font-mono text-[11px]">
                                        {bat.serialNumbers && bat.serialNumbers.length > 0 
                                          ? bat.serialNumbers.join(', ') 
                                          : (bat.startNo ? `${bat.startNo} to ${bat.endNo}` : 'Bulk Batch')}
                                      </td>
                                      <td className="p-2.5 text-[11px]">
                                        {bat.isUnderWarranty ? `${bat.warrantyDurationMonths || 12} Months` : 'No Warranty'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {item.groupedRepresentation.chargers.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-xs font-black text-purple-900 uppercase tracking-wide">
                              ⚡ Standalone Chargers ({item.groupedRepresentation.chargers.reduce((a, c) => a + c.quantity, 0)})
                            </h4>
                            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                              <table className="w-full text-left text-xs">
                                <thead className="bg-slate-100 text-slate-600 text-[10px] font-bold uppercase">
                                  <tr>
                                    <th className="p-2.5">Charger Type</th>
                                    <th className="p-2.5">Quantity</th>
                                    <th className="p-2.5">Serials</th>
                                    <th className="p-2.5">Warranty</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                                  {item.groupedRepresentation.chargers.map((chg, cIdx) => (
                                    <tr key={chg.id || cIdx} className="hover:bg-slate-50">
                                      <td className="p-2.5 font-bold">{chg.chargerType}</td>
                                      <td className="p-2.5 font-black text-purple-800 bg-purple-50/70 rounded-lg">
                                        {chg.quantity} Units
                                      </td>
                                      <td className="p-2.5 font-mono text-[11px]">
                                        {chg.serialNumbers && chg.serialNumbers.length > 0 
                                          ? chg.serialNumbers.join(', ') 
                                          : (chg.startNo ? `${chg.startNo} to ${chg.endNo}` : 'Bulk Batch')}
                                      </td>
                                      <td className="p-2.5 text-[11px]">
                                        {chg.isUnderWarranty ? `${chg.warrantyDurationMonths || 12} Months` : 'No Warranty'}
                                      </td>
                                    </tr>
                                  ))}
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

      {/* Audit Trail Tab */}
      {activeTab === 'audit_trail' && (
        <div className="space-y-4 font-sans">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 justify-between items-center">
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
                onClick={() => setAuditActionFilter('finish')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                  auditActionFilter === 'finish' ? 'bg-indigo-50 text-indigo-900 border border-indigo-200 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-indigo-600" />
                <span>Verified</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
            {challanAuditLogs.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <FileClock className="h-10 w-10 text-slate-300 mx-auto" />
                <p className="text-xs font-bold text-slate-600">No Challan audit logs found</p>
              </div>
            ) : (
              challanAuditLogs.map(log => (
                <div key={log.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold bg-indigo-50 text-indigo-900 border border-indigo-200">
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
                    <span>By <strong className="text-slate-800">{log.operator || log.operatorName || log.username}</strong> ({log.operatorRole || 'User'})</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* MANAGER SALES ORDER & CHALLAN EDITOR MODAL */}
      {editingOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in duration-150">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-5 sm:p-6 flex items-center justify-between shrink-0 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-cyan-500/20 border border-cyan-400/30 text-cyan-400 rounded-2xl">
                  <Truck className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
                      Manager Order &amp; Delivery Challan Editor
                    </h3>
                    <span className="bg-cyan-500/20 text-cyan-300 font-mono text-xs px-2 py-0.5 rounded font-bold border border-cyan-400/30">
                      #{editingOrder.orderNo}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 font-medium">
                    Adjust quantities, edit chassis/serials, and assign mandatory Challan &amp; Bill Numbers to finish sale.
                  </p>
                </div>
              </div>
              <button 
                onClick={closeAndResetEditModal} 
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form Body */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              
              {/* SECTION 1: MANDATORY CHALLAN & BILL NUMBER */}
              <div className="bg-gradient-to-r from-cyan-950 via-slate-900 to-slate-900 text-white p-4 sm:p-5 rounded-2xl space-y-3 shadow-sm border border-cyan-800/40">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-cyan-400" />
                  <h4 className="font-extrabold text-sm text-cyan-200">
                    Mandatory Sales &amp; Delivery Documents
                  </h4>
                  <span className="text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ml-auto">
                    Required For Sale
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wide mb-1">
                      Delivery Challan Number <span className="text-cyan-400">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. CH-2026-001"
                      value={soChallanNo}
                      onChange={(e) => setSoChallanNo(e.target.value)}
                      className="w-full bg-slate-800/90 border border-slate-700 rounded-xl p-3 text-white font-bold text-sm focus:border-cyan-400 outline-none uppercase font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wide mb-1">
                      Sales Bill / Invoice Number <span className="text-cyan-400">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. INV-9001"
                      value={soSalesBillNo}
                      onChange={(e) => setSoSalesBillNo(e.target.value)}
                      className="w-full bg-slate-800/90 border border-slate-700 rounded-xl p-3 text-white font-bold text-sm focus:border-cyan-400 outline-none uppercase font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2: CUSTOMER & LOGISTICS DETAILS */}
              <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-3">
                <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wide flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-slate-500" />
                  <span>Customer &amp; Delivery Destination</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                      Buyer Name
                    </label>
                    <input
                      type="text"
                      value={soBuyerName}
                      onChange={(e) => setSoBuyerName(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-900 font-bold outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                      Buyer Contact
                    </label>
                    <input
                      type="text"
                      value={soBuyerContact}
                      onChange={(e) => setSoBuyerContact(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-900 font-bold outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                      Delivery Location
                    </label>
                    <input
                      type="text"
                      value={soDeliveryLocation}
                      onChange={(e) => setSoDeliveryLocation(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-900 font-bold outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 3: ITEMS & LAST-MINUTE QUANTITY / SERIAL EDITING */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wide flex items-center gap-2">
                      <Zap className="h-4 w-4 text-cyan-600" />
                      <span>Order Items &amp; Serial Numbers Manager</span>
                    </h4>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Customer made last-minute quantity changes? Update item quantities, chassis numbers, or serials below.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={addNewItemLine}
                    className="px-3 py-1.5 bg-cyan-50 hover:bg-cyan-100 text-cyan-900 border border-cyan-200 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="h-4 w-4 text-cyan-600" />
                    <span>Add Item</span>
                  </button>
                </div>

                <div className="space-y-4">
                  {soItems.map((item, idx) => (
                    <div key={item.id || idx} className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-3 relative">
                      {/* Item Line Header */}
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-slate-900 text-white font-bold text-[10px] flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <select
                            value={item.itemType}
                            onChange={(e) => updateItemField(idx, 'itemType', e.target.value as any)}
                            className="bg-slate-100 font-extrabold text-slate-800 rounded-lg p-1.5 border border-slate-200 outline-none text-xs"
                          >
                            <option value="scooter">🛵 Scooter</option>
                            <option value="battery">🔋 Battery</option>
                            <option value="charger">⚡ Charger</option>
                          </select>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeItemLine(idx)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                          title="Delete Item Line"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Details & Quantity Stepper */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                            {item.itemType === 'scooter' ? 'Model Name' : (item.itemType === 'battery' ? 'Battery Series' : 'Charger Type')}
                          </label>
                                                    {item.itemType === 'scooter' ? (
                            <select
                              value={item.productName || ''}
                              onChange={(e) => {
                                updateItemField(idx, 'productName', e.target.value);
                                // Also update color if the new product has colors and current color isn't in it
                                const prod = products.find(p => p.name === e.target.value);
                                if (prod && prod.colors.length > 0 && !prod.colors.includes(item.color || '')) {
                                  updateItemField(idx, 'color', prod.colors[0]);
                                }
                              }}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-bold outline-none"
                            >
                              <option value="">Select Model</option>
                              {products.map(p => (
                                <option key={p.id} value={p.name}>{p.name}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={item.batteryType || item.chargerType || ''}
                              onChange={(e) => {
                                if (item.itemType === 'battery') updateItemField(idx, 'batteryType', e.target.value);
                                else updateItemField(idx, 'chargerType', e.target.value);
                              }}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-bold outline-none"
                              placeholder="e.g. 60V 28Ah"
                            />
                          )}
                        </div>

                        {item.itemType === 'scooter' && (
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                              Color
                            </label>
                            {(() => {
                              const prod = products.find(p => p.name === item.productName);
                              if (prod && prod.colors && prod.colors.length > 0) {
                                return (
                                  <select
                                    value={item.color || ''}
                                    onChange={(e) => updateItemField(idx, 'color', e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-bold outline-none"
                                  >
                                    <option value="">Select Color</option>
                                    {prod.colors.map(c => (
                                      <option key={c} value={c}>{c}</option>
                                    ))}
                                  </select>
                                );
                              }
                              return (
                                <input
                                  type="text"
                                  value={item.color || ''}
                                  onChange={(e) => updateItemField(idx, 'color', e.target.value)}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-bold outline-none"
                                  placeholder="e.g. Matte Black"
                                />
                              );
                            })()}
                          </div>
                        )}

                        {/* Quantity Stepper Controller */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                            Quantity (Units)
                          </label>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => updateItemQuantity(idx, item.quantity - 1)}
                              className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-black cursor-pointer border border-slate-200"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => updateItemQuantity(idx, parseInt(e.target.value) || 1)}
                              className="w-20 bg-slate-50 border border-slate-200 rounded-xl p-2 text-center text-slate-900 font-black text-sm outline-none focus:border-cyan-500"
                            />
                            <button
                              type="button"
                              onClick={() => updateItemQuantity(idx, item.quantity + 1)}
                              className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-black cursor-pointer border border-slate-200"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Scooter Chassis Numbers List Sub-Editor */}
                      {item.itemType === 'scooter' && (
                        <div className="pt-2 space-y-2 bg-slate-50/70 p-3 rounded-xl border border-slate-200">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-extrabold text-cyan-900 uppercase tracking-wide">
                              Chassis Numbers ({item.chassisNumbers?.length || 0} assigned)
                            </span>
                            <button
                              type="button"
                              onClick={() => addChassisSlot(idx)}
                              className="text-[10px] font-bold text-cyan-700 hover:text-cyan-900 bg-cyan-100/80 px-2 py-0.5 rounded cursor-pointer"
                            >
                              + Add Chassis
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {(item.chassisNumbers || []).map((chassis, cIdx) => {
                              const availableForModel = scooterUnits.filter(u => 
                                (u.status === 'available' || u.chassisNo === chassis) && 
                                (!item.productName || u.modelName === item.productName) &&
                                (!item.color || u.color === item.color)
                              );
                              return (
                              <div key={cIdx} className="flex items-center gap-1.5">
                                <span className="text-[10px] font-mono text-slate-400 shrink-0 w-6">#{cIdx + 1}</span>
                                <select
                                  value={chassis}
                                  onChange={(e) => updateChassisNumber(idx, cIdx, e.target.value)}
                                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 font-mono font-bold text-xs outline-none focus:border-cyan-500 cursor-pointer"
                                >
                                  <option value="">-- Select Chassis --</option>
                                  {availableForModel.map(u => (
                                    <option key={u.id} value={u.chassisNo}>
                                      {u.chassisNo} {u.motorNo ? `(Motor: ${u.motorNo})` : ''}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  onClick={() => removeChassisSlot(idx, cIdx)}
                                  className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Battery / Charger Serials Sub-Editor */}
                      {(item.itemType === 'battery' || item.itemType === 'charger') && (
                        <div className="pt-2 space-y-2 bg-slate-50/70 p-3 rounded-xl border border-slate-200">
                          <span className="text-[10px] font-extrabold text-emerald-900 uppercase tracking-wide">
                            Series / Serial Numbers Range
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input
                              type="text"
                              placeholder="Start Serial No (e.g. BAT-1001)"
                              value={item.startNo || ''}
                              onChange={(e) => updateItemField(idx, 'startNo', e.target.value)}
                              className="bg-white border border-slate-200 rounded-lg p-2 font-mono text-xs text-slate-900 font-bold outline-none"
                            />
                            <input
                              type="text"
                              placeholder="End Serial No (e.g. BAT-1020)"
                              value={item.endNo || ''}
                              onChange={(e) => updateItemField(idx, 'endNo', e.target.value)}
                              className="bg-white border border-slate-200 rounded-lg p-2 font-mono text-xs text-slate-900 font-bold outline-none"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* SECTION 4: ORDER NOTES */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                  Manager Verification Notes
                </label>
                <textarea
                  rows={2}
                  value={soNotes}
                  onChange={(e) => setSoNotes(e.target.value)}
                  placeholder="Add any specific verification notes regarding driver, paper gate pass, or payment terms..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 font-medium outline-none focus:border-cyan-500"
                />
              </div>

            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 shrink-0 flex items-center justify-between gap-3 flex-wrap">
              <button
                type="button"
                onClick={closeAndResetEditModal}
                className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl cursor-pointer"
              >
                Cancel
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleSaveSalesOrder(false)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Save className="h-4 w-4 text-cyan-400" />
                  <span>{isSubmitting ? 'Saving...' : 'Save Progress (Draft)'}</span>
                </button>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleSaveSalesOrder(true)}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-2 active:scale-95 transition-all"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{isSubmitting ? 'Finalizing...' : 'Finalize Sale & Save Challan'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PRINT DELIVERY CHALLAN PASS MODAL */}
      {printChallan && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-8 shadow-2xl space-y-6 text-slate-900 font-sans my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div>
                <h2 className="text-xl font-black uppercase text-slate-900 tracking-wide">
                  Official Delivery Challan &amp; Gate Pass
                </h2>
                <p className="text-xs text-slate-500 font-bold">Scooter Warehouse Dispatch Registry</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Printer className="h-4 w-4" />
                  <span>Print Document</span>
                </button>

                <button
                  onClick={() => setPrintChallan(null)}
                  className="p-2 text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Printable Area */}
            <div className="space-y-6 text-xs font-medium">
              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Customer / Buyer</p>
                  <p className="text-sm font-black text-slate-900">{printChallan.buyerName}</p>
                  {printChallan.buyerContact && <p className="text-xs text-slate-600 font-bold">Contact: {printChallan.buyerContact}</p>}
                </div>

                <div className="text-right">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Challan Number</p>
                  <p className="text-base font-black text-cyan-800 font-mono">#{printChallan.challanNo}</p>
                  {printChallan.salesBillNo && <p className="text-xs text-slate-700 font-bold">Bill No: #{printChallan.salesBillNo}</p>}
                  <p className="text-[10px] text-slate-500 mt-1">Date: {new Date(printChallan.date).toLocaleDateString()}</p>
                </div>
              </div>

              {/* Items Table */}
              <div className="space-y-4">
                {printChallan.scooters.length > 0 && (
                  <div>
                    <h4 className="font-extrabold text-xs uppercase text-slate-700 mb-2">Scooters Dispatched</h4>
                    <table className="w-full text-left border-collapse border border-slate-200 text-xs">
                      <thead className="bg-slate-100 font-bold text-[10px] uppercase text-slate-600">
                        <tr>
                          <th className="p-2 border border-slate-200">Model</th>
                          <th className="p-2 border border-slate-200">Color</th>
                          <th className="p-2 border border-slate-200">Chassis No</th>
                          <th className="p-2 border border-slate-200">Motor No</th>
                        </tr>
                      </thead>
                      <tbody>
                        {printChallan.scooters.map((s, idx) => (
                          <tr key={idx} className="border-b border-slate-200 font-semibold">
                            <td className="p-2 border border-slate-200 font-bold">{s.modelName}</td>
                            <td className="p-2 border border-slate-200">{s.color}</td>
                            <td className="p-2 border border-slate-200 font-mono font-bold text-cyan-800">{s.chassisNo}</td>
                            <td className="p-2 border border-slate-200 font-mono">{s.motorNo}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {printChallan.batteries.length > 0 && (
                  <div>
                    <h4 className="font-extrabold text-xs uppercase text-slate-700 mb-2">Batteries Dispatched</h4>
                    <table className="w-full text-left border-collapse border border-slate-200 text-xs">
                      <thead className="bg-slate-100 font-bold text-[10px] uppercase text-slate-600">
                        <tr>
                          <th className="p-2 border border-slate-200">Series</th>
                          <th className="p-2 border border-slate-200">Quantity</th>
                          <th className="p-2 border border-slate-200">Serial Numbers</th>
                        </tr>
                      </thead>
                      <tbody>
                        {printChallan.batteries.map((b, idx) => (
                          <tr key={idx} className="border-b border-slate-200 font-semibold">
                            <td className="p-2 border border-slate-200 font-bold">{b.batterySeries}</td>
                            <td className="p-2 border border-slate-200 font-bold">{b.quantity} Units</td>
                            <td className="p-2 border border-slate-200 font-mono">{b.serialNumbers?.join(', ') || `${b.startNo} to ${b.endNo}`}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {printChallan.chargers.length > 0 && (
                  <div>
                    <h4 className="font-extrabold text-xs uppercase text-slate-700 mb-2">Chargers Dispatched</h4>
                    <table className="w-full text-left border-collapse border border-slate-200 text-xs">
                      <thead className="bg-slate-100 font-bold text-[10px] uppercase text-slate-600">
                        <tr>
                          <th className="p-2 border border-slate-200">Charger Type</th>
                          <th className="p-2 border border-slate-200">Quantity</th>
                          <th className="p-2 border border-slate-200">Serial Numbers</th>
                        </tr>
                      </thead>
                      <tbody>
                        {printChallan.chargers.map((c, idx) => (
                          <tr key={idx} className="border-b border-slate-200 font-semibold">
                            <td className="p-2 border border-slate-200 font-bold">{c.chargerType}</td>
                            <td className="p-2 border border-slate-200 font-bold">{c.quantity} Units</td>
                            <td className="p-2 border border-slate-200 font-mono">{c.serialNumbers?.join(', ') || `${c.startNo} to ${c.endNo}`}</td>
                          </tr>
                        ))}
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

      {/* PER-CHALLAN AUDIT LOG MODAL */}
      {selectedChallanAuditModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 font-sans space-y-4 max-h-[85vh] flex flex-col">
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
                </div>
              ) : (
                getModalChallanLogs(selectedChallanAuditModal).map((log) => (
                  <div key={log.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold bg-indigo-50 text-indigo-900 border border-indigo-200">
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
                      <span>By <strong className="text-slate-800">{log.operator || log.operatorName || log.username}</strong> ({log.operatorRole || 'User'})</span>
                    </div>
                  </div>
                ))
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
