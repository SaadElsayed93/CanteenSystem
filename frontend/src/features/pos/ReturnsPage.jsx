import React, { useState, useEffect } from 'react';
import client from '../../api/client';
import { useAuth } from '../auth/AuthContext';

const ReturnsPage = () => {
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
  }, []);

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
    if (itemsToReturn.length === 0) return alert('لم تقم بتحديد أي كميات للاسترجاع');
    
    if (invoice.paymentType === 'CASH' && !selectedMethodId) {
      return alert('يجب اختيار الخزينة لرد المبلغ النقدي منها');
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
      alert('تم تنفيذ المرتجع بنجاح');
      setInvoice(null);
      setInvoiceNumber('');
      setReason('');
    } catch (err) {
      alert(err.response?.data?.message || 'خطأ في الاسترجاع');
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">المرتجعات (Returns)</h2>

      <div className="bg-white p-6 rounded shadow mb-6 max-w-xl">
        <form onSubmit={searchInvoice} className="flex gap-2">
          <input 
            type="text" 
            placeholder="أدخل رقم الفاتورة للبحث (مثال: INV-12345)" 
            className="flex-1 border rounded p-3 text-lg"
            value={invoiceNumber}
            onChange={e => setInvoiceNumber(e.target.value)}
          />
          <button type="submit" className="bg-blue-600 text-white px-6 rounded">بحث</button>
        </form>
        {error && <div className="text-red-600 mt-2 font-bold">{error}</div>}
      </div>

      {invoice && (
        <div className="bg-white p-6 rounded shadow">
          <div className="grid grid-cols-2 gap-4 mb-6 text-lg">
            <div><strong>رقم الفاتورة:</strong> {invoice.invoiceNumber}</div>
            <div><strong>التاريخ:</strong> {new Date(invoice.createdAt).toLocaleString('ar-EG')}</div>
            <div>
              <strong>نوع الدفع:</strong> {invoice.paymentType === 'CASH' ? 'نقدي' : 'آجل'}
            </div>
            <div>
              <strong>حالة الفاتورة:</strong> 
              <span className={`mr-2 font-bold ${invoice.status === 'REFUNDED' ? 'text-red-600' : 'text-green-600'}`}>
                {invoice.status === 'REFUNDED' ? 'مسترجعة' : 'مكتملة'}
              </span>
            </div>
            {invoice.patient && (
              <div className="col-span-2">
                <strong>العميل (المريض):</strong> {invoice.patient.fullName} (الرصيد: {invoice.patient.currentDebt})
              </div>
            )}
          </div>

          <h3 className="font-bold mb-4 text-xl border-b pb-2">أصناف الفاتورة للاسترجاع</h3>
          <table className="w-full text-right mb-6">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-3 border-b">الصنف</th>
                <th className="p-3 border-b">الكمية المباعة</th>
                <th className="p-3 border-b">مرتجع سابق</th>
                <th className="p-3 border-b">السعر</th>
                <th className="p-3 border-b bg-red-50 text-red-700">كمية الإسترجاع الآن</th>
                <th className="p-3 border-b">إجمالي الاسترجاع</th>
              </tr>
            </thead>
            <tbody>
              {returnCart.map(item => {
                const returnedAlready = invoice.returns.reduce((sum, r) => {
                  const rit = r.items.find(ri => ri.productId === item.productId);
                  return sum + (rit ? Number(rit.quantity) : 0);
                }, 0);
                
                const returnSubtotal = item.returnQty * item.unitPrice;
                
                return (
                  <tr key={item.id}>
                    <td className="p-3 border-b">{item.product.name}</td>
                    <td className="p-3 border-b font-bold">{item.quantity}</td>
                    <td className="p-3 border-b text-red-600">{returnedAlready}</td>
                    <td className="p-3 border-b">{item.unitPrice}</td>
                    <td className="p-3 border-b bg-red-50">
                      <input 
                        type="number" 
                        className="w-20 border rounded p-1 text-center"
                        value={item.returnQty === 0 ? '' : item.returnQty}
                        placeholder="0"
                        disabled={invoice.status === 'REFUNDED' || item.quantity - returnedAlready === 0}
                        onChange={e => handleQtyChange(item.id, e.target.value)}
                      />
                    </td>
                    <td className="p-3 border-b font-bold text-red-600">{returnSubtotal}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {invoice.status !== 'REFUNDED' && (
            <div className="bg-gray-50 p-4 rounded border">
              <div className="mb-4">
                <label className="block font-bold mb-2">سبب الاسترجاع (اختياري):</label>
                <input type="text" className="w-full border p-2 rounded" value={reason} onChange={e => setReason(e.target.value)} />
              </div>
              
              {invoice.paymentType === 'CASH' && (
                <div className="mb-4">
                  <label className="block font-bold mb-2 text-red-600">خصم مبلغ المرتجع النقدي من الخزينة:</label>
                  <select required className="w-full border rounded p-2" value={selectedMethodId} onChange={e => setSelectedMethodId(e.target.value)}>
                    <option value="">اختر الخزينة...</option>
                    {paymentMethods.map(m => <option key={m.id} value={m.id}>{m.name} (متاح: {m.currentBalance})</option>)}
                  </select>
                </div>
              )}

              {invoice.paymentType === 'CREDIT' && (
                <div className="mb-4 text-green-600 font-bold">
                  * سيتم إضافة مبلغ الاسترجاع إلى رصيد المريض بشكل تلقائي ولن يتأثر رصيد الخزينة.
                </div>
              )}

              <div className="text-left">
                <button onClick={handleReturnSubmit} className="bg-red-600 text-white px-8 py-3 rounded text-lg hover:bg-red-700 shadow">
                  تأكيد المرتجع
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ReturnsPage;
