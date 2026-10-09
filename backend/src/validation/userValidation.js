import { ValidationError } from '../errors/appErrors.js';

const ID_PATTERN = /^\d+$/;
const USERNAME_PATTERN = /^[A-Za-z0-9_.]+$/;
// No whitespace, exactly one @ with at least one character before it, and a dot
// inside the domain that is neither its first nor its last character.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Returns the integer value of a `:id` path parameter, or null unless it holds
 * only digits and is at least 1. Leading zeros are allowed, so "007" gives 7.
 */
export function parseUserId(value) {
  if (!ID_PATTERN.test(value)) {
    return null;
  }
  const id = Number(value);
  return id >= 1 ? id : null;
}

// Request bodies are parsed JSON, so this is enough to tell an object apart
// from null, an array, or a primitive.
function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Each check receives the trimmed value, which is '' for a field that is
// missing or not a string, and returns the message of the first rule the
// value breaks, or null when it breaks none.
function checkName(name) {
  if (name === '') {
    return 'Name is required.';
  }
  if (name.length < 2 || name.length > 100) {
    return 'Name must be between 2 and 100 characters.';
  }
  return null;
}

function checkUsername(username) {
  if (username === '') {
    return 'Username is required.';
  }
  if (username.length < 3 || username.length > 30) {
    return 'Username must be between 3 and 30 characters.';
  }
  if (!USERNAME_PATTERN.test(username)) {
    return 'Username can only contain letters, numbers, underscores, and dots.';
  }
  return null;
}

function checkEmail(email) {
  if (email === '') {
    return 'Email is required.';
  }
  if (!EMAIL_PATTERN.test(email)) {
    return 'Email must be a valid email address.';
  }
  return null;
}

// The validated fields, in the key order of the returned value and errors.
const fieldChecks = {
  name: checkName,
  username: checkUsername,
  email: checkEmail,
};

/**
 * Validates the user fields of a request body without changing the body.
 * Returns `value` with only the trimmed `name`, `username`, and `email`, and
 * `errors` with one message per invalid field, or null when all three are
 * valid. A body that is not a plain object is treated as `{}`.
 */
export function validateUserInput(body) {
  const input = isPlainObject(body) ? body : {};
  const value = {};
  const errors = {};

  for (const [field, check] of Object.entries(fieldChecks)) {
    const raw = input[field];
    value[field] = typeof raw === 'string' ? raw.trim() : '';

    const message = check(value[field]);
    if (message) {
      errors[field] = message;
    }
  }

  return { value, errors: Object.keys(errors).length > 0 ? errors : null };
}

/** Rejects a request whose `:id` is not a positive integer. */
export function validateIdParam(req, res, next) {
  if (parseUserId(req.params.id) === null) {
    next(new ValidationError('User id must be a positive integer.'));
    return;
  }
  next();
}

/**
 * Rejects invalid user input with one message per invalid field. Otherwise
 * replaces the body with the validated value, so the controller only sees the
 * trimmed `name`, `username`, and `email`.
 */
export function validateUserBody(req, res, next) {
  const { value, errors } = validateUserInput(req.body);
  if (errors) {
    next(new ValidationError('Validation failed.', errors));
    return;
  }
  req.body = value;
  next();
}
