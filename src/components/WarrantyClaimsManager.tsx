import React, { useState, useMemo, useEffect } from 'react';
import { 
  ShieldCheck, Search, PlusCircle, FileText, CheckCircle, Wrench, 
  RefreshCw, AlertTriangle, Calendar, User, Tag, Package, Phone, 
  Clock, Check, X, ClipboardList, HelpCircle, Cpu, Zap, Factory, 
  BarChart3, Layers, Filter, CheckCircle2, XCircle, ArrowRight
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
  const [subTab, setSubTab] = useState<'collected_queue' | 'lookup' | 'file_claim' | 'claims_ledger' | 'analytics'>('collected_queue');

  const isOwner = (currentUser?.role as string) === 'owner' || currentUser?.username?.toLowerCase() === 'owner';

  useEffect(() => {
    if (subTab === 'analytics' && !isOwner) {
      setSubTab('collected_queue');
    }
  }, [subTab, isOwner]);

  // Search state for Warranty lookup
  const [lookupQuery, setLookupQuery] = useState('');
  const [lookupCategory, setLookupCategory] = useState<string>('all');
  const [lookupResult, setLookupResult] = useState<any[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  
  // Detailed Product View State
  const [viewingDetailItem, setViewingDetailItem] = useState<any | null>(null);

  // New Claim / Intake Form State
  const [itemType, setItemType] = useState<'scooter' | 'battery' | 'charger'>('scooter');
  const [claimedComponent, setClaimedComponent] = useState<'controller' | 'motor' | 'scooter_frame' | 'battery' | 'charger'>('controller');
  const [originalSaleId, setOriginalSaleId] = useState('');
  const [originalSerialNo, setOriginalSerialNo] = useState('');
  const [modelName, setModelName] = useState('');
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

  // Supplier & Batch Info Auto-extracted
  const [supplierName, setSupplierName] = useState<string>('');
  const [containerId, setContainerId] = useState<string>('');
  const [sourceBillNo, setSourceBillNo] = useState<string>('');
  const [stockInNo, setStockInNo] = useState<string>('');
  const [supplierWarrantyStatus, setSupplierWarrantyStatus] = useState<string>('');

  // Active filter states for the claims ledger
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerSearchCategory, setLedgerSearchCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Modal / Selected Claim for Specialist Inspection in Collected Queue
  const [selectedClaim, setSelectedClaim] = useState<WarrantyClaim | null>(null);
  const [editStatus, setEditStatus] = useState<'repaired' | 'exchanged' | 'rejected'>('repaired');
  const [editNewSerialNo, setEditNewSerialNo] = useState('');
  const [specialistNotes, setSpecialistNotes] = useState('');
  const [editReplacementWarrantyMonths, setEditReplacementWarrantyMonths] = useState<number | ''>('');
  const [isUpdating, setIsUpdating] = useState(false);

  // Active collected items (currently under inspection, 1-5 days)
  const activeCollectedClaims = useMemo(() => {
    return warrantyClaims.filter(c => c.status === 'under_repair');
  }, [warrantyClaims]);

  // Closed historical claims
  const closedClaims = useMemo(() => {
    return warrantyClaims.filter(c => c.status !== 'under_repair');
  }, [warrantyClaims]);

  // Helper to find manufacturer warranty for an item from import logs
  const checkSupplierWarranty = (serialNo: string, compType: 'scooter' | 'battery' | 'charger' | 'controller' | 'motor') => {
    if (!serialNo || serialNo === 'N/A') return { status: 'No Supplier Log', supplier: 'N/A', container: 'N/A', bill: 'N/A', stockIn: 'N/A' };
    const cleanSerial = serialNo.trim().toUpperCase();

    // Manufacturer / Supplier warranty ONLY applies to Batteries and Chargers
    if (compType === 'battery') {
      const batImp = batteryImports.find(imp => {
        if (imp.serialNumbers && imp.serialNumbers.map(s => s.trim().toUpperCase()).includes(cleanSerial)) return true;
        const numQuery = parseInt(cleanSerial.replace(/\D/g, ''), 10);
        const numStart = parseInt(imp.startNo?.replace(/\D/g, '') || '', 10);
        const numEnd = parseInt(imp.endNo?.replace(/\D/g, '') || '', 10);
        return !isNaN(numQuery) && !isNaN(numStart) && !isNaN(numEnd) && numQuery >= numStart && numQuery <= numEnd;
      });

      if (batImp) {
        const impDate = new Date(batImp.importDate);
        const expiry = new Date(impDate);
        expiry.setMonth(impDate.getMonth() + (batImp.warrantyDurationMonths || 12));
        const isUnder = expiry.getTime() > Date.now();
        return {
          status: isUnder ? `Under Supplier Warranty (Expires ${expiry.toLocaleDateString()})` : `Supplier Warranty Expired (${expiry.toLocaleDateString()})`,
          supplier: batImp.supplierName || 'Battery Manufacturer',
          container: batImp.containerId || 'N/A',
          bill: batImp.billNo || 'N/A',
          stockIn: batImp.stockInNo || 'N/A'
        };
      }
    }

    if (compType === 'charger') {
      const chgImp = chargerImports.find(imp => {
        if (imp.serialNumbers && imp.serialNumbers.map(s => s.trim().toUpperCase()).includes(cleanSerial)) return true;
        if (imp.startNo && imp.endNo) {
          const numQuery = parseInt(cleanSerial.replace(/\D/g, ''), 10);
          const numStart = parseInt(imp.startNo.replace(/\D/g, ''), 10);
          const numEnd = parseInt(imp.endNo.replace(/\D/g, ''), 10);
          return !isNaN(numQuery) && !isNaN(numStart) && !isNaN(numEnd) && numQuery >= numStart && numQuery <= numEnd;
        }
        return false;
      });

      if (chgImp) {
        const impDate = new Date(chgImp.importDate);
        const expiry = new Date(impDate);
        expiry.setMonth(impDate.getMonth() + (chgImp.warrantyDurationMonths || 12));
        const isUnder = expiry.getTime() > Date.now();
        return {
          status: isUnder ? `Under Supplier Warranty (Expires ${expiry.toLocaleDateString()})` : `Supplier Warranty Expired (${expiry.toLocaleDateString()})`,
          supplier: chgImp.supplierName || 'Charger Manufacturer',
          container: chgImp.containerId || 'N/A',
          bill: chgImp.billNo || 'N/A',
          stockIn: chgImp.stockInNo || 'N/A'
        };
      }
    }

    // Scooter, Controller, Motor, Chassis do not have separate supplier warranties (covered under Seller Scooter Warranty)
    const scootUnit = scooterUnits.find(s => 
      s.chassisNo?.toUpperCase() === cleanSerial || 
      s.motorNo?.toUpperCase() === cleanSerial || 
      s.controllerNo?.toUpperCase() === cleanSerial
    );

    if (scootUnit) {
      return {
        status: 'Covered under Seller Scooter Warranty',
        supplier: 'N/A (Seller Scooter Warranty)',
        container: 'N/A',
        bill: scootUnit.billNo || scootUnit.salesBillNo || 'N/A',
        stockIn: scootUnit.stockInNo || 'N/A'
      };
    }

    return { status: 'Direct Purchase / Seller Coverage', supplier: 'N/A', container: 'N/A', bill: 'N/A', stockIn: 'N/A' };
  };

  // Search through all sold items across Scooters, Standalone Batteries, and Standalone Chargers
  const handleWarrantyLookup = () => {
    if (!lookupQuery.trim()) return;
    const query = lookupQuery.toLowerCase().trim();
    const results: any[] = [];

    // 1. Search in Scooter Units (Sold)
    scooterUnits.forEach(scoot => {
      if (scoot.status !== 'sold') return;

      const chassisOnlyMatch = scoot.chassisNo?.toLowerCase().includes(query);
      const motorOnlyMatch = scoot.motorNo?.toLowerCase().includes(query);
      const controllerOnlyMatch = scoot.controllerNo?.toLowerCase().includes(query);
      const chassisMatch = chassisOnlyMatch || motorOnlyMatch || controllerOnlyMatch;
      const batteryMatch = scoot.batterySerials?.some(s => s.toLowerCase().includes(query));
      const chargerMatch = scoot.chargerSerial?.toLowerCase().includes(query);
      const buyerMatch = scoot.buyerName?.toLowerCase().includes(query);
      const phoneMatch = scoot.buyerContact?.toLowerCase().includes(query);
      const billMatch = scoot.billNo?.toLowerCase().includes(query) || scoot.salesBillNo?.toLowerCase().includes(query);
      const stockInMatch = scoot.stockInNo?.toLowerCase().includes(query);

      let isMatch = false;
      if (lookupCategory === 'all') isMatch = !!(chassisMatch || batteryMatch || chargerMatch || buyerMatch || phoneMatch || billMatch || stockInMatch);
      else if (lookupCategory === 'chassis') isMatch = !!chassisOnlyMatch;
      else if (lookupCategory === 'motor') isMatch = !!motorOnlyMatch;
      else if (lookupCategory === 'controller') isMatch = !!controllerOnlyMatch;
      else if (lookupCategory === 'buyer') isMatch = !!buyerMatch;
      else if (lookupCategory === 'phone' || lookupCategory === 'contact') isMatch = !!phoneMatch;
      else if (lookupCategory === 'bill' || lookupCategory === 'invoice') isMatch = !!billMatch;
      else if (lookupCategory === 'stock_in' || lookupCategory === 'challan') isMatch = !!stockInMatch;
      else if (lookupCategory === 'battery') isMatch = !!batteryMatch;
      else if (lookupCategory === 'charger') isMatch = !!chargerMatch;

      if (isMatch) {
        results.push({
          type: 'scooter',
          id: scoot.id,
          title: `Scooter: ${scoot.modelName} (${scoot.color})`,
          serialNo: scoot.chassisNo,
          motorNo: scoot.motorNo,
          controllerNo: scoot.controllerNo,
          buyerName: scoot.buyerName,
          buyerContact: scoot.buyerContact || 'N/A',
          saleDate: scoot.saleDate ? scoot.saleDate.split('T')[0] : 'N/A',
          duration: scoot.scooterWarrantyMonths || 12,
          meta: scoot
        });
      }
    });

    // 2. Search in Standalone Battery Sales
    batterySales.forEach(sale => {
      if (sale.status !== 'sold') return;

      const seriesMatch = sale.batterySeries?.toLowerCase().includes(query);
      const startNoMatch = sale.startNo?.toLowerCase().includes(query);
      const endNoMatch = sale.endNo?.toLowerCase().includes(query);
      const buyerMatch = sale.buyerName?.toLowerCase().includes(query);
      const phoneMatch = sale.buyerContact?.toLowerCase().includes(query);
      const billMatch = sale.billNo?.toLowerCase().includes(query);

      let serialInRange = false;
      if (sale.startNo && sale.endNo) {
        const numQuery = parseInt(query.replace(/\D/g, ''), 10);
        const numStart = parseInt(sale.startNo.replace(/\D/g, ''), 10);
        const numEnd = parseInt(sale.endNo.replace(/\D/g, ''), 10);
        if (!isNaN(numQuery) && !isNaN(numStart) && !isNaN(numEnd)) {
          serialInRange = numQuery >= numStart && numQuery <= numEnd;
        }
      }

      let isMatch = false;
      if (lookupCategory === 'all') isMatch = !!(seriesMatch || startNoMatch || endNoMatch || buyerMatch || phoneMatch || billMatch || serialInRange);
      else if (lookupCategory === 'battery' || lookupCategory === 'chassis') isMatch = !!(seriesMatch || startNoMatch || endNoMatch || serialInRange);
      else if (lookupCategory === 'buyer') isMatch = !!buyerMatch;
      else if (lookupCategory === 'phone' || lookupCategory === 'contact') isMatch = !!phoneMatch;
      else if (lookupCategory === 'bill' || lookupCategory === 'invoice') isMatch = !!billMatch;

      if (isMatch) {
        results.push({
          type: 'battery',
          id: sale.id,
          title: `Standalone Battery: ${sale.batterySeries}`,
          serialNo: sale.startNo === sale.endNo ? sale.startNo : `${sale.startNo} to ${sale.endNo}`,
          buyerName: sale.buyerName,
          buyerContact: sale.buyerContact || 'N/A',
          saleDate: sale.saleDate ? sale.saleDate.split('T')[0] : 'N/A',
          duration: sale.warrantyDurationMonths || 12,
          meta: sale
        });
      }
    });

    // 3. Search in Standalone Charger Sales
    chargerSales.forEach(sale => {
      if (sale.status !== 'sold') return;

      const typeMatch = sale.chargerType?.toLowerCase().includes(query);
      const startNoMatch = sale.startNo?.toLowerCase().includes(query);
      const endNoMatch = sale.endNo?.toLowerCase().includes(query);
      const buyerMatch = sale.buyerName?.toLowerCase().includes(query);
      const phoneMatch = sale.buyerContact?.toLowerCase().includes(query);
      const billMatch = sale.billNo?.toLowerCase().includes(query);

      let isMatch = false;
      if (lookupCategory === 'all') isMatch = !!(typeMatch || startNoMatch || endNoMatch || buyerMatch || phoneMatch || billMatch);
      else if (lookupCategory === 'charger' || lookupCategory === 'chassis') isMatch = !!(typeMatch || startNoMatch || endNoMatch);
      else if (lookupCategory === 'buyer') isMatch = !!buyerMatch;
      else if (lookupCategory === 'phone' || lookupCategory === 'contact') isMatch = !!phoneMatch;
      else if (lookupCategory === 'bill' || lookupCategory === 'invoice') isMatch = !!billMatch;

      if (isMatch) {
        results.push({
          type: 'charger',
          id: sale.id,
          title: `Standalone Charger: ${sale.chargerType}`,
          serialNo: sale.startNo === sale.endNo ? sale.startNo : `${sale.startNo} to ${sale.endNo}`,
          buyerName: sale.buyerName,
          buyerContact: sale.buyerContact || 'N/A',
          saleDate: sale.saleDate ? sale.saleDate.split('T')[0] : 'N/A',
          duration: sale.warrantyDurationMonths || 12,
          meta: sale
        });
      }
    });

    setLookupResult(results);
    setHasSearched(true);
  };

  // Pre-fill Claim Intake Form with lookup result
  const handleSelectForClaim = (item: any, specificType?: 'controller' | 'motor' | 'scooter_frame' | 'scooter_battery' | 'scooter_charger' | 'standalone_battery' | 'standalone_charger') => {
    setItemType(item.type);
    setOriginalSaleId(item.id);
    setBuyerName(item.buyerName);
    setBuyerContact(item.buyerContact === 'N/A' ? '' : item.buyerContact);
    setSaleDate(item.saleDate);
    setWarrantyDuration(item.duration);

    let lookupSerialForSupplier = item.serialNo || item.meta?.chassisNo;

    if (item.type === 'scooter') {
      setModelName(item.meta.modelName || 'Scooter Unit');
      if (specificType === 'controller') {
        setClaimedComponent('controller');
        setOriginalSerialNo(item.meta.controllerNo || item.meta.chassisNo);
        setIsBatteryClaim(false);
      } else if (specificType === 'motor') {
        setClaimedComponent('motor');
        setOriginalSerialNo(item.meta.motorNo || item.meta.chassisNo);
        setIsBatteryClaim(false);
      } else if (specificType === 'scooter_battery') {
        setClaimedComponent('battery');
        const defaultSerial = item.meta.batterySerials?.[0] || 'BAT-1';
        setOriginalSerialNo(defaultSerial);
        lookupSerialForSupplier = defaultSerial;
        setIsBatteryClaim(true);
      } else if (specificType === 'scooter_charger') {
        setClaimedComponent('charger');
        const defaultSerial = item.meta.chargerSerial || 'CHG-1';
        setOriginalSerialNo(defaultSerial);
        lookupSerialForSupplier = defaultSerial;
        setIsBatteryClaim(false);
      } else {
        setClaimedComponent('scooter_frame');
        setOriginalSerialNo(item.meta.chassisNo);
        setIsBatteryClaim(false);
      }
    } else if (item.type === 'battery') {
      setModelName(item.meta.batterySeries || 'Battery Pack');
      setClaimedComponent('battery');
      const defaultSerial = item.meta.startNo ? (item.meta.startNo === item.meta.endNo ? item.meta.startNo : item.meta.startNo) : item.serialNo;
      setOriginalSerialNo(defaultSerial);
      lookupSerialForSupplier = defaultSerial;
      setIsBatteryClaim(true);
    } else if (item.type === 'charger') {
      setModelName(item.meta.chargerType || 'Charger Unit');
      setClaimedComponent('charger');
      const defaultSerial = item.meta.startNo ? (item.meta.startNo === item.meta.endNo ? item.meta.startNo : item.meta.startNo) : item.serialNo;
      setOriginalSerialNo(defaultSerial);
      lookupSerialForSupplier = defaultSerial;
      setIsBatteryClaim(false);
    }

    // Auto extract supplier / manufacturer info for battery/charger
    const compType = item.type === 'battery' || specificType === 'scooter_battery' ? 'battery' : (item.type === 'charger' || specificType === 'scooter_charger' ? 'charger' : 'scooter');
    const supp = checkSupplierWarranty(lookupSerialForSupplier, compType);
    setSupplierName(supp.supplier);
    setContainerId(supp.container);
    setSourceBillNo(supp.bill);
    setStockInNo(supp.stockIn);
    setSupplierWarrantyStatus(supp.status);

    setReplacementWarrantyMonths('');
    setSubTab('file_claim');
    setFormStatus(null);
  };

  // Submit new defective claim (collects item into 1-5 day inspection queue)
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!originalSaleId || !originalSerialNo || !buyerName || !issueDescription) {
      setFormStatus({ type: 'error', text: 'Please fill in all required fields marked with *' });
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
          claimedComponent,
          modelName: modelName || itemType.toUpperCase(),
          buyerName,
          buyerContact: buyerContact || undefined,
          saleDate: saleDate || undefined,
          warrantyDurationMonths: warrantyDuration,
          issueDescription,
          status: 'under_repair', // Default state: collected & in 1-5 day workshop queue
          actionTaken: 'pending',
          notes,
          operatorName: currentUser.name,
          operatorUsername: currentUser.username,
          collectedDate: new Date().toISOString(),
          supplierName: supplierName || undefined,
          containerId: containerId || undefined,
          sourceBillNo: sourceBillNo || undefined,
          stockInNo: stockInNo || undefined,
          supplierWarrantyStatus: supplierWarrantyStatus || undefined,
          isBattery: isBatteryClaim
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to register collected item.');
      }

      const savedClaim = await response.json();
      setFormStatus({
        type: 'success',
        text: `Successfully collected item (Claim ID: ${savedClaim.id})! Product moved into the Specialist Inspection Queue (1-5 Day SLA).`
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
      setSubTab('collected_queue');
    } catch (err: any) {
      setFormStatus({ type: 'error', text: err.message || 'Error occurred while saving claim.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Complete specialist inspection for a collected item (Fix / Replace / Reject)
  const handleCompleteSpecialistInspection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClaim) return;

    if (editStatus === 'exchanged' && !editNewSerialNo.trim()) {
      alert('Replacement serial number is required when exchanging for a new product.');
      return;
    }

    if (!specialistNotes.trim()) {
      alert('Please enter specialist diagnostic findings / outcome details.');
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
          claimedComponent: selectedClaim.claimedComponent,
          modelName: selectedClaim.modelName,
          buyerName: selectedClaim.buyerName,
          issueDescription: selectedClaim.issueDescription,
          status: editStatus,
          actionTaken: editStatus,
          newSerialNo: editStatus === 'exchanged' ? editNewSerialNo : undefined,
          specialistNotes,
          notes: selectedClaim.notes ? `${selectedClaim.notes} | Specialist: ${specialistNotes}` : specialistNotes,
          operatorName: currentUser.name,
          operatorUsername: currentUser.username,
          replacementWarrantyMonths: (editStatus === 'exchanged' && (selectedClaim.isBattery || selectedClaim.originalSaleType === 'battery') && editReplacementWarrantyMonths !== '') ? Number(editReplacementWarrantyMonths) : undefined,
          isBattery: selectedClaim.isBattery || (selectedClaim.originalSaleType === 'battery')
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to update claim resolution.');
      }

      alert(`Claim ${selectedClaim.id} completed and closed successfully! Outcome: ${editStatus.toUpperCase()}`);
      setSelectedClaim(null);
      setEditNewSerialNo('');
      setSpecialistNotes('');
      await onRefresh();
    } catch (err: any) {
      alert(`Error updating claim: ${err.message}`);
    } finally {
      setIsUpdating(false);
    }
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
  const filteredLedgerClaims = useMemo(() => {
    let list = [...closedClaims];

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
      list = list.filter(c => {
        const claimIdMatch = c.id?.toLowerCase().includes(q);
        const serialMatch = c.originalSerialNo?.toLowerCase().includes(q) || (c.newSerialNo && c.newSerialNo.toLowerCase().includes(q));
        const buyerMatch = c.buyerName?.toLowerCase().includes(q);
        const phoneMatch = c.buyerContact?.toLowerCase().includes(q);
        const issueMatch = c.issueDescription?.toLowerCase().includes(q);

        if (ledgerSearchCategory === 'all') return claimIdMatch || serialMatch || buyerMatch || phoneMatch || issueMatch;
        if (ledgerSearchCategory === 'claim_id') return claimIdMatch;
        if (ledgerSearchCategory === 'serial') return serialMatch;
        if (ledgerSearchCategory === 'buyer') return buyerMatch;
        if (ledgerSearchCategory === 'phone') return phoneMatch;
        if (ledgerSearchCategory === 'issue') return issueMatch;
        return true;
      });
    }

    return list.sort((a, b) => new Date(b.claimDate).getTime() - new Date(a.claimDate).getTime());
  }, [closedClaims, ledgerSearch, ledgerSearchCategory, statusFilter, typeFilter]);

  // Analytics & Owner Complaints Summary Calculations
  const analyticsData = useMemo(() => {
    const totalClaims = warrantyClaims.length;
    const activeCollected = activeCollectedClaims.length;
    const repairedCount = warrantyClaims.filter(c => c.status === 'repaired').length;
    const replacedCount = warrantyClaims.filter(c => c.status === 'exchanged').length;
    const rejectedCount = warrantyClaims.filter(c => c.status === 'rejected').length;

    // Complaints by Model
    const modelComplaints: { [model: string]: number } = {};
    warrantyClaims.forEach(c => {
      const model = c.modelName || 'General / Unspecified';
      modelComplaints[model] = (modelComplaints[model] || 0) + 1;
    });

    // Complaints by Component
    const componentComplaints: { [comp: string]: number } = {
      'Controller': 0,
      'Motor': 0,
      'Scooter Frame': 0,
      'Battery': 0,
      'Charger': 0
    };

    warrantyClaims.forEach(c => {
      if (c.claimedComponent === 'controller') componentComplaints['Controller']++;
      else if (c.claimedComponent === 'motor') componentComplaints['Motor']++;
      else if (c.claimedComponent === 'scooter_frame') componentComplaints['Scooter Frame']++;
      else if (c.claimedComponent === 'battery') componentComplaints['Battery']++;
      else if (c.claimedComponent === 'charger') componentComplaints['Charger']++;
      else if (c.isBattery || c.originalSaleType === 'battery') componentComplaints['Battery']++;
      else if (c.originalSaleType === 'charger') componentComplaints['Charger']++;
      else componentComplaints['Scooter Frame']++;
    });

    return {
      totalClaims,
      activeCollected,
      repairedCount,
      replacedCount,
      rejectedCount,
      modelComplaints,
      componentComplaints
    };
  }, [warrantyClaims, activeCollectedClaims]);

  return (
    <div className="space-y-6" id="warranty-manager-container">
      {/* 1. Header & Navigation Tabs */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden" id="warranty-header">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <ShieldCheck className="h-48 w-48 text-cyan-400" />
        </div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full font-sans">
                Streamlined 1-5 Day Service SLA
              </span>
            </div>
            <h2 className="text-2xl font-black tracking-tight font-sans mt-1">🛡️ Warranty Service & Complaints Center</h2>
            <p className="text-slate-300 text-xs font-sans mt-1 max-w-2xl">
              Controller & Motor covered under Seller Scooter Warranty. Collect defective items, process specialist inspection (1-5 days turnaround), replace/repair, and monitor batch defect analytics.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              className="bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-xl px-4 py-2.5 text-xs font-bold font-sans cursor-pointer flex items-center gap-1.5 border border-slate-700 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5 text-cyan-400" />
              <span>Refresh Records</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 mt-6 border-t border-slate-800 pt-5">
          <button
            onClick={() => setSubTab('collected_queue')}
            className={`px-4 py-2 rounded-xl text-xs font-bold font-sans tracking-wide transition-all cursor-pointer flex items-center gap-2 relative ${
              subTab === 'collected_queue'
                ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20 font-black'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Package className="h-4 w-4" />
            <span>📦 Collected Items In Inspection</span>
            {activeCollectedClaims.length > 0 && (
              <span className="bg-slate-900 text-amber-300 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold">
                {activeCollectedClaims.length}
              </span>
            )}
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
            <span>🔍 Lookup & Collect Item</span>
          </button>

          <button
            onClick={() => setSubTab('file_claim')}
            className={`px-4 py-2 rounded-xl text-xs font-bold font-sans tracking-wide transition-all cursor-pointer flex items-center gap-1.5 ${
              subTab === 'file_claim'
                ? 'bg-emerald-400 text-slate-950 shadow-md shadow-emerald-400/20'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <PlusCircle className="h-4 w-4" />
            <span>➕ Direct Intake Form</span>
          </button>

          <button
            onClick={() => setSubTab('claims_ledger')}
            className={`px-4 py-2 rounded-xl text-xs font-bold font-sans tracking-wide transition-all cursor-pointer flex items-center gap-1.5 ${
              subTab === 'claims_ledger'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <ClipboardList className="h-4 w-4" />
            <span>📋 Closed History ({closedClaims.length})</span>
          </button>

          {isOwner && (
            <button
              onClick={() => setSubTab('analytics')}
              className={`px-4 py-2 rounded-xl text-xs font-bold font-sans tracking-wide transition-all cursor-pointer flex items-center gap-1.5 ${
                subTab === 'analytics'
                  ? 'bg-purple-400 text-slate-950 shadow-md shadow-purple-400/20 font-black'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <BarChart3 className="h-4 w-4" />
              <span>📊 Owner Complaints & Batch Analytics</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. TAB: COLLECTED ITEMS IN INSPECTION (WORKSHOP 1-5 DAYS QUEUE) */}
      {subTab === 'collected_queue' && (
        <div className="space-y-6 animate-fade-in" id="warranty-collected-queue-view">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-600 flex-shrink-0" />
              <div>
                <p className="font-bold text-sm text-amber-950">Active Collected Items Queue (1–5 Days Turnaround SLA)</p>
                <p className="text-amber-800 mt-0.5">
                  When customers bring in defective parts, we collect them here. Our specialists test them to determine if fixable, eligible for brand new unit replacement, or rejected due to customer damage.
                </p>
              </div>
            </div>
            <button
              onClick={() => setSubTab('lookup')}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs transition-colors flex items-center gap-1.5 flex-shrink-0 cursor-pointer shadow-sm"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Collect New Item</span>
            </button>
          </div>

          {activeCollectedClaims.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-400 space-y-3">
              <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto" />
              <h3 className="text-base font-bold text-slate-800">No Collected Items Pending Specialist Inspection</h3>
              <p className="text-xs max-w-md mx-auto text-slate-500">
                All collected warranty products have been inspected, repaired, or replaced. Use the "Lookup & Collect Item" tab when a customer arrives with a defective part.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {activeCollectedClaims.map(claim => {
                const collectDate = claim.collectedDate ? new Date(claim.collectedDate) : new Date(claim.claimDate);
                const daysInWorkshop = Math.max(1, Math.ceil((Date.now() - collectDate.getTime()) / (1000 * 60 * 60 * 24)));

                return (
                  <div key={claim.id} className="bg-white rounded-3xl border border-amber-200 shadow-sm p-5 hover:shadow-md transition-all flex flex-col justify-between space-y-4 relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-amber-400 text-slate-950 font-black text-[10px] px-3 py-1 rounded-bl-xl uppercase tracking-wider font-mono">
                      Day {daysInWorkshop} of 5 SLA
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2 pr-16">
                        <span className="bg-slate-100 text-slate-800 font-mono font-bold text-xs px-2.5 py-1 rounded-lg">
                          {claim.id}
                        </span>
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {claim.modelName || claim.originalSaleType.toUpperCase()}
                        </span>
                      </div>

                      <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Claimed Component:</span>
                          <span className="font-bold text-slate-800 uppercase flex items-center gap-1">
                            {claim.claimedComponent === 'controller' && <Cpu className="h-3.5 w-3.5 text-cyan-600" />}
                            {claim.claimedComponent === 'motor' && <Zap className="h-3.5 w-3.5 text-amber-600" />}
                            {claim.claimedComponent === 'battery' && <Zap className="h-3.5 w-3.5 text-emerald-600" />}
                            {claim.claimedComponent === 'charger' && <Zap className="h-3.5 w-3.5 text-purple-600" />}
                            {claim.claimedComponent || 'Scooter Component'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Serial Number:</span>
                          <span className="font-mono font-bold text-slate-900">{claim.originalSerialNo}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Customer Name:</span>
                          <span className="font-bold text-slate-900">{claim.buyerName}</span>
                        </div>
                        {claim.buyerContact && (
                          <div className="flex justify-between">
                            <span className="text-slate-500">Contact:</span>
                            <span className="font-mono text-slate-700">{claim.buyerContact}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-500">Collected On:</span>
                          <span className="text-slate-700">{collectDate.toLocaleDateString()}</span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Reported Customer Problem:</label>
                        <p className="text-xs bg-amber-50/60 border border-amber-100 text-amber-950 p-2.5 rounded-xl font-medium">
                          "{claim.issueDescription}"
                        </p>
                      </div>

                      {claim.supplierWarrantyStatus && (
                        <div className="bg-purple-50/70 border border-purple-100 rounded-xl p-2.5 text-[11px] space-y-0.5">
                          <div className="flex items-center gap-1 text-purple-900 font-bold">
                            <Factory className="h-3.5 w-3.5 text-purple-600" />
                            <span>Supplier / Factory Warranty:</span>
                          </div>
                          <p className="text-purple-800 font-medium">{claim.supplierWarrantyStatus}</p>
                          {claim.supplierName && (
                            <p className="text-slate-500 text-[10px]">Supplier: {claim.supplierName} • Container: {claim.containerId || 'N/A'}</p>
                          )}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        setSelectedClaim(claim);
                        setEditStatus('repaired');
                        setEditNewSerialNo('');
                        setSpecialistNotes('');
                      }}
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-xl py-2.5 text-xs font-bold font-sans cursor-pointer transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <Wrench className="h-3.5 w-3.5 text-amber-400" />
                      <span>Complete Specialist Inspection</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 3. TAB: Check Serial Warranty & Lookup */}
      {subTab === 'lookup' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in" id="warranty-lookup-view">
          <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-pink-50 flex items-center justify-center border border-pink-100">
                  <Search className="h-4 w-4 text-pink-500" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-950">Verify Active Warranty</h3>
                  <p className="text-[11px] text-cyan-700 font-bold">💡 Scooter Warranty covers Scooter, Controller & Motor</p>
                </div>
              </div>
              <p className="text-xs text-slate-500">
                Search buyer name, chassis number, motor number, controller number, battery barcode, or charger serial to verify warranty and collect defective hardware.
              </p>

              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-700">Search Parameter & Field Filter</label>
                
                <select
                  value={lookupCategory}
                  onChange={(e) => setLookupCategory(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-pink-500 font-sans cursor-pointer"
                >
                  <option value="all">🔍 Search Field: All Criteria</option>
                  <option value="chassis">🚲 Chassis Number</option>
                  <option value="motor">⚙️ Motor Number (Scooter Warranty)</option>
                  <option value="controller">🔌 Controller Number (Scooter Warranty)</option>
                  <option value="bill">📄 Bill Number</option>
                  <option value="invoice">🧾 Invoice Number</option>
                  <option value="buyer">👤 Buyer's Name</option>
                  <option value="phone">📞 Phone Number</option>
                  <option value="contact">📱 Contact Number</option>
                  <option value="stock_in">📦 Stock IN Number</option>
                  <option value="challan">📋 Challan Number</option>
                  <option value="battery">🔋 Battery Serial / Range</option>
                  <option value="charger">🔌 Charger Serial / Type</option>
                </select>

                <div className="relative">
                  <input
                    type="text"
                    value={lookupQuery}
                    onChange={(e) => setLookupQuery(e.target.value)}
                    placeholder="Search chassis #, motor #, controller #, buyer name..."
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
                  Lookup Sold Warranty Records
                </button>
              </div>
            </div>

            <div className="mt-8 bg-slate-50 rounded-2xl p-4 border border-slate-100 text-xs text-slate-500 space-y-2">
              <p className="font-bold text-slate-700">💡 Service Workflow Rules:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Scooter Warranty explicitly covers <strong>Scooter Chassis</strong>, <strong>Controller</strong>, and <strong>Motor</strong>.</li>
                <li>When collecting a defective item, record the customer's problem description.</li>
                <li>Collected items move to the 1-5 day inspection queue for specialist testing.</li>
              </ul>
            </div>
          </div>

          <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 p-6 shadow-sm min-h-[400px]">
            <h3 className="text-sm font-bold text-slate-950 mb-4 flex items-center gap-1.5">
              <span>Results & Component Options</span>
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
                  We could not find a matching sold scooter chassis, motor, controller, battery, or charger for "{lookupQuery}".
                </p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                {lookupResult.map((item, index) => {
                  const warranty = calculateWarrantyRemaining(item.saleDate, item.duration);
                  const supp = checkSupplierWarranty(item.serialNo || item.meta?.chassisNo, item.type);

                  return (
                    <div 
                      key={index} 
                      className="border border-slate-200 rounded-2xl p-4 hover:border-pink-300 transition-all bg-slate-50/50 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-800">
                            {item.type}
                          </span>
                          <h4 className="text-sm font-bold text-slate-900 mt-1">{item.title}</h4>
                          <p className="text-xs text-slate-500 font-mono mt-0.5">
                            Buyer: <strong className="text-slate-800">{item.buyerName}</strong> ({item.buyerContact}) • Sold: {item.saleDate}
                          </p>
                        </div>
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${warranty.badgeColor}`}>
                          {warranty.text}
                        </span>
                      </div>

                      {/* Component breakdown choices for scooter */}
                      {item.type === 'scooter' && (
                        <div className="bg-white rounded-xl p-3 border border-slate-200 space-y-2">
                          <p className="text-[11px] font-bold text-slate-700">Select Specific Defective Component To Collect:</p>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            <button
                              onClick={() => handleSelectForClaim(item, 'controller')}
                              className="bg-slate-50 hover:bg-cyan-50 hover:border-cyan-300 border border-slate-200 rounded-xl p-2 text-left transition-colors cursor-pointer"
                            >
                              <div className="flex items-center gap-1 text-xs font-bold text-cyan-900">
                                <Cpu className="h-3.5 w-3.5 text-cyan-600" />
                                <span>Controller</span>
                              </div>
                              <p className="text-[10px] font-mono text-slate-500 truncate mt-0.5">{item.controllerNo || 'N/A'}</p>
                            </button>

                            <button
                              onClick={() => handleSelectForClaim(item, 'motor')}
                              className="bg-slate-50 hover:bg-amber-50 hover:border-amber-300 border border-slate-200 rounded-xl p-2 text-left transition-colors cursor-pointer"
                            >
                              <div className="flex items-center gap-1 text-xs font-bold text-amber-900">
                                <Zap className="h-3.5 w-3.5 text-amber-600" />
                                <span>Motor</span>
                              </div>
                              <p className="text-[10px] font-mono text-slate-500 truncate mt-0.5">{item.motorNo || 'N/A'}</p>
                            </button>

                            <button
                              onClick={() => handleSelectForClaim(item, 'scooter_frame')}
                              className="bg-slate-50 hover:bg-purple-50 hover:border-purple-300 border border-slate-200 rounded-xl p-2 text-left transition-colors cursor-pointer"
                            >
                              <div className="flex items-center gap-1 text-xs font-bold text-purple-900">
                                <ShieldCheck className="h-3.5 w-3.5 text-purple-600" />
                                <span>Chassis Frame</span>
                              </div>
                              <p className="text-[10px] font-mono text-slate-500 truncate mt-0.5">{item.meta.chassisNo}</p>
                            </button>

                            {item.meta.batterySerials && item.meta.batterySerials.length > 0 && (
                              <button
                                onClick={() => handleSelectForClaim(item, 'scooter_battery')}
                                className="bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 border border-slate-200 rounded-xl p-2 text-left transition-colors cursor-pointer"
                              >
                                <div className="flex items-center gap-1 text-xs font-bold text-emerald-900">
                                  <Zap className="h-3.5 w-3.5 text-emerald-600" />
                                  <span>Battery</span>
                                </div>
                                <p className="text-[10px] font-mono text-slate-500 truncate mt-0.5">{item.meta.batterySerials[0]}</p>
                              </button>
                            )}

                            {item.meta.chargerIncluded && (
                              <button
                                onClick={() => handleSelectForClaim(item, 'scooter_charger')}
                                className="bg-slate-50 hover:bg-indigo-50 hover:border-indigo-300 border border-slate-200 rounded-xl p-2 text-left transition-colors cursor-pointer"
                              >
                                <div className="flex items-center gap-1 text-xs font-bold text-indigo-900">
                                  <Zap className="h-3.5 w-3.5 text-indigo-600" />
                                  <span>Charger</span>
                                </div>
                                <p className="text-[10px] font-mono text-slate-500 truncate mt-0.5">{item.meta.chargerSerial || 'N/A'}</p>
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {(item.type === 'battery' || item.type === 'charger') && (
                        <button
                          onClick={() => handleSelectForClaim(item)}
                          className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl px-4 py-2 text-xs font-bold cursor-pointer transition-colors flex items-center gap-1.5"
                        >
                          <PlusCircle className="h-3.5 w-3.5 text-emerald-400" />
                          <span>Collect {item.type.toUpperCase()} for Warranty Inspection</span>
                        </button>
                      )}

                      <div className="text-[10px] text-slate-500 flex items-center gap-3 pt-1 border-t border-slate-100">
                        <span>Factory Warranty: <strong className="text-slate-700">{supp.status}</strong></span>
                        {supp.supplier !== 'N/A' && <span>Supplier: {supp.supplier}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. TAB: DIRECT INTAKE FORM */}
      {subTab === 'file_claim' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm animate-fade-in" id="warranty-form-view">
          <div className="flex items-center gap-2 mb-6">
            <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center border border-emerald-100">
              <PlusCircle className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-950">Collect Defective Item & Submit Claim</h3>
              <p className="text-xs text-slate-500">
                Write down the problem reported by the customer and collect the product into the 1-5 day inspection queue.
              </p>
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Sale Product Type *</label>
                <select
                  value={itemType}
                  onChange={(e) => setItemType(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:border-emerald-500 font-sans cursor-pointer"
                >
                  <option value="scooter">🛵 Scooter Unit</option>
                  <option value="battery">🔋 Standalone Battery Sale</option>
                  <option value="charger">🔌 Standalone Charger Sale</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Claimed Component *</label>
                <select
                  value={claimedComponent}
                  onChange={(e) => setClaimedComponent(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-emerald-500 font-sans cursor-pointer"
                >
                  <option value="controller">🔌 Controller (Scooter Warranty)</option>
                  <option value="motor">⚙️ Motor (Scooter Warranty)</option>
                  <option value="scooter_frame">🚲 Scooter Chassis / Body</option>
                  <option value="battery">🔋 Battery Pack</option>
                  <option value="charger">🔌 Charger Unit</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Serial Number / Code *</label>
                <input
                  type="text"
                  value={originalSerialNo}
                  onChange={(e) => setOriginalSerialNo(e.target.value)}
                  placeholder="Chassis SN, motor SN, controller SN, battery SN"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:border-emerald-500 font-sans font-mono font-bold"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Model Name</label>
                <input
                  type="text"
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  placeholder="e.g. Sprint EV 60V, City Glide"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:border-emerald-500 font-sans"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Customer Name *</label>
                <input
                  type="text"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  placeholder="Buyer's full name"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:border-emerald-500 font-sans"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Customer Contact Number</label>
                <input
                  type="text"
                  value={buyerContact}
                  onChange={(e) => setBuyerContact(e.target.value)}
                  placeholder="e.g. +91 9876543210"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:border-emerald-500 font-sans"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">Customer's Reported Problem / Failure Description *</label>
              <textarea
                value={issueDescription}
                onChange={(e) => setIssueDescription(e.target.value)}
                placeholder="Describe what the customer reported (e.g. Controller error 03, Motor making loud clicking noise, battery not taking charge)..."
                rows={3}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:border-emerald-500 font-sans resize-none"
                required
              />
            </div>

            {/* Supplier Warranty Info Box */}
            <div className="bg-purple-50/70 border border-purple-100 rounded-2xl p-4 text-xs space-y-2">
              <div className="flex items-center gap-2 text-purple-900 font-bold">
                <Factory className="h-4 w-4 text-purple-600" />
                <span>Supplier / Factory Origin Lineage</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-slate-700">
                <div>
                  <span className="text-slate-500 block text-[10px]">Supplier Name:</span>
                  <input
                    type="text"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    placeholder="Factory/Supplier"
                    className="w-full bg-white border border-purple-200 rounded-lg px-2 py-1 text-xs"
                  />
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Container ID:</span>
                  <input
                    type="text"
                    value={containerId}
                    onChange={(e) => setContainerId(e.target.value)}
                    placeholder="Container #"
                    className="w-full bg-white border border-purple-200 rounded-lg px-2 py-1 text-xs"
                  />
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Import Bill #:</span>
                  <input
                    type="text"
                    value={sourceBillNo}
                    onChange={(e) => setSourceBillNo(e.target.value)}
                    placeholder="Bill #"
                    className="w-full bg-white border border-purple-200 rounded-lg px-2 py-1 text-xs"
                  />
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Factory Warranty Status:</span>
                  <input
                    type="text"
                    value={supplierWarrantyStatus}
                    onChange={(e) => setSupplierWarrantyStatus(e.target.value)}
                    placeholder="Under Warranty"
                    className="w-full bg-white border border-purple-200 rounded-lg px-2 py-1 text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">Intake / Collection Notes</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Physical condition on receipt: minor scratches, charger cable included..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:border-emerald-500 font-sans"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSubTab('collected_queue')}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold font-sans cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl px-6 py-2.5 text-xs font-sans cursor-pointer transition-colors flex items-center gap-1.5 shadow-md shadow-amber-500/20"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Collecting Product...</span>
                  </>
                ) : (
                  <>
                    <Package className="h-4 w-4 text-slate-950" />
                    <span>Collect Product & Add to 1-5 Day Workshop Queue</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 5. TAB: HISTORICAL / CLOSED CLAIMS LEDGER */}
      {subTab === 'claims_ledger' && (
        <div className="space-y-4 animate-fade-in" id="warranty-ledger-view">
          <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <ClipboardList className="h-4 w-4 text-cyan-600" />
                <span>Closed Claims & Historical Log</span>
              </h3>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-cyan-500 cursor-pointer"
                >
                  <option value="all">Status: All Outcomes</option>
                  <option value="repaired">✅ Fixed & Repaired</option>
                  <option value="exchanged">🔄 Replaced with New Unit</option>
                  <option value="rejected">❌ Claim Rejected (Customer Damage)</option>
                </select>

                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-cyan-500 cursor-pointer"
                >
                  <option value="all">Type: All Products</option>
                  <option value="scooter">🛵 Scooter</option>
                  <option value="battery">🔋 Battery</option>
                  <option value="charger">🔌 Charger</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={ledgerSearch}
                  onChange={(e) => setLedgerSearch(e.target.value)}
                  placeholder="Search claim ID, buyer name, serial number, problem description..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs outline-none focus:bg-white focus:border-cyan-500 font-sans"
                />
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              </div>
            </div>
          </div>

          {filteredLedgerClaims.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-400 space-y-2">
              <ClipboardList className="h-10 w-10 text-slate-200 mx-auto" />
              <p className="text-xs font-bold text-slate-700">No closed claims match your filters</p>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-4">Claim ID</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Customer</th>
                      <th className="py-3 px-4">Component & Serial</th>
                      <th className="py-3 px-4">Problem Reported</th>
                      <th className="py-3 px-4">Specialist Outcome</th>
                      <th className="py-3 px-4">Replacement SN</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredLedgerClaims.map(claim => (
                      <tr key={claim.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">{claim.id}</td>
                        <td className="py-3 px-4 text-slate-600 text-[11px]">
                          {claim.claimDate}
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-bold text-slate-900">{claim.buyerName}</p>
                          <p className="text-[10px] text-slate-500 font-mono">{claim.buyerContact || 'N/A'}</p>
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-bold text-slate-800 uppercase">{claim.claimedComponent || claim.originalSaleType}</p>
                          <p className="font-mono text-[11px] text-slate-600">{claim.originalSerialNo}</p>
                        </td>
                        <td className="py-3 px-4 max-w-xs truncate text-slate-700" title={claim.issueDescription}>
                          {claim.issueDescription}
                        </td>
                        <td className="py-3 px-4">
                          {claim.status === 'repaired' && (
                            <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 font-bold text-[10px] px-2.5 py-0.5 rounded-full">
                              <Check className="h-3 w-3 text-emerald-600" /> Repaired & Fixed
                            </span>
                          )}
                          {claim.status === 'exchanged' && (
                            <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 font-bold text-[10px] px-2.5 py-0.5 rounded-full">
                              <RefreshCw className="h-3 w-3 text-blue-600" /> Replaced New
                            </span>
                          )}
                          {claim.status === 'rejected' && (
                            <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-800 font-bold text-[10px] px-2.5 py-0.5 rounded-full">
                              <X className="h-3 w-3 text-rose-600" /> Rejected (Customer Damage)
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-900 font-bold">
                          {claim.newSerialNo || '—'}
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

      {/* 6. TAB: OWNER COMPLAINTS & BATCH ANALYTICS */}
      {subTab === 'analytics' && isOwner && (
        <div className="space-y-6 animate-fade-in" id="warranty-analytics-view">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="bg-white rounded-3xl border border-slate-200 p-4 shadow-sm">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Total Claims Filed</span>
              <p className="text-2xl font-black text-slate-900 font-mono mt-1">{analyticsData.totalClaims}</p>
            </div>

            <div className="bg-white rounded-3xl border border-amber-200 p-4 shadow-sm bg-amber-50/20">
              <span className="text-[10px] uppercase font-bold tracking-wider text-amber-600 block">In Workshop (1-5 Days)</span>
              <p className="text-2xl font-black text-amber-700 font-mono mt-1">{analyticsData.activeCollected}</p>
            </div>

            <div className="bg-white rounded-3xl border border-emerald-200 p-4 shadow-sm bg-emerald-50/20">
              <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-600 block">Repaired & Fixed</span>
              <p className="text-2xl font-black text-emerald-700 font-mono mt-1">{analyticsData.repairedCount}</p>
            </div>

            <div className="bg-white rounded-3xl border border-blue-200 p-4 shadow-sm bg-blue-50/20">
              <span className="text-[10px] uppercase font-bold tracking-wider text-blue-600 block">Replaced with New</span>
              <p className="text-2xl font-black text-blue-700 font-mono mt-1">{analyticsData.replacedCount}</p>
            </div>

            <div className="bg-white rounded-3xl border border-rose-200 p-4 shadow-sm bg-rose-50/20">
              <span className="text-[10px] uppercase font-bold tracking-wider text-rose-600 block">Rejected (Customer Damage)</span>
              <p className="text-2xl font-black text-rose-700 font-mono mt-1">{analyticsData.rejectedCount}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Component Failures Breakdown */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Cpu className="h-5 w-5 text-cyan-600" />
                <span>Complaints Breakdown by Component</span>
              </h3>
              <p className="text-xs text-slate-500">
                Shows which specific part (Controller, Motor, Battery, Charger, Frame) has the highest complaint volume.
              </p>

              <div className="space-y-3 pt-2">
                {Object.entries(analyticsData.componentComplaints).map(([compName, rawCount]) => {
                  const count = Number(rawCount) || 0;
                  const compValues = Object.values(analyticsData.componentComplaints) as number[];
                  const maxVal = Math.max(1, ...compValues);
                  const percentage = Math.round((count / maxVal) * 100);

                  return (
                    <div key={compName} className="space-y-1">
                      <div className="flex justify-between text-xs font-bold text-slate-800">
                        <span>{compName}</span>
                        <span className="font-mono">{count} complaints</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                        <div 
                          className="bg-cyan-500 h-3 rounded-full transition-all duration-500" 
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Product Model Breakdown */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Package className="h-5 w-5 text-purple-600" />
                <span>Complaints Breakdown by Product Model</span>
              </h3>
              <p className="text-xs text-slate-500">
                Identify which scooter or product model generates the most warranty claims so you can alert suppliers.
              </p>

              <div className="space-y-3 pt-2">
                {Object.keys(analyticsData.modelComplaints).length === 0 ? (
                  <p className="text-xs text-slate-400">No warranty claims recorded yet.</p>
                ) : (
                  Object.entries(analyticsData.modelComplaints).map(([model, rawCount]) => {
                    const count = Number(rawCount) || 0;
                    const modelValues = Object.values(analyticsData.modelComplaints) as number[];
                    const maxVal = Math.max(1, ...modelValues);
                    const percentage = Math.round((count / maxVal) * 100);

                    return (
                      <div key={model} className="space-y-1">
                        <div className="flex justify-between text-xs font-bold text-slate-800">
                          <span>{model}</span>
                          <span className="font-mono">{count} claims</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                          <div 
                            className="bg-purple-500 h-3 rounded-full transition-all duration-500" 
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Supplier Origin & Product Batch History */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Factory className="h-5 w-5 text-emerald-600" />
                <span>Product Source Lineage & Manufacturer Warranty Matrix</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Monitor where defective units originated (Supplier, Container ID, Import Bill) and whether you can claim factory reimbursement.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Claim ID</th>
                    <th className="py-3 px-4">Model & Component</th>
                    <th className="py-3 px-4">Serial Number</th>
                    <th className="py-3 px-4">Supplier / Factory</th>
                    <th className="py-3 px-4">Container / Import Bill</th>
                    <th className="py-3 px-4">Manufacturer Warranty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {warrantyClaims.map(claim => {
                    const supp = checkSupplierWarranty(claim.originalSerialNo, claim.originalSaleType);

                    return (
                      <tr key={claim.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">{claim.id}</td>
                        <td className="py-3 px-4 font-bold text-slate-800">
                          {claim.modelName || claim.originalSaleType.toUpperCase()} ({claim.claimedComponent || 'General'})
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-700">{claim.originalSerialNo}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">{claim.supplierName || supp.supplier}</td>
                        <td className="py-3 px-4 text-slate-600 font-mono">
                          Cnt: {claim.containerId || supp.container} • Bill: {claim.sourceBillNo || supp.bill}
                        </td>
                        <td className="py-3 px-4 font-bold text-purple-700">
                          {claim.supplierWarrantyStatus || supp.status}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SPECIALIST INSPECTION MODAL */}
      {selectedClaim && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  Specialist Inspection & SLA Resolution
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1">
                  Complete Claim {selectedClaim.id}
                </h3>
              </div>
              <button
                onClick={() => setSelectedClaim(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-xs space-y-1">
              <p><strong>Customer:</strong> {selectedClaim.buyerName} ({selectedClaim.buyerContact || 'N/A'})</p>
              <p><strong>Component:</strong> <span className="uppercase font-bold text-slate-800">{selectedClaim.claimedComponent || selectedClaim.originalSaleType}</span> ({selectedClaim.originalSerialNo})</p>
              <p className="text-amber-900 font-medium"><strong>Customer Issue:</strong> "{selectedClaim.issueDescription}"</p>
            </div>

            <form onSubmit={handleCompleteSpecialistInspection} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-800">Inspection Outcome Decision *</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-cyan-500 font-sans cursor-pointer"
                >
                  <option value="repaired">✅ Fixed & Repaired (Problem genuine &amp; fixed — return to customer)</option>
                  <option value="exchanged">🔄 Replace with Brand New Product (Problem genuine, unfixable — issue new unit)</option>
                  <option value="rejected">❌ Reject Claim (Damaged by customer / misuse / void warranty)</option>
                </select>
              </div>

              {editStatus === 'exchanged' && (
                <div className="space-y-2 bg-blue-50/50 p-3.5 rounded-2xl border border-blue-100">
                  <label className="block text-xs font-bold text-blue-900">New Replacement Serial Number *</label>
                  <input
                    type="text"
                    value={editNewSerialNo}
                    onChange={(e) => setEditNewSerialNo(e.target.value)}
                    placeholder="Enter serial number of the brand new product given to customer"
                    className="w-full bg-white border border-blue-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 outline-none focus:border-blue-500"
                    required
                  />
                  {(selectedClaim.isBattery || selectedClaim.originalSaleType === 'battery') && (
                    <div className="space-y-1 pt-1">
                      <label className="block text-[11px] font-bold text-blue-800">Remaining Warranty Months for Replacement Battery:</label>
                      <input
                        type="number"
                        value={editReplacementWarrantyMonths}
                        onChange={(e) => setEditReplacementWarrantyMonths(e.target.value ? Number(e.target.value) : '')}
                        placeholder="e.g. 2"
                        className="w-full bg-white border border-blue-200 rounded-xl px-3 py-1.5 text-xs font-bold"
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-800">Specialist Technical Notes / What Happened *</label>
                <textarea
                  value={specialistNotes}
                  onChange={(e) => setSpecialistNotes(e.target.value)}
                  placeholder="Describe technician findings (e.g. Replaced faulty MOSFET on controller, or Replaced motor bearing, or Physical liquid ingress found - claim voided)..."
                  rows={3}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:border-cyan-500 font-sans resize-none"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedClaim(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl px-4 py-2 text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl px-5 py-2 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  {isUpdating ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />}
                  <span>Save Outcome & Close Claim</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
