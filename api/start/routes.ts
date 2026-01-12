/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

const AuthController = () => import('#controllers/auth_controller')
const AdminAuthController = () => import('#controllers/Admin/auth_controller')
const AdminQuizController = () => import('#controllers/Admin/quiz_controller')
const AdminReadingPlanTemplateController = () =>
  import('#controllers/Admin/reading_plan_template_controller')
const AdminReportController = () => import('#controllers/Admin/report_controller')
const AdminPlayStoreReportsController = () =>
  import('#controllers/Admin/play_store_reports_controller')
const BibleCuriositiesController = () => import('#controllers/bible_curiosities_controller')
const ImportController = () => import('#controllers/import_controller')
const PasswordResetController = () => import('#controllers/password_reset_controller')
const QueueController = () => import('#controllers/queue_controller')
const QuizController = () => import('#controllers/quiz_controller')
const QuizResultController = () => import('#controllers/quiz_result_controller')
const ReadingPlanController = () => import('#controllers/reading_plan_controller')
const ReadingPlanTemplateController = () => import('#controllers/reading_plan_template_controller')
const HymnAudiosController = () => import('#controllers/hymn_audios_controller')
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
router.get('/auth/stats', [AuthController, 'stats']).use(middleware.auth())
router.put('/auth/profile', [AuthController, 'updateProfile']).use(middleware.auth())

// Password Reset routes (public)
router.post('/password/forgot', [PasswordResetController, 'requestReset'])
router.post('/password/verify-token', [PasswordResetController, 'verifyToken'])
router.post('/password/reset', [PasswordResetController, 'resetPassword'])

// Reading Plan routes (protected)
router.post('/reading-plans', [ReadingPlanController, 'create']).use(middleware.auth())
router.post('/reading-plans/custom', [ReadingPlanController, 'createCustom']).use(middleware.auth())
router.get('/reading-plans/active', [ReadingPlanController, 'getActive']).use(middleware.auth())
router
  .post('/reading-plans/complete', [ReadingPlanController, 'completeDay'])
  .use(middleware.auth())
router.post('/reading-plans/unmark', [ReadingPlanController, 'unmarkDay']).use(middleware.auth())
router.get('/reading-plans/history', [ReadingPlanController, 'getHistory']).use(middleware.auth())
router
  .get('/reading-plans/all-history', [ReadingPlanController, 'getAllHistory'])
  .use(middleware.auth())
router
  .get('/reading-plans/all-readings', [ReadingPlanController, 'getAllReadings'])
  .use(middleware.auth())
router.delete('/reading-plans', [ReadingPlanController, 'deletePlan']).use(middleware.auth())

// Ranking routes (public)
router.get('/ranking', [ReadingPlanController, 'getRanking'])
router.get('/ranking/page', [ReadingPlanController, 'getRankingPage'])

// Reading Plan Templates (public - for mobile app)
router.get('/reading-plan-templates', [ReadingPlanTemplateController, 'index'])
router.get('/reading-plan-templates/:id', [ReadingPlanTemplateController, 'show'])

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

// Bible Curiosities routes
router.post('/curiosities/generate', [BibleCuriositiesController, 'generate'])
router.get('/curiosities/today', [BibleCuriositiesController, 'getToday'])
router
  .post('/curiosities/:id/favorite', [BibleCuriositiesController, 'toggleFavorite'])
  .use(middleware.auth())
router
  .get('/curiosities/favorites', [BibleCuriositiesController, 'getFavorites'])
  .use(middleware.auth())

// Hymn Audio routes (public para o app, admin para gerenciamento)
// IMPORTANTE: Rota específica ANTES da rota com parâmetro
router.get('/hymn-audios/stream/:fileId', [HymnAudiosController, 'streamAudio'])
router.get('/hymn-audios/:hymnNumber', [HymnAudiosController, 'getByHymnNumber'])

