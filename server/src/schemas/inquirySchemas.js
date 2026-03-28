const Joi = require('joi');

const emailSchema = Joi.string().trim().email().max(255);
const phoneSchema = Joi.string().trim().pattern(/^\+?[0-9()\-\s]{7,25}$/);

const createInquirySchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  contactType: Joi.string().valid('email', 'phone').required(),
  contactValue: Joi.when('contactType', {
    is: 'email',
    then: emailSchema.required(),
    otherwise: phoneSchema.required(),
  }),
  message: Joi.string().trim().min(5).max(1000).required(),
  captchaToken: Joi.string().trim().allow('').max(4000),
});

module.exports = {
  createInquirySchema,
};

