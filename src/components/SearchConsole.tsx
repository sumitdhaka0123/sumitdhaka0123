import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, FileText, User, Clock, Calendar, Shield, MapPin, 
  Battery, Zap, ClipboardList, Info, ArrowRight, 
  ChevronRight, Box, ShoppingBag, CheckCircle2, AlertCircle,
  Truck, ShieldAlert, Cpu, Wrench, Package, Hash, CheckCircle, RefreshCw, XCircle
} from 'lucide-react';
import { 
  ScooterUnit, StockLog, BatteryImport, ChargerImport, Buyer, Product, BatterySale, ChargerSale, SalesOrder, WarrantyClaim 
} from '../types';

interface SearchConsoleProps {
  products: Product[];
  buyers: Buyer[];
  scooterUnits: ScooterUnit[];
  stockLogs: StockLog[];
  batteryImports: BatteryImport[];
  chargerImports: ChargerImport[];
  batterySales?: BatterySale[];
  chargerSales?: ChargerSale[];
  salesOrders?: SalesOrder[];
  warrantyClaims?: WarrantyClaim[];
  currentUser: { username: string; role: string };
  onRefresh?: () => void;
}

export type SearchResultCategory = 'scooter' | 'battery' | 'charger' | 'order' | 'claim' | 'buyer' | 'model' | 'stock_log';

export interface SearchResult {
  id: string;
  category: SearchResultCategory;
  title: string;
  subtitle: string;
  badge: string;
  badgeColor: string;
  refData: any;
  matchReason?: string;
  matchedSerial?: string;
}

// Helper to format duration in human readable time
function formatDuration(startStr?: string, endStr?: string): { text: string; rawMins: number } {
  if (!startStr || !endStr) return { text: 'In Progress / Pending', rawMins: 0 };
  const s = new Date(startStr).getTime();
  const e = new Date(endStr).getTime();
  if (isNaN(s) || isNaN(e) || e < s) return { text: 'Same-day Instant Processed', rawMins: 0 };
  
  const diffMs = e - s;
  const mins = Math.floor(diffMs / (1000 * 60));
  if (mins < 1) return { text: 'Under 1 Minute', rawMins: 0 };
  
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);

  if (mins < 60) {
    return { text: `${mins} Minute${mins > 1 ? 's' : ''}`, rawMins: mins };
  } else if (hours < 24) {
    const rMins = mins % 60;
    return { text: `${hours} Hour${hours > 1 ? 's' : ''} ${rMins > 1 ? 's' : ''}`, rawMins: mins };
  } else {
    const rHours = hours % 24;
    return { text: `${days} Day${days > 1 ? 's' : ''} ${rHours} Hour${rHours > 1 ? 's' : ''}`, rawMins: mins };
  }
}

