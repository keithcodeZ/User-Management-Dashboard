import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// The backend directory, so a relative DATA_FILE resolves the same way no matter
// which working directory the process was started from.
const backendDir = fileURLToPath(new URL('..', import.meta.url));

// Variables already present in the environment win over the ones in .env,
// and a missing .env file is fine.
dotenv.config({ path: path.join(backendDir, '.env'), quiet: true });

const { PORT, DATA_FILE, CORS_ORIGIN } = process.env;

// An empty value counts as not set, so it falls back to the default.
export const config = {
  port: Number(PORT || 4000),
  dataFile: path.resolve(backendDir, DATA_FILE || './data/user.json'),
  corsOrigin: CORS_ORIGIN || 'http://localhost:5173',
};
