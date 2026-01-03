import User from '#models/user'
import { BaseCommand } from '@adonisjs/core/ace'
import { CommandOptions } from '@adonisjs/core/types/ace'

export default class CheckUserPermissions extends BaseCommand {
  static commandName = 'check:permissions'
  static description = 'Verifica as permissões de um usuário pelo email'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    const email = await this.prompt.ask('Digite o email do usuário')

    const user = await User.findBy('email', email)

    if (!user) {
      this.logger.error(`Usuário ${email} não encontrado`)
      return
    }

    await user.load('roles')

    this.logger.info(`\n👤 Usuário: ${user.fullName || user.email}`)
    this.logger.info(`📧 Email: ${user.email}`)
    this.logger.info(`\n📋 Roles:`)

    if (user.roles.length === 0) {
      this.logger.warning('  - Nenhuma role atribuída')
    } else {
      for (const role of user.roles) {
        this.logger.info(`  - ${role.name} (${role.slug})`)
        this.logger.info(`    Permissões: ${role.permissions.join(', ')}`)
      }
    }

    const allPermissions = user.roles.flatMap(role => role.permissions)
    const uniquePermissions = [...new Set(allPermissions)]

    this.logger.info(`\n🔑 Total de permissões únicas: ${uniquePermissions.length}`)
    if (uniquePermissions.length > 0) {
      this.logger.info(`Permissões: ${uniquePermissions.join(', ')}`)
    }
  }
}
