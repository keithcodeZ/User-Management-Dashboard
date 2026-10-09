import fs from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ConflictError, NotFoundError } from '../src/errors/appErrors.js';
import { JsonUserRepository } from '../src/repositories/jsonUserRepository.js';
import { createUserService, findConflicts, nextUserId } from '../src/services/userService.js';
import { createTempDataFile, readUsers } from './helpers/testUtils.js';

const USERNAME_IN_USE = 'Username is already in use.';
const EMAIL_IN_USE = 'Email is already in use.';

// The error expected for an id that no user has.
const notFound = {
  errorClass: NotFoundError,
  status: 404,
  message: 'User not found.',
  fields: undefined,
};

// The error expected when exactly `fields` are already in use.
function conflict(fields) {
  return {
    errorClass: ConflictError,
    status: 409,
    message: 'Username or email is already in use.',
    fields,
  };
}

// Valid input whose username and email no stored user has.
const newInput = {
  name: 'New User',
  username: 'new.user',
  email: 'new.user@example.com',
};

function makeUser(id) {
  return {
    id,
    name: `Test User ${id}`,
    username: `test.user${id}`,
    email: `test.user${id}@example.com`,
  };
}

// The value in upper case, checked to differ from the value, so a match
// against the result can only come from ignoring letter case.
function otherCase(value) {
  const upper = value.toUpperCase();
  expect(upper).not.toBe(value);
  return upper;
}

describe('nextUserId', () => {
  it('returns one more than the highest id when the ids are not consecutive', () => {
    expect(nextUserId([makeUser(2), makeUser(7), makeUser(5)])).toBe(8);
  });

  it('returns 1 when there are no users', () => {
    expect(nextUserId([])).toBe(1);
  });
});

describe('findConflicts', () => {
  const users = [makeUser(1), makeUser(2)];

  it('reports only the username when it differs from a stored one only in letter case', () => {
    const input = { ...newInput, username: 'Test.User1' };
    expect(findConflicts(users, input)).toStrictEqual({ username: USERNAME_IN_USE });
  });

  it('reports only the email when it differs from a stored one only in letter case', () => {
    const input = { ...newInput, email: 'TEST.USER2@EXAMPLE.COM' };
    expect(findConflicts(users, input)).toStrictEqual({ email: EMAIL_IN_USE });
  });

  it('reports the username and then the email when both are in use', () => {
    const input = { ...newInput, username: 'TEST.USER2', email: 'Test.User1@Example.com' };

    const conflicts = findConflicts(users, input);

    expect(conflicts).toStrictEqual({ username: USERNAME_IN_USE, email: EMAIL_IN_USE });
    expect(Object.keys(conflicts)).toEqual(['username', 'email']);
  });

  it('returns an empty object when neither is in use', () => {
    expect(findConflicts(users, newInput)).toStrictEqual({});
  });

  it("ignores the edited user's own username and email in another letter case", () => {
    const input = { ...newInput, username: 'TEST.USER1', email: 'TEST.USER1@EXAMPLE.COM' };
    expect(findConflicts(users, input, 1)).toStrictEqual({});
  });

  it("still reports another user's username while ignoring the edited user", () => {
    const input = { ...newInput, username: 'Test.User2', email: 'test.user1@example.com' };
    expect(findConflicts(users, input, 1)).toStrictEqual({ username: USERNAME_IN_USE });
  });
});

