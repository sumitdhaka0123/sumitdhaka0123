import React, { useState, useMemo } from 'react';
import { 
  ShieldCheck, Search, PlusCircle, FileText, CheckCircle, Wrench, 
  RefreshCw, AlertTriangle, Calendar, User, Tag, Package, Phone, 
  Clock, Check, X, ClipboardList, HelpCircle
} from 'lucide-react';
import { ScooterUnit, BatterySale, ChargerSale, Buyer, WarrantyClaim, User as DBUser, BatteryImport, ChargerImport } from '../types';

interface WarrantyClaimsManagerProps {
  scooterUnits: ScooterUnit[];
  batterySales: BatterySale[];
  chargerSales: ChargerSale[];
  batteryImports?: BatteryImport[];
  chargerImports?: ChargerImport[];
  buyers: Buyer[];
  warrantyClaims: WarrantyClaim[];
  currentUser: DBUser;
  onRefresh: () => Promise<void>;
}

export default function WarrantyClaimsManager({
  scooterUnits,
  batterySales,
  chargerSales,
  batteryImports = [],
  chargerImports = [],
  buyers,
  warrantyClaims,
  currentUser,
  onRefresh
}: WarrantyClaimsManagerProps) {
  // Navigation tabs within Warranty Claim Section
  const [subTab, setSubTab] = useState<'claims_ledger' | 'file_claim' | 'lookup'>('claims_ledger');

  // Search state for Warranty lookup
  const [lookupQuery, setLookupQuery] = useState('');
  const [lookupResult, setLookupResult] = useState<any[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  
  // Detailed Product View State
  const [viewingDetailItem, setViewingDetailItem] = useState<any | null>(null);

  // New Claim Form State
  const [itemType, setItemType] = useState<'scooter' | 'battery' | 'charger'>('scooter');
  const [originalSaleId, setOriginalSaleId] = useState('');
  const [originalSerialNo, setOriginalSerialNo] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [buyerContact, setBuyerContact] = useState('');
  const [saleDate, setSaleDate] = useState('');
  const [warrantyDuration, setWarrantyDuration] = useState<number>(12);
  const [issueDescription, setIssueDescription] = useState('');
  const [claimStatus, setClaimStatus] = useState<'under_repair' | 'repaired' | 'exchanged' | 'rejected'>('under_repair');
  const [newSerialNo, setNewSerialNo] = useState('');
  const [notes, setNotes] = useState('');
  const [isBatteryClaim, setIsBatteryClaim] = useState(false);
  const [replacementWarrantyMonths, setReplacementWarrantyMonths] = useState<number | ''>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formStatus, setFormStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Active filter states for the claims ledger
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Modal / Selected Claim for editing or detail view
  const [selectedClaim, setSelectedClaim] = useState<WarrantyClaim | null>(null);
  const [editStatus, setEditStatus] = useState<'under_repair' | 'repaired' | 'exchanged' | 'rejected'>('under_repair');
  const [editNewSerialNo, setEditNewSerialNo] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editReplacementWarrantyMonths, setEditReplacementWarrantyMonths] = useState<number | ''>('');
  const [isUpdating, setIsUpdating] = useState(false);

  // Search through all sold items across Scooters, Standalone Batteries, and Standalone Chargers
  const handleWarrantyLookup = () => {
    if (!lookupQuery.trim()) return;
    const query = lookupQuery.toLowerCase().trim();
    const results: any[] = [];

    // 1. Search in Scooter Units (Sold)
    scooterUnits.forEach(scoot => {
      if (scoot.status !== 'sold') return;

      const chassisMatch = scoot.chassisNo.toLowerCase().includes(query);
      const batteryMatch = scoot.batterySerials?.some(s => s.toLowerCase().includes(query));
      const chargerMatch = scoot.chargerSerial?.toLowerCase().includes(query);
      const buyerMatch = scoot.buyerName?.toLowerCase().includes(query);

      if (chassisMatch || batteryMatch || chargerMatch || buyerMatch) {
        // Determine warranty durations and types
        results.push({
          id: scoot.id,
          type: 'scooter',
          title: scoot.modelName,
          subtitle: `Color: ${scoot.color} | Chassis: ${scoot.chassisNo}`,
          serialNo: scoot.chassisNo,
          buyerName: scoot.buyerName || 'Unknown',
          buyerContact: scoot.buyerContact || 'N/A',
          saleDate: scoot.saleDate ? scoot.saleDate.split('T')[0] : 'N/A',
          duration: scoot.scooterWarrantyMonths || 12,
          scooterDetail: scoot,
          meta: {
            chassisNo: scoot.chassisNo,
            batterySerials: scoot.batterySerials || [],
            chargerSerial: scoot.chargerSerial || 'N/A',
            scooterWarranty: scoot.scooterWarrantyMonths || 12,
            batteryWarranty: scoot.batteryWarrantyMonths?.[0] || 12,
            chargerWarranty: scoot.chargerWarrantyMonths || 12
          }
        });
      }
    });

    // 2. Search in Standalone Battery Sales
    batterySales.forEach(sale => {
      const seriesMatch = sale.batterySeries.toLowerCase().includes(query);
      const startNoMatch = sale.startNo.toLowerCase().includes(query);
      const endNoMatch = sale.endNo.toLowerCase().includes(query);
      const buyerMatch = sale.buyerName.toLowerCase().includes(query);

      // Check if query is a number and falls within range
      let serialInRange = false;
      const numQuery = parseInt(query.replace(/\D/g, ''), 10);
      const numStart = parseInt(sale.startNo.replace(/\D/g, ''), 10);
      const numEnd = parseInt(sale.endNo.replace(/\D/g, ''), 10);
      if (!isNaN(numQuery) && !isNaN(numStart) && !isNaN(numEnd)) {
        if (numQuery >= numStart && numQuery <= numEnd) {
          serialInRange = true;
        }
      }

      if (seriesMatch || startNoMatch || endNoMatch || buyerMatch || serialInRange) {
        results.push({
          id: sale.id,
          type: 'battery',
          title: `🔋 Battery Sales (${sale.batterySeries})`,
          subtitle: `Range: ${sale.startNo} - ${sale.endNo} | Qty: ${sale.quantity}`,
          serialNo: `${sale.startNo} - ${sale.endNo}`,
          buyerName: sale.buyerName,
          buyerContact: 'N/A',
          saleDate: sale.saleDate ? sale.saleDate.split('T')[0] : 'N/A',
          duration: sale.warrantyDurationMonths || 12,
          meta: sale
        });
      }
    });

    // 3. Search in Standalone Charger Sales
    chargerSales.forEach(sale => {
      const typeMatch = sale.chargerType.toLowerCase().includes(query);
      const startNoMatch = sale.startNo?.toLowerCase().includes(query) || false;
      const endNoMatch = sale.endNo?.toLowerCase().includes(query) || false;
      const buyerMatch = sale.buyerName.toLowerCase().includes(query);

      if (typeMatch || startNoMatch || endNoMatch || buyerMatch) {
        results.push({
          id: sale.id,
          type: 'charger',
          title: `🔌 Charger Sale (${sale.chargerType})`,
          subtitle: `Series: ${sale.startNo || 'N/A'} - ${sale.endNo || 'N/A'} | Qty: ${sale.quantity}`,
          serialNo: sale.startNo ? `${sale.startNo} - ${sale.endNo}` : 'N/A',
          buyerName: sale.buyerName,
          buyerContact: 'N/A',
          saleDate: sale.saleDate ? sale.saleDate.split('T')[0] : 'N/A',
          duration: sale.warrantyDurationMonths || 12,
          meta: sale
        });
      }
    });

    setLookupResult(results);
    setHasSearched(true);
  };

  // Pre-fill Claim form with lookup result
  const handleSelectForClaim = (item: any, specificType?: 'scooter_frame' | 'scooter_battery' | 'scooter_charger' | 'standalone_battery' | 'standalone_charger') => {
    setItemType(item.type);
    setOriginalSaleId(item.id);
    setBuyerName(item.buyerName);
    setBuyerContact(item.buyerContact === 'N/A' ? '' : item.buyerContact);
    setSaleDate(item.saleDate);
    setWarrantyDuration(item.duration);

    if (specificType === 'scooter_battery') {
      const serial = prompt("Please specify the exact battery serial number from this scooter:", item.meta.batterySerials[0] || "");
      if (serial) {
        setOriginalSerialNo(serial);
        setWarrantyDuration(item.meta.batteryWarranty);
        setIsBatteryClaim(true);
      } else {
        return;
      }
    } else if (specificType === 'scooter_charger') {
      setOriginalSerialNo(item.meta.chargerSerial || 'N/A');
      setWarrantyDuration(item.meta.chargerWarranty);
      setIsBatteryClaim(false);
    } else if (item.type === 'scooter') {
      setOriginalSerialNo(item.meta.chassisNo);
      setWarrantyDuration(item.meta.scooterWarranty);
      setIsBatteryClaim(false);
    } else {
      setOriginalSerialNo(item.serialNo);
      setIsBatteryClaim(item.type === 'battery');
    }

    setReplacementWarrantyMonths('');
    setSubTab('file_claim');
    setFormStatus(null);
  };

  // Find historical claims associated with a selected product
  const pastClaimsForProduct = useMemo(() => {
    if (!viewingDetailItem) return [];
    const relatedSerials = new Set<string>();
    
    if (viewingDetailItem.type === 'scooter') {
      if (viewingDetailItem.meta?.chassisNo) {
        relatedSerials.add(viewingDetailItem.meta.chassisNo.toLowerCase());
      }
      if (viewingDetailItem.meta?.batterySerials) {
        viewingDetailItem.meta.batterySerials.forEach((bs: string) => {
          if (bs) relatedSerials.add(bs.toLowerCase());
        });
      }
      if (viewingDetailItem.meta?.chargerSerial && viewingDetailItem.meta.chargerSerial !== 'N/A') {
        relatedSerials.add(viewingDetailItem.meta.chargerSerial.toLowerCase());
      }
    } else if (viewingDetailItem.serialNo && viewingDetailItem.serialNo !== 'N/A') {
      relatedSerials.add(viewingDetailItem.serialNo.toLowerCase());
      const parts = viewingDetailItem.serialNo.split('-').map((p: string) => p.trim().toLowerCase());
      parts.forEach((p: string) => {
        if (p) relatedSerials.add(p);
      });
    }

    return warrantyClaims.filter(claim => {
      const claimSerial = claim.originalSerialNo?.toLowerCase() || '';
      const claimNewSerial = claim.newSerialNo?.toLowerCase() || '';
      return (
        relatedSerials.has(claimSerial) || 
        relatedSerials.has(claimNewSerial) || 
        claim.originalSaleId === viewingDetailItem.id
      );
    });
  }, [viewingDetailItem, warrantyClaims]);

  // Submit the new warranty claim
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!originalSaleId || !originalSerialNo || !buyerName || !issueDescription) {
      setFormStatus({ type: 'error', text: 'Please fill in all required fields marked with *' });
      return;
    }

    if (claimStatus === 'exchanged' && !newSerialNo.trim()) {
      setFormStatus({ type: 'error', text: 'Replacement serial number is required for exchanges.' });
      return;
    }

    setIsSubmitting(true);
    setFormStatus(null);

    try {
      const response = await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/warranty-claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalSaleId,
          originalSaleType: itemType,
          originalSerialNo,
          buyerName,
          buyerContact: buyerContact || undefined,
          saleDate: saleDate || undefined,
          warrantyDurationMonths: warrantyDuration,
          issueDescription,
          status: claimStatus,
          actionTaken: claimStatus === 'under_repair' ? 'pending' : claimStatus,
          newSerialNo: claimStatus === 'exchanged' ? newSerialNo : undefined,
          notes,
          operatorName: currentUser.name,
          operatorUsername: currentUser.username,
          replacementWarrantyMonths: (claimStatus === 'exchanged' && isBatteryClaim && replacementWarrantyMonths !== '') ? Number(replacementWarrantyMonths) : undefined,
          isBattery: isBatteryClaim
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to submit warranty claim.');
      }

      const savedClaim = await response.json();
      setFormStatus({
        type: 'success',
        text: `Successfully registered warranty claim ${savedClaim.id}! ${
          claimStatus === 'exchanged' ? 'Item swapped and database serials updated.' : ''
        }`
      });

      // Reset form
      setOriginalSaleId('');
      setOriginalSerialNo('');
      setBuyerName('');
      setBuyerContact('');
      setSaleDate('');
      setIssueDescription('');
      setClaimStatus('under_repair');
      setNewSerialNo('');
      setNotes('');
      setReplacementWarrantyMonths('');
      setIsBatteryClaim(false);

      // Refresh parent lists
      await onRefresh();
    } catch (err: any) {
      setFormStatus({ type: 'error', text: err.message || 'Error occurred.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update existing claim status
  const handleUpdateClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClaim) return;

    if (editStatus === 'exchanged' && !editNewSerialNo.trim()) {
      alert('Replacement serial number is required for exchanging.');
      return;
    }

    setIsUpdating(true);
    try {
      const response = await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/warranty-claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedClaim.id,
          originalSaleId: selectedClaim.originalSaleId,
          originalSaleType: selectedClaim.originalSaleType,
          originalSerialNo: selectedClaim.originalSerialNo,
          buyerName: selectedClaim.buyerName,
          issueDescription: selectedClaim.issueDescription,
          status: editStatus,
          actionTaken: editStatus,
          newSerialNo: editStatus === 'exchanged' ? editNewSerialNo : undefined,
          notes: editNotes,
          operatorName: currentUser.name,
          operatorUsername: currentUser.username,
          replacementWarrantyMonths: (editStatus === 'exchanged' && (selectedClaim.isBattery || selectedClaim.originalSaleType === 'battery') && editReplacementWarrantyMonths !== '') ? Number(editReplacementWarrantyMonths) : undefined,
          isBattery: selectedClaim.isBattery || (selectedClaim.originalSaleType === 'battery')
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to update claim.');
      }

      alert('Warranty claim updated successfully!');
      setSelectedClaim(null);
      await onRefresh();
    } catch (err: any) {
      alert(`Error updating claim: ${err.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  // Find manufacturer warranty details that we get from supplier
  const findManufacturerWarranty = (serialNo: string, type: 'battery' | 'charger') => {
    if (!serialNo || serialNo === 'N/A') return null;
    const cleanSerial = serialNo.trim().toUpperCase();

    if (type === 'battery') {
      const foundImport = batteryImports.find(imp => {
        if (imp.serialNumbers && imp.serialNumbers.map(s => s.trim().toUpperCase()).includes(cleanSerial)) {
          return true;
        }
        // Fallback to range checks
        const numQuery = parseInt(cleanSerial.replace(/\D/g, ''), 10);
        const numStart = parseInt(imp.startNo.replace(/\D/g, ''), 10);
        const numEnd = parseInt(imp.endNo.replace(/\D/g, ''), 10);
        if (!isNaN(numQuery) && !isNaN(numStart) && !isNaN(numEnd)) {
          return numQuery >= numStart && numQuery <= numEnd;
        }
        return false;
      });

      if (foundImport) {
        return foundImport;
      }
    } else if (type === 'charger') {
      const foundImport = chargerImports.find(imp => {
        if (imp.serialNumbers && imp.serialNumbers.map(s => s.trim().toUpperCase()).includes(cleanSerial)) {
          return true;
        }
        if (imp.startNo && imp.endNo) {
          const numQuery = parseInt(cleanSerial.replace(/\D/g, ''), 10);
          const numStart = parseInt(imp.startNo.replace(/\D/g, ''), 10);
          const numEnd = parseInt(imp.endNo.replace(/\D/g, ''), 10);
          if (!isNaN(numQuery) && !isNaN(numStart) && !isNaN(numEnd)) {
            return numQuery >= numStart && numQuery <= numEnd;
          }
        }
        return false;
      });

      if (foundImport) {
        return foundImport;
      }
    }
    return null;
  };

  // Calculate remaining warranty status and text
  const calculateWarrantyRemaining = (saleDateStr: string, durationMonths: number) => {
    if (!saleDateStr || saleDateStr === 'N/A') return { text: 'No Sale Date', active: false, badgeColor: 'bg-slate-100 text-slate-800 border-slate-200' };

    const sale = new Date(saleDateStr);
    const expiry = new Date(sale);
    expiry.setMonth(sale.getMonth() + durationMonths);

    const today = new Date();
    const remainingTime = expiry.getTime() - today.getTime();
    const remainingDays = Math.ceil(remainingTime / (1000 * 60 * 60 * 24));

    if (remainingDays < 0) {
      return {
        text: `Expired on ${expiry.toLocaleDateString()}`,
        active: false,
        badgeColor: 'bg-rose-50 text-rose-700 border-rose-200'
      };
    } else {
      return {
        text: `Active (${remainingDays} days left - Expiry: ${expiry.toLocaleDateString()})`,
        active: true,
        badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200'
      };
    }
  };

  // Filter and search ledger
  const filteredClaims = useMemo(() => {
    let list = [...warrantyClaims];

    // Status filter
    if (statusFilter !== 'all') {
      list = list.filter(c => c.status === statusFilter);
    }

    // Item Type filter
    if (typeFilter !== 'all') {
      list = list.filter(c => c.originalSaleType === typeFilter);
    }

    // Text search query
    if (ledgerSearch.trim()) {
      const q = ledgerSearch.toLowerCase();
      list = list.filter(
        c => c.id.toLowerCase().includes(q) ||
             c.originalSerialNo.toLowerCase().includes(q) ||
             c.buyerName.toLowerCase().includes(q) ||
             (c.newSerialNo && c.newSerialNo.toLowerCase().includes(q)) ||
             c.issueDescription.toLowerCase().includes(q)
      );
    }

    // Sort by latest claim date
    return list.sort((a, b) => new Date(b.claimDate).getTime() - new Date(a.claimDate).getTime());
  }, [warrantyClaims, ledgerSearch, statusFilter, typeFilter]);

  return (
    <div className="space-y-6" id="warranty-manager-container">
      {/* 1. Header & Navigation Cards */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden" id="warranty-header">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <ShieldCheck className="h-48 w-48 text-cyan-400" />
        </div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black tracking-tight font-sans">🛡️ Warranty Service & Defect Log</h2>
            <p className="text-slate-300 text-xs font-sans mt-1 max-w-xl">
              Check active guarantees, register defective hardware, process quick exchanges, or record repair items. Fully integrated with live stock serial replacement.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              className="bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-xl px-4 py-2.5 text-xs font-bold font-sans cursor-pointer flex items-center gap-1.5 border border-slate-700"
            >
              <RefreshCw className="h-3.5 w-3.5 text-cyan-400" />
              <span>Refresh Records</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 mt-6 border-t border-slate-800 pt-5">
          <button
            onClick={() => setSubTab('claims_ledger')}
            className={`px-4 py-2 rounded-xl text-xs font-bold font-sans tracking-wide transition-all cursor-pointer flex items-center gap-1.5 ${
              subTab === 'claims_ledger'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <ClipboardList className="h-4 w-4" />
            <span>Defects History ({warrantyClaims.length})</span>
          </button>
          <button
            onClick={() => setSubTab('lookup')}
            className={`px-4 py-2 rounded-xl text-xs font-bold font-sans tracking-wide transition-all cursor-pointer flex items-center gap-1.5 ${
              subTab === 'lookup'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Search className="h-4 w-4" />
            <span>Check Serial Warranty</span>
          </button>
          <button
            onClick={() => setSubTab('file_claim')}
            className={`px-4 py-2 rounded-xl text-xs font-bold font-sans tracking-wide transition-all cursor-pointer flex items-center gap-1.5 ${
              subTab === 'file_claim'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <PlusCircle className="h-4 w-4" />
            <span>Log Defective Return</span>
          </button>
        </div>
      </div>

      {/* 2. TAB: Check Serial Warranty (Lookup) */}
      {subTab === 'lookup' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in" id="warranty-lookup-view">
          <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-pink-50 flex items-center justify-center border border-pink-100">
                  <Search className="h-4 w-4 text-pink-500" />
                </div>
                <h3 className="text-base font-bold text-slate-950">Verify Active Warranty</h3>
              </div>
              <p className="text-xs text-slate-500">
                Enter any buyer name, scooter chassis number, battery barcode range, or charger serial number to search current sales ledger.
              </p>

              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-700">Enter Search Term (e.g., SN, name, chassis)</label>
                <div className="relative">
                  <input
                    type="text"
                    value={lookupQuery}
                    onChange={(e) => setLookupQuery(e.target.value)}
                    placeholder="e.g. AL-4820, Sumit, Volt, CH-2026..."
                    onKeyDown={(e) => { if (e.key === 'Enter') handleWarrantyLookup(); }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs outline-none focus:bg-white focus:border-pink-500 font-sans"
                  />
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                </div>
                <button
                  type="button"
                  onClick={handleWarrantyLookup}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-xl py-2.5 text-xs font-bold font-sans cursor-pointer transition-colors"
                >
                  Lookup Warranty Details
                </button>
              </div>
            </div>

            <div className="mt-8 bg-slate-50 rounded-2xl p-4 border border-slate-100 text-xs text-slate-500 space-y-2">
              <p className="font-bold text-slate-700">💡 Service Tips:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>If exchanging battery/charger on a registered scooter, select the scooter entry first.</li>
                <li>Exchanges of registered components will update original scooter logs automatically.</li>
                <li>Make sure to double check warranty limits dynamically calculated below.</li>
              </ul>
            </div>
          </div>

          <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 p-6 shadow-sm min-h-[400px]">
            <h3 className="text-sm font-bold text-slate-950 mb-4 flex items-center gap-1.5">
              <span>Results & Status Indicators</span>
              {hasSearched && (
                <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-mono">
                  {lookupResult.length} matches found
                </span>
              )}
            </h3>

            {!hasSearched ? (
              <div className="h-[300px] flex flex-col items-center justify-center text-center text-slate-400 border border-dashed border-slate-100 rounded-2xl">
                <ShieldCheck className="h-12 w-12 text-slate-200 mb-2" />
                <p className="text-xs">Submit a search term on the left to pull sales information.</p>
              </div>
            ) : lookupResult.length === 0 ? (
              <div className="h-[300px] flex flex-col items-center justify-center text-center text-slate-400 border border-dashed border-slate-100 rounded-2xl">
                <AlertTriangle className="h-10 w-10 text-amber-400 mb-2" />
                <p className="text-xs font-bold text-slate-700">No matching sales record found</p>
                <p className="text-[11px] text-slate-400 mt-1 max-w-sm">
                  We could not find a matching sold scooter chassis, standalone battery range, or charger for "{lookupQuery}".
                </p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                {lookupResult.map((item, index) => {
                  const warranty = calculateWarrantyRemaining(item.saleDate, item.duration);
                  return (
                    <div 
                      key={index} 
                      onClick={() => setViewingDetailItem(item)}
                      className="border border-slate-200 rounded-2xl p-4 hover:border-pink-300 hover:shadow-md hover:bg-white transition-all bg-slate-50/50 flex flex-col justify-between cursor-pointer group relative"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                              item.type === 'scooter' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' :
                              item.type === 'battery' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                              'bg-amber-50 text-amber-700 border border-amber-100'
                            }`}>
                              {item.type}
                            </span>
                            <h4 className="text-xs font-bold text-slate-900 group-hover:text-pink-600 transition-colors">{item.title}</h4>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">{item.subtitle}</p>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-3 text-[11px]">
                            <p className="text-slate-500">Buyer: <strong className="text-slate-800">{item.buyerName}</strong></p>
                            <p className="text-slate-500">Contact: <strong className="text-slate-800">{item.buyerContact}</strong></p>
                            <p className="text-slate-500">Sale Date: <strong className="text-slate-800">{item.saleDate}</strong></p>
                            <p className="text-slate-500">Warranty Cover: <strong className="text-slate-800">{item.duration} Months</strong></p>
                          </div>

                          {/* Standalone Supplier Warranty check */}
                          {(item.type === 'battery' || item.type === 'charger') && (() => {
                            const serialToCheck = item.type === 'battery' ? item.meta.startNo : item.meta.startNo || item.serialNo;
                            const mfgWarranty = findManufacturerWarranty(serialToCheck, item.type);
                            if (mfgWarranty) {
                              const mfgStatus = calculateWarrantyRemaining(mfgWarranty.importDate, mfgWarranty.warrantyDurationMonths || 12);
                              return (
                                <div className="mt-3 text-[10px] bg-amber-50/70 text-amber-900 p-2 rounded-xl border border-amber-200/60 space-y-0.5">
                                  <div className="flex items-center justify-between font-bold text-[9px] uppercase tracking-wider text-amber-800">
                                    <span>🏭 Supplier Warranty (WE GET)</span>
                                    <span className={mfgStatus.active ? 'text-emerald-700' : 'text-rose-700'}>
                                      {mfgStatus.active ? 'Active' : 'Expired'}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-slate-700 flex justify-between">
                                    <span>Supplier: <strong>{mfgWarranty.supplierName || 'Unknown'}</strong> ({mfgWarranty.warrantyDurationMonths || 12}M)</span>
                                    <span className="font-mono text-slate-500">{mfgStatus.text}</span>
                                  </div>
                                </div>
                              );
                            }
                            return (
                              <div className="mt-3 text-[9px] text-slate-400 italic">
                                ℹ️ No corresponding supplier purchase/import record was tracked for this serial batch.
                              </div>
                            );
                          })()}
                        </div>

                        <div className="text-right">
                          <span className={`inline-block text-[10px] font-bold px-2.5 py-1 rounded-full border ${warranty.badgeColor}`}>
                            {warranty.text}
                          </span>
                        </div>
                      </div>

                      {/* Scooter specific modular component claims */}
                      {item.type === 'scooter' && (
                        <div className="mt-3 bg-white rounded-2xl p-3 border border-slate-200/60 space-y-2 text-[11px]" onClick={(e) => e.stopPropagation()}>
                          <p className="font-bold text-slate-800 flex items-center gap-1">
                            <ShieldCheck className="h-3.5 w-3.5 text-indigo-500" />
                            <span>Modular Warranty Analysis (GET vs GIVE):</span>
                          </p>
                          <div className="space-y-1.5 divide-y divide-slate-100">
                            {/* Frame / Chassis */}
                            <div className="flex items-center justify-between py-1">
                              <span className="text-slate-600">🚲 Frame: <strong className="font-mono">{item.meta.chassisNo}</strong></span>
                              <div className="flex items-center gap-1.5">
                                <span className="bg-indigo-50 text-indigo-700 text-[9px] px-1.5 py-0.5 rounded font-bold">
                                  We Give: {item.meta.scooterWarranty || 12}M Cover
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleSelectForClaim(item); }}
                                  className="bg-indigo-600 hover:bg-indigo-700 text-white rounded px-1.5 py-0.5 text-[9px] font-extrabold transition-colors cursor-pointer"
                                >
                                  Claim
                                </button>
                              </div>
                            </div>

                            {/* Batteries */}
                            {item.meta.batterySerials.map((bs: string, idx: number) => {
                              const isWarranty = item.meta.batteryWarrantyFlags?.[idx] !== false;
                              const months = item.meta.batteryWarrantyMonths?.[idx] ?? 12;
                              const mfgWarranty = findManufacturerWarranty(bs, 'battery');
                              const mfgStatus = mfgWarranty 
                                ? calculateWarrantyRemaining(mfgWarranty.importDate, mfgWarranty.warrantyDurationMonths || 12)
                                : null;

                              return (
                                <div key={idx} className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-1 gap-1 text-[10px]">
                                  <div className="space-y-0.5 text-left">
                                    <span className="text-slate-700 font-medium">🔋 Battery #{idx+1}: <strong className="font-mono text-slate-950">{bs}</strong></span>
                                    {mfgWarranty ? (
                                      <div className="text-[9px] text-slate-500 flex items-center gap-1 mt-0.5">
                                        <span className="bg-amber-50 text-amber-800 border border-amber-200/50 px-1 rounded font-bold uppercase text-[7px]">We Get</span>
                                        <span>Mfg: {mfgWarranty.supplierName || 'Supplier'} ({mfgWarranty.warrantyDurationMonths || 12}M) — {mfgStatus?.text}</span>
                                      </div>
                                    ) : (
                                      <div className="text-[9px] text-slate-400 italic">No manufacturer import warranty recorded</div>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5 self-end sm:self-auto">
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                                      isWarranty ? 'bg-emerald-50 text-emerald-700 border border-emerald-150' : 'bg-slate-100 text-slate-500'
                                    }`}>
                                      We Give: {isWarranty ? `${months}M` : 'No Cover'}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); handleSelectForClaim(item, 'scooter_battery'); }}
                                      className="bg-emerald-600 hover:bg-emerald-700 text-white rounded px-1.5 py-0.5 text-[9px] font-extrabold transition-colors cursor-pointer"
                                    >
                                      Claim
                                    </button>
                                  </div>
                                </div>
                              );
                            })}

                            {/* Charger */}
                            {item.meta.chargerSerial && item.meta.chargerSerial !== 'N/A' && (() => {
                              const chargerSerial = item.meta.chargerSerial;
                              const isWarranty = item.meta.chargerWarrantyActive !== false;
                              const months = item.meta.chargerWarrantyMonths || 12;
                              const mfgWarranty = findManufacturerWarranty(chargerSerial, 'charger');
                              const mfgStatus = mfgWarranty 
                                ? calculateWarrantyRemaining(mfgWarranty.importDate, mfgWarranty.warrantyDurationMonths || 12)
                                : null;

                              return (
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-1 gap-1 text-[10px]">
                                  <div className="space-y-0.5 text-left">
                                    <span className="text-slate-700 font-medium">🔌 Charger: <strong className="font-mono text-slate-950">{chargerSerial}</strong></span>
                                    {mfgWarranty ? (
                                      <div className="text-[9px] text-slate-500 flex items-center gap-1 mt-0.5">
                                        <span className="bg-amber-50 text-amber-800 border border-amber-200/50 px-1 rounded font-bold uppercase text-[7px]">We Get</span>
                                        <span>Mfg: {mfgWarranty.supplierName || 'Supplier'} ({mfgWarranty.warrantyDurationMonths || 12}M) — {mfgStatus?.text}</span>
                                      </div>
                                    ) : (
                                      <div className="text-[9px] text-slate-400 italic">No manufacturer import warranty recorded</div>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5 self-end sm:self-auto">
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                                      isWarranty ? 'bg-amber-50 text-amber-700 border border-amber-150' : 'bg-slate-100 text-slate-500'
                                    }`}>
                                      We Give: {isWarranty ? `${months}M` : 'No Cover'}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); handleSelectForClaim(item, 'scooter_charger'); }}
                                      className="bg-emerald-600 hover:bg-emerald-700 text-white rounded px-1.5 py-0.5 text-[9px] font-extrabold transition-colors cursor-pointer"
                                    >
                                      Claim
                                    </button>
                                  </div>
                                </div>
                              );
                            })()}

                          </div>
                        </div>
                      )}

                      <div className="mt-4 pt-3 border-t border-slate-150 flex items-center justify-between">
                        <span className="text-[10px] text-pink-500 font-bold opacity-0 group-hover:opacity-100 transition-all flex items-center gap-1">
                          <FileText className="h-3.5 w-3.5" />
                          <span>Click card to view full specifications & logs</span>
                        </span>
                        {item.type !== 'scooter' && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleSelectForClaim(item); }}
                            className="bg-slate-900 hover:bg-slate-800 text-white rounded-lg px-3 py-1.5 text-[11px] font-bold font-sans cursor-pointer transition-colors flex items-center gap-1"
                          >
                            <PlusCircle className="h-3 w-3" />
                            <span>Process Claim</span>
                          </button>
                        )}
                        {item.type === 'scooter' && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleSelectForClaim(item); }}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-3 py-1.5 text-[11px] font-bold font-sans cursor-pointer transition-colors flex items-center gap-1"
                          >
                            <PlusCircle className="h-3 w-3" />
                            <span>Process Frame Claim</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. TAB: Log Defective Return (File Claim Form) */}
      {subTab === 'file_claim' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm animate-fade-in" id="warranty-form-view">
          <div className="flex items-center gap-2 mb-6">
            <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center border border-emerald-100">
              <PlusCircle className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-950">File Defective Return & Exchange</h3>
              <p className="text-xs text-slate-500">Record diagnostic returns, repairs, or instant stock swap replacements.</p>
            </div>
          </div>

          {formStatus && (
            <div className={`p-4 rounded-xl border mb-6 text-xs font-sans ${
              formStatus.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}>
              <p className="font-bold">{formStatus.type === 'success' ? '✓ Success' : '⚠️ Error'}</p>
              <p className="mt-0.5">{formStatus.text}</p>
            </div>
          )}

          <form onSubmit={handleFormSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Sale Context Type *</label>
                <select
                  value={itemType}
                  onChange={(e) => setItemType(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:border-emerald-500 font-sans cursor-pointer"
                >
                  <option value="scooter">🛵 Scooter Chassis/Components</option>
                  <option value="battery">🔋 Standalone Battery Sale</option>
                  <option value="charger">🔌 Standalone Charger Sale</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Defective Serial Number *</label>
                <input
                  type="text"
                  value={originalSerialNo}
                  onChange={(e) => setOriginalSerialNo(e.target.value)}
                  placeholder="Chassis SN, battery SN, or charger SN"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:border-emerald-500 font-sans"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Buyer Name *</label>
                <input
                  type="text"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  placeholder="Enter buyer's full name"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:border-emerald-500 font-sans"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Buyer Contact Number</label>
                <input
                  type="text"
                  value={buyerContact}
                  onChange={(e) => setBuyerContact(e.target.value)}
                  placeholder="e.g. +91 9999999999"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:border-emerald-500 font-sans"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Original Sale Date</label>
                <input
                  type="date"
                  value={saleDate}
                  onChange={(e) => setSaleDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:border-emerald-500 font-sans cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Warranty Duration Months</label>
                <input
                  type="number"
                  value={warrantyDuration}
                  onChange={(e) => setWarrantyDuration(Number(e.target.value))}
                  placeholder="e.g. 12, 13"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:border-emerald-500 font-sans"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">Issue Description / Defect Details *</label>
              <textarea
                value={issueDescription}
                onChange={(e) => setIssueDescription(e.target.value)}
                placeholder="What is wrong with the item? Describe failure symptoms..."
                rows={3}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:border-emerald-500 font-sans resize-none"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Actions / Resolution Status *</label>
                <select
                  value={claimStatus}
                  onChange={(e) => setClaimStatus(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:border-emerald-500 font-sans cursor-pointer"
                >
                  <option value="under_repair">⚙️ Under Diagnosis / Repairing</option>
                  <option value="repaired">✅ Fixed & Restored to Customer</option>
                  <option value="exchanged">🔄 Exchanged with New Unit (Live Swaps Serial)</option>
                  <option value="rejected">❌ Claim Rejected / Physical Damage</option>
                </select>
              </div>

              {claimStatus === 'exchanged' && (
                <div className="space-y-1 animate-fade-in">
                  <label className="block text-xs font-bold text-rose-600">New Replacement Serial Number *</label>
                  <input
                    type="text"
                    value={newSerialNo}
                    onChange={(e) => setNewSerialNo(e.target.value)}
                    placeholder="Enter the serial number of the replacement unit"
                    className="w-full bg-rose-50/50 border border-rose-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:border-rose-500 font-sans font-bold"
                    required
                  />
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    <strong>Swap Effect:</strong> Submitting will automatically search this SN in other databases and overwrite the old SN.
                  </p>

                  {isBatteryClaim && (
                    <div className="space-y-1 animate-fade-in mt-3 bg-emerald-50/50 border border-emerald-100 p-3 rounded-xl">
                      <label className="block text-xs font-bold text-emerald-800">
                        Custom Replacement Battery Warranty (Months) 🔋
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={24}
                        value={replacementWarrantyMonths}
                        onChange={(e) => setReplacementWarrantyMonths(e.target.value ? Number(e.target.value) : '')}
                        placeholder="e.g., 2 (since 10 months are already consumed)"
                        className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:border-emerald-500 font-sans font-bold text-emerald-800"
                      />
                      <p className="text-[10px] text-emerald-600 mt-1">
                        If a battery is replaced (e.g., after 10 months out of 12 total), you can customize the remaining warranty duration here (e.g., input 2).
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">Internal Audit / Diagnostic Notes</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any technical notes about diagnostic checks or external details..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:border-emerald-500 font-sans"
              />
            </div>

            {/* Hidden field referencing original sale id */}
            <input type="hidden" value={originalSaleId} />

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setOriginalSaleId('');
                  setOriginalSerialNo('');
                  setBuyerName('');
                  setBuyerContact('');
                  setSaleDate('');
                  setIssueDescription('');
                  setNotes('');
                  setSubTab('claims_ledger');
                }}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold font-sans cursor-pointer transition-colors"
              >
                Cancel & Back
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl px-6 py-2.5 text-xs font-bold font-sans cursor-pointer transition-colors flex items-center gap-1"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    <span>Saving Claim...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Submit Claim & Log Action</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 4. TAB: Claims Ledger (History List) */}
      {subTab === 'claims_ledger' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-6" id="claims-ledger-view">
          {/* Filters & Header */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <h3 className="text-sm font-bold text-slate-950">Active Claims & Historical Exchanges Log</h3>
              <p className="text-xs text-slate-500">Search and audit every returned item, repair progress, and replaced serial history.</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Text Search */}
              <div className="relative min-w-[200px]">
                <input
                  type="text"
                  value={ledgerSearch}
                  onChange={(e) => setLedgerSearch(e.target.value)}
                  placeholder="Search claims SN, buyer..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs outline-none focus:bg-white focus:border-cyan-500 font-sans"
                />
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs outline-none focus:bg-white font-sans cursor-pointer text-slate-700"
              >
                <option value="all">🔍 All Statuses</option>
                <option value="under_repair">⚙️ Under Repair</option>
                <option value="repaired">✅ Repaired</option>
                <option value="exchanged">🔄 Exchanged</option>
                <option value="rejected">❌ Rejected</option>
              </select>

              {/* Type Filter */}
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs outline-none focus:bg-white font-sans cursor-pointer text-slate-700"
              >
                <option value="all">📦 All Types</option>
                <option value="scooter">🛵 Scooters</option>
                <option value="battery">🔋 Standalone Batteries</option>
                <option value="charger">🔌 Standalone Chargers</option>
              </select>
            </div>
          </div>

          {/* Table Ledger */}
          {filteredClaims.length === 0 ? (
            <div className="h-[250px] flex flex-col items-center justify-center text-center text-slate-400 border border-dashed border-slate-100 rounded-2xl">
              <ClipboardList className="h-10 w-10 text-slate-200 mb-1" />
              <p className="text-xs font-bold text-slate-700">No matching claims records found</p>
              <p className="text-[11px] text-slate-400 mt-1">There are no logged warranty claims matching current filter terms.</p>
            </div>
          ) : (
            <div className="overflow-x-auto pr-1">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-2">Claim ID</th>
                    <th className="py-3 px-2">Claim Date</th>
                    <th className="py-3 px-2">Buyer Name</th>
                    <th className="py-3 px-2">Item Type</th>
                    <th className="py-3 px-2">Defective SN</th>
                    <th className="py-3 px-2">Resolution Status</th>
                    <th className="py-3 px-2">Operator</th>
                    <th className="py-3 px-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredClaims.map((claim) => (
                    <tr key={claim.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 px-2 font-mono font-bold text-slate-900">{claim.id}</td>
                      <td className="py-3.5 px-2 text-slate-600">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-slate-400" />
                          <span>{claim.claimDate}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-2 font-bold text-slate-800">{claim.buyerName}</td>
                      <td className="py-3.5 px-2">
                        <span className={`text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded-full ${
                          claim.originalSaleType === 'scooter' ? 'bg-indigo-50 text-indigo-700' :
                          claim.originalSaleType === 'battery' ? 'bg-emerald-50 text-emerald-700' :
                          'bg-amber-50 text-amber-700'
                        }`}>
                          {claim.originalSaleType}
                        </span>
                      </td>
                      <td className="py-3.5 px-2">
                        <div className="font-mono text-[11px]">
                          <p className="text-slate-800">{claim.originalSerialNo}</p>
                          {claim.status === 'exchanged' && claim.newSerialNo && (
                            <p className="text-rose-600 text-[10px] font-bold mt-0.5">
                              → Replaced: {claim.newSerialNo}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-2">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                          claim.status === 'repaired' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          claim.status === 'exchanged' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          claim.status === 'rejected' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                          'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {claim.status === 'repaired' && <CheckCircle className="h-3 w-3" />}
                          {claim.status === 'exchanged' && <RefreshCw className="h-3 w-3 animate-spin-slow" />}
                          {claim.status === 'rejected' && <X className="h-3 w-3" />}
                          {claim.status === 'under_repair' && <Clock className="h-3 w-3 animate-pulse" />}
                          <span className="capitalize">{claim.status.replace('_', ' ')}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-2 text-slate-600 font-sans">{claim.operatorName}</td>
                      <td className="py-3.5 px-2 text-right">
                        <button
                          onClick={() => {
                            setSelectedClaim(claim);
                            setEditStatus(claim.status);
                            setEditNewSerialNo(claim.newSerialNo || '');
                            setEditNotes(claim.notes || '');
                            setEditReplacementWarrantyMonths(claim.replacementWarrantyMonths !== undefined ? claim.replacementWarrantyMonths : '');
                          }}
                          className="text-cyan-600 hover:text-cyan-700 text-xs font-bold cursor-pointer font-sans"
                        >
                          Manage / Update
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 5. Update Claim Status Dialog (Modal) */}
      {selectedClaim && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 border border-slate-200 shadow-xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-950">Manage Claim: {selectedClaim.id}</h3>
                <p className="text-xs text-slate-500">Update diagnosed resolution or serial swaps.</p>
              </div>
              <button
                onClick={() => setSelectedClaim(null)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-xs space-y-2">
              <p className="text-slate-500">Original Buyer: <strong className="text-slate-800">{selectedClaim.buyerName}</strong></p>
              <p className="text-slate-500">Defective SN: <strong className="text-slate-800 font-mono">{selectedClaim.originalSerialNo}</strong></p>
              <p className="text-slate-500">Issue: <span className="italic text-slate-600 font-medium">"{selectedClaim.issueDescription}"</span></p>
            </div>

            <form onSubmit={handleUpdateClaim} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Resolution Status *</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:border-cyan-500 font-sans cursor-pointer text-slate-800"
                >
                  <option value="under_repair">⚙️ Under Diagnosis / Repairing</option>
                  <option value="repaired">✅ Fixed & Restored to Customer</option>
                  <option value="exchanged">🔄 Exchanged with New Unit (Swaps Serial)</option>
                  <option value="rejected">❌ Claim Rejected / Void Warranty</option>
                </select>
              </div>

              {editStatus === 'exchanged' && (
                <div className="space-y-1 animate-fade-in">
                  <label className="block text-xs font-bold text-rose-600">New Replacement Serial Number *</label>
                  <input
                    type="text"
                    value={editNewSerialNo}
                    onChange={(e) => setEditNewSerialNo(e.target.value)}
                    placeholder="Enter new unit serial number"
                    className="w-full bg-rose-50/50 border border-rose-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:border-rose-500 font-sans font-bold"
                    required
                  />
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    <strong>Swap Effect:</strong> Overwrites original registration serial numbers across the database.
                  </p>

                  {selectedClaim && (selectedClaim.isBattery || selectedClaim.originalSaleType === 'battery') && (
                    <div className="space-y-1 animate-fade-in mt-3 bg-emerald-50/50 border border-emerald-100 p-3 rounded-xl text-left">
                      <label className="block text-xs font-bold text-emerald-800">
                        Custom Replacement Battery Warranty (Months) 🔋
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={24}
                        value={editReplacementWarrantyMonths}
                        onChange={(e) => setEditReplacementWarrantyMonths(e.target.value ? Number(e.target.value) : '')}
                        placeholder="e.g., 2 (since 10 months are already consumed)"
                        className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:border-emerald-500 font-sans font-bold text-emerald-800"
                      />
                      <p className="text-[10px] text-emerald-600 mt-1">
                        If a battery is replaced (e.g., after 10 months out of 12 total), you can customize the remaining warranty duration here (e.g., input 2).
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Technical Diagnostic / Notes</label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Record final diagnostic details or resolution info..."
                  rows={3}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:border-cyan-500 font-sans resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedClaim(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl px-4 py-2 text-xs font-bold font-sans cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl px-5 py-2 text-xs font-bold font-sans cursor-pointer transition-colors"
                >
                  {isUpdating ? 'Updating...' : 'Save Resolution'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Product Comprehensive Detail Dialog (Modal) */}
      {viewingDetailItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" id="product-detail-modal">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 border border-slate-200 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-150 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full border ${
                    viewingDetailItem.type === 'scooter' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                    viewingDetailItem.type === 'battery' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                    'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {viewingDetailItem.type} Unit
                  </span>
                  <span className="text-xs font-mono text-slate-500">ID: {viewingDetailItem.id}</span>
                </div>
                <h3 className="text-lg font-black text-slate-900 font-sans mt-1.5">{viewingDetailItem.title}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{viewingDetailItem.subtitle}</p>
              </div>
              <button
                onClick={() => setViewingDetailItem(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content Tabs/Grid */}
            <div className="space-y-6">
              
              {/* Dynamic Warranty Guarantees Clock */}
              <div className="bg-slate-900 text-white p-4 rounded-2xl border border-slate-800 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Guarantee Status & Remaining Period</p>
                  <p className="text-xs text-slate-200">
                    Calculated for duration of <strong className="text-white font-mono">{viewingDetailItem.duration} Months</strong> starting from sale date.
                  </p>
                </div>
                <div>
                  {(() => {
                    const statusInfo = calculateWarrantyRemaining(viewingDetailItem.saleDate, viewingDetailItem.duration);
                    return (
                      <span className={`inline-block text-xs font-extrabold px-3.5 py-1.5 rounded-xl border ${
                        statusInfo.active 
                          ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' 
                          : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                      }`}>
                        {statusInfo.text}
                      </span>
                    );
                  })()}
                </div>
              </div>

              {/* Grid 1: Buyer & Sales context */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-slate-100 bg-slate-50/50 p-4 rounded-2xl">
                  <h4 className="text-xs font-bold text-slate-900 mb-3 flex items-center gap-1">
                    <User className="h-3.5 w-3.5 text-slate-500" />
                    <span>Customer & Buyer Information</span>
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between border-b border-slate-100 pb-1.5">
                      <span className="text-slate-500">Buyer Name:</span>
                      <span className="font-bold text-slate-800">{viewingDetailItem.buyerName}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 pb-1.5">
                      <span className="text-slate-500">Contact Number:</span>
                      <span className="font-bold text-slate-800">{viewingDetailItem.buyerContact || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Original Sale Date:</span>
                      <span className="font-mono text-slate-800">{viewingDetailItem.saleDate}</span>
                    </div>
                  </div>
                </div>

                <div className="border border-slate-100 bg-slate-50/50 p-4 rounded-2xl">
                  <h4 className="text-xs font-bold text-slate-900 mb-3 flex items-center gap-1">
                    <Tag className="h-3.5 w-3.5 text-slate-500" />
                    <span>Sales & Log Audit Details</span>
                  </h4>
                  <div className="space-y-2 text-xs">
                    {viewingDetailItem.type === 'scooter' ? (
                      <>

                        <div className="flex justify-between border-b border-slate-100 pb-1.5">
                          <span className="text-slate-500">Bill Number:</span>
                          <span className="font-mono text-slate-800">{viewingDetailItem.scooterDetail?.billNo || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Stock-In Number:</span>
                          <span className="font-mono text-slate-800">{viewingDetailItem.scooterDetail?.stockInNo || 'N/A'}</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex justify-between border-b border-slate-100 pb-1.5">
                          <span className="text-slate-500">Sales Record ID:</span>
                          <span className="font-mono text-slate-800">{viewingDetailItem.id}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-100 pb-1.5">
                          <span className="text-slate-500">Registered Operator:</span>
                          <span className="font-bold text-slate-800">{viewingDetailItem.meta?.operator || 'System'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Sales Notes:</span>
                          <span className="text-slate-700 truncate max-w-[150px]">{viewingDetailItem.meta?.notes || 'No Notes'}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Grid 2: Hardware Technical Specifications (Only for Scooters) */}
              {viewingDetailItem.type === 'scooter' && viewingDetailItem.scooterDetail && (
                <div className="border border-slate-200 p-4 rounded-2xl bg-slate-50/50 space-y-3">
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 border-b border-slate-150 pb-2">
                    <Package className="h-4 w-4 text-indigo-500" />
                    <span>Technical Spec Details (Scooter Components)</span>
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Chassis Number</span>
                      <strong className="text-slate-800 font-mono text-[11px]">{viewingDetailItem.scooterDetail.chassisNo}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Motor Number</span>
                      <strong className="text-slate-800 font-mono text-[11px]">{viewingDetailItem.scooterDetail.motorNo || 'N/A'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Controller Number</span>
                      <strong className="text-slate-800 font-mono text-[11px]">{viewingDetailItem.scooterDetail.controllerNo || 'N/A'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Tire Setup</span>
                      <strong className="text-slate-800">{viewingDetailItem.scooterDetail.frontTireSize || '10-inch'} Front / {viewingDetailItem.scooterDetail.rearTireSize || '10-inch'} Rear</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Brake System</span>
                      <strong className="text-slate-800">{viewingDetailItem.scooterDetail.brakeType || 'Drum'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Source Channel</span>
                      <strong className="text-slate-800 capitalize">{(viewingDetailItem.scooterDetail.sourceChannel || 'local').replace('_', ' ')}</strong>
                    </div>
                  </div>
                  {viewingDetailItem.scooterDetail.customizationNotes && (
                    <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-600">
                      <strong>Customization/Assembly Notes:</strong> "{viewingDetailItem.scooterDetail.customizationNotes}"
                    </div>
                  )}
                </div>
              )}

              {/* Grid 3: Modular Warranty Details (For Scooters with batteries/chargers) */}
              {viewingDetailItem.type === 'scooter' && viewingDetailItem.scooterDetail && (
                <div className="border border-slate-200 p-5 rounded-2xl bg-slate-50/50 space-y-4">
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 border-b border-slate-150 pb-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-500" />
                    <span>Modular Component Warranty Tracker (GET vs GIVE)</span>
                  </h4>
                  <div className="space-y-4">
                    {/* Scooter frame */}
                    <div className="flex items-center justify-between text-xs border-b border-slate-100 pb-2">
                      <div>
                        <p className="font-bold text-slate-800">🛡️ Scooter Frame / Chassis Warranty</p>
                        <p className="text-[10px] text-slate-500">Duration we give: {viewingDetailItem.scooterDetail.scooterWarrantyMonths || 12} Months</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        viewingDetailItem.scooterDetail.scooterWarrantyStatus === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {viewingDetailItem.scooterDetail.scooterWarrantyStatus || 'Active'}
                      </span>
                    </div>

                    {/* Batteries list */}
                    <div className="border-b border-slate-100 pb-3 space-y-2.5">
                      <p className="font-bold text-xs text-slate-800">🔋 Allocated Lithium Batteries ({viewingDetailItem.scooterDetail.batterySerials?.length || 0})</p>
                      {viewingDetailItem.scooterDetail.batterySerials && viewingDetailItem.scooterDetail.batterySerials.length > 0 ? (
                        <div className="space-y-3 pl-3">
                          {viewingDetailItem.scooterDetail.batterySerials.map((bs: string, idx: number) => {
                            const isWarranty = viewingDetailItem.scooterDetail.batteryWarrantyFlags?.[idx] !== false;
                            const months = viewingDetailItem.scooterDetail.batteryWarrantyMonths?.[idx] ?? 12;
                            const mfgWarranty = findManufacturerWarranty(bs, 'battery');
                            const mfgStatus = mfgWarranty 
                              ? calculateWarrantyRemaining(mfgWarranty.importDate, mfgWarranty.warrantyDurationMonths || 12)
                              : null;

                            return (
                              <div key={idx} className="bg-white p-2.5 rounded-xl border border-slate-150 text-xs space-y-2">
                                <div className="flex items-center justify-between font-semibold">
                                  <span className="font-mono text-slate-800">Slot {idx+1}: <strong>{bs}</strong></span>
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    isWarranty ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
                                  }`}>
                                    We Give: {isWarranty ? `Active (${months} M)` : 'No Warranty'}
                                  </span>
                                </div>
                                {mfgWarranty ? (
                                  <div className="text-[10px] bg-amber-50/50 text-amber-900 px-2 py-1.5 rounded-lg border border-amber-100 flex flex-col gap-1">
                                    <div className="flex justify-between items-center font-bold text-[9px] uppercase tracking-wider text-amber-800">
                                      <span>🏭 Supplier Warranty We GET</span>
                                      <span className={mfgStatus?.active ? 'text-emerald-700' : 'text-rose-700'}>
                                        {mfgStatus?.active ? 'Active' : 'Expired'}
                                      </span>
                                    </div>
                                    <div className="text-[10px] text-slate-700 flex justify-between">
                                      <span>Supplier: <strong>{mfgWarranty.supplierName || 'Unknown'}</strong> ({mfgWarranty.warrantyDurationMonths || 12}M)</span>
                                      <span className="font-mono text-slate-500">{mfgStatus?.text}</span>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-[9px] text-slate-400 italic pl-1">No supplier purchase record tracked for battery serial "{bs}".</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-slate-400 italic text-[11px] pl-3">No batteries currently allocated to this chassis unit.</p>
                      )}
                    </div>

                    {/* Charger info */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-slate-800">🔌 Allocated Smart Charger</p>
                          <p className="text-[10px] text-slate-500">
                            {viewingDetailItem.scooterDetail.chargerIncluded 
                              ? `Model: ${viewingDetailItem.scooterDetail.chargerType || 'Standard'} | SN: ${viewingDetailItem.scooterDetail.chargerSerial || 'N/A'}`
                              : 'No charger included in this transaction'}
                          </p>
                        </div>
                        {viewingDetailItem.scooterDetail.chargerIncluded && (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                            viewingDetailItem.scooterDetail.chargerWarrantyActive !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            We Give: {viewingDetailItem.scooterDetail.chargerWarrantyActive !== false ? `Active (${viewingDetailItem.scooterDetail.chargerWarrantyMonths || 12} M)` : 'No Warranty'}
                          </span>
                        )}
                      </div>

                      {viewingDetailItem.scooterDetail.chargerIncluded && viewingDetailItem.scooterDetail.chargerSerial && (() => {
                        const chargerSerial = viewingDetailItem.scooterDetail.chargerSerial;
                        const mfgWarranty = findManufacturerWarranty(chargerSerial, 'charger');
                        const mfgStatus = mfgWarranty 
                          ? calculateWarrantyRemaining(mfgWarranty.importDate, mfgWarranty.warrantyDurationMonths || 12)
                          : null;

                        if (mfgWarranty) {
                          return (
                            <div className="bg-white p-2.5 rounded-xl border border-slate-150 text-xs mt-1">
                              <div className="text-[10px] bg-amber-50/50 text-amber-900 px-2 py-1.5 rounded-lg border border-amber-100 flex flex-col gap-1">
                                <div className="flex justify-between items-center font-bold text-[9px] uppercase tracking-wider text-amber-800">
                                  <span>🏭 Supplier Warranty We GET</span>
                                  <span className={mfgStatus?.active ? 'text-emerald-700' : 'text-rose-700'}>
                                    {mfgStatus?.active ? 'Active' : 'Expired'}
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-700 flex justify-between">
                                  <span>Supplier: <strong>{mfgWarranty.supplierName || 'Unknown'}</strong> ({mfgWarranty.warrantyDurationMonths || 12}M)</span>
                                  <span className="font-mono text-slate-500">{mfgStatus?.text}</span>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return (
                          <p className="text-[9px] text-slate-400 italic pl-3 mt-1">No supplier purchase record tracked for charger serial "{chargerSerial}".</p>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              )}

              {/* Grid 3.5: Supplier Details for Standalone Battery/Charger (type !== 'scooter') */}
              {viewingDetailItem.type !== 'scooter' && (() => {
                const serialNo = viewingDetailItem.type === 'battery' ? viewingDetailItem.meta.startNo : viewingDetailItem.meta.startNo || viewingDetailItem.serialNo;
                const mfgWarranty = findManufacturerWarranty(serialNo, viewingDetailItem.type);
                const mfgStatus = mfgWarranty 
                  ? calculateWarrantyRemaining(mfgWarranty.importDate, mfgWarranty.warrantyDurationMonths || 12)
                  : null;

                return (
                  <div className="border border-slate-200 p-5 rounded-2xl bg-slate-50/50 space-y-3">
                    <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 border-b border-slate-150 pb-2">
                      <ShieldCheck className="h-4 w-4 text-amber-500" />
                      <span>Supplier Warranty Verification (WE GET)</span>
                    </h4>
                    {mfgWarranty ? (
                      <div className="space-y-3">
                        <p className="text-[11px] text-slate-500">
                          We mapped this item serial to our direct manufacturer purchase records. Here are the supplier-provided guarantee parameters:
                        </p>
                        <div className="bg-white p-3.5 rounded-2xl border border-slate-150 space-y-2 text-xs">
                          <div className="flex justify-between border-b border-slate-100 pb-2">
                            <span className="text-slate-500">Supplier/Manufacturer:</span>
                            <span className="font-bold text-slate-900">{mfgWarranty.supplierName || 'Unknown Manufacturer'}</span>
                          </div>
                          <div className="flex justify-between border-b border-slate-100 pb-2">
                            <span className="text-slate-500">Import/Purchase Date:</span>
                            <span className="font-mono text-slate-800">{mfgWarranty.importDate}</span>
                          </div>
                          <div className="flex justify-between border-b border-slate-100 pb-2">
                            <span className="text-slate-500">Supplier Cover Months:</span>
                            <span className="font-bold text-slate-900">{mfgWarranty.warrantyDurationMonths || 12} Months</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Calculated Expiry Status:</span>
                            <span className={`font-bold ${mfgStatus?.active ? 'text-emerald-700' : 'text-rose-700'}`}>
                              {mfgStatus?.text}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="py-4 text-center text-slate-400 text-xs italic">
                        ℹ️ No supplier purchase/import record matches this serial. Local inventory batch or unassigned stock.
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Grid 4: Past Repair & Claims History */}
              <div className="border border-slate-200 p-4 rounded-2xl bg-slate-50/50 space-y-3">
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 border-b border-slate-150 pb-2">
                  <Wrench className="h-4 w-4 text-cyan-500" />
                  <span>Interactive Defect & Claims History ({pastClaimsForProduct.length})</span>
                </h4>
                {pastClaimsForProduct.length === 0 ? (
                  <div className="py-6 text-center text-slate-400 text-xs italic">
                    ✓ Perfect Health! No claims, defect reports, or hardware swap logs exist for this serial number.
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                    {pastClaimsForProduct.map((claim) => (
                      <div key={claim.id} className="bg-white border border-slate-150 rounded-xl p-3 text-xs space-y-2 relative">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-black text-slate-950 text-[11px]">{claim.id}</span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                            claim.status === 'repaired' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            claim.status === 'exchanged' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                            claim.status === 'rejected' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                            'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            <span className="capitalize">{claim.status.replace('_', ' ')}</span>
                          </span>
                        </div>
                        <div className="grid grid-cols-2 text-[10px] text-slate-500 gap-x-2">
                          <p>Logged: <strong>{claim.claimDate}</strong></p>
                          <p>Defective SN: <strong className="font-mono text-slate-800">{claim.originalSerialNo}</strong></p>
                          <p className="col-span-2 mt-1">Symptom/Issue: <span className="italic text-slate-700">"{claim.issueDescription}"</span></p>
                        </div>
                        {claim.newSerialNo && (
                          <div className="bg-rose-50/50 border border-rose-100 rounded-lg p-1.5 text-[10px] text-rose-800 font-mono">
                            🔄 Replaced with Unit SN: <strong>{claim.newSerialNo}</strong>
                          </div>
                        )}
                        {claim.notes && (
                          <div className="text-[10px] text-slate-500 bg-slate-50 rounded p-1">
                            <strong>Diag notes:</strong> {claim.notes}
                          </div>
                        )}
                        <p className="text-[9px] text-right text-slate-400">Processed by: {claim.operatorName}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* Modal Footer Controls */}
            <div className="flex justify-between items-center pt-4 border-t border-slate-150">
              <span className="text-[10px] text-slate-400 font-medium">Senzo Motors ERP • Live Guarantee Database</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setViewingDetailItem(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold font-sans cursor-pointer transition-colors"
                >
                  Close Specification Sheet
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleSelectForClaim(viewingDetailItem);
                    setViewingDetailItem(null);
                  }}
                  className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl px-5 py-2.5 text-xs font-bold font-sans cursor-pointer transition-colors flex items-center gap-1.5"
                >
                  <PlusCircle className="h-4 w-4 text-pink-400" />
                  <span>Create Defective Log / Exchange</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
