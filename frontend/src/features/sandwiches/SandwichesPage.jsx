import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import client from '../../api/client';
import { useAuth } from '../auth/AuthContext';
import { 
  UtensilsCrossed, Plus, Search, Edit3, Eye, Trash2, 
  ChefHat, Sparkles, CheckCircle2, AlertTriangle, Package, 
  DollarSign, Calculator, Layers, X, Info, Flame
} from 'lucide-react';

const SandwichesPage = () => {
  const [searchParams] = useSearchParams();
  const [sandwiches, setSandwiches] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const { hasPermission } = useAuth();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSandwich, setEditingSandwich] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [viewRecipeModal, setViewRecipeModal] = useState(null);

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Sandwich Form State
  const [form, setForm] = useState({
    name: '',
    internalCode: '',
    barcode: '',
    sellingPrice: 35,
    recipeNotes: '',
    // Base ingredient (المكون الأساسي: برجر / ستربس)
    baseRawMaterialId: '',
    basePiecesCount: 20, // عدد القطع الأساسية المشتراة
    // Additional ingredients (طماطم، عيش، صوصات...)
    additionalIngredients: []
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [prodsRes, rawRes] = await Promise.all([
        client.get('/products?activityType=SANDWICH'),
        client.get('/products/raw-materials')
      ]);
      const loadedSandwiches = prodsRes.data.data.filter(p => p.productType === 'RECIPE');
      const loadedRaw = rawRes.data.data || [];
      setSandwiches(loadedSandwiches);
      setRawMaterials(loadedRaw);

      // Auto-open edit modal if ?edit=ID passed in URL
      const editId = searchParams.get('edit');
      if (editId) {
        const target = loadedSandwiches.find(s => s.id === Number(editId));
        if (target) {
          openEditModal(target);
        }
      }
    } catch (err) {
      toast.error('فشل تحميل بيانات السندوتشات والمطبخ');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestDelete = (sandwich) => {
    setDeleteTarget(sandwich);
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
      toast.success(res.data?.message || `تم حذف السندوتش (${deleteTarget.name}) بنجاح`);
      setDeleteTarget(null);
      loadData();
    } catch (err) {
      const errMsg = err.response?.data?.message || 'فشل حذف السندوتش';
      toast.error(errMsg);
    } finally {
      setIsDeleting(false);
    }
  };

  const applyPreset = (type) => {
    const burger = rawMaterials.find(r => r.name.includes('برجر'));
    const strips = rawMaterials.find(r => r.name.includes('ستربس'));
    const bun = rawMaterials.find(r => r.name.includes('كايزر') || r.name.includes('برجر'));
    const fino = rawMaterials.find(r => r.name.includes('فينو'));
    const veg = rawMaterials.find(r => r.name.includes('خضار') || r.name.includes('طماطم'));

    if (type === 'BURGER') {
      const extras = [];
      if (bun) extras.push({ rawMaterialId: bun.id, batchQuantity: 20, notes: '1 رغيف لكل سندوتش' });
      if (veg) extras.push({ rawMaterialId: veg.id, batchQuantity: 1, notes: '1 كجم خضار وسلطة لـ 20 سندوتش' });

      setForm(prev => ({
        ...prev,
        name: 'سندوتش برجر',
        baseRawMaterialId: burger ? burger.id : prev.baseRawMaterialId,
        basePiecesCount: 20,
        sellingPrice: 35,
        recipeNotes: '20 قطعة برجر + 20 عيش كايزر + 1 كجم خضار = 20 سندوتش برجر',
        additionalIngredients: extras
      }));
      toast.success('تم تطبيق معادلة سندوتش البرجر (20 سندوتش)');
    } else if (type === 'STRIPS') {
      const extras = [];
      if (fino) extras.push({ rawMaterialId: fino.id, batchQuantity: 20, notes: '1 رغيف لكل سندوتش' });
      if (veg) extras.push({ rawMaterialId: veg.id, batchQuantity: 1, notes: '1 كجم خضار وسلطة لـ 20 سندوتش' });

      setForm(prev => ({
        ...prev,
        name: 'سندوتش ستربس',
        baseRawMaterialId: strips ? strips.id : prev.baseRawMaterialId,
        basePiecesCount: 20,
        sellingPrice: 30,
        recipeNotes: '20 قطعة ستربس + 20 عيش فينو + 1 كجم خضار = 20 سندوتش ستربس',
        additionalIngredients: extras
      }));
      toast.success('تم تطبيق معادلة سندوتش الستربس (20 سندوتش)');
    }
  };

  const openCreateModal = () => {
    const autoCode = `SND-${Date.now().toString().slice(-5)}`;
    // Find a good default base material if exists (burger, strips)
    const defaultBase = rawMaterials.find(r => 
      r.name.includes('برجر') || r.name.includes('ستربس') || r.name.includes('لحم') || r.name.includes('دجاج')
    ) || rawMaterials[0];

    // Find default bun if exists
    const defaultBun = rawMaterials.find(r => 
      r.name.includes('عيش') || r.name.includes('خبز') || r.name.includes('كايزر')
    );

    const initialExtras = [];
    if (defaultBun) {
      initialExtras.push({
        rawMaterialId: defaultBun.id,
        batchQuantity: 20,
        notes: '1 رغيف لكل سندوتش'
      });
    }

    setEditingSandwich(null);
    setForm({
      name: '',
      internalCode: autoCode,
      barcode: '',
      sellingPrice: 35,
      recipeNotes: '',
      baseRawMaterialId: defaultBase ? defaultBase.id : '',
      basePiecesCount: 20,
      additionalIngredients: initialExtras
    });
    setIsModalOpen(true);
  };

  const openEditModal = (sandwich) => {
    setEditingSandwich(sandwich);
    const yieldCount = Number(sandwich.recipeYield || 20);
    const ings = sandwich.recipeStats?.ingredientsWithStats || sandwich.ingredients || [];

    // First ingredient is treated as base ingredient
    const baseIng = ings[0] || {};
    const extraIngs = ings.slice(1);

    setForm({
      id: sandwich.id,
      name: sandwich.name || '',
      internalCode: sandwich.internalCode || '',
      barcode: sandwich.barcode || '',
      sellingPrice: sandwich.sellingPrice || 35,
      recipeNotes: sandwich.recipeNotes || '',
      baseRawMaterialId: baseIng.rawMaterialId || '',
      basePiecesCount: yieldCount,
      additionalIngredients: extraIngs.map(ing => ({
        rawMaterialId: ing.rawMaterialId,
        batchQuantity: Number(ing.quantityPerUnit || 0) * yieldCount,
        notes: ing.notes || ''
      }))
    });
    setIsModalOpen(true);
  };

  const handleAddExtra = () => {
    if (rawMaterials.length === 0) return toast.error('لا توجد مواد خام مسجلة بالمخزن');
    setForm(prev => ({
      ...prev,
      additionalIngredients: [
        ...prev.additionalIngredients,
        {
          rawMaterialId: rawMaterials[0].id,
          batchQuantity: 1,
          notes: ''
        }
      ]
    }));
  };

  const handleUpdateExtra = (index, field, value) => {
    setForm(prev => {
      const updated = [...prev.additionalIngredients];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, additionalIngredients: updated };
    });
  };

  const handleRemoveExtra = (index) => {
    setForm(prev => ({
      ...prev,
      additionalIngredients: prev.additionalIngredients.filter((_, i) => i !== index)
    }));
  };

  // Calculations for Sandwich Maker Modal
  const baseCount = Number(form.basePiecesCount) > 0 ? Number(form.basePiecesCount) : 1;
  const baseRaw = rawMaterials.find(r => r.id === Number(form.baseRawMaterialId));
  const baseRawPrice = baseRaw ? Number(baseRaw.purchasePrice || 0) : 0;
  const baseRawStock = baseRaw ? Number(baseRaw.totalStock || 0) : 0;

  // Base piece cost per sandwich = 1 * baseRawPrice
  const baseCostTotal = baseCount * baseRawPrice;
  const baseCostPerSandwich = baseRawPrice;

  // Additional ingredients cost calculation
  let extrasCostTotal = 0;
  let maxPossibleSandwiches = baseRawStock; // Constrained initially by base pieces

  const extrasWithStats = form.additionalIngredients.map(extra => {
    const raw = rawMaterials.find(r => r.id === Number(extra.rawMaterialId));
    const rawPrice = raw ? Number(raw.purchasePrice || 0) : 0;
    const rawStock = raw ? Number(raw.totalStock || 0) : 0;
    const batchQty = Number(extra.batchQuantity || 0);
    const qtyPerSandwich = batchQty / baseCount;
    const itemCostTotal = batchQty * rawPrice;
    const itemCostPerSandwich = qtyPerSandwich * rawPrice;

    extrasCostTotal += itemCostTotal;

    if (qtyPerSandwich > 0) {
      const possibleFromThis = Math.floor(rawStock / qtyPerSandwich);
      if (possibleFromThis < maxPossibleSandwiches) {
        maxPossibleSandwiches = possibleFromThis;
      }
    }

    return {
      ...extra,
      raw,
      rawPrice,
      rawStock,
      qtyPerSandwich,
      itemCostTotal,
      itemCostPerSandwich
    };
  });

  const totalBatchCost = baseCostTotal + extrasCostTotal;
  const costPerSandwich = Number((totalBatchCost / baseCount).toFixed(2));
  const sellingPrice = Number(form.sellingPrice || 0);
  const profitPerSandwich = Number((sellingPrice - costPerSandwich).toFixed(2));
  const profitMargin = sellingPrice > 0 ? Number(((profitPerSandwich / sellingPrice) * 100).toFixed(1)) : 0;

  if (maxPossibleSandwiches < 0 || (!baseRaw && form.additionalIngredients.length === 0)) {
    maxPossibleSandwiches = 0;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || form.name.trim() === '') {
      return toast.error('يرجى تحديد اسم السندوتش');
    }
    if (!form.baseRawMaterialId) {
      return toast.error('يرجى اختيار المكون الأساسي للسندوتش (مثل قطع البرجر أو الستربس)');
    }

    setIsSaving(true);
    try {
      // 1 base ingredient (1 piece per sandwich) + extras
      const allIngredients = [
        {
          rawMaterialId: Number(form.baseRawMaterialId),
          quantityPerUnit: 1, // قطعة واحدة لكل سندوتش
          batchQuantity: baseCount,
          notes: 'المكون الأساسي للسندوتش'
        },
        ...form.additionalIngredients.map(extra => ({
          rawMaterialId: Number(extra.rawMaterialId),
          quantityPerUnit: Number(extra.batchQuantity || 0) / baseCount,
          batchQuantity: Number(extra.batchQuantity || 0),
          notes: extra.notes || null
        }))
      ];

      const payload = {
        name: form.name.trim(),
        internalCode: form.internalCode.trim(),
        barcode: form.barcode?.trim() || null,
        sellingPrice: Number(form.sellingPrice || 0),
        purchasePrice: costPerSandwich,
        unit: 'سندوتش',
        activityType: 'SANDWICH',
        productType: 'RECIPE',
        recipeYield: baseCount,
        recipeNotes: form.recipeNotes || `معادلة ${baseCount} سندوتش محسوبة على القطعة الأساسية`,
        ingredients: allIngredients
      };

      if (form.id) {
        await client.put(`/products/${form.id}`, payload);
        toast.success(`تم تحديث سندوتش ${form.name} بنجاح ✅`);
      } else {
        await client.post('/products', payload);
        toast.success(`تم ابتكار سندوتش ${form.name} بنجاح ✅`);
      }

      setIsModalOpen(false);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'فشل حفظ السندوتش');
    } finally {
      setIsSaving(false);
    }
  };

  // Filtered List
  const filteredSandwiches = sandwiches.filter(s => {
    const q = search.trim().toLowerCase();
    return !q || s.name.toLowerCase().includes(q) || s.internalCode.toLowerCase().includes(q);
  });

  // KPI Calculations
  const totalPortionsReady = sandwiches.reduce((sum, s) => sum + (s.totalStock || 0), 0);
  const avgMargin = sandwiches.length > 0 
    ? (sandwiches.reduce((sum, s) => sum + Number(s.profitMargin || 0), 0) / sandwiches.length).toFixed(1)
    : 0;

  if (loading) return <div className="p-8 text-center text-gray-500 font-bold">جاري تحميل مأكولات وسندوتشات المطبخ...</div>;

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center bg-white p-6 rounded-3xl shadow-sm border-2 border-gray-200 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-100 text-emerald-900 rounded-2xl">
            <UtensilsCrossed size={28} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2">
              <span>إدارة المطبخ والسندوتشات (المأكولات)</span>
              <span className="text-xs bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full font-black">
                قسم مستقل
              </span>
            </h2>
            <p className="text-gray-500 text-sm font-bold mt-1">
              تحديد المكون الأساسي (برجر / ستربس) والإضافات واحتساب تكلفة السندوتش والربح آلياً
            </p>
          </div>
        </div>

        {hasPermission('MANAGE_PRODUCTS') && (
          <button
            onClick={openCreateModal}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-5 py-3 rounded-2xl transition-all shadow-md shadow-emerald-200 flex items-center gap-2"
          >
            <Sparkles size={20} />
            <span>+ ابتكار سندوتش جديد</span>
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border-2 border-gray-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl">
            <Flame size={24} />
          </div>
          <div>
            <div className="text-xs font-bold text-gray-500">أصناف السندوتشات</div>
            <div className="text-2xl font-black text-gray-900">{sandwiches.length} صنف</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border-2 border-gray-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-700 rounded-xl">
            <ChefHat size={24} />
          </div>
          <div>
            <div className="text-xs font-bold text-gray-500">جاهز للتحضير الفوري</div>
            <div className="text-2xl font-black text-indigo-700">{totalPortionsReady} سندوتش</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border-2 border-gray-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-purple-50 text-purple-700 rounded-xl">
            <Calculator size={24} />
          </div>
          <div>
            <div className="text-xs font-bold text-gray-500">متوسط هامش الربح</div>
            <div className="text-2xl font-black text-purple-700">{avgMargin}%</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border-2 border-gray-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-800 rounded-xl">
            <Package size={24} />
          </div>
          <div>
            <div className="text-xs font-bold text-gray-500">خامات المطبخ المسجلة</div>
            <div className="text-2xl font-black text-amber-900">{rawMaterials.length} خامة</div>
          </div>
        </div>
      </div>

      {/* Sandwiches Cards & Search Row */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border-2 border-gray-200 space-y-5">
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
          <h3 className="text-lg font-black text-gray-800 flex items-center gap-2">
            <span>قائمة السندوتشات والوجبات المسجلة</span>
            <span className="text-xs text-gray-500 font-bold">({filteredSandwiches.length} سندوتش)</span>
          </h3>

          <div className="relative w-full sm:w-72">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
            <input
              type="text"
              placeholder="بحث باسم السندوتش أو الكود..."
              className="w-full border-2 border-gray-200 rounded-xl pr-10 pl-4 py-2 outline-none focus:border-emerald-600 font-bold text-xs sm:text-sm"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Sandwiches Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSandwiches.map(sandwich => {
            const ings = sandwich.recipeStats?.ingredientsWithStats || [];
            const baseIng = ings[0];
            const extraIngs = ings.slice(1);

            return (
              <div 
                key={sandwich.id}
                className="bg-white rounded-2xl border-2 border-gray-200 p-5 hover:border-emerald-500 hover:shadow-md transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  {/* Top Header */}
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <h4 className="font-black text-gray-900 text-base">{sandwich.name}</h4>
                      <div className="text-xs text-gray-400 font-mono mt-0.5">{sandwich.internalCode}</div>
                    </div>
                    <span className="bg-emerald-100 text-emerald-900 border border-emerald-200 px-2.5 py-1 rounded-xl text-xs font-black">
                      دفعة {sandwich.recipeYield || 20} قطعة
                    </span>
                  </div>

                  {/* Base Ingredient Tag */}
                  {baseIng && (
                    <div className="p-2.5 bg-emerald-50/80 rounded-xl border border-emerald-200/80 flex items-center gap-2 text-xs">
                      <span className="font-black text-emerald-950">المكون الأساسي:</span>
                      <span className="font-bold text-emerald-900">{baseIng.rawMaterialName}</span>
                      <span className="text-[10px] text-emerald-700 bg-white px-1.5 py-0.5 rounded border border-emerald-200 mr-auto font-mono">
                        1 {baseIng.rawMaterialUnit}
                      </span>
                    </div>
                  )}

                  {/* Extras Tags */}
                  {extraIngs.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 items-center">
                      <span className="text-[11px] text-gray-500 font-bold">المكونات الإضافية:</span>
                      {extraIngs.map((e, idx) => (
                        <span key={idx} className="bg-gray-100 text-gray-700 text-[11px] font-bold px-2 py-0.5 rounded-lg border border-gray-200">
                          {e.rawMaterialName}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Cost & Profit Breakdown Card */}
                  <div className="grid grid-cols-3 gap-2 bg-gray-50 p-3 rounded-xl border border-gray-200 text-center font-mono">
                    <div>
                      <div className="text-[10px] text-gray-500 font-bold">التكلفة</div>
                      <div className="text-sm font-black text-purple-700">
                        {Number(sandwich.effectiveCost || 0).toFixed(2)}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] text-gray-500 font-bold">سعر البيع</div>
                      <div className="text-sm font-black text-emerald-600">
                        {Number(sandwich.sellingPrice || 0).toFixed(2)}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] text-gray-500 font-bold">الربح</div>
                      <div className="text-sm font-black text-emerald-700">
                        +{Number(sandwich.profitPerUnit || 0).toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {/* Ready in kitchen */}
                  <div className="flex justify-between items-center text-xs p-2 bg-indigo-50/60 rounded-xl border border-indigo-100">
                    <span className="font-bold text-indigo-950">المتاح للتحضير الفوري:</span>
                    <span className="font-black font-mono text-indigo-800 text-sm">
                      {sandwich.totalStock} سندوتش
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                  <button
                    onClick={() => setViewRecipeModal(sandwich)}
                    className="flex-1 py-2 bg-purple-50 text-purple-800 hover:bg-purple-100 border border-purple-200 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition-colors"
                  >
                    <Eye size={14} />
                    <span>المكونات</span>
                  </button>

                  {hasPermission('MANAGE_PRODUCTS') && (
                    <>
                      <button
                        onClick={() => openEditModal(sandwich)}
                        className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition-colors shadow-sm"
                      >
                        <Edit3 size={14} />
                        <span>تعديل السندوتش</span>
                      </button>

                      <button
                        onClick={() => handleRequestDelete(sandwich)}
                        className="p-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl font-bold text-xs flex items-center justify-center transition-colors shadow-sm"
                        title="حذف السندوتش نهائياً"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {filteredSandwiches.length === 0 && (
            <div className="col-span-full p-12 text-center text-gray-400 font-bold border-2 border-dashed border-gray-200 rounded-3xl space-y-2">
              <UtensilsCrossed size={36} className="mx-auto text-gray-300" />
              <p>لا توجد سندوتشات مسجلة مطابقة للبحث حالياً.</p>
              <button
                onClick={openCreateModal}
                className="text-xs text-emerald-600 hover:underline font-black"
              >
                + انقر هنا لإضافة أول سندوتش للمطبخ
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ================= Sandwich Maker Modal ================= */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl p-7 w-full max-w-3xl border border-gray-100 max-h-[92vh] overflow-y-auto space-y-5">
            
            {/* Header */}
            <div className="flex justify-between items-center pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-100 text-emerald-900 rounded-2xl">
                  <ChefHat size={28} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-gray-800">
                    {editingSandwich ? `تعديل سندوتش: ${form.name}` : 'ابتكار وإعداد سندوتش جديد (المطبخ)'}
                  </h3>
                  <p className="text-xs text-gray-500 font-bold mt-0.5">
                    تحديد المكون الأساسي (عدد القطع) والمكونات الإضافية وحساب التكلفة والربح تلقائياً
                  </p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-xl">
                <X size={22} />
              </button>
            </div>

            {/* Quick Presets Buttons */}
            <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200/80 space-y-2.5">
              <div className="flex justify-between items-center">
                <div className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
                  <Sparkles size={16} className="text-emerald-600" />
                  <span>معادلات الأكل والسندوتشات الجاهزة بنقرة واحدة (محسوبة على 20 سندوتش):</span>
                </div>
                <span className="text-[11px] text-emerald-700 font-bold bg-emerald-100/60 px-2 py-0.5 rounded-lg">
                  اختر لتطبيق المقادير والتكلفة فورياً
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => applyPreset('BURGER')}
                  className="bg-white hover:bg-emerald-100/90 text-emerald-950 border-2 border-emerald-300/80 font-black p-3 rounded-2xl text-xs transition-all shadow-sm text-right flex flex-col gap-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black">🍔 سندوتش برجر</span>
                    <span className="text-[11px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">20 سندوتش</span>
                  </div>
                  <span className="text-[11px] text-gray-500 font-bold">20 قطعة برجر + 20 عيش كايزر + 1 كجم خضار</span>
                </button>

                <button
                  type="button"
                  onClick={() => applyPreset('STRIPS')}
                  className="bg-white hover:bg-emerald-100/90 text-emerald-950 border-2 border-emerald-300/80 font-black p-3 rounded-2xl text-xs transition-all shadow-sm text-right flex flex-col gap-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black">🥪 سندوتش ستربس</span>
                    <span className="text-[11px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">20 سندوتش</span>
                  </div>
                  <span className="text-[11px] text-gray-500 font-bold">20 قطعة ستربس + 20 عيش فينو + 1 كجم خضار</span>
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              
              {/* Step 1: Basic Info */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block mb-1 text-xs font-bold text-gray-700">
                    اسم السندوتش / الوجبة <span className="text-red-500">*</span>:
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="مثال: سندوتش برجر لحم فاخر / سندوتش تشيكن ستربس حار"
                    className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-emerald-600 font-bold text-gray-800"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block mb-1 text-xs font-bold text-gray-700">الكود الداخلي:</label>
                  <input
                    required
                    type="text"
                    className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-emerald-600 font-bold font-mono text-gray-800"
                    value={form.internalCode}
                    onChange={e => setForm({ ...form, internalCode: e.target.value })}
                  />
                </div>
              </div>

              {/* Step 2: The Base Ingredient (المكون الأساسي) */}
              <div className="p-4 bg-emerald-50/70 rounded-2xl border-2 border-emerald-200 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-emerald-600 text-white rounded-lg text-xs font-black">خطوة 1</span>
                  <h4 className="text-sm font-black text-emerald-950">المكون الأساسي وحجم الدفعة المرجعية:</h4>
                </div>
                <p className="text-xs text-emerald-800 font-bold">
                  اختر المكون الرئيسي (مثل قطع البرجر أو الستربس) وعدد القطع التي اشتريتها لتحديد عدد السندوتشات المنتجة
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block mb-1 text-xs font-black text-emerald-900">
                      اختر المكون الأساسي (خامة البرجر / الستربس):
                    </label>
                    <select
                      required
                      className="w-full border-2 border-emerald-300 rounded-xl p-3 outline-none focus:border-emerald-600 font-black text-gray-800 bg-white"
                      value={form.baseRawMaterialId}
                      onChange={e => setForm({ ...form, baseRawMaterialId: e.target.value })}
                    >
                      <option value="">-- اختر المكون الأساسي --</option>
                      {rawMaterials.map(rm => (
                        <option key={rm.id} value={rm.id}>
                          {rm.name} (سعر القطعة/الوحدة: {Number(rm.purchasePrice).toFixed(2)} ج.م)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block mb-1 text-xs font-black text-emerald-900">
                      عدد القطع الأساسية المشتراة (حجم الدفعة):
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        required
                        type="number"
                        min="1"
                        placeholder="20"
                        className="w-full border-2 border-emerald-300 rounded-xl p-3 outline-none focus:border-emerald-600 font-black font-mono text-emerald-900 text-lg bg-white"
                        value={form.basePiecesCount}
                        onChange={e => setForm({ ...form, basePiecesCount: e.target.value })}
                      />
                      <span className="text-xs font-black text-emerald-900 whitespace-nowrap">
                        = {baseCount} سندوتش
                      </span>
                    </div>
                  </div>
                </div>

                {baseRaw && (
                  <div className="p-2.5 bg-white rounded-xl border border-emerald-200 flex justify-between items-center text-xs font-bold text-gray-700">
                    <span>
                      تكلفة القطع الأساسية للدفعة ({baseCount} قطعة): <span className="font-black text-purple-700 font-mono">{baseCostTotal.toFixed(2)} ج.م</span>
                    </span>
                    <span className="bg-emerald-100 text-emerald-900 px-2.5 py-0.5 rounded-lg font-mono font-black">
                      نصيب السندوتش الواحد = {baseCostPerSandwich.toFixed(2)} ج.م
                    </span>
                  </div>
                )}
              </div>

              {/* Step 3: Additional Ingredients (المكونات الإضافية) */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-indigo-600 text-white rounded-lg text-xs font-black">خطوة 2</span>
                    <div>
                      <h4 className="text-sm font-black text-gray-800">المكونات الإضافية (طماطم، عيش، صوصات...):</h4>
                      <p className="text-[11px] text-gray-500 font-bold">
                        أدخل إجمالي الكمية المشتراة لهذه الدفعة، وسيقوم النظام بقسمتها على ({baseCount} سندوتش)
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddExtra}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-3.5 py-1.5 rounded-xl text-xs transition-colors flex items-center gap-1 shadow-sm"
                  >
                    <Plus size={15} />
                    <span>+ إضافة مكون إضافي</span>
                  </button>
                </div>

                {extrasWithStats.length > 0 ? (
                  <div className="overflow-x-auto rounded-2xl border-2 border-gray-200">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-indigo-50/70 text-indigo-950 font-black">
                        <tr>
                          <th className="p-3 border-b">المكون الإضافي</th>
                          <th className="p-3 border-b">الكمية لإجمالي الدفعة ({baseCount})</th>
                          <th className="p-3 border-b">نصيب السندوتش الواحد</th>
                          <th className="p-3 border-b">تكلفة الإضافة للسندوتش</th>
                          <th className="p-3 border-b">المخزون المتوفر</th>
                          <th className="p-3 border-b text-center">حذف</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 font-bold text-gray-700">
                        {extrasWithStats.map((extra, idx) => (
                          <tr key={idx} className="hover:bg-indigo-50/20">
                            {/* Raw Material Select */}
                            <td className="p-3">
                              <select
                                className="border-2 border-gray-200 rounded-xl p-2 outline-none focus:border-indigo-600 font-black text-gray-800 bg-white w-full min-w-[140px]"
                                value={extra.rawMaterialId}
                                onChange={e => handleUpdateExtra(idx, 'rawMaterialId', e.target.value)}
                              >
                                {rawMaterials.map(rm => (
                                  <option key={rm.id} value={rm.id}>
                                    {rm.name} ({rm.unit})
                                  </option>
                                ))}
                              </select>
                            </td>

                            {/* Batch Quantity */}
                            <td className="p-3">
                              <div className="flex items-center gap-1">
                                <input
                                  required
                                  type="number"
                                  step="any"
                                  min="0.001"
                                  className="border-2 border-gray-200 rounded-xl p-2 outline-none focus:border-indigo-600 font-black font-mono text-gray-800 w-24 bg-white"
                                  value={extra.batchQuantity}
                                  onChange={e => handleUpdateExtra(idx, 'batchQuantity', e.target.value)}
                                />
                                <span className="text-[11px] text-gray-500 font-bold">{extra.raw?.unit}</span>
                              </div>
                            </td>

                            {/* Per Sandwich Portions */}
                            <td className="p-3 font-mono font-black text-indigo-900">
                              {extra.qtyPerSandwich.toFixed(3)} {extra.raw?.unit}
                            </td>

                            {/* Cost per sandwich */}
                            <td className="p-3 font-mono font-black text-purple-700">
                              {extra.itemCostPerSandwich.toFixed(2)} ج.م
                            </td>

                            {/* Available Stock */}
                            <td className="p-3 font-mono">
                              <span className={`px-2 py-0.5 rounded-lg text-xs font-black ${
                                extra.rawStock <= 0 ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'
                              }`}>
                                {extra.rawStock} {extra.raw?.unit}
                              </span>
                            </td>

                            {/* Remove */}
                            <td className="p-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveExtra(idx)}
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-4 text-center border-2 border-dashed border-gray-200 rounded-xl text-gray-400 font-bold text-xs">
                    لم تتم إضافة مكونات إضافية بعد (مثل العيش، الطماطم، الخس، الصوصات).
                  </div>
                )}
              </div>

              {/* Pricing Section */}
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200">
                <label className="block mb-1 text-xs font-bold text-gray-700">
                  سعر بيع السندوتش للمريض/العميل (ج.م) <span className="text-red-500">*</span>:
                </label>
                <input
                  required
                  type="number"
                  step="0.5"
                  min="0"
                  placeholder="35.00"
                  className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-emerald-600 font-black text-emerald-600 text-xl bg-white"
                  value={form.sellingPrice}
                  onChange={e => setForm({ ...form, sellingPrice: e.target.value })}
                />
              </div>

              {/* Automatic Formula & Profit Summary Card */}
              <div className="bg-gradient-to-r from-emerald-500/10 via-purple-500/10 to-indigo-500/10 p-5 rounded-2xl border-2 border-emerald-300/70 space-y-3">
                <div className="text-xs font-bold text-gray-600 flex items-center gap-1.5">
                  <Calculator size={16} className="text-emerald-700" />
                  <span>معادلة التكلفة: ({baseCostTotal.toFixed(2)} ج.م أساسي + {extrasCostTotal.toFixed(2)} ج.م إضافات) ÷ {baseCount} قطعة = </span>
                  <span className="font-black text-purple-800 font-mono text-sm">{costPerSandwich.toFixed(2)} ج.م للسندوتش</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div>
                    <div className="text-[11px] text-gray-500 font-bold">تكلفة السندوتش الإجمالية</div>
                    <div className="text-xl font-black text-purple-700 font-mono mt-0.5">
                      {costPerSandwich.toFixed(2)} ج.م
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] text-gray-500 font-bold">سعر البيع للمريض</div>
                    <div className="text-xl font-black text-emerald-600 font-mono mt-0.5">
                      {sellingPrice.toFixed(2)} ج.م
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] text-gray-500 font-bold">صافي ربح السندوتش</div>
                    <div className="text-xl font-black text-emerald-700 font-mono mt-0.5">
                      +{profitPerSandwich.toFixed(2)} ج.م <span className="text-xs">({profitMargin}%)</span>
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] text-gray-500 font-bold">سندوتشات جاهزة للتحضير</div>
                    <div className="text-xl font-black text-indigo-700 font-mono mt-0.5">
                      {maxPossibleSandwiches} سندوتش
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
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
                  className="px-6 py-2.5 rounded-xl font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-200 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  <CheckCircle2 size={18} />
                  <span>{isSaving ? 'جاري الحفظ...' : editingSandwich ? 'تحديث السندوتش' : 'حفظ السندوتش والمعادلة'}</span>
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
                  <ChefHat className="text-emerald-600" size={24} />
                  <span>مكونات سندوتش: {viewRecipeModal.name}</span>
                </h3>
                <p className="text-xs text-gray-500 font-bold mt-1">
                  دفعة {viewRecipeModal.recipeYield || 20} سندوتش
                </p>
              </div>
              <button 
                onClick={() => setViewRecipeModal(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-right text-xs">
                <thead className="bg-emerald-50/70 text-emerald-950 font-black">
                  <tr>
                    <th className="p-3 border-b">المكون</th>
                    <th className="p-3 border-b">الحصة لكل سندوتش</th>
                    <th className="p-3 border-b">تكلفة الخامة</th>
                    <th className="p-3 border-b">التكلفة بالسندوتش</th>
                    <th className="p-3 border-b">رصيد المطبخ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-bold text-gray-700">
                  {(viewRecipeModal.recipeStats?.ingredientsWithStats || []).map((ing, idx) => (
                    <tr key={ing.id || idx} className="hover:bg-gray-50">
                      <td className="p-3">
                        <div className="font-black text-gray-900">{ing.rawMaterialName}</div>
                        {idx === 0 && (
                          <span className="text-[10px] text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded font-black">
                            المكون الأساسي
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-mono font-black text-emerald-800">
                        {ing.quantityPerUnit} {ing.rawMaterialUnit}
                      </td>
                      <td className="p-3 font-mono">
                        {Number(ing.rawMaterialPurchasePrice).toFixed(2)} ج.م
                      </td>
                      <td className="p-3 font-mono font-black text-purple-700">
                        {Number(ing.itemCost).toFixed(2)} ج.م
                      </td>
                      <td className="p-3 font-mono">
                        <span className={`px-2 py-0.5 rounded-lg text-xs font-black ${
                          ing.rawMaterialStock <= 0 ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {ing.rawMaterialStock} {ing.rawMaterialUnit}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-3 gap-3 bg-gray-50 p-4 rounded-2xl border border-gray-200 text-center font-mono">
              <div>
                <div className="text-[11px] text-gray-500 font-bold">التكلفة الإجمالية</div>
                <div className="text-base font-black text-purple-700">
                  {Number(viewRecipeModal.effectiveCost || 0).toFixed(2)} ج.م
                </div>
              </div>
              <div>
                <div className="text-[11px] text-gray-500 font-bold">سعر البيع</div>
                <div className="text-base font-black text-emerald-600">
                  {Number(viewRecipeModal.sellingPrice || 0).toFixed(2)} ج.م
                </div>
              </div>
              <div>
                <div className="text-[11px] text-gray-500 font-bold">صافي الربح</div>
                <div className="text-base font-black text-emerald-700">
                  +{Number(viewRecipeModal.profitPerUnit || 0).toFixed(2)} ({viewRecipeModal.profitMargin}%)
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

      {/* Delete Sandwich Confirmation / Stock Warning Modal */}
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
                      {hasStock ? 'تحذير: لا يمكن حذف الصنف!' : 'تأكيد حذف السندوتش نهائياً'}
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
                      <span>يوجد رصيد متبقي بالمخزن لهذا الصنف!</span>
                    </div>
                    <p className="text-xs text-amber-800 font-bold leading-relaxed">
                      الرصيد الفعلي الحالي: <span className="font-black font-mono text-amber-950 text-sm underline">{directStock} {deleteTarget.unit || 'قطعة'}</span>
                    </p>
                    <p className="text-[11px] text-amber-700 font-medium leading-relaxed">
                      يمنع النظام حذف أي صنف يحتوي على رصيد متبقي لحماية أرصدة المخزون والجرد الدوري.
                    </p>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(null)}
                      className="w-full py-2.5 rounded-xl font-bold text-gray-600 hover:bg-gray-100 transition-colors text-xs"
                    >
                      إغلاق
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-4 bg-red-50/80 border border-red-200 rounded-2xl space-y-2">
                    <p className="text-xs text-red-900 font-bold leading-relaxed">
                      هل أنت متأكد من رغبتك في حذف <span className="font-black text-red-950">"{deleteTarget.name}"</span> نهائياً من قائمة السندوتشات؟
                    </p>
                    <div className="text-[11px] text-gray-500 font-medium">
                      • سيتم حذف معادلة السندوتش وإزالته من شاشة الكاشير والبيع.
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

    </div>
  );
};

export default SandwichesPage;
