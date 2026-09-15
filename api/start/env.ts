/*
|--------------------------------------------------------------------------
| Environment variables service
|--------------------------------------------------------------------------
|
| The `Env.create` method creates an instance of the Env service. The
| service validates the environment variables and also cast values
| to JavaScript data types.
|
*/

import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  APP_KEY: Env.schema.string(),
  HOST: Env.schema.string({ format: 'host' }),
  ADMIN_ORIGIN: Env.schema.string.optional(),
  LOG_LEVEL: Env.schema.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']),
  GOOGLE_API_KEY: Env.schema.string(),
  GOOGLE_BIBLE_DRIVE_FOLDER_ID: Env.schema.string(),
  GOOGLE_AUDIO_DRIVE_FOLDER_ID: Env.schema.string(),
  GOOGLE_HARPA_DRIVE_FOLDER_ID: Env.schema.string.optional(),
  GOOGLE_DICTIONARY_DRIVE_FOLDER_ID: Env.schema.string.optional(),
  DEEPSEEK_API_KEY: Env.schema.string(),
  GCS_BUCKET_NAME: Env.schema.string.optional(),
  GCS_CREDENTIALS: Env.schema.string.optional(),
  BIBLE_BRAIN_KEY: Env.schema.string.optional(),

  // Resend Email Service
  RESEND_API_KEY: Env.schema.string(),
  RESEND_FROM_EMAIL: Env.schema.string(),
  RESEND_FROM_NAME: Env.schema.string.optional(),
  TEST_EMAIL_RECIPIENT: Env.schema.string.optional(),
})
