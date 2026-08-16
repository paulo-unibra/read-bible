import vine from '@vinejs/vine'

/**
 * Validator para registro de usuário
 */
export const registerValidator = vine.compile(
  vine.object({
    name: vine
      .string()
      .trim()
      .minLength(3)
      .maxLength(100)
      .regex(/^[^@]+$/),
    email: vine.string().trim().email().normalizeEmail(),
    password: vine
      .string()
      .minLength(8)
      .maxLength(100)
      .regex(/^(?=.*[A-Za-z])(?=.*\d).+$/),
  })
)

/**
 * Validator para atualização de perfil
 */
export const updateProfileValidator = vine.compile(
  vine.object({
    name: vine
      .string()
      .trim()
      .minLength(3)
      .maxLength(100)
      .regex(/^[^@]+$/),
  })
)

/**
 * Validator para login
 */
export const loginValidator = vine.compile(
  vine.object({
    email: vine.string().trim().email().normalizeEmail(),
    password: vine.string(),
  })
)
