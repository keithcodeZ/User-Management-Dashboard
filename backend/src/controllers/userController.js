/**
 * Turns user requests into service calls and picks the success status. There
 * is no try/catch: Express 5 passes a rejected promise to the error handler,
 * which sends the error response.
 */
export function createUserController(userService) {
  return {
    /** Sends all users, in stored order. */
    async list(req, res) {
      res.status(200).json(await userService.listUsers());
    },

    /** Sends the user with the `:id`, which validateIdParam has already checked. */
    async getById(req, res) {
      res.status(200).json(await userService.getUser(Number(req.params.id)));
    },

    /**
     * Creates a user and sends it with 201. validateUserBody has already
     * replaced the body with the trimmed name, username, and email.
     */
    async create(req, res) {
      res.status(201).json(await userService.createUser(req.body));
    },
  };
}
