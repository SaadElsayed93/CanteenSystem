const salesService = require('./sales.service');

const getPosData = async (req, res, next) => {
  try {
    const data = await salesService.getPosData();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const checkout = async (req, res, next) => {
  try {
    const invoice = await salesService.createSale(req.body, req.user.id);
    res.status(201).json({ success: true, message: 'تم حفظ الفاتورة بنجاح', data: invoice });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};



const getInvoiceById = async (req, res, next) => {
  try {
    const invoice = await salesService.getInvoiceById(req.params.id);
    res.json({ success: true, data: invoice });
  } catch (err) {
    next(err);
  }
};

const getRecentInvoices = async (req, res, next) => {
  try {
    const invoices = await salesService.getRecentInvoices();
    res.json({ success: true, data: invoices });
  } catch (err) {
    next(err);
  }
};

module.exports = { getPosData, checkout, getInvoiceById, getRecentInvoices };
