import fs from 'node:fs/promises';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CorruptDataFileError } from '../src/errors/appErrors.js';
import { buildApp, createTempDataFile, expectError, readUsers } from './helpers/testUtils.js';

// A data file cut off in the middle of a user.
const CORRUPT_CONTENT = '[{"id": 1, "name":';

const VALIDATION_FAILED = 'Validation failed.';
const ALREADY_IN_USE = 'Username or email is already in use.';
const CORRUPT_FILE = 'User data file is corrupt.';

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
  name: '  New User  ',
  username: ' New.User ',
  email: ' New.User@Example.com ',
};
const trimmedInput = {
  name: 'New User',
  username: 'New.User',
  email: 'New.User@Example.com',
};

// The value in upper case, checked to differ from the value, so a match
// against a stored value can only come from ignoring letter case.
function otherCase(value) {
  const upper = value.toUpperCase();
  expect(upper).not.toBe(value);
  return upper;
}

// Asserts a 201 JSON response whose body is exactly `body`.
function expectCreated(res, body) {
  expect(res.status).toBe(201);
  expect(res.headers['content-type']).toMatch(/^application\/json/);
  expect(res.body).toStrictEqual(body);
}

describe('POST /api/users', () => {
  let dir;
  let filePath;
  let app;
  // The users in the temp data file before each test, and their highest id.
  let storedUsers;
  let highestId;

  beforeEach(async () => {
    ({ dir, filePath } = await createTempDataFile());
    storedUsers = await readUsers(filePath);
    highestId = Math.max(...storedUsers.map((user) => user.id));
    app = buildApp(filePath);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(dir, { recursive: true, force: true });
  });

  // Sends `body` serialized as JSON.
  function postUser(body) {
    return request(app).post('/api/users').send(body);
  }

  // Sends `text` unchanged as the body, with the JSON content type.
  function postRawJson(text) {
    return request(app).post('/api/users').set('Content-Type', 'application/json').send(text);
  }

  // Sends a request that must fail, checks the exact error response, and
  // checks that the data file still holds the same bytes.
  async function expectFailure(send, status, message, fields) {
    const before = await fs.readFile(filePath);

    const res = await send();

    expectError(res, status, message, fields);
    expect(await fs.readFile(filePath)).toEqual(before);
  }

  it('responds 201 with the trimmed input and the next id, and appends the user to the file', async () => {
    const expected = { id: highestId + 1, ...trimmedInput };

    const res = await postUser(paddedInput);

    expectCreated(res, expected);
    const savedUsers = await readUsers(filePath);
    expect(savedUsers).toStrictEqual([...storedUsers, expected]);
    expect(res.body).toStrictEqual(savedUsers.at(-1));
  });

  it('gives the new user one more than the highest id when the ids are not consecutive', async () => {
    // Three stored users given the ids 2, 7, and 5, in that order.
    const users = [2, 7, 5].map((id, index) => ({ ...storedUsers[index], id }));
    await fs.writeFile(filePath, JSON.stringify(users, null, 2), 'utf8');
    const expected = { id: 8, ...trimmedInput };

    expectCreated(await postUser(paddedInput), expected);
    expect(await readUsers(filePath)).toStrictEqual([...users, expected]);
  });

  it('gives the new user the id 1 when the file holds no users', async () => {
    await fs.writeFile(filePath, '[]', 'utf8');
    const expected = { id: 1, ...trimmedInput };

    expectCreated(await postUser(paddedInput), expected);
    expect(await readUsers(filePath)).toStrictEqual([expected]);
  });

  it('ignores an id and unknown fields in the body', async () => {
    const expected = { id: highestId + 1, ...trimmedInput };

    const res = await postUser({ ...paddedInput, id: storedUsers[0].id, role: 'admin' });

    expectCreated(res, expected);
    const savedUsers = await readUsers(filePath);
    expect(savedUsers).toStrictEqual([...storedUsers, expected]);
    expect(Object.keys(savedUsers.at(-1))).toEqual(['id', 'name', 'username', 'email']);
  });

  it.each([
    ['name', { name: 'A' }, { name: NAME_LENGTH }],
    ['username', { username: 'bad name!' }, { username: USERNAME_CHARACTERS }],
    ['email', { email: 'a@b' }, { email: EMAIL_FORMAT }],
    [
      'name, username, and email',
      { name: 'A', username: 'bad name!', email: 'a@b' },
      { name: NAME_LENGTH, username: USERNAME_CHARACTERS, email: EMAIL_FORMAT },
    ],
  ])(
    'responds 400 with a field error for only the invalid %s',
    async (_description, invalidValues, fields) => {
      const body = { ...paddedInput, ...invalidValues };

      await expectFailure(() => postUser(body), 400, VALIDATION_FAILED, fields);
    },
  );

  it.each([
    ['username', { username: USERNAME_IN_USE }],
    ['email', { email: EMAIL_IN_USE }],
    ['username and email', { username: USERNAME_IN_USE, email: EMAIL_IN_USE }],
  ])(
    'responds 409 with a field error for only the stored %s, sent in another letter case',
    async (_description, fields) => {
      const existing = storedUsers[0];
      const body = { ...paddedInput };
      for (const field of Object.keys(fields)) {
        body[field] = otherCase(existing[field]);
      }

      await expectFailure(() => postUser(body), 409, ALREADY_IN_USE, fields);
    },
  );

  it('responds 500 to a valid body when the data file is corrupt, and logs the error', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    await fs.writeFile(filePath, CORRUPT_CONTENT, 'utf8');

    await expectFailure(() => postUser(paddedInput), 500, CORRUPT_FILE);
    expect(consoleError).toHaveBeenCalledWith(expect.any(CorruptDataFileError));
  });

  // Body parsing leaves no object holding the fields for any of these: the
  // body is undefined, `{}`, or a JSON value that is not an object.
  it.each([
    ['a request with no body', () => request(app).post('/api/users')],
    [
      'a user sent as text/plain',
      () =>
        request(app)
          .post('/api/users')
          .set('Content-Type', 'text/plain')
          .send(JSON.stringify(paddedInput)),
    ],
    ['an empty application/json body', () => postRawJson('')],
    ...['null', '42', '"text"', 'true', '[]'].map((json) => [
      `the JSON body ${json}`,
      () => postRawJson(json),
    ]),
  ])('responds 400 with all three fields required to %s', async (_description, send) => {
    await expectFailure(send, 400, VALIDATION_FAILED, ALL_REQUIRED);
  });
});
