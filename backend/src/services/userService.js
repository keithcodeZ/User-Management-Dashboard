import { ConflictError, NotFoundError } from '../errors/appErrors.js';

/**
 * Returns the id for a new user: one higher than the highest stored id, or 1
 * when there are no users. Ids are positive, so 0 is a safe starting point.
 */
export function nextUserId(users) {
  return users.reduce((highest, user) => Math.max(highest, user.id), 0) + 1;
}

/**
 * Returns a message for `username` and for `email` when another user already
 * has that value, ignoring letter case, or `{}` when neither is taken. The
 * user whose id is `ignoreId` is skipped, so an update can keep its own values.
 */
export function findConflicts(users, input, ignoreId) {
  const username = input.username.toLowerCase();
  const email = input.email.toLowerCase();
  const otherUsers = users.filter((user) => user.id !== ignoreId);

  const conflicts = {};
  if (otherUsers.some((user) => user.username.toLowerCase() === username)) {
    conflicts.username = 'Username is already in use.';
  }
  if (otherUsers.some((user) => user.email.toLowerCase() === email)) {
    conflicts.email = 'Email is already in use.';
  }
  return conflicts;
}

// Builds a stored user from validated input. Listing the fields one by one
// keeps `id` first, matching the key order of the data file, and means an `id`
// or any other key in `input` can never replace the id or add a field.
function toStoredUser(id, input) {
  return { id, name: input.name, username: input.username, email: input.email };
}

// Throws a ConflictError naming each field that another user already uses.
function assertUnique(users, input, ignoreId) {
  const conflicts = findConflicts(users, input, ignoreId);
  if (Object.keys(conflicts).length > 0) {
    throw new ConflictError('Username or email is already in use.', conflicts);
  }
}

// Returns the array index of the user with this id, or throws a NotFoundError.
function findUserIndex(users, id) {
  const index = users.findIndex((user) => user.id === id);
  if (index === -1) {
    throw new NotFoundError('User not found.');
  }
  return index;
}

/**
 * Holds the business rules for users on top of a repository. Each create,
 * update, and delete runs its checks inside one `modify` call, so the checks
 * see exactly the users that get saved, and a failed check saves nothing.
 */
export function createUserService(userRepository) {
  return {
    /** Resolves with all users, in stored order. */
    listUsers() {
      return userRepository.getAll();
    },

    /** Resolves with the user with this id, or rejects with a NotFoundError. */
    async getUser(id) {
      const users = await userRepository.getAll();
      return users[findUserIndex(users, id)];
    },

    /**
     * Appends a user with the next id and resolves with it. Rejects with a
     * ConflictError when another user has the username or email.
     */
    createUser(input) {
      return userRepository.modify((users) => {
        assertUnique(users, input);
        const user = toStoredUser(nextUserId(users), input);
        users.push(user);
        return user;
      });
    },

    /**
     * Replaces the user with this id at its position and resolves with the
     * result. Rejects with a NotFoundError for an unknown id, checked first,
     * or a ConflictError when another user has the username or email.
     */
    updateUser(id, input) {
      return userRepository.modify((users) => {
        const index = findUserIndex(users, id);
        assertUnique(users, input, id);
        const user = toStoredUser(id, input);
        users[index] = user;
        return user;
      });
    },

    /** Removes the user with this id, or rejects with a NotFoundError. */
    deleteUser(id) {
      return userRepository.modify((users) => {
        const index = findUserIndex(users, id);
        users.splice(index, 1);
      });
    },
  };
}