// Admin routes
router
  .group(() => {
    // Auth
    router.post('/login', [AdminAuthController, 'login'])
    router
      .post('/logout', [AdminAuthController, 'logout'])
      .use(middleware.auth({ guards: ['api'] }))
    router.get('/me', [AdminAuthController, 'me']).use(middleware.auth({ guards: ['api'] }))

    // Protected admin routes (requerem autenticação)
    router
      .group(() => {
        router.get('/users', [AdminAuthController, 'listUsers'])
        router.get('/users/stats', [AdminAuthController, 'usersStats'])
        router.get('/users/:userId/convertible-plans', [AdminAuthController, 'getUserConvertiblePlans'])
        router.post('/users/:userId/convert-plan', [AdminAuthController, 'convertUserPlanTo365Days'])
        router.post('/users/:userId/recalculate-plan', [AdminAuthController, 'recalculateUserPlanBooks'])
        router.get('/users/:userId/plan/:planId/check-duplicates', [AdminAuthController, 'checkUserPlanForDuplicates'])
        router.get('/permissions', [AdminAuthController, 'listPermissions'])
        router.post('/permissions', [AdminAuthController, 'createPermission'])
        router.get('/roles', [AdminAuthController, 'listRoles'])
        router.post('/roles/:roleId/permissions', [AdminAuthController, 'addPermissionToRole'])
        router.delete('/roles/:roleId/permissions', [
          AdminAuthController,
          'removePermissionFromRole',
        ])

        // Quiz management
        router.get('/quizzes', [AdminQuizController, 'index'])
        router.get('/quizzes/stats', [AdminQuizController, 'stats'])
        router.get('/quizzes/:id', [AdminQuizController, 'show'])
        router.post('/quizzes', [AdminQuizController, 'store'])
        router.put('/quizzes/:id', [AdminQuizController, 'update'])
        router.delete('/quizzes/:id', [AdminQuizController, 'destroy'])
        router.post('/quizzes/generate-ai', [AdminQuizController, 'generateWithAI'])
        router.get('/quizzes/jobs/:jobId', [AdminQuizController, 'getJobStatus'])

        // Reading Plan Templates management
        router.get('/reading-plan-templates', [AdminReadingPlanTemplateController, 'index'])
        router.get('/reading-plan-templates/:id', [AdminReadingPlanTemplateController, 'show'])
        router.post('/reading-plan-templates', [AdminReadingPlanTemplateController, 'store'])
        router.put('/reading-plan-templates/:id', [AdminReadingPlanTemplateController, 'update'])
        router.delete('/reading-plan-templates/:id', [
          AdminReadingPlanTemplateController,
          'destroy',
        ])
        router.post('/reading-plan-templates/generate-with-ai', [
          AdminReadingPlanTemplateController,
          'generateWithAI',
        ])

        // Reports
        router.get('/reports/general-stats', [AdminReportController, 'getGeneralStats'])

        // Play Store Reports
        router.get('/reports/play-store/general', [AdminPlayStoreReportsController, 'generalStats'])
        router.get('/reports/play-store/installs', [
          AdminPlayStoreReportsController,
          'installMetrics',
        ])
        router.get('/reports/play-store/crashes', [AdminPlayStoreReportsController, 'crashMetrics'])
        router.get('/reports/play-store/anrs', [AdminPlayStoreReportsController, 'anrMetrics'])

        // Play Store Reports - TESTES DIRETOS
        router.get('/reports/play-store/test/direct-access', [
          AdminPlayStoreReportsController,
          'testDirectAccess',
        ])
        router.get('/reports/play-store/test/direct-query', [
          AdminPlayStoreReportsController,
          'testDirectQuery',
        ])

        // Hymn Audio Sync management
        router.get('/hymn-audios/list', [HymnAudiosController, 'listHymnsWithAudio'])
        router.get('/hymn-audios/search/:hymnNumber', [HymnAudiosController, 'searchInDrive'])
        router.post('/hymn-audios', [HymnAudiosController, 'upsert'])
        router.patch('/hymn-audios/:id/offset', [HymnAudiosController, 'updateOffset'])
        router.delete('/hymn-audios/:id', [HymnAudiosController, 'delete'])

        // Reading Plans management
        router.get('/reading-plans/incorrect', [ReadingPlanController, 'listIncorrectPlans'])
        router.post('/reading-plans/:planId/recalculate', [ReadingPlanController, 'recalculatePlan'])

        // Bible Curiosities management
        router.get('/curiosities', [BibleCuriositiesController, 'listAll'])
        router.put('/curiosities/:id', [BibleCuriositiesController, 'update'])
        router.patch('/curiosities/:id/toggle', [BibleCuriositiesController, 'toggleActive'])
        router.delete('/curiosities/:id', [BibleCuriositiesController, 'delete'])
      })
      .use(middleware.auth({ guards: ['api'] }))
  })
  .prefix('/admin')
