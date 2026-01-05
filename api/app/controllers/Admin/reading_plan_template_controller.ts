import ReadingPlanTemplate from '#models/reading_plan_template'
import type { HttpContext } from '@adonisjs/core/http'

export default class AdminReadingPlanTemplateController {
  /**
   * Lista todos os templates
   */
  async index({ request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const perPage = request.input('perPage', 20)
      const type = request.input('type', '')
      const isActive = request.input('isActive', '')

      const query = ReadingPlanTemplate.query()

      if (type) {
        query.where('type', type)
      }

      if (isActive !== '') {
        query.where('is_active', isActive === 'true')
      }

      const templates = await query.orderBy('order', 'asc').orderBy('id', 'desc').paginate(page, perPage)

      return response.ok({
        data: templates.all().map((template) => ({
          id: template.id,
          name: template.name,
          description: template.description,
          type: template.type,
          duration: template.duration,
          testament: template.testament,
          readingsCount: JSON.parse(template.readings).length,
          isActive: template.isActive,
          order: template.order,
          createdAt: template.createdAt.toISO(),
        })),
        meta: templates.getMeta(),
      })
    } catch (error) {
      console.error('Erro ao listar templates:', error)
      return response.internalServerError({
        error: 'Erro ao listar templates',
      })
    }
  }

  /**
   * Busca template específico
   */
  async show({ params, response }: HttpContext) {
    try {
      const template = await ReadingPlanTemplate.findOrFail(params.id)

      return response.ok({
        id: template.id,
        name: template.name,
        description: template.description,
        type: template.type,
        duration: template.duration,
        testament: template.testament,
        readings: JSON.parse(template.readings),
        isActive: template.isActive,
        order: template.order,
        createdAt: template.createdAt.toISO(),
        updatedAt: template.updatedAt.toISO(),
      })
    } catch (error) {
      console.error('Erro ao buscar template:', error)
      return response.notFound({
        error: 'Template não encontrado',
      })
    }
  }

  /**
   * Cria novo template
   */
  async store({ request, response }: HttpContext) {
    try {
      const { name, description, type, duration, testament, readings, isActive, order } =
        request.only(['name', 'description', 'type', 'duration', 'testament', 'readings', 'isActive', 'order'])

      if (!name || !description || !type || !duration || !testament || !readings) {
        return response.badRequest({
          error: 'Todos os campos são obrigatórios',
        })
      }

      const template = await ReadingPlanTemplate.create({
        name,
        description,
        type,
        duration: Number.parseInt(duration),
        testament,
        readings: JSON.stringify(readings),
        isActive: isActive ?? true,
        order: order ?? 0,
      })

      return response.created({
        id: template.id,
        message: 'Template criado com sucesso',
      })
    } catch (error) {
      console.error('Erro ao criar template:', error)
      return response.internalServerError({
        error: 'Erro ao criar template',
      })
    }
  }

  /**
   * Atualiza template
   */
  async update({ params, request, response }: HttpContext) {
    try {
      const template = await ReadingPlanTemplate.findOrFail(params.id)

      const { name, description, type, duration, testament, readings, isActive, order } =
        request.only(['name', 'description', 'type', 'duration', 'testament', 'readings', 'isActive', 'order'])

      template.merge({
        name: name || template.name,
        description: description || template.description,
        type: type || template.type,
        duration: duration ? Number.parseInt(duration) : template.duration,
        testament: testament || template.testament,
        readings: readings ? JSON.stringify(readings) : template.readings,
        isActive: isActive !== undefined ? isActive : template.isActive,
        order: order !== undefined ? order : template.order,
      })

      await template.save()

      return response.ok({
        message: 'Template atualizado com sucesso',
      })
    } catch (error) {
      console.error('Erro ao atualizar template:', error)
      return response.internalServerError({
        error: 'Erro ao atualizar template',
      })
    }
  }

  /**
   * Deleta template
   */
  async destroy({ params, response }: HttpContext) {
    try {
      const template = await ReadingPlanTemplate.findOrFail(params.id)
      await template.delete()

      return response.ok({
        message: 'Template deletado com sucesso',
      })
    } catch (error) {
      console.error('Erro ao deletar template:', error)
      return response.internalServerError({
        error: 'Erro ao deletar template',
      })
    }
  }
}
