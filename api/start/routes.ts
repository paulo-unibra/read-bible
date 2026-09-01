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
const AdminAuditLogController = () => import('#controllers/Admin/audit_log_controller')
const AdminQuizController = () => import('#controllers/Admin/quiz_controller')
const AdminReadingPlanTemplateController = () =>
  import('#controllers/Admin/reading_plan_template_controller')
const AdminReportController = () => import('#controllers/Admin/report_controller')
const AdminPlayStoreReportsController = () =>
  import('#controllers/Admin/play_store_reports_controller')
const BulkEmailController = () => import('#controllers/bulk_email_controller')
const BibleCuriositiesController = () => import('#controllers/bible_curiosities_controller')
const ImportController = () => import('#controllers/import_controller')
const NotesController = () => import('#controllers/notes_controller')
const PasswordResetController = () => import('#controllers/password_reset_controller')
const QueueController = () => import('#controllers/queue_controller')
const QuizController = () => import('#controllers/quiz_controller')
const QuizResultController = () => import('#controllers/quiz_result_controller')
const ReadingPlanController = () => import('#controllers/reading_plan_controller')
const ReadingPlanTemplateController = () => import('#controllers/reading_plan_template_controller')
const PlanTypesController = () => import('#controllers/plan_types_controller')
const HymnAudiosController = () => import('#controllers/hymn_audios_controller')
const AudioSyncTimestampsController = () => import('#controllers/audio_sync_timestamps_controller')
const BibleBrainController = () => import('#controllers/bible_brain_controller')
const DictionaryController = () => import('#controllers/dictionary_controller')
const AdminBibleBrainController = () => import('#controllers/Admin/bible_brain_controller')
import router from '@adonisjs/core/services/router'
import { middleware } from './kernel.js'

router.get('/', async () => {
  return {
    hello: 'world',
  }
})

// Auth routes
router.post('/auth/register', [AuthController, 'register']).use(middleware.rateLimit({ limit: 10 }))
router.post('/auth/login', [AuthController, 'login']).use(middleware.rateLimit({ limit: 10 }))
router.post('/auth/logout', [AuthController, 'logout']).use(middleware.auth())
router.get('/auth/me', [AuthController, 'me']).use(middleware.auth())
router.get('/auth/stats', [AuthController, 'stats']).use(middleware.auth())
router.put('/auth/profile', [AuthController, 'updateProfile']).use(middleware.auth())
router
  .post('/auth/profile/picture', [AuthController, 'uploadProfilePicture'])
  .use(middleware.auth())
router
  .delete('/auth/profile/picture', [AuthController, 'removeProfilePicture'])
  .use(middleware.auth())
router.get('/uploads/profile-pictures/:fileName', [AuthController, 'getProfilePicture'])

// Password Reset routes (public)
router
  .post('/password/forgot', [PasswordResetController, 'requestReset'])
  .use(middleware.rateLimit({ limit: 5 }))
router
  .post('/password/verify-token', [PasswordResetController, 'verifyToken'])
  .use(middleware.rateLimit({ limit: 5 }))
router
  .post('/password/reset', [PasswordResetController, 'resetPassword'])
  .use(middleware.rateLimit({ limit: 5 }))

// Reading Plan routes (protected)
// IMPORTANTE: Rotas específicas ANTES das rotas genéricas
router
  .post('/reading-plans/beginner', [ReadingPlanController, 'createBeginner'])
  .use(middleware.auth())
router.post('/reading-plans/custom', [ReadingPlanController, 'createCustom']).use(middleware.auth())
router.post('/reading-plans', [ReadingPlanController, 'create']).use(middleware.auth())
router.get('/reading-plans/active', [ReadingPlanController, 'getActive']).use(middleware.auth())
router
  .post('/reading-plans/complete', [ReadingPlanController, 'completeDay'])
  .use(middleware.auth())
router
  .post('/reading-plans/add-days', [ReadingPlanController, 'addNextDays'])
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

// Plan Types (public - for mobile app to check available plan types)
router.get('/plan-types', [PlanTypesController, 'active'])

// Notes routes (protected)
router.get('/notes', [NotesController, 'index']).use(middleware.auth())
router.get('/notes/:id', [NotesController, 'show']).use(middleware.auth())
router
  .get('/notes/chapter/:bookId/:chapterNumber', [NotesController, 'byChapter'])
  .use(middleware.auth())
router.post('/notes', [NotesController, 'store']).use(middleware.auth())
router.put('/notes/:id', [NotesController, 'update']).use(middleware.auth())
router.delete('/notes/:id', [NotesController, 'destroy']).use(middleware.auth())

// Quiz routes
router
  .post('/generate-quiz', [QuizController, 'generate'])
  .use(middleware.auth())
  .use(middleware.rateLimit({ limit: 10 }))
