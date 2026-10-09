import express from 'express';
import { validateIdParam, validateUserBody } from '../validation/userValidation.js';

/**
 * Maps each user endpoint to its validation middleware and controller
 * function. The app mounts the router at /api/users, so paths are relative.
 */
export function createUserRouter(userController) {
  const router = express.Router();

  router.get('/', userController.list);
  router.get('/:id', validateIdParam, userController.getById);
  router.post('/', validateUserBody, userController.create);

  return router;
}
