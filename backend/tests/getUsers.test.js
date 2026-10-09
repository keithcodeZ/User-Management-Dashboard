import fs from 'node:fs/promises';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp, createTempDataFile, expectError, readUsers } from './helpers/testUtils.js';

// Asserts a 200 JSON response whose body is exactly `body`.
function expectOk(res, body) {
  expect(res.status).toBe(200);
  expect(res.headers['content-type']).toMatch(/^application\/json/);
  expect(res.body).toStrictEqual(body);
}

describe('reading users', () => {
  let dir;
  let filePath;
  let app;
  // The users in the temp data file before each test, and an id none of them has.
  let storedUsers;
  let unusedId;

  beforeEach(async () => {
    ({ dir, filePath } = await createTempDataFile());
    storedUsers = await readUsers(filePath);
    unusedId = Math.max(...storedUsers.map((user) => user.id)) + 1;
    app = buildApp(filePath);
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  describe('GET /api/users', () => {
    it('responds 200 with the stored users as JSON, in file order', async () => {
      expectOk(await request(app).get('/api/users'), storedUsers);
    });

    it('responds 200 with an empty array when the file holds no users', async () => {
      await fs.writeFile(filePath, '[]', 'utf8');

      expectOk(await request(app).get('/api/users'), []);
    });

    it('responds 200 with an empty array when there is no data file', async () => {
      await fs.rm(filePath);

      expectOk(await request(app).get('/api/users'), []);
    });

    it('returns the new content when the file is replaced between two requests', async () => {
      expectOk(await request(app).get('/api/users'), storedUsers);

      // Fewer users than before, in another order.
      const replacement = storedUsers.slice(0, 3).toReversed();
      await fs.writeFile(filePath, JSON.stringify(replacement, null, 2), 'utf8');

      expectOk(await request(app).get('/api/users'), replacement);
    });
  });

  describe('GET /api/users/:id', () => {
    it('responds 200 with the user that has the id', async () => {
      const target = storedUsers[1];

      expectOk(await request(app).get(`/api/users/${target.id}`), target);
    });

    it('reads an id with leading zeros as its integer value', async () => {
      const target = storedUsers.find((user) => user.id === 7);
      expect(target).toBeDefined();

      expectOk(await request(app).get('/api/users/007'), target);
    });

    it.each(['abc', '0', '-1', '1.5'])('responds 400 without fields to the id "%s"', async (id) => {
      const res = await request(app).get(`/api/users/${id}`);

      expectError(res, 400, 'User id must be a positive integer.');
    });

    it('responds 404 to a valid id that no user has', async () => {
      const res = await request(app).get(`/api/users/${unusedId}`);

      expectError(res, 404, 'User not found.');
    });
  });

  it('leaves the data file unchanged after the read requests', async () => {
    const before = await fs.readFile(filePath);

    await request(app).get('/api/users').expect(200);
    await request(app).get(`/api/users/${storedUsers[1].id}`).expect(200);
    await request(app).get('/api/users/007').expect(200);
    await request(app).get('/api/users/abc').expect(400);
    await request(app).get(`/api/users/${unusedId}`).expect(404);

    expect(await fs.readFile(filePath)).toEqual(before);
  });
});
