import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, FileText, User, Tag, Clock, Calendar, Shield, MapPin, 
  Battery, Zap, ClipboardList, Info, HelpCircle, ArrowRight, ArrowLeft,
  ChevronRight, Box, ShoppingBag, Ship, Store, CheckCircle, AlertCircle
} from 'lucide-react';
import { 
  ScooterUnit, StockLog, BatteryImport, ChargerImport, Buyer, Product, BatterySale, ChargerSale 
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
  currentUser: { username: string; role: string };
  onRefresh?: () => void;
}

type SearchResultCategory = 'scooter' | 'buyer' | 'bill' | 'stock_in' | 'model' | 'stock_log';

interface SearchResult {
  id: string;
  category: SearchResultCategory;
  title: string;
  subtitle: string;
  badge: string;
  badgeColor: string;
  refData: any;
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
  currentUser
}: SearchConsoleProps) {
  const [query, setQuery] = useState('');
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);

  // Parse all searchable index pools
  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    
    const lowerQuery = query.toLowerCase().trim();
    const results: SearchResult[] = [];

    // --- 1. SCOOTER UNITS INDEXING ---
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
        if (chassisMatch) matchReason = `Chassis: ${scoot.chassisNo}`;
        else if (motorMatch) matchReason = `Motor: ${scoot.motorNo}`;
        else if (controllerMatch) matchReason = `Controller: ${scoot.controllerNo}`;
        else if (billMatch) matchReason = `Bill #: ${scoot.billNo}`;
        else if (stockInMatch) matchReason = `Stock IN: ${scoot.stockInNo}`;
        else if (buyerMatch) matchReason = `Buyer: ${scoot.buyerName}`;
        else matchReason = `${scoot.modelName} (${scoot.color})`;

        results.push({
          id: `scoot-${scoot.id}`,
          category: 'scooter',
          title: `Scooter: ${scoot.modelName} (${scoot.color})`,
          subtitle: matchReason,
          badge: scoot.status === 'sold' ? 'Sold' : 'Available',
          badgeColor: scoot.status === 'sold' ? 'bg-cyan-50 text-cyan-700 border-cyan-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100',
          refData: scoot
        });
      }
    });

    // --- 2. BUYERS INDEXING ---
    buyers.forEach(buyer => {
      const nameMatch = buyer.name?.toLowerCase().includes(lowerQuery);
      const contactMatch = buyer.contact?.toLowerCase().includes(lowerQuery);
      const addressMatch = buyer.address?.toLowerCase().includes(lowerQuery);

      if (nameMatch || contactMatch || addressMatch) {
        results.push({
          id: `buyer-${buyer.id}`,
          category: 'buyer',
          title: buyer.name,
          subtitle: `Contact: ${buyer.contact || 'N/A'} | ${buyer.address || 'No Address'}`,
          badge: 'Buyer Profile',
          badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-100',
          refData: buyer
        });
      }
    });

    // --- 3. MODELS / BLUEPRINTS INDEXING ---
    products.forEach(p => {
      if (p.name.toLowerCase().includes(lowerQuery)) {
        results.push({
          id: `prod-${p.id}`,
          category: 'model',
          title: p.name,
          subtitle: `Blueprint Colors: ${p.colors.join(', ')}`,
          badge: 'Model Blueprint',
          badgeColor: 'bg-amber-50 text-amber-700 border-amber-100',
          refData: p
        });
      }
    });

    // --- 4. UNIQUE BILL NUMBERS INDEXING ---
    const seenBills = new Set<string>();
    
    // Find bills in scooterUnits
    scooterUnits.forEach(s => {
      if (s.billNo && s.billNo.toLowerCase().includes(lowerQuery) && !seenBills.has(s.billNo)) {
        seenBills.add(s.billNo);
        results.push({
          id: `bill-${s.billNo}`,
          category: 'bill',
          title: `Bill Ref: ${s.billNo}`,
          subtitle: 'Associated with domestic/imported scooter units',
          badge: 'Bill #',
          badgeColor: 'bg-rose-50 text-rose-700 border-rose-100',
          refData: { billNo: s.billNo }
        });
      }
    });

    // Find bills in batteryImports
    batteryImports.forEach(b => {
      if (b.billNo && b.billNo.toLowerCase().includes(lowerQuery) && !seenBills.has(b.billNo)) {
        seenBills.add(b.billNo);
        results.push({
          id: `bill-${b.billNo}`,
          category: 'bill',
          title: `Bill Ref: ${b.billNo}`,
          subtitle: `Associated with battery imports (${b.batterySeries} Series)`,
          badge: 'Bill #',
          badgeColor: 'bg-rose-50 text-rose-700 border-rose-100',
          refData: { billNo: b.billNo }
        });
      }
    });

    // Find bills in chargerImports
    chargerImports.forEach(c => {
      if (c.billNo && c.billNo.toLowerCase().includes(lowerQuery) && !seenBills.has(c.billNo)) {
        seenBills.add(c.billNo);
        results.push({
          id: `bill-${c.billNo}`,
          category: 'bill',
          title: `Bill Ref: ${c.billNo}`,
          subtitle: `Associated with charger imports (${c.chargerType})`,
          badge: 'Bill #',
          badgeColor: 'bg-rose-50 text-rose-700 border-rose-100',
          refData: { billNo: c.billNo }
        });
      }
    });

    // Find bills in general stock logs
    stockLogs.forEach(l => {
      if (l.billNo && l.billNo.toLowerCase().includes(lowerQuery) && !seenBills.has(l.billNo)) {
        seenBills.add(l.billNo);
        results.push({
          id: `bill-${l.billNo}`,
          category: 'bill',
          title: `Bill Ref: ${l.billNo}`,
          subtitle: `General Stock Log: ${l.modelName} ${l.color}`,
          badge: 'Bill #',
          badgeColor: 'bg-rose-50 text-rose-700 border-rose-100',
          refData: { billNo: l.billNo }
        });
      }
    });

    // --- 5. UNIQUE STOCK IN NUMBERS INDEXING ---
    const seenStockIn = new Set<string>();
    
    // Find in scooterUnits
    scooterUnits.forEach(s => {
      if (s.stockInNo && s.stockInNo.toLowerCase().includes(lowerQuery) && !seenStockIn.has(s.stockInNo)) {
        seenStockIn.add(s.stockInNo);
        results.push({
          id: `stkin-${s.stockInNo}`,
          category: 'stock_in',
          title: `Stock IN Ref: ${s.stockInNo}`,
          subtitle: 'Associated with assembled scooter stock procurement',
          badge: 'Stock IN #',
          badgeColor: 'bg-violet-50 text-violet-700 border-violet-100',
          refData: { stockInNo: s.stockInNo }
        });
      }
    });

    // Find in batteryImports
    batteryImports.forEach(b => {
      if (b.stockInNo && b.stockInNo.toLowerCase().includes(lowerQuery) && !seenStockIn.has(b.stockInNo)) {
        seenStockIn.add(b.stockInNo);
        results.push({
          id: `stkin-${b.stockInNo}`,
          category: 'stock_in',
          title: `Stock IN Ref: ${b.stockInNo}`,
          subtitle: `Associated with battery imports (${b.batterySeries} Series)`,
          badge: 'Stock IN #',
          badgeColor: 'bg-violet-50 text-violet-700 border-violet-100',
          refData: { stockInNo: b.stockInNo }
        });
      }
    });

    // Find in chargerImports
    chargerImports.forEach(c => {
      if (c.stockInNo && c.stockInNo.toLowerCase().includes(lowerQuery) && !seenStockIn.has(c.stockInNo)) {
        seenStockIn.add(c.stockInNo);
        results.push({
          id: `stkin-${c.stockInNo}`,
          category: 'stock_in',
          title: `Stock IN Ref: ${c.stockInNo}`,
          subtitle: `Associated with charger imports (${c.chargerType})`,
          badge: 'Stock IN #',
          badgeColor: 'bg-violet-50 text-violet-700 border-violet-100',
          refData: { stockInNo: c.stockInNo }
        });
      }
    });

    // Find in stockLogs
    stockLogs.forEach(l => {
      if (l.stockInNo && l.stockInNo.toLowerCase().includes(lowerQuery) && !seenStockIn.has(l.stockInNo)) {
        seenStockIn.add(l.stockInNo);
        results.push({
          id: `stkin-${l.stockInNo}`,
          category: 'stock_in',
          title: `Stock IN Ref: ${l.stockInNo}`,
          subtitle: `General Stock Log: ${l.modelName} ${l.color}`,
          badge: 'Stock IN #',
          badgeColor: 'bg-violet-50 text-violet-700 border-violet-100',
          refData: { stockInNo: l.stockInNo }
        });
      }
    });

    // --- 6. GENERAL STOCK LOGS INDEXING ---
    stockLogs.forEach(log => {
      const modelMatch = log.modelName?.toLowerCase().includes(lowerQuery);
      const colorMatch = log.color?.toLowerCase().includes(lowerQuery);
      const buyerMatch = log.buyerName?.toLowerCase().includes(lowerQuery);
      const noteMatch = log.notes?.toLowerCase().includes(lowerQuery);

      if (modelMatch || colorMatch || buyerMatch || noteMatch) {
        results.push({
          id: `log-${log.id}`,
          category: 'stock_log',
          title: `Stock Log: ${log.modelName} (${log.color})`,
          subtitle: `${log.type === 'in' ? 'INFLOW' : 'OUTFLOW'} | Qty: ${log.quantity} | Operator: ${log.operator}`,
          badge: log.type === 'in' ? 'Ledger IN' : 'Ledger OUT',
          badgeColor: log.type === 'in' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100',
          refData: log
        });
      }
    });

    return results;
  }, [query, scooterUnits, buyers, products, batteryImports, chargerImports, stockLogs]);

  // Deep detail inspectors for selected entities
  const inspectorContent = useMemo(() => {
    if (!selectedResult) return null;

    const { category, refData, title } = selectedResult;

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
        
        // Find all history
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

            {/* Past History Sections */}
            <div className="space-y-4">
              <h5 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Past Procurement History</h5>

              {/* 1. Scooters Owned */}
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

              {/* 2. Batteries Owned */}
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
                        {b.notes && (
                          <p className="text-[10px] text-slate-500 bg-slate-50 p-1.5 rounded-xl italic">
                            Notes: {b.notes}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 bg-slate-50 p-3 border border-dashed border-slate-200 rounded-2xl italic">
                    No registered battery sales associated with this buyer.
                  </p>
                )}
              </div>

              {/* 3. Chargers Owned */}
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
        
        // Find everything with this bill number
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

              {/* Scooters Linked */}
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

              {/* Battery Imports Linked */}
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

              {/* Charger Imports Linked */}
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

              {/* General Stock Logs Linked */}
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

        // Find everything with this Stock IN number
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

              {/* Scooters Linked */}
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

              {/* Battery Imports Linked */}
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

              {/* Charger Imports Linked */}
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

              {/* General Stock Logs Linked */}
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
  }, [selectedResult, scooterUnits, buyers, products, batteryImports, chargerImports, stockLogs, batterySales, chargerSales]);

  return (
    <div className="space-y-6" id="search-workspace">
      {/* Header Info */}
      <div className="bg-slate-900 rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-sm" id="search-banner">
        <div className="absolute right-0 bottom-0 translate-x-12 translate-y-12 opacity-15 select-none pointer-events-none">
          <Search className="h-64 w-64 text-white" />
        </div>
        <div className="relative z-10 max-w-xl">
          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-widest px-3 py-1 bg-cyan-500/20 text-cyan-300 rounded-full mb-3">
            <Search className="h-3.5 w-3.5" />
            Universal Search Engine
          </span>
          <h2 className="text-2xl font-black tracking-tight font-sans">
            Search anything. Find everything.
          </h2>
          <p className="text-xs text-slate-300 mt-1.5 leading-relaxed font-sans">
            Instantly query any chassis number, bill number, stock-in number, buyer details, model variant, or historical logs. Click any record to inspect connected details, past purchase records, or imports.
          </p>
        </div>
      </div>

      {/* Main Search Panel */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm" id="search-panel">
        <div className="relative" id="search-input-wrapper">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-12 pr-4 py-4 border border-slate-200 rounded-2xl text-sm placeholder-slate-400 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all font-sans"
            placeholder="Type anything (e.g. chassis #, bill #, stock-in #, buyer name, model)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button 
              onClick={() => setQuery('')}
              className="absolute inset-y-0 right-0 pr-4 flex items-center text-xs text-slate-400 hover:text-slate-700 font-bold font-sans cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        {/* Dynamic Help Indicator */}
        {!query && (
          <div className="mt-8 border-t border-slate-100 pt-6 text-center max-w-md mx-auto" id="search-empty-help">
            <HelpCircle className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <h4 className="text-xs font-bold text-slate-700 font-sans">Ready for Querying</h4>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed font-sans">
              Enter any search criteria. Our unified index scans scooter records, batteries, chargers, custom buyer names, bills, and physical ledger operations instantly.
            </p>
            <div className="flex flex-wrap justify-center gap-1.5 mt-4">
              <span className="bg-slate-50 border border-slate-200 text-[10px] text-slate-500 font-bold px-2.5 py-1 rounded-lg">Chassis #</span>
              <span className="bg-slate-50 border border-slate-200 text-[10px] text-slate-500 font-bold px-2.5 py-1 rounded-lg">Bill #</span>
              <span className="bg-slate-50 border border-slate-200 text-[10px] text-slate-500 font-bold px-2.5 py-1 rounded-lg">Stock IN #</span>
              <span className="bg-slate-50 border border-slate-200 text-[10px] text-slate-500 font-bold px-2.5 py-1 rounded-lg">Buyer Name</span>
              <span className="bg-slate-50 border border-slate-200 text-[10px] text-slate-500 font-bold px-2.5 py-1 rounded-lg">Model Variant</span>
            </div>
          </div>
        )}

        {/* Results Stream */}
        {query && (
          <div className="mt-6" id="search-results-section">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider font-sans">
                Search Results ({searchResults.length})
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Matched against indexed registry</span>
            </div>

            {searchResults.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5" id="search-grid">
                {searchResults.map((result) => {
                  const Icon = result.category === 'scooter' ? Box 
                    : result.category === 'buyer' ? User 
                    : result.category === 'model' ? Tag
                    : result.category === 'bill' ? FileText
                    : result.category === 'stock_in' ? ClipboardList
                    : Info;

                  return (
                    <div
                      key={result.id}
                      onClick={() => setSelectedResult(result)}
                      className="p-4 bg-white border border-slate-200 hover:border-slate-300 hover:shadow-xs rounded-2xl flex items-center justify-between gap-4 cursor-pointer transition-all group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`p-2.5 rounded-xl border shrink-0 ${
                          result.category === 'scooter' ? 'bg-cyan-50 border-cyan-100 text-cyan-600'
                          : result.category === 'buyer' ? 'bg-indigo-50 border-indigo-100 text-indigo-600'
                          : result.category === 'model' ? 'bg-amber-50 border-amber-100 text-amber-600'
                          : 'bg-slate-50 border-slate-200 text-slate-600'
                        }`}>
                          <Icon className="h-4.5 w-4.5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-extrabold text-slate-900 truncate group-hover:text-cyan-600 transition-colors">
                            {result.title}
                          </h4>
                          <p className="text-[11px] text-slate-500 truncate font-mono mt-0.5">
                            {result.subtitle}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[9px] font-bold px-2 py-0.5 border rounded-md uppercase font-sans ${result.badgeColor}`}>
                          {result.badge}
                        </span>
                        <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-12 text-center" id="search-no-results">
                <AlertCircle className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                <h4 className="text-xs font-bold text-slate-700 font-sans">No matches found</h4>
                <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto font-sans">
                  We scanned chassis numbers, motor/controller IDs, buyers, bills, stock INs, models, and ledger comments but couldn't find a match for "{query}".
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Slide-over Detailed Context Inspector Drawer */}
      <AnimatePresence>
        {selectedResult && (
          <div className="fixed inset-0 z-50 flex justify-end" id="inspector-overlay-container">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedResult(null)}
              className="absolute inset-0 bg-slate-900 cursor-pointer"
            />

            {/* Modal Drawer */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 220 }}
              className="relative w-full max-w-lg bg-white h-full shadow-2xl flex flex-col z-10 border-l border-slate-200"
              id="inspector-drawer"
            >
              {/* Header */}
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-sans">Inspector</span>
                  <div className="h-3 w-[1px] bg-slate-300"></div>
                  <span className="text-[10px] font-bold text-cyan-600 uppercase font-mono">{selectedResult.category.replace('_', ' ')}</span>
                </div>
                <button
                  onClick={() => setSelectedResult(null)}
                  className="p-1.5 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer text-slate-400 hover:text-slate-700 text-xs font-bold flex items-center gap-1 font-sans"
                >
                  <ArrowRight className="h-4 w-4" />
                  <span>Close</span>
                </button>
              </div>

              {/* Scrollable Content Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {inspectorContent}
              </div>

              {/* Footer Actions */}
              <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2 shrink-0">
                <button
                  onClick={() => setSelectedResult(null)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl font-sans cursor-pointer transition-colors"
                >
                  Finished Inspection
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
