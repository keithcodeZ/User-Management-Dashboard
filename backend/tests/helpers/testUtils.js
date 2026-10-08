import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from 'vitest';
import { createApp } from '../../src/app.js';
import { JsonUserRepository } from '../../src/repositories/jsonUserRepository.js';

// The committed seed file. Tests only copy it; nothing ever writes to it.
const seedFile = fileURLToPath(new URL('../../data/user.json', import.meta.url));

/**
 * Creates a fresh temp directory holding a `user.json` data file, written with
 * `content` or copied from the seed when no content is given. The caller
 * removes `dir` once the test is done.
 */
export async function createTempDataFile(content) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'user-management-test-'));
  const filePath = path.join(dir, 'user.json');

  if (content === undefined) {
    await fs.copyFile(seedFile, filePath);
  } else {
    await fs.writeFile(filePath, content, 'utf8');
  }

  return { dir, filePath };
}

/** Builds the app on a repository that stores its users in `filePath`. */
export function buildApp(filePath) {
  return createApp({
    userRepository: new JsonUserRepository(filePath),
    corsOrigin: 'http://localhost:5173',
  });
}

/** Reads and parses the users stored in a data file. */
export async function readUsers(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

/**
 * Asserts a JSON error response with exactly this status and body. Leave out
 * `fields` for errors whose body must not contain any.
 */
export function expectError(res, status, message, fields) {
  expect(res.status).toBe(status);
  expect(res.headers['content-type']).toMatch(/^application\/json/);
  expect(res.body).toStrictEqual({
    error: fields === undefined ? { message } : { message, fields },
  });
}
