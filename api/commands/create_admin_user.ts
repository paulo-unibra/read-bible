import { BaseCommand } from '@adonisjs/core/ace'
import { CommandOptions } from '@adonisjs/core/types/ace'
import User from '#models/user'
import Role from '#models/role'

export default class CreateAdminUser extends BaseCommand {
  static commandName = 'create:admin'
  static description = 'Criar um usuário administrador para testes'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    this.logger.info('Criando usuário administrador...')

    // Dados do usuário
    const email = 'admin@readbible.com'
    const password = 'Admin@123'
    const fullName = 'Administrador Sistema'

    try {
      // Verificar se o usuário já existe
      const existingUser = await User.findBy('email', email)
      if (existingUser) {
        this.logger.warning(`Usuário ${email} já existe!`)
        this.logger.info('Atualizando roles...')
        
        // Buscar role de administrador
        const adminRole = await Role.findBy('slug', 'administrador')
        if (!adminRole) {
          this.logger.error('Role "administrador" não encontrada. Execute o seeder primeiro: node ace db:seed')
          return
        }

        // Verificar se já tem a role
        await existingUser.load('roles')
        const hasAdminRole = existingUser.roles.some(role => role.id === adminRole.id)
        
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
        this.logger.error('Role "administrador" não encontrada. Execute o seeder primeiro: node ace db:seed')
        this.logger.info('Usuário criado mas sem role atribuída.')
        return
      }

      // Associar role
      await user.related('roles').attach([adminRole.id])
      this.logger.success(`Role "Administrador" associada ao usuário`)

      this.logger.info('\n✅ Usuário administrador criado com sucesso!')
      this.logger.info(`\nCredenciais:`)
      this.logger.info(`Email: ${email}`)
      this.logger.info(`Senha: ${password}`)
      this.logger.info(`\nUse estas credenciais para fazer login no painel administrativo.`)

    } catch (error) {
      this.logger.error('Erro ao criar usuário administrador:')
      this.logger.error(error.message)
    }
  }
}
