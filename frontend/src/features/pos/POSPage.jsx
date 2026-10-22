import toast from 'react-hot-toast';
import React, { useState, useEffect, useRef } from 'react';
import client from '../../api/client';
import { useAuth } from '../auth/AuthContext';
import { 
  Trash2, Printer, Zap, CheckCircle2, X, ShoppingCart, 
  Search, AlertTriangle, User, CreditCard, RotateCcw,
  Lock, Unlock, Store, Coffee, UtensilsCrossed, ChefHat
} from 'lucide-react';
import { useShift } from '../shifts/ShiftContext';

const POSPage = () => {
  const { user } = useAuth();
  const { isOpen, currentShift, setIsOpeningModal } = useShift();
  const [products, setProducts] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [patients, setPatients] = useState([]);
  
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // الأقسام الثلاثة في نقطة البيع
  const [divisionTab, setDivisionTab] = useState('ALL'); // 'ALL', 'CANTEEN', 'BUFFET', 'SANDWICH'
  
  // Checkout Form
  const [invoiceType, setInvoiceType] = useState('CASH'); // CASH or CREDIT
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [patientId, setPatientId] = useState('');
  
  // Receipt State
  const [completedReceipt, setCompletedReceipt] = useState(null);
  const [showReceiptModal, setShowReceiptModal] = useState(() => {
    return localStorage.getItem('canteen_show_receipt_modal') !== 'false';
  });
  
  const barcodeInputRef = useRef(null);

  // Play audio tones via Web Audio API
  const playTone = (freq = 800, duration = 0.08, type = 'sine') => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
      // Audio autoplay restrictions
    }
  };

  useEffect(() => {
    fetchPosData();
  }, []);

  const fetchPosData = async () => {
    try {
      const res = await client.get('/sales/pos-data');
      // حجب واستبعاد المواد الخام نهائياً من الـ POS
      const sellableProducts = (res.data.data.products || []).filter(p => p.productType !== 'RAW_MATERIAL');
      setProducts(sellableProducts);
      
      const methods = res.data.data.paymentMethods;
      setPaymentMethods(methods);
      
      // Auto-select cash (drawer)
      const cashMethod = methods.find(m => m.name.includes('نقدي') || m.name === 'نقدية') || methods[0];
      if (cashMethod) setPaymentMethodId(cashMethod.id);
      
      setPatients(res.data.data.patients);
    } catch (err) {
      toast.error('فشل في جلب بيانات البيع');
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(p => {
    // إخفاء المواد الخام من الكتالوج المباشر للبيع نهائياً
    if (p.productType === 'RAW_MATERIAL') return false;

    // تصفية حسب القسم
    if (divisionTab !== 'ALL' && p.activityType !== divisionTab) {
      return false;
    }

    if (!search) return true;
    const match = (p.name && p.name.includes(search)) || 
                  (p.internalCode && p.internalCode.includes(search)) || 
                  (p.barcode && p.barcode.includes(search));
    return match;
  });

  const handleBarcodeSearch = (e) => {
    e.preventDefault();
    if (!search.trim()) return;
    
    // Exact match on barcode or internal code (باستثناء المواد الخام)
    const exactProduct = products.find(p => p.productType !== 'RAW_MATERIAL' && (p.barcode === search.trim() || p.internalCode === search.trim()));
    
    if (exactProduct) {
      const added = addToCart(exactProduct);
      if (added) {
        playTone(900, 0.07);
        setSearch('');
      }
    } else {
      if (filteredProducts.length === 0) {
        playTone(280, 0.25, 'square');
        toast.error('صنف غير موجود في المخزون');
      } else if (filteredProducts.length === 1) {
        addToCart(filteredProducts[0]);
        playTone(900, 0.07);
        setSearch('');
      }
    }
  };

  const addToCart = (product) => {
    if (!product || product.productType === 'RAW_MATERIAL') {
      toast.error('المواد الخام مخصصة للتصنيع ولا يمكن بيعها في نقطة البيع');
      return false;
    }
    const isRecipe = product.productType === 'RECIPE';

    if (product.isExpired) {
      playTone(280, 0.2, 'square');
      toast.error(`⚠️ تحذير: الصنف (${product.name}) منتهي الصلاحية!`, { duration: 3500 });
    } else if (product.isExpiringSoon) {
      toast(`⏳ تنبيه: الصنف (${product.name}) أوشكت صلاحيته على الانتهاء (${product.daysUntilExpiry} يوم متبقي)`, {
        duration: 3000
      });
    }

    // تنبيه توفر المواد الخام أو نفاد المخزون
    if (product.totalStock <= 0) {
      playTone(450, 0.12, 'sawtooth');
      toast((t) => (
        <div className="flex items-center gap-2.5">
          <span className="text-lg">⚠️</span>
          <div>
            <div className="text-xs font-black text-white">
              {isRecipe ? `تنبيه المطبخ/البوفيه: خامات (${product.name}) نافدة!` : `تنبيه المخزن: (${product.name}) رصيده صفر`}
            </div>
            <div className="text-[11px] text-amber-300 font-bold">تمت إضافته للسلة وسيتم تسجيل البيع بالسالب</div>
          </div>
        </div>
      ), {
        id: `stock-alert-${product.id}`,
        duration: 3000,
        style: {
          background: '#0f172a',
          color: '#fff',
          borderRadius: '16px',
          border: '1px solid #334155',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)'
        }
      });
    } else {
      playTone(850, 0.06);
    }

    setCart(prev => {
      const existing = prev.find(i => i.productId === product.id);
      if (existing) {
        return prev.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { 
        productId: product.id, 
        name: product.name, 
        price: Number(product.sellingPrice), 
        quantity: 1, 
        maxStock: product.totalStock,
        activityType: product.activityType,
        productType: product.productType
      }];
    });
    return true;
  };

  const updateQuantity = (productId, qty) => {
    const parsedQty = parseInt(qty);
    if (isNaN(parsedQty) || parsedQty <= 0) {
      setCart(cart.filter(i => i.productId !== productId));
      return;
    }
    setCart(cart.map(i => i.productId === productId ? { ...i, quantity: parsedQty } : i));
  };

  const removeFromCart = (productId) => {
    playTone(500, 0.05);
    setCart(cart.filter(i => i.productId !== productId));
  };

  const clearCart = () => {
    if (cart.length === 0) return;
    setCart([]);
    playTone(400, 0.08);
    toast.success('تم إفراغ السلة');
  };

  const toggleShowReceipt = () => {
    const next = !showReceiptModal;
    setShowReceiptModal(next);
    localStorage.setItem('canteen_show_receipt_modal', String(next));
    toast.success(next ? 'تم تفعيل إظهار بون الفاتورة' : 'تم تعطيل إظهار بون الفاتورة');
  };

  const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const handleCheckout = async (forcedType) => {
    if (!isOpen) {
      playTone(250, 0.3, 'sawtooth');
      toast.error('اليومية مغلقة حالياً! يجب فتح اليومية والوردية أولاً لإتمام البيع');
      setIsOpeningModal(true);
      return;
    }
    if (isSubmitting) return;
    if (cart.length === 0) return toast.error('الفاتورة فارغة');
    
    const typeToUse = forcedType || invoiceType;
    if (typeToUse === 'CASH' && !paymentMethodId) return toast.error('اختر طريقة الدفع النقدية');
    if (typeToUse === 'CREDIT' && !patientId) return toast.error('اختر المريض لتسجيل الفاتورة على حسابه');

    setIsSubmitting(true);
    try {
      const res = await client.post('/sales/checkout', {
        type: typeToUse,
        paymentMethodId: typeToUse === 'CASH' ? Number(paymentMethodId) : null,
        patientId: typeToUse === 'CREDIT' ? Number(patientId) : null,
        items: cart.map(i => ({ productId: i.productId, quantity: i.quantity }))
      });
      
      const invoiceData = res.data.data;
      
      // Play cha-ching sound
      const audio = new Audio('/poppop.ai - cha ching sound effect.mp3');
      audio.play().catch(e => console.error("Audio play blocked", e));
      
      toast.success('تم تسجيل الفاتورة بنجاح 🎉');

      // Prepare receipt data with remaining patient balance (Stage 1.4)
      const selectedPatient = patients.find(p => p.id === Number(patientId));
      let patientRemainingBalance = null;
      if (typeToUse === 'CREDIT' && selectedPatient) {
        patientRemainingBalance = Number(selectedPatient.currentDebt || 0) - totalAmount;
      }

      const receipt = {
        invoiceNumber: invoiceData.invoiceNumber || `INV-${invoiceData.id}`,
        items: [...cart],
        total: totalAmount,
        type: typeToUse,
        patientName: typeToUse === 'CREDIT' ? (selectedPatient?.fullName || selectedPatient?.name) : null,
        patientRemainingBalance,
        cashierName: user?.fullName || 'الكاشير',
        date: new Date()
      };

      // Reset cart and refresh stock
      setCart([]);
      setPatientId('');
      fetchPosData();
      setIsSubmitting(false);

      // Show receipt if enabled
      if (showReceiptModal) {
        setCompletedReceipt(receipt);
      }
      
    } catch (err) {
      setIsSubmitting(false);
      playTone(250, 0.3, 'sawtooth');
      toast.error(err.response?.data?.message || 'حدث خطأ أثناء حفظ الفاتورة');
    }
  };

  // Keyboard Shortcuts (F2, F4, F9, Esc)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // When Receipt Modal is open
      if (completedReceipt) {
        if (e.key === 'Enter') {
          e.preventDefault();
          window.print();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          setCompletedReceipt(null);
          barcodeInputRef.current?.focus();
        }
        return;
      }

      // F2: Focus barcode/search input
      if (e.key === 'F2') {
        e.preventDefault();
        barcodeInputRef.current?.focus();
        barcodeInputRef.current?.select();
      }
      // F4: Toggle between Cash and Credit
      else if (e.key === 'F4') {
        e.preventDefault();
        setInvoiceType(prev => (prev === 'CASH' ? 'CREDIT' : 'CASH'));
      }
      // F9: Fast Instant Cash Checkout
      else if (e.key === 'F9') {
        e.preventDefault();
        if (!isOpen) {
          playTone(250, 0.3, 'sawtooth');
          toast.error('اليومية مغلقة حالياً! يجب فتح اليومية أولاً لإتمام البيع');
          setIsOpeningModal(true);
          return;
        }
        if (cart.length > 0 && !isSubmitting) {
          setInvoiceType('CASH');
          handleCheckout('CASH');
        } else if (cart.length === 0) {
          toast.error('السلة فارغة!');
        }
      }
      // Esc: Clear search or blur
      else if (e.key === 'Escape') {
        if (search) {
          setSearch('');
        } else {
          barcodeInputRef.current?.blur();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [completedReceipt, cart, isSubmitting, search, invoiceType, paymentMethodId, patientId]);

  if (loading) return (
    <div className="flex justify-center items-center h-96">
      <div className="text-xl font-bold text-gray-500 animate-pulse">جاري تحميل شاشة البيع...</div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Top Shortcuts Bar & Action Header */}
      <div className="bg-white px-5 py-3 rounded-2xl shadow-sm border-2 border-gray-100 flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2 font-bold text-gray-700">
          <Zap className="text-amber-500 fill-amber-500" size={18} />
          <span>اختصارات الكاشير السريعة:</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg font-bold border border-indigo-100 flex items-center gap-1">
            <kbd className="bg-white px-1.5 py-0.5 rounded shadow text-xs font-mono font-black text-indigo-900">F2</kbd>
            <span>بحث/باركود</span>
          </span>
          <span className="bg-purple-50 text-purple-700 px-3 py-1 rounded-lg font-bold border border-purple-100 flex items-center gap-1">
            <kbd className="bg-white px-1.5 py-0.5 rounded shadow text-xs font-mono font-black text-purple-900">F4</kbd>
            <span>تحويل كاش/مريض</span>
          </span>
          <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-lg font-bold border border-emerald-100 flex items-center gap-1">
            <kbd className="bg-white px-1.5 py-0.5 rounded shadow text-xs font-mono font-black text-emerald-900">F9</kbd>
            <span>إنهاء كاش فوري</span>
          </span>
          <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-lg font-bold border border-gray-200 flex items-center gap-1">
            <kbd className="bg-white px-1.5 py-0.5 rounded shadow text-xs font-mono font-black text-gray-800">Esc</kbd>
            <span>إلغاء</span>
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input 
              type="checkbox" 
              checked={showReceiptModal} 
              onChange={toggleShowReceipt} 
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            />
            <span>إظهار بون الفاتورة بعد الحفظ</span>
          </label>
        </div>
      </div>

      {/* Closed Shift Alert Banner */}
      {!isOpen && (
        <div className="bg-gradient-to-r from-rose-600 via-red-600 to-amber-600 text-white p-4 rounded-2xl shadow-lg border-2 border-rose-300 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <Lock size={24} className="text-white" />
            </div>
            <div>
              <h4 className="font-black text-base">اليومية والوردية مغلقة حالياً!</h4>
              <p className="text-rose-100 text-xs font-bold">لا يمكن إتمام أي عمليات بيع أو خصم من المخزون حتى يتم فتح اليومية.</p>
            </div>
          </div>
          <button
            onClick={() => setIsOpeningModal(true)}
            className="w-full sm:w-auto bg-white text-rose-700 hover:bg-rose-50 font-black px-6 py-2.5 rounded-xl shadow transition-all flex items-center justify-center gap-2"
          >
            <Unlock size={18} />
            <span>🔓 فتح اليومية للبدء</span>
          </button>
        </div>
      )}

      {/* Main POS Workspace */}
      <div className="flex flex-col md:flex-row gap-6 h-[80vh]">
        {/* Products Grid Section */}
        <div className="md:w-2/3 flex flex-col gap-4">
          
          {/* Search Box */}
          <div className="bg-white p-4 shadow-sm border-2 border-gray-100 rounded-2xl">
            <form onSubmit={handleBarcodeSearch} className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute right-4 top-3.5 text-gray-400" size={22} />
                <input 
                  ref={barcodeInputRef}
                  type="text" 
                  placeholder="مرر الباركود أو ابحث بالاسم أو الكود... [F2 للتركيز]" 
                  className="w-full pr-12 pl-4 py-3 border-2 border-gray-200 rounded-xl text-base outline-none focus:border-indigo-500 focus:bg-white bg-gray-50/50 font-bold transition-all"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  autoFocus
                />
                {search && (
                  <button 
                    type="button" 
                    onClick={() => setSearch('')}
                    className="absolute left-4 top-3.5 text-gray-400 hover:text-gray-600"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
              <button 
                type="submit" 
                className="bg-indigo-600 hover:bg-indigo-700 transition-colors text-white font-bold px-7 rounded-xl shadow-md shadow-indigo-200 flex items-center gap-2"
              >
                بحث
              </button>
            </form>
          </div>

          {/* Products List & Division Tabs */}
          <div className="bg-white p-5 shadow-sm border-2 border-gray-100 rounded-2xl flex-1 overflow-y-auto flex flex-col">
            
            {/* Division Tabs Filter */}
            <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1 border-b border-gray-100">
              <button
                type="button"
                onClick={() => setDivisionTab('ALL')}
                className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  divisionTab === 'ALL'
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span>جميع الأقسام</span>
                <span className="text-[10px] bg-black/15 px-1.5 py-0.2 rounded-full font-mono">
                  {products.filter(p => p.productType !== 'RAW_MATERIAL').length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setDivisionTab('CANTEEN')}
                className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  divisionTab === 'CANTEEN'
                    ? 'bg-sky-600 text-white shadow-sm shadow-sky-200'
                    : 'bg-sky-50 text-sky-800 hover:bg-sky-100'
                }`}
              >
                <Store size={14} />
                <span>الكانتين</span>
                <span className="text-[10px] bg-sky-200/60 text-sky-950 px-1.5 py-0.2 rounded-full font-mono">
                  {products.filter(p => p.activityType === 'CANTEEN' && p.productType !== 'RAW_MATERIAL').length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setDivisionTab('BUFFET')}
                className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  divisionTab === 'BUFFET'
                    ? 'bg-amber-600 text-white shadow-sm shadow-amber-200'
                    : 'bg-amber-50 text-amber-900 hover:bg-amber-100'
                }`}
              >
                <Coffee size={14} />
                <span>البوفيه والمشروبات</span>
                <span className="text-[10px] bg-amber-200/60 text-amber-950 px-1.5 py-0.2 rounded-full font-mono">
                  {products.filter(p => p.activityType === 'BUFFET' && p.productType !== 'RAW_MATERIAL').length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setDivisionTab('SANDWICH')}
                className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  divisionTab === 'SANDWICH'
                    ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-200'
                    : 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
                }`}
              >
                <UtensilsCrossed size={14} />
                <span>السندوتشات والمطبخ</span>
                <span className="text-[10px] bg-emerald-200/60 text-emerald-950 px-1.5 py-0.2 rounded-full font-mono">
                  {products.filter(p => p.activityType === 'SANDWICH' && p.productType !== 'RAW_MATERIAL').length}
                </span>
              </button>
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 flex-1 overflow-y-auto pr-1">
              {filteredProducts.map(p => {
                const isRecipe = p.productType === 'RECIPE';

                return (
                  <div 
                    key={p.id} 
                    onClick={() => addToCart(p)}
                    className={`border-2 rounded-2xl p-3.5 text-center cursor-pointer transition-all group flex flex-col justify-between relative select-none ${
                      p.isExpired 
                        ? 'border-red-200 bg-red-50/20 hover:bg-red-50 hover:border-red-300' 
                        : p.isExpiringSoon 
                        ? 'border-amber-200 bg-amber-50/20 hover:bg-amber-50 hover:border-amber-300' 
                        : isRecipe
                        ? 'border-purple-100 bg-purple-50/10 hover:bg-purple-50 hover:border-purple-300 hover:shadow-md'
                        : 'border-gray-100 hover:bg-indigo-50/60 hover:border-indigo-200 hover:shadow-md'
                    }`}
                  >
                    {/* Expiry Pill */}
                    {p.isExpired && (
                      <div className="absolute -top-2.5 right-2 bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm">
                        منتهي الصلاحية
                      </div>
                    )}
                    {p.isExpiringSoon && !p.isExpired && (
                      <div className="absolute -top-2.5 right-2 bg-amber-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm">
                        {p.daysUntilExpiry <= 0 ? 'ينتهي اليوم!' : p.daysUntilExpiry === 1 ? 'باقي يوم واحد' : p.daysUntilExpiry === 2 ? 'باقي يومان' : (p.daysUntilExpiry >= 3 && p.daysUntilExpiry <= 10) ? `باقي ${p.daysUntilExpiry} أيام` : `باقي ${p.daysUntilExpiry} يوماً`}
                      </div>
                    )}

                    {/* Division Badge */}
                    <div className="flex justify-between items-center mb-1.5">
                      {p.activityType === 'CANTEEN' && (
                        <span className="text-[10px] font-black bg-sky-50 text-sky-800 border border-sky-200 px-1.5 py-0.2 rounded-md">
                          🏪 كانتين
                        </span>
                      )}
                      {p.activityType === 'BUFFET' && (
                        <span className="text-[10px] font-black bg-amber-50 text-amber-900 border border-amber-200 px-1.5 py-0.2 rounded-md">
                          ☕ بوفيه
                        </span>
                      )}
                      {p.activityType === 'SANDWICH' && (
                        <span className="text-[10px] font-black bg-emerald-50 text-emerald-900 border border-emerald-200 px-1.5 py-0.2 rounded-md">
                          🍔 سندوتش
                        </span>
                      )}
                      {isRecipe && (
                        <span className="text-[9px] font-black bg-purple-100 text-purple-900 px-1.5 py-0.2 rounded-md mr-auto">
                          تحضير
                        </span>
                      )}
                    </div>

                    <div>
                      <div className="font-bold text-gray-800 mb-1 group-hover:text-indigo-900 transition-colors line-clamp-1 text-sm">{p.name}</div>
                      <div className="text-[11px] text-gray-400 font-bold mb-2 font-mono">{p.internalCode}</div>
                    </div>

                    <div>
                      <div className="text-indigo-600 font-black text-xl mb-1.5 font-mono">
                        {p.sellingPrice} <span className="text-xs font-bold text-gray-500">ج.م</span>
                      </div>
                      
                      {/* Stock / Readiness display */}
                      {isRecipe ? (
                        <div className={`text-[11px] px-2 py-0.5 inline-block rounded-lg font-black font-mono ${
                          p.totalStock <= 0 
                            ? 'bg-rose-100 text-rose-800 border border-rose-200' 
                            : 'bg-purple-100 text-purple-900 border border-purple-200'
                        }`}>
                          {p.totalStock <= 0 ? `خامات ناقصة (${p.totalStock})` : `جاهز: ${p.totalStock}`}
                        </div>
                      ) : (
                        <div className={`text-xs px-2.5 py-0.5 inline-block rounded-lg font-bold font-mono ${
                          p.totalStock <= 0 
                            ? 'bg-red-100 text-red-700' 
                            : p.totalStock <= 10 
                            ? 'bg-amber-100 text-amber-700' 
                            : 'bg-emerald-50 text-emerald-700'
                        }`}>
                          المخزون: {p.totalStock}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {filteredProducts.length === 0 && (
                <div className="col-span-full text-center py-12 text-gray-400 font-bold">
                  لا توجد أصناف مطابقة في هذا القسم
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Cart & Checkout Section */}
        <div className="md:w-1/3 bg-white p-5 shadow-sm border-2 border-gray-100 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-3 border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-gray-800">الفاتورة الحالية</h2>
                {cart.length > 0 && (
                  <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2.5 py-0.5 rounded-full">
                    {cart.length} أصناف
                  </span>
                )}
              </div>
              {cart.length > 0 && (
                <button 
                  onClick={clearCart}
                  className="text-xs text-red-500 hover:text-red-700 font-bold flex items-center gap-1 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors"
                  title="مسح كل محتويات السلة"
                >
                  <Trash2 size={14} />
                  مسح السلة
                </button>
              )}
            </div>
            
            <div className="max-h-[36vh] overflow-y-auto mb-3 pr-1">
              {cart.length === 0 ? (
                <div className="text-gray-400 flex flex-col items-center justify-center py-14">
                  <ShoppingCart size={44} className="text-gray-300 mb-2" />
                  <span className="font-bold text-gray-400">السلة فارغة</span>
                  <span className="text-xs text-gray-400 mt-1">اضغط على أي صنف لإضافته</span>
                </div>
              ) : (
                <table className="w-full text-right border-collapse text-xs">
                  <tbody>
                    {cart.map(item => (
                      <tr key={item.productId} className="border-b border-gray-50 hover:bg-gray-50/80 transition-colors">
                        <td className="py-2.5 pl-2">
                          <div className="font-bold text-gray-800 line-clamp-1">{item.name}</div>
                          <div className="text-[11px] text-gray-400 font-mono">{item.price} ج.م</div>
                        </td>
                        <td className="py-2.5 px-1 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button 
                              onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                              className="w-6 h-6 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 font-black text-xs flex items-center justify-center"
                            >
                              -
                            </button>
                            <span className="w-7 text-center font-black font-mono text-sm">{item.quantity}</span>
                            <button 
                              onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                              className="w-6 h-6 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 font-black text-xs flex items-center justify-center"
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td className="py-2.5 text-left font-black font-mono text-indigo-700 text-sm whitespace-nowrap">
                          {(item.price * item.quantity).toFixed(2)} ج
                        </td>
                        <td className="py-2.5 pr-1 text-left">
                          <button 
                            onClick={() => removeFromCart(item.productId)}
                            className="text-gray-300 hover:text-red-500 p-1 rounded transition-colors"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Checkout Controls */}
          <div className="border-t border-gray-100 pt-3 space-y-3">
            {/* Total */}
            <div className="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-100">
              <span className="font-black text-gray-700 text-sm">المبلغ الإجمالي:</span>
              <span className="font-mono font-black text-2xl text-indigo-700">{totalAmount.toFixed(2)} <span className="text-sm">ج.م</span></span>
            </div>

            {/* Payment Type Tabs */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setInvoiceType('CASH')}
                className={`py-2 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all ${
                  invoiceType === 'CASH'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <CreditCard size={15} />
                <span>نقدي (كاش) [F4]</span>
              </button>

              <button
                type="button"
                onClick={() => setInvoiceType('CREDIT')}
                className={`py-2 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all ${
                  invoiceType === 'CREDIT'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <User size={15} />
                <span>على حساب مريض</span>
              </button>
            </div>

            {/* Cash Drawer Select */}
            {invoiceType === 'CASH' && (
              <div>
                <select
                  className="w-full border-2 border-gray-200 rounded-xl p-2.5 outline-none focus:border-indigo-600 font-bold text-xs bg-white text-gray-800"
                  value={paymentMethodId}
                  onChange={e => setPaymentMethodId(e.target.value)}
                >
                  {paymentMethods.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Patient Select */}
            {invoiceType === 'CREDIT' && (
              <div>
                <select
                  className="w-full border-2 border-purple-200 rounded-xl p-2.5 outline-none focus:border-purple-600 font-bold text-xs bg-white text-gray-800"
                  value={patientId}
                  onChange={e => setPatientId(e.target.value)}
                >
                  <option value="">-- اختر المريض لإتمام البيع --</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.fullName || p.name} (الرصيد: {Number(p.currentDebt || 0).toFixed(2)} ج.م)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="button"
              disabled={isSubmitting || cart.length === 0}
              onClick={() => handleCheckout()}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black py-3 rounded-xl transition-all shadow-md shadow-indigo-200 flex items-center justify-center gap-2 text-base"
            >
              <CheckCircle2 size={20} />
              <span>{isSubmitting ? 'جاري التسجيل...' : 'إتمام ودفع الفاتورة'}</span>
            </button>
          </div>

        </div>
      </div>

      {/* ================= Thermal Receipt Modal ================= */}
      {completedReceipt && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-sm border border-gray-100 max-h-[90vh] overflow-y-auto">
            
            {/* The Print Container */}
            <div id="thermal-receipt" className="text-black bg-white p-2">
              <div className="text-center space-y-1 mb-3">
                <div className="font-black text-sm font-sans">المستشفى العسكري ق.م بالإسماعيلية</div>
                <div className="font-bold text-xs text-gray-700 font-sans">إدارة الكانتين والبوفيه والمطبخ</div>
                <div className="border-b-2 border-dashed border-gray-300 my-2"></div>
                <div className="text-xs text-gray-600 space-y-1 text-right font-sans font-bold">
                  <div>رقم الفاتورة: <span className="font-mono font-black">{completedReceipt.invoiceNumber}</span></div>
                  <div>التاريخ: {new Date(completedReceipt.date).toLocaleString('ar-EG')}</div>
                  <div>الكاشير: {completedReceipt.cashierName}</div>
                  <div>نوع الدفع: {completedReceipt.type === 'CASH' ? 'نقدي (كاش)' : `على حساب المريض (${completedReceipt.patientName || 'المريض'})`}</div>
                </div>
                <div className="border-b-2 border-dashed border-gray-300 my-2"></div>
              </div>

              {/* Items List */}
              <table className="w-full text-right text-xs mb-3 font-sans font-bold">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500 pb-1">
                    <th className="py-1">الصنف</th>
                    <th className="py-1 text-center">الكمية</th>
                    <th className="py-1 text-left">الإجمالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {completedReceipt.items.map((item, idx) => (
                    <tr key={idx} className="py-1">
                      <td className="py-1">{item.name}</td>
                      <td className="py-1 text-center font-mono">{item.quantity}</td>
                      <td className="py-1 text-left font-mono">{(item.price * item.quantity).toFixed(2)} ج</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="border-b-2 border-dashed border-gray-300 my-2"></div>

              {/* Total */}
              <div className="flex justify-between items-center text-sm font-sans font-black py-1">
                <span>الإجمالي الصافي:</span>
                <span className="text-lg font-mono">{completedReceipt.total.toFixed(2)} ج.م</span>
              </div>

              {/* Patient Balance After Invoice (Stage 1.4) */}
              {completedReceipt.type === 'CREDIT' && completedReceipt.patientRemainingBalance !== null && (
                <div className="flex justify-between items-center text-xs font-sans font-bold py-1 bg-gray-50 p-1.5 rounded my-1 border border-gray-200">
                  <span>الرصيد المتبقي لحساب المريض:</span>
                  <span className="font-mono font-black text-gray-900">{Number(completedReceipt.patientRemainingBalance).toFixed(2)} ج.م</span>
                </div>
              )}

              <div className="border-b-2 border-dashed border-gray-300 my-2"></div>
              <div className="text-center text-[11px] text-gray-500 font-sans mt-2">
                شكراً لزيارتكم • نتمنى لكم الشفاء العاجل
              </div>
            </div>

            {/* Modal Footer Controls */}
            <div className="mt-4 flex gap-3 no-print">
              <button 
                onClick={() => window.print()}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-md shadow-indigo-200"
              >
                <Printer size={18} />
                <span>طباعة البون [Enter]</span>
              </button>
              <button 
                onClick={() => setCompletedReceipt(null)}
                className="px-5 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors"
              >
                إغلاق [Esc]
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Print Styles */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * {
            visibility: hidden !important;
          }
          #thermal-receipt, #thermal-receipt * {
            visibility: visible !important;
          }
          #thermal-receipt {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            margin: 0 auto !important;
            padding: 8px !important;
            background: white !important;
            border: none !important;
            box-shadow: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}} />
    </div>
  );
};

export default POSPage;
