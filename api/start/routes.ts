/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import AuthController from '#controllers/auth_controller'
import ImportController from '#controllers/import_controller'
import PasswordResetController from '#controllers/password_reset_controller'
import QueueController from '#controllers/queue_controller'
import QuizController from '#controllers/quiz_controller'
import QuizResultController from '#controllers/quiz_result_controller'
import ReadingPlanController from '#controllers/reading_plan_controller'
import router from '@adonisjs/core/services/router'
import { middleware } from './kernel.js'

router.get('/', async () => {
  return {
    hello: 'world',
  }
})

// Auth routes
router.post('/auth/register', [AuthController, 'register'])
router.post('/auth/login', [AuthController, 'login'])
router.post('/auth/logout', [AuthController, 'logout']).use(middleware.auth())
router.get('/auth/me', [AuthController, 'me']).use(middleware.auth())

// Password Reset routes (public)
router.post('/password/forgot', [PasswordResetController, 'requestReset'])
router.post('/password/verify-token', [PasswordResetController, 'verifyToken'])
router.post('/password/reset', [PasswordResetController, 'resetPassword'])

// Reading Plan routes (protected)
router.post('/reading-plans', [ReadingPlanController, 'create']).use(middleware.auth())
router.get('/reading-plans/active', [ReadingPlanController, 'getActive']).use(middleware.auth())
router.post('/reading-plans/complete', [ReadingPlanController, 'completeDay']).use(middleware.auth())
router.post('/reading-plans/unmark', [ReadingPlanController, 'unmarkDay']).use(middleware.auth())
router.get('/reading-plans/history', [ReadingPlanController, 'getHistory']).use(middleware.auth())
router.get('/reading-plans/all-history', [ReadingPlanController, 'getAllHistory']).use(middleware.auth())
router.delete('/reading-plans', [ReadingPlanController, 'deletePlan']).use(middleware.auth())

// Ranking routes (public)
router.get('/ranking', [ReadingPlanController, 'getRanking'])
router.get('/ranking/page', [ReadingPlanController, 'getRankingPage'])

// Quiz routes
router.post('/generate-quiz', [QuizController, 'generate'])
router.get('/quizzes', [QuizController, 'list'])
router.get('/quizzes/:id', [QuizController, 'show'])

// Quiz Results routes
router.post('/quiz-results', [QuizResultController, 'store']).use(middleware.auth())
router.get('/quiz-results/me', [QuizResultController, 'myResults']).use(middleware.auth())
router.get('/quiz-results/ranking', [QuizResultController, 'ranking'])
router.get('/quiz-results/stats', [QuizResultController, 'stats']).use(middleware.auth())

// Fila para livros completos
router.post('/queue/book', [QueueController, 'createBookJob'])
router.get('/queue/job/:jobId', [QueueController, 'getJobStatus'])
router.get('/queue/jobs', [QueueController, 'listJobs'])

// Import routes
router.get('/import/quizzes', [ImportController, 'importQuizzes'])
router.get('/queue/books', [QueueController, 'listBooks'])

