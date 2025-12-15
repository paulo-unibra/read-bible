import vine from '@vinejs/vine'

/**
 * Validator para registro de usuário
 */
export const registerValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(3).maxLength(100),
    email: vine.string().trim().email().normalizeEmail(),
    password: vine.string().minLength(6).maxLength(100)
  })
)

/**
 * Validator para login
 */
export const loginValidator = vine.compile(
  vine.object({
    email: vine.string().trim().email().normalizeEmail(),
    password: vine.string()
  })
)
