const purchasesService = require('./purchases.service');

const getSuppliers = async (req, res, next) => {
  try {
    const suppliers = await purchasesService.getAllSuppliers();
    const data = suppliers.map(s => {
      // Calculate total debt for this supplier
      const totalDebt = s.purchases.reduce((acc, p) => acc + (Number(p.totalAmount) - Number(p.paidAmount)), 0);
      return { ...s, totalDebt };
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const createSupplier = async (req, res, next) => {
  try {
    const supplier = await purchasesService.createSupplier(req.body);
    res.status(201).json({ success: true, message: 'تمت إضافة المورد', data: supplier });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const toggleSupplierStatus = async (req, res, next) => {
  try {
    const supplier = await purchasesService.updateSupplierStatus(Number(req.params.id), req.body.isActive);
    res.json({ success: true, message: 'تم تحديث حالة المورد', data: supplier });
  } catch (error) {
    next(error);
  }
};

const createPurchase = async (req, res, next) => {
  try {
    const purchase = await purchasesService.createPurchase(req.body, req.user.id);
    res.status(201).json({ success: true, message: 'تم تسجيل فاتورة الشراء بنجاح', data: purchase });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const paySupplier = async (req, res, next) => {
  try {
    const payment = await purchasesService.paySupplier(req.body, req.user.id);
    res.json({ success: true, message: 'تم تسجيل الدفعة بنجاح', data: payment });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

module.exports = { getSuppliers, createSupplier, toggleSupplierStatus, createPurchase, paySupplier };

exports.getPurchaseById = async (req, res, next) => {
  try {
    const purchase = await purchasesService.getPurchaseById(req.params.id);
    res.json({ success: true, data: purchase });
  } catch (err) {
    next(err);
  }
};
