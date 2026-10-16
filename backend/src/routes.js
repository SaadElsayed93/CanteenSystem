const express = require('express');
const { authMiddleware } = require('./common/middleware/auth');
const router = express.Router();
const authRoutes = require('./features/auth/auth.routes');
const usersRoutes = require('./features/users/users.routes');
const productsRoutes = require('./features/products/products.routes');
const purchasesRoutes = require('./features/purchases/purchases.routes');
const salesRoutes = require('./features/sales/sales.routes');
const patientsRoutes = require('./features/patients/patients.routes');
const treasuryRoutes = require('./features/treasury/treasury.routes');
const returnsRoutes = require('./features/returns/returns.routes');
const auditRoutes = require('./features/audit-logs/audit.routes');
const reportsRoutes = require('./features/reports/reports.routes');
const homeRoutes = require('./features/home/home.routes');
const shiftsRoutes = require('./features/shifts/shifts.routes');

router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/products', productsRoutes);
router.use('/purchases', purchasesRoutes);
router.use('/sales', salesRoutes);
router.use('/patients', patientsRoutes);
router.use('/treasury', treasuryRoutes);
router.use('/returns', returnsRoutes);
router.use('/audit-logs', auditRoutes);
router.use('/reports', reportsRoutes);
router.use('/home', authMiddleware, homeRoutes);
router.use('/shifts', shiftsRoutes);

module.exports = router;

