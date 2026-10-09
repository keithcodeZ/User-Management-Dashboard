import fs from 'node:fs/promises';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp, createTempDataFile, expectError, readUsers } from './helpers/testUtils.js';

const INVALID_ID = 'User id must be a positive integer.';
const USER_NOT_FOUND = 'User not found.';

describe('DELETE /api/users/:id', () => {
  let dir;
  let filePath;
  let app;
  // The users in the temp data file before each test, and an id none of them has.
  let storedUsers;
  let unusedId;
  // The user the tests delete and its index in the file.
  let index;
  let target;

  beforeEach(async () => {
    ({ dir, filePath } = await createTempDataFile());
    storedUsers = await readUsers(filePath);
    unusedId = Math.max(...storedUsers.map((user) => user.id)) + 1;
    // A user in the middle of the file, with users before and after it that
    // must keep their order.
    index = Math.floor(storedUsers.length / 2);
    target = storedUsers[index];
    app = buildApp(filePath);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(dir, { recursive: true, force: true });
  });

  function deleteUser(id) {
    return request(app).delete(`/api/users/${id}`);
  }

  // Sends a request that must fail, checks the exact error response, which
  // has no field errors, and checks that the data file still holds the same bytes.
  async function expectFailure(send, status, message) {
    const before = await fs.readFile(filePath);

    const res = await send();

    expectError(res, status, message);
    expect(await fs.readFile(filePath)).toEqual(before);
  }

  it('responds 204 with an empty body and removes only that user, keeping the others in order and unchanged', async () => {
    const res = await deleteUser(target.id);

    expect(res.status).toBe(204);
    expect(res.text).toBe('');
    expect(await readUsers(filePath)).toStrictEqual(storedUsers.toSpliced(index, 1));
  });

  it.each(['abc', '0', '-1', '1.5'])('responds 400 without fields to the id "%s"', async (id) => {
    await expectFailure(() => deleteUser(id), 400, INVALID_ID);
  });

  it('responds 404 to a valid id that no user has', async () => {
    await expectFailure(() => deleteUser(unusedId), 404, USER_NOT_FOUND);
  });
});