describe('createUserService', () => {
  // Position of the stored user that the read, update, and delete tests use.
  const TARGET_INDEX = 1;

  let dir;
  let filePath;
  let service;
  // The users in the temp data file before each test, and ids derived from them.
  let storedUsers;
  let highestId;
  let unusedId;

  beforeEach(async () => {
    ({ dir, filePath } = await createTempDataFile());
    storedUsers = await readUsers(filePath);
    highestId = Math.max(...storedUsers.map((user) => user.id));
    unusedId = highestId + 1;
    service = createUserService(new JsonUserRepository(filePath));
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  // Runs a call that must fail, checks the error's class, status, message, and
  // exact fields, and checks that the data file still holds the same bytes.
  async function expectFailure(call, expected) {
    const before = await fs.readFile(filePath);

    const error = await call().catch((err) => err);

    expect(error).toBeInstanceOf(expected.errorClass);
    expect(error.status).toBe(expected.status);
    expect(error.message).toBe(expected.message);
    expect(error.fields).toStrictEqual(expected.fields);
    expect(await fs.readFile(filePath)).toEqual(before);
  }

  describe('listUsers', () => {
    it('resolves with the stored users in file order', async () => {
      await expect(service.listUsers()).resolves.toStrictEqual(storedUsers);
    });
  });

  describe('getUser', () => {
    it('resolves with the user that has the given id', async () => {
      const target = storedUsers[TARGET_INDEX];
      await expect(service.getUser(target.id)).resolves.toStrictEqual(target);
    });

    it('rejects an id that no user has with a not-found error', async () => {
      await expectFailure(() => service.getUser(unusedId), notFound);
    });
  });

  describe('createUser', () => {
    it('appends the user with the next id after the highest one and resolves with it', async () => {
      const expected = { id: highestId + 1, ...newInput };

      const created = await service.createUser(newInput);

      expect(created).toStrictEqual(expected);
      expect(Object.keys(created)).toEqual(['id', 'name', 'username', 'email']);
      expect(await readUsers(filePath)).toStrictEqual([...storedUsers, expected]);
    });

    it('ignores an id and other extra keys in the input', async () => {
      const input = { ...newInput, id: storedUsers[0].id, role: 'admin' };
      const expected = { id: highestId + 1, ...newInput };

      await expect(service.createUser(input)).resolves.toStrictEqual(expected);
      expect(await readUsers(filePath)).toStrictEqual([...storedUsers, expected]);
    });

    it.each([
      ['username', { username: USERNAME_IN_USE }],
      ['email', { email: EMAIL_IN_USE }],
      ['username and email', { username: USERNAME_IN_USE, email: EMAIL_IN_USE }],
    ])(
      'rejects a stored %s in another letter case with a conflict error',
      async (_description, fields) => {
        const existing = storedUsers[0];
        const input = { ...newInput };
        for (const field of Object.keys(fields)) {
          input[field] = otherCase(existing[field]);
        }

        await expectFailure(() => service.createUser(input), conflict(fields));
      },
    );
  });

  describe('updateUser', () => {
    it('replaces the user at its position and leaves every other user unchanged', async () => {
      const target = storedUsers[TARGET_INDEX];
      const expected = { id: target.id, ...newInput };

      await expect(service.updateUser(target.id, newInput)).resolves.toStrictEqual(expected);
      expect(await readUsers(filePath)).toStrictEqual(storedUsers.with(TARGET_INDEX, expected));
    });

    it('keeps the id and ignores other extra keys when the input has its own id', async () => {
      const target = storedUsers[TARGET_INDEX];
      const input = { ...newInput, id: storedUsers[0].id, role: 'admin' };
      const expected = { id: target.id, ...newInput };

      await expect(service.updateUser(target.id, input)).resolves.toStrictEqual(expected);
      expect(await readUsers(filePath)).toStrictEqual(storedUsers.with(TARGET_INDEX, expected));
    });

    it("accepts the user's own username and email in another letter case and stores them as sent", async () => {
      const target = storedUsers[TARGET_INDEX];
      const input = {
        name: target.name,
        username: otherCase(target.username),
        email: otherCase(target.email),
      };
      const expected = { id: target.id, ...input };

      await expect(service.updateUser(target.id, input)).resolves.toStrictEqual(expected);
      expect(await readUsers(filePath)).toStrictEqual(storedUsers.with(TARGET_INDEX, expected));
    });

    it('rejects an id that no user has with a not-found error', async () => {
      await expectFailure(() => service.updateUser(unusedId, newInput), notFound);
    });

    it('reports an unknown id before a username and email that are in use', async () => {
      const { username, email } = storedUsers[0];
      const input = { ...newInput, username, email };

      await expectFailure(() => service.updateUser(unusedId, input), notFound);
    });

    it.each([
      ['username', { username: USERNAME_IN_USE }],
      ['email', { email: EMAIL_IN_USE }],
    ])(
      "rejects another user's %s in another letter case with a conflict error",
      async (field, fields) => {
        const target = storedUsers[TARGET_INDEX];
        const other = storedUsers[0];
        // The edited user's own values, except for one field taken from another user.
        const input = {
          name: target.name,
          username: target.username,
          email: target.email,
          [field]: otherCase(other[field]),
        };

        await expectFailure(() => service.updateUser(target.id, input), conflict(fields));
      },
    );
  });

  describe('deleteUser', () => {
    it('removes only that user and keeps the others in order', async () => {
      const target = storedUsers[TARGET_INDEX];

      await expect(service.deleteUser(target.id)).resolves.toBeUndefined();
      expect(await readUsers(filePath)).toStrictEqual(storedUsers.toSpliced(TARGET_INDEX, 1));
    });

    it('rejects an id that no user has with a not-found error', async () => {
      await expectFailure(() => service.deleteUser(unusedId), notFound);
    });
  });
});
