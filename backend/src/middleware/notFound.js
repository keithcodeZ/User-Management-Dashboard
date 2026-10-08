import { NotFoundError } from '../errors/appErrors.js';

/** Handles every request that matched no route. */
export function notFound(req, res, next) {
  next(new NotFoundError('Route not found.'));
}
