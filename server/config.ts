import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

export const config = {
  // Locally, SERVER_PORT keeps the backend off the Vite dev port. In production
  // (Render/Heroku/etc.) SERVER_PORT is unset, so we bind the platform's PORT.
  port: Number(process.env.SERVER_PORT ?? process.env.PORT ?? 4000),
  jwtSecret: process.env.JWT_SECRET ?? 'nebula_dev_secret_change_me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  uploadDir: path.resolve(rootDir, process.env.UPLOAD_DIR ?? 'uploads'),
  rootDir,
  isProd: process.env.NODE_ENV === 'production',
};
