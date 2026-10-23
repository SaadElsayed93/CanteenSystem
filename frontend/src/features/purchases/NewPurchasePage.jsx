import toast from 'react-hot-toast';
import React, { useState, useEffect, useRef } from 'react';
import client from '../../api/client';
import { useNavigate } from 'react-router-dom';
import { 
  Barcode, PlusCircle, Edit3, Trash2, CheckCircle2, 
  X, AlertTriangle, Package, ShoppingCart, ArrowLeft,
  Sparkles, Layers, ShieldCheck
} from 'lucide-react';

const NewPurchasePage = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  // Main Invoice State
  const [form, setForm] = useState({ supplierId: '', referenceNo: '' });
  const [paidAmount, setPaidAmount] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [items, setItems] = useState([]);
  
  // Barcode quick scan state
  const [barcodeInput, setBarcodeInput] = useState('');
  const barcodeRef = useRef(null);

  // Manual Item selection state
  const [currentItem, setCurrentItem] = useState({ 
    productId: '', 
    buyInPackage: false, 
    quantity: '', 
    unitCost: '', 
    expiryDate: ''
  });
  const [selectedProductInfo, setSelectedProductInfo] = useState(null);

  // Quick Create Product Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  const [newProductForm, setNewProductForm] = useState({
    name: '',
    barcode: '',
    internalCode: '',
    purchasePrice: '',
    sellingPrice: '',
    unit: 'قطعة',
    packageUnit: '',
    piecesPerPackage: 1,
    alertThreshold: 10,
    expiryDate: ''
  });

  // Inline Edit Product Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isUpdatingProduct, setIsUpdatingProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [suppRes, prodRes, posRes] = await Promise.all([
        client.get('/purchases/suppliers'),
        client.get('/products'),
        client.get('/sales/pos-data')
      ]);
      setSuppliers(suppRes.data.data.filter(s => s.isActive));
      setProducts(prodRes.data.data.filter(p => p.isActive));
      
      const methods = posRes.data.data.paymentMethods;
      setPaymentMethods(methods);
      
      // Auto-select Drawer as the default payment method
      const drawer = methods.find(m => m.name.includes('درج') || m.name.includes('نقدي')) || methods[0];
      if (drawer) {
        setPaymentMethodId(drawer.id);
      }
    } catch (err) {
      toast.error('فشل في جلب البيانات الأولية');
    } finally {
      setLoading(false);
    }
  };

  // ================= Barcode Scanner Handler =================
  const handleBarcodeSubmit = (e) => {
    if (e) e.preventDefault();
    const query = barcodeInput.trim();
    if (!query) return;

    // Search in existing products by barcode or internal code
    const found = products.find(p => p.barcode === query || p.internalCode === query);

    if (found) {
      // Product exists -> Add or Increment
      addItemDirectly(found, 1);
      toast.success(`تمت إضافة (${found.name}) للفاتورة`);
      setBarcodeInput('');
    } else {
      // Product does NOT exist -> Open Quick Create Modal
      const autoCode = `PROD-${Date.now().toString().slice(-5)}`;
      setNewProductForm({
        name: '',
        barcode: query,
        internalCode: autoCode,
        purchasePrice: '',
        sellingPrice: '',
        unit: 'قطعة',
        packageUnit: '',
        piecesPerPackage: 1,
        alertThreshold: 10,
        expiryDate: ''
      });
      setIsCreateModalOpen(true);
      toast('صنف جديد غير مسجل! يمكنك حفظه الآن وسينضاف للفاتورة فوراً', { icon: '✨' });
    }
  };

  // Add a product directly to the items table
  const addItemDirectly = (prod, qtyToAdd = 1, costOverride = null, expiryOverride = null) => {
    const existingIndex = items.findIndex(it => it.productId === prod.id && !it.isPackage);
    const unitCost = costOverride !== null ? Number(costOverride) : Number(prod.purchasePrice);
    const initialExpiry = expiryOverride !== null 
      ? expiryOverride 
      : (prod.expiryDate ? prod.expiryDate.split('T')[0] : '');

    if (existingIndex > -1) {
      // Increment quantity
      const updated = [...items];
      const newQty = Number(updated[existingIndex].displayQty) + Number(qtyToAdd);
      updated[existingIndex].displayQty = newQty;
      updated[existingIndex].baseQuantity = newQty;
      updated[existingIndex].subtotal = newQty * Number(updated[existingIndex].displayCost);
      if (initialExpiry && !updated[existingIndex].expiryDate) {
        updated[existingIndex].expiryDate = initialExpiry;
      }
      setItems(updated);
    } else {
      // Add new row
      setItems(prev => [...prev, {
        productId: prod.id,
        productName: prod.name,
        displayQty: qtyToAdd,
        isPackage: false,
        displayUnit: prod.unit || 'قطعة',
        displayCost: unitCost,
        baseQuantity: qtyToAdd,
        baseUnitCost: unitCost,
        subtotal: qtyToAdd * unitCost,
        expiryDate: initialExpiry,
        isExpired: prod.isExpired,
        isExpiringSoon: prod.isExpiringSoon
      }]);
    }
  };

  // Quick Create Product Submit
  const handleCreateProductSubmit = async (e) => {
    e.preventDefault();
    if (isCreatingProduct) return;

    if (!newProductForm.name || !newProductForm.purchasePrice || !newProductForm.sellingPrice) {
      return toast.error('يرجى ملء جميع الحقول الإلزامية للصنف');
    }

    setIsCreatingProduct(true);
    try {
      const res = await client.post('/products', {
        ...newProductForm,
        purchasePrice: Number(newProductForm.purchasePrice),
        sellingPrice: Number(newProductForm.sellingPrice),
        alertThreshold: Number(newProductForm.alertThreshold || 0),
        piecesPerPackage: newProductForm.packageUnit ? Number(newProductForm.piecesPerPackage || 1) : 1,
        expiryDate: newProductForm.expiryDate || null
      });

      const created = res.data.data;
      setProducts(prev => [...prev, created]);
      
      // Auto add to invoice items
      addItemDirectly(created, 1, created.purchasePrice);
      
      setIsCreateModalOpen(false);
      setBarcodeInput('');
      toast.success(`تم إنشاء الصنف (${created.name}) وإضافته للفاتورة`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'فشل إنشاء الصنف الجديد');
    } finally {
      setIsCreatingProduct(false);
    }
  };

  // Inline Edit Product Trigger
  const handleOpenEditProduct = (prodId) => {
    const prod = products.find(p => p.id === prodId);
    if (!prod) return;
    setEditingProduct({
      id: prod.id,
      name: prod.name,
      barcode: prod.barcode || '',
      internalCode: prod.internalCode || '',
      purchasePrice: prod.purchasePrice,
      sellingPrice: prod.sellingPrice,
      unit: prod.unit || 'قطعة',
      packageUnit: prod.packageUnit || '',
      piecesPerPackage: prod.piecesPerPackage || 1,
      alertThreshold: prod.alertThreshold || 0,
      expiryDate: prod.expiryDate ? prod.expiryDate.split('T')[0] : ''
    });
    setIsEditModalOpen(true);
  };

  // Inline Edit Product Submit
  const handleEditProductSubmit = async (e) => {
    e.preventDefault();
    if (isUpdatingProduct || !editingProduct) return;

    setIsUpdatingProduct(true);
    try {
      const res = await client.put(`/products/${editingProduct.id}`, {
        ...editingProduct,
        purchasePrice: Number(editingProduct.purchasePrice),
        sellingPrice: Number(editingProduct.sellingPrice),
        alertThreshold: Number(editingProduct.alertThreshold || 0),
        piecesPerPackage: editingProduct.packageUnit ? Number(editingProduct.piecesPerPackage || 1) : 1,
        expiryDate: editingProduct.expiryDate || null
      });

      const updated = res.data.data;
      
      // Update in products state
      setProducts(prev => prev.map(p => p.id === updated.id ? updated : p));
      
      // Update in current invoice items if present
      setItems(prev => prev.map(item => {
        if (item.productId === updated.id) {
          const newCost = Number(updated.purchasePrice);
          return {
            ...item,
            productName: updated.name,
            displayCost: item.isPackage ? (newCost * (updated.piecesPerPackage || 1)) : newCost,
            baseUnitCost: newCost,
            subtotal: Number(item.displayQty) * (item.isPackage ? (newCost * (updated.piecesPerPackage || 1)) : newCost)
          };
        }
        return item;
      }));

      setIsEditModalOpen(false);
      setEditingProduct(null);
      toast.success('تم تحديث بيانات الصنف بنجاح');
    } catch (err) {
      toast.error(err.response?.data?.message || 'فشل تحديث بيانات الصنف');
    } finally {
      setIsUpdatingProduct(false);
    }
  };

  // Manual Dropdown selection
  const handleProductSelect = (pid) => {
    const prod = products.find(p => p.id === Number(pid));
    if (prod) {
      setSelectedProductInfo(prod);
      setCurrentItem({
        ...currentItem,
        productId: pid,
        buyInPackage: false,
        unitCost: prod.purchasePrice,
        quantity: '1',
        expiryDate: prod.expiryDate ? prod.expiryDate.split('T')[0] : ''
      });
    } else {
      setSelectedProductInfo(null);
      setCurrentItem({ ...currentItem, productId: '', unitCost: '', quantity: '', expiryDate: '' });
    }
  };

  const toggleBuyMode = (isPackage) => {
    if (!selectedProductInfo) return;
    
    let newCost = currentItem.unitCost;
    if (isPackage && selectedProductInfo.piecesPerPackage) {
      newCost = Number(selectedProductInfo.purchasePrice) * Number(selectedProductInfo.piecesPerPackage);
    } else {
      newCost = selectedProductInfo.purchasePrice;
    }

    setCurrentItem({
      ...currentItem,
      buyInPackage: isPackage,
      unitCost: newCost
    });
  };

  const handleManualAddItem = (e) => {
    e.preventDefault();
    if (!currentItem.productId || !currentItem.quantity || !currentItem.unitCost) {
      return toast.error('يرجى تحديد الصنف والكمية وسعر الشراء');
    }
    
    let finalBaseQuantity = Number(currentItem.quantity);
    let finalBaseUnitCost = Number(currentItem.unitCost);

    if (currentItem.buyInPackage && selectedProductInfo && selectedProductInfo.piecesPerPackage) {
      finalBaseQuantity = Number(currentItem.quantity) * Number(selectedProductInfo.piecesPerPackage);
      finalBaseUnitCost = Number(currentItem.unitCost) / Number(selectedProductInfo.piecesPerPackage);
    }

    setItems([...items, { 
      productId: Number(currentItem.productId), 
      productName: selectedProductInfo.name, 
      displayQty: currentItem.quantity,
      isPackage: currentItem.buyInPackage,
      displayUnit: currentItem.buyInPackage ? selectedProductInfo.packageUnit : selectedProductInfo.unit,
      displayCost: currentItem.unitCost,
      baseQuantity: finalBaseQuantity,
      baseUnitCost: finalBaseUnitCost,
      subtotal: Number(currentItem.quantity) * Number(currentItem.unitCost),
      expiryDate: currentItem.expiryDate ? currentItem.expiryDate.split('T')[0] : (selectedProductInfo.expiryDate ? selectedProductInfo.expiryDate.split('T')[0] : ''),
      isExpired: selectedProductInfo.isExpired,
      isExpiringSoon: selectedProductInfo.isExpiringSoon
    }]);
    
    setCurrentItem({ productId: '', buyInPackage: false, quantity: '', unitCost: '', expiryDate: '' });
    setSelectedProductInfo(null);
    toast.success('تمت إضافة الصنف للفاتورة');
  };

  const updateItemExpiryDate = (index, newDate) => {
    setItems(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        expiryDate: newDate
      };
      return updated;
    });
  };

  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // ================= Final Invoice Save =================
  const handleSavePurchase = async () => {
    if (isSubmitting) return;

    // Strict Validations
    if (!form.supplierId) {
      return toast.error('يرجى اختيار المورد من القائمة أولاً');
    }
    if (items.length === 0) {
      return toast.error('يرجى إضافة أصناف إلى الفاتورة');
    }

    const numPaid = paidAmount ? Number(paidAmount) : 0;
    let selectedMethod = paymentMethodId;

    if (numPaid > 0) {
      if (!selectedMethod) {
        // Fallback to Drawer automatically
        const drawer = paymentMethods.find(m => m.name.includes('درج') || m.name.includes('نقدي')) || paymentMethods[0];
        if (drawer) {
          selectedMethod = drawer.id;
          setPaymentMethodId(drawer.id);
        } else {
          return toast.error('يرجى تحديد الخزينة المراد السداد منها');
        }
      }
    }

    setIsSubmitting(true);
    try {
      await client.post('/purchases', {
        supplierId: Number(form.supplierId),
        referenceNo: form.referenceNo || `PUR-${Date.now()}`,
        paidAmount: numPaid,
        paymentMethodId: numPaid > 0 ? Number(selectedMethod) : null,
        items: items.map(i => ({ 
          productId: i.productId, 
          quantity: i.baseQuantity, 
          unitCost: i.baseUnitCost,
          expiryDate: i.expiryDate ? i.expiryDate : null
        }))
      });

      toast.success('تم حفظ فاتورة الشراء وتحديث المخزون بنجاح');
      navigate('/purchases/suppliers');
    } catch (err) {
      toast.error(err.response?.data?.message || 'حدث خطأ في حفظ الفاتورة');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalInvoice = items.reduce((sum, item) => sum + item.subtotal, 0);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#007507] mb-4"></div>
        <p className="text-gray-600 font-bold">جاري تحميل شاشة المشتريات...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-6 rounded-3xl shadow-sm border-2 border-gray-100 gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2">
            <ShoppingCart className="text-[#007507]" size={28} />
            <span>فاتورة مشتريات جديدة</span>
          </h2>
          <p className="text-gray-500 font-bold text-sm mt-1">تسجيل بضاعة جديدة وإضافتها للمخزون مع إثبات حساب المورد والخزينة</p>
        </div>
        <button 
          onClick={() => navigate('/purchases/suppliers')} 
          className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 text-sm"
        >
          <ArrowLeft size={18} />
          <span>العودة للموردين</span>
        </button>
      </div>

      {/* Supplier & Reference Info Card */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border-2 border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block mb-2 font-black text-gray-700 text-sm">
            المورد (التاجر) <span className="text-red-500">*</span>:
          </label>
          <select 
            required
            className="w-full border-2 border-gray-200 rounded-2xl p-3.5 outline-none focus:border-[#007507] transition-all bg-white font-bold text-gray-800 text-base" 
            value={form.supplierId} 
            onChange={e => setForm({ ...form, supplierId: e.target.value })}
          >
            <option value="">-- اختر المورد صاحب الفاتورة --</option>
            {suppliers.map(s => (
              <option key={s.id} value={s.id}>
                {s.name} {s.notes ? `(${s.notes})` : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block mb-2 font-black text-gray-700 text-sm">
            رقم الفاتورة المرجعي (اختياري):
          </label>
          <input 
            type="text" 
            placeholder="مثال: فاتورة رقم 1045 أو يُترك ليتولد تلقائياً" 
            className="w-full border-2 border-gray-200 rounded-2xl p-3.5 outline-none focus:border-[#007507] transition-all font-bold text-gray-800" 
            value={form.referenceNo} 
            onChange={e => setForm({ ...form, referenceNo: e.target.value })}
          />
        </div>
      </div>

      {/* Barcode Quick Scan Section */}
      <div className="bg-gradient-to-r from-[#003607] to-slate-800 p-6 rounded-3xl text-white shadow-lg border-2 border-slate-700">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/10 rounded-2xl border border-white/20">
              <Barcode size={32} className="text-emerald-300" />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-wide flex items-center gap-2">
                <span>مسح الباركود للإضافة السريعة</span>
                <span className="text-xs bg-[#1bb641]/40 text-emerald-200 px-2.5 py-1 rounded-full font-bold">ذكي وسريع</span>
              </h3>
              <p className="text-emerald-200 text-xs font-bold mt-0.5">
                امسح الباركود وسيتم إضافة الصنف فوراً، أو إنشاؤه في ثانية واحدة إذا كان جديداً
              </p>
            </div>
          </div>

          <form onSubmit={handleBarcodeSubmit} className="flex gap-2 w-full md:w-auto flex-1 max-w-md">
            <div className="relative flex-1">
              <input 
                ref={barcodeRef}
                type="text" 
                placeholder="امسح الباركود هنا واضغط Enter..." 
                className="w-full bg-white text-gray-900 font-black rounded-2xl px-4 py-3 text-base outline-none border-2 border-transparent focus:border-emerald-400 placeholder:text-gray-400 placeholder:font-normal"
                value={barcodeInput}
                onChange={e => setBarcodeInput(e.target.value)}
              />
            </div>
            <button 
              type="submit" 
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-black px-6 py-3 rounded-2xl transition-all shadow-md flex items-center gap-2 shrink-0"
            >
              <PlusCircle size={20} />
              <span>إضافة</span>
            </button>
          </form>
        </div>
      </div>

      {/* Manual Add Item Accordion / Box */}
      <div className="bg-emerald-50/60 p-6 rounded-3xl border-2 border-emerald-100 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-black text-slate-900 flex items-center gap-2">
            <Layers className="text-[#007507]" size={20} />
            <span>إضافة صنف يدوياً أو تعديل كميات / كراتين</span>
          </h3>
          <button 
            type="button" 
            onClick={() => {
              setNewProductForm({
                name: '',
                barcode: '',
                internalCode: `PROD-${Date.now().toString().slice(-5)}`,
                purchasePrice: '',
                sellingPrice: '',
                unit: 'قطعة',
                packageUnit: '',
                piecesPerPackage: 1,
                alertThreshold: 10,
                expiryDate: ''
              });
              setIsCreateModalOpen(true);
            }}
            className="text-[#007507] bg-white hover:bg-emerald-100 border border-emerald-200 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm"
          >
            <PlusCircle size={16} />
            <span>+ إنشاء صنف جديد</span>
          </button>
        </div>

        <form onSubmit={handleManualAddItem} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-4">
            <label className="block mb-1.5 font-bold text-gray-700 text-xs">الصنف:</label>
            <select 
              className="w-full border-2 border-emerald-200 rounded-2xl p-3 outline-none focus:border-[#007507] bg-white font-bold text-sm text-gray-800" 
              value={currentItem.productId} 
              onChange={e => handleProductSelect(e.target.value)}
            >
              <option value="">-- اختر صنف من القائمة --</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.unit}) - شراء: {p.purchasePrice} ج.م
                </option>
              ))}
            </select>
          </div>

          {selectedProductInfo && selectedProductInfo.packageUnit && (
            <div className="md:col-span-12 flex gap-3 items-center bg-white p-2.5 rounded-2xl border border-emerald-200">
              <span className="text-xs font-black text-gray-600 ml-1">الوحدة:</span>
              <button 
                type="button" 
                onClick={() => toggleBuyMode(false)} 
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${!currentItem.buyInPackage ? 'bg-[#007507] text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                بالوحدة الأساسية ({selectedProductInfo.unit})
              </button>
              <button 
                type="button" 
                onClick={() => toggleBuyMode(true)} 
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${currentItem.buyInPackage ? 'bg-[#007507] text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                بالكرتونة ({selectedProductInfo.packageUnit} = {selectedProductInfo.piecesPerPackage} {selectedProductInfo.unit})
              </button>
            </div>
          )}

          <div className="md:col-span-2">
            <label className="block mb-1.5 font-bold text-gray-700 text-xs">
              الكمية {currentItem.buyInPackage ? `(${selectedProductInfo?.packageUnit})` : (selectedProductInfo ? `(${selectedProductInfo?.unit})` : '')}:
            </label>
            <input 
              type="number" 
              min="0.01" 
              step="0.01" 
              placeholder="1"
              className="w-full border-2 border-emerald-200 rounded-2xl p-3 outline-none focus:border-[#007507] font-bold bg-white text-gray-800" 
              value={currentItem.quantity} 
              onChange={e => setCurrentItem({ ...currentItem, quantity: e.target.value })}
            />
          </div>

          <div className="md:col-span-2">
            <label className="block mb-1.5 font-bold text-gray-700 text-xs">سعر الشراء:</label>
            <input 
              type="number" 
              min="0.01" 
              step="0.01" 
              placeholder="0.00"
              className="w-full border-2 border-emerald-200 rounded-2xl p-3 outline-none focus:border-[#007507] font-black text-[#007507] bg-white" 
              value={currentItem.unitCost} 
              onChange={e => setCurrentItem({ ...currentItem, unitCost: e.target.value })}
            />
          </div>

          <div className="md:col-span-2">
            <label className="block mb-1.5 font-bold text-gray-700 text-xs flex items-center justify-between">
              <span>تاريخ الصلاحية:</span>
              <span className="text-[10px] text-gray-400 font-normal">(اختياري)</span>
            </label>
            <input 
              type="date" 
              className="w-full border-2 border-emerald-200 rounded-2xl p-2.5 outline-none focus:border-[#007507] font-bold bg-white text-gray-800 text-xs shadow-sm" 
              value={currentItem.expiryDate || ''} 
              onChange={e => setCurrentItem({ ...currentItem, expiryDate: e.target.value })}
            />
          </div>

          <div className="md:col-span-2">
            <button 
              type="submit" 
              className="w-full bg-[#007507] hover:bg-[#006006] text-white font-black rounded-2xl p-3.5 transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>+ إضافة للفاتورة</span>
            </button>
          </div>
        </form>
      </div>

      {/* Invoice Items Table */}
      <div className="bg-white rounded-3xl shadow-sm border-2 border-gray-100 overflow-hidden">
        <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
          <h4 className="font-black text-gray-800 text-sm">أصناف الفاتورة ({items.length} صنف)</h4>
          <span className="text-xs font-bold text-gray-500">يمكنك تحديد تاريخ صلاحية مخصص لكل صنف بشكل مستقل</span>
        </div>
        <table className="w-full text-right border-collapse">
          <thead className="bg-gray-50/50 text-gray-700 text-xs font-black border-b border-gray-100">
            <tr>
              <th className="p-4">الصنف</th>
              <th className="p-4">الكمية</th>
              <th className="p-4">سعر الشراء</th>
              <th className="p-4">تاريخ الصلاحية (اختياري لكل صنف)</th>
              <th className="p-4">الإجمالي</th>
              <th className="p-4 text-center">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm">
            {items.map((item, idx) => (
              <tr key={idx} className="hover:bg-gray-50/80 transition-colors">
                <td className="p-4 font-black text-gray-800">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span>{item.productName}</span>
                      <button 
                        type="button"
                        onClick={() => handleOpenEditProduct(item.productId)}
                        className="p-1 text-gray-400 hover:text-[#007507] hover:bg-emerald-50 rounded-lg transition-all"
                        title="تعديل بيانات الصنف والباركود"
                      >
                        <Edit3 size={15} />
                      </button>
                    </div>
                  </div>
                </td>
                <td className="p-4 font-bold text-gray-700">
                  {item.displayQty} <span className="text-xs text-gray-500 font-normal">{item.displayUnit}</span>
                  {item.isPackage && (
                    <span className="block text-xs text-[#007507] font-bold mt-0.5">(= {item.baseQuantity} قطعة أساسية)</span>
                  )}
                </td>
                <td className="p-4 font-black text-gray-700">{Number(item.displayCost).toFixed(2)} ج.م</td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={item.expiryDate ? item.expiryDate.split('T')[0] : ''}
                      onChange={e => updateItemExpiryDate(idx, e.target.value)}
                      className="border-2 border-gray-200 rounded-xl px-3 py-2 text-xs font-black bg-white focus:border-[#007507] outline-none w-40 text-gray-800 shadow-sm transition-all"
                      title="حدد تاريخ انتهاء الصلاحية الخاص بهذا الصنف في هذه الفاتورة"
                    />
                    {item.expiryDate ? (
                      <button
                        type="button"
                        onClick={() => updateItemExpiryDate(idx, '')}
                        className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors text-xs font-black"
                        title="إلغاء تاريخ الصلاحية لهذا الصنف"
                      >
                        ✕
                      </button>
                    ) : (
                      <span className="text-[11px] text-gray-400 font-normal italic">بدون تاريخ</span>
                    )}
                  </div>
                </td>
                <td className="p-4 font-black text-[#007507] text-base">{Number(item.subtotal).toFixed(2)} ج.م</td>
                <td className="p-4 text-center">
                  <button 
                    onClick={() => removeItem(idx)} 
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-xl transition-all"
                    title="حذف الصنف"
                  >
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan="6" className="p-10 text-center text-gray-400 font-bold">
                  لم يتم إضافة أصناف بعد — استخدم قارئ الباركود بالأعلى أو الإضافة اليدوية
                </td>
              </tr>
            )}
          </tbody>
          <tfoot className="bg-gray-50 font-black text-lg border-t-2 border-gray-100">
            <tr>
              <td colSpan="4" className="p-5 text-gray-700 text-left">إجمالي قيمة الفاتورة:</td>
              <td colSpan="2" className="p-5 text-[#007507] font-black text-2xl">{totalInvoice.toFixed(2)} ج.م</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Payment & Confirmation Bar */}
      <div className="bg-gradient-to-br from-gray-50 to-emerald-50/30 p-6 border-2 border-gray-200 rounded-3xl flex flex-col md:flex-row gap-6 justify-between items-center mb-10">
        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-2/3">
          <div className="flex-1">
            <label className="block mb-2 font-black text-gray-700 text-xs">
              المبلغ المدفوع للتاجر الآن (ج.م):
            </label>
            <input 
              type="number" 
              step="0.01" 
              min="0" 
              placeholder="0.00 (اتركه 0 إذا كانت الفاتورة آجلة بالكامل)" 
              className="w-full border-2 border-gray-300 rounded-2xl p-3.5 outline-none focus:border-[#007507] font-black text-[#007507] text-lg bg-white" 
              value={paidAmount} 
              onChange={e => setPaidAmount(e.target.value)} 
            />
          </div>

          {Number(paidAmount) > 0 && (
            <div className="flex-1 animate-in fade-in duration-200">
              <label className="block mb-2 font-black text-gray-700 text-xs">
                الخزينة (لسحب المبلغ المدفوع):
              </label>
              <select 
                className="w-full border-2 border-emerald-300 rounded-2xl p-3.5 outline-none focus:border-[#007507] bg-white font-bold text-gray-800 text-sm shadow-sm" 
                value={paymentMethodId || (paymentMethods[0]?.id || '')} 
                onChange={e => setPaymentMethodId(e.target.value)}
              >
                {paymentMethods.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name} (المتاح: {m.currentBalance} ج.م)
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 items-end w-full md:w-auto mt-4 md:mt-0">
          <div className="text-left w-full space-y-1">
            <div className="text-gray-500 text-xs font-bold">صافي الفاتورة</div>
            <div className="text-3xl font-black text-[#007507]">{totalInvoice.toFixed(2)} ج.م</div>
            {Number(paidAmount) > 0 && Number(paidAmount) < totalInvoice && (
              <div className="text-xs text-red-600 font-black">
                المتبقي مديونية للمورد: {(totalInvoice - Number(paidAmount)).toFixed(2)} ج.م
              </div>
            )}
            {Number(paidAmount) >= totalInvoice && Number(paidAmount) > 0 && (
              <div className="text-xs text-emerald-600 font-black flex items-center gap-1">
                <CheckCircle2 size={14} />
                <span>الفاتورة خالصة بالكامل نقدياً</span>
              </div>
            )}
          </div>

          <button 
            type="button"
            onClick={handleSavePurchase} 
            disabled={items.length === 0 || isSubmitting} 
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-10 py-4 rounded-2xl font-black text-lg shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02]"
          >
            {isSubmitting ? 'جاري الحفظ...' : '✅ تأكيد وحفظ الفاتورة'}
          </button>
        </div>
      </div>

      {/* ================= Quick Create Product Modal ================= */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl p-7 w-full max-w-lg border border-gray-100">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-gray-100">
              <h3 className="text-xl font-black text-gray-800 flex items-center gap-2">
                <Sparkles className="text-[#007507]" size={24} />
                <span>إنشاء صنف جديد وإضافته للفاتورة</span>
              </h3>
              <button 
                onClick={() => setIsCreateModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateProductSubmit} className="space-y-4">
              <div>
                <label className="block mb-1 text-xs font-bold text-gray-700">اسم الصنف <span className="text-red-500">*</span>:</label>
                <input 
                  required
                  type="text" 
                  placeholder="مثال: شوكولاتة كندر بوينو"
                  className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-[#007507] font-bold text-gray-800"
                  value={newProductForm.name}
                  onChange={e => setNewProductForm({ ...newProductForm, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1 text-xs font-bold text-gray-700">الباركود:</label>
                  <input 
                    type="text" 
                    className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-[#007507] font-bold text-gray-800 font-mono"
                    value={newProductForm.barcode}
                    onChange={e => setNewProductForm({ ...newProductForm, barcode: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block mb-1 text-xs font-bold text-gray-700">الكود الداخلي:</label>
                  <input 
                    required
                    type="text" 
                    className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-[#007507] font-bold text-gray-800 font-mono"
                    value={newProductForm.internalCode}
                    onChange={e => setNewProductForm({ ...newProductForm, internalCode: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1 text-xs font-bold text-gray-700">سعر الشراء (ج.م) <span className="text-red-500">*</span>:</label>
                  <input 
                    required
                    type="number" 
                    step="0.01" 
                    min="0"
                    placeholder="0.00"
                    className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-[#007507] font-black text-[#007507] text-base"
                    value={newProductForm.purchasePrice}
                    onChange={e => setNewProductForm({ ...newProductForm, purchasePrice: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block mb-1 text-xs font-bold text-gray-700">سعر البيع للمريض (ج.م) <span className="text-red-500">*</span>:</label>
                  <input 
                    required
                    type="number" 
                    step="0.01" 
                    min="0"
                    placeholder="0.00"
                    className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-[#007507] font-black text-emerald-600 text-base"
                    value={newProductForm.sellingPrice}
                    onChange={e => setNewProductForm({ ...newProductForm, sellingPrice: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1 text-xs font-bold text-gray-700">الوحدة الأساسية:</label>
                  <input 
                    type="text" 
                    placeholder="قطعة / كيس / زجاجة"
                    className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-[#007507] font-bold text-gray-800"
                    value={newProductForm.unit}
                    onChange={e => setNewProductForm({ ...newProductForm, unit: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block mb-1 text-xs font-bold text-gray-700">حد التنبيه للنقص:</label>
                  <input 
                    type="number" 
                    min="0"
                    placeholder="10"
                    className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-[#007507] font-bold text-gray-800"
                    value={newProductForm.alertThreshold}
                    onChange={e => setNewProductForm({ ...newProductForm, alertThreshold: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block mb-1 text-xs font-bold text-gray-700">
                  تاريخ انتهاء الصلاحية (اختياري):
                </label>
                <input 
                  type="date" 
                  className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-[#007507] font-bold text-gray-800"
                  value={newProductForm.expiryDate}
                  onChange={e => setNewProductForm({ ...newProductForm, expiryDate: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
                <button 
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl font-bold text-gray-600 hover:bg-gray-100"
                >
                  إلغاء
                </button>
                <button 
                  type="submit"
                  disabled={isCreatingProduct}
                  className="px-6 py-2.5 rounded-xl font-black bg-[#007507] hover:bg-[#006006] text-white shadow-md shadow-emerald-200 disabled:opacity-50"
                >
                  {isCreatingProduct ? 'جاري الحفظ...' : 'حفظ وإضافة للفاتورة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= Inline Edit Product Modal ================= */}
      {isEditModalOpen && editingProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl p-7 w-full max-w-lg border border-gray-100">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-gray-100">
              <h3 className="text-xl font-black text-gray-800 flex items-center gap-2">
                <Edit3 className="text-amber-600" size={24} />
                <span>تعديل بيانات الصنف والباركود</span>
              </h3>
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleEditProductSubmit} className="space-y-4">
              <div>
                <label className="block mb-1 text-xs font-bold text-gray-700">اسم الصنف:</label>
                <input 
                  required
                  type="text" 
                  className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-amber-600 font-bold text-gray-800"
                  value={editingProduct.name}
                  onChange={e => setEditingProduct({ ...editingProduct, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1 text-xs font-bold text-gray-700">الباركود:</label>
                  <input 
                    type="text" 
                    className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-amber-600 font-bold text-gray-800 font-mono"
                    value={editingProduct.barcode}
                    onChange={e => setEditingProduct({ ...editingProduct, barcode: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block mb-1 text-xs font-bold text-gray-700">الكود الداخلي:</label>
                  <input 
                    required
                    type="text" 
                    className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-amber-600 font-bold text-gray-800 font-mono"
                    value={editingProduct.internalCode}
                    onChange={e => setEditingProduct({ ...editingProduct, internalCode: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1 text-xs font-bold text-gray-700">سعر الشراء الافتراضي (ج.م):</label>
                  <input 
                    required
                    type="number" 
                    step="0.01" 
                    min="0"
                    className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-amber-600 font-black text-[#007507] text-base"
                    value={editingProduct.purchasePrice}
                    onChange={e => setEditingProduct({ ...editingProduct, purchasePrice: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block mb-1 text-xs font-bold text-gray-700">سعر البيع للجمهور (ج.م):</label>
                  <input 
                    required
                    type="number" 
                    step="0.01" 
                    min="0"
                    className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-amber-600 font-black text-emerald-600 text-base"
                    value={editingProduct.sellingPrice}
                    onChange={e => setEditingProduct({ ...editingProduct, sellingPrice: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1 text-xs font-bold text-gray-700">الوحدة:</label>
                  <input 
                    type="text" 
                    className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-amber-600 font-bold text-gray-800"
                    value={editingProduct.unit}
                    onChange={e => setEditingProduct({ ...editingProduct, unit: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block mb-1 text-xs font-bold text-gray-700">حد التنبيه:</label>
                  <input 
                    type="number" 
                    min="0"
                    className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-amber-600 font-bold text-gray-800"
                    value={editingProduct.alertThreshold}
                    onChange={e => setEditingProduct({ ...editingProduct, alertThreshold: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block mb-1 text-xs font-bold text-gray-700">
                  تاريخ انتهاء الصلاحية (اختياري):
                </label>
                <input 
                  type="date" 
                  className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-amber-600 font-bold text-gray-800"
                  value={editingProduct.expiryDate || ''}
                  onChange={e => setEditingProduct({ ...editingProduct, expiryDate: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
                <button 
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl font-bold text-gray-600 hover:bg-gray-100"
                >
                  إلغاء
                </button>
                <button 
                  type="submit"
                  disabled={isUpdatingProduct}
                  className="px-6 py-2.5 rounded-xl font-black bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-200 disabled:opacity-50"
                >
                  {isUpdatingProduct ? 'جاري التحديث...' : 'تحديث البيانات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default NewPurchasePage;
