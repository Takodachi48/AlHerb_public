const express = require('express');
const { asyncHandler } = require('../middleware/asyncHandler');
const siteAssetController = require('../controllers/siteAssetController');

const router = express.Router();

router.get('/landing', asyncHandler(siteAssetController.getLandingAssetsPublic));

module.exports = router;