router.get('/quizzes', [QuizController, 'list'])
router.get('/quizzes/:id', [QuizController, 'show'])

// Quiz Results routes
router.post('/quiz-results', [QuizResultController, 'store']).use(middleware.auth())
router.get('/quiz-results/me', [QuizResultController, 'myResults']).use(middleware.auth())
router.get('/quiz-results/ranking', [QuizResultController, 'ranking'])
router.get('/quiz-results/stats', [QuizResultController, 'stats']).use(middleware.auth())

// Fila para livros completos
router
  .post('/queue/book', [QueueController, 'createBookJob'])
  .use(middleware.auth())
  .use(middleware.admin())
router
  .get('/queue/job/:jobId', [QueueController, 'getJobStatus'])
  .use(middleware.auth())
  .use(middleware.admin())
router
  .get('/queue/jobs', [QueueController, 'listJobs'])
  .use(middleware.auth())
  .use(middleware.admin())

// Import routes
router
  .get('/import/quizzes', [ImportController, 'importQuizzes'])
  .use(middleware.auth())
  .use(middleware.admin())
router
  .get('/queue/books', [QueueController, 'listBooks'])
  .use(middleware.auth())
  .use(middleware.admin())

// Bible Curiosities routes
router
  .post('/curiosities/generate', [BibleCuriositiesController, 'generate'])
  .use(middleware.auth())
  .use(middleware.admin())
// Rota pública para visualizar curiosidade (não requer login)
router.get('/curiosities/today', [BibleCuriositiesController, 'getToday'])
router.post('/curiosities/:id/share', [BibleCuriositiesController, 'registerShare'])
// Rota protegida - requer login para curtir
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

// Audio Sync Timestamps routes (public para o app)
router.get('/audio-sync/:bookId/:chapterNumber', [AudioSyncTimestampsController, 'show'])

// BibleBrain routes (público para o app) — acréscimo em paralelo ao fluxo do Google Drive
// IMPORTANTE: rotas específicas ANTES da rota com parâmetro
router.get('/bible-brain/bibles', [BibleBrainController, 'index'])
router.get('/bible-brain/languages', [BibleBrainController, 'languages'])
router.get('/bible-brain/video-bibles', [BibleBrainController, 'videoBibles'])
// Dictionary routes
router.get('/dictionary/search', [DictionaryController, 'search'])
router.get('/dictionary/word', [DictionaryController, 'word'])
router
  .get('/dictionary/refresh', [DictionaryController, 'refresh'])
  .use(middleware.auth())
  .use(middleware.admin())
router.get('/dictionary/stats', [DictionaryController, 'stats'])
router.get('/dictionary/files', [DictionaryController, 'files'])
router.get('/dictionary/files/download/:dictKey', [DictionaryController, 'download'])

router.get('/bible-brain/bibles/:bibleId/package/download', [BibleBrainController, 'download'])
router.get('/bible-brain/video-proxy/:filesetId/:bookId/:chapterNumber/*', [
  BibleBrainController,
  'videoProxyPlaylist',
])
router.get('/bible-brain/video-proxy/:filesetId/:bookId/:chapterNumber', [
  BibleBrainController,
  'videoProxyPlaylist',
])
router.get('/bible-brain/bibles/:bibleId/video-books', [BibleBrainController, 'videoBooks'])
router.get('/bible-brain/bibles/:bibleId/audio-books', [BibleBrainController, 'audioBooks'])
router.get('/bible-brain/bibles/:bibleId/video-segments/:bookId/:chapterNumber', [
  BibleBrainController,
  'videoSegments',
])
router.get('/bible-brain/bibles/:bibleId/video-thumbnail/:bookId/:chapterNumber', [
  BibleBrainController,
  'videoThumbnail',
])
router.get('/bible-brain/bibles/:bibleId/video/:bookId/:chapterNumber', [
  BibleBrainController,
  'videoChapter',
])
router.get('/bible-brain/bibles/:bibleId/audio/:bookId/:chapterNumber', [
  BibleBrainController,
  'audioChapter',
])
router.get('/bible-brain/bibles/:bibleId/audio-file/:bookId/:chapterNumber', [
  BibleBrainController,
  'audioFile',
])
router.get('/bible-brain/bibles/:bibleId/audio-timestamps/:bookId/:chapterNumber', [
  BibleBrainController,
  'audioTimestamps',
])
router.get('/bible-brain/bibles/:bibleId/package', [BibleBrainController, 'packageStatus'])
router
  .post('/bible-brain/bibles/:bibleId/package', [BibleBrainController, 'requestPackage'])
  .use(middleware.auth())
  .use(middleware.rateLimit({ limit: 5 }))
