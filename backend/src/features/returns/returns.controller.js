const returnsService = require('./returns.service');

const getInvoice = async (req, res, next) => {
  try {
    const invoice = await returnsService.getInvoiceByNumber(req.params.invoiceNumber);
    if (!invoice) return res.status(404).json({ success: false, message: 'الفاتورة غير موجودة' });
    res.json({ success: true, data: invoice });
  } catch (error) {
    next(error);
  }
};

const makeReturn = async (req, res, next) => {
  try {
    const returnData = await returnsService.createReturn(req.body, req.user.id);
    res.status(201).json({ success: true, message: 'تم حفظ المرتجع بنجاح', data: returnData });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

module.exports = { getInvoice, makeReturn };
