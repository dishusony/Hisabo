/**
 * income.routes.js - Income REST API Routes
 */

import { Router } from 'express';
import { incomeController } from '../controllers/income.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

router.use(requireAuth);

router.get('/', incomeController.getAll);
router.post('/', incomeController.create);
router.get('/:id', incomeController.getById);
router.put('/:id', incomeController.update);
router.delete('/:id', incomeController.delete);
router.delete('/month/:monthKey', incomeController.deleteMonth);
router.delete('/all', incomeController.deleteAll);

export default router;
