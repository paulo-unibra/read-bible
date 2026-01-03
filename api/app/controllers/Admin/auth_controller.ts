import User from '#models/user'
import Permission from '#models/permission'
import Role from '#models/role'
import hash from '@adonisjs/core/services/hash'
import type { HttpContext } from '@adonisjs/core/http'

export default class AuthController {
  /**
   * Login para painel administrativo
   * Verifica se usuário tem permissão "acessar_painel_administrativo"
   */
  async login({ request, response }: HttpContext) {
    const { email, password } = request.only(['email', 'password'])

    try {
      // Buscar usuário por email
      const user = await User.findBy('email', email)
      
      if (!user) {
        return response.unauthorized({ 
          error: 'Credenciais inválidas' 
        })
      }

      // Verificar senha
      const isPasswordValid = await hash.verify(user.password, password)
      
      if (!isPasswordValid) {
        return response.unauthorized({ 
          error: 'Credenciais inválidas' 
        })
      }

      // Carregar roles do usuário
      await user.load('roles')

      // Verificar se tem permissão para acessar painel
      const hasAccess = await user.hasPermission('acessar_painel_administrativo')
      
      if (!hasAccess) {
        return response.forbidden({ 
          error: 'Você não tem permissão para acessar o painel administrativo' 
        })
      }

      // Gerar token de acesso
      const token = await User.accessTokens.create(user, ['admin:*'], {
        expiresIn: '7 days'
      })

      // Extrair permissões de todas as roles
      const permissions = user.roles.flatMap(role => role.permissions)
      const uniquePermissions = [...new Set(permissions)]

      return response.ok({
        type: 'bearer',
        token: token.value!.release(),
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          roles: user.roles.map(role => ({
            id: role.id,
            name: role.name,
            slug: role.slug
          })),
          permissions: uniquePermissions
        }
      })
    } catch (error) {
      console.error('Erro no login admin:', error)
      return response.internalServerError({ 
        error: 'Erro ao processar login' 
      })
    }
  }

  /**
   * Logout do painel administrativo
   */
  async logout({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    await User.accessTokens.delete(user, user.currentAccessToken.identifier)
    
    return response.ok({ message: 'Logout realizado com sucesso' })
  }

  /**
   * Retorna informações do usuário autenticado
   */
  async me({ auth, response }: HttpContext) {
    try {
      const user = auth.getUserOrFail()
      await user.load('roles')

      const permissions = user.roles.flatMap(role => role.permissions)
      const uniquePermissions = [...new Set(permissions)]

      return response.ok({
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        roles: user.roles.map(role => ({
          id: role.id,
          name: role.name,
          slug: role.slug
        })),
        permissions: uniquePermissions
      })
    } catch (error) {
      return response.unauthorized({ error: 'Não autenticado' })
    }
  }

  /**
   * Lista todos os usuários do sistema
   */
  async listUsers({ response }: HttpContext) {
    try {
      const users = await User.query().preload('roles').orderBy('id', 'asc')

      return response.ok(
        users.map(user => ({
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          roles: user.roles.map(role => ({
            id: role.id,
            name: role.name,
            slug: role.slug
          })),
          createdAt: user.createdAt.toISO()
        }))
      )
    } catch (error) {
      console.error('Erro ao listar usuários:', error)
      return response.internalServerError({ 
        error: 'Erro ao listar usuários' 
      })
    }
  }

  /**
   * Lista todas as permissões do sistema
   */
  async listPermissions({ response }: HttpContext) {
    try {
      const permissions = await Permission.query().orderBy('category', 'asc').orderBy('name', 'asc')

      return response.ok(permissions)
    } catch (error) {
      console.error('Erro ao listar permissões:', error)
      return response.internalServerError({ 
        error: 'Erro ao listar permissões' 
      })
    }
  }

  /**
   * Cria uma nova permissão
   */
  async createPermission({ request, response }: HttpContext) {
    try {
      const { name, slug, description, category, isActive } = request.only([
        'name',
        'slug',
        'description',
        'category',
        'isActive'
      ])

      // Validar campos obrigatórios
      if (!name || !slug) {
        return response.badRequest({ 
          error: 'Nome e slug são obrigatórios' 
        })
      }

      // Verificar se slug já existe
      const existingPermission = await Permission.findBy('slug', slug)
      if (existingPermission) {
        return response.conflict({ 
          error: 'Já existe uma permissão com este slug' 
        })
      }

      // Criar permissão
      const permission = await Permission.create({
        name,
        slug,
        description: description || null,
        category: category || 'general',
        isActive: isActive !== undefined ? isActive : true
      })

      return response.created(permission)
    } catch (error) {
      console.error('Erro ao criar permissão:', error)
      return response.internalServerError({ 
        error: 'Erro ao criar permissão' 
      })
    }
  }

  /**
   * Lista todas as roles do sistema
   */
  async listRoles({ response }: HttpContext) {
    try {
      const roles = await Role.query().orderBy('name', 'asc')

      return response.ok(roles)
    } catch (error) {
      console.error('Erro ao listar roles:', error)
      return response.internalServerError({ 
        error: 'Erro ao listar roles' 
      })
    }
  }

  /**
   * Adiciona uma permissão a uma role
   */
  async addPermissionToRole({ request, response, params }: HttpContext) {
    try {
      const { roleId } = params
      const { permissionSlug } = request.only(['permissionSlug'])

      if (!permissionSlug) {
        return response.badRequest({ 
          error: 'Slug da permissão é obrigatório' 
        })
      }

      // Buscar role
      const role = await Role.find(roleId)
      if (!role) {
        return response.notFound({ 
          error: 'Role não encontrada' 
        })
      }

      // Verificar se permissão existe
      const permission = await Permission.findBy('slug', permissionSlug)
      if (!permission) {
        return response.notFound({ 
          error: 'Permissão não encontrada' 
        })
      }

      // Verificar se já tem a permissão
      if (role.permissions.includes(permissionSlug)) {
        return response.conflict({ 
          error: 'Role já possui esta permissão' 
        })
      }

      // Adicionar permissão
      role.permissions = [...role.permissions, permissionSlug]
      await role.save()

      return response.ok(role)
    } catch (error) {
      console.error('Erro ao adicionar permissão à role:', error)
      return response.internalServerError({ 
        error: 'Erro ao adicionar permissão à role' 
      })
    }
  }

  /**
   * Remove uma permissão de uma role
   */
  async removePermissionFromRole({ request, response, params }: HttpContext) {
    try {
      const { roleId } = params
      const { permissionSlug } = request.only(['permissionSlug'])

      if (!permissionSlug) {
        return response.badRequest({ 
          error: 'Slug da permissão é obrigatório' 
        })
      }

      // Buscar role
      const role = await Role.find(roleId)
      if (!role) {
        return response.notFound({ 
          error: 'Role não encontrada' 
        })
      }

      // Verificar se tem a permissão
      if (!role.permissions.includes(permissionSlug)) {
        return response.notFound({ 
          error: 'Role não possui esta permissão' 
        })
      }

      // Remover permissão
      role.permissions = role.permissions.filter(p => p !== permissionSlug)
      await role.save()

      return response.ok(role)
    } catch (error) {
      console.error('Erro ao remover permissão da role:', error)
      return response.internalServerError({ 
        error: 'Erro ao remover permissão da role' 
      })
    }
  }
}