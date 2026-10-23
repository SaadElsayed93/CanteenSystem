import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import client from '../../api/client';
import { useAuth } from '../auth/AuthContext';
import { 
  Coffee, X, Plus, Trash2, Sparkles, CheckCircle2, 
  AlertTriangle, Package, DollarSign, Calculator, Layers
} from 'lucide-react';

const HotDrinksRecipeModal = ({ isOpen, onClose, onSuccess, initialRecipe = null }) => {
  const { isAdmin } = useAuth();
  const [rawMaterials, setRawMaterials] = useState([]);
  const [loadingRaw, setLoadingRaw] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    internalCode: '',
    barcode: '',
    sellingPrice: 10,
    recipeYield: 100, // الافتراضي دفعة 100 كوب
    recipeNotes: '',
    ingredients: []
  });

  useEffect(() => {
    if (isOpen) {
      fetchRawMaterials();
      if (initialRecipe) {
        setForm({
          id: initialRecipe.id,
          name: initialRecipe.name || '',
          internalCode: initialRecipe.internalCode || '',
          barcode: initialRecipe.barcode || '',
          sellingPrice: initialRecipe.sellingPrice || 10,
          recipeYield: initialRecipe.recipeYield || 100,
          recipeNotes: initialRecipe.recipeNotes || '',
          ingredients: (initialRecipe.recipeStats?.ingredientsWithStats || initialRecipe.ingredients || []).map(ing => ({
            rawMaterialId: ing.rawMaterialId,
            batchQuantity: Number(ing.quantityPerUnit || 0) * Number(initialRecipe.recipeYield || 100),
            quantityPerUnit: ing.quantityPerUnit,
            notes: ing.notes || ''
          }))
        });
      } else {
        const autoCode = `HOT-${Date.now().toString().slice(-5)}`;
        setForm({
          name: '',
          internalCode: autoCode,
          barcode: '',
          sellingPrice: 10,
          recipeYield: 100,
          recipeNotes: '',
          ingredients: []
        });
      }
    }
  }, [isOpen, initialRecipe]);

  const fetchRawMaterials = async () => {
    setLoadingRaw(true);
    try {
      const res = await client.get('/products/raw-materials');
      setRawMaterials(res.data.data || []);
    } catch (err) {
      toast.error('فشل جلب قائمة المواد الخام');
    } finally {
      setLoadingRaw(false);
    }
  };

  const handleAddIngredient = () => {
    if (rawMaterials.length === 0) {
      return toast.error('لا توجد مواد خام مسجلة. يرجى إضافة سكر أو شاي أو أكواب أولاً كمادة خام');
    }
    setForm(prev => ({
      ...prev,
      ingredients: [
        ...prev.ingredients,
        {
          rawMaterialId: rawMaterials[0].id,
          batchQuantity: 1,
          notes: ''
        }
      ]
    }));
  };

  const handleUpdateIngredient = (index, field, value) => {
    setForm(prev => {
      const updated = [...prev.ingredients];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, ingredients: updated };
    });
  };

  const handleRemoveIngredient = (index) => {
    setForm(prev => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== index)
    }));
  };

  // Quick Preset Templates for Hot Drinks
  const applyPreset = (type) => {
    const findRaw = (keywords) => {
      return rawMaterials.find(r => 
        keywords.some(k => r.name.toLowerCase().includes(k) || r.internalCode.toLowerCase().includes(k))
      );
    };

    const sugar = findRaw(['سكر', 'sugar']);
    const cups = findRaw(['كوب', 'أكواب', 'cup']);
    const tea = findRaw(['شاي', 'tea']);
    const coffee = findRaw(['بن', 'قهوة', 'coffee']);
    const nescafe = findRaw(['كوفي', 'نسكافيه', 'nescafe']);

    const yieldVal = 100;

    if (type === 'TEA') {
      const newIngs = [];
      if (tea) newIngs.push({ rawMaterialId: tea.id, batchQuantity: 100, notes: '1 فتلة لكل كوب' });
      if (sugar) newIngs.push({ rawMaterialId: sugar.id, batchQuantity: 2, notes: '2 كجم سكر (20 جم/كوب)' });
      if (cups) newIngs.push({ rawMaterialId: cups.id, batchQuantity: 100, notes: '1 كوب لكل مشروب' });

      setForm(prev => ({
        ...prev,
        name: prev.name || 'شاي',
        recipeYield: yieldVal,
        sellingPrice: 10,
        recipeNotes: '100 فتلة شاي + 2 كيلو سكر + 100 كوب بلاستيك = 100 كوباية شاي',
        ingredients: newIngs
      }));
      toast.success('تم تطبيق معادلة الشاي (100 فتلة + 2 كجم سكر + 100 كوب)');
    } else if (type === 'COFFEE') {
      const newIngs = [];
      if (coffee) newIngs.push({ rawMaterialId: coffee.id, batchQuantity: 1, notes: '1 كجم بن (10 جم/كوب)' });
      if (sugar) newIngs.push({ rawMaterialId: sugar.id, batchQuantity: 2, notes: '2 كجم سكر (20 جم/كوب)' });
      if (cups) newIngs.push({ rawMaterialId: cups.id, batchQuantity: 100, notes: '100 كوب' });

      setForm(prev => ({
        ...prev,
        name: prev.name || 'قهوة',
        recipeYield: yieldVal,
        sellingPrice: 15,
        recipeNotes: '1 كيلو بن + 2 كيلو سكر + 100 كوباية = 100 كوباية قهوة',
        ingredients: newIngs
      }));
      toast.success('تم تطبيق معادلة القهوة (1 كجم بن + 2 كجم سكر + 100 كوب)');
    } else if (type === 'NESCAFE') {
      const newIngs = [];
      if (nescafe) newIngs.push({ rawMaterialId: nescafe.id, batchQuantity: 100, notes: '100 كيس كوفي (1 كيس/كوب)' });
      if (sugar) newIngs.push({ rawMaterialId: sugar.id, batchQuantity: 2, notes: '2 كجم سكر (20 جم/كوب)' });
      if (cups) newIngs.push({ rawMaterialId: cups.id, batchQuantity: 100, notes: '100 كوب' });

      setForm(prev => ({
        ...prev,
        name: prev.name || 'كوفي',
        recipeYield: yieldVal,
        sellingPrice: 15,
        recipeNotes: '100 كيس كوفي + 2 ك سكر + 100 كوبايه بلاستيك = 100 كوباية كوفي',
        ingredients: newIngs
      }));
      toast.success('تم تطبيق معادلة الكوفي (100 كيس كوفي + 2 كجم سكر + 100 كوب)');
    }
  };

  // Live Cost & Portion Calculations
  const yieldCount = Number(form.recipeYield) > 0 ? Number(form.recipeYield) : 1;
  let totalCostPerCup = 0;
  let maxCupsPossible = Infinity;

  const ingredientDetails = form.ingredients.map(ing => {
    const raw = rawMaterials.find(r => r.id === Number(ing.rawMaterialId));
    const rawPrice = raw ? Number(raw.purchasePrice || 0) : 0;
    const rawStock = raw ? Number(raw.totalStock || 0) : 0;
    const batchQty = Number(ing.batchQuantity || 0);
    const qtyPerCup = batchQty / yieldCount;
    const costPerCup = qtyPerCup * rawPrice;

    totalCostPerCup += costPerCup;

    let possiblePortions = 0;
    if (qtyPerCup > 0) {
      possiblePortions = Math.floor(rawStock / qtyPerCup);
      if (possiblePortions < maxCupsPossible) {
        maxCupsPossible = possiblePortions;
      }
    }

    return {
      ...ing,
      raw,
      rawPrice,
      rawStock,
      qtyPerCup,
      costPerCup
    };
  });

  if (maxCupsPossible === Infinity || form.ingredients.length === 0) {
    maxCupsPossible = 0;
  }

  const sellingPrice = Number(form.sellingPrice || 0);
  const profitPerCup = Number((sellingPrice - totalCostPerCup).toFixed(2));
  const profitMargin = sellingPrice > 0 ? Number(((profitPerCup / sellingPrice) * 100).toFixed(1)) : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || form.name.trim() === '') {
      return toast.error('يرجى كتابة اسم المشروب');
    }
    if (form.ingredients.length === 0) {
      return toast.error('يجب إضافة مكون واحد على الأقل للمشروب');
    }

    setIsSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        internalCode: form.internalCode.trim(),
        barcode: form.barcode?.trim() || null,
        sellingPrice: Number(form.sellingPrice || 0),
        purchasePrice: Number(totalCostPerCup.toFixed(2)),
        unit: 'كوب',
        activityType: 'BUFFET',
        productType: 'RECIPE',
        recipeYield: yieldCount,
        recipeNotes: form.recipeNotes || null,
        ingredients: form.ingredients.map(ing => ({
          rawMaterialId: Number(ing.rawMaterialId),
          quantityPerUnit: Number(ing.batchQuantity || 0) / yieldCount,
          batchQuantity: Number(ing.batchQuantity || 0),
          notes: ing.notes || null
        }))
      };

      if (form.id) {
        await client.put(`/products/${form.id}`, payload);
        toast.success(`تم تحديث وصفة ${form.name} بنجاح ✅`);
      } else {
        await client.post('/products', payload);
        toast.success(`تم إنشاء مشروب ${form.name} وحفظ معادلته بنجاح ✅`);
      }

      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'فشل حفظ وصفة المشروب');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl p-7 w-full max-w-3xl border border-gray-100 max-h-[92vh] overflow-y-auto space-y-5">
        
        {/* Header */}
        <div className="flex justify-between items-center pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-100 text-amber-900 rounded-2xl">
              <Coffee size={28} />
            </div>
            <div>
              <h3 className="text-xl font-black text-gray-800">
                {form.id ? `تعديل وصفة: ${form.name}` : 'إعداد مشروب ساخن جديد (بوفيه المستشفى)'}
              </h3>
              <p className="text-xs text-gray-500 font-bold mt-0.5">
                تحديد مقادير السكر، الشاي، البن، الأكواب وحساب تكلفة الكوب ونسبة الربح آلياً
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-xl">
            <X size={22} />
          </button>
        </div>

        {/* Quick Presets Buttons */}
        <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200/80 space-y-2.5">
          <div className="flex justify-between items-center">
            <div className="text-xs font-black text-amber-900 flex items-center gap-1.5">
              <Sparkles size={16} className="text-amber-600" />
              <span>معادلات المشروبات السريعة بنقرة واحدة (جاهزة ومضبوطة للـ 100 كوب):</span>
            </div>
            <span className="text-[11px] text-amber-700 font-bold bg-amber-100/60 px-2 py-0.5 rounded-lg">
              اختر لتطبيق المقادير فورياً
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() => applyPreset('TEA')}
              className="bg-white hover:bg-amber-100/90 text-amber-950 border-2 border-amber-300/80 font-black p-3 rounded-2xl text-xs transition-all shadow-sm text-right flex flex-col gap-1"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-black">☕ شاي</span>
                <span className="text-[11px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">100 كوب</span>
              </div>
              <span className="text-[11px] text-gray-500 font-bold">100 فتلة + 2 كجم سكر + 100 كوب</span>
            </button>

            <button
              type="button"
              onClick={() => applyPreset('COFFEE')}
              className="bg-white hover:bg-amber-100/90 text-amber-950 border-2 border-amber-300/80 font-black p-3 rounded-2xl text-xs transition-all shadow-sm text-right flex flex-col gap-1"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-black">☕ قهوة</span>
                <span className="text-[11px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">100 كوب</span>
              </div>
              <span className="text-[11px] text-gray-500 font-bold">1 كجم بن + 2 كجم سكر + 100 كوب</span>
            </button>

            <button
              type="button"
              onClick={() => applyPreset('NESCAFE')}
              className="bg-white hover:bg-amber-100/90 text-amber-950 border-2 border-amber-300/80 font-black p-3 rounded-2xl text-xs transition-all shadow-sm text-right flex flex-col gap-1"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-black">☕ كوفي / نسكافيه</span>
                <span className="text-[11px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">100 كوب</span>
              </div>
              <span className="text-[11px] text-gray-500 font-bold">100 كيس كوفي + 2 كجم سكر + 100 كوب</span>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          
          {/* Beverage Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block mb-1 text-xs font-bold text-gray-700">
                اسم المشروب <span className="text-red-500">*</span>:
              </label>
              <input
                required
                type="text"
                placeholder="مثال: كوب شاي فتلة مخصوص / كوب قهوة سادة"
                className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-amber-600 font-bold text-gray-800"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div>
              <label className="block mb-1 text-xs font-bold text-gray-700">الكود الداخلي:</label>
              <input
                required
                type="text"
                className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-amber-600 font-bold font-mono text-gray-800"
                value={form.internalCode}
                onChange={e => setForm({ ...form, internalCode: e.target.value })}
              />
            </div>
          </div>

          {/* Pricing & Yield */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-200">
            <div>
              <label className="block mb-1 text-xs font-bold text-gray-700">
                سعر بيع الكوب للمريض/العميل (ج.م) <span className="text-red-500">*</span>:
              </label>
              <input
                required
                type="number"
                step="0.5"
                min="0"
                placeholder="10.00"
                className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-emerald-600 font-black text-emerald-600 text-lg bg-white"
                value={form.sellingPrice}
                onChange={e => setForm({ ...form, sellingPrice: e.target.value })}
              />
            </div>

            <div>
              <label className="block mb-1 text-xs font-bold text-gray-700">
                معيار الدفعة المرجعية (عدد الأكواب):
              </label>
              <input
                required
                type="number"
                min="1"
                placeholder="100"
                className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-amber-600 font-black text-amber-900 text-lg bg-white"
                value={form.recipeYield}
                onChange={e => setForm({ ...form, recipeYield: e.target.value })}
              />
              <span className="text-[11px] text-gray-500 font-bold mt-1 block">
                تحدد الكميات أدناه لإجمالي هذه الدفعة (مثال: 100 كوب)، ويحسب النظام نصيب الكوب تلقائياً.
              </span>
            </div>
          </div>

          {/* Recipe Ingredients Section */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="text-sm font-black text-gray-800 flex items-center gap-2">
                  <Calculator size={17} className="text-amber-600" />
                  <span>المواد الخام ومقادير التحضير (BOM)</span>
                </h4>
                <p className="text-[11px] text-gray-500 font-bold">
                  اختر المواد الخام (سكر، بن، شاي، أكواب) والكمية المستهلكة لإجمالي الدفعة
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddIngredient}
                className="bg-amber-600 hover:bg-amber-700 text-white font-black px-3.5 py-1.5 rounded-xl text-xs transition-colors flex items-center gap-1 shadow-sm"
              >
                <Plus size={15} />
                <span>+ إضافة مكون خام</span>
              </button>
            </div>

            {/* Ingredients Table */}
            {ingredientDetails.length > 0 ? (
              <div className="overflow-x-auto rounded-2xl border-2 border-gray-200">
                <table className="w-full text-right text-xs">
                  <thead className="bg-amber-50/70 text-amber-950 font-black">
                    <tr>
                      <th className="p-3 border-b">المادة الخام</th>
                      <th className="p-3 border-b">الكمية لـ ({yieldCount} كوب)</th>
                      <th className="p-3 border-b">حصة الكوب الواحد</th>
                      <th className="p-3 border-b">سعر الشراء</th>
                      <th className="p-3 border-b">تكلفة الكوب</th>
                      <th className="p-3 border-b">الرصيد المتاح</th>
                      <th className="p-3 border-b text-center">حذف</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-bold text-gray-700">
                    {ingredientDetails.map((ing, idx) => (
                      <tr key={idx} className="hover:bg-amber-50/20">
                        {/* Raw Material Select */}
                        <td className="p-3">
                          <select
                            className="border-2 border-gray-200 rounded-xl p-2 outline-none focus:border-amber-600 font-black text-gray-800 bg-white w-full min-w-[140px]"
                            value={ing.rawMaterialId}
                            onChange={e => handleUpdateIngredient(idx, 'rawMaterialId', e.target.value)}
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
                              className="border-2 border-gray-200 rounded-xl p-2 outline-none focus:border-amber-600 font-black font-mono text-gray-800 w-24 bg-white"
                              value={ing.batchQuantity}
                              onChange={e => handleUpdateIngredient(idx, 'batchQuantity', e.target.value)}
                            />
                            <span className="text-[11px] text-gray-500 font-bold">{ing.raw?.unit}</span>
                          </div>
                        </td>

                        {/* Quantity Per Cup */}
                        <td className="p-3 font-mono font-black text-amber-900">
                          {ing.qtyPerCup.toFixed(3)} {ing.raw?.unit}
                        </td>

                        {/* Raw Material Purchase Price */}
                        <td className="p-3 font-mono text-gray-700">
                          {ing.rawPrice.toFixed(2)} ج.م
                        </td>

                        {/* Cost Per Cup */}
                        <td className="p-3 font-mono font-black text-slate-800">
                          {ing.costPerCup.toFixed(2)} ج.م
                        </td>

                        {/* Available Raw Stock */}
                        <td className="p-3 font-mono">
                          <span className={`px-2 py-0.5 rounded-lg text-xs font-black ${
                            ing.rawStock <= 0 ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {ing.rawStock} {ing.raw?.unit}
                          </span>
                        </td>

                        {/* Remove */}
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveIngredient(idx)}
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
              <div className="p-6 text-center border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 font-bold space-y-2">
                <Coffee size={32} className="mx-auto text-gray-300" />
                <p>لم يتم إضافة أي مكونات بعد لهذا المشروب.</p>
                <p className="text-xs text-gray-400">
                  انقر على القوالب السريعة بالأعلى (شاي / قهوة / نسكافيه) أو زر "+ إضافة مكون خام".
                </p>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block mb-1 text-xs font-bold text-gray-700">طريقة التحضير والملاحظات:</label>
            <input
              type="text"
              placeholder="مثال: يتم استخدام ملعقتين سكر صغيرتين + مياه ساخنة مغلية"
              className="w-full border-2 border-gray-200 rounded-xl p-2.5 outline-none focus:border-amber-600 font-bold text-gray-800"
              value={form.recipeNotes}
              onChange={e => setForm({ ...form, recipeNotes: e.target.value })}
            />
          </div>

          {/* Live Real-time Profit & Stock Summary */}
          <div className="bg-gradient-to-r from-amber-500/10 via-emerald-500/10 to-emerald-500/10 p-5 rounded-2xl border-2 border-amber-300/60 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div>
              <div className="text-[11px] text-gray-500 font-bold">تكلفة تحضير الكوب الواحد</div>
              <div className="text-xl font-black text-slate-800 font-mono mt-0.5">
                {totalCostPerCup.toFixed(2)} ج.م
              </div>
            </div>

            <div>
              <div className="text-[11px] text-gray-500 font-bold">سعر بيع الكوب للمريض</div>
              <div className="text-xl font-black text-emerald-600 font-mono mt-0.5">
                {sellingPrice.toFixed(2)} ج.م
              </div>
            </div>

            <div>
              <div className="text-[11px] text-gray-500 font-bold">صافي ربح الكوب الواحد</div>
              <div className="text-xl font-black text-[#007507] font-mono mt-0.5">
                +{profitPerCup.toFixed(2)} ج.م <span className="text-xs">({profitMargin}%)</span>
              </div>
            </div>

            <div>
              <div className="text-[11px] text-gray-500 font-bold">أكواب جاهزة للبيع حالياً</div>
              <div className="text-xl font-black text-[#007507] font-mono mt-0.5">
                {maxCupsPossible} كوب
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl font-bold text-gray-600 hover:bg-gray-100 transition-colors"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 rounded-xl font-black bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-200 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              <CheckCircle2 size={18} />
              <span>{isSaving ? 'جاري الحفظ...' : form.id ? 'تحديث المشروب' : 'حفظ المشروب والوصفة'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};

export default HotDrinksRecipeModal;
