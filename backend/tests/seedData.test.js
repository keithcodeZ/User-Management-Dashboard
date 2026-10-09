import fs from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { validateUserInput } from '../src/validation/userValidation.js';
import { createTempDataFile, readUsers } from './helpers/testUtils.js';

// Names a seed user in assertion messages.
function userLabel(user) {
  return `seed user ${JSON.stringify(user)}`;
}

describe('seed data', () => {
  let dir;
  let users;

  // Each test reads the users from its own temp copy of the seed file.
  beforeEach(async () => {
    const tempFile = await createTempDataFile();
    dir = tempFile.dir;
    users = await readUsers(tempFile.filePath);
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('gives each user exactly a positive integer id and a string name, username, and email', () => {
    for (const user of users) {
      const label = userLabel(user);
      expect(user, label).toStrictEqual({
        id: expect.any(Number),
        name: expect.any(String),
        username: expect.any(String),
        email: expect.any(String),
      });
      expect(Number.isInteger(user.id), label).toBe(true);
      expect(user.id, label).toBeGreaterThanOrEqual(1);
    }
  });

  it('numbers the users 1 to N in array order, with N from 12 to 15', () => {
    expect(users.length).toBeGreaterThanOrEqual(12);
    expect(users.length).toBeLessThanOrEqual(15);
    expect(users.map((user) => user.id)).toEqual(users.map((_user, index) => index + 1));
  });

  it('passes validation for every user, with the values returned unchanged', () => {
    for (const user of users) {
      const { name, username, email } = user;
      expect(validateUserInput(user), userLabel(user)).toStrictEqual({
        value: { name, username, email },
        errors: null,
      });
    }
  });

  it('gives every user a given name and a family name', () => {
    for (const user of users) {
      expect(user.name, userLabel(user)).toMatch(/^\S+( \S+)+$/);
    }
  });

  it('uses only the example.com, example.org, and example.net email domains', () => {
    for (const user of users) {
      expect(user.email, userLabel(user)).toMatch(/^[^@]+@example\.(com|org|net)$/);
    }
  });

  it.each(['name', 'username', 'email'])('never repeats a %s, ignoring case', (field) => {
    const values = users.map((user) => user[field].toLowerCase());
    const duplicates = values.filter((value, index) => values.indexOf(value) !== index);
    expect(duplicates).toEqual([]);
  });

  it.each([
    ['son', 'name'],
    ['son', 'username'],
    ['example.org', 'email'],
  ])('matches "%s" in the %s of at least 2 users but not all, ignoring case', (term, field) => {
    const matches = users.filter((user) => user[field].toLowerCase().includes(term.toLowerCase()));
    expect(matches.length).toBeGreaterThanOrEqual(2);
    expect(matches.length).toBeLessThan(users.length);
  });
});
