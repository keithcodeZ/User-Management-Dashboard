import fs from 'node:fs/promises';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp, createTempDataFile, expectError, readUsers } from './helpers/testUtils.js';

const INVALID_ID = 'User id must be a positive integer.';
const VALIDATION_FAILED = 'Validation failed.';
const USER_NOT_FOUND = 'User not found.';
const ALREADY_IN_USE = 'Username or email is already in use.';

const NAME_LENGTH = 'Name must be between 2 and 100 characters.';
const USERNAME_CHARACTERS = 'Username can only contain letters, numbers, underscores, and dots.';
const EMAIL_FORMAT = 'Email must be a valid email address.';
const USERNAME_IN_USE = 'Username is already in use.';
const EMAIL_IN_USE = 'Email is already in use.';

// The field errors for a body that provides none of the three fields.
const ALL_REQUIRED = {
  name: 'Name is required.',
  username: 'Username is required.',
  email: 'Email is required.',
};

// Valid input whose username and email no stored user has, padded and in
// mixed letter case, and the values it is stored with: trimmed, case kept.
const paddedInput = {
  name: '  Updated User  ',
  username: ' Updated.User ',
  email: ' Updated.User@Example.com ',
};
const trimmedInput = {
  name: 'Updated User',
  username: 'Updated.User',
  email: 'Updated.User@Example.com',
};

// The value in upper case, checked to differ from the value, so a match
// against a stored value can only come from ignoring letter case.
function otherCase(value) {
  const upper = value.toUpperCase();
  expect(upper).not.toBe(value);
  return upper;
}

// Asserts a 200 JSON response whose body is exactly `body`.
function expectUpdated(res, body) {
  expect(res.status).toBe(200);
  expect(res.headers['content-type']).toMatch(/^application\/json/);
  expect(res.body).toStrictEqual(body);
}

describe('PUT /api/users/:id', () => {
  let dir;
  let filePath;
  let app;
  // The users in the temp data file before each test, and an id none of them has.
  let storedUsers;
  let unusedId;
  // The user the tests update and its index in the file, and another stored user.
  let index;
  let target;
  let otherUser;

  beforeEach(async () => {
    ({ dir, filePath } = await createTempDataFile());
    storedUsers = await readUsers(filePath);
    unusedId = Math.max(...storedUsers.map((user) => user.id)) + 1;
    // A user in the middle of the file, with users before and after it that
    // must stay in place.
    index = Math.floor(storedUsers.length / 2);
    target = storedUsers[index];
    otherUser = storedUsers[0];
    app = buildApp(filePath);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(dir, { recursive: true, force: true });
  });

  // Sends `body` serialized as JSON to the user with this id, or no body at
  // all when `body` is left out.
  function putUser(id, body) {
    const pending = request(app).put(`/api/users/${id}`);
    return body === undefined ? pending : pending.send(body);
  }

  // Sends a request that must fail, checks the exact error response, and
  // checks that the data file still holds the same bytes.
  async function expectFailure(send, status, message, fields) {
    const before = await fs.readFile(filePath);

    const res = await send();

    expectError(res, status, message, fields);
    expect(await fs.readFile(filePath)).toEqual(before);
  }

  it('responds 200 with the path id and the trimmed input, and replaces only that user in the file', async () => {
    const expected = { id: target.id, ...trimmedInput };

    const res = await putUser(target.id, paddedInput);

    expectUpdated(res, expected);
    expect(await readUsers(filePath)).toStrictEqual(storedUsers.with(index, expected));
  });

  it('keeps the path id and ignores an id and unknown fields in the body', async () => {
    const expected = { id: target.id, ...trimmedInput };

    const res = await putUser(target.id, { ...paddedInput, id: otherUser.id, role: 'admin' });

    expectUpdated(res, expected);
    const savedUsers = await readUsers(filePath);
    expect(savedUsers).toStrictEqual(storedUsers.with(index, expected));
    expect(Object.keys(savedUsers[index])).toEqual(['id', 'name', 'username', 'email']);
  });

  it('responds 200 to the username and email the user already has, in another letter case, and stores them as sent', async () => {
    const body = {
      name: target.name,
      username: otherCase(target.username),
      email: otherCase(target.email),
    };
    const expected = { id: target.id, ...body };

    expectUpdated(await putUser(target.id, body), expected);
    expect(await readUsers(filePath)).toStrictEqual(storedUsers.with(index, expected));
  });

  it.each(['abc', '0', '-1', '1.5'])(
    'responds 400 without fields to the id "%s", even with a valid body',
    async (id) => {
      await expectFailure(() => putUser(id, paddedInput), 400, INVALID_ID);
    },
  );

  it.each([
    ['an invalid name', { ...paddedInput, name: 'A' }, { name: NAME_LENGTH }],
    [
      'an invalid username',
      { ...paddedInput, username: 'bad name!' },
      { username: USERNAME_CHARACTERS },
    ],
    ['an invalid email', { ...paddedInput, email: 'a@b' }, { email: EMAIL_FORMAT }],
    // An update replaces the whole user, so the username and email are required too.
    [
      'a body with only a name',
      { name: paddedInput.name },
      { username: 'Username is required.', email: 'Email is required.' },
    ],
    ['a request with no body', undefined, ALL_REQUIRED],
  ])('responds 400 with exactly the field errors for %s', async (_description, body, fields) => {
    await expectFailure(() => putUser(target.id, body), 400, VALIDATION_FAILED, fields);
  });

  it('responds 404 to a valid id that no user has', async () => {
    await expectFailure(() => putUser(unusedId, paddedInput), 404, USER_NOT_FOUND);
  });

  it.each([
    ['username', { username: USERNAME_IN_USE }],
    ['email', { email: EMAIL_IN_USE }],
    ['username and email', { username: USERNAME_IN_USE, email: EMAIL_IN_USE }],
  ])(
    'responds 409 with a field error for only the %s of another user, sent in another letter case',
    async (_description, fields) => {
      // The user's own values, except for the fields taken from the other user.
      const body = { name: target.name, username: target.username, email: target.email };
      for (const field of Object.keys(fields)) {
        body[field] = otherCase(otherUser[field]);
      }

      await expectFailure(() => putUser(target.id, body), 409, ALREADY_IN_USE, fields);
    },
  );
});
