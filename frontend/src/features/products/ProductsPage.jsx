import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import client from '../../api/client';
import { useAuth } from '../auth/AuthContext';
import { 
  Sparkles, Edit3, X, Barcode, Package, CheckCircle2, 
  Search, SlidersHorizontal, AlertTriangle, Clock, Calendar, 
  Store, Coffee, UtensilsCrossed, Layers, Eye, ChefHat, Info, DollarSign, Trash2
} from 'lucide-react';
import HotDrinksRecipeModal from './HotDrinksRecipeModal';

const ProductsPage = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  
  // الأقسام الثلاثة الرئيسية + المواد الخام
  const [activityFilter, setActivityFilter] = useState('ALL'); // 'ALL', 'CANTEEN', 'BUFFET', 'SANDWICH', 'RAW_MATERIAL'
  const [filterTab, setFilterTab] = useState('ALL'); // 'ALL', 'LOW_STOCK', 'EXPIRING_SOON', 'EXPIRED'
  const { hasPermission, isAdmin } = useAuth();

  // Quick Price Edit Modal State
  const [quickPriceModal, setQuickPriceModal] = useState(null);
  const [newSellingPrice, setNewSellingPrice] = useState('');

  // Delete Product Modal State
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentId, setCurrentId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const [form, setForm] = useState({
    name: '', 
    internalCode: '', 
    barcode: '', 
    sellingPrice: '', 
    purchasePrice: '', 
    unit: 'قطعة', 
    packageUnit: '', 
    piecesPerPackage: 1, 
    conversionFactor: 1, 
    alertThreshold: 10, 
    expiryDate: '',
    activityType: 'CANTEEN',
    productType: 'SIMPLE',
    recipeYield: 1,
    recipeNotes: '',
    isActive: true
  });

  const [adjustModal, setAdjustModal] = useState(false);
  const [adjustForm, setAdjustForm] = useState({ productId: null, quantity: '', type: 'IN', reason: '' });

  // Modal to preview recipe ingredients
  const [viewRecipeModal, setViewRecipeModal] = useState(null);

  // Modal for Hot Drinks Recipe Builder
  const [hotDrinkModalOpen, setHotDrinkModalOpen] = useState(false);
  const [editingHotDrink, setEditingHotDrink] = useState(null);

  const openHotDrinkModal = (recipe = null) => {
    setEditingHotDrink(recipe);
    setHotDrinkModalOpen(true);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await client.get('/products');
      setProducts(res.data.data);
    } catch (err) {
      setError('فشل جلب الأصناف');
    } finally {
      setLoading(false);
    }
  };

  // Division Counts
  const canteenCount = products.filter(p => p.activityType === 'CANTEEN' && p.productType !== 'RAW_MATERIAL').length;
  const buffetCount = products.filter(p => p.activityType === 'BUFFET' && p.productType !== 'RAW_MATERIAL').length;
  const sandwichCount = products.filter(p => p.activityType === 'SANDWICH' && p.productType !== 'RAW_MATERIAL').length;
  const rawMaterialCount = products.filter(p => p.productType === 'RAW_MATERIAL').length;

  // Filter products by Division, Status Tab, and Search query
  const filteredProducts = products.filter(p => {
    const q = search.trim().toLowerCase();
    const matchSearch = !q || 
      (p.name && p.name.toLowerCase().includes(q)) || 
      (p.internalCode && p.internalCode.toLowerCase().includes(q)) || 
      (p.barcode && p.barcode.toLowerCase().includes(q));

    if (!matchSearch) return false;

    // Activity division filtering
    if (activityFilter === 'RAW_MATERIAL') {
      if (p.productType !== 'RAW_MATERIAL') return false;
    } else if (activityFilter !== 'ALL') {
      if (p.activityType !== activityFilter || p.productType === 'RAW_MATERIAL') return false;
    }

    // Status tab filtering
    if (filterTab === 'LOW_STOCK') {
      return Number(p.totalStock) <= Number(p.alertThreshold) || Number(p.totalStock) <= 0;
    }
    if (filterTab === 'EXPIRING_SOON') {
      return p.isExpiringSoon;
    }
    if (filterTab === 'EXPIRED') {
      return p.isExpired;
    }

    return true;
  });

  // Counts for status tabs based on current division
  const currentDivisionProducts = products.filter(p => {
    if (activityFilter === 'RAW_MATERIAL') return p.productType === 'RAW_MATERIAL';
    if (activityFilter !== 'ALL') return p.activityType === activityFilter && p.productType !== 'RAW_MATERIAL';
    return true;
  });

  const lowStockCount = currentDivisionProducts.filter(p => Number(p.totalStock) <= Number(p.alertThreshold) || Number(p.totalStock) <= 0).length;
  const expiringSoonCount = currentDivisionProducts.filter(p => p.isExpiringSoon).length;
  const expiredCount = currentDivisionProducts.filter(p => p.isExpired).length;

  const openAddModal = (presetActivity = 'CANTEEN', presetType = 'SIMPLE') => {
    setIsEditMode(false);
    const autoCode = `PROD-${Date.now().toString().slice(-5)}`;
    setForm({ 
      name: '', 
      internalCode: autoCode, 
      barcode: '', 
      sellingPrice: '', 
      purchasePrice: '', 
      unit: presetType === 'RAW_MATERIAL' ? 'كيلو' : 'قطعة', 
      packageUnit: '', 
      piecesPerPackage: 1, 
      conversionFactor: 1, 
      alertThreshold: 10, 
      expiryDate: '',
      activityType: presetActivity,
      productType: presetType,
      recipeYield: 1,
      recipeNotes: '',
      isActive: true 
    });
    setIsModalOpen(true);
  };

  const handleOpenQuickPrice = (product) => {
    if ((product.activityType === 'BUFFET' || product.activityType === 'SANDWICH') && !isAdmin) {
      return toast.error('عذراً، تعديل أسعار أصناف البوفيه والسندوتشات مقتصر على الأدمن فقط');
    }
    setQuickPriceModal(product);
    setNewSellingPrice(String(product.sellingPrice));
  };

  const handleSaveQuickPrice = async (e) => {
    e.preventDefault();
    if (!quickPriceModal) return;
    const num = Number(newSellingPrice);
    if (isNaN(num) || num < 0) {
      return toast.error('يرجى إدخال سعر بيع صحيح');
    }
    try {
      await client.put(`/products/${quickPriceModal.id}`, {
        ...quickPriceModal,
        sellingPrice: num
      });
      toast.success(`تم تحديث سعر بيع (${quickPriceModal.name}) إلى ${num} ج.م بنجاح ✅`);
      setQuickPriceModal(null);
      fetchProducts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'فشل تحديث السعر');
    }
  };

  const handleOpenDelete = (product) => {
    setDeleteTarget(product);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    const directStock = Number(deleteTarget.directStock !== undefined ? deleteTarget.directStock : deleteTarget.totalStock || 0);
    if (directStock > 0 && deleteTarget.productType !== 'RECIPE') {
      toast.error(`لا يمكن حذف الصنف لوجود رصيد متبقي بالمخزن (${directStock} ${deleteTarget.unit || 'قطعة'})`);
      return;
    }

    setIsDeleting(true);
    try {
      const res = await client.delete(`/products/${deleteTarget.id}`);
      toast.success(res.data?.message || `تم حذف الصنف (${deleteTarget.name}) بنجاح`);
      setDeleteTarget(null);
      fetchProducts();
    } catch (err) {
      const errMsg = err.response?.data?.message || 'فشل حذف الصنف';
      toast.error(errMsg);
    } finally {
      setIsDeleting(false);
    }
  };

  const openEditModal = (product) => {
    if ((product.activityType === 'BUFFET' || product.activityType === 'SANDWICH') && !isAdmin) {
      return toast.error('عذراً، تعديل أصناف وأسعار البوفيه والسندوتشات مقتصر على الأدمن فقط');
    }
    if (product.activityType === 'BUFFET' && product.productType === 'RECIPE') {
      return openHotDrinkModal(product);
    }
    if (product.activityType === 'SANDWICH' && product.productType === 'RECIPE') {
      return navigate(`/sandwiches?edit=${product.id}`);
    }

    setIsEditMode(true);
    setCurrentId(product.id);
    
    let formattedExpiry = '';
    if (product.expiryDate) {
      formattedExpiry = String(product.expiryDate).split('T')[0];
    } else if (product.effectiveExpiryDate) {
      formattedExpiry = String(product.effectiveExpiryDate).split('T')[0];
    }

    setForm({
      name: product.name,
      internalCode: product.internalCode,
      barcode: product.barcode || '',
      sellingPrice: product.sellingPrice,
      purchasePrice: product.purchasePrice,
      unit: product.unit || 'قطعة',
      packageUnit: product.packageUnit || '',
      piecesPerPackage: product.piecesPerPackage || 1,
      conversionFactor: product.conversionFactor || 1,
      alertThreshold: product.alertThreshold ?? 10,
      expiryDate: formattedExpiry,
      activityType: product.activityType || 'CANTEEN',
      productType: product.productType || 'SIMPLE',
      recipeYield: product.recipeYield || 1,
      recipeNotes: product.recipeNotes || '',
      isActive: product.isActive
    });
    setIsModalOpen(true);
  };

  const openAdjustModal = (product) => {
    setAdjustForm({ productId: product.id, quantity: '', type: 'IN', reason: '' });
    setAdjustModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name) {
      return toast.error('يرجى كتابة اسم الصنف');
    }
    if (form.productType !== 'RAW_MATERIAL' && (form.sellingPrice === undefined || form.sellingPrice === '')) {
      return toast.error('يرجى تحديد سعر البيع للمريض');
    }

    if ((form.activityType === 'BUFFET' || form.activityType === 'SANDWICH') && !isAdmin) {
      return toast.error('عذراً، إضافة وتعديل أصناف البوفيه والسندوتشات مقتصر على الأدمن فقط');
    }

    const payload = {
      ...form,
      sellingPrice: form.productType === 'RAW_MATERIAL' ? 0 : Number(form.sellingPrice || 0)
    };

    setIsSaving(true);
    try {
      if (isEditMode) {
        await client.put(`/products/${currentId}`, payload);
        toast.success('تم تحديث بيانات الصنف بنجاح ✅');
      } else {
        await client.post('/products', payload);
        toast.success('تمت إضافة الصنف الجديد بنجاح ✅');
      }
      setIsModalOpen(false);
      fetchProducts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'حدث خطأ أثناء حفظ الصنف');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    try {
      await client.post(`/products/${adjustForm.productId}/adjust`, {
        quantity: adjustForm.quantity,
        type: adjustForm.type,
        reason: adjustForm.reason
      });
      toast.success('تمت تسوية المخزون بنجاح');
      setAdjustModal(false);
      fetchProducts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'حدث خطأ في تسوية المخزون');
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500 font-bold">جاري تحميل الأصناف والمخزون...</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center bg-white p-6 rounded-3xl shadow-sm border-2 border-gray-200 gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2">
            <span>إدارة الأصناف والمخزون</span>
            <span className="text-xs bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full font-black">
              3 أقسام مستقلة
            </span>
          </h2>
          <p className="text-gray-500 text-sm font-bold mt-1">
            إدارة أصناف الكانتين، مشروبات البوفيه، سندوتشات المطبخ، والمواد الخام المستهلكة
          </p>
        </div>

        {hasPermission('MANAGE_PRODUCTS') && (
          <div className="flex flex-wrap items-center gap-2.5">
            <button 
              onClick={() => openAddModal('CANTEEN', 'SIMPLE')} 
              className="bg-sky-600 hover:bg-sky-700 text-white font-black px-4 py-2.5 rounded-2xl transition-all shadow-sm flex items-center gap-1.5 text-xs sm:text-sm"
            >
              <Store size={18} />
              <span>+ صنف كانتين</span>
            </button>
            <button 
              onClick={() => openHotDrinkModal(null)} 
              className="bg-amber-600 hover:bg-amber-700 text-white font-black px-4 py-2.5 rounded-2xl transition-all shadow-sm flex items-center gap-1.5 text-xs sm:text-sm"
            >
              <Coffee size={18} />
              <span>+ مشروب بوفيه (شاي/قهوة)</span>
            </button>
            <Link 
              to="/sandwiches" 
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-4 py-2.5 rounded-2xl transition-all shadow-sm flex items-center gap-1.5 text-xs sm:text-sm"
            >
              <UtensilsCrossed size={18} />
              <span>+ سندوتش مطبخ (صفحة المأكولات)</span>
            </Link>
            <button 
              onClick={() => openAddModal('BUFFET', 'RAW_MATERIAL')} 
              className="bg-slate-700 hover:bg-slate-800 text-white font-black px-4 py-2.5 rounded-2xl transition-all shadow-sm flex items-center gap-1.5 text-xs sm:text-sm"
            >
              <Package size={18} />
              <span>+ مادة خام</span>
            </button>
          </div>
        )}
      </div>

      {error && <div className="bg-red-50 border-r-4 border-red-500 text-red-700 p-4 rounded-xl font-bold">{error}</div>}

      {/* ================= 3 DIVISIONS SELECTOR PILLS ================= */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <button
          onClick={() => setActivityFilter('ALL')}
          className={`p-3.5 rounded-2xl border-2 transition-all flex items-center gap-3 text-right font-black ${
            activityFilter === 'ALL'
              ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 shadow-sm ring-2 ring-indigo-500/20'
              : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
          }`}
        >
          <div className={`p-2.5 rounded-xl ${activityFilter === 'ALL' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
            <Layers size={20} />
          </div>
          <div>
            <div className="text-xs text-gray-500 font-bold">الجميع</div>
            <div className="text-base font-black">{products.length} صنف</div>
          </div>
        </button>

        <button
          onClick={() => setActivityFilter('CANTEEN')}
          className={`p-3.5 rounded-2xl border-2 transition-all flex items-center gap-3 text-right font-black ${
            activityFilter === 'CANTEEN'
              ? 'border-sky-600 bg-sky-50/70 text-sky-950 shadow-sm ring-2 ring-sky-500/20'
              : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
          }`}
        >
          <div className={`p-2.5 rounded-xl ${activityFilter === 'CANTEEN' ? 'bg-sky-600 text-white' : 'bg-sky-100 text-sky-700'}`}>
            <Store size={20} />
          </div>
          <div>
            <div className="text-xs text-sky-700 font-bold">الكانتين</div>
            <div className="text-base font-black">{canteenCount} صنف</div>
          </div>
        </button>

        <button
          onClick={() => setActivityFilter('BUFFET')}
          className={`p-3.5 rounded-2xl border-2 transition-all flex items-center gap-3 text-right font-black ${
            activityFilter === 'BUFFET'
              ? 'border-amber-600 bg-amber-50/70 text-amber-950 shadow-sm ring-2 ring-amber-500/20'
              : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
          }`}
        >
          <div className={`p-2.5 rounded-xl ${activityFilter === 'BUFFET' ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-800'}`}>
            <Coffee size={20} />
          </div>
          <div>
            <div className="text-xs text-amber-800 font-bold">البوفيه والمشروبات</div>
            <div className="text-base font-black">{buffetCount} صنف</div>
          </div>
        </button>

        <button
          onClick={() => setActivityFilter('SANDWICH')}
          className={`p-3.5 rounded-2xl border-2 transition-all flex items-center gap-3 text-right font-black ${
            activityFilter === 'SANDWICH'
              ? 'border-emerald-600 bg-emerald-50/70 text-emerald-950 shadow-sm ring-2 ring-emerald-500/20'
              : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
          }`}
        >
          <div className={`p-2.5 rounded-xl ${activityFilter === 'SANDWICH' ? 'bg-emerald-600 text-white' : 'bg-emerald-100 text-emerald-800'}`}>
            <UtensilsCrossed size={20} />
          </div>
          <div>
            <div className="text-xs text-emerald-800 font-bold">السندوتشات والمطبخ</div>
            <div className="text-base font-black">{sandwichCount} صنف</div>
          </div>
        </button>

        <button
          onClick={() => setActivityFilter('RAW_MATERIAL')}
          className={`p-3.5 rounded-2xl border-2 transition-all flex items-center gap-3 text-right font-black ${
            activityFilter === 'RAW_MATERIAL'
              ? 'border-slate-700 bg-slate-100 text-slate-900 shadow-sm ring-2 ring-slate-500/20'
              : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
          }`}
        >
          <div className={`p-2.5 rounded-xl ${activityFilter === 'RAW_MATERIAL' ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-700'}`}>
            <Package size={20} />
          </div>
          <div>
            <div className="text-xs text-slate-600 font-bold">المواد الخام</div>
            <div className="text-base font-black">{rawMaterialCount} مادة</div>
          </div>
        </button>
      </div>

      {/* Expiry & Low Stock Quick Notification Banner */}
      {(expiringSoonCount > 0 || expiredCount > 0) && (
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white p-4 rounded-2xl shadow-md flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-white/20 rounded-xl">
              <AlertTriangle size={24} className="text-white" />
            </span>
            <div>
              <h4 className="font-black text-sm sm:text-base">تنبيه تواريخ الصلاحية والتوالف ⚠️</h4>
              <p className="text-amber-100 text-xs font-bold">
                يوجد {expiredCount > 0 && <span className="bg-white/20 px-2 py-0.5 rounded font-black text-white">{expiredCount} صنف منتهي الصلاحية</span>}
                {expiredCount > 0 && expiringSoonCount > 0 && ' و '}
                {expiringSoonCount > 0 && <span className="bg-white/20 px-2 py-0.5 rounded font-black text-white">{expiringSoonCount} صنف أوشك على الانتهاء خلال 5 أيام</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {expiredCount > 0 && (
              <button 
                onClick={() => setFilterTab('EXPIRED')}
                className="bg-white text-rose-700 hover:bg-rose-50 font-black px-3.5 py-1.5 rounded-xl text-xs transition-colors shadow-sm"
              >
                عرض المنتهي ({expiredCount})
              </button>
            )}
            {expiringSoonCount > 0 && (
              <button 
                onClick={() => setFilterTab('EXPIRING_SOON')}
                className="bg-white text-amber-800 hover:bg-amber-50 font-black px-3.5 py-1.5 rounded-xl text-xs transition-colors shadow-sm"
              >
                عرض وشيك الانتهاء ({expiringSoonCount})
              </button>
            )}
          </div>
        </div>
      )}

      {/* Products Table Card */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border-2 border-gray-200 space-y-5">
        
        {/* Tabs Filter & Search Row */}
        <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between border-b border-gray-100 pb-4">
          
          {/* Status Filter Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setFilterTab('ALL')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                filterTab === 'ALL'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <span>جميع الأصناف</span>
              <span className={`px-2 py-0.5 rounded-full text-[11px] ${filterTab === 'ALL' ? 'bg-white/25 text-white' : 'bg-gray-200 text-gray-700'}`}>
                {currentDivisionProducts.length}
              </span>
            </button>

            <button
              onClick={() => setFilterTab('LOW_STOCK')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                filterTab === 'LOW_STOCK'
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-200'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
              }`}
            >
              <AlertTriangle size={14} />
              <span>نواقص المخزون</span>
              {lowStockCount > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-[11px] ${filterTab === 'LOW_STOCK' ? 'bg-white/25 text-white' : 'bg-amber-200 text-amber-900'}`}>
                  {lowStockCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setFilterTab('EXPIRING_SOON')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                filterTab === 'EXPIRING_SOON'
                  ? 'bg-orange-600 text-white shadow-md shadow-orange-200'
                  : 'bg-orange-50 text-orange-800 hover:bg-orange-100'
              }`}
            >
              <Clock size={14} />
              <span>أوشكت الصلاحية (خلال 5 أيام)</span>
              {expiringSoonCount > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-[11px] ${filterTab === 'EXPIRING_SOON' ? 'bg-white/25 text-white' : 'bg-orange-200 text-orange-900'}`}>
                  {expiringSoonCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setFilterTab('EXPIRED')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                filterTab === 'EXPIRED'
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-200'
                  : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
              }`}
            >
              <AlertTriangle size={14} />
              <span>منتهية الصلاحية</span>
              {expiredCount > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-[11px] ${filterTab === 'EXPIRED' ? 'bg-white/25 text-white' : 'bg-rose-200 text-rose-900'}`}>
                  {expiredCount}
                </span>
              )}
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full lg:w-80">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="بحث بالاسم، الكود، أو الباركود..." 
              className="w-full border-2 border-gray-200 rounded-xl pr-10 pl-4 py-2 outline-none focus:border-indigo-600 transition-all font-bold text-xs sm:text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

        </div>

        {/* Products Table */}
        <div className="overflow-x-auto rounded-2xl border-2 border-gray-100">
          <table className="w-full text-right border-collapse text-xs sm:text-sm">
            <thead className="bg-gray-50/80 text-gray-700 text-xs font-black">
              <tr>
                <th className="p-3.5 border-b">الكود</th>
                <th className="p-3.5 border-b">اسم الصنف والتصنيف</th>
                <th className="p-3.5 border-b">القسم ونوع الصنف</th>
                <th className="p-3.5 border-b">التكلفة (الشراء/المكونات)</th>
                <th className="p-3.5 border-b">سعر البيع والربح</th>
                <th className="p-3.5 border-b">المخزون المتوفر</th>
                <th className="p-3.5 border-b">حالة الصلاحية</th>
                <th className="p-3.5 border-b text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="text-gray-600 divide-y divide-gray-100 font-bold">
              {filteredProducts.map(p => {
                const isRecipe = p.productType === 'RECIPE';
                const isRaw = p.productType === 'RAW_MATERIAL';

                return (
                  <tr key={p.id} className={`hover:bg-indigo-50/30 transition-colors ${!p.isActive ? 'bg-gray-50 opacity-60' : ''}`}>
                    <td className="p-3.5 font-mono text-gray-600">{p.internalCode}</td>
                    
                    {/* Name & Barcode */}
                    <td className="p-3.5">
                      <div className="font-black text-gray-900 text-sm">{p.name}</div>
                      <div className="text-[11px] text-gray-400 font-mono mt-0.5 flex items-center gap-1">
                        <Barcode size={13} className="text-gray-400" />
                        <span>{p.barcode || 'بدون باركود'}</span>
                      </div>
                    </td>

                    {/* Division & Type Badges */}
                    <td className="p-3.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {p.activityType === 'CANTEEN' && (
                          <span className="bg-sky-50 text-sky-800 border border-sky-200 px-2.5 py-0.5 rounded-lg text-[11px] font-black inline-flex items-center gap-1">
                            <Store size={12} /> كانتين
                          </span>
                        )}
                        {p.activityType === 'BUFFET' && (
                          <span className="bg-amber-50 text-amber-900 border border-amber-200 px-2.5 py-0.5 rounded-lg text-[11px] font-black inline-flex items-center gap-1">
                            <Coffee size={12} /> بوفيه
                          </span>
                        )}
                        {p.activityType === 'SANDWICH' && (
                          <span className="bg-emerald-50 text-emerald-900 border border-emerald-200 px-2.5 py-0.5 rounded-lg text-[11px] font-black inline-flex items-center gap-1">
                            <UtensilsCrossed size={12} /> سندوتشات
                          </span>
                        )}

                        {isRecipe && (
                          <span className="bg-purple-100 text-purple-900 border border-purple-300 px-2 py-0.5 rounded-lg text-[10px] font-black inline-flex items-center gap-1">
                            <ChefHat size={11} /> صنف مركب
                          </span>
                        )}
                        {isRaw && (
                          <span className="bg-slate-100 text-slate-800 border border-slate-300 px-2 py-0.5 rounded-lg text-[10px] font-black inline-flex items-center gap-1">
                            <Package size={11} /> مادة خام
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Purchase Price / Recipe Cost */}
                    <td className="p-3.5">
                      <div className="font-mono text-gray-800 font-black">
                        {Number(p.effectiveCost || p.purchasePrice || 0).toFixed(2)} ج.م
                      </div>
                      {isRecipe && (
                        <div className="text-[10px] text-purple-700 font-bold">
                          تكلفة المكونات للحصة
                        </div>
                      )}
                    </td>

                    {/* Selling Price & Unit Profit */}
                    <td className="p-3.5">
                      {isRaw ? (
                        <span className="text-gray-400 font-bold text-xs bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-lg inline-block">
                          — مادة خام (تصنيع)
                        </span>
                      ) : (
                        <>
                          <div className="flex items-center gap-1.5">
                            <span className="font-black text-emerald-600 font-mono text-sm">
                              {Number(p.sellingPrice || 0).toFixed(2)} ج.م
                            </span>
                            {/* تعديل سعر البيع: للبوفيه والسندوتشات متاح للأدمن فقط */}
                            {((p.activityType === 'BUFFET' || p.activityType === 'SANDWICH') ? isAdmin : hasPermission('MANAGE_PRODUCTS')) && (
                              <button
                                type="button"
                                onClick={() => handleOpenQuickPrice(p)}
                                className="text-gray-400 hover:text-emerald-700 hover:bg-emerald-50 p-1 rounded-lg transition-colors"
                                title="تعديل سريع لسعر البيع فقط ⚡"
                              >
                                <Edit3 size={13} />
                              </button>
                            )}
                          </div>
                          <div className="text-[11px] text-emerald-700 font-black mt-0.5">
                            ربح: +{Number(p.profitPerUnit || 0).toFixed(2)} ({p.profitMargin || 0}%)
                          </div>
                        </>
                      )}
                    </td>
                    
                    {/* Stock & Portions */}
                    <td className="p-3.5">
                      {isRecipe ? (
                        <div className="space-y-0.5">
                          <span className="text-base text-purple-900 font-black">{p.totalStock}</span>{' '}
                          <span className="text-xs font-bold text-purple-700">حصة جاهزة للتحضير</span>
                          <div className="text-[10px] text-gray-500 font-normal">
                            محسوبة آلياً من رصيد المواد الخام
                          </div>
                        </div>
                      ) : (
                        <div>
                          <span className="text-base text-gray-900 font-black">{p.totalStock}</span>{' '}
                          <span className="text-xs font-normal text-gray-500">{p.unit || 'قطعة'}</span>
                          <div className="mt-1">
                            {p.totalStock < 0 ? (
                              <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded-full text-[10px] font-black border border-red-200">سالب ({p.totalStock})</span>
                            ) : p.totalStock === 0 ? (
                              <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded-full text-[10px] font-black border border-red-200">نفد من المخزون</span>
                            ) : p.totalStock <= p.alertThreshold ? (
                              <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-[10px] font-black border border-amber-200">نواقص</span>
                            ) : (
                              <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-[10px] font-black border border-emerald-200">متوفر</span>
                            )}
                          </div>
                        </div>
                      )}
                    </td>

                    {/* Expiry Date Column */}
                    <td className="p-3.5">
                      {p.effectiveExpiryDate ? (
                        <div className="space-y-1">
                          <div className="font-mono text-xs font-black text-gray-800 flex items-center gap-1">
                            <Calendar size={13} className="text-gray-400" />
                            <span>{new Date(p.effectiveExpiryDate).toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' })}</span>
                          </div>
                          <div>
                            {p.isExpired ? (
                              <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-[11px] font-black border border-red-200 inline-flex items-center gap-1">
                                <AlertTriangle size={11} /> منتهي ({Math.abs(p.daysUntilExpiry)} يوم مضت)
                              </span>
                            ) : p.isExpiringSoon ? (
                              <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-[11px] font-black border border-amber-200 inline-flex items-center gap-1">
                                <Clock size={11} /> وشيك ({p.daysUntilExpiry} يوم)
                              </span>
                            ) : (
                              <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full text-[11px] font-bold border border-emerald-200">
                                صالح ({p.daysUntilExpiry} يوم)
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs font-bold bg-gray-50 px-2 py-0.5 rounded-lg border border-gray-100">غير محدد</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5 flex-wrap">
                        {isRecipe && (
                          <button 
                            onClick={() => setViewRecipeModal(p)} 
                            className="px-2.5 py-1.5 bg-purple-50 text-purple-800 hover:bg-purple-100 border border-purple-200 rounded-xl font-black text-xs flex items-center gap-1 transition-colors"
                            title="عرض مكونات الوصفة"
                          >
                            <Eye size={13} />
                            الوصفة
                          </button>
                        )}
                        {((p.activityType === 'BUFFET' || p.activityType === 'SANDWICH') ? isAdmin : hasPermission('MANAGE_PRODUCTS')) && (
                          <button 
                            onClick={() => openEditModal(p)} 
                            className="px-2.5 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-xl font-black text-xs flex items-center gap-1 transition-colors"
                          >
                            <Edit3 size={13} />
                            تعديل
                          </button>
                        )}
                        {!isRecipe && hasPermission('MANAGE_INVENTORY') && (
                          <button 
                            onClick={() => openAdjustModal(p)} 
                            className="px-2.5 py-1.5 bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 rounded-xl font-black text-xs flex items-center gap-1 transition-colors"
                          >
                            <SlidersHorizontal size={13} />
                            تسوية
                          </button>
                        )}
                        {hasPermission('MANAGE_PRODUCTS') && (
                          <button 
                            onClick={() => handleOpenDelete(p)} 
                            className="px-2.5 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 rounded-xl font-black text-xs flex items-center gap-1 transition-colors"
                            title="حذف الصنف نهائياً"
                          >
                            <Trash2 size={13} />
                            حذف
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan="8" className="p-12 text-center text-gray-400 font-bold">
                    لا توجد أصناف مطابقة للبحث أو القسم المحدد
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= Product Modal (Add / Edit) ================= */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl p-7 w-full max-w-xl border border-gray-100 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-gray-100">
              <h3 className="text-xl font-black text-gray-800 flex items-center gap-2">
                {isEditMode ? (
                  <>
                    <Edit3 className="text-amber-600" size={24} />
                    <span>تعديل بيانات الصنف والقسم</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="text-indigo-600" size={24} />
                    <span>إضافة صنف جديد للمنظومة</span>
                  </>
                )}
              </h3>
              <button 
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Activity Division Selector (3 Categories) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-gray-700">
                  تابع لأي قسم بالمنظومة؟ <span className="text-red-500">*</span>:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, activityType: 'CANTEEN' })}
                    className={`py-2.5 px-3 rounded-xl border-2 font-black text-xs flex items-center justify-center gap-1.5 transition-all ${
                      form.activityType === 'CANTEEN'
                        ? 'border-sky-600 bg-sky-50 text-sky-800 shadow-sm'
                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Store size={15} />
                    <span>🏪 الكانتين</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setForm({ ...form, activityType: 'BUFFET' })}
                    className={`py-2.5 px-3 rounded-xl border-2 font-black text-xs flex items-center justify-center gap-1.5 transition-all ${
                      form.activityType === 'BUFFET'
                        ? 'border-amber-600 bg-amber-50 text-amber-900 shadow-sm'
                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Coffee size={15} />
                    <span>☕ البوفيه</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setForm({ ...form, activityType: 'SANDWICH' })}
                    className={`py-2.5 px-3 rounded-xl border-2 font-black text-xs flex items-center justify-center gap-1.5 transition-all ${
                      form.activityType === 'SANDWICH'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-sm'
                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <UtensilsCrossed size={15} />
                    <span>🍔 السندوتشات</span>
                  </button>
                </div>
              </div>

              {/* Product Type Selector */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-gray-700">
                  نوع الصنف وطبيعة تشغيله:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, productType: 'SIMPLE' })}
                    className={`py-2 px-2 rounded-xl border-2 font-bold text-xs flex items-center justify-center gap-1 transition-all ${
                      form.productType === 'SIMPLE'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-900'
                        : 'border-gray-200 bg-white text-gray-600'
                    }`}
                  >
                    <span>صنف عادي جاهز</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setForm({ ...form, productType: 'RECIPE' })}
                    className={`py-2 px-2 rounded-xl border-2 font-bold text-xs flex items-center justify-center gap-1 transition-all ${
                      form.productType === 'RECIPE'
                        ? 'border-purple-600 bg-purple-50 text-purple-900'
                        : 'border-gray-200 bg-white text-gray-600'
                    }`}
                  >
                    <ChefHat size={14} />
                    <span>مركب / وصفة</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setForm({ ...form, productType: 'RAW_MATERIAL' })}
                    className={`py-2 px-2 rounded-xl border-2 font-bold text-xs flex items-center justify-center gap-1 transition-all ${
                      form.productType === 'RAW_MATERIAL'
                        ? 'border-slate-700 bg-slate-100 text-slate-900'
                        : 'border-gray-200 bg-white text-gray-600'
                    }`}
                  >
                    <Package size={14} />
                    <span>مادة خام</span>
                  </button>
                </div>
              </div>

              {/* Product Name */}
              <div>
                <label className="block mb-1 text-xs font-bold text-gray-700">
                  اسم الصنف <span className="text-red-500">*</span>:
                </label>
                <input 
                  required
                  autoFocus
                  type="text" 
                  placeholder={form.productType === 'RAW_MATERIAL' ? 'مثال: سكر أبيض بالكيلو / بن محوج' : 'مثال: شيبسي عائلي / شاي فتلة / برجر لحم'}
                  className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-indigo-600 font-bold text-gray-800"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                />
              </div>

              {/* Barcode & Internal Code */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1 text-xs font-bold text-gray-700">الباركود:</label>
                  <input 
                    type="text" 
                    placeholder="امسح أو اكتب الباركود"
                    className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-indigo-600 font-bold text-gray-800 font-mono"
                    value={form.barcode}
                    onChange={e => setForm({ ...form, barcode: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block mb-1 text-xs font-bold text-gray-700">
                    الكود الداخلي <span className="text-red-500">*</span>:
                  </label>
                  <input 
                    required
                    type="text" 
                    className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-indigo-600 font-bold text-gray-800 font-mono"
                    value={form.internalCode}
                    onChange={e => setForm({ ...form, internalCode: e.target.value })}
                  />
                </div>
              </div>

              {/* Purchase & Selling Price */}
              <div className="grid grid-cols-2 gap-4">
                {form.productType === 'RAW_MATERIAL' ? (
                  <div className="col-span-2 space-y-2">
                    <label className="block mb-1 text-xs font-bold text-gray-700">سعر شراء الوحدة من المورد (ج.م) *:</label>
                    <input 
                      required
                      type="number" 
                      step="0.01" 
                      min="0"
                      placeholder="0.00"
                      className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-indigo-600 font-black text-indigo-700 text-base"
                      value={form.purchasePrice}
                      onChange={e => setForm({ ...form, purchasePrice: e.target.value })}
                    />
                    <div className="text-[11px] text-gray-500 font-bold bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center gap-1.5">
                      <Package size={14} className="text-slate-600 shrink-0" />
                      <span>📦 مادة خام للتشغيل والتصنيع فقط (لا تباع للمرضى مباشرة - ليس لها سعر بيع).</span>
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block mb-1 text-xs font-bold text-gray-700">
                        {form.productType === 'RECIPE' ? 'تكلفة المكونات (ج.م) [يحسب آلياً]:' : 'سعر الشراء (ج.م):'}
                      </label>
                      <input 
                        type="number" 
                        step="0.01" 
                        min="0"
                        placeholder="0.00"
                        className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-indigo-600 font-black text-indigo-700 text-base"
                        value={form.purchasePrice}
                        onChange={e => setForm({ ...form, purchasePrice: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block mb-1 text-xs font-bold text-gray-700">
                        سعر البيع للمريض (ج.م) *:
                      </label>
                      <input 
                        required
                        type="number" 
                        step="0.01" 
                        min="0"
                        placeholder="0.00"
                        className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-indigo-600 font-black text-emerald-600 text-base"
                        value={form.sellingPrice}
                        onChange={e => setForm({ ...form, sellingPrice: e.target.value })}
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Unit & Alert Threshold */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1 text-xs font-bold text-gray-700">الوحدة الأساسية:</label>
                  <input 
                    type="text" 
                    placeholder={form.productType === 'RAW_MATERIAL' ? 'كيلو / فتلة / كوب / قطعة' : 'قطعة / كيس / زجاجة / كوب'}
                    className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-indigo-600 font-bold text-gray-800"
                    value={form.unit}
                    onChange={e => setForm({ ...form, unit: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block mb-1 text-xs font-bold text-gray-700">حد التنبيه للنقص بالمخزن:</label>
                  <input 
                    type="number" 
                    min="0"
                    placeholder="10"
                    className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-indigo-600 font-bold text-gray-800"
                    value={form.alertThreshold}
                    onChange={e => setForm({ ...form, alertThreshold: e.target.value })}
                  />
                </div>
              </div>

              {/* Expiry Date Field (Optional) */}
              <div className="p-4 bg-amber-50/60 rounded-2xl border-2 border-amber-100 space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                    <Calendar size={15} className="text-amber-600" />
                    <span>تاريخ انتهاء الصلاحية:</span>
                  </label>
                  <span className="text-[11px] font-black text-amber-700 bg-amber-100 px-2 py-0.5 rounded-lg border border-amber-200">
                    اختياري
                  </span>
                </div>
                <input 
                  type="date"
                  className="w-full border-2 border-amber-200 rounded-xl p-2.5 outline-none focus:border-amber-500 font-bold text-gray-800 bg-white"
                  value={form.expiryDate}
                  onChange={e => setForm({ ...form, expiryDate: e.target.value })}
                />
                <p className="text-[11px] text-amber-700/80 font-bold">
                  اتركه فارغاً إذا كان الصنف غير محدد الصلاحية، أو حدد التاريخ ليظهر تنبيه عند اقترابه (5 أيام أو أقل).
                </p>
              </div>

              {/* Active Toggle in Edit Mode */}
              {isEditMode && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <input 
                    type="checkbox" 
                    id="isActive" 
                    checked={form.isActive} 
                    onChange={e => setForm({ ...form, isActive: e.target.checked })} 
                    className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer" 
                  />
                  <label htmlFor="isActive" className="font-bold text-gray-700 cursor-pointer text-sm">
                    الصنف نشط (يظهر في شاشة البيع POS)
                  </label>
                </div>
              )}

              {/* Modal Actions */}
              <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl font-bold text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  إلغاء
                </button>
                <button 
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2.5 rounded-xl font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200 disabled:opacity-50 transition-colors"
                >
                  {isSaving ? 'جاري الحفظ...' : isEditMode ? 'تحديث الصنف' : 'حفظ الصنف'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= View Recipe Modal ================= */}
      {viewRecipeModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl p-7 w-full max-w-xl border border-gray-100 max-h-[90vh] overflow-y-auto space-y-5">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-xl font-black text-gray-800 flex items-center gap-2">
                  <ChefHat className="text-purple-600" size={24} />
                  <span>مكونات ووصفة: {viewRecipeModal.name}</span>
                </h3>
                <p className="text-xs text-gray-500 font-bold mt-1">
                  شجرة المكونات وتفاصيل الخصم المخزني التلقائي من المواد الخام
                </p>
              </div>
              <button 
                onClick={() => setViewRecipeModal(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            {/* Recipe Ingredients Table */}
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-right text-xs">
                <thead className="bg-purple-50/70 text-purple-950 font-black">
                  <tr>
                    <th className="p-3 border-b">المادة الخام</th>
                    <th className="p-3 border-b">الحصة لكل وحدة</th>
                    <th className="p-3 border-b">سعر شراء الخامة</th>
                    <th className="p-3 border-b">تكلفة الحصة</th>
                    <th className="p-3 border-b">الرصيد المتاح بالمخزن</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-bold text-gray-700">
                  {(viewRecipeModal.recipeStats?.ingredientsWithStats || []).map(ing => (
                    <tr key={ing.id} className="hover:bg-gray-50">
                      <td className="p-3">
                        <div className="font-black text-gray-900">{ing.rawMaterialName}</div>
                        <div className="text-[10px] text-gray-400 font-mono">{ing.rawMaterialCode}</div>
                      </td>
                      <td className="p-3 font-mono font-black text-purple-700">
                        {ing.quantityPerUnit} {ing.rawMaterialUnit}
                      </td>
                      <td className="p-3 font-mono">
                        {Number(ing.rawMaterialPurchasePrice).toFixed(2)} ج.م
                      </td>
                      <td className="p-3 font-mono font-black text-indigo-700">
                        {Number(ing.itemCost).toFixed(2)} ج.م
                      </td>
                      <td className="p-3 font-mono">
                        <span className={`px-2 py-0.5 rounded-lg text-xs font-black ${
                          ing.rawMaterialStock <= 0 
                            ? 'bg-red-100 text-red-800' 
                            : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {ing.rawMaterialStock} {ing.rawMaterialUnit}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {(!viewRecipeModal.recipeStats?.ingredientsWithStats || viewRecipeModal.recipeStats.ingredientsWithStats.length === 0) && (
                    <tr>
                      <td colSpan="5" className="p-6 text-center text-gray-400 font-bold">
                        لم يتم تعيين مكونات تفصيلية لهذه الوصفة بعد
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Summary Statistics Card */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50 p-4 rounded-2xl border border-gray-200 text-center">
              <div>
                <div className="text-[11px] text-gray-500 font-bold">إجمالي تكلفة المكونات</div>
                <div className="text-base font-black text-purple-700 font-mono">
                  {Number(viewRecipeModal.effectiveCost || 0).toFixed(2)} ج.م
                </div>
              </div>
              <div>
                <div className="text-[11px] text-gray-500 font-bold">سعر البيع للمريض</div>
                <div className="text-base font-black text-emerald-600 font-mono">
                  {Number(viewRecipeModal.sellingPrice || 0).toFixed(2)} ج.م
                </div>
              </div>
              <div>
                <div className="text-[11px] text-gray-500 font-bold">صافي ربح الحصة</div>
                <div className="text-base font-black text-emerald-700 font-mono">
                  +{Number(viewRecipeModal.profitPerUnit || 0).toFixed(2)} ({viewRecipeModal.profitMargin || 0}%)
                </div>
              </div>
              <div>
                <div className="text-[11px] text-gray-500 font-bold">الحصص الممكن تحضيرها</div>
                <div className="text-base font-black text-indigo-700 font-mono">
                  {viewRecipeModal.totalStock} حصة
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setViewRecipeModal(null)}
                className="px-6 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Adjust Inventory Modal */}
      {adjustModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl p-7 w-full max-w-sm border border-gray-100">
            <h3 className="text-xl font-black mb-5 text-gray-800 border-b border-gray-100 pb-3 flex items-center gap-2">
              <SlidersHorizontal className="text-purple-600" size={22} />
              <span>تسوية المخزون</span>
            </h3>
            <form onSubmit={handleAdjustSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block mb-1 text-xs font-bold text-gray-700">نوع الحركة:</label>
                <select 
                  className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-purple-600 font-bold bg-white" 
                  value={adjustForm.type} 
                  onChange={e => setAdjustForm({ ...adjustForm, type: e.target.value })}
                >
                  <option value="IN">إضافة للمخزون (+ وارد / تسوية عجز)</option>
                  <option value="OUT">خصم من المخزون (- هالك / تالف)</option>
                </select>
              </div>
              <div>
                <label className="block mb-1 text-xs font-bold text-gray-700">الكمية:</label>
                <input 
                  required
                  type="number" 
                  step="any"
                  min="0.001"
                  className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-purple-600 font-bold" 
                  placeholder="0" 
                  value={adjustForm.quantity} 
                  onChange={e => setAdjustForm({ ...adjustForm, quantity: e.target.value })} 
                />
              </div>
              <div>
                <label className="block mb-1 text-xs font-bold text-gray-700">السبب / الملاحظات:</label>
                <input 
                  required
                  type="text" 
                  className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-purple-600 font-bold" 
                  placeholder="مثال: جرد دوري، تالف..." 
                  value={adjustForm.reason} 
                  onChange={e => setAdjustForm({ ...adjustForm, reason: e.target.value })} 
                />
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <button 
                  type="button" 
                  onClick={() => setAdjustModal(false)} 
                  className="px-5 py-2.5 rounded-xl font-bold text-gray-600 hover:bg-gray-100"
                >
                  إلغاء
                </button>
                <button 
                  type="submit" 
                  className="px-6 py-2.5 rounded-xl font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-200"
                >
                  تنفيذ التسوية
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Price Edit Modal */}
      {quickPriceModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-sm border border-gray-100 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
                  <DollarSign size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-800">تعديل سريع لسعر البيع ⚡</h3>
                  <p className="text-xs text-gray-500 font-bold">{quickPriceModal.name}</p>
                </div>
              </div>
              <button 
                onClick={() => setQuickPriceModal(null)} 
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveQuickPrice} className="space-y-4">
              <div>
                <label className="block mb-1.5 text-xs font-bold text-gray-700">
                  سعر البيع الجديد للمريض/العميل (ج.م):
                </label>
                <div className="relative">
                  <input
                    required
                    autoFocus
                    type="number"
                    step="0.5"
                    min="0"
                    className="w-full border-2 border-emerald-500 rounded-2xl p-3.5 pr-4 pl-12 outline-none font-black text-2xl text-emerald-600 text-center bg-emerald-50/20 focus:bg-white transition-all"
                    value={newSellingPrice}
                    onChange={e => setNewSellingPrice(e.target.value)}
                  />
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-sm text-gray-400">
                    ج.م
                  </span>
                </div>
                <div className="text-[11px] text-gray-400 font-bold mt-1 text-center">
                  السعر القديم: {Number(quickPriceModal.sellingPrice).toFixed(2)} ج.م
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setQuickPriceModal(null)}
                  className="flex-1 py-2.5 rounded-xl font-bold text-gray-600 hover:bg-gray-100 transition-colors text-xs"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-200 transition-colors text-xs flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 size={16} />
                  <span>تأكيد وحفظ السعر</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Product Confirmation / Stock Warning Modal */}
      {deleteTarget && (() => {
        const directStock = Number(deleteTarget.directStock !== undefined ? deleteTarget.directStock : deleteTarget.totalStock || 0);
        const hasStock = directStock > 0 && deleteTarget.productType !== 'RECIPE';

        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-md border border-gray-100 space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2.5 rounded-2xl ${hasStock ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-700'}`}>
                    {hasStock ? <AlertTriangle size={22} /> : <Trash2 size={22} />}
                  </div>
                  <div>
                    <h3 className="text-base font-black text-gray-900">
                      {hasStock ? 'تحذير: لا يمكن حذف الصنف!' : 'تأكيد حذف الصنف نهائياً'}
                    </h3>
                    <p className="text-xs text-gray-500 font-bold">{deleteTarget.name} ({deleteTarget.internalCode})</p>
                  </div>
                </div>
                <button 
                  onClick={() => setDeleteTarget(null)} 
                  className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
                >
                  <X size={20} />
                </button>
              </div>

              {hasStock ? (
                <div className="space-y-3">
                  <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-2xl space-y-2">
                    <div className="flex items-center gap-2 text-amber-900 font-black text-sm">
                      <AlertTriangle size={18} className="text-amber-700 shrink-0" />
                      <span>الصنف يحتوي على رصيد متبقي بالمخزن!</span>
                    </div>
                    <p className="text-xs text-amber-800 font-bold leading-relaxed">
                      الرصيد الفعلي بالمخزن: <span className="font-black font-mono text-amber-950 text-sm underline">{directStock} {deleteTarget.unit || 'قطعة'}</span>
                    </p>
                    <p className="text-[11px] text-amber-700 font-medium leading-relaxed">
                      حفاظاً على سلامة الجرد والأرصدة المحاسبية، يمنع النظام تماماً حذف أي صنف يحتوي على كميات بالمخزن. يرجى تصفير أو تسوية رصيد الصنف أولاً قبل حذفه.
                    </p>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(null)}
                      className="flex-1 py-2.5 rounded-xl font-bold text-gray-600 hover:bg-gray-100 transition-colors text-xs"
                    >
                      إلغاء
                    </button>
                    {hasPermission('MANAGE_INVENTORY') && (
                      <button
                        type="button"
                        onClick={() => {
                          const target = deleteTarget;
                          setDeleteTarget(null);
                          openAdjustModal(target);
                        }}
                        className="flex-1 py-2.5 rounded-xl font-black bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-200 transition-colors text-xs flex items-center justify-center gap-1.5"
                      >
                        <SlidersHorizontal size={14} />
                        <span>الذهاب لتسوية الرصيد</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-4 bg-red-50/80 border border-red-200 rounded-2xl space-y-2">
                    <p className="text-xs text-red-900 font-bold leading-relaxed">
                      هل أنت متأكد من رغبتك في حذف الصنف <span className="font-black text-red-950">"{deleteTarget.name}"</span> نهائياً؟
                    </p>
                    <div className="text-[11px] text-gray-600 font-medium">
                      • رصيد المخزن الحالي: <span className="font-bold text-emerald-700 font-mono">0 (مسموح بالحذف)</span>
                    </div>
                    <div className="text-[11px] text-gray-500 font-medium">
                      • سيتم إزالة الصنف بالكامل من قوائم البيع والتقارير الحالية.
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={() => setDeleteTarget(null)}
                      className="flex-1 py-2.5 rounded-xl font-bold text-gray-600 hover:bg-gray-100 transition-colors text-xs"
                    >
                      تراجع
                    </button>
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={handleConfirmDelete}
                      className="flex-1 py-2.5 rounded-xl font-black bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-200 transition-colors text-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {isDeleting ? (
                        <span>جاري الحذف...</span>
                      ) : (
                        <>
                          <Trash2 size={15} />
                          <span>تأكيد الحذف نهائياً</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Hot Drinks Recipe Modal */}
      <HotDrinksRecipeModal
        isOpen={hotDrinkModalOpen}
        onClose={() => { setHotDrinkModalOpen(false); setEditingHotDrink(null); }}
        onSuccess={fetchProducts}
        initialRecipe={editingHotDrink}
      />

    </div>
  );
};

export default ProductsPage;
