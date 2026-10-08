import fs from 'node:fs/promises';
import { CorruptDataFileError } from '../errors/appErrors.js';

/**
 * Stores the users as a JSON array in one file. Every read and write runs
 * through one promise queue, so a read-modify-write never interleaves with
 * another operation and concurrent requests cannot lose updates.
 */
export class JsonUserRepository {
  #filePath;
  // Settles once every operation queued so far has finished.
  #queue = Promise.resolve();

  constructor(filePath) {
    this.#filePath = filePath;
  }

  /** Resolves with all stored users, in file order. */
  getAll() {
    return this.#enqueue(() => this.#read());
  }

  /**
   * Runs one queued operation: read the users, call `change(users)`, then save.
   * `change` may mutate the array or throw; a throw skips the save and rejects
   * only this call. Resolves with the value `change` returned.
   */
  modify(change) {
    return this.#enqueue(async () => {
      const users = await this.#read();
      const result = change(users);
      await this.#save(users);
      return result;
    });
  }

  #enqueue(task) {
    const result = this.#queue.then(task);
    // The queue swallows a failure so later operations still run, while the
    // caller sees it through the promise returned here.
    this.#queue = result.catch(() => {});
    return result;
  }

  async #read() {
    let content;
    try {
      content = await fs.readFile(this.#filePath, 'utf8');
    } catch (err) {
      if (err.code === 'ENOENT') {
        // No data file yet: create it with an empty list.
        await this.#save([]);
        return [];
      }
      throw err;
    }

    // A corrupt file is reported and left as it is, never overwritten.
    let users;
    try {
      users = JSON.parse(content); // an empty file fails here too
    } catch {
      throw new CorruptDataFileError();
    }
    if (!Array.isArray(users)) {
      throw new CorruptDataFileError();
    }
    return users;
  }

  // Writes a temp file and renames it over the data file, so the data file
  // always holds a complete array. A fixed temp name is safe because the queue
  // never runs two saves at once.
  async #save(users) {
    const tempPath = `${this.#filePath}.tmp`;
    try {
      await fs.writeFile(tempPath, `${JSON.stringify(users, null, 2)}\n`, 'utf8');
      await fs.rename(tempPath, this.#filePath);
    } catch (err) {
      await fs.rm(tempPath, { force: true });
      throw err;
    }
  }
}
