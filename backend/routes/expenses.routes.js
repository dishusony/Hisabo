/**
 * expenses.routes.js - Expenses API Routes
 */

import { Router } from 'express';
import { expensesController } from '../controllers/expenses.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

// All expense routes require authentication
router.use(requireAuth);

router.get('/', expensesController.getAll);
router.post('/', expensesController.create);
router.post('/sync', expensesController.sync);
router.get('/months', expensesController.getMonths);
router.delete('/month/:monthKey', expensesController.deleteMonth);
router.delete('/all', expensesController.deleteAll);
router.get('/:id', expensesController.getById);
router.put('/:id', expensesController.update);
router.delete('/:id', expensesController.delete);

export default router;