export default function SearchConsole({
  products,
  buyers,
  scooterUnits,
  stockLogs,
  batteryImports,
  chargerImports,
  batterySales = [],
  chargerSales = [],
  salesOrders = [],
  warrantyClaims = [],
  currentUser,
  onRefresh
}: SearchConsoleProps) {
  // Mode selection: 'regular' | 'trail' | 'purchase'
  const [activeMode, setActiveMode] = useState<'regular' | 'trail' | 'purchase'>('regular');

  // --- Regular Search States ---
  const [regularQuery, setRegularQuery] = useState('');
  const [regularCategory, setRegularCategory] = useState<string>('all');
  const [selectedRegularResult, setSelectedRegularResult] = useState<any | null>(null);

  // --- Trail Search States ---
  const [query, setQuery] = useState('');
  const [searchCategory, setSearchCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);

  // --- Purchase / Container Search States ---
  const [purchaseQuery, setPurchaseQuery] = useState('');
  const [selectedBillFilter, setSelectedBillFilter] = useState<string | null>(null);
  const [expandedStockInNo, setExpandedStockInNo] = useState<string | null>(null);

  // ================= PURCHASE & CONTAINER HIERARCHY COMPUTATION =================
  const purchaseHierarchy = useMemo(() => {
    // Collect all IN stock logs that have a billNo or stockInNo
    const inLogs = stockLogs.filter(log => log.type === 'in' || log.billNo || log.stockInNo);
    
    // Group by billNo
    const map = new Map<string, {
      billNo: string;
      totalUnits: number;
      supplierNames: Set<string>;
      stockInGroups: Map<string, {
        stockInNo: string;
        totalQty: number;
        supplierName?: string;
        logs: StockLog[];
        variantBreakdown: Record<string, number>;
        shortages: string[];
        dateLogged: string;
        operator: string;
      }>;
    }>();

    inLogs.forEach(log => {
      const bNo = log.billNo?.trim().toUpperCase() || 'UNASSIGNED-BILL';
      const sInNo = log.stockInNo?.trim().toUpperCase() || 'UNASSIGNED-IN-NO';

      if (!map.has(bNo)) {
        map.set(bNo, {
          billNo: bNo,
          totalUnits: 0,
          supplierNames: new Set(),
          stockInGroups: new Map()
        });
      }

      const bEntry = map.get(bNo)!;
      bEntry.totalUnits += Number(log.quantity) || 1;
      if (log.supplierName) {
        bEntry.supplierNames.add(log.supplierName);
      }

      if (!bEntry.stockInGroups.has(sInNo)) {
        bEntry.stockInGroups.set(sInNo, {
          stockInNo: sInNo,
          totalQty: 0,
          supplierName: log.supplierName,
          logs: [],
          variantBreakdown: {},
          shortages: [],
          dateLogged: log.timestamp || '',
          operator: log.operator || 'Manager'
        });
      }

      const sEntry = bEntry.stockInGroups.get(sInNo)!;
      sEntry.totalQty += Number(log.quantity) || 1;
      if (!sEntry.supplierName && log.supplierName) {
        sEntry.supplierName = log.supplierName;
      }
      sEntry.logs.push(log);

      const vKey = `${log.modelName} (${log.color})`;
      sEntry.variantBreakdown[vKey] = (sEntry.variantBreakdown[vKey] || 0) + (Number(log.quantity) || 1);

      if (log.notes && log.notes.includes('Shortage')) {
        sEntry.shortages.push(log.notes);
      }
    });

    const result = Array.from(map.values()).map(b => ({
      ...b,
      supplierList: Array.from(b.supplierNames),
      stockInList: Array.from(b.stockInGroups.values())
    }));

    // Filter based on purchaseQuery
    if (!purchaseQuery.trim()) return result;

    const q = purchaseQuery.toLowerCase().trim();
    return result.filter(b => {
      const matchesBill = b.billNo.toLowerCase().includes(q);
      const matchesSupplier = b.supplierList.some(sup => sup.toLowerCase().includes(q));
      const matchesStockIn = b.stockInList.some(s => 
        s.stockInNo.toLowerCase().includes(q) ||
        (s.supplierName && s.supplierName.toLowerCase().includes(q)) ||
        Object.keys(s.variantBreakdown).some(k => k.toLowerCase().includes(q)) ||
        s.shortages.some(sh => sh.toLowerCase().includes(q))
      );
      return matchesBill || matchesSupplier || matchesStockIn;
    });
  }, [stockLogs, purchaseQuery]);

  // ================= 1. REGULAR SEARCH INDEXING =================
  const regularSearchResults = useMemo(() => {
    if (!regularQuery.trim()) return [];

    const lowerQuery = regularQuery.toLowerCase().trim();
    const results: Array<{
      id: string;
      category: 'scooter' | 'buyer' | 'model' | 'bill' | 'stock_in' | 'stock_log' | 'battery' | 'charger' | 'order' | 'claim';
      categoryLabel: string;
      primaryTitle: string;
      secondaryDetails: string;
      dateStr: string;
      badge: string;
      badgeClass: string;
      refData: any;
      rawObj: any;
      title: string;
      subtitle: string;
      badgeColor: string;
    }> = [];

    // 1. SCOOTER UNITS INDEXING
    if (regularCategory === 'all' || regularCategory === 'scooter') {
      scooterUnits.forEach(scoot => {
        const chassisMatch = scoot.chassisNo?.toLowerCase().includes(lowerQuery);
        const motorMatch = scoot.motorNo?.toLowerCase().includes(lowerQuery);
        const controllerMatch = scoot.controllerNo?.toLowerCase().includes(lowerQuery);
        const modelMatch = scoot.modelName?.toLowerCase().includes(lowerQuery);
        const colorMatch = scoot.color?.toLowerCase().includes(lowerQuery);
        const billMatch = scoot.billNo?.toLowerCase().includes(lowerQuery);
        const stockInMatch = scoot.stockInNo?.toLowerCase().includes(lowerQuery);
        const buyerMatch = scoot.buyerName?.toLowerCase().includes(lowerQuery);

        if (chassisMatch || motorMatch || controllerMatch || modelMatch || colorMatch || billMatch || stockInMatch || buyerMatch) {
          let matchReason = '';
          if (chassisMatch) matchReason = `Chassis #: ${scoot.chassisNo}`;
          else if (motorMatch) matchReason = `Motor #: ${scoot.motorNo}`;
          else if (controllerMatch) matchReason = `Controller #: ${scoot.controllerNo}`;
          else if (billMatch) matchReason = `Bill #: ${scoot.billNo}`;
          else if (stockInMatch) matchReason = `Stock IN #: ${scoot.stockInNo}`;
          else if (buyerMatch) matchReason = `Buyer: ${scoot.buyerName}`;
          else matchReason = `${scoot.modelName} (${scoot.color})`;

          const title = `Scooter: ${scoot.modelName || 'EV Unit'} (${scoot.color || 'N/A'})`;
          const subtitle = `Chassis: ${scoot.chassisNo || 'N/A'} | Motor: ${scoot.motorNo || 'N/A'} | ${matchReason}`;
          const badge = scoot.status === 'sold' ? 'Sold' : 'Available';
          const badgeClass = scoot.status === 'sold' ? 'bg-cyan-100 text-cyan-800 border border-cyan-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200';

          results.push({
            id: `reg-scoot-${scoot.id}`,
            category: 'scooter',
            categoryLabel: 'Scooters & EV Units',
            primaryTitle: title,
            secondaryDetails: subtitle,
            dateStr: scoot.createdTimestamp ? new Date(scoot.createdTimestamp).toLocaleDateString() : (scoot.saleDate ? new Date(scoot.saleDate).toLocaleDateString() : 'N/A'),
            badge,
            badgeClass,
            refData: scoot,
            rawObj: scoot,
            title,
            subtitle,
            badgeColor: badgeClass
          });
        }
      });
    }

    // 2. BUYERS INDEXING
    if (regularCategory === 'all' || regularCategory === 'buyer') {
      buyers.forEach(buyer => {
        const nameMatch = buyer.name?.toLowerCase().includes(lowerQuery);
        const contactMatch = buyer.contact?.toLowerCase().includes(lowerQuery);
        const addressMatch = buyer.address?.toLowerCase().includes(lowerQuery);

        if (nameMatch || contactMatch || addressMatch) {
          const title = `Buyer: ${buyer.name}`;
          const subtitle = `Contact: ${buyer.contact || 'N/A'} | Address: ${buyer.address || 'No Address'}`;
          const badge = 'Buyer Profile';
          const badgeClass = 'bg-indigo-100 text-indigo-800 border border-indigo-200';

          results.push({
            id: `reg-buyer-${buyer.id}`,
            category: 'buyer',
            categoryLabel: 'Buyer Directory',
            primaryTitle: title,
            secondaryDetails: subtitle,
            dateStr: 'Buyer Record',
            badge,
            badgeClass,
            refData: buyer,
            rawObj: buyer,
            title,
            subtitle,
            badgeColor: badgeClass
          });
        }
      });
    }

    // 3. MODELS / BLUEPRINTS INDEXING
    if (regularCategory === 'all' || regularCategory === 'model') {
      products.forEach(p => {
        if (p.name.toLowerCase().includes(lowerQuery)) {
          const title = `Model Blueprint: ${p.name}`;
          const subtitle = `Blueprint Colors: ${p.colors ? p.colors.join(', ') : 'N/A'}`;
          const badge = 'Model Blueprint';
          const badgeClass = 'bg-amber-100 text-amber-800 border border-amber-200';

          results.push({
            id: `reg-prod-${p.id}`,
            category: 'model',
            categoryLabel: 'Model Blueprint',
            primaryTitle: title,
            secondaryDetails: subtitle,
            dateStr: 'Master Blueprint',
            badge,
            badgeClass,
            refData: p,
            rawObj: p,
            title,
            subtitle,
            badgeColor: badgeClass
          });
        }
      });
    }

    // 4. BATTERY STOCK & SALES INDEXING
    if (regularCategory === 'all' || regularCategory === 'battery') {
      batteryImports.forEach(b => {
        const seriesMatch = b.batterySeries?.toLowerCase().includes(lowerQuery);
        const billMatch = b.billNo?.toLowerCase().includes(lowerQuery);
        const stockInMatch = b.stockInNo?.toLowerCase().includes(lowerQuery);
        if (seriesMatch || billMatch || stockInMatch) {
          const title = `Battery Import: ${b.batterySeries} Series`;
          const subtitle = `Qty: ${b.quantity} Packs | Bill #: ${b.billNo || 'N/A'} | Stock IN: ${b.stockInNo || 'N/A'}`;
          const badge = 'Battery Stock';
          const badgeClass = 'bg-emerald-100 text-emerald-800 border border-emerald-200';

          results.push({
            id: `reg-bat-imp-${b.id}`,
            category: 'battery',
            categoryLabel: 'Battery Stock',
            primaryTitle: title,
            secondaryDetails: subtitle,
            dateStr: b.importDate ? new Date(b.importDate).toLocaleDateString() : 'N/A',
            badge,
            badgeClass,
            refData: b,
            rawObj: b,
            title,
            subtitle,
            badgeColor: badgeClass
          });
        }
      });

      batterySales.forEach(s => {
        const seriesMatch = s.batterySeries?.toLowerCase().includes(lowerQuery);
        const buyerMatch = s.buyerName?.toLowerCase().includes(lowerQuery);
        if (seriesMatch || buyerMatch) {
          const title = `Battery Sale: ${s.batterySeries} Series`;
          const subtitle = `Buyer: ${s.buyerName || 'N/A'} | Qty: ${s.quantity} Packs`;
          const badge = 'Battery Sale';
          const badgeClass = 'bg-teal-100 text-teal-800 border border-teal-200';

          results.push({
            id: `reg-bat-sale-${s.id}`,
            category: 'battery',
            categoryLabel: 'Battery Sale',
            primaryTitle: title,
            secondaryDetails: subtitle,
            dateStr: s.saleDate ? new Date(s.saleDate).toLocaleDateString() : 'N/A',
            badge,
            badgeClass,
            refData: s,
            rawObj: s,
            title,
            subtitle,
            badgeColor: badgeClass
          });
        }
      });
    }

    // 5. CHARGER STOCK & SALES INDEXING
    if (regularCategory === 'all' || regularCategory === 'charger') {
      chargerImports.forEach(c => {
        const typeMatch = c.chargerType?.toLowerCase().includes(lowerQuery);
        const billMatch = c.billNo?.toLowerCase().includes(lowerQuery);
        const stockInMatch = c.stockInNo?.toLowerCase().includes(lowerQuery);
        if (typeMatch || billMatch || stockInMatch) {
          const title = `Charger Import: ${c.chargerType}`;
          const subtitle = `Qty: ${c.quantity} Units | Bill #: ${c.billNo || 'N/A'} | Stock IN: ${c.stockInNo || 'N/A'}`;
          const badge = 'Charger Stock';
          const badgeClass = 'bg-blue-100 text-blue-800 border border-blue-200';

          results.push({
            id: `reg-chg-imp-${c.id}`,
            category: 'charger',
            categoryLabel: 'Charger Stock',
            primaryTitle: title,
            secondaryDetails: subtitle,
            dateStr: c.importDate ? new Date(c.importDate).toLocaleDateString() : 'N/A',
            badge,
            badgeClass,
            refData: c,
            rawObj: c,
            title,
            subtitle,
            badgeColor: badgeClass
          });
        }
      });

      chargerSales.forEach(cs => {
        const typeMatch = cs.chargerType?.toLowerCase().includes(lowerQuery);
        const buyerMatch = cs.buyerName?.toLowerCase().includes(lowerQuery);
        if (typeMatch || buyerMatch) {
          const title = `Charger Sale: ${cs.chargerType}`;
          const subtitle = `Buyer: ${cs.buyerName || 'N/A'} | Qty: ${cs.quantity} Units`;
          const badge = 'Charger Sale';
          const badgeClass = 'bg-sky-100 text-sky-800 border border-sky-200';

          results.push({
            id: `reg-chg-sale-${cs.id}`,
            category: 'charger',
            categoryLabel: 'Charger Sale',
            primaryTitle: title,
            secondaryDetails: subtitle,
            dateStr: cs.saleDate ? new Date(cs.saleDate).toLocaleDateString() : 'N/A',
            badge,
            badgeClass,
            refData: cs,
            rawObj: cs,
            title,
            subtitle,
            badgeColor: badgeClass
          });
        }
      });
    }

    // 6. UNIQUE BILL NUMBERS INDEXING
    if (regularCategory === 'all') {
      const seenBills = new Set<string>();
      scooterUnits.forEach(s => {
        if (s.billNo && s.billNo.toLowerCase().includes(lowerQuery) && !seenBills.has(s.billNo)) {
          seenBills.add(s.billNo);
          const title = `Bill Ref: ${s.billNo}`;
          const subtitle = `Associated with scooter unit (${s.modelName} ${s.color})`;
          results.push({
            id: `reg-bill-${s.billNo}`,
            category: 'bill',
            categoryLabel: 'Purchase Bill',
            primaryTitle: title,
            secondaryDetails: subtitle,
            dateStr: 'Bill Ledger',
            badge: 'Bill #',
            badgeClass: 'bg-rose-100 text-rose-800 border border-rose-200',
            refData: { billNo: s.billNo },
            rawObj: { billNo: s.billNo },
            title,
            subtitle,
            badgeColor: 'bg-rose-100 text-rose-800'
          });
        }
      });
      batteryImports.forEach(b => {
        if (b.billNo && b.billNo.toLowerCase().includes(lowerQuery) && !seenBills.has(b.billNo)) {
          seenBills.add(b.billNo);
          const title = `Bill Ref: ${b.billNo}`;
          const subtitle = `Associated with battery imports (${b.batterySeries} Series)`;
          results.push({
            id: `reg-bill-${b.billNo}`,
            category: 'bill',
            categoryLabel: 'Purchase Bill',
            primaryTitle: title,
            secondaryDetails: subtitle,
            dateStr: 'Bill Ledger',
            badge: 'Bill #',
            badgeClass: 'bg-rose-100 text-rose-800 border border-rose-200',
            refData: { billNo: b.billNo },
            rawObj: { billNo: b.billNo },
            title,
            subtitle,
            badgeColor: 'bg-rose-100 text-rose-800'
          });
        }
      });
    }

    // 7. UNIQUE STOCK IN NUMBERS INDEXING
    if (regularCategory === 'all') {
      const seenStockIn = new Set<string>();
      scooterUnits.forEach(s => {
        if (s.stockInNo && s.stockInNo.toLowerCase().includes(lowerQuery) && !seenStockIn.has(s.stockInNo)) {
          seenStockIn.add(s.stockInNo);
          const title = `Stock IN Ref: ${s.stockInNo}`;
          const subtitle = `Associated with scooter procurement (${s.modelName} ${s.color})`;
          results.push({
            id: `reg-stkin-${s.stockInNo}`,
            category: 'stock_in',
            categoryLabel: 'Stock Inward',
            primaryTitle: title,
            secondaryDetails: subtitle,
            dateStr: 'Stock Ledger',
            badge: 'Stock IN #',
            badgeClass: 'bg-violet-100 text-violet-800 border border-violet-200',
            refData: { stockInNo: s.stockInNo },
            rawObj: { stockInNo: s.stockInNo },
            title,
            subtitle,
            badgeColor: 'bg-violet-100 text-violet-800'
          });
        }
      });
    }

    // 8. B2B SALES ORDERS & CHALLANS
    if (regularCategory === 'all' || regularCategory === 'order') {
      salesOrders.forEach(o => {
        const challanMatch = o.challanNo?.toLowerCase().includes(lowerQuery);
        const buyerMatch = o.buyerName?.toLowerCase().includes(lowerQuery);
        const orderNoMatch = o.orderNo?.toLowerCase().includes(lowerQuery);
        if (challanMatch || buyerMatch || orderNoMatch) {
          const title = `Sales Order #: ${o.orderNo || o.id}`;
          const subtitle = `Buyer: ${o.buyerName || 'N/A'} | Challan #: ${o.challanNo || 'N/A'} | Status: ${o.status}`;
          const badge = o.status === 'dispatched' ? 'Dispatched' : 'Order ' + o.status;
          const badgeClass = o.status === 'dispatched' ? 'bg-cyan-100 text-cyan-800 border border-cyan-200' : 'bg-amber-100 text-amber-800 border border-amber-200';

          results.push({
            id: `reg-order-${o.id}`,
            category: 'order',
            categoryLabel: 'Sales Order',
            primaryTitle: title,
            secondaryDetails: subtitle,
            dateStr: o.createdTimestamp ? new Date(o.createdTimestamp).toLocaleDateString() : 'N/A',
            badge,
            badgeClass,
            refData: o,
            rawObj: o,
            title,
            subtitle,
            badgeColor: badgeClass
          });
        }
      });
    }

    // 9. WARRANTY CLAIMS
    if (regularCategory === 'all' || regularCategory === 'claim') {
      warrantyClaims.forEach(wc => {
        const serialMatch = wc.originalSerialNo?.toLowerCase().includes(lowerQuery);
        const buyerMatch = wc.buyerName?.toLowerCase().includes(lowerQuery);
        const issueMatch = wc.issueDescription?.toLowerCase().includes(lowerQuery);
        if (serialMatch || buyerMatch || issueMatch) {
          const title = `Warranty Claim: ${wc.originalSerialNo || wc.id}`;
          const subtitle = `Serial/Chassis #: ${wc.originalSerialNo || 'N/A'} | Buyer: ${wc.buyerName || 'N/A'} | Issue: ${wc.issueDescription || 'N/A'}`;
          const badge = wc.status || 'Claim';
          const badgeClass = 'bg-rose-100 text-rose-800 border border-rose-200';

          results.push({
            id: `reg-claim-${wc.id}`,
            category: 'claim',
            categoryLabel: 'Warranty Claim',
            primaryTitle: title,
            secondaryDetails: subtitle,
            dateStr: wc.claimDate ? new Date(wc.claimDate).toLocaleDateString() : 'N/A',
            badge,
            badgeClass,
            refData: wc,
            rawObj: wc,
            title,
            subtitle,
            badgeColor: badgeClass
          });
        }
      });
    }

    // 10. GENERAL STOCK LOGS INDEXING
    if (regularCategory === 'all' || regularCategory === 'log') {
      stockLogs.forEach(log => {
        const modelMatch = log.modelName?.toLowerCase().includes(lowerQuery);
        const colorMatch = log.color?.toLowerCase().includes(lowerQuery);
        const buyerMatch = log.buyerName?.toLowerCase().includes(lowerQuery);
        const noteMatch = log.notes?.toLowerCase().includes(lowerQuery);
        const operatorMatch = log.operator?.toLowerCase().includes(lowerQuery);

        if (modelMatch || colorMatch || buyerMatch || noteMatch || operatorMatch) {
          const title = `Stock Log: ${log.modelName || 'Stock Action'} (${log.color || 'N/A'})`;
          const subtitle = `${log.type === 'in' ? 'INFLOW' : 'OUTFLOW'} | Qty: ${log.quantity} | Operator: ${log.operator || 'System'} | ${log.notes || ''}`;
          const badge = log.type === 'in' ? 'Ledger IN' : 'Ledger OUT';
          const badgeClass = log.type === 'in' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-amber-100 text-amber-800 border border-amber-200';

          results.push({
            id: `reg-log-${log.id}`,
            category: 'stock_log',
            categoryLabel: 'Inventory Audit Log',
            primaryTitle: title,
            secondaryDetails: subtitle,
            dateStr: log.timestamp ? new Date(log.timestamp).toLocaleDateString() : 'N/A',
            badge,
            badgeClass,
            refData: log,
            rawObj: log,
            title,
            subtitle,
            badgeColor: badgeClass
          });
        }
      });
    }

    return results;
  }, [regularQuery, regularCategory, scooterUnits, buyers, products, batteryImports, batterySales, chargerImports, chargerSales, salesOrders, warrantyClaims, stockLogs]);

  // Regular Inspector Content
  const regularInspectorContent = useMemo(() => {
    if (!selectedRegularResult) return null;

    const { category, refData } = selectedRegularResult;

    switch (category) {
      case 'scooter': {
        const scoot = refData as ScooterUnit;
        return (
          <div className="space-y-6 font-sans">
            <div className="border-b border-slate-100 pb-4">
              <span className={`inline-block text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest ${
                scoot.status === 'sold' ? 'bg-cyan-50 text-cyan-700 border border-cyan-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
              }`}>
                STATUS: {scoot.status?.toUpperCase() || 'AVAILABLE'}
              </span>
              <h4 className="text-xl font-extrabold text-slate-900 mt-2">{scoot.modelName}</h4>
              <p className="text-xs text-slate-500 mt-0.5">Color: {scoot.color}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Chassis Number</span>
                <span className="text-sm font-extrabold text-slate-800 font-mono">{scoot.chassisNo || 'N/A'}</span>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Motor Number</span>
                <span className="text-sm font-extrabold text-slate-800 font-mono">{scoot.motorNo || 'N/A'}</span>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 col-span-2">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Controller Number</span>
                <span className="text-sm font-extrabold text-slate-800 font-mono">{scoot.controllerNo || 'N/A'}</span>
              </div>
            </div>

            <div className="space-y-3.5">
              <h5 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Procurement Logistics</h5>
              <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 overflow-hidden">
                <div className="flex items-center justify-between p-3 text-xs">
                  <span className="text-slate-500 font-medium">Bill Number (Purchase)</span>
                  <span className="font-bold text-slate-800 font-mono">{scoot.billNo || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between p-3 text-xs">
                  <span className="text-slate-500 font-medium">Stock IN Number</span>
                  <span className="font-bold text-slate-800 font-mono">{scoot.stockInNo || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between p-3 text-xs">
                  <span className="text-slate-500 font-medium">Source Procurement Channel</span>
                  <span className="font-bold text-slate-800">{scoot.sourceChannel === 'local_seller' ? 'Domestic Local Seller' : 'Foreign CKD Container'}</span>
                </div>
                <div className="flex items-center justify-between p-3 text-xs">
                  <span className="text-slate-500 font-medium">Wheel Tyre Sizes (F/R)</span>
                  <span className="font-bold text-slate-800 font-mono">{scoot.frontTireSize || '12-inch'} / {scoot.rearTireSize || '12-inch'}</span>
                </div>
                <div className="flex items-center justify-between p-3 text-xs">
                  <span className="text-slate-500 font-medium">Braking Technology</span>
                  <span className="font-bold text-slate-800">{scoot.brakeType || 'Disk Brake'}</span>
                </div>
              </div>
            </div>

            {scoot.status === 'sold' && (
              <div className="space-y-3.5">
                <h5 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Retail Sales Assigned</h5>
                <div className="bg-cyan-50/40 border border-cyan-100 rounded-2xl p-4 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Buyer Name</span>
                    <span className="font-bold text-slate-950 flex items-center gap-1">
                      <User className="h-3.5 w-3.5 text-cyan-600" />
                      {scoot.buyerName}
                    </span>
                  </div>
                  {scoot.buyerContact && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Buyer Contact</span>
                      <span className="font-bold text-slate-950 font-mono">{scoot.buyerContact}</span>
                    </div>
                  )}
                  {scoot.salesPrice && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Actual Sales Value</span>
                      <span className="font-bold text-emerald-700 text-sm">₹ {scoot.salesPrice.toLocaleString()}</span>
                    </div>
                  )}
                  {scoot.saleDate && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Date of Sale</span>
                      <span className="font-bold text-slate-950">{new Date(scoot.saleDate).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="border-t border-cyan-100 pt-3">
                    <span className="block text-[10px] font-bold text-cyan-700 uppercase tracking-wider mb-1">Linked Battery Serials</span>
                    {scoot.batterySerials && scoot.batterySerials.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {scoot.batterySerials.map((s, idx) => (
                          <span key={idx} className="bg-white border border-cyan-200 text-[10px] font-mono font-bold px-2.5 py-1 rounded-lg text-cyan-800 shadow-xs">
                            🔋 {s}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic">No custom batteries registered during checkout</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3.5">
              <h5 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Certifications & Warranty Coverage</h5>
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3.5 text-xs">
                <div>
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-700">Scooter Frame Warranty</span>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                      scoot.scooterWarrantyStatus === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                    }`}>{scoot.scooterWarrantyStatus || 'None'}</span>
                  </div>
                  {scoot.scooterWarrantyExpiry && (
                    <p className="text-[10px] text-slate-400 mt-0.5 font-mono">Expires: {new Date(scoot.scooterWarrantyExpiry).toLocaleDateString()}</p>
                  )}
                </div>
                <div className="border-t border-slate-200 pt-3">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-700">Battery Pack Warranty</span>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                      scoot.batteryWarrantyStatus === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                    }`}>{scoot.batteryWarrantyStatus || 'None'}</span>
                  </div>
                  {scoot.batteryWarrantyExpiry && (
                    <p className="text-[10px] text-slate-400 mt-0.5 font-mono">Expires: {new Date(scoot.batteryWarrantyExpiry).toLocaleDateString()}</p>
                  )}
                </div>
                {scoot.warrantyNotes && (
                  <div className="border-t border-slate-200 pt-3">
                    <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Warranty Remarks</span>
                    <p className="text-slate-600 bg-white p-2.5 rounded-xl border border-slate-100 italic">{scoot.warrantyNotes}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="text-[10px] text-slate-400 font-mono space-y-0.5 bg-slate-50/50 p-3.5 border border-slate-100 rounded-2xl">
              <p>Registered Operator: {scoot.createdOperator || 'System'}</p>
              <p>Registered Timestamp: {scoot.createdTimestamp ? new Date(scoot.createdTimestamp).toLocaleString() : 'N/A'}</p>
              <p>Last Modified: {scoot.lastUpdatedTimestamp ? new Date(scoot.lastUpdatedTimestamp).toLocaleString() : 'N/A'}</p>
              <p>Database Entity Identifier: {scoot.id}</p>
            </div>
          </div>
        );
      }

      case 'buyer': {
        const buyer = refData as Buyer;
        const buyerScooters = scooterUnits.filter(s => s.buyerName === buyer.name || s.buyerName?.toLowerCase() === buyer.name?.toLowerCase());
        const buyerBatteries = batterySales.filter(b => b.buyerName === buyer.name || b.buyerName?.toLowerCase() === buyer.name?.toLowerCase());
        const buyerChargers = chargerSales.filter(c => c.buyerName === buyer.name || c.buyerName?.toLowerCase() === buyer.name?.toLowerCase());

        return (
          <div className="space-y-6 font-sans">
            <div className="border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <div className="p-2.5 bg-indigo-50 border border-indigo-100 rounded-2xl text-indigo-600">
                  <User className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="text-lg font-extrabold text-slate-900">{buyer.name}</h4>
                  <p className="text-xs text-slate-500 font-mono">Registered ID: {buyer.id}</p>
                </div>
              </div>
            </div>

            <div className="space-y-3.5">
              <h5 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Contact Details</h5>
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-xs space-y-2.5 text-slate-700">
                <div className="flex justify-between">
                  <span className="text-slate-400">Mobile / Contact</span>
                  <span className="font-extrabold font-mono text-slate-900">{buyer.contact || 'No Contact Provided'}</span>
                </div>
                <div className="border-t border-slate-200/50 pt-2.5">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Physical Delivery Address</span>
                  <span className="font-medium text-slate-900 flex items-start gap-1.5 mt-1">
                    <MapPin className="h-4 w-4 text-slate-400 shrink-0" />
                    {buyer.address || 'No physical address registered'}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h5 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Past Procurement History</h5>

              <div>
                <span className="block text-xs font-bold text-slate-600 mb-2 flex items-center gap-1">
                  <Box className="h-4 w-4 text-cyan-600" />
                  Scooter Units Acquired ({buyerScooters.length})
                </span>
                {buyerScooters.length > 0 ? (
                  <div className="space-y-2">
                    {buyerScooters.map((s, idx) => (
                      <div key={idx} className="p-3 bg-white border border-slate-200 rounded-2xl text-xs space-y-1.5 hover:border-cyan-200 transition-all">
                        <div className="flex justify-between font-bold">
                          <span className="text-slate-900">{s.modelName} ({s.color})</span>
                          <span className="text-emerald-700">₹ {s.salesPrice?.toLocaleString() || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                          <span>Chassis: {s.chassisNo}</span>
                          <span>Sold: {s.saleDate ? new Date(s.saleDate).toLocaleDateString() : 'N/A'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 bg-slate-50 p-3 border border-dashed border-slate-200 rounded-2xl italic">
                    No registered scooters associated with this buyer.
                  </p>
                )}
              </div>

              <div className="border-t border-slate-100 pt-3">
                <span className="block text-xs font-bold text-slate-600 mb-2 flex items-center gap-1">
                  <Battery className="h-4 w-4 text-emerald-600" />
                  Battery Pack Sales ({buyerBatteries.length})
                </span>
                {buyerBatteries.length > 0 ? (
                  <div className="space-y-2">
                    {buyerBatteries.map((b, idx) => (
                      <div key={idx} className="p-3 bg-white border border-slate-200 rounded-2xl text-xs space-y-1.5 hover:border-emerald-200 transition-all">
                        <div className="flex justify-between font-bold">
                          <span className="text-slate-900">{b.batterySeries} Series Battery</span>
                          <span className="text-emerald-700">Qty: {b.quantity} Packs</span>
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                          <span>Serials: {b.startNo} - {b.endNo}</span>
                          <span>Date: {b.saleDate ? new Date(b.saleDate).toLocaleDateString() : 'N/A'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 bg-slate-50 p-3 border border-dashed border-slate-200 rounded-2xl italic">
                    No registered battery sales associated with this buyer.
                  </p>
                )}
              </div>

              <div className="border-t border-slate-100 pt-3">
                <span className="block text-xs font-bold text-slate-600 mb-2 flex items-center gap-1">
                  <Zap className="h-4 w-4 text-red-600" />
                  Charger Units Sales ({buyerChargers.length})
                </span>
                {buyerChargers.length > 0 ? (
                  <div className="space-y-2">
                    {buyerChargers.map((c, idx) => (
                      <div key={idx} className="p-3 bg-white border border-slate-200 rounded-2xl text-xs space-y-1.5 hover:border-red-200 transition-all">
                        <div className="flex justify-between font-bold">
                          <span className="text-slate-900">{c.chargerType}</span>
                          <span className="text-emerald-700">Qty: {c.quantity} Units</span>
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                          <span>Serials: {c.startNo} - {c.endNo}</span>
                          <span>Date: {c.saleDate ? new Date(c.saleDate).toLocaleDateString() : 'N/A'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 bg-slate-50 p-3 border border-dashed border-slate-200 rounded-2xl italic">
                    No registered charger sales associated with this buyer.
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      }

      case 'bill': {
        const billNo = refData.billNo;
        const scootersWithBill = scooterUnits.filter(s => s.billNo === billNo || s.billNo?.toLowerCase() === billNo?.toLowerCase());
        const batteriesWithBill = batteryImports.filter(b => b.billNo === billNo || b.billNo?.toLowerCase() === billNo?.toLowerCase());
        const chargersWithBill = chargerImports.filter(c => c.billNo === billNo || c.billNo?.toLowerCase() === billNo?.toLowerCase());
        const stockLogsWithBill = stockLogs.filter(l => l.billNo === billNo || l.billNo?.toLowerCase() === billNo?.toLowerCase());

        return (
          <div className="space-y-6 font-sans">
            <div className="border-b border-slate-100 pb-4">
              <span className="inline-block text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest bg-rose-50 text-rose-700 border border-rose-100">
                PURCHASE BILL AUDIT
              </span>
              <h4 className="text-xl font-extrabold text-slate-900 mt-2">Bill No: {billNo}</h4>
            </div>

            <div className="space-y-4">
              <h5 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Associated Hardware Inflows</h5>

              <div>
                <span className="block text-xs font-bold text-slate-700 mb-2">Scooters Registered ({scootersWithBill.length})</span>
                {scootersWithBill.length > 0 ? (
                  <div className="space-y-2">
                    {scootersWithBill.map((s, idx) => (
                      <div key={idx} className="p-3 bg-white border border-slate-200 rounded-2xl text-xs space-y-1">
                        <p className="font-bold text-slate-900">{s.modelName} ({s.color})</p>
                        <p className="text-[10px] text-slate-500 font-mono">Chassis: {s.chassisNo} | Motor: {s.motorNo}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No direct scooter units registered.</p>
                )}
              </div>

              <div className="border-t border-slate-100 pt-3">
                <span className="block text-xs font-bold text-slate-700 mb-2">Battery Shipments ({batteriesWithBill.length})</span>
                {batteriesWithBill.length > 0 ? (
                  <div className="space-y-2">
                    {batteriesWithBill.map((b, idx) => (
                      <div key={idx} className="p-3 bg-white border border-slate-200 rounded-2xl text-xs space-y-1">
                        <div className="flex justify-between font-bold text-slate-900">
                          <span>{b.batterySeries} Series Battery</span>
                          <span className="text-emerald-700">+{b.quantity} Packs</span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-mono">Import Date: {new Date(b.importDate).toLocaleDateString()} | Supplier: {b.supplierName || 'N/A'}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No battery import shipments.</p>
                )}
              </div>

              <div className="border-t border-slate-100 pt-3">
                <span className="block text-xs font-bold text-slate-700 mb-2">Charger Shipments ({chargersWithBill.length})</span>
                {chargersWithBill.length > 0 ? (
                  <div className="space-y-2">
                    {chargersWithBill.map((c, idx) => (
                      <div key={idx} className="p-3 bg-white border border-slate-200 rounded-2xl text-xs space-y-1">
                        <div className="flex justify-between font-bold text-slate-900">
                          <span>{c.chargerType}</span>
                          <span className="text-emerald-700">+{c.quantity} Units</span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-mono">Import Date: {new Date(c.importDate).toLocaleDateString()} | Supplier: {c.supplierName || 'N/A'}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No charger import shipments.</p>
                )}
              </div>

              <div className="border-t border-slate-100 pt-3">
                <span className="block text-xs font-bold text-slate-700 mb-2">General Ledger Stock Inflows ({stockLogsWithBill.length})</span>
                {stockLogsWithBill.length > 0 ? (
                  <div className="space-y-2">
                    {stockLogsWithBill.map((l, idx) => (
                      <div key={idx} className="p-3 bg-white border border-slate-200 rounded-2xl text-xs space-y-1">
                        <div className="flex justify-between font-bold text-slate-900">
                          <span>{l.modelName} ({l.color})</span>
                          <span className="text-emerald-700">+{l.quantity} Units</span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-mono">Timestamp: {new Date(l.timestamp).toLocaleString()} | Operator: {l.operator}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No general stock ledger logs linked.</p>
                )}
              </div>
            </div>
          </div>
        );
      }

      case 'stock_in': {
        const stockInNo = refData.stockInNo;
        const scootersWithStockIn = scooterUnits.filter(s => s.stockInNo === stockInNo || s.stockInNo?.toLowerCase() === stockInNo?.toLowerCase());
        const batteriesWithStockIn = batteryImports.filter(b => b.stockInNo === stockInNo || b.stockInNo?.toLowerCase() === stockInNo?.toLowerCase());
        const chargersWithStockIn = chargerImports.filter(c => c.stockInNo === stockInNo || c.stockInNo?.toLowerCase() === stockInNo?.toLowerCase());
        const stockLogsWithStockIn = stockLogs.filter(l => l.stockInNo === stockInNo || l.stockInNo?.toLowerCase() === stockInNo?.toLowerCase());

        return (
          <div className="space-y-6 font-sans">
            <div className="border-b border-slate-100 pb-4">
              <span className="inline-block text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest bg-violet-50 text-violet-700 border border-violet-100">
                STOCK INWARD REGISTER
              </span>
              <h4 className="text-xl font-extrabold text-slate-900 mt-2">Stock IN No: {stockInNo}</h4>
            </div>

            <div className="space-y-4">
              <h5 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Associated Hardware Inflows</h5>

              <div>
                <span className="block text-xs font-bold text-slate-700 mb-2">Scooter Stock ({scootersWithStockIn.length})</span>
                {scootersWithStockIn.length > 0 ? (
                  <div className="space-y-2">
                    {scootersWithStockIn.map((s, idx) => (
                      <div key={idx} className="p-3 bg-white border border-slate-200 rounded-2xl text-xs space-y-1">
                        <p className="font-bold text-slate-900">{s.modelName} ({s.color})</p>
                        <p className="text-[10px] text-slate-500 font-mono">Chassis: {s.chassisNo} | Motor: {s.motorNo}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No direct scooter units registered.</p>
                )}
              </div>

              <div className="border-t border-slate-100 pt-3">
                <span className="block text-xs font-bold text-slate-700 mb-2">Battery Shipments ({batteriesWithStockIn.length})</span>
                {batteriesWithStockIn.length > 0 ? (
                  <div className="space-y-2">
                    {batteriesWithStockIn.map((b, idx) => (
                      <div key={idx} className="p-3 bg-white border border-slate-200 rounded-2xl text-xs space-y-1">
                        <div className="flex justify-between font-bold text-slate-900">
                          <span>{b.batterySeries} Series Battery</span>
                          <span className="text-emerald-700">+{b.quantity} Packs</span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-mono">Import Date: {new Date(b.importDate).toLocaleDateString()} | Supplier: {b.supplierName || 'N/A'}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No battery import shipments.</p>
                )}
              </div>

              <div className="border-t border-slate-100 pt-3">
                <span className="block text-xs font-bold text-slate-700 mb-2">Charger Shipments ({chargersWithStockIn.length})</span>
                {chargersWithStockIn.length > 0 ? (
                  <div className="space-y-2">
                    {chargersWithStockIn.map((c, idx) => (
                      <div key={idx} className="p-3 bg-white border border-slate-200 rounded-2xl text-xs space-y-1">
                        <div className="flex justify-between font-bold text-slate-900">
                          <span>{c.chargerType}</span>
                          <span className="text-emerald-700">+{c.quantity} Units</span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-mono">Import Date: {new Date(c.importDate).toLocaleDateString()} | Supplier: {c.supplierName || 'N/A'}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No charger import shipments.</p>
                )}
              </div>

              <div className="border-t border-slate-100 pt-3">
                <span className="block text-xs font-bold text-slate-700 mb-2">General Ledger Stock Inflows ({stockLogsWithStockIn.length})</span>
                {stockLogsWithStockIn.length > 0 ? (
                  <div className="space-y-2">
                    {stockLogsWithStockIn.map((l, idx) => (
                      <div key={idx} className="p-3 bg-white border border-slate-200 rounded-2xl text-xs space-y-1">
                        <div className="flex justify-between font-bold text-slate-900">
                          <span>{l.modelName} ({l.color})</span>
                          <span className="text-emerald-700">+{l.quantity} Units</span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-mono">Timestamp: {new Date(l.timestamp).toLocaleString()} | Operator: {l.operator}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No general stock ledger logs linked.</p>
                )}
              </div>
            </div>
          </div>
        );
      }

      case 'model': {
        const prod = refData as Product;
        const matchingScooters = scooterUnits.filter(s => s.modelName === prod.name);
        const availableCount = matchingScooters.filter(s => s.status !== 'sold').length;
        const soldCount = matchingScooters.filter(s => s.status === 'sold').length;

        return (
          <div className="space-y-6 font-sans">
            <div className="border-b border-slate-100 pb-4">
              <span className="inline-block text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest bg-amber-50 text-amber-700 border border-amber-100">
                PRODUCT MODEL BLUEPRINT
              </span>
              <h4 className="text-xl font-extrabold text-slate-900 mt-2">{prod.name}</h4>
              <p className="text-xs text-slate-500">Declared Colors: {prod.colors.join(', ')}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 text-emerald-800">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-600">Available In-Stock</span>
                <span className="text-2xl font-extrabold">{availableCount} Units</span>
              </div>
              <div className="p-4 bg-cyan-50 rounded-2xl border border-cyan-100 text-cyan-800">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-cyan-600">Total Units Sold</span>
                <span className="text-2xl font-extrabold">{soldCount} Units</span>
              </div>
            </div>

            <div className="space-y-3.5">
              <h5 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Registered Units Registry</h5>
              {matchingScooters.length > 0 ? (
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {matchingScooters.map((s, idx) => (
                    <div key={idx} className="p-3 bg-white border border-slate-200 rounded-2xl text-xs flex justify-between items-center">
                      <div>
                        <p className="font-bold text-slate-900 font-mono">{s.chassisNo}</p>
                        <p className="text-[10px] text-slate-500">Color: {s.color} | Motor: {s.motorNo}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                        s.status === 'sold' ? 'bg-cyan-50 text-cyan-700' : 'bg-emerald-50 text-emerald-700'
                      }`}>{s.status === 'sold' ? 'SOLD' : 'AVAILABLE'}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 bg-slate-50 p-4 rounded-2xl border border-dashed border-slate-200 italic">
                  No registered physical scooter units found for this model.
                </p>
              )}
            </div>
          </div>
        );
      }

      case 'stock_log': {
        const log = refData as StockLog;
        return (
          <div className="space-y-6 font-sans">
            <div className="border-b border-slate-100 pb-4">
              <span className={`inline-block text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest ${
                log.type === 'in' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
              }`}>
                LEDGER: STOCK {log.type === 'in' ? 'INFLOW' : 'OUTFLOW'}
              </span>
              <h4 className="text-xl font-extrabold text-slate-900 mt-2">{log.modelName} ({log.color})</h4>
              <p className="text-xs text-slate-500 mt-0.5">Quantity Changed: {log.quantity} Units</p>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-xs space-y-3 text-slate-700">
              <div className="flex justify-between">
                <span>Operation Channel</span>
                <span className="font-bold text-slate-900 capitalize">{log.sourceChannel?.replace('_', ' ') || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span>Timestamp</span>
                <span className="font-bold text-slate-900 font-mono">{new Date(log.timestamp).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Responsible Operator</span>
                <span className="font-bold text-slate-900">{log.operator}</span>
              </div>
              {(log.billNo || log.stockInNo) && (
                <div className="border-t border-slate-200 pt-2.5 space-y-2">
                  {log.billNo && (
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-500">Bill Number</span>
                      <span className="font-extrabold text-slate-950 font-mono">{log.billNo}</span>
                    </div>
                  )}
                  {log.stockInNo && (
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-500">Stock IN Number</span>
                      <span className="font-extrabold text-slate-950 font-mono">{log.stockInNo}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {log.buyerName && (
              <div className="p-4 bg-cyan-50 border border-cyan-100 text-cyan-800 rounded-2xl text-xs">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-cyan-600 mb-0.5">Linked Customer / Buyer</span>
                <span className="font-bold text-sm flex items-center gap-1 mt-1">
                  <User className="h-4 w-4 text-cyan-600" />
                  {log.buyerName}
                </span>
              </div>
            )}

            {log.notes && (
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Ledger Remarks</span>
                <p className="text-xs text-slate-700 bg-white border border-slate-200 rounded-2xl p-4 italic">
                  {log.notes}
                </p>
              </div>
            )}
          </div>
        );
      }

      default:
        return <p className="text-xs text-slate-400">Detailed view currently unavailable for this category.</p>;
    }
  }, [selectedRegularResult, scooterUnits, buyers, products, batteryImports, chargerImports, stockLogs, batterySales, chargerSales]);

  // Parse all searchable index pools across the full system lifecycle
  const searchResults = useMemo(() => {
    const lowerQuery = query.toLowerCase().trim();
    const results: SearchResult[] = [];

    // --- 1. SCOOTER UNITS LINEAGE INDEXING ---
    scooterUnits.forEach(scoot => {
      const chassisMatch = scoot.chassisNo?.toLowerCase().includes(lowerQuery);
      const motorMatch = scoot.motorNo?.toLowerCase().includes(lowerQuery);
      const controllerMatch = scoot.controllerNo?.toLowerCase().includes(lowerQuery);
      const modelMatch = scoot.modelName?.toLowerCase().includes(lowerQuery);
      const colorMatch = scoot.color?.toLowerCase().includes(lowerQuery);
      const billMatch = scoot.billNo?.toLowerCase().includes(lowerQuery);
      const stockInMatch = scoot.stockInNo?.toLowerCase().includes(lowerQuery);
      const challanMatch = scoot.deliveryChallanNo?.toLowerCase().includes(lowerQuery);
      const salesBillMatch = scoot.salesBillNo?.toLowerCase().includes(lowerQuery);
      const buyerMatch = scoot.buyerName?.toLowerCase().includes(lowerQuery);
      const phoneMatch = scoot.buyerContact?.toLowerCase().includes(lowerQuery);

      // Battery & Charger Serials inside scooter
      const batterySerialMatch = scoot.batterySerials?.some(b => b.toLowerCase().includes(lowerQuery));
      const chargerSerialMatch = scoot.chargerSerial?.toLowerCase().includes(lowerQuery);

      let isCategoryMatch = false;
      if (searchCategory === 'all') isCategoryMatch = true;
      else if (searchCategory === 'chassis') isCategoryMatch = !!chassisMatch;
      else if (searchCategory === 'motor') isCategoryMatch = !!motorMatch;
      else if (searchCategory === 'controller') isCategoryMatch = !!controllerMatch;
      else if (searchCategory === 'battery') isCategoryMatch = !!batterySerialMatch;
      else if (searchCategory === 'charger') isCategoryMatch = !!chargerSerialMatch;
      else if (searchCategory === 'challan') isCategoryMatch = !!(billMatch || stockInMatch || challanMatch || salesBillMatch);
      else if (searchCategory === 'buyer') isCategoryMatch = !!(buyerMatch || phoneMatch);

      let isStatusMatch = false;
      if (statusFilter === 'all') isStatusMatch = true;
      else if (statusFilter === 'available') isStatusMatch = scoot.status === 'available';
      else if (statusFilter === 'hold') isStatusMatch = scoot.status === 'hold';
      else if (statusFilter === 'sold') isStatusMatch = scoot.status === 'sold';
      else if (statusFilter === 'under_claim' || statusFilter === 'resolved') {
        const hasClaim = warrantyClaims.some(c => c.originalSerialNo === scoot.chassisNo || c.originalSerialNo === scoot.motorNo || c.originalSerialNo === scoot.controllerNo);
        if (statusFilter === 'under_claim') isStatusMatch = hasClaim && warrantyClaims.some(c => c.status === 'under_repair');
        else isStatusMatch = hasClaim && warrantyClaims.some(c => c.status === 'repaired' || c.status === 'exchanged' || c.status === 'rejected');
      }

      if (isCategoryMatch && isStatusMatch) {
        let isTextMatch = !lowerQuery;
        if (lowerQuery) {
          isTextMatch = !!(chassisMatch || motorMatch || controllerMatch || modelMatch || colorMatch || billMatch || stockInMatch || challanMatch || salesBillMatch || buyerMatch || phoneMatch || batterySerialMatch || chargerSerialMatch);
        }

        if (isTextMatch) {
          let matchReason = `Chassis: ${scoot.chassisNo}`;
          if (chassisMatch) matchReason = `Chassis No: ${scoot.chassisNo}`;
          else if (motorMatch) matchReason = `Motor No: ${scoot.motorNo}`;
          else if (controllerMatch) matchReason = `Controller No: ${scoot.controllerNo}`;
          else if (batterySerialMatch) matchReason = `Attached Battery Serial: ${scoot.batterySerials.find(b => b.toLowerCase().includes(lowerQuery)) || scoot.batterySerials.join(', ')}`;
          else if (chargerSerialMatch) matchReason = `Attached Charger Serial: ${scoot.chargerSerial}`;
          else if (challanMatch) matchReason = `Delivery Challan No: ${scoot.deliveryChallanNo}`;
          else if (buyerMatch) matchReason = `Buyer: ${scoot.buyerName}`;

          const statusBadge = scoot.status === 'sold' ? 'DISPATCHED' : scoot.status === 'hold' ? 'RESERVED HOLD' : 'IN WAREHOUSE';
          const badgeColor = scoot.status === 'sold' ? 'bg-cyan-50 text-cyan-800 border-cyan-200' : scoot.status === 'hold' ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200';

          results.push({
            id: `scoot-${scoot.id}`,
            category: 'scooter',
            title: `Scooter: ${scoot.modelName} (${scoot.color})`,
            subtitle: `${matchReason} | Motor: ${scoot.motorNo || 'N/A'}`,
            badge: statusBadge,
            badgeColor: badgeColor,
            matchReason: matchReason,
            refData: scoot
          });
        }
      }
    });

    // --- 2. BATTERY SALES & IMPORT BATCHES INDEXING ---
    if (searchCategory === 'all' || searchCategory === 'battery' || searchCategory === 'challan' || searchCategory === 'buyer') {
      batterySales.forEach(sale => {
        const buyerMatch = sale.buyerName?.toLowerCase().includes(lowerQuery);
        const seriesMatch = sale.batterySeries?.toLowerCase().includes(lowerQuery);
        const challanMatch = sale.deliveryChallanNo?.toLowerCase().includes(lowerQuery);
        const serialMatch = sale.serialNumbers?.some(s => String(s).toLowerCase().includes(lowerQuery));

        let isTextMatch = !lowerQuery;
        if (lowerQuery) {
          isTextMatch = !!(buyerMatch || seriesMatch || challanMatch || serialMatch);
        }

        if (isTextMatch) {
          results.push({
            id: `batsale-${sale.id}`,
            category: 'battery',
            title: `Battery Pack Batch: ${sale.batterySeries} (${sale.quantity} Units)`,
            subtitle: `Buyer: ${sale.buyerName} | Serials: ${sale.startNo} - ${sale.endNo} | Challan: ${sale.deliveryChallanNo || 'N/A'}`,
            badge: sale.isUnderWarranty ? 'Warranty Active' : 'Battery Sale',
            badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
            refData: sale
          });
        }
      });
    }

    // --- 3. CHARGER SALES & IMPORT BATCHES INDEXING ---
    if (searchCategory === 'all' || searchCategory === 'charger' || searchCategory === 'challan' || searchCategory === 'buyer') {
      chargerSales.forEach(sale => {
        const buyerMatch = sale.buyerName?.toLowerCase().includes(lowerQuery);
        const typeMatch = sale.chargerType?.toLowerCase().includes(lowerQuery);
        const challanMatch = sale.deliveryChallanNo?.toLowerCase().includes(lowerQuery);
        const serialMatch = sale.serialNumbers?.some(s => String(s).toLowerCase().includes(lowerQuery));

        let isTextMatch = !lowerQuery;
        if (lowerQuery) {
          isTextMatch = !!(buyerMatch || typeMatch || challanMatch || serialMatch);
        }

        if (isTextMatch) {
          results.push({
            id: `chgsale-${sale.id}`,
            category: 'charger',
            title: `Charger Batch: ${sale.chargerType} (${sale.quantity} Units)`,
            subtitle: `Buyer: ${sale.buyerName} | Serials: ${sale.startNo || 'N/A'} - ${sale.endNo || 'N/A'} | Challan: ${sale.deliveryChallanNo || 'N/A'}`,
            badge: 'Charger Order',
            badgeColor: 'bg-amber-50 text-amber-800 border-amber-200',
            refData: sale
          });
        }
      });
    }

    // --- 4. SALES ORDERS INDEXING ---
    if (searchCategory === 'all' || searchCategory === 'challan' || searchCategory === 'buyer') {
      salesOrders.forEach(order => {
        const orderNoMatch = order.orderNo?.toLowerCase().includes(lowerQuery);
        const buyerMatch = order.buyerName?.toLowerCase().includes(lowerQuery);
        const salesPersonMatch = order.salespersonName?.toLowerCase().includes(lowerQuery);
        const challanMatch = order.challanNo?.toLowerCase().includes(lowerQuery);
        const billMatch = order.salesBillNo?.toLowerCase().includes(lowerQuery);
        const locationMatch = order.deliveryLocation?.toLowerCase().includes(lowerQuery);

        let isTextMatch = !lowerQuery;
        if (lowerQuery) {
          isTextMatch = !!(orderNoMatch || buyerMatch || salesPersonMatch || challanMatch || billMatch || locationMatch);
        }

        if (isTextMatch) {
          const durationInfo = formatDuration(order.createdTimestamp, order.dispatchedTimestamp || order.challanFinishedTimestamp);
          results.push({
            id: `order-${order.id}`,
            category: 'order',
            title: `B2B Order #${order.orderNo}: ${order.buyerName}`,
            subtitle: `Placed by: ${order.salespersonName} | Challan: ${order.challanNo || 'Pending'} | Processed in: ${durationInfo.text}`,
            badge: order.status.toUpperCase(),
            badgeColor: order.status === 'dispatched' ? 'bg-indigo-50 text-indigo-800 border-indigo-200' : 'bg-cyan-50 text-cyan-800 border-cyan-200',
            refData: order
          });
        }
      });
    }

    // --- 5. WARRANTY CLAIMS INDEXING ---
    if (searchCategory === 'all' || searchCategory === 'claim' || searchCategory === 'chassis' || searchCategory === 'battery' || searchCategory === 'charger' || searchCategory === 'buyer') {
      warrantyClaims.forEach(claim => {
        const serialMatch = claim.originalSerialNo?.toLowerCase().includes(lowerQuery);
        const buyerMatch = claim.buyerName?.toLowerCase().includes(lowerQuery);
        const issueMatch = claim.issueDescription?.toLowerCase().includes(lowerQuery);
        const actionMatch = claim.notes?.toLowerCase().includes(lowerQuery) || claim.specialistNotes?.toLowerCase().includes(lowerQuery);
        const newSerialMatch = claim.newSerialNo?.toLowerCase().includes(lowerQuery);

        let isTextMatch = !lowerQuery;
        if (lowerQuery) {
          isTextMatch = !!(serialMatch || buyerMatch || issueMatch || actionMatch || newSerialMatch);
        }

        if (isTextMatch) {
          const procTime = formatDuration(claim.claimDate, claim.lastUpdatedTimestamp);
          results.push({
            id: `claim-${claim.id}`,
            category: 'claim',
            title: `Warranty Claim Ticket #${claim.id.slice(0, 8)}: ${claim.originalSerialNo}`,
            subtitle: `Buyer: ${claim.buyerName} | Issue: ${claim.issueDescription} | Processed in: ${procTime.text}`,
            badge: claim.status.toUpperCase().replace('_', ' '),
            badgeColor: claim.status === 'under_repair' ? 'bg-rose-50 text-rose-800 border-rose-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200',
            refData: claim
          });
        }
      });
    }

    // --- 6. BUYER PROFILES INDEXING ---
    if (searchCategory === 'all' || searchCategory === 'buyer') {
      buyers.forEach(buyer => {
        const nameMatch = buyer.name?.toLowerCase().includes(lowerQuery);
        const contactMatch = buyer.contact?.toLowerCase().includes(lowerQuery);
        const addressMatch = buyer.address?.toLowerCase().includes(lowerQuery);

        let isTextMatch = !lowerQuery;
        if (lowerQuery) {
          isTextMatch = !!(nameMatch || contactMatch || addressMatch);
        }

        if (isTextMatch) {
          results.push({
            id: `buyer-${buyer.id}`,
            category: 'buyer',
            title: `Buyer Profile: ${buyer.name}`,
            subtitle: `Contact: ${buyer.contact || 'N/A'} | Location: ${buyer.address || 'No Address'}`,
            badge: 'Registered Buyer',
            badgeColor: 'bg-purple-50 text-purple-800 border-purple-200',
            refData: buyer
          });
        }
      });
    }

    return results;
  }, [query, searchCategory, statusFilter, scooterUnits, buyers, products, batteryImports, chargerImports, stockLogs, batterySales, chargerSales, salesOrders, warrantyClaims]);

  // Comprehensive Trail & Lifecycle Inspector Renderer
  const inspectorContent = useMemo(() => {
    if (!selectedResult) return null;

    const { category, refData } = selectedResult;

    if (category === 'scooter') {
      const scoot = refData as ScooterUnit;

      // Correlate matching sales order
      const matchingOrder = salesOrders.find(o => 
        o.items?.some(i => i.chassisNumbers?.includes(scoot.chassisNo)) || 
        (scoot.deliveryChallanNo && o.challanNo === scoot.deliveryChallanNo) ||
        (scoot.buyerName && o.buyerName?.toLowerCase() === scoot.buyerName?.toLowerCase())
      );

      // Correlate warranty claim
      const matchingClaim = warrantyClaims.find(c => 
        c.originalSerialNo === scoot.chassisNo || 
        c.originalSerialNo === scoot.motorNo || 
        c.originalSerialNo === scoot.controllerNo ||
        scoot.batterySerials?.includes(c.originalSerialNo) ||
        scoot.chargerSerial === c.originalSerialNo
      );

      // Calculate challan processed time
      const orderCreated = matchingOrder?.createdTimestamp || scoot.createdTimestamp;
      const orderDispatched = matchingOrder?.dispatchedTimestamp || scoot.saleDate || scoot.challanFinishedTimestamp;
      const challanProcessedTime = formatDuration(orderCreated, orderDispatched);

      // Claim processed time
      const claimProcessedTime = matchingClaim ? formatDuration(matchingClaim.claimDate, matchingClaim.lastUpdatedTimestamp) : null;

      return (
        <div className="space-y-6 font-sans">
          {/* Top Status Header */}
          <div className="p-4 bg-slate-900 text-white rounded-3xl shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border ${
                scoot.status === 'sold' ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/30' : scoot.status === 'hold' ? 'bg-amber-500/20 text-amber-300 border-amber-400/30' : 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
              }`}>
                {scoot.status === 'sold' ? '🚚 DISPATCHED & DELIVERED' : scoot.status === 'hold' ? '🤝 RESERVED ON HOLD' : '🏭 IN WAREHOUSE STOCK'}
              </span>
              <span className="text-[10px] font-mono font-bold text-slate-400">
                ID: {scoot.id}
              </span>
            </div>
            <h3 className="text-xl font-extrabold text-white tracking-tight">{scoot.modelName} — {scoot.color}</h3>
            <p className="text-xs text-slate-300 flex items-center gap-1.5 font-mono">
              <Hash className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
              <span>Chassis No: <strong>{scoot.chassisNo}</strong></span>
            </p>
          </div>

          {/* LINEAGE AUDIT TRAIL TIMELINE */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5 font-sans">
              <Clock className="h-4 w-4 text-cyan-600" />
              <span>Full Lifecycle Audit Lineage Trail</span>
            </h4>

            <div className="relative border-l-2 border-slate-200 ml-3.5 space-y-6 pl-5 pt-1">
              {/* STAGE 1: ORIGIN & IMPORT */}
              <div className="relative">
                <div className="absolute -left-[27px] top-0 h-3.5 w-3.5 rounded-full bg-slate-800 border-2 border-white ring-4 ring-slate-100" />
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider font-sans flex items-center gap-1">
                      <Box className="h-3.5 w-3.5 text-slate-700" />
                      1. Origin & Import Logistics (Where Bought)
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 font-bold">
                      {scoot.createdTimestamp ? new Date(scoot.createdTimestamp).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-slate-800 space-y-1">
                    <p>Source / Channel: <span className="text-cyan-700">{scoot.sourceChannel === 'local_seller' ? 'Local Indian Supplier' : 'Container Freight Import (Abroad)'}</span></p>
                    <p>Bill / Invoice No: <span className="font-mono text-slate-900">{scoot.billNo || 'N/A'}</span></p>
                    <p>Stock IN / Entry Challan: <span className="font-mono text-slate-900">{scoot.stockInNo || 'N/A'}</span></p>
                  </div>
                </div>
              </div>

              {/* STAGE 2: ASSEMBLY LINE */}
              <div className="relative">
                <div className="absolute -left-[27px] top-0 h-3.5 w-3.5 rounded-full bg-emerald-600 border-2 border-white ring-4 ring-emerald-100" />
                <div className="bg-emerald-50/50 border border-emerald-200/80 rounded-2xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold text-emerald-900 uppercase tracking-wider font-sans flex items-center gap-1">
                      <Wrench className="h-3.5 w-3.5 text-emerald-700" />
                      2. Assembly Station & Technical Specs
                    </span>
                    <span className="text-[10px] font-mono text-emerald-800 font-bold">
                      {scoot.createdTimestamp ? new Date(scoot.createdTimestamp).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 bg-white rounded-xl border border-emerald-100">
                      <span className="block text-[9px] font-bold text-slate-400 uppercase">Assembled By</span>
                      <span className="font-bold text-slate-800">{scoot.createdOperator || scoot.preparedBy || 'Factory Operator'}</span>
                    </div>
                    <div className="p-2 bg-white rounded-xl border border-emerald-100">
                      <span className="block text-[9px] font-bold text-slate-400 uppercase">Motor Serial #</span>
                      <span className="font-bold font-mono text-slate-800">{scoot.motorNo || 'N/A'}</span>
                    </div>
                    <div className="p-2 bg-white rounded-xl border border-emerald-100">
                      <span className="block text-[9px] font-bold text-slate-400 uppercase">Controller Serial #</span>
                      <span className="font-bold font-mono text-slate-800">{scoot.controllerNo || 'N/A'}</span>
                    </div>
                    <div className="p-2 bg-white rounded-xl border border-emerald-100">
                      <span className="block text-[9px] font-bold text-slate-400 uppercase">Tire Sizes</span>
                      <span className="font-bold text-slate-800">{scoot.frontTireSize || '12-inch'} Front / {scoot.rearTireSize || '12-inch'} Rear</span>
                    </div>
                  </div>

                  {scoot.batterySerials?.length > 0 && (
                    <div className="p-2 bg-white rounded-xl border border-emerald-100 text-xs">
                      <span className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Attached Battery Serials</span>
                      <div className="flex flex-wrap gap-1 font-mono font-bold text-emerald-800 text-[11px]">
                        {scoot.batterySerials.map((s, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-emerald-50 border border-emerald-200 rounded-md">
                            🔋 {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {scoot.chargerSerial && (
                    <div className="p-2 bg-white rounded-xl border border-emerald-100 text-xs">
                      <span className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Attached Charger Serial</span>
                      <span className="font-mono font-bold text-amber-800">🔌 {scoot.chargerSerial} ({scoot.chargerType || 'Standard'})</span>
                    </div>
                  )}
                </div>
              </div>

              {/* STAGE 3: SALES ORDER & BOOKING */}
              <div className="relative">
                <div className="absolute -left-[27px] top-0 h-3.5 w-3.5 rounded-full bg-cyan-600 border-2 border-white ring-4 ring-cyan-100" />
                <div className="bg-cyan-50/50 border border-cyan-200/80 rounded-2xl p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold text-cyan-900 uppercase tracking-wider font-sans flex items-center gap-1">
                      <ShoppingBag className="h-3.5 w-3.5 text-cyan-700" />
                      3. Sales Order & Booking (Who Placed Order)
                    </span>
                    <span className="text-[10px] font-mono text-cyan-800 font-bold">
                      {orderCreated ? new Date(orderCreated).toLocaleString() : 'N/A'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 bg-white rounded-xl border border-cyan-100">
                      <span className="block text-[9px] font-bold text-slate-400 uppercase">Salesperson Name</span>
                      <span className="font-bold text-slate-800">{matchingOrder?.salespersonName || scoot.createdOperator || 'Sales Representative'}</span>
                    </div>
                    <div className="p-2 bg-white rounded-xl border border-cyan-100">
                      <span className="block text-[9px] font-bold text-slate-400 uppercase">Sales Order No</span>
                      <span className="font-bold font-mono text-cyan-800">{matchingOrder?.orderNo || 'SO-DIRECT'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* STAGE 4: DISPATCH & CHALLAN PROCESSING TIME */}
              <div className="relative">
                <div className="absolute -left-[27px] top-0 h-3.5 w-3.5 rounded-full bg-indigo-600 border-2 border-white ring-4 ring-indigo-100" />
                <div className="bg-indigo-50/50 border border-indigo-200/80 rounded-2xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold text-indigo-900 uppercase tracking-wider font-sans flex items-center gap-1">
                      <Truck className="h-3.5 w-3.5 text-indigo-700" />
                      4. Dispatch & Delivery Challan Processing
                    </span>
                    <span className="text-[10px] font-mono text-indigo-800 font-bold">
                      {orderDispatched ? new Date(orderDispatched).toLocaleString() : 'Pending'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 bg-white rounded-xl border border-indigo-100">
                      <span className="block text-[9px] font-bold text-slate-400 uppercase">Dispatched By</span>
                      <span className="font-bold text-slate-800">{matchingOrder?.dispatchedBy || scoot.challanFinishedBy || scoot.lastUpdatedBy || 'Warehouse Dispatcher'}</span>
                    </div>
                    <div className="p-2 bg-white rounded-xl border border-indigo-100">
                      <span className="block text-[9px] font-bold text-slate-400 uppercase">Delivery Challan No</span>
                      <span className="font-bold font-mono text-indigo-800">{matchingOrder?.challanNo || scoot.deliveryChallanNo || 'N/A'}</span>
                    </div>
                  </div>

                  {/* CHALLAN PROCESSING TIME STAT */}
                  <div className="p-2.5 bg-gradient-to-r from-indigo-900 to-slate-900 text-white rounded-xl flex items-center justify-between text-xs font-sans">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-cyan-400 shrink-0" />
                      <div>
                        <span className="block text-[9px] uppercase font-extrabold text-slate-300">Challan Processing Time</span>
                        <span className="font-extrabold text-cyan-300 font-mono text-sm">{challanProcessedTime.text}</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-300 font-mono">
                      [ Order ➔ Dispatch ]
                    </span>
                  </div>
                </div>
              </div>

              {/* STAGE 5: BUYER & DELIVERY LOCATION */}
              <div className="relative">
                <div className="absolute -left-[27px] top-0 h-3.5 w-3.5 rounded-full bg-purple-600 border-2 border-white ring-4 ring-purple-100" />
                <div className="bg-purple-50/50 border border-purple-200/80 rounded-2xl p-3.5 space-y-1.5">
                  <span className="text-[10px] font-extrabold text-purple-900 uppercase tracking-wider font-sans flex items-center gap-1">
                    <User className="h-3.5 w-3.5 text-purple-700" />
                    5. Buyer & Destination Details
                  </span>

                  <div className="p-3 bg-white rounded-xl border border-purple-100 text-xs space-y-1 text-slate-800">
                    <p>Buyer Name: <strong>{scoot.buyerName || matchingOrder?.buyerName || 'Unassigned / Warehouse Stock'}</strong></p>
                    <p>Contact Phone: <strong className="font-mono">{scoot.buyerContact || matchingOrder?.buyerContact || 'N/A'}</strong></p>
                    <p className="flex items-start gap-1 pt-1 text-slate-600">
                      <MapPin className="h-3.5 w-3.5 text-purple-600 shrink-0 mt-0.5" />
                      <span>Destination Address: <strong>{matchingOrder?.deliveryLocation || 'Warehouse Pick-up Location'}</strong></span>
                    </p>
                  </div>
                </div>
              </div>

              {/* STAGE 6: WARRANTY CLAIMS & SOLUTION */}
              {matchingClaim ? (
                <div className="relative">
                  <div className="absolute -left-[27px] top-0 h-3.5 w-3.5 rounded-full bg-rose-600 border-2 border-white ring-4 ring-rose-100" />
                  <div className="bg-rose-50/80 border border-rose-200 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-rose-900 uppercase tracking-wider font-sans flex items-center gap-1">
                        <ShieldAlert className="h-4 w-4 text-rose-600" />
                        6. Warranty Claim Record & Solution
                      </span>
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase border ${
                        matchingClaim.status === 'under_repair' ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                      }`}>
                        {matchingClaim.status.toUpperCase().replace('_', ' ')}
                      </span>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-rose-100 text-xs space-y-1.5 font-sans">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Claim Date:</span>
                        <span className="font-bold font-mono">{new Date(matchingClaim.claimDate).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Claimed Component:</span>
                        <span className="font-bold text-rose-700 uppercase">{matchingClaim.claimedComponent || 'Entire Unit'}</span>
                      </div>
                      <div className="border-t border-slate-100 pt-1.5">
                        <span className="block text-[10px] font-bold text-slate-400 uppercase">Customer Reported Issue:</span>
                        <p className="font-semibold text-slate-800 bg-rose-50/50 p-2 rounded-lg border border-rose-100 mt-0.5">{matchingClaim.issueDescription}</p>
                      </div>

                      {/* CLAIM PROCESSING TIME */}
                      <div className="p-2 bg-slate-900 text-white rounded-lg flex items-center justify-between mt-2">
                        <span className="text-[10px] text-slate-300 font-bold uppercase">Claim Processing Duration:</span>
                        <span className="text-xs font-bold text-cyan-300 font-mono">{claimProcessedTime?.text || 'N/A'}</span>
                      </div>

                      {/* SOLUTION FOR THAT */}
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1 mt-2">
                        <span className="block text-[10px] font-extrabold text-emerald-900 uppercase tracking-wide flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          Solution Provided for Claim:
                        </span>
                        <p className="font-extrabold text-xs text-emerald-950">
                          {matchingClaim.actionTaken === 'exchanged' ? '🔄 Unit Exchanged with New Replacement Serial' : matchingClaim.actionTaken === 'repaired' ? '🔧 Component Repaired & Restored under Warranty' : matchingClaim.notes || matchingClaim.specialistNotes || 'Inspection & resolution completed'}
                        </p>
                        {matchingClaim.newSerialNo && (
                          <div className="mt-1.5 p-2 bg-white rounded-lg border border-emerald-300 text-xs font-mono font-bold text-emerald-900">
                            ✨ Replacement Serial Number Issued: <strong>{matchingClaim.newSerialNo}</strong>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute -left-[27px] top-0 h-3.5 w-3.5 rounded-full bg-slate-300 border-2 border-white ring-4 ring-slate-100" />
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-500 italic flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>No warranty claims recorded for this chassis, motor, or controller.</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (category === 'claim') {
      const claim = refData as WarrantyClaim;
      const procTime = formatDuration(claim.claimDate, claim.lastUpdatedTimestamp);

      return (
        <div className="space-y-6 font-sans">
          <div className="p-4 bg-rose-900 text-white rounded-3xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg bg-rose-500/30 border border-rose-400/40 text-rose-200">
                WARRANTY CLAIM TICKET
              </span>
              <span className="text-[10px] font-mono text-rose-300 font-bold">
                Ticket #{claim.id.slice(0, 8)}
              </span>
            </div>
            <h3 className="text-lg font-extrabold text-white">Component Serial: {claim.originalSerialNo}</h3>
            <p className="text-xs text-rose-200">Buyer Name: {claim.buyerName}</p>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 text-xs text-slate-800">
            <div>
              <span className="block text-[10px] font-bold text-slate-400 uppercase">Claim Filed Date</span>
              <span className="font-bold font-mono">{new Date(claim.claimDate).toLocaleString()}</span>
            </div>

            <div>
              <span className="block text-[10px] font-bold text-slate-400 uppercase">Reported Issue / Defect</span>
              <p className="p-2.5 bg-white rounded-xl border border-slate-200 font-medium mt-1">{claim.issueDescription}</p>
            </div>

            <div className="p-3 bg-slate-900 text-white rounded-xl flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase text-slate-300">Total Processed Time:</span>
              <span className="font-mono font-bold text-cyan-300 text-sm">{procTime.text}</span>
            </div>

            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1">
              <span className="block text-[10px] font-extrabold text-emerald-900 uppercase">Solution & Action Taken:</span>
              <p className="font-bold text-emerald-950 text-xs">
                {claim.actionTaken === 'exchanged' ? 'Unit Exchanged' : claim.actionTaken === 'repaired' ? 'Component Repaired' : claim.status}
              </p>
              {claim.specialistNotes && (
                <p className="text-xs text-slate-700 italic bg-white p-2 rounded-lg border border-emerald-100 mt-1">{claim.specialistNotes}</p>
              )}
              {claim.newSerialNo && (
                <p className="text-xs font-mono font-bold text-emerald-800 mt-1">Replacement Serial: {claim.newSerialNo}</p>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (category === 'order') {
      const order = refData as SalesOrder;
      const duration = formatDuration(order.createdTimestamp, order.dispatchedTimestamp || order.challanFinishedTimestamp);

      return (
        <div className="space-y-6 font-sans">
          <div className="p-4 bg-cyan-900 text-white rounded-3xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg bg-cyan-500/30 border border-cyan-400/40 text-cyan-200">
                SALES ORDER #{order.orderNo}
              </span>
              <span className="text-[10px] font-mono text-cyan-300 font-bold">
                {order.status.toUpperCase()}
              </span>
            </div>
            <h3 className="text-lg font-extrabold text-white">Buyer: {order.buyerName}</h3>
            <p className="text-xs text-cyan-200">Placed By Salesperson: {order.salespersonName} (@{order.salespersonUsername})</p>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 text-xs">
            <div className="flex justify-between border-b border-slate-200 pb-2">
              <span className="text-slate-500">Order Creation Timestamp:</span>
              <span className="font-bold font-mono">{new Date(order.createdTimestamp).toLocaleString()}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 pb-2">
              <span className="text-slate-500">Dispatch Timestamp:</span>
              <span className="font-bold font-mono">{order.dispatchedTimestamp ? new Date(order.dispatchedTimestamp).toLocaleString() : 'Pending'}</span>
            </div>
            <div className="p-3 bg-slate-900 text-white rounded-xl flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-300 uppercase">Challan Processing Time:</span>
              <span className="font-mono font-bold text-cyan-300 text-sm">{duration.text}</span>
            </div>

            <div className="space-y-2 pt-2">
              <span className="block text-[10px] font-extrabold text-slate-500 uppercase">Items Included on Delivery Challan ({order.challanNo || 'N/A'}):</span>
              {order.items?.map((item, idx) => (
                <div key={idx} className="p-2.5 bg-white rounded-xl border border-slate-200 space-y-1">
                  <div className="flex justify-between font-bold text-slate-800">
                    <span>{item.productName || item.batteryType || item.chargerType}</span>
                    <span>Qty: {item.quantity}</span>
                  </div>
                  {item.chassisNumbers && item.chassisNumbers.length > 0 && (
                    <div className="text-[10px] font-mono text-cyan-800">
                      Chassis #: {item.chassisNumbers.join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    // Default viewer
    return (
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs space-y-2">
        <h4 className="font-bold text-slate-900">{selectedResult.title}</h4>
        <p className="text-slate-600 font-mono">{selectedResult.subtitle}</p>
      </div>
    );
  }, [selectedResult, salesOrders, warrantyClaims]);

  return (
    <div className="space-y-6 font-sans max-w-7xl mx-auto" id="trail-search-console">
      {/* Top Section Mode Switcher Tabs */}
      <div className="flex items-center justify-between bg-slate-200/80 p-1.5 rounded-2xl border border-slate-300/70" id="search-mode-tabs">
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
          <button
            onClick={() => {
              setActiveMode('regular');
              setSelectedResult(null);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap ${
              activeMode === 'regular'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
            }`}
            id="tab-btn-regular-search"
          >
            <Search className="h-4 w-4 text-cyan-600" />
            <span>Regular Quick Search</span>
            <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono font-bold">
              {regularSearchResults.length}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveMode('purchase');
              setSelectedResult(null);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap ${
              activeMode === 'purchase'
                ? 'bg-amber-500 text-slate-950 shadow-sm border border-amber-400 font-extrabold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
            }`}
            id="tab-btn-purchase-search"
          >
            <Package className="h-4 w-4 text-slate-950" />
            <span>Purchase & Container Hierarchy Search</span>
            <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-200 text-amber-950 font-mono font-bold">
              New
            </span>
          </button>

          <button
            onClick={() => {
              setActiveMode('trail');
              setSelectedResult(null);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap ${
              activeMode === 'trail'
                ? 'bg-slate-900 text-white shadow-sm border border-slate-800'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
            }`}
            id="tab-btn-trail-audit"
          >
            <Clock className="h-4 w-4 text-cyan-400" />
            <span>Component Trail & Lifecycle Audit</span>
            <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-mono font-bold">
              {searchResults.length}
            </span>
          </button>
        </div>

        {onRefresh && (
          <button
            onClick={onRefresh}
            className="hidden sm:flex px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl border border-slate-300 items-center gap-1.5 cursor-pointer transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5 text-cyan-600" />
            <span>Refresh</span>
          </button>
        )}
      </div>

      {/* ================= SECTION 1: REGULAR QUICK SEARCH ================= */}
      {activeMode === 'regular' && (
        <div className="space-y-6" id="regular-search-section">
          {/* Main Controls Card */}
          <div className="p-5 sm:p-6 bg-white border border-slate-200 rounded-3xl shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <Search className="h-5 w-5 text-cyan-600" />
                  <span>Regular System Search</span>
                </h3>
                <p className="text-xs text-slate-500 font-sans mt-0.5">
                  Select a category target from the dropdown and type your search query.
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-slate-400 bg-slate-50 px-3 py-1 rounded-xl border border-slate-200 self-start sm:self-auto">
                {regularSearchResults.length} Results Found
              </span>
            </div>

            {/* ONE Dropdown + ONE Search Input Container */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-1">
              {/* Single Dropdown Target Select */}
              <div className="md:col-span-4 lg:col-span-3">
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1 font-sans">
                  Target Category Dropdown:
                </label>
                <div className="relative">
                  <select
                    value={regularCategory}
                    onChange={(e) => setRegularCategory(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-slate-200 focus:border-cyan-500 text-slate-800 font-bold text-xs rounded-2xl px-3.5 py-3 outline-none appearance-none cursor-pointer transition-all pr-8"
                    id="regular-search-category-select"
                  >
                    <option value="all">🔍 All Categories</option>
                    <option value="scooter">🛴 Scooters & EV Units</option>
                    <option value="battery">🔋 Battery Stock & Sales</option>
                    <option value="charger">🔌 Charger Stock & Sales</option>
                    <option value="order">📦 B2B Sales Orders & Challans</option>
                    <option value="claim">🛡️ Warranty Claims</option>
                    <option value="buyer">👤 Buyer Directory</option>
                    <option value="log">📜 Inventory Audit Logs</option>
                  </select>
                  <div className="absolute right-3 top-3.5 pointer-events-none text-slate-400 text-xs font-bold">
                    ▼
                  </div>
                </div>
              </div>

              {/* Single Search Text Input Box */}
              <div className="md:col-span-8 lg:col-span-9">
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1 font-sans">
                  Search Query Input:
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-cyan-600" />
                  </span>
                  <input
                    type="text"
                    value={regularQuery}
                    onChange={(e) => setRegularQuery(e.target.value)}
                    placeholder="Search chassis #, motor #, buyer name, model, serial #, order #..."
                    className="w-full bg-slate-50 border-2 border-slate-200 focus:border-cyan-500 text-slate-800 placeholder-slate-400 pl-10 pr-10 py-2.5 sm:py-2.5 rounded-2xl text-xs sm:text-sm font-semibold outline-none transition-all font-sans shadow-2xs"
                    id="regular-search-input-box"
                  />
                  {regularQuery && (
                    <button
                      onClick={() => setRegularQuery('')}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer font-bold text-xs"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Results List View */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500 font-sans flex items-center gap-1.5">
                <ClipboardList className="h-4 w-4 text-cyan-600" />
                <span>Search Results List ({regularSearchResults.length})</span>
              </span>
            </div>

            {regularSearchResults.length > 0 ? (
              <div className="divide-y divide-slate-100" id="regular-results-list">
                {regularSearchResults.map((res) => (
                  <div
                    key={res.id}
                    onClick={() => setSelectedRegularResult(res)}
                    className="py-3.5 px-3 hover:bg-slate-50 border border-transparent hover:border-slate-200 rounded-2xl transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer group"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono border border-slate-200">
                          {res.categoryLabel || res.category}
                        </span>
                        <h4 className="text-sm font-black text-slate-900 group-hover:text-cyan-600 transition-colors truncate">
                          {res.primaryTitle || res.title}
                        </h4>
                      </div>
                      <p className="text-xs text-slate-600 font-mono truncate">
                        {res.secondaryDetails || res.subtitle}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                      <span className="text-[11px] text-slate-400 font-mono font-bold">
                        {res.dateStr || 'N/A'}
                      </span>
                      <span className={`text-[10px] font-black px-2.5 py-1 rounded-xl uppercase tracking-wider ${res.badgeClass || res.badgeColor}`}>
                        {res.badge}
                      </span>
                      <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-600 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center" id="regular-no-results">
                <AlertCircle className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                <h4 className="text-xs font-bold text-slate-700 font-sans">No matching results</h4>
                <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto font-sans">
                  No records match "{regularQuery}" in the selected dropdown category. Try choosing "All Categories" or adjusting your search term.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= SECTION: PURCHASE & CONTAINER HIERARCHY SEARCH ================= */}
      {activeMode === 'purchase' && (
        <div className="space-y-6" id="purchase-search-section">
          {/* Header Card */}
          <div className="p-6 bg-gradient-to-r from-amber-600 via-amber-700 to-amber-900 text-white rounded-3xl shadow-lg space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <span className="px-3 py-1 bg-amber-400/20 text-amber-200 rounded-full text-[10px] font-black uppercase tracking-widest border border-amber-300/30 inline-block font-mono">
                  📦 INTERNATIONAL CONTAINER & PURCHASE SEARCH
                </span>
                <h2 className="text-2xl font-black text-white tracking-tight">Bill Number ➔ Stock IN / Invoice Flowchart</h2>
                <p className="text-xs text-amber-100 max-w-2xl">
                  Search any Bill Number to inspect all associated Stock IN / Invoices. Click any Stock IN number to view the complete model breakdown (e.g. 10 Black, 10 White), quantity, date logged, and shortage/missing part records.
                </p>
              </div>
            </div>

            {/* Purchase Search Input */}
            <div className="relative pt-2 w-full min-w-0">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none pt-2">
                <Search className="h-4 w-4 sm:h-5 sm:w-5 text-amber-200" />
              </div>
              <input
                type="text"
                placeholder="Type Bill Number (e.g. BILL-2026-088) or Stock IN / Invoice No (e.g. STKIN-1001)..."
                value={purchaseQuery}
                onChange={(e) => setPurchaseQuery(e.target.value)}
                className="w-full bg-amber-950/60 border-2 border-amber-500/50 focus:border-amber-300 text-white placeholder-amber-200/60 pl-10 sm:pl-11 pr-3 sm:pr-4 py-2.5 sm:py-3.5 rounded-2xl text-xs sm:text-sm font-semibold outline-none transition-all font-sans shadow-inner min-w-0"
                id="purchase-search-input"
              />
              {purchaseQuery && (
                <button
                  onClick={() => setPurchaseQuery('')}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-amber-200 hover:text-white cursor-pointer font-bold text-xs pt-2"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Container Hierarchy Tree List */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-xs font-black uppercase tracking-wider text-slate-700 font-sans flex items-center gap-1.5">
                <Package className="h-4 w-4 text-amber-600" />
                <span>Container Bill Hierarchy ({purchaseHierarchy.length} Container Bills)</span>
              </span>
            </div>

            {purchaseHierarchy.length > 0 ? (
              <div className="space-y-4" id="purchase-hierarchy-tree">
                {purchaseHierarchy.map((b) => (
                  <div key={b.billNo} className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 space-y-3">
                    {/* Bill Level Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 font-mono">
                          BILL NO
                        </span>
                        <h3 className="text-base font-black text-slate-900 font-mono tracking-tight">
                          {b.billNo}
                        </h3>
                        {b.supplierList.length > 0 && (
                          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 flex items-center gap-1 font-sans">
                            <span>🏢 Supplier:</span>
                            <strong>{b.supplierList.join(', ')}</strong>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-bold text-slate-600 bg-white px-3 py-1 rounded-xl border border-slate-200 font-mono">
                          {b.stockInList.length} Stock IN / Invoices
                        </span>
                        <span className="font-extrabold text-slate-900 bg-amber-200/80 text-amber-950 px-3 py-1 rounded-xl border border-amber-300 font-mono">
                          {b.totalUnits} Total Units
                        </span>
                      </div>
                    </div>

                    {/* Stock IN / Invoices Flowchart Branch */}
                    <div className="pl-2 sm:pl-4 border-l-2 border-amber-400/60 space-y-3">
                      {b.stockInList.map((stk) => {
                        const isExpanded = expandedStockInNo === stk.stockInNo;
                        return (
                          <div key={stk.stockInNo} className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs space-y-2">
                            <div
                              onClick={() => setExpandedStockInNo(isExpanded ? null : stk.stockInNo)}
                              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 cursor-pointer hover:bg-amber-50/40 p-1.5 rounded-lg transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black px-2 py-0.5 rounded bg-slate-900 text-white font-mono">
                                  STK IN NO
                                </span>
                                <span className="text-xs font-black text-slate-900 font-mono">
                                  {stk.stockInNo}
                                </span>
                                {stk.shortages.length > 0 && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">
                                    <AlertCircle className="h-3 w-3 text-rose-600" />
                                    <span>Part Discrepancy / Shortage Reported</span>
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-3">
                                <span className="text-xs font-extrabold text-slate-700 font-mono">
                                  {stk.totalQty} Units Logged
                                </span>
                                <span className="text-[11px] font-bold text-cyan-700 bg-cyan-50 px-2.5 py-1 rounded-lg border border-cyan-200">
                                  {isExpanded ? 'Hide Details ▲' : 'View Models & Shortages ▼'}
                                </span>
                              </div>
                            </div>

                            {/* Expanded Stock IN Details */}
                            {isExpanded && (
                              <div className="pt-2 border-t border-slate-100 space-y-3 font-sans text-xs bg-slate-50/80 p-3 rounded-lg">
                                {/* Variant Model & Color Breakdown */}
                                <div className="space-y-1">
                                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                    Unpacked Model & Color Quantity Breakdown:
                                  </span>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                                    {Object.entries(stk.variantBreakdown).map(([variantKey, count]) => (
                                      <div key={variantKey} className="bg-white p-2 border border-slate-200 rounded-lg flex items-center justify-between">
                                        <span className="font-bold text-slate-800">{variantKey}</span>
                                        <span className="font-mono font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                          {count} units
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {/* Shortage / Missing Part Notes */}
                                {stk.shortages.length > 0 && (
                                  <div className="bg-rose-50 border border-rose-200 rounded-lg p-2.5 space-y-1">
                                    <span className="text-[10px] font-black uppercase text-rose-800 tracking-wide flex items-center gap-1">
                                      <AlertCircle className="h-3.5 w-3.5 text-rose-600" />
                                      <span>Recorded Shortages & Missing Components:</span>
                                    </span>
                                    {stk.shortages.map((sh, idx) => (
                                      <p key={idx} className="text-xs font-medium text-rose-900 font-sans pl-4">
                                        • {sh}
                                      </p>
                                    ))}
                                  </div>
                                )}

                                {/* Logging Info */}
                                <div className="text-[10px] font-mono text-slate-500 flex flex-wrap items-center justify-between gap-1 pt-1 border-t border-slate-200/60">
                                  <span>Logged by: {stk.operator} {stk.supplierName ? `| Supplier: ${stk.supplierName}` : ''}</span>
                                  <span>Date: {stk.dateLogged ? new Date(stk.dateLogged).toLocaleString() : 'N/A'}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center" id="purchase-no-results">
                <AlertCircle className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                <h4 className="text-xs font-bold text-slate-700 font-sans">No matching purchase or container records</h4>
                <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto font-sans">
                  No container bills or stock IN numbers match "{purchaseQuery}". Try entering a Bill Number or logging a purchase in the Purchase section.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= SECTION 2: COMPONENT TRAIL & AUDIT SYSTEM ================= */}
      {activeMode === 'trail' && (
        <div className="space-y-6" id="trail-search-section">
          {/* Header Banner */}
          <div className="p-6 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-3xl shadow-lg space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <span className="px-3 py-1 bg-cyan-500/20 text-cyan-300 rounded-full text-[10px] font-black uppercase tracking-widest border border-cyan-400/30 inline-block font-mono">
                  ⚡ AUDIT TRAIL & LINEAGE SEARCH
                </span>
                <h2 className="text-2xl font-black text-white tracking-tight">Full Lifecycle Trail Search Engine</h2>
                <p className="text-xs text-slate-300 max-w-2xl">
                  Search any Chassis No, Motor No, Controller No, Battery Serial/Series, Charger Serial, Buyer, or Challan to trace origin, assembly, salesperson order, dispatcher, delivery, and warranty claim solutions.
                </p>
              </div>
            </div>

            {/* Search Bar Input */}
            <div className="relative pt-2 w-full min-w-0">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none pt-2">
                <Search className="h-4 w-4 sm:h-5 sm:w-5 text-cyan-400" />
              </div>
              <input
                type="text"
                placeholder="Search Chassis #, Motor #, Controller #, Battery, Charger, Buyer, Challan..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-slate-800/90 border-2 border-slate-700 focus:border-cyan-400 text-white placeholder-slate-400 pl-10 sm:pl-11 pr-3 sm:pr-4 py-2.5 sm:py-3.5 rounded-2xl text-xs sm:text-sm font-semibold outline-none transition-all font-sans shadow-inner min-w-0"
                id="trail-search-input"
              />
            </div>

            {/* FILTER BAR 1: Category Filter Buttons */}
            <div className="pt-2 flex flex-wrap items-center gap-1.5 max-w-full overflow-x-auto pb-0.5" id="category-filter-bar">
              <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wide mr-1 shrink-0">Component:</span>
              {[
                { id: 'all', label: '🔍 All Records', icon: Search },
                { id: 'chassis', label: '🛴 Scooter Chassis No', icon: Hash },
                { id: 'motor', label: '⚙️ Motor No', icon: Cpu },
                { id: 'controller', label: '📟 Controller No', icon: Cpu },
                { id: 'battery', label: '🔋 Battery Serial / Series', icon: Battery },
                { id: 'charger', label: '🔌 Charger Serial / Type', icon: Zap },
                { id: 'claim', label: '🛡️ Warranty Claim', icon: ShieldAlert },
                { id: 'challan', label: '📋 Challan / Invoice #', icon: FileText },
                { id: 'buyer', label: '👤 Buyer Profile', icon: User }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setSearchCategory(f.id)}
                  className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                    searchCategory === f.id
                      ? 'bg-cyan-500 text-slate-950 shadow-sm'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                  }`}
                >
                  <span>{f.label}</span>
                </button>
              ))}
            </div>

            {/* FILTER BAR 2: Status Filter */}
            <div className="pt-1 flex flex-wrap items-center gap-1.5 max-w-full overflow-x-auto pb-0.5" id="status-filter-bar">
              <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wide mr-1 shrink-0">Status:</span>
              {[
                { id: 'all', label: 'All Statuses' },
                { id: 'available', label: '🏭 In Stock' },
                { id: 'hold', label: '🤝 On Hold' },
                { id: 'sold', label: '🚚 Sold' },
                { id: 'under_claim', label: '🛡️ Under Claim' },
                { id: 'resolved', label: '✅ Claim Resolved' }
              ].map(s => (
                <button
                  key={s.id}
                  onClick={() => setStatusFilter(s.id)}
                  className={`px-2 sm:px-2.5 py-1 rounded-lg text-[10px] sm:text-[11px] font-bold transition-all cursor-pointer shrink-0 ${
                    statusFilter === s.id
                      ? 'bg-cyan-400/20 text-cyan-300 border border-cyan-400/50'
                      : 'bg-slate-800/60 text-slate-400 hover:text-white border border-slate-700/60'
                  }`}
                >
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* RESULTS GRID / LIST */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4" id="trail-search-results-container">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500 font-sans flex items-center gap-1.5">
                <ClipboardList className="h-4 w-4 text-cyan-600" />
                <span>Matched Trace Records ({searchResults.length})</span>
              </span>
              <span className="text-xs font-bold text-slate-400">Click any card for full step-by-step trail & solutions</span>
            </div>

            {searchResults.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3" id="results-grid">
                {searchResults.map((result) => (
                  <motion.div
                    key={result.id}
                    whileHover={{ scale: 1.01 }}
                    onClick={() => setSelectedResult(result)}
                    className="p-4 bg-slate-50 hover:bg-cyan-50/50 border border-slate-200/80 hover:border-cyan-300 rounded-2xl cursor-pointer transition-all space-y-2 group shadow-2xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <span className="text-[10px] font-extrabold uppercase text-cyan-700 font-mono tracking-wide">
                          {result.category.toUpperCase()}
                        </span>
                        <h4 className="text-sm font-black text-slate-900 group-hover:text-cyan-900 truncate">
                          {result.title}
                        </h4>
                      </div>
                      <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-lg border uppercase tracking-wider ${result.badgeColor}`}>
                        {result.badge}
                      </span>
                    </div>

                    <p className="text-xs font-mono font-medium text-slate-600 truncate">
                      {result.subtitle}
                    </p>

                    <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-cyan-700 font-bold">
                      <span>View Complete Audit Trail ➔</span>
                      <ChevronRight className="h-4 w-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center" id="search-no-results">
                <AlertCircle className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                <h4 className="text-xs font-bold text-slate-700 font-sans">No trace records found</h4>
                <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto font-sans">
                  No matching chassis, motor, controller, battery, charger, buyer, or claim records match "{query}". Try clearing filters or entering a serial number.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Slide-over Inspection Drawer (strictly for Regular Search mode) */}
      <AnimatePresence>
        {selectedRegularResult && activeMode === 'regular' && (
          <div className="fixed inset-0 z-50 flex justify-end" id="regular-inspector-overlay-container">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedRegularResult(null)}
              className="absolute inset-0 bg-slate-900 cursor-pointer"
            />

            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 220 }}
              className="relative w-full max-w-xl bg-white h-full shadow-2xl flex flex-col z-10 border-l border-slate-200"
              id="regular-inspector-drawer"
            >
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-cyan-300 font-sans">Record Inspection</span>
                  <div className="h-3 w-[1px] bg-slate-700"></div>
                  <span className="text-[10px] font-bold text-slate-300 uppercase font-mono">{selectedRegularResult.categoryLabel || selectedRegularResult.category}</span>
                </div>
                <button
                  onClick={() => setSelectedRegularResult(null)}
                  className="p-1.5 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1 font-sans"
                >
                  <ArrowRight className="h-4 w-4" />
                  <span>Close</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {regularInspectorContent}
              </div>

              <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2 shrink-0">
                <button
                  onClick={() => setSelectedRegularResult(null)}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl font-sans cursor-pointer transition-colors shadow-sm"
                >
                  Close Record
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Slide-over Lineage Inspection Drawer (strictly for Trail mode) */}
      <AnimatePresence>
        {selectedResult && activeMode === 'trail' && (
          <div className="fixed inset-0 z-50 flex justify-end" id="inspector-overlay-container">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedResult(null)}
              className="absolute inset-0 bg-slate-900 cursor-pointer"
            />

            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 220 }}
              className="relative w-full max-w-xl bg-white h-full shadow-2xl flex flex-col z-10 border-l border-slate-200"
              id="inspector-drawer"
            >
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-cyan-300 font-sans">Lineage Trail Inspection</span>
                  <div className="h-3 w-[1px] bg-slate-700"></div>
                  <span className="text-[10px] font-bold text-slate-300 uppercase font-mono">{selectedResult.category}</span>
                </div>
                <button
                  onClick={() => setSelectedResult(null)}
                  className="p-1.5 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1 font-sans"
                >
                  <ArrowRight className="h-4 w-4" />
                  <span>Close</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {inspectorContent}
              </div>

              <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2 shrink-0">
                <button
                  onClick={() => setSelectedResult(null)}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl font-sans cursor-pointer transition-colors shadow-sm"
                >
                  Close Inspection
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
