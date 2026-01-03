import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Permission from '#models/permission'
import Role from '#models/role'

export default class extends BaseSeeder {
  async run() {
    // Buscar todas as permissões
    const allPermissions = await Permission.all()
    const allPermissionSlugs = allPermissions.map(p => p.slug)
    
    // Atualizar ou criar role de Administrador com todas as permissões
    await Role.updateOrCreate(
      { slug: 'administrador' },
      {
        name: 'Administrador',
        slug: 'administrador',
        description: 'Acesso total ao sistema administrativo',
        permissions: allPermissionSlugs
      }
    )
    
    // Atualizar ou criar role de Editor
    await Role.updateOrCreate(
      { slug: 'editor' },
      {
        name: 'Editor',
        slug: 'editor',
        description: 'Pode gerenciar conteúdo e questionários',
        permissions: [
          'acessar_painel_administrativo',
          'gerenciar_conteudo',
          'gerenciar_questionarios',
          'visualizar_relatorios'
        ]
      }
    )
    
    // Atualizar ou criar role de Usuário
    await Role.updateOrCreate(
      { slug: 'usuario' },
      {
        name: 'Usuário',
        slug: 'usuario',
        description: 'Usuário padrão do aplicativo',
        permissions: []
      }
    )
  }
}
