import toast from 'react-hot-toast';
import React, { useState, useEffect, useRef } from 'react';
import client from '../../api/client';
import { useAuth } from '../auth/AuthContext';
import { 
  Trash2, Printer, Zap, CheckCircle2, X, ShoppingCart, 
  Search, AlertTriangle, User, CreditCard, RotateCcw,
  Lock, Unlock
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
      setProducts(res.data.data.products);
      
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
    if (!search) return p.totalStock > 0;
    const match = p.name.includes(search) || p.internalCode.includes(search) || (p.barcode && p.barcode.includes(search));
    return match;
  });

  const handleBarcodeSearch = (e) => {
    e.preventDefault();
    if (!search.trim()) return;
    
    // Exact match on barcode or internal code
    const exactProduct = products.find(p => p.barcode === search.trim() || p.internalCode === search.trim());
    
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
        // If search filtered down to exactly 1 product and user hit Enter
        addToCart(filteredProducts[0]);
        playTone(900, 0.07);
        setSearch('');
      }
    }
  };

  const addToCart = (product) => {
    if (product.isExpired) {
      playTone(280, 0.2, 'square');
      toast.error(`⚠️ تحذير: الصنف (${product.name}) منتهي الصلاحية!`, { duration: 3500 });
    } else if (product.isExpiringSoon) {
      toast(`⏳ تنبيه: الصنف (${product.name}) أوشكت صلاحيته على الانتهاء (${product.daysUntilExpiry} يوم متبقي)`, {
        duration: 3000
      });
    }

    if (product.totalStock <= 0) {
      playTone(450, 0.1, 'triangle');
      toast((t) => (
        <div className="flex items-center gap-2.5">
          <span className="text-lg">📦</span>
          <div>
            <div className="text-xs font-black text-white">تنبيه: {product.name} (رصيد المخزون صفر)</div>
            <div className="text-[11px] text-amber-300 font-bold">تمت إضافته للسلة وسيتم تسجيل البيع بالسالب</div>
          </div>
        </div>
      ), {
        id: `stock-alert-${product.id}`,
        duration: 2500,
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
      return [...prev, { productId: product.id, name: product.name, price: Number(product.sellingPrice), quantity: 1, maxStock: product.totalStock }];
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

      // Prepare receipt data
      const selectedPatient = patients.find(p => p.id === Number(patientId));
      const receipt = {
        invoiceNumber: invoiceData.invoiceNumber || `INV-${invoiceData.id}`,
        items: [...cart],
        total: totalAmount,
        type: typeToUse,
        patientName: typeToUse === 'CREDIT' ? (selectedPatient?.fullName || selectedPatient?.name) : null,
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
            <kbd className="bg-white px-1.5 py-0.5 rounded shadow-sm text-xs border">F2</kbd> البحث / الباركود
          </span>
          <span className="bg-amber-50 text-amber-700 px-3 py-1 rounded-lg font-bold border border-amber-100 flex items-center gap-1">
            <kbd className="bg-white px-1.5 py-0.5 rounded shadow-sm text-xs border">F4</kbd> تبديل (كاش / حساب المريض)
          </span>
          <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-lg font-bold border border-emerald-100 flex items-center gap-1">
            <kbd className="bg-white px-1.5 py-0.5 rounded shadow-sm text-xs border">F9</kbd> إنهاء كاش فوري
          </span>
          <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-lg font-bold flex items-center gap-1">
            <kbd className="bg-white px-1.5 py-0.5 rounded shadow-sm text-xs border">Esc</kbd> مسح / رجوع
          </span>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Shift Status Badge */}
          {isOpen ? (
            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full text-xs font-black flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              وردية نشطة #{currentShift?.shiftNumber}
            </span>
          ) : (
            <button
              onClick={() => setIsOpeningModal(true)}
              className="bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 px-3 py-1 rounded-full text-xs font-black flex items-center gap-1 transition"
            >
              <Lock size={12} />
              اليومية مغلقة (اضغط لفتحها)
            </button>
          )}

          {/* Show receipt toggle */}
          <button 
            onClick={toggleShowReceipt}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl font-bold transition-all border ${
              showReceiptModal 
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
            }`}
            title="تفعيل أو إخفاء نافذة بون الفاتورة بعد إتمام البيع"
          >
            <Printer size={16} />
            <span>إظهار بون الفاتورة:</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${showReceiptModal ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
              {showReceiptModal ? 'مفعل' : 'معطل'}
            </span>
          </button>
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
          <div className="bg-white p-5 shadow-sm border-2 border-gray-100 rounded-2xl">
            <form onSubmit={handleBarcodeSearch} className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute right-4 top-4 text-gray-400" size={24} />
                <input 
                  ref={barcodeInputRef}
                  type="text" 
                  placeholder="مرر الباركود أو ابحث بالاسم أو الكود الداخلي... [اضغط F2 للتركيز]" 
                  className="w-full pr-12 pl-4 py-3.5 border-2 border-gray-200 rounded-xl text-lg outline-none focus:border-indigo-500 focus:bg-white bg-gray-50/50 font-bold transition-all"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  autoFocus
                />
                {search && (
                  <button 
                    type="button" 
                    onClick={() => setSearch('')}
                    className="absolute left-4 top-4 text-gray-400 hover:text-gray-600"
                  >
                    <X size={20} />
                  </button>
                )}
              </div>
              <button 
                type="submit" 
                className="bg-indigo-600 hover:bg-indigo-700 transition-colors text-white font-bold px-8 rounded-xl shadow-md shadow-indigo-200 flex items-center gap-2"
              >
                بحث
              </button>
            </form>
          </div>

          <div className="bg-white p-6 shadow-sm border-2 border-gray-100 rounded-2xl flex-1 overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-black text-gray-800">الأصناف المتوفرة ({filteredProducts.length})</h3>
              <span className="text-xs text-gray-400 font-bold">نقرة واحدة لإضافة الصنف للسلة</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredProducts.map(p => (
                <div 
                  key={p.id} 
                  onClick={() => addToCart(p)}
                  className={`border-2 rounded-2xl p-4 text-center cursor-pointer transition-all group flex flex-col justify-between relative ${
                    p.isExpired 
                      ? 'border-red-200 bg-red-50/20 hover:bg-red-50 hover:border-red-300' 
                      : p.isExpiringSoon 
                      ? 'border-amber-200 bg-amber-50/20 hover:bg-amber-50 hover:border-amber-300' 
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
                      باقي {p.daysUntilExpiry} يوم
                    </div>
                  )}

                  <div>
                    <div className="font-bold text-gray-800 mb-1 group-hover:text-indigo-900 transition-colors line-clamp-1">{p.name}</div>
                    <div className="text-xs text-gray-400 font-bold mb-2">{p.internalCode}</div>
                  </div>
                  <div>
                    <div className="text-indigo-600 font-black text-xl mb-2">{p.sellingPrice} <span className="text-sm font-bold text-gray-500">ج.م</span></div>
                    <div className={`text-xs px-2.5 py-1 inline-block rounded-lg font-bold ${
                      p.totalStock <= 0 
                        ? 'bg-red-100 text-red-700' 
                        : p.totalStock <= 10 
                        ? 'bg-amber-100 text-amber-700' 
                        : 'bg-emerald-50 text-emerald-700'
                    }`}>
                      المخزون: {p.totalStock}
                    </div>
                  </div>
                </div>
              ))}
              {filteredProducts.length === 0 && (
                <div className="col-span-full text-center py-12 text-gray-400 font-bold">
                  لا توجد أصناف مطابقة للبحث
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Cart & Checkout Section */}
        <div className="md:w-1/3 bg-white p-6 shadow-sm border-2 border-gray-100 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-4">
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
            
            <div className="max-h-[38vh] overflow-y-auto mb-4 pr-1">
              {cart.length === 0 ? (
                <div className="text-gray-400 flex flex-col items-center justify-center py-16">
                  <ShoppingCart size={48} className="text-gray-300 mb-3" />
                  <span className="font-bold text-gray-400">السلة فارغة</span>
                  <span className="text-xs text-gray-400 mt-1">اضغط على أي صنف لإضافته</span>
                </div>
              ) : (
                <table className="w-full text-right border-collapse">
                  <tbody>
                    {cart.map(item => (
                      <tr key={item.productId} className="border-b border-gray-50 hover:bg-gray-50/80 transition-colors">
                        <td className="py-3 pr-1 w-2/5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-gray-800 text-sm line-clamp-1">{item.name}</span>
                            {item.maxStock <= 0 && (
                              <span className="text-[10px] bg-rose-100 text-rose-700 border border-rose-200 px-1.5 py-0.2 rounded font-black whitespace-nowrap">
                                سالب
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-400 font-bold">{item.price} ج.م</div>
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl w-fit">
                            <button 
                              onClick={() => updateQuantity(item.productId, item.quantity - 1)} 
                              className="bg-white hover:bg-gray-200 w-7 h-7 rounded-lg flex items-center justify-center text-gray-700 transition-colors font-bold shadow-sm"
                            >
                              -
                            </button>
                            <input 
                              type="number" 
                              min="1"
                              className="w-12 text-center font-black bg-white rounded-lg py-1 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-800 text-sm"
                              value={item.quantity}
                              onChange={(e) => updateQuantity(item.productId, e.target.value)}
                            />
                            <button 
                              onClick={() => updateQuantity(item.productId, item.quantity + 1)} 
                              className="bg-white hover:bg-gray-200 w-7 h-7 rounded-lg flex items-center justify-center text-gray-700 transition-colors font-bold shadow-sm"
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td className="py-3 font-black text-indigo-700 text-sm text-left pl-2">
                          {item.price * item.quantity} ج
                        </td>
                        <td className="py-3 pl-1 text-left w-6">
                          <button 
                            onClick={() => removeFromCart(item.productId)} 
                            className="text-gray-300 hover:text-red-500 font-bold transition-colors"
                          >
                            <X size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <div className="flex justify-between items-center mb-4 bg-indigo-50/60 p-4 rounded-2xl border border-indigo-100">
              <span className="text-base font-bold text-gray-700">إجمالي الفاتورة:</span>
              <span className="text-3xl font-black text-indigo-700">{totalAmount} <span className="text-base font-bold text-indigo-500">ج.م</span></span>
            </div>

            <div className="mb-4">
              <label className="block mb-2 font-bold text-gray-700 text-xs flex justify-between items-center">
                <span>طريقة الدفع:</span>
                <span className="text-gray-400 font-normal">اضغط F4 للتبديل</span>
              </label>
              <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
                <button 
                  type="button"
                  onClick={() => { setInvoiceType('CASH'); setPatientId(''); }}
                  className={`flex-1 py-2.5 rounded-lg font-bold transition-all text-sm flex items-center justify-center gap-2 ${
                    invoiceType === 'CASH' ? 'bg-white shadow-sm text-indigo-700' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <CreditCard size={16} />
                  نقدي (كاش)
                </button>
                <button 
                  type="button"
                  onClick={() => setInvoiceType('CREDIT')}
                  className={`flex-1 py-2.5 rounded-lg font-bold transition-all text-sm flex items-center justify-center gap-2 ${
                    invoiceType === 'CREDIT' ? 'bg-white shadow-sm text-indigo-700' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <User size={16} />
                  على حساب المريض
                </button>
              </div>
            </div>

            {invoiceType === 'CREDIT' && (
              <div className="mb-4 animate-in fade-in duration-200">
                <label className="block mb-1.5 font-bold text-gray-700 text-xs">تحديد المريض المستلم:</label>
                <select 
                  className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-indigo-500 bg-white font-bold text-sm text-gray-800" 
                  value={patientId} 
                  onChange={e => setPatientId(e.target.value)}
                >
                  <option value="">-- اختر اسم المريض --</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name || p.fullName} — (الرصيد: {p.currentDebt} ج)
                    </option>
                  ))}
                </select>
                {patientId && (
                  <div className="text-xs mt-2 bg-amber-50 text-amber-800 p-2.5 rounded-xl border border-amber-200 font-bold">
                    سيتم قيد مبلغ {totalAmount} ج.م على حساب المريض المختار.
                  </div>
                )}
              </div>
            )}

            {!isOpen ? (
              <button 
                type="button"
                onClick={() => setIsOpeningModal(true)} 
                className="w-full bg-rose-600 text-white font-black py-4 rounded-xl text-base hover:bg-rose-700 transition-all shadow-lg shadow-rose-200 flex items-center justify-center gap-2"
              >
                <Lock size={20} />
                <span>اليومية مغلقة - اضغط لفتح اليومية للبيع</span>
              </button>
            ) : (
              <button 
                onClick={() => handleCheckout()} 
                disabled={cart.length === 0 || isSubmitting}
                className="w-full bg-indigo-600 text-white font-black py-4 rounded-xl text-lg hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={22} />
                <span>{isSubmitting ? 'جاري التأكيد...' : 'تأكيد وحفظ الفاتورة [F9]'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ================= Thermal Receipt Modal ================= */}
      {completedReceipt && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-sm flex flex-col max-h-[90vh]">
            
            {/* Action Bar (Top) */}
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-100 no-print">
              <span className="font-black text-gray-800 text-base flex items-center gap-2">
                <Printer className="text-indigo-600" size={20} />
                بون الفاتورة
              </span>
              <button 
                onClick={() => setCompletedReceipt(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            {/* Printable Thermal Receipt Container */}
            <div id="thermal-receipt" className="flex-1 overflow-y-auto bg-gray-50/50 p-4 rounded-2xl border border-dashed border-gray-300 font-mono text-gray-800">
              <div className="text-center mb-3">
                <h2 className="text-sm font-black text-gray-900 tracking-wide">المستشفى العسكري ق.م بالإسماعيلية</h2>
                <p className="text-xs text-gray-600 font-sans font-black mt-0.5">إدارة الكانتين والخدمات</p>
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
                      <td className="py-1 text-left font-mono">{item.price * item.quantity} ج</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="border-b-2 border-dashed border-gray-300 my-2"></div>

              {/* Total */}
              <div className="flex justify-between items-center text-sm font-sans font-black py-1">
                <span>الإجمالي الصافي:</span>
                <span className="text-lg font-mono">{completedReceipt.total} ج.م</span>
              </div>

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
