const USERNAME_PATTERN = /^[A-Za-z0-9_.]+$/;
// No whitespace, exactly one @ with at least one character before it, and a dot
// inside the domain that is neither its first nor its last character.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
 * Checks the user form values with the same rules and messages as the API.
 * Returns `value` with the trimmed `name`, `username`, and `email`, and
 * `errors` with one message per invalid field, or null when all three are
 * valid.
 */
export function validateUserInput(values) {
  const value = {};
  const errors = {};

  for (const [field, check] of Object.entries(fieldChecks)) {
    const raw = values[field];
    value[field] = typeof raw === 'string' ? raw.trim() : '';

    const message = check(value[field]);
    if (message) {
      errors[field] = message;
    }
  }

  return { value, errors: Object.keys(errors).length > 0 ? errors : null };
}
