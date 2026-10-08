import express from 'express';
import cors from 'cors';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';

/**
 * Builds the Express application without listening on a port, so tests can
 * drive it directly and point it at their own data file.
 */
export function createApp({ userRepository, corsOrigin }) {
  const app = express();

  app.use(cors({ origin: corsOrigin }));
  // strict: false, so a JSON body that is not an object still reaches the
  // validator and gets a field-level 400 instead of a parse error.
  app.use(express.json({ strict: false }));

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
