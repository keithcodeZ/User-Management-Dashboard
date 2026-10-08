/**
 * Base class for errors that carry the HTTP status and the message the API is
 * allowed to send back. The error handler is the only place that reads them.
 */
export class AppError extends Error {
  constructor(status, message, fields) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    if (fields) {
      this.fields = fields;
    }
  }
}

/** Invalid request data: a bad `:id` or invalid user input. */
export class ValidationError extends AppError {
  constructor(message, fields) {
    super(400, message, fields);
  }
}

/** An unknown route, or a user id that no stored user has. */
export class NotFoundError extends AppError {
  constructor(message) {
    super(404, message);
  }
}

/** A username or email that another user already uses. */
export class ConflictError extends AppError {
  constructor(message, fields) {
    super(409, message, fields);
  }
}

/** The data file does not hold a JSON array of users. */
export class CorruptDataFileError extends AppError {
  constructor() {
    super(500, 'User data file is corrupt.');
  }
}
