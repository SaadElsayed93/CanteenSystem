const treasuryService = require('./treasury.service');

const getBalances = async (req, res, next) => {
  try {
    const balances = await treasuryService.getPaymentMethods();
    res.json({ success: true, data: balances });
  } catch (error) {
    next(error);
  }
};

const getTransactions = async (req, res, next) => {
  try {
    const { paymentMethodId } = req.query;
    const transactions = await treasuryService.getTreasuryTransactions(paymentMethodId);
    res.json({ success: true, data: transactions });
  } catch (error) {
    next(error);
  }
};

const getExpCategories = async (req, res, next) => {
  try {
    const categories = await treasuryService.getExpenseCategories();
    res.json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
};

const getExpensesList = async (req, res, next) => {
  try {
    const expenses = await treasuryService.getExpenses();
    res.json({ success: true, data: expenses });
  } catch (error) {
    next(error);
  }
};

const addExpense = async (req, res, next) => {
  try {
    const expense = await treasuryService.createExpense(req.body, req.user.id);
    res.status(201).json({ success: true, message: 'تم تسجيل المصروف بنجاح', data: expense });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

module.exports = { getBalances, getTransactions, getExpCategories, getExpensesList, addExpense };
