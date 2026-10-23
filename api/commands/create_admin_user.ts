import Role from '#models/role'
import User from '#models/user'
import env from '#start/env'
import { BaseCommand } from '@adonisjs/core/ace'
import { CommandOptions } from '@adonisjs/core/types/ace'

export default class CreateAdminUser extends BaseCommand {
  static commandName = 'create:admin'
  static description = 'Criar um usuário administrador para testes'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    this.logger.info('Criando usuário administrador...')

    const email = env.get('BOOTSTRAP_ADMIN_EMAIL')?.trim().toLowerCase()
    const password = env.get('BOOTSTRAP_ADMIN_PASSWORD')
    const fullName = env.get('BOOTSTRAP_ADMIN_NAME')?.trim() || 'Administrador Sistema'

    if (!email || !password || password.length < 12) {
      this.logger.error(
        'Defina BOOTSTRAP_ADMIN_EMAIL e uma BOOTSTRAP_ADMIN_PASSWORD com pelo menos 12 caracteres no ambiente desta execução.'
      )
      return
    }

    try {
      // Verificar se o usuário já existe
      const existingUser = await User.findBy('email', email)
      if (existingUser) {
        this.logger.warning(`Usuário ${email} já existe!`)
        this.logger.info('Atualizando roles...')

        // Buscar role de administrador
        const adminRole = await Role.findBy('slug', 'administrador')
        if (!adminRole) {
          this.logger.error(
            'Role "administrador" não encontrada. Execute o seeder primeiro: node ace db:seed'
          )
          return
        }

        // Verificar se já tem a role
        await existingUser.load('roles')
        const hasAdminRole = existingUser.roles.some((role) => role.id === adminRole.id)

        if (!hasAdminRole) {
          await existingUser.related('roles').attach([adminRole.id])
          this.logger.success(`Role "Administrador" adicionada ao usuário ${email}`)
        } else {
          this.logger.info(`Usuário ${email} já tem a role de Administrador`)
        }

        return
      }

      // Criar novo usuário
      const user = await User.create({
        email,
        password,
        fullName,
      })

      this.logger.success(`Usuário criado: ${email}`)

      // Buscar role de administrador
      const adminRole = await Role.findBy('slug', 'administrador')
      if (!adminRole) {
        this.logger.error(
          'Role "administrador" não encontrada. Execute o seeder primeiro: node ace db:seed'
        )
        this.logger.info('Usuário criado mas sem role atribuída.')
        return
      }

      // Associar role
      await user.related('roles').attach([adminRole.id])
      this.logger.success(`Role "Administrador" associada ao usuário`)

      this.logger.info('\n✅ Usuário administrador criado com sucesso!')
      this.logger.info(`Conta: ${email}`)
      this.logger.info('A senha não será exibida nos logs.')
    } catch (error) {
      this.logger.error('Erro ao criar usuário administrador:')
      this.logger.error(error.message)
    }
  }
}
