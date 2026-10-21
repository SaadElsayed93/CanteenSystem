const productsService = require('./products.service');

const getAll = async (req, res, next) => {
  try {
    const products = await productsService.getAllProducts();
    res.json({ success: true, data: products });
  } catch (error) {
    next(error);
  }
};

const getById = async (req, res, next) => {
  try {
    const product = await productsService.getProductById(Number(req.params.id));
    if (!product) return res.status(404).json({ success: false, message: 'الصنف غير موجود' });
    res.json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

const getExpiryAlerts = async (req, res, next) => {
  try {
    const alerts = await productsService.getExpiryAlerts();
    res.json({ success: true, data: alerts });
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const product = await productsService.createProduct(req.body, req.user.id);
    res.status(201).json({ success: true, message: 'تم إضافة الصنف بنجاح', data: product });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const update = async (req, res, next) => {
  try {
    const product = await productsService.updateProduct(Number(req.params.id), req.body, req.user.id);
    res.json({ success: true, message: 'تم تحديث الصنف بنجاح', data: product });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const adjust = async (req, res, next) => {
  try {
    const { quantity, type, reason } = req.body;
    const movement = await productsService.adjustInventory(Number(req.params.id), quantity, type, reason, req.user.id);
    res.json({ success: true, message: 'تم تعديل المخزون بنجاح', data: movement });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

module.exports = { getAll, getById, getExpiryAlerts, create, update, adjust };
