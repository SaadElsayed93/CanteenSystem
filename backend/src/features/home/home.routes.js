const express = require('express');
const router = express.Router();
const homeController = require('./home.controller');

router.get('/', homeController.getHome);

module.exports = router;
