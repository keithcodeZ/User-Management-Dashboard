import { AppError } from '../errors/appErrors.js';

/**
 * The only place that sends an error response. Every other module passes its
 * errors here with `next(err)`.
 */
export function errorHandler(err, req, res, next) {
  // The response already started, so Express has to close the connection.
  if (res.headersSent) {
    next(err);
    return;
  }

  let status = 500;
  const error = { message: 'Internal server error.' };

  if (err instanceof AppError) {
    status = err.status;
    error.message = err.message;
    if (err.fields) {
      error.fields = err.fields;
    }
  } else if (err?.type === 'entity.parse.failed') {
    // Thrown by express.json for a body that is not valid JSON.
    status = 400;
    error.message = 'Request body is not valid JSON.';
  }

  // Unexpected failures keep their details on the server only.
  if (status === 500) {
    console.error(err);
  }

  res.status(status).json({ error });
}
