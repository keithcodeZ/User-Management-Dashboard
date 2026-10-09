import fs from 'node:fs/promises';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp, createTempDataFile, expectError, readUsers } from './helpers/testUtils.js';

const ALREADY_IN_USE = 'Username or email is already in use.';
const USERNAME_IN_USE = 'Username is already in use.';
const EMAIL_IN_USE = 'Email is already in use.';
const USER_NOT_FOUND = 'User not found.';

// The value in upper case, checked to differ from the value, so a match
// against it can only come from ignoring letter case.
function otherCase(value) {
  const upper = value.toUpperCase();
  expect(upper).not.toBe(value);
  return upper;
}

// The response statuses in ascending order, which is the same whatever order
// the requests were handled in.
function sortedStatuses(responses) {
  return responses.map((res) => res.status).toSorted((a, b) => a - b);
}

function byId(a, b) {
  return a.id - b.id;
}

// Every request in a test goes to the same app, so the requests share one
// repository and its queue, as they do in the running server. The order in
// which they are handled is not fixed, so the tests check only outcomes that
// are the same for every order: the sorted statuses and the final file content.
describe('concurrent requests', () => {
  let dir;
  let filePath;
  let app;
  // The users in the temp data file before each test, their highest id, and
  // the index of a user in the middle of the file.
  let storedUsers;
  let highestId;
  let middle;

  beforeEach(async () => {
    ({ dir, filePath } = await createTempDataFile());
    storedUsers = await readUsers(filePath);
    highestId = Math.max(...storedUsers.map((user) => user.id));
    middle = Math.floor(storedUsers.length / 2);
    app = buildApp(filePath);
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  function postUser(body) {
    return request(app).post('/api/users').send(body);
  }

  function putUser(id, body) {
    return request(app).put(`/api/users/${id}`).send(body);
  }

  function deleteUser(id) {
    return request(app).delete(`/api/users/${id}`);
  }

  it('gives parallel creates unique ids and saves every created user', async () => {
    const inputs = [1, 2, 3, 4, 5].map((n) => ({
      name: `Parallel User ${n}`,
      username: `parallel.user${n}`,
      email: `parallel.user${n}@example.com`,
    }));

    const responses = await Promise.all(inputs.map((input) => postUser(input)));

    expect(sortedStatuses(responses)).toEqual(inputs.map(() => 201));
    // Each response holds its own input with an id.
    expect(responses.map((res) => res.body)).toStrictEqual(
      inputs.map((input, i) => ({ id: responses[i].body.id, ...input })),
    );
    // One new id per create, each following the highest stored id.
    expect(responses.map((res) => res.body.id).toSorted((a, b) => a - b)).toEqual(
      inputs.map((_input, i) => highestId + 1 + i),
    );
    // Each create appends its user with the next id, so the file lists the
    // stored users unchanged, then the created users in ascending id order.
    const createdUsers = responses.map((res) => res.body).toSorted(byId);
    expect(await readUsers(filePath)).toStrictEqual([...storedUsers, ...createdUsers]);
  });

  it('saves every change when a create, an update, and a delete of different users run together', async () => {
    // Two users in the middle of the file. The deleted user comes just before
    // the updated one, so the update must find its user by id even after the
    // delete has moved it up one place.
    const updateIndex = middle;
    const deleteIndex = middle - 1;
    const updatedUser = storedUsers[updateIndex];
    const deletedUser = storedUsers[deleteIndex];
    // The deleted user does not have the highest id, so the created user gets
    // the same id whether the delete runs before or after the create.
    expect(deletedUser.id).toBeLessThan(highestId);

    const newUser = {
      name: 'Created User',
      username: 'created.user',
      email: 'created.user@example.com',
    };
    const changes = {
      name: 'Updated User',
      username: 'updated.user',
      email: 'updated.user@example.com',
    };

    const responses = await Promise.all([
      postUser(newUser),
      putUser(updatedUser.id, changes),
      deleteUser(deletedUser.id),
    ]);

    expect(sortedStatuses(responses)).toEqual([200, 201, 204]);
    // The deleted user removed, the updated user replaced at its position, and
    // the created user appended.
    const remainingUsers = storedUsers
      .with(updateIndex, { id: updatedUser.id, ...changes })
      .toSpliced(deleteIndex, 1);
    expect(await readUsers(filePath)).toStrictEqual([
      ...remainingUsers,
      { id: highestId + 1, ...newUser },
    ]);
  });

  it('saves one of two creates that claim the same new username in different letter case and rejects the other with 409', async () => {
    const username = 'race.user';
    const inputs = [
      { name: 'Race User One', username, email: 'race.one@example.com' },
      { name: 'Race User Two', username: otherCase(username), email: 'race.two@example.com' },
    ];

    const responses = await Promise.all(inputs.map((input) => postUser(input)));

    expect(sortedStatuses(responses)).toEqual([201, 409]);
    const winner = responses.findIndex((res) => res.status === 201);
    expectError(responses[1 - winner], 409, ALREADY_IN_USE, { username: USERNAME_IN_USE });
    // The file holds exactly one new user, the one the 201 response sent.
    const createdUser = { id: highestId + 1, ...inputs[winner] };
    expect(responses[winner].body).toStrictEqual(createdUser);
    expect(await readUsers(filePath)).toStrictEqual([...storedUsers, createdUser]);
  });

  it('saves one of two updates of different users that claim the same new email in different letter case and rejects the other with 409', async () => {
    const indexes = [middle - 1, middle];
    const targets = indexes.map((index) => storedUsers[index]);
    const email = 'shared.email@example.com';
    // Each user keeps its own name and username, so only the email can conflict.
    const bodies = [
      { name: targets[0].name, username: targets[0].username, email },
      { name: targets[1].name, username: targets[1].username, email: otherCase(email) },
    ];

    const responses = await Promise.all(targets.map((user, i) => putUser(user.id, bodies[i])));

    expect(sortedStatuses(responses)).toEqual([200, 409]);
    const winner = responses.findIndex((res) => res.status === 200);
    expectError(responses[1 - winner], 409, ALREADY_IN_USE, { email: EMAIL_IN_USE });
    // Only the user whose update got 200 changed, and it holds what that
    // response sent.
    const updatedUser = { id: targets[winner].id, ...bodies[winner] };
    expect(responses[winner].body).toStrictEqual(updatedUser);
    expect(await readUsers(filePath)).toStrictEqual(storedUsers.with(indexes[winner], updatedUser));
  });

  it('answers two deletes of the same user with one 204 and one 404, and removes the user once', async () => {
    const target = storedUsers[middle];

    const responses = await Promise.all([deleteUser(target.id), deleteUser(target.id)]);

    expect(sortedStatuses(responses)).toEqual([204, 404]);
    expectError(responses.find((res) => res.status === 404), 404, USER_NOT_FOUND);
    expect(await readUsers(filePath)).toStrictEqual(storedUsers.toSpliced(middle, 1));
  });
});
