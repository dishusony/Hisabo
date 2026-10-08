/**
 * categories.routes.js - Categories REST API Routes
 */

import { Router } from 'express';
import { categoriesController } from '../controllers/categories.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

router.use(requireAuth);

router.get('/', categoriesController.getAll);
router.post('/', categoriesController.create);
router.put('/:id', categoriesController.update);
router.delete('/:id', categoriesController.delete);

export default router;
