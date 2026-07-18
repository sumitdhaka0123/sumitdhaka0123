import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, Tag, Truck, UserCheck, Trash2, ListFilter, HelpCircle, 
  Edit2, Battery, Zap, Check, X, AlertCircle 
} from 'lucide-react';
import { Product, Buyer } from '../types';

interface CatalogManagerProps {
  products: Product[];
  buyers: Buyer[];
  onRefresh: () => void;
  onAddProduct: (name: string, colors: string[]) => Promise<boolean>;
  onBulkSeedProducts?: (mode: 'replace' | 'append') => Promise<boolean>;
  onAddBuyer: (name: string, contact?: string) => Promise<boolean>;
  onUpdateProduct?: (id: string, name: string, colors: string[]) => Promise<boolean>;
  onUpdateBuyer?: (id: string, name: string, contact?: string) => Promise<boolean>;
  onDeleteProduct?: (id: string) => Promise<boolean>;
  onDeleteBuyer?: (id: string) => Promise<boolean>;
  batterySeriesList?: string[];
  chargerTypeList?: string[];
  onUpdateBatteryTypes?: (list: string[]) => Promise<boolean>;
  onUpdateChargerTypes?: (list: string[]) => Promise<boolean>;
}

export default function CatalogManager({ 
  products, 
  buyers, 
  onRefresh, 
  onAddProduct, 
  onBulkSeedProducts,
  onAddBuyer,
  onUpdateProduct,
  onUpdateBuyer,
  onDeleteProduct,
  onDeleteBuyer,
  batterySeriesList = [],
  chargerTypeList = [],
  onUpdateBatteryTypes,
  onUpdateChargerTypes
}: CatalogManagerProps) {
  // New Product Model State
  const [newModelName, setNewModelName] = useState('');
  const [newColorsRaw, setNewColorsRaw] = useState('');
  const [prodError, setProdError] = useState('');
  const [prodSuccess, setProdSuccess] = useState('');
  const [prodLoading, setProdLoading] = useState(false);
  const [seedingLoading, setSeedingLoading] = useState(false);

  // New Buyer State
  const [buyerName, setBuyerName] = useState('');
  const [buyerContact, setBuyerContact] = useState('');
  const [buyerError, setBuyerError] = useState('');
  const [buyerSuccess, setBuyerSuccess] = useState('');
  const [buyerLoading, setBuyerLoading] = useState(false);

  // Editing Product Modal States
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editModelName, setEditModelName] = useState('');
  const [editColorsRaw, setEditColorsRaw] = useState('');
  const [editProdError, setEditProdError] = useState('');
  const [editProdLoading, setEditProdLoading] = useState(false);

  // Editing Buyer Modal States
  const [editingBuyer, setEditingBuyer] = useState<Buyer | null>(null);
  const [editBuyerName, setEditBuyerName] = useState('');
  const [editBuyerContact, setEditBuyerContact] = useState('');
  const [editBuyerError, setEditBuyerError] = useState('');
  const [editBuyerLoading, setEditBuyerLoading] = useState(false);

  // Inline Editing for Battery Series
  const [editingBatteryIdx, setEditingBatteryIdx] = useState<number | null>(null);
  const [editBatteryText, setEditBatteryText] = useState('');
  const [newBatteryText, setNewBatteryText] = useState('');

  // Inline Editing for Charger Types
  const [editingChargerIdx, setEditingChargerIdx] = useState<number | null>(null);
  const [editChargerText, setEditChargerText] = useState('');
  const [newChargerText, setNewChargerText] = useState('');

  // Custom confirm & alert modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
  } | null>(null);

  const askConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm
    });
  };

  const handleCreateBatterySeries = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newBatteryText.trim();
    if (!cleaned || !onUpdateBatteryTypes) return;
    if (batterySeriesList.some(b => b.toLowerCase() === cleaned.toLowerCase())) {
      return;
    }
    const newList = [...batterySeriesList, cleaned];
    const ok = await onUpdateBatteryTypes(newList);
    if (ok) {
      setNewBatteryText('');
      onRefresh();
    }
  };

  const handleCreateChargerType = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newChargerText.trim();
    if (!cleaned || !onUpdateChargerTypes) return;
    if (chargerTypeList.some(c => c.toLowerCase() === cleaned.toLowerCase())) {
      return;
    }
    const newList = [...chargerTypeList, cleaned];
    const ok = await onUpdateChargerTypes(newList);
    if (ok) {
      setNewChargerText('');
      onRefresh();
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setProdError('');
    setProdSuccess('');
    
    if (!newModelName.trim()) {
      setProdError('Model name is required');
      return;
    }

    const colors = newColorsRaw
      .split(',')
      .map(c => c.trim())
      .filter(Boolean);

    if (colors.length < 1) {
      setProdError('At least one color option is required!');
      return;
    }

    setProdLoading(true);
    const ok = await onAddProduct(newModelName.trim(), colors);
    if (ok) {
      setProdSuccess(`Product ${newModelName} with ${colors.length} colors created successfully!`);
      setNewModelName('');
      setNewColorsRaw('');
      onRefresh();
    } else {
      setProdError('Model name already exists or is invalid.');
    }
    setProdLoading(false);
  };

  const handleBulkSeedClick = async (mode: 'replace' | 'append') => {
    if (!onBulkSeedProducts) return;
    setProdError('');
    setProdSuccess('');
    
    const confirmMessage = mode === 'replace'
      ? 'This will clear out the default template models (Volt S-1, etc.) and replace them with the 43 official Senzo models from your spreadsheet. Are you sure?'
      : 'This will add the 43 official Senzo models from your spreadsheet alongside your existing models. Are you sure?';

    askConfirm(
      'Import Official Senzo Catalog',
      confirmMessage,
      async () => {
        setSeedingLoading(true);
        const ok = await onBulkSeedProducts(mode);
        if (ok) {
          setProdSuccess(`Successfully imported the 43 official Senzo models from the spreadsheet!`);
          onRefresh();
        } else {
          setProdError('Failed to import the Senzo catalog. Please try again.');
        }
        setSeedingLoading(false);
      }
    );
  };

  const handleCreateBuyer = async (e: React.FormEvent) => {
    e.preventDefault();
    setBuyerError('');
    setBuyerSuccess('');

    if (!buyerName.trim()) {
      setBuyerError('Buyer name is required');
      return;
    }

    setBuyerLoading(true);
    const ok = await onAddBuyer(buyerName.trim(), buyerContact.trim() || undefined);
    if (ok) {
      setBuyerSuccess(`Buyer ${buyerName} successfully registered!`);
      setBuyerName('');
      setBuyerContact('');
      onRefresh();
    } else {
      setBuyerError('Buyer already exists or registration failed.');
    }
    setBuyerLoading(false);
  };

  const handleOpenEditProduct = (p: Product) => {
    setEditingProduct(p);
    setEditModelName(p.name);
    setEditColorsRaw(p.colors.join(', '));
    setEditProdError('');
  };

  const handleSaveProductEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct || !onUpdateProduct) return;
    setEditProdError('');

    if (!editModelName.trim()) {
      setEditProdError('Model name is required');
      return;
    }

    const colors = editColorsRaw
      .split(',')
      .map(c => c.trim())
      .filter(Boolean);

    if (colors.length < 1) {
      setEditProdError('At least one color option is required');
      return;
    }

    setEditProdLoading(true);
    const ok = await onUpdateProduct(editingProduct.id, editModelName.trim(), colors);
    if (ok) {
      setEditingProduct(null);
      onRefresh();
    } else {
      setEditProdError('Failed to update product. Duplicate name or server error.');
    }
    setEditProdLoading(false);
  };

  const handleOpenEditBuyer = (b: Buyer) => {
    setEditingBuyer(b);
    setEditBuyerName(b.name);
    setEditBuyerContact(b.contact || '');
    setEditBuyerError('');
  };

  const handleSaveBuyerEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBuyer || !onUpdateBuyer) return;
    setEditBuyerError('');

    if (!editBuyerName.trim()) {
      setEditBuyerError('Buyer name is required');
      return;
    }

    setEditBuyerLoading(true);
    const ok = await onUpdateBuyer(editingBuyer.id, editBuyerName.trim(), editBuyerContact.trim() || undefined);
    if (ok) {
      setEditingBuyer(null);
      onRefresh();
    } else {
      setEditBuyerError('Failed to update buyer. Duplicate name or server error.');
    }
    setEditBuyerLoading(false);
  };

  const handleStartEditBattery = (idx: number, currentText: string) => {
    setEditingBatteryIdx(idx);
    setEditBatteryText(currentText);
  };

  const handleSaveBatteryEdit = async (idx: number) => {
    const cleaned = editBatteryText.trim();
    if (!cleaned || !onUpdateBatteryTypes) return;
    const newList = [...batterySeriesList];
    newList[idx] = cleaned;
    const ok = await onUpdateBatteryTypes(newList);
    if (ok) {
      setEditingBatteryIdx(null);
      onRefresh();
    }
  };

  const handleStartEditCharger = (idx: number, currentText: string) => {
    setEditingChargerIdx(idx);
    setEditChargerText(currentText);
  };

  const handleSaveChargerEdit = async (idx: number) => {
    const cleaned = editChargerText.trim();
    if (!cleaned || !onUpdateChargerTypes) return;
    const newList = [...chargerTypeList];
    newList[idx] = cleaned;
    const ok = await onUpdateChargerTypes(newList);
    if (ok) {
      setEditingChargerIdx(null);
      onRefresh();
    }
  };

  const handleDeleteProductAction = (id: string, name: string) => {
    if (!onDeleteProduct) return;
    askConfirm(
      'Delete Product Model',
      `Are you absolutely sure you want to delete the product model "${name}" from the catalog? This will delete the blueprint.`,
      async () => {
        const ok = await onDeleteProduct(id);
        if (ok) {
          onRefresh();
        } else {
          setAlertModal({
            isOpen: true,
            title: 'Action Failed',
            message: 'Failed to delete product model. It may have registered units in the warehouse.'
          });
        }
      }
    );
  };

  const handleDeleteBuyerAction = (id: string, name: string) => {
    if (!onDeleteBuyer) return;
    askConfirm(
      'Delete Buyer Profile',
      `Are you absolutely sure you want to delete the buyer "${name}"? This action cannot be undone.`,
      async () => {
        const ok = await onDeleteBuyer(id);
        if (ok) {
          onRefresh();
        } else {
          setAlertModal({
            isOpen: true,
            title: 'Action Failed',
            message: 'Failed to delete buyer profile.'
          });
        }
      }
    );
  };

  const handleDeleteBatterySeries = (idx: number) => {
    const targetName = batterySeriesList[idx];
    askConfirm(
      'Delete Battery Catalog Model',
      `Are you sure you want to delete "${targetName}" from the battery catalog?`,
      async () => {
        if (!onUpdateBatteryTypes) return;
        const newList = batterySeriesList.filter((_, i) => i !== idx);
        const ok = await onUpdateBatteryTypes(newList);
        if (ok) {
          onRefresh();
        }
      }
    );
  };

  const handleDeleteChargerType = (idx: number) => {
    const targetName = chargerTypeList[idx];
    askConfirm(
      'Delete Charger Catalog Model',
      `Are you sure you want to delete "${targetName}" from the charger catalog?`,
      async () => {
        if (!onUpdateChargerTypes) return;
        const newList = chargerTypeList.filter((_, i) => i !== idx);
        const ok = await onUpdateChargerTypes(newList);
        if (ok) {
          onRefresh();
        }
      }
    );
  };

  return (
    <div className="space-y-8" id="catalog-workspace">
      
      {/* 1. Products and Buyers Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Scooty Models Management Column */}
        <div className="space-y-6" id="product-models-panel">

          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm" id="add-product-card">
            <div className="flex items-center gap-2 mb-4">
              <Tag className="h-5 w-5 text-cyan-500" />
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700 font-sans">
                Add New Scooter Model
              </h3>
            </div>

            {prodError && (
              <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 text-rose-600 text-xs font-sans font-medium rounded-2xl">
                {prodError}
              </div>
            )}
            {prodSuccess && (
              <div className="mb-4 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-600 text-xs font-sans font-medium rounded-2xl">
                {prodSuccess}
              </div>
            )}

            <form onSubmit={handleCreateProduct} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 font-sans">
                  Model Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Volt S-250"
                  value={newModelName}
                  onChange={(e) => setNewModelName(e.target.value)}
                  className="w-full bg-white border border-slate-200 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10 rounded-2xl py-3 px-4 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all font-sans"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide font-sans">
                    Color Options (Comma-separated)
                  </label>
                </div>
                <textarea
                  placeholder="e.g. Matte Red, Electric Blue"
                  value={newColorsRaw}
                  onChange={(e) => setNewColorsRaw(e.target.value)}
                  rows={3}
                  className="w-full bg-white border border-slate-200 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10 rounded-2xl py-3 px-4 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all font-sans"
                  required
                />
                <span className="block text-[10px] text-slate-400 mt-1">
                  Register with any number of color variants (1 to 15+). Separate colors with commas.
                </span>
              </div>

              <button
                type="submit"
                disabled={prodLoading}
                className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl text-xs transition-all flex items-center justify-center gap-1 cursor-pointer shadow-sm"
              >
                <Plus className="h-4.5 w-4.5" />
                <span>Create Model Blueprint</span>
              </button>
            </form>
          </div>

          {/* Current Catalog Registry */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm" id="model-catalog-registry-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700 font-sans">
                Model Catalog Registry
              </h3>
              <span className="text-[10px] text-slate-400 font-sans font-semibold">Click model to edit</span>
            </div>

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1" id="models-list">
              {products.map((p, idx) => (
                <div 
                  key={p.id || `catalog-prod-${idx}`} 
                  onClick={() => handleOpenEditProduct(p)}
                  className="p-4 bg-slate-50 hover:bg-slate-100/70 border border-slate-100 hover:border-slate-300 rounded-2xl text-xs cursor-pointer transition-all group relative" 
                  id={`registered-model-${p.id}`}
                  title="Click to edit model"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-bold text-slate-800 text-sm group-hover:text-cyan-600 transition-colors flex items-center gap-2">
                      {p.name}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteProductAction(p.id, p.name);
                        }}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                        title="Delete product model"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      <Edit2 className="h-3.5 w-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {p.colors.map((c, idx) => (
                      <span 
                        key={idx} 
                        className="text-[10px] font-sans font-bold px-2.5 py-0.5 rounded-full border border-slate-200 text-slate-700 bg-white"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 2. Buyers Management Column */}
        <div className="space-y-6" id="buyers-panel">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm" id="add-buyer-card">
            <div className="flex items-center gap-2 mb-4">
              <Truck className="h-5 w-5 text-emerald-500" />
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700 font-sans">
                Register New Buyer / Agency
              </h3>
            </div>

            {buyerError && (
              <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 text-rose-600 text-xs font-sans font-medium rounded-2xl">
                {buyerError}
              </div>
            )}
            {buyerSuccess && (
              <div className="mb-4 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-600 text-xs font-sans font-medium rounded-2xl">
                {buyerSuccess}
              </div>
            )}

            <form onSubmit={handleCreateBuyer} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 font-sans">
                  Buyer / Outlet Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Apex Scooters Ltd"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  className="w-full bg-white border border-slate-200 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10 rounded-2xl py-3 px-4 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all font-sans"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 font-sans">
                  Contact details (Email / Phone)
                </label>
                <input
                  type="text"
                  placeholder="e.g. contact@apexscooters.com"
                  value={buyerContact}
                  onChange={(e) => setBuyerContact(e.target.value)}
                  className="w-full bg-white border border-slate-200 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10 rounded-2xl py-3 px-4 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all font-sans"
                />
              </div>

              <button
                type="submit"
                disabled={buyerLoading}
                className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl text-xs transition-all flex items-center justify-center gap-1 cursor-pointer shadow-sm"
              >
                <Plus className="h-4.5 w-4.5" />
                <span>Register Buyer Profile</span>
              </button>
            </form>
          </div>

          {/* Registered Buyers Registry */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm" id="buyers-registry-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700 font-sans">
                Registered Agency Contacts
              </h3>
              <span className="text-[10px] text-slate-400 font-sans font-semibold">Click buyer to edit</span>
            </div>

            <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1" id="buyers-list">
              {buyers.map((b, idx) => (
                <div 
                  key={b.id || `catalog-buyer-${idx}`} 
                  onClick={() => handleOpenEditBuyer(b)}
                  className="p-3 bg-slate-50 hover:bg-slate-100/70 border border-slate-100 hover:border-slate-300 rounded-2xl text-xs flex justify-between items-center transition-all cursor-pointer group"
                  id={`registered-buyer-${b.id}`}
                  title="Click to edit buyer"
                >
                  <div>
                    <div className="font-bold text-slate-800 font-sans text-sm group-hover:text-emerald-600 transition-colors flex items-center gap-2">
                      {b.name}
                    </div>
                    {b.contact && <div className="text-[10px] text-slate-500 font-sans mt-0.5">{b.contact}</div>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteBuyerAction(b.id, b.name);
                      }}
                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                      title="Delete buyer profile"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <Edit2 className="h-3.5 w-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <UserCheck className="h-4 w-4 text-emerald-500 group-hover:hidden" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Battery and Charger Editing Sections (Added as catalog registries here) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 border-t border-slate-200 pt-8" id="battery-charger-panel">
        
        {/* Battery Series Catalog */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm" id="battery-catalog-card">
          <div className="flex items-center gap-2 mb-4">
            <Battery className="h-5 w-5 text-emerald-500" />
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700 font-sans">
              🔋 Battery Series Options Catalog
            </h3>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            These represent the different battery variants used in standalone ledgers and warranty configurations. Click on any item to rename it.
          </p>

          {/* Quick Add Battery Series Form */}
          <form onSubmit={handleCreateBatterySeries} className="mb-4 flex gap-2">
            <input 
              type="text" 
              placeholder="Add battery series name (e.g. Gamma)" 
              value={newBatteryText}
              onChange={(e) => setNewBatteryText(e.target.value)}
              className="flex-1 bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-xl py-2 px-3 text-xs outline-none font-sans"
              required
            />
            <button 
              type="submit" 
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add</span>
            </button>
          </form>

          <div className="space-y-2.5 max-h-[250px] overflow-y-auto pr-1">
            {batterySeriesList.map((bat, idx) => (
              <div 
                key={idx} 
                className="p-3 bg-slate-50 border border-slate-100 hover:border-slate-300 rounded-2xl flex items-center justify-between text-xs font-sans transition-all"
              >
                {editingBatteryIdx === idx ? (
                  <div className="flex items-center gap-2 w-full">
                    <input 
                      type="text" 
                      value={editBatteryText}
                      onChange={(e) => setEditBatteryText(e.target.value)}
                      className="flex-1 bg-white border border-slate-200 rounded-xl p-2 text-xs outline-none focus:border-emerald-500 font-sans font-bold"
                    />
                    <button 
                      onClick={() => handleSaveBatteryEdit(idx)}
                      className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg cursor-pointer"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button 
                      onClick={() => setEditingBatteryIdx(null)}
                      className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-lg cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between w-full">
                    <span className="font-bold text-slate-700">{bat}</span>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => handleStartEditBattery(idx, bat)}
                        className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors cursor-pointer"
                        title="Rename series"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button 
                        onClick={() => handleDeleteBatterySeries(idx)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Delete series"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Charger Types Catalog */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm" id="charger-catalog-card">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="h-5 w-5 text-red-500" />
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700 font-sans">
              🔌 Charger Types Catalog
            </h3>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            These represent the different charger models available in standalone ledgers and stock imports. Click on any item to rename it.
          </p>

          {/* Quick Add Charger Type Form */}
          <form onSubmit={handleCreateChargerType} className="mb-4 flex gap-2">
            <input 
              type="text" 
              placeholder="Add charger type name (e.g. 84V Charger)" 
              value={newChargerText}
              onChange={(e) => setNewChargerText(e.target.value)}
              className="flex-1 bg-slate-50 border border-slate-200 focus:border-red-500 rounded-xl py-2 px-3 text-xs outline-none font-sans"
              required
            />
            <button 
              type="submit" 
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add</span>
            </button>
          </form>

          <div className="space-y-2.5 max-h-[250px] overflow-y-auto pr-1">
            {chargerTypeList.map((chg, idx) => (
              <div 
                key={idx} 
                className="p-3 bg-slate-50 border border-slate-100 hover:border-slate-300 rounded-2xl flex items-center justify-between text-xs font-sans transition-all"
              >
                {editingChargerIdx === idx ? (
                  <div className="flex items-center gap-2 w-full">
                    <input 
                      type="text" 
                      value={editChargerText}
                      onChange={(e) => setEditChargerText(e.target.value)}
                      className="flex-1 bg-white border border-slate-200 rounded-xl p-2 text-xs outline-none focus:border-red-500 font-sans font-bold"
                    />
                    <button 
                      onClick={() => handleSaveChargerEdit(idx)}
                      className="p-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg cursor-pointer"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button 
                      onClick={() => setEditingChargerIdx(null)}
                      className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-lg cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between w-full">
                    <span className="font-bold text-slate-700">{chg}</span>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => handleStartEditCharger(idx, chg)}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                        title="Rename type"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button 
                        onClick={() => handleDeleteChargerType(idx)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Delete charger model"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* MODAL: EDIT PRODUCT MODEL */}
      <AnimatePresence>
        {editingProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-md w-full border border-slate-200 overflow-hidden shadow-xl"
            >
              <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Tag className="h-5 w-5 text-cyan-600" />
                  <h3 className="font-bold text-slate-800 font-sans">Edit Scooter Model Blueprint</h3>
                </div>
                <button 
                  onClick={() => setEditingProduct(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSaveProductEdit} className="p-6 space-y-4">
                {editProdError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 text-xs font-sans rounded-2xl">
                    {editProdError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 font-sans">
                    Model Name
                  </label>
                  <input
                    type="text"
                    value={editModelName}
                    onChange={(e) => setEditModelName(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-2xl py-2.5 px-4 text-sm text-slate-800 outline-none focus:border-cyan-500 font-sans"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 font-sans">
                    Color Options (Comma-separated)
                  </label>
                  <textarea
                    value={editColorsRaw}
                    onChange={(e) => setEditColorsRaw(e.target.value)}
                    rows={4}
                    className="w-full bg-white border border-slate-200 rounded-2xl py-2.5 px-4 text-sm text-slate-800 outline-none focus:border-cyan-500 font-sans"
                    required
                  />
                  <span className="block text-[10px] text-slate-400 mt-1">
                    Separate color options with commas. Changes apply dynamically.
                  </span>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingProduct(null)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={editProdLoading}
                    className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-all cursor-pointer"
                  >
                    {editProdLoading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: EDIT BUYER */}
      <AnimatePresence>
        {editingBuyer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-md w-full border border-slate-200 overflow-hidden shadow-xl"
            >
              <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Truck className="h-5 w-5 text-emerald-600" />
                  <h3 className="font-bold text-slate-800 font-sans">Edit Buyer Profile</h3>
                </div>
                <button 
                  onClick={() => setEditingBuyer(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSaveBuyerEdit} className="p-6 space-y-4">
                {editBuyerError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 text-xs font-sans rounded-2xl">
                    {editBuyerError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 font-sans">
                    Buyer / Outlet Name
                  </label>
                  <input
                    type="text"
                    value={editBuyerName}
                    onChange={(e) => setEditBuyerName(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-2xl py-2.5 px-4 text-sm text-slate-800 outline-none focus:border-emerald-500 font-sans"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 font-sans">
                    Contact details (Email / Phone)
                  </label>
                  <input
                    type="text"
                    value={editBuyerContact}
                    onChange={(e) => setEditBuyerContact(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-2xl py-2.5 px-4 text-sm text-slate-800 outline-none focus:border-emerald-500 font-sans"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingBuyer(null)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={editBuyerLoading}
                    className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-all cursor-pointer"
                  >
                    {editBuyerLoading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* Custom Confirmation Modal */}
        {confirmModal && confirmModal.isOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-slate-200 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 text-slate-800"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 bg-amber-50 rounded-xl text-amber-600 shrink-0">
                  <HelpCircle className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                    {confirmModal.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                    {confirmModal.message}
                  </p>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmModal(null)}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    confirmModal.onConfirm();
                    setConfirmModal(null);
                  }}
                  className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Confirm Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Custom Alert Modal */}
        {alertModal && alertModal.isOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-slate-200 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 text-slate-800"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 bg-rose-50 rounded-xl text-rose-600 shrink-0">
                  <AlertCircle className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                    {alertModal.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                    {alertModal.message}
                  </p>
                </div>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setAlertModal(null)}
                  className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
