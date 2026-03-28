const express = require('express');
const { asyncHandler } = require('../middleware/asyncHandler');
const { validateRequest } = require('../middleware/validateRequest');
const inquiryController = require('../controllers/inquiryController');
const { createInquirySchema } = require('../schemas/inquirySchemas');

const router = express.Router();

// POST /api/inquiries - Submit an inquiry
router.post('/', validateRequest(createInquirySchema), asyncHandler(inquiryController.submitInquiry));

module.exports = router;
