import ReadingPlanTemplate from '#models/reading_plan_template'
import type { HttpContext } from '@adonisjs/core/http'

export default class ReadingPlanTemplateController {
  /**
   * Lista templates ativos para o app mobile
   */
  async index({ response }: HttpContext) {
    try {
      const templates = await ReadingPlanTemplate.query()
        .where('is_active', true)
        .orderBy('order', 'asc')
        .orderBy('id', 'desc')

      return response.ok({
        templates: templates.map((template) => ({
          id: template.id,
          name: template.name,
          description: template.description,
          type: template.type,
          duration: template.duration,
          testament: template.testament,
          readingsCount: JSON.parse(template.readings).length,
        })),
      })
    } catch (error) {
      console.error('Erro ao listar templates:', error)
      return response.internalServerError({
        error: 'Erro ao listar templates',
      })
    }
  }

  /**
   * Busca template específico com leituras
   */
  async show({ params, response }: HttpContext) {
    try {
      const template = await ReadingPlanTemplate.query()
        .where('id', params.id)
        .where('is_active', true)
        .firstOrFail()

      return response.ok({
        id: template.id,
        name: template.name,
        description: template.description,
        type: template.type,
        duration: template.duration,
        testament: template.testament,
        readings: JSON.parse(template.readings),
      })
    } catch (error) {
      console.error('Erro ao buscar template:', error)
      return response.notFound({
        error: 'Template não encontrado',
      })
    }
  }
}
