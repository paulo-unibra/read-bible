import BibleCuriosity from '#models/bible_curiosity'
import ReadingPlan from '#models/reading_plan'
import Role from '#models/role'
import { DbAccessTokensProvider } from '@adonisjs/auth/access_tokens'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import { compose } from '@adonisjs/core/helpers'
import hash from '@adonisjs/core/services/hash'
import { BaseModel, column, hasMany, manyToMany } from '@adonisjs/lucid/orm'
import type { HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'

const AuthFinder = withAuthFinder(() => hash.use('scrypt'), {
  uids: ['email'],
  passwordColumnName: 'password',
})

export default class User extends compose(BaseModel, AuthFinder) {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare fullName: string | null

  @column()
  declare email: string

  @column({ serializeAs: null })
  declare password: string

  @manyToMany(() => BibleCuriosity, {
    pivotTable: 'bible_curiosity_favorites',
    pivotForeignKey: 'user_id',
    pivotRelatedForeignKey: 'curiosity_id',
  })
  declare favoriteCuriosities: ManyToMany<typeof BibleCuriosity>

  @manyToMany(() => Role, {
    pivotTable: 'user_roles',
    pivotTimestamps: true
  })
  declare roles: ManyToMany<typeof Role>

  @hasMany(() => ReadingPlan, {
    foreignKey: 'userId'
  })
  declare readingPlans: HasMany<typeof ReadingPlan>

  /**
   * Verifica se o usuário tem uma permissão específica
   */
  async hasPermission(permission: string): Promise<boolean> {
    await this.load('roles' as any)
    return this.roles.some(role =>
      role.permissions.includes(permission)
    )
  }

  /**
   * Verifica se o usuário tem pelo menos uma das permissões fornecidas
   */
  async hasAnyPermission(permissions: string[]): Promise<boolean> {
    await this.load('roles' as any)
    return this.roles.some(role =>
      role.permissions.some(p => permissions.includes(p))
    )
  }

  /**
   * Verifica se o usuário tem todas as permissões fornecidas
   */
  async hasAllPermissions(permissions: string[]): Promise<boolean> {
    await this.load('roles' as any)
    const userPermissions = this.roles.flatMap(role => role.permissions)
    return permissions.every(p => userPermissions.includes(p))
  }

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  static accessTokens = DbAccessTokensProvider.forModel(User)
}
