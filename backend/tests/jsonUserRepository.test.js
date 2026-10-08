import fs from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CorruptDataFileError } from '../src/errors/appErrors.js';
import { JsonUserRepository } from '../src/repositories/jsonUserRepository.js';
import { createTempDataFile, readUsers } from './helpers/testUtils.js';

function makeUser(id) {
  return {
    id,
    name: `Test User ${id}`,
    username: `test.user${id}`,
    email: `test.user${id}@example.com`,
  };
}

describe('JsonUserRepository', () => {
  let dir;
  let filePath;
  let repository;

  beforeEach(async () => {
    ({ dir, filePath } = await createTempDataFile());
    repository = new JsonUserRepository(filePath);
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('creates a missing data file containing an empty array and reads no users', async () => {
    await fs.rm(filePath);

    await expect(repository.getAll()).resolves.toEqual([]);
    await expect(readUsers(filePath)).resolves.toEqual([]);
  });

  it.each([
    ['invalid JSON', '[{"id": 1, "name": "Ava'],
    ['an empty file', ''],
    ['JSON that is not an array', '{}'],
  ])('rejects %s and leaves the file unchanged', async (_description, content) => {
    await fs.writeFile(filePath, content, 'utf8');
    const before = await fs.readFile(filePath);
    const change = vi.fn();

    await expect(repository.getAll()).rejects.toThrow(CorruptDataFileError);
    await expect(repository.modify(change)).rejects.toThrow(CorruptDataFileError);

    expect(change).not.toHaveBeenCalled();
    expect(await fs.readFile(filePath)).toEqual(before);
  });

  it('saves the complete array and leaves no temp file behind', async () => {
    const storedUsers = await readUsers(filePath);
    const newUser = makeUser(100);

    const result = await repository.modify((users) => {
      users.push(newUser);
      return newUser;
    });

    const expected = [...storedUsers, newUser];
    expect(result).toEqual(newUser);
    expect(await fs.readFile(filePath, 'utf8')).toBe(`${JSON.stringify(expected, null, 2)}\n`);
    await expect(repository.getAll()).resolves.toEqual(expected);
    expect(await fs.readdir(dir)).toEqual(['user.json']);
  });

  it('runs queued operations one at a time in call order, each seeing the previous save', async () => {
    await fs.writeFile(filePath, '[]', 'utf8');
    const user1 = makeUser(1);
    const user2 = makeUser(2);
    const user3 = makeUser(3);

    // Each change returns the ids it found before adding its own user.
    const addUser = (user) =>
      repository.modify((users) => {
        const foundIds = users.map((stored) => stored.id);
        users.push(user);
        return foundIds;
      });

    // Started without awaiting, so all four are queued at once.
    const results = await Promise.all([
      addUser(user1),
      addUser(user2),
      repository.getAll(),
      addUser(user3),
    ]);

    expect(results).toEqual([[], [1], [user1, user2], [1, 2]]);
    await expect(readUsers(filePath)).resolves.toEqual([user1, user2, user3]);
  });

  it('rejects only the caller of a failing operation and still runs the next one', async () => {
    await fs.writeFile(filePath, '[]', 'utf8');
    const failure = new Error('change failed');
    const firstUser = makeUser(1);
    const lastUser = makeUser(2);

    const results = await Promise.allSettled([
      repository.modify((users) => {
        users.push(firstUser);
      }),
      repository.modify((users) => {
        users.push(makeUser(99));
        throw failure;
      }),
      repository.modify((users) => {
        const foundIds = users.map((stored) => stored.id);
        users.push(lastUser);
        return foundIds;
      }),
    ]);

    expect(results[0]).toEqual({ status: 'fulfilled', value: undefined });
    expect(results[1]).toEqual({ status: 'rejected', reason: failure });
    expect(results[2]).toEqual({ status: 'fulfilled', value: [1] });
    // The failing change pushed a user before throwing, but nothing was saved.
    await expect(readUsers(filePath)).resolves.toEqual([firstUser, lastUser]);
  });
});
