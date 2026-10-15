/**
 * File upload configuration using multer
 */
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const isVercel = Boolean(process.env.VERCEL);
const BASE_UPLOAD_DIR = isVercel
    ? path.join('/tmp', 'uploads')
    : path.join(__dirname, '..', 'public', 'uploads');

const UPLOAD_DIR = path.join(BASE_UPLOAD_DIR, 'properties');
const DOCS_DIR = path.join(BASE_UPLOAD_DIR, 'documents');

// Ensure upload directories exist safely without throwing on read-only filesystems
function ensureDir(dirPath) {
    try {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    } catch (e) {
        // Safe bypass on read-only serverless filesystems
    }
}

ensureDir(UPLOAD_DIR);
ensureDir(DOCS_DIR);

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        ensureDir(UPLOAD_DIR);
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const uniqueName = `${uuidv4()}${ext}`;
        cb(null, uniqueName);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/avif'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Only JPEG, PNG, WebP, and AVIF images are allowed'), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max
        files: 20 // Max 20 files per request
    }
});

// Brochure/document upload
const docStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        ensureDir(DOCS_DIR);
        cb(null, DOCS_DIR);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${uuidv4()}${ext}`);
    }
});

const docFilter = (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Only PDF and image files are allowed for documents'), false);
    }
};

const uploadDocs = multer({
    storage: docStorage,
    fileFilter: docFilter,
    limits: { fileSize: 20 * 1024 * 1024 }
});

module.exports = { upload, uploadDocs, UPLOAD_DIR, DOCS_DIR };
