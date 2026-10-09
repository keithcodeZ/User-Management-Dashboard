import { useCallback, useEffect, useState } from 'react';
import * as usersApi from '../api/usersApi.js';

// Owns the user list: loads it on mount and applies each successful change.
// A failed change rejects with the ApiError and leaves the list as it was.
export function useUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // State changes only in the promise callbacks, so the effect below never
  // sets state synchronously.
  const load = useCallback(() => {
    usersApi
      .fetchUsers()
      .then((data) => {
        setUsers(data);
      })
      .catch((err) => {
        setError(err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function reload() {
    setLoading(true);
    setError(null);
    load();
  }

  async function createUser(input) {
    const created = await usersApi.createUser(input);
    setUsers((current) => [...current, created]);
    return created;
  }

  async function updateUser(id, input) {
    const updated = await usersApi.updateUser(id, input);
    setUsers((current) =>
      current.map((user) => (user.id === updated.id ? updated : user)),
    );
    return updated;
  }

  async function deleteUser(id) {
    const result = await usersApi.deleteUser(id);
    setUsers((current) => current.filter((user) => user.id !== id));
    return result;
  }

  return { users, loading, error, reload, createUser, updateUser, deleteUser };
}
