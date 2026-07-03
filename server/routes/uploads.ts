import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { requireAuth } from '../middleware/auth';
import { config } from '../config';
import { HttpError } from '../middleware/errors';

const router = Router();
router.use(requireAuth);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, config.uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).slice(0, 12).replace(/[^a-z0-9.]/gi, '');
    const base = randomBytes(10).toString('hex');
    cb(null, `${Date.now()}-${base}${ext || ''}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024, files: 10 },
});

// Upload one or more files. Returns metadata the client attaches to messages.
router.post('/', upload.array('files', 10), (req, res, next) => {
  try {
    const files = (req.files as Express.Multer.File[]) ?? [];
    if (files.length === 0) throw new HttpError(400, 'No files uploaded');
    const items = files.map((f) => ({
      url: `/uploads/${f.filename}`,
      filename: f.originalname,
      mimeType: f.mimetype,
      size: f.size,
    }));
    res.status(201).json({ items });
  } catch (err) {
    next(err);
  }
});

// Single-file upload used for avatars / server icons.
router.post('/single', upload.single('file'), (req, res, next) => {
  try {
    const file = req.file;
    if (!file) throw new HttpError(400, 'No file uploaded');
    res.status(201).json({ url: `/uploads/${file.filename}`, filename: file.originalname, mimeType: file.mimetype, size: file.size });
  } catch (err) {
    next(err);
  }
});

export default router;
