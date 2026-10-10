import toast from 'react-hot-toast';
import React, { useState, useEffect } from 'react';
import client from '../../api/client';
import { useAuth } from '../auth/AuthContext';

const ReturnsPage = () => {
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoice, setInvoice] = useState(null);
  const [error, setError] = useState('');
  
  const [returnCart, setReturnCart] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [selectedMethodId, setSelectedMethodId] = useState('');
  const [reason, setReason] = useState('');

  const { hasPermission } = useAuth();

  useEffect(() => {
    // Fetch treasury balances for cash refunds
    client.get('/treasury/balances').then(res => {
      setPaymentMethods(res.data.data);
    }).catch(console.error);
    fetchRecentInvoices();
  }, []);

  const fetchRecentInvoices = async () => {
    try {
      const res = await client.get('/sales/invoices');
      setRecentInvoices(res.data.data);
    } catch (err) {
      console.error(err);
    }
  };

  const searchInvoice = async (e) => {
    e.preventDefault();
    if (!invoiceNumber) return;
    try {
      const res = await client.get(`/returns/invoice/${invoiceNumber}`);
      setInvoice(res.data.data);
      setError('');
      // Initialize return cart
      setReturnCart(res.data.data.items.map(i => ({
        ...i,
        returnQty: 0 // Default returning 0
      })));
    } catch (err) {
      setError('الفاتورة غير موجودة');
      setInvoice(null);
    }
  };

    const openInvoiceFromList = (invNumber) => {
    setInvoiceNumber(invNumber);
    client.get(`/returns/invoice/${invNumber}`).then(res => {
      setInvoice(res.data.data);
      setError('');
      setReturnCart(res.data.data.items.map(i => ({
        ...i,
        returnQty: 0
      })));
    }).catch(err => {
      setError('الفاتورة غير موجودة');
      setInvoice(null);
    });
  };

  const handleQtyChange = (itemId, qty) => {
    setReturnCart(cart => cart.map(item => {
      if (item.id === itemId) {
        // Find already returned qty for this item
        const returnedAlready = invoice.returns.reduce((sum, r) => {
          const rit = r.items.find(ri => ri.productId === item.productId);
          return sum + (rit ? Number(rit.quantity) : 0);
        }, 0);
        
        const maxAllowed = item.quantity - returnedAlready;
        let finalQty = Number(qty);
        if (finalQty < 0) finalQty = 0;
        if (finalQty > maxAllowed) finalQty = maxAllowed;
        
        return { ...item, returnQty: finalQty };
      }
      return item;
    }));
  };

  const handleReturnSubmit = async () => {
    const itemsToReturn = returnCart.filter(i => i.returnQty > 0);
    if (itemsToReturn.length === 0) return toast.error('لم تقم بتحديد أي كميات للاسترجاع');
    
    if (invoice.paymentType === 'CASH' && !selectedMethodId) {
      return toast.error('يجب اختيار الخزينة لرد المبلغ النقدي منها');
    }

    const isFull = itemsToReturn.length === returnCart.length && itemsToReturn.every(i => {
      const returnedAlready = invoice.returns.reduce((sum, r) => {
        const rit = r.items.find(ri => ri.productId === i.productId);
        return sum + (rit ? Number(rit.quantity) : 0);
      }, 0);
      return i.returnQty === (i.quantity - returnedAlready);
    });

    try {
      await client.post('/returns', {
        invoiceId: invoice.id,
        type: isFull ? 'FULL' : 'PARTIAL',
        reason,
        paymentMethodId: selectedMethodId ? Number(selectedMethodId) : null,
        returnItems: itemsToReturn.map(i => ({
          invoiceItemId: i.id,
          productId: i.productId,
          quantity: i.returnQty
        }))
      });
      toast.error('تم تنفيذ المرتجع بنجاح');
      setInvoice(null);
      setInvoiceNumber('');
      setReason('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'خطأ في الاسترجاع');
    }
  };

  const returnTotal = invoice ? returnCart.reduce((sum, item) => sum + (Number(item.returnQty) * Number(item.unitPrice)), 0) : 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header & Unified Search */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border-2 border-gray-200 text-center">
        <h2 className="text-2xl font-black text-gray-800 mb-2">🔄 إدارة المرتجعات</h2>
        <p className="text-gray-500 text-sm mb-6">ابحث برقم الفاتورة، اسم المريض، أو أي صنف داخل الفاتورة</p>
        
        <div className="relative max-w-2xl mx-auto">
          <input 
            type="text" 
            placeholder="🔍 ابحث هنا (مثال: شيبسي، سعدون، INV-123)..." 
            className="w-full border-2 border-indigo-200 rounded-xl p-4 text-lg font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-inner bg-gray-50 focus:bg-white text-center"
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)} 
          />
        </div>
      </div>

      {/* Recent Invoices List (Only show if no invoice is selected, or maybe always show above?) */}
      {!invoice && (
        <div className="bg-white rounded-2xl shadow-sm border-2 border-gray-200 p-6">
          <h3 className="text-lg font-black text-gray-800 mb-4">آخر الفواتير المسجلة</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentInvoices.filter(inv => {
              const term = searchTerm.toLowerCase();
              return inv.invoiceNumber.toLowerCase().includes(term) ||
                     (inv.patient && inv.patient.fullName.toLowerCase().includes(term)) ||
                     inv.items.some(i => i.product.name.toLowerCase().includes(term));
            }).map(inv => (
              <div 
                key={inv.id} 
                onClick={() => openInvoiceFromList(inv.invoiceNumber)}
                className="p-4 rounded-xl border-2 cursor-pointer transition-all hover:border-indigo-500 hover:shadow-md border-gray-100 bg-gray-50 hover:bg-indigo-50"
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="font-bold text-gray-800 text-sm">{inv.invoiceNumber}</span>
                  <span className="text-xs font-bold text-indigo-600 bg-indigo-100 px-2 py-1 rounded">{inv.totalAmount} ج.م</span>
                </div>
                <div className="text-xs text-gray-500 font-bold mb-2">
                  {inv.paymentType === 'CASH' ? '💵 نقدي' : `📝 ${inv.patient?.fullName || 'آجل'}`}
                </div>
                <div className="text-xs text-gray-400 line-clamp-2">
                  📦 {inv.items.map(i => i.product.name).join('، ')}
                </div>
                <div className="text-xs text-gray-400 mt-2 text-left" dir="ltr">
                  {new Date(inv.createdAt).toLocaleString('ar-EG')}
                </div>
              </div>
            ))}
            {recentInvoices.length === 0 && <div className="col-span-full text-center text-gray-400 font-bold py-10">لا توجد فواتير مطابقة</div>}
          </div>
        </div>
      )}

      {/* Selected Invoice Details & Return Form */}
      {invoice && (
        <div className="bg-white p-8 rounded-2xl shadow-sm border-2 border-indigo-200 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-black text-indigo-900">تفاصيل الفاتورة وتحديد المرتجع</h2>
            <button onClick={() => setInvoice(null)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg transition-colors">
              رجوع للقائمة
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 bg-indigo-50 p-6 rounded-xl border-2 border-indigo-100">
            <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-100">
              <div className="text-xs text-gray-500 mb-1">رقم الفاتورة</div>
              <div className="font-bold text-gray-800 text-sm md:text-base">{invoice.invoiceNumber}</div>
            </div>
            <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-100">
              <div className="text-xs text-gray-500 mb-1">التاريخ</div>
              <div className="font-bold text-gray-800 text-sm">{new Date(invoice.createdAt).toLocaleString('ar-EG')}</div>
            </div>
            <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-100">
              <div className="text-xs text-gray-500 mb-1">نوع الدفع</div>
              <div className="font-bold text-gray-800 text-sm">{invoice.paymentType === 'CASH' ? 'نقدي' : 'آجل (مديونية)'}</div>
            </div>
            <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-100">
              <div className="text-xs text-gray-500 mb-1">الإجمالي الأصلي</div>
              <div className="font-black text-indigo-700 text-lg">{invoice.totalAmount} ج.م</div>
            </div>
          </div>

          <h3 className="font-bold text-gray-700 mb-4 text-lg border-b-2 border-gray-100 pb-2 inline-block">الأصناف (حدد الكمية المرتجعة)</h3>
          
          <div className="overflow-x-auto mb-8">
            <table className="w-full text-right border-collapse">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="p-4 border-b font-bold rounded-tr-xl">الصنف</th>
                  <th className="p-4 border-b font-bold text-center">الكمية المباعة</th>
                  <th className="p-4 border-b font-bold text-center">تم إرجاعه سابقاً</th>
                  <th className="p-4 border-b font-bold text-center">السعر</th>
                  <th className="p-4 border-b font-bold text-center rounded-tl-xl bg-indigo-100 text-indigo-900">الكمية المرتجعة الآن</th>
                </tr>
              </thead>
              <tbody>
                {returnCart.map(item => {
                  const returnedAlready = invoice.returns.reduce((sum, r) => {
                    const rit = r.items.find(ri => ri.productId === item.productId);
                    return sum + (rit ? Number(rit.quantity) : 0);
                  }, 0);
                  const maxAllowed = item.quantity - returnedAlready;
                  
                  const returnTotal = invoice ? returnCart.reduce((sum, item) => sum + (Number(item.returnQty) * Number(item.unitPrice)), 0) : 0;

  return (
                    <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="p-4 font-bold text-gray-800">{item.product.name}</td>
                      <td className="p-4 text-center font-bold text-gray-600">{item.quantity}</td>
                      <td className="p-4 text-center font-bold text-red-500">{returnedAlready}</td>
                      <td className="p-4 text-center font-bold text-gray-600">{item.unitPrice}</td>
                      <td className="p-4 bg-indigo-50/50">
                        <div className="flex justify-center items-center gap-3">
                          <button 
                            type="button" 
                            onClick={() => handleQtyChange(item.id, item.returnQty - 1)}
                            className="w-8 h-8 rounded-full bg-white border-2 border-indigo-200 text-indigo-600 font-bold hover:bg-indigo-100 flex items-center justify-center transition-colors"
                          >-</button>
                          <input 
                            type="number" 
                            min="0" 
                            max={maxAllowed} 
                            value={item.returnQty}
                            onChange={(e) => handleQtyChange(item.id, e.target.value)}
                            className="w-16 text-center border-2 border-indigo-200 rounded-lg p-1 font-bold outline-none focus:border-indigo-500"
                          />
                          <button 
                            type="button" 
                            onClick={() => handleQtyChange(item.id, item.returnQty + 1)}
                            className="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold hover:bg-indigo-700 flex items-center justify-center shadow-md transition-colors"
                          >+</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-gray-50 p-6 rounded-xl border border-gray-200">
            <div className="space-y-4">
              <div>
                <label className="block mb-2 font-bold text-gray-700">سبب المرتجع (اختياري)</label>
                <textarea 
                  className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-indigo-500 transition-all bg-white"
                  value={reason} 
                  onChange={e => setReason(e.target.value)}
                  placeholder="مثال: تالف، خطأ في الطلب..."
                  rows="3"
                ></textarea>
              </div>

              {invoice.paymentType === 'CASH' && returnTotal > 0 && (
                <div>
                  <label className="block mb-2 font-bold text-gray-700">سحب مبلغ المرتجع من (الخزينة): <span className="text-red-500">*</span></label>
                  <select 
                    required
                    className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-indigo-500 bg-white font-bold"
                    value={selectedMethodId}
                    onChange={e => setSelectedMethodId(e.target.value)}
                  >
                    <option value="">-- اختر الخزينة --</option>
                    {paymentMethods.map(pm => (
                      <option key={pm.id} value={pm.id}>{pm.name} (المتاح: {pm.currentBalance})</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex flex-col justify-center bg-white p-6 rounded-xl shadow-sm border-2 border-indigo-100">
              <div className="text-center mb-6">
                <div className="text-gray-500 font-bold mb-1">إجمالي قيمة المرتجع الحالي</div>
                <div className="text-4xl font-black text-red-600">{returnTotal} ج.م</div>
                {invoice.paymentType !== 'CASH' && returnTotal > 0 && (
                  <div className="mt-2 text-sm font-bold text-indigo-600 bg-indigo-50 p-2 rounded-lg inline-block">
                    سيتم خصم هذا المبلغ من مديونية المريض ({invoice.patient?.fullName}) تلقائياً.
                  </div>
                )}
              </div>
              <button 
                onClick={handleReturnSubmit}
                disabled={returnTotal === 0 || (invoice.paymentType === 'CASH' && !selectedMethodId)}
                className="w-full bg-red-600 text-white font-bold px-6 py-4 rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-200 disabled:opacity-50 disabled:cursor-not-allowed text-lg"
              >
                تأكيد المرتجع
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReturnsPage;
