/**
 * goals.routes.js - Financial Goals REST API Routes
 */

import { Router } from 'express';
import { goalsController } from '../controllers/goals.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

router.use(requireAuth);

router.get('/', goalsController.getAll);
router.post('/', goalsController.create);
router.get('/:id', goalsController.getById);
router.put('/:id', goalsController.update);
router.post('/:id/contribute', goalsController.addFunds);
router.post('/:id/funds', goalsController.addFunds);
router.delete('/:id', goalsController.delete);

export default router;
