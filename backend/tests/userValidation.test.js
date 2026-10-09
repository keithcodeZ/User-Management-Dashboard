import { describe, expect, it } from 'vitest';
import { parseUserId, validateUserInput } from '../src/validation/userValidation.js';

// Valid input in mixed letter case, so the accepted results also show that the
// case is kept.
const validInput = {
  name: 'Ava Thompson',
  username: 'AThompson',
  email: 'Ava.Thompson@Example.com',
};

const messages = {
  nameRequired: 'Name is required.',
  nameLength: 'Name must be between 2 and 100 characters.',
  usernameRequired: 'Username is required.',
  usernameLength: 'Username must be between 3 and 30 characters.',
  usernameCharacters: 'Username can only contain letters, numbers, underscores, and dots.',
  emailRequired: 'Email is required.',
  emailFormat: 'Email must be a valid email address.',
};

const requiredErrors = {
  name: messages.nameRequired,
  username: messages.usernameRequired,
  email: messages.emailRequired,
};

// The valid input with one field set to `fieldValue`.
function withField(field, fieldValue) {
  return { ...validInput, [field]: fieldValue };
}

// The valid input without `field`.
function withoutField(field) {
  const body = { ...validInput };
  delete body[field];
  return body;
}

describe('parseUserId', () => {
  it.each([
    ['1', 1],
    ['007', 7],
    ['123', 123],
  ])('parses "%s" as %i', (value, expected) => {
    expect(parseUserId(value)).toBe(expected);
  });

  it.each(['abc', '0', '-1', '+1', '1.5', '1e3', '', ' 7 '])('rejects "%s"', (value) => {
    expect(parseUserId(value)).toBeNull();
  });
});

describe('validateUserInput', () => {
  it('accepts valid input and returns the same values', () => {
    expect(validateUserInput(validInput)).toStrictEqual({ value: validInput, errors: null });
  });

  describe.each(['name', 'username', 'email'])('the %s field', (field) => {
    it.each([
      ['missing', withoutField(field)],
      ['a number', withField(field, 42)],
      ['null', withField(field, null)],
      ['a boolean', withField(field, true)],
      ['an array', withField(field, [validInput[field]])],
      ['an object', withField(field, { value: validInput[field] })],
      ['an empty string', withField(field, '')],
      ['only whitespace', withField(field, ' \t\n ')],
    ])('is reported as required when it is %s', (_description, body) => {
      expect(validateUserInput(body).errors).toStrictEqual({ [field]: requiredErrors[field] });
    });

    it('is accepted and returned trimmed when padded with whitespace', () => {
      const body = withField(field, ` \t${validInput[field]}\n `);
      expect(validateUserInput(body)).toStrictEqual({ value: validInput, errors: null });
    });
  });

  it.each([
    ['name', 2],
    ['name', 100],
    ['username', 3],
    ['username', 30],
  ])('accepts a %s of length %i', (field, length) => {
    const body = withField(field, 'a'.repeat(length));
    expect(validateUserInput(body)).toStrictEqual({ value: body, errors: null });
  });

  it.each([
    ['name', 1, messages.nameLength],
    ['name', 101, messages.nameLength],
    ['username', 2, messages.usernameLength],
    ['username', 31, messages.usernameLength],
  ])('rejects a %s of length %i', (field, length, message) => {
    const body = withField(field, 'a'.repeat(length));
    expect(validateUserInput(body).errors).toStrictEqual({ [field]: message });
  });

  it('measures the length after trimming', () => {
    // 5 characters before trimming, 1 after.
    expect(validateUserInput(withField('name', '  a  ')).errors).toStrictEqual({
      name: messages.nameLength,
    });
    // 34 characters before trimming, 30 after.
    expect(validateUserInput(withField('username', `  ${'a'.repeat(30)}  `)).errors).toBeNull();
  });

  it.each([
    ['a hyphen', 'ava-thompson'],
    ['a space', 'ava thompson'],
    ['a letter outside A-Z', 'josé.silva'],
  ])('rejects a username containing %s', (_description, username) => {
    expect(validateUserInput(withField('username', username)).errors).toStrictEqual({
      username: messages.usernameCharacters,
    });
  });

  it('reports only the first rule a field breaks', () => {
    // Both too short and holding a disallowed character.
    expect(validateUserInput(withField('username', 'a-')).errors).toStrictEqual({
      username: messages.usernameLength,
    });
  });

  it.each([
    ['contains whitespace', 'ava thompson@example.com'],
    ['has no @', 'ava.thompson.example.com'],
    ['has two @ signs', 'ava@thompson@example.com'],
    ['has nothing before the @', '@example.com'],
    ['has no dot in the domain', 'ava.thompson@example'],
    ['has a dot only as the first character of the domain', 'ava.thompson@.com'],
    ['has a dot only as the last character of the domain', 'ava.thompson@example.'],
  ])('rejects an email that %s', (_description, email) => {
    expect(validateUserInput(withField('email', email)).errors).toStrictEqual({
      email: messages.emailFormat,
    });
  });

  it.each(['a@b.c', 'first.last@mail.example.org'])('accepts the email %s', (email) => {
    expect(validateUserInput(withField('email', email)).errors).toBeNull();
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['a number', 42],
    ['a string', 'text'],
    ['a boolean', true],
    ['an empty array', []],
    ['an array holding the fields as properties', Object.assign([], validInput)],
  ])('treats %s as an empty object, so all three fields are required', (_description, body) => {
    const result = validateUserInput(body);
    expect(result).toStrictEqual(validateUserInput({}));
    expect(result.errors).toStrictEqual(requiredErrors);
  });

  it('keeps only name, username, and email, and leaves the body unchanged', () => {
    const body = {
      id: 99,
      name: '  Ava Thompson  ',
      username: 'AThompson',
      email: ' Ava.Thompson@Example.com ',
      role: 'admin',
    };
    const before = structuredClone(body);

    expect(validateUserInput(body)).toStrictEqual({ value: validInput, errors: null });
    expect(body).toStrictEqual(before);
  });

  it.each([
    [
      'two fields',
      { name: 'A', username: 'AThompson', email: 'ava.thompson' },
      { name: messages.nameLength, email: messages.emailFormat },
    ],
    [
      'all three fields',
      { name: ' ', username: 'ava thompson', email: '@example.com' },
      {
        name: messages.nameRequired,
        username: messages.usernameCharacters,
        email: messages.emailFormat,
      },
    ],
  ])('reports exactly one error per failing field when %s fail', (_description, body, errors) => {
    expect(validateUserInput(body).errors).toStrictEqual(errors);
  });
});
