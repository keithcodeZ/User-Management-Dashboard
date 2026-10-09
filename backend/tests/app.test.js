import fs from 'node:fs/promises';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { CorruptDataFileError } from '../src/errors/appErrors.js';
import { buildApp, createTempDataFile, expectError, readUsers } from './helpers/testUtils.js';

// The only origin that buildApp allows.
const ALLOWED_ORIGIN = 'http://localhost:5173';
// A data file cut off in the middle of a user.
const CORRUPT_CONTENT = '[{"id": 1, "name":';

const MALFORMED_JSON = 'Request body is not valid JSON.';
const ROUTE_NOT_FOUND = 'Route not found.';
const INVALID_ID = 'User id must be a positive integer.';
const CORRUPT_FILE = 'User data file is corrupt.';

describe('createApp', () => {
  let dir;
  let filePath;
  let app;

  beforeEach(async () => {
    ({ dir, filePath } = await createTempDataFile());
    app = buildApp(filePath);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(dir, { recursive: true, force: true });
  });

  it.each([
    ['GET', '/api/unknown'],
    ['GET', '/api/users/1/extra'],
    ['PATCH', '/api/users/1'],
  ])('responds 404 to %s %s, which matches no route', async (method, path) => {
    const res = await request(app)[method.toLowerCase()](path);

    expectError(res, 404, ROUTE_NOT_FOUND);
  });

  it('responds 400 without fields to a body that is not valid JSON', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Content-Type', 'application/json')
      .send('{bad');

    expectError(res, 400, MALFORMED_JSON);
  });

  describe('CORS', () => {
    it.each([ALLOWED_ORIGIN, 'http://evil.example'])(
      'sends the configured origin as the allowed origin to a request from %s',
      async (origin) => {
        const res = await request(app).get('/api/users').set('Origin', origin);

        expect(res.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
      },
    );

    it.each(['/api/users/1', '/api/unknown'])(
      'answers a preflight for %s with 204',
      async (path) => {
        const res = await request(app)
          .options(path)
          .set('Origin', ALLOWED_ORIGIN)
          .set('Access-Control-Request-Method', 'PUT');

        expect(res.status).toBe(204);
        expect(res.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
      },
    );
  });

  describe('with a corrupt data file', () => {
    beforeEach(async () => {
      await fs.writeFile(filePath, CORRUPT_CONTENT, 'utf8');
    });

    it.each([
      ['GET', '/api/users'],
      ['GET', '/api/users/1'],
    ])('responds 500 to %s %s and logs the error', async (method, path) => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      const res = await request(app)[method.toLowerCase()](path);

      expectError(res, 500, CORRUPT_FILE);
      expect(consoleError).toHaveBeenCalledWith(expect.any(CorruptDataFileError));
    });
  });

  describe('with a repository that fails unexpectedly', () => {
    it('responds with the generic 500 and logs the error without sending its message', async () => {
      const secret = 'secret detail that must stay on the server';
      const failure = new Error(secret);
      const failingRepository = {
        getAll: () => Promise.reject(failure),
        modify: () => Promise.reject(failure),
      };
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const failingApp = createApp({
        userRepository: failingRepository,
        corsOrigin: ALLOWED_ORIGIN,
      });

      const res = await request(failingApp).get('/api/users');

      expectError(res, 500, 'Internal server error.');
      expect(res.text).not.toContain(secret);
      expect(consoleError).toHaveBeenCalledWith(failure);
    });
  });

  describe('a request that fails several checks', () => {
    // An id that no user in the seed copy has.
    let unusedId;

    beforeEach(async () => {
      const storedUsers = await readUsers(filePath);
      unusedId = Math.max(...storedUsers.map((user) => user.id)) + 1;
    });

    // `first` is the check that decides the response and `later` a check the
    // request also fails. `corruptFile` replaces the data file before sending.
    it.each([
      {
        first: 'malformed JSON',
        later: 'the unknown route',
        send: () =>
          request(app).post('/api/unknown').set('Content-Type', 'application/json').send('{bad'),
        corruptFile: false,
        status: 400,
        message: MALFORMED_JSON,
      },
      {
        first: 'the unknown route',
        later: 'the invalid id',
        send: () => request(app).get('/api/users/abc/extra'),
        corruptFile: false,
        status: 404,
        message: ROUTE_NOT_FOUND,
      },
      {
        first: 'the invalid id',
        later: 'the corrupt data file',
        send: () => request(app).get('/api/users/abc'),
        corruptFile: true,
        status: 400,
        message: INVALID_ID,
      },
      {
        first: 'the corrupt data file',
        later: 'the unused id',
        send: () => request(app).get(`/api/users/${unusedId}`),
        corruptFile: true,
        status: 500,
        message: CORRUPT_FILE,
      },
    ])(
      'reports $first ($status) before $later',
      async ({ send, corruptFile, status, message }) => {
        // Keeps the error logged for a 500 out of the test output.
        vi.spyOn(console, 'error').mockImplementation(() => {});
        if (corruptFile) {
          await fs.writeFile(filePath, CORRUPT_CONTENT, 'utf8');
        }

        expectError(await send(), status, message);
      },
    );
  });
});
