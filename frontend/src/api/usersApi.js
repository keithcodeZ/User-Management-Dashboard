const GENERIC_ERROR_MESSAGE = 'Request failed. Please try again.';

// A failed users API request. `status` is the HTTP status, or undefined when
// no response arrived. `fields` holds the server's per-field messages, if any.
export class ApiError extends Error {
  constructor(message, status, fields) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fields = fields;
  }
}

// The single place that calls the backend. Paths are relative, so the Vite
// proxy forwards them to the backend.
async function request(path, { method = 'GET', body } = {}) {
  const options = { method };
  if (body !== undefined) {
    options.headers = { 'Content-Type': 'application/json' };
    options.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(path, options);
  } catch {
    throw new ApiError(GENERIC_ERROR_MESSAGE);
  }

  if (response.status === 204) {
    return undefined;
  }

  // A body that is not valid JSON counts as no body.
  const data = await response.json().catch(() => undefined);

  if (response.ok) {
    return data;
  }

  if (typeof data?.error?.message === 'string') {
    throw new ApiError(data.error.message, response.status, data.error.fields);
  }

  throw new ApiError(GENERIC_ERROR_MESSAGE, response.status);
}

export function fetchUsers() {
  return request('/api/users');
}

export function createUser(input) {
  return request('/api/users', { method: 'POST', body: input });
}

export function updateUser(id, input) {
  return request(`/api/users/${id}`, { method: 'PUT', body: input });
}

export function deleteUser(id) {
  return request(`/api/users/${id}`, { method: 'DELETE' });
}