router.get('/bible-brain/bibles/:bibleId', [BibleBrainController, 'show'])

// Admin routes
router
  .group(() => {
    // Auth
    router.post('/login', [AdminAuthController, 'login'])
    router
      .post('/logout', [AdminAuthController, 'logout'])
      .use(middleware.auth({ guards: ['api'] }))
      .use(middleware.admin())
    router
      .get('/me', [AdminAuthController, 'me'])
      .use(middleware.auth({ guards: ['api'] }))
      .use(middleware.admin())

    // Protected admin routes (requerem autenticação)
    router
      .group(() => {
        router.get('/users', [AdminAuthController, 'listUsers'])
        router.get('/users/stats', [AdminAuthController, 'usersStats'])
        router.post('/users/send-custom-email', [AdminAuthController, 'sendCustomEmail'])
        router.get('/users/:userId/convertible-plans', [
          AdminAuthController,
          'getUserConvertiblePlans',
        ])
        router.post('/users/:userId/convert-plan', [
          AdminAuthController,
          'convertUserPlanTo365Days',
        ])
        router.post('/users/:userId/recalculate-plan', [
          AdminAuthController,
          'recalculateUserPlanBooks',
        ])
        router.get('/users/:userId/plan/:planId/check-duplicates', [
          AdminAuthController,
          'checkUserPlanForDuplicates',
        ])

        // Email logs
        router.get('/email-logs', [AdminAuthController, 'listEmailLogs'])
        router.post('/email-logs/retry', [AdminAuthController, 'retryFailedEmails'])
        router.get('/email-logs/stats', [AdminAuthController, 'getEmailStats'])

        // Audit logs
        router.get('/audit-logs', [AdminAuditLogController, 'index'])
        router.get('/audit-logs/actions', [AdminAuditLogController, 'actions'])

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

        // Plan Types management (for default plan types like Sequential, Interleaved)
        router.get('/plan-types', [PlanTypesController, 'index'])
        router.put('/plan-types/:id', [PlanTypesController, 'update'])
        router.patch('/plan-types/:id/toggle', [PlanTypesController, 'toggle'])

        // Reports
        router.get('/reports/general-stats', [AdminReportController, 'getGeneralStats'])
        router.get('/reports/app-downloads', [AdminReportController, 'getAppDownloads'])
        router.put('/reports/app-downloads', [AdminReportController, 'updateAppDownloads'])

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
        router.get('/reading-plans/all', [ReadingPlanController, 'listAllPlans'])
        router.patch('/reading-plans/:planId/disable', [ReadingPlanController, 'disablePlan'])
        router.patch('/reading-plans/:planId/enable', [ReadingPlanController, 'enablePlan'])
        router.post('/reading-plans/:planId/recalculate', [
          ReadingPlanController,
          'recalculatePlan',
        ])

        // Bible Curiosities management
        router.get('/curiosities', [BibleCuriositiesController, 'listAll'])
        router.post('/curiosities', [BibleCuriositiesController, 'store'])
        router.put('/curiosities/:id', [BibleCuriositiesController, 'update'])
        router.patch('/curiosities/:id/toggle', [BibleCuriositiesController, 'toggleActive'])
        router.delete('/curiosities/:id', [BibleCuriositiesController, 'delete'])
        router.post('/curiosities/bulk-delete', [BibleCuriositiesController, 'bulkDelete'])

        // Bulk Email management
        router.get('/bulk-email/users', [BulkEmailController, 'getUsersByStatus'])
        router.post('/bulk-email/send', [BulkEmailController, 'sendBulkEmails'])
        router.get('/bulk-email/preview', [BulkEmailController, 'previewEmail'])

        // Audio Sync Timestamps management
        router.post('/audio-sync', [AudioSyncTimestampsController, 'store'])
        router.get('/audio-sync/list', [AudioSyncTimestampsController, 'list'])
        router.get('/audio-sync/:bookId/:chapterNumber', [AudioSyncTimestampsController, 'show'])

        // BibleBrain management (sincronização + habilitação de bíblias)
        router.get('/bible-brain/languages', [AdminBibleBrainController, 'languages'])
        router.post('/bible-brain/sync', [AdminBibleBrainController, 'sync'])
        router.get('/bible-brain/sync/status', [AdminBibleBrainController, 'syncStatus'])
        router.get('/bible-brain/bibles', [AdminBibleBrainController, 'index'])
        router.patch('/bible-brain/bibles/:id/toggle', [AdminBibleBrainController, 'toggle'])
        router.post('/bible-brain/bibles/:id/package', [
          AdminBibleBrainController,
          'requestPackage',
        ])
      })
      .use(middleware.auth({ guards: ['api'] }))
      .use(middleware.admin())
  })
  .prefix('/admin')
