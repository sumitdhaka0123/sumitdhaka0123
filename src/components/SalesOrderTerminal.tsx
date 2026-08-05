import React, { useState } from 'react';
import { ShoppingCart, Plus, Trash2, CheckCircle2, Clock, User, Phone, MapPin, Package, Shield, AlertCircle, ArrowRight, XCircle } from 'lucide-react';
import { User as UserType, Product, Buyer, SalesOrder, SalesOrderItem } from '../types';

interface SalesOrderTerminalProps {
  products?: Product[];
  buyers?: Buyer[];
  currentUser: UserType;
  salesOrders?: SalesOrder[];
  batterySeriesList?: string[];
  batteryTypes?: string[];
  chargerTypeList?: string[];
  chargerTypes?: string[];
  onRefresh: () => void;
}

export const SalesOrderTerminal: React.FC<SalesOrderTerminalProps> = ({
  products = [],
  buyers = [],
  currentUser,
  salesOrders = [],
  batterySeriesList,
  batteryTypes,
  chargerTypeList,
  chargerTypes,
  onRefresh
}) => {
  const batList = batteryTypes || batterySeriesList || [];
  const chgList = chargerTypes || chargerTypeList || [];

  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');
  const [selectedBuyerName, setSelectedBuyerName] = useState('');
  const [buyerContact, setBuyerContact] = useState('');
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [isNewBuyer, setIsNewBuyer] = useState(false);
  const [notes, setNotes] = useState('');

  // Draft items in the current order
  const [orderItems, setOrderItems] = useState<SalesOrderItem[]>([]);

  // Form states for adding items
  const [itemCategory, setItemCategory] = useState<'scooter' | 'battery' | 'charger'>('scooter');
  
  // Scooter item form
  const [selectedModel, setSelectedModel] = useState((products && products[0]?.name) || 'City XL');
  const initialProd = (products || []).find(p => p.name === selectedModel) || products[0];
  const [selectedColor, setSelectedColor] = useState(
    (initialProd && initialProd.colors && initialProd.colors[0]) || 'Matte Black'
  );
  const [scooterQty, setScooterQty] = useState(1);

  // Compute available colors for selected model
  const currentProduct = (products || []).find(p => p.name === selectedModel);
  const availableColors = (currentProduct && currentProduct.colors && currentProduct.colors.length > 0)
    ? currentProduct.colors
    : ['Matte Black', 'Pearl White', 'Metallic Red', 'Ocean Blue', 'Silver Grey', 'Yellow'];

  const handleModelChange = (modelName: string) => {
    setSelectedModel(modelName);
    const prod = (products || []).find(p => p.name === modelName);
    if (prod && prod.colors && prod.colors.length > 0) {
      setSelectedColor(prod.colors[0]);
    }
  };

  // Battery item form
  const [selectedBatteryType, setSelectedBatteryType] = useState((batList && batList[0]) || 'Lithium 60V, 28AH');
  const [batteryQty, setBatteryQty] = useState(1);
  const [batteryWarranty, setBatteryWarranty] = useState(true);
  const [batteryWarrantyMonths, setBatteryWarrantyMonths] = useState(12);

  // Charger item form
  const [selectedChargerType, setSelectedChargerType] = useState((chgList && chgList[0]) || 'Lithium Charger 60V/6A');
  const [chargerQty, setChargerQty] = useState(1);
  const [chargerWarranty, setChargerWarranty] = useState(true);
  const [chargerWarrantyMonths, setChargerWarrantyMonths] = useState(6);

  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);

  // Helper to handle buyer selection from existing buyers list
  const handleBuyerSelect = (name: string) => {
    if (name === '__new__') {
      setIsNewBuyer(true);
      setSelectedBuyerName('');
      setBuyerContact('');
      setDeliveryLocation('');
    } else {
      setIsNewBuyer(false);
      setSelectedBuyerName(name);
      const found = buyers.find(b => b.name === name);
      if (found) {
        setBuyerContact(found.contact || '');
        setDeliveryLocation(found.address || '');
      }
    }
  };

  // Add Item to Order Draft
  const handleAddItem = () => {
    if (itemCategory === 'scooter') {
      if (!selectedModel) return;
      const newItem: SalesOrderItem = {
        id: `draft-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        itemType: 'scooter',
        productName: selectedModel,
        color: selectedColor,
        quantity: Math.max(1, scooterQty)
      };
      setOrderItems([...orderItems, newItem]);
    } else if (itemCategory === 'battery') {
      if (!selectedBatteryType) return;
      const newItem: SalesOrderItem = {
        id: `draft-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        itemType: 'battery',
        batteryType: selectedBatteryType,
        quantity: Math.max(1, batteryQty),
        isUnderWarranty: batteryWarranty,
        warrantyMonths: batteryWarranty ? batteryWarrantyMonths : 0
      };
      setOrderItems([...orderItems, newItem]);
    } else if (itemCategory === 'charger') {
      if (!selectedChargerType) return;
      const newItem: SalesOrderItem = {
        id: `draft-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        itemType: 'charger',
        chargerType: selectedChargerType,
        quantity: Math.max(1, chargerQty),
        isUnderWarranty: chargerWarranty,
        warrantyMonths: chargerWarranty ? chargerWarrantyMonths : 0
      };
      setOrderItems([...orderItems, newItem]);
    }
  };

  const handleRemoveItem = (id: string) => {
    setOrderItems(orderItems.filter(it => it.id !== id));
  };

  // Submit Order to Dispatcher
  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBuyerName.trim()) {
      setStatusMessage({ type: 'error', text: 'Please enter or select a Customer / Buyer Name.' });
      return;
    }
    if (orderItems.length === 0) {
      setStatusMessage({ type: 'error', text: 'Please add at least one product item to the order.' });
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const baseUrl = (import.meta as any).env.VITE_API_BASE_URL || '';
      const res = await fetch(`${baseUrl}/api/sales-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyerName: selectedBuyerName.trim(),
          buyerContact: buyerContact.trim(),
          deliveryLocation: deliveryLocation.trim(),
          salespersonName: currentUser.name || currentUser.username,
          salespersonUsername: currentUser.username,
          items: orderItems,
          notes
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to place sales order');

      setStatusMessage({ type: 'success', text: data.message || 'Order placed successfully and forwarded to Dispatch Person!' });
      
      // Reset form
      setSelectedBuyerName('');
      setBuyerContact('');
      setDeliveryLocation('');
      setIsNewBuyer(false);
      setOrderItems([]);
      setNotes('');
      
      onRefresh();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Error placing sales order.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cancel Order Handler
  const handleCancelOrder = async (orderId: string, orderNo: string) => {
    if (!window.confirm(`Are you sure you want to cancel Sales Order #${orderNo}? This action cannot be undone.`)) {
      return;
    }

    setCancellingOrderId(orderId);
    setStatusMessage(null);

    try {
      const baseUrl = (import.meta as any).env.VITE_API_BASE_URL || '';
      const res = await fetch(`${baseUrl}/api/sales-orders/${orderId}/cancel`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operator: currentUser.name || currentUser.username,
          operatorUsername: currentUser.username,
          operatorRole: currentUser.role
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to cancel order');

      setStatusMessage({ type: 'success', text: `Order #${orderNo} has been cancelled successfully.` });
      onRefresh();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Error cancelling sales order.' });
    } finally {
      setCancellingOrderId(null);
    }
  };

  const myOrders = (salesOrders || []).filter(o => o.salespersonUsername === currentUser.username || currentUser.role === 'admin' || currentUser.role === 'manager');

  return (
    <div className="space-y-6">
      {/* Top Banner Navigation */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <ShoppingCart className="h-7 w-7 text-cyan-600" />
            <span>Place Order POS Terminal</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Feed customer details, truck delivery location, and product selection. Direct dispatch fulfillment for loading.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl self-start md:self-auto">
          <button
            onClick={() => setActiveTab('create')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'create'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ➕ Place New Order
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'history'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            📋 Orders History ({myOrders.length})
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className={`p-4 rounded-xl flex items-center gap-3 text-sm font-semibold ${
          statusMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          {statusMessage.type === 'success' ? <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" /> : <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {activeTab === 'create' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Form Side - Left 7 columns */}
          <div className="lg:col-span-7 bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200 space-y-6">
            <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <User className="h-5 w-5 text-cyan-600" />
              <span>Step 1: Customer & Delivery Details</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Select Customer</label>
                <select
                  onChange={(e) => handleBuyerSelect(e.target.value)}
                  value={isNewBuyer ? '__new__' : selectedBuyerName}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="">-- Choose Existing Customer --</option>
                  {buyers.map(b => (
                    <option key={b.id} value={b.name}>{b.name} ({b.contact || 'No Contact'})</option>
                  ))}
                  <option value="__new__">➕ + Add New Customer</option>
                </select>
              </div>

              {(isNewBuyer || buyers.length === 0) && (
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">New Customer Name *</label>
                  <input
                    type="text"
                    placeholder="Enter customer name..."
                    value={selectedBuyerName}
                    onChange={(e) => setSelectedBuyerName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Contact / Phone Number</label>
                <div className="relative">
                  <Phone className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="e.g. +91 9876543210"
                    value={buyerContact}
                    onChange={(e) => setBuyerContact(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Delivery Location (Where to send truck) *</label>
                <div className="relative">
                  <MapPin className="h-4 w-4 text-cyan-600 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="e.g. Plot 42, Transport Nagar, Jaipur / Destination Warehouse"
                    value={deliveryLocation}
                    onChange={(e) => setDeliveryLocation(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500 font-medium"
                  />
                </div>
              </div>
            </div>

            <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 pt-2 flex items-center gap-2">
              <Package className="h-5 w-5 text-cyan-600" />
              <span>Step 2: Select Scooter Models & Items</span>
            </h3>

            {/* Category Toggle */}
            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setItemCategory('scooter')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  itemCategory === 'scooter' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🛵 Scooter Model
              </button>
              <button
                type="button"
                onClick={() => setItemCategory('battery')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  itemCategory === 'battery' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🔋 Battery
              </button>
              <button
                type="button"
                onClick={() => setItemCategory('charger')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  itemCategory === 'charger' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ⚡ Charger
              </button>
            </div>

            {/* Subform based on category */}
            {itemCategory === 'scooter' && (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Scooter Model</label>
                    <select
                      value={selectedModel}
                      onChange={(e) => handleModelChange(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-semibold"
                    >
                      {products.map(p => (
                        <option key={p.id} value={p.name}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Color</label>
                    <select
                      value={selectedColor}
                      onChange={(e) => setSelectedColor(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-semibold"
                    >
                      {availableColors.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Quantity (2, 3, 5+)</label>
                    <input
                      type="number"
                      min="1"
                      value={scooterQty}
                      onChange={(e) => setScooterQty(parseInt(e.target.value) || 1)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-bold text-center"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddItem}
                  className="w-full bg-slate-900 text-white font-bold py-2 rounded-lg text-xs hover:bg-slate-800 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="h-4 w-4 text-emerald-400" />
                  <span>Add Scooter Line Item (Can add multiple models/colors)</span>
                </button>
              </div>
            )}

            {itemCategory === 'battery' && (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Battery Type</label>
                    <select
                      value={selectedBatteryType}
                      onChange={(e) => setSelectedBatteryType(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
                    >
                      {(batList || []).map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Quantity</label>
                    <input
                      type="number"
                      min="1"
                      value={batteryQty}
                      onChange={(e) => setBatteryQty(parseInt(e.target.value) || 1)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-bold text-center"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-cyan-600" />
                    <span className="text-xs font-semibold text-slate-700">Under Warranty?</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-1 text-xs text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={batteryWarranty}
                        onChange={(e) => setBatteryWarranty(e.target.checked)}
                        className="rounded text-cyan-600"
                      />
                      <span>Yes</span>
                    </label>
                    {batteryWarranty && (
                      <select
                        value={batteryWarrantyMonths}
                        onChange={(e) => setBatteryWarrantyMonths(parseInt(e.target.value))}
                        className="bg-slate-100 border border-slate-300 rounded px-2 py-0.5 text-xs"
                      >
                        <option value={6}>6 Months</option>
                        <option value={12}>12 Months</option>
                        <option value={24}>24 Months</option>
                        <option value={36}>36 Months</option>
                      </select>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddItem}
                  className="w-full bg-slate-900 text-white font-bold py-2 rounded-lg text-xs hover:bg-slate-800 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="h-4 w-4 text-emerald-400" />
                  <span>Add Battery to Order</span>
                </button>
              </div>
            )}

            {itemCategory === 'charger' && (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Charger Type</label>
                    <select
                      value={selectedChargerType}
                      onChange={(e) => setSelectedChargerType(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
                    >
                      {(chgList || []).map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Quantity</label>
                    <input
                      type="number"
                      min="1"
                      value={chargerQty}
                      onChange={(e) => setChargerQty(parseInt(e.target.value) || 1)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-bold text-center"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-cyan-600" />
                    <span className="text-xs font-semibold text-slate-700">Under Warranty?</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-1 text-xs text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={chargerWarranty}
                        onChange={(e) => setChargerWarranty(e.target.checked)}
                        className="rounded text-cyan-600"
                      />
                      <span>Yes</span>
                    </label>
                    {chargerWarranty && (
                      <select
                        value={chargerWarrantyMonths}
                        onChange={(e) => setChargerWarrantyMonths(parseInt(e.target.value))}
                        className="bg-slate-100 border border-slate-300 rounded px-2 py-0.5 text-xs"
                      >
                        <option value={3}>3 Months</option>
                        <option value={6}>6 Months</option>
                        <option value={12}>12 Months</option>
                      </select>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddItem}
                  className="w-full bg-slate-900 text-white font-bold py-2 rounded-lg text-xs hover:bg-slate-800 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="h-4 w-4 text-emerald-400" />
                  <span>Add Charger to Order</span>
                </button>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Special Order Notes (Optional)</label>
              <textarea
                rows={2}
                placeholder="e.g., Priority truck dispatch, specific customer instructions..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>

          {/* Right Summary Side - 5 columns */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-md space-y-4 border border-slate-800">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-cyan-400" />
                  <span>Order Summary Draft</span>
                </h3>
                <span className="text-xs bg-slate-800 text-slate-300 px-2.5 py-1 rounded-full font-bold">
                  {orderItems.reduce((acc, it) => acc + it.quantity, 0)} Total Units
                </span>
              </div>

              {/* Customer & Location Badge */}
              <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/50 space-y-1">
                <p className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider">Customer & Delivery</p>
                <p className="text-sm font-bold text-white">{selectedBuyerName || 'Unspecified Customer'}</p>
                {buyerContact && <p className="text-xs text-slate-300">📞 {buyerContact}</p>}
                {deliveryLocation && <p className="text-xs text-cyan-300 font-semibold flex items-center gap-1">📍 Delivery: {deliveryLocation}</p>}
              </div>

              {/* Items List */}
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {orderItems.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-6 text-center">
                    No items added to order draft yet. Select scooters, batteries or chargers on the left and click Add.
                  </p>
                ) : (
                  orderItems.map((item) => (
                    <div key={item.id} className="bg-slate-800 p-3 rounded-xl flex items-center justify-between gap-3 border border-slate-700">
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/50">
                          {item.itemType === 'scooter' ? '🛵 Scooter' : item.itemType === 'battery' ? '🔋 Battery' : '⚡ Charger'}
                        </span>
                        <p className="text-xs font-bold text-slate-100 mt-1">
                          {item.itemType === 'scooter' ? `${item.productName} (${item.color})` : item.itemType === 'battery' ? item.batteryType : item.chargerType}
                        </p>
                        {item.isUnderWarranty && (
                          <p className="text-[10px] text-emerald-400 font-semibold">
                            🛡️ Warranty: {item.warrantyMonths} Months
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs font-black text-white bg-slate-700 px-2.5 py-1 rounded-lg">
                          x{item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          className="text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Submit Button */}
              <button
                type="button"
                disabled={isSubmitting || orderItems.length === 0 || !selectedBuyerName.trim()}
                onClick={handleSubmitOrder}
                className={`w-full py-3.5 rounded-xl text-sm font-black tracking-wide uppercase shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all ${
                  isSubmitting || orderItems.length === 0 || !selectedBuyerName.trim()
                    ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                    : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:from-cyan-400 hover:to-blue-500 shadow-cyan-500/20'
                }`}
              >
                <span>{isSubmitting ? 'Placing Order...' : '🚀 Place Order & Send to Dispatch'}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* History Tab */
        <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200 space-y-4">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Clock className="h-5 w-5 text-cyan-600" />
            <span>Customer Sales Orders History</span>
          </h3>

          {myOrders.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">
              No sales orders placed yet. Switch to "Place New Order" tab to create your first customer order.
            </div>
          ) : (
            <div className="space-y-3">
              {myOrders.map(order => {
                const isOwner = currentUser.role === 'admin';
                const isCreator = Boolean(
                  order.salespersonUsername && 
                  currentUser?.username && 
                  order.salespersonUsername.toLowerCase() === currentUser.username.toLowerCase()
                );
                const canCancel = (isOwner || isCreator) && order.status !== 'cancelled';

                return (
                  <div key={order.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold bg-slate-900 text-white px-2 py-0.5 rounded">
                          {order.orderNo}
                        </span>
                        <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full ${
                          order.status === 'cancelled' ? 'bg-rose-100 text-rose-800' :
                          order.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                          order.status === 'prepared' ? 'bg-blue-100 text-blue-800' :
                          order.status === 'dispatched' ? 'bg-indigo-100 text-indigo-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {order.status === 'cancelled' ? '❌ Cancelled' :
                           order.status === 'pending' ? '⏳ Pending Dispatch' :
                           order.status === 'prepared' ? '📦 Order Prepared' :
                           order.status === 'dispatched' ? '🚚 Dispatched' : '✅ Challan Verified'}
                        </span>
                      </div>

                      <p className="text-sm font-bold text-slate-900">{order.buyerName} {order.buyerContact ? `(${order.buyerContact})` : ''}</p>
                      {order.deliveryLocation && (
                        <p className="text-xs text-cyan-700 font-semibold flex items-center gap-1">
                          📍 Delivery: {order.deliveryLocation}
                        </p>
                      )}
                      <p className="text-xs text-slate-500">
                        Placed by {order.salespersonName} on {new Date(order.createdTimestamp).toLocaleDateString()} at {new Date(order.createdTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      {order.status === 'cancelled' && (
                        <p className="text-xs text-rose-600 italic">
                          Cancelled by {order.cancelledBy || 'User'} at {order.cancelledTimestamp ? new Date(order.cancelledTimestamp).toLocaleString() : ''}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-xs space-y-1 max-w-md">
                        <p className="font-bold text-slate-700 border-b border-slate-100 pb-1">Items ({order.items.reduce((a, b) => a + b.quantity, 0)}):</p>
                        {order.items.map((it, i) => (
                          <p key={i} className="text-slate-600">
                            • {it.itemType === 'scooter' ? `${it.productName} (${it.color})` : it.itemType === 'battery' ? it.batteryType : it.chargerType} x{it.quantity}
                          </p>
                        ))}
                      </div>

                      {canCancel && (
                        <button
                          type="button"
                          disabled={cancellingOrderId === order.id}
                          onClick={() => handleCancelOrder(order.id, order.orderNo)}
                          className="p-2 text-rose-600 hover:text-white hover:bg-rose-600 bg-rose-50 border border-rose-200 rounded-xl transition-all cursor-pointer flex flex-col items-center gap-1 text-[10px] font-bold shrink-0"
                          title="Cancel Order"
                        >
                          <XCircle className="h-5 w-5" />
                          <span>Cancel</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
