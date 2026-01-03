import Permission from '#models/permission'
import { BaseSeeder } from '@adonisjs/lucid/seeders'

export default class extends BaseSeeder {
  async run() {
    const permissions = [
      {
        name: 'Acessar Painel Administrativo',
        slug: 'acessar_painel_administrativo',
        description: 'Permite acessar o painel administrativo do sistema',
        category: 'admin',
      },
      {
        name: 'Gerenciar Usuários',
        slug: 'gerenciar_usuarios',
        description: 'Criar, editar e excluir usuários do sistema',
        category: 'users',
      },
      {
        name: 'Gerenciar Conteúdo',
        slug: 'gerenciar_conteudo',
        description: 'Gerenciar conteúdo bíblico e recursos do aplicativo',
        category: 'content',
      },
      {
        name: 'Gerenciar Questionários',
        slug: 'gerenciar_questionarios',
        description: 'Criar e editar questionários bíblicos',
        category: 'quizzes',
      },
      {
        name: 'Visualizar Relatórios',
        slug: 'visualizar_relatorios',
        description: 'Acessar relatórios e estatísticas do sistema',
        category: 'reports',
      },
      {
        name: 'Gerenciar Roles',
        slug: 'gerenciar_roles',
        description: 'Criar e editar papéis e suas permissões',
        category: 'roles',
      },
      {
        name: 'Configurar Sistema',
        slug: 'configurar_sistema',
        description: 'Acessar e modificar configurações do sistema',
        category: 'settings',
      },
    ]

    for (const permission of permissions) {
      await Permission.updateOrCreate({ slug: permission.slug }, permission)
    }
  }
}
