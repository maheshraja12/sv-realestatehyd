/**
 * Input validation helpers
 */
const xss = require('xss');

const xssOptions = {
    whiteList: {},
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style']
};

function sanitize(input) {
    if (typeof input !== 'string') return input;
    return xss(input.trim(), xssOptions);
}

function sanitizeObject(obj) {
    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
            cleaned[key] = sanitize(value);
        } else {
            cleaned[key] = value;
        }
    }
    return cleaned;
}

function validatePhone(phone) {
    if (!phone) return false;
    const cleaned = String(phone).replace(/[^0-9]/g, '');
    return cleaned.length >= 10 && cleaned.length <= 15;
}

function validateEmail(email) {
    if (!email) return true; // Optional
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateRequired(fields, body) {
    const errors = [];
    for (const field of fields) {
        if (!body[field] || (typeof body[field] === 'string' && body[field].trim() === '')) {
            errors.push(`${field.replace(/_/g, ' ')} is required`);
        }
    }
    return errors;
}

function validatePropertyData(body) {
    const errors = [];
    
    if (!body.title || body.title.trim().length < 3) {
        errors.push('Property title must be at least 3 characters');
    }
    if (!body.category) {
        errors.push('Property category is required');
    }
    if (body.price && isNaN(parseFloat(body.price))) {
        errors.push('Price must be a valid number');
    }
    if (body.bedrooms && isNaN(parseInt(body.bedrooms))) {
        errors.push('Bedrooms must be a number');
    }
    if (body.bathrooms && isNaN(parseInt(body.bathrooms))) {
        errors.push('Bathrooms must be a number');
    }
    
    return errors;
}

function validateEnquiryData(body) {
    const errors = [];
    
    const name = body.full_name || body.customer_name;
    if (!name || name.trim().length < 2) {
        errors.push('Full name is required');
    }
    const phone = body.phone_number || body.phone;
    if (!phone || !validatePhone(phone)) {
        errors.push('Valid 10-digit mobile number is required');
    }
    if (body.email && !validateEmail(body.email)) {
        errors.push('Invalid email address');
    }
    
    return errors;
}

module.exports = {
    sanitize,
    sanitizeObject,
    validatePhone,
    validateEmail,
    validateRequired,
    validatePropertyData,
    validateEnquiryData
};
