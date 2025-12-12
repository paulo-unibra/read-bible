/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import router from '@adonisjs/core/services/router'
import QuizController from '#controllers/quiz_controller'
import QueueController from '#controllers/queue_controller'

router.get('/', async () => {
  return {
    hello: 'world',
  }
})

// Quiz individual
router.post('/generate-quiz', [QuizController, 'generate'])

// Fila para livros completos
router.post('/queue/book', [QueueController, 'createBookJob'])
router.get('/queue/job/:jobId', [QueueController, 'getJobStatus'])
router.get('/queue/jobs', [QueueController, 'listJobs'])
router.get('/queue/books', [QueueController, 'listBooks'])
