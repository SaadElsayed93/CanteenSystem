const express = require('express');
const router = express.Router();
const shiftsController = require('./shifts.controller');
const { authMiddleware } = require('../../common/middleware/auth');

router.use(authMiddleware);

router.get('/current', shiftsController.getCurrentShift);
router.post('/open', shiftsController.openShift);
router.post('/close', shiftsController.closeShift);
router.get('/history', shiftsController.getShiftsHistory);

module.exports = router;
