import PlanType from '#models/plan_type'
import type { HttpContext } from '@adonisjs/core/http'

export default class PlanTypesController {
  /**
   * Listar todos os tipos de planos
   */
  async index({ response }: HttpContext) {
    try {
      const planTypes = await PlanType.query().orderBy('order', 'asc')

      return response.ok({
        success: true,
        data: planTypes,
      })
    } catch (error) {
      console.error('Erro ao listar tipos de planos:', error)
      return response.internalServerError({
        success: false,
        message: 'Erro ao listar tipos de planos',
        error: error.message,
      })
    }
  }

  /**
   * Listar apenas tipos de planos ativos (para o app)
   */
  async active({ response }: HttpContext) {
    try {
      const planTypes = await PlanType.query()
        .where('is_active', true)
        .orderBy('order', 'asc')

      return response.ok({
        success: true,
        data: planTypes,
      })
    } catch (error) {
      console.error('Erro ao listar tipos ativos:', error)
      return response.internalServerError({
        success: false,
        message: 'Erro ao listar tipos ativos',
        error: error.message,
      })
    }
  }

  /**
   * Atualizar tipo de plano (apenas nome, descrição, is_active, order)
   */
  async update({ params, request, response }: HttpContext) {
    try {
      const planType = await PlanType.find(params.id)

      if (!planType) {
        return response.notFound({
          success: false,
          message: 'Tipo de plano não encontrado',
        })
      }

      const { name, description, isActive, order } = request.only([
        'name',
        'description',
        'isActive',
        'order',
      ])

      if (name !== undefined) planType.name = name
      if (description !== undefined) planType.description = description
      if (isActive !== undefined) planType.isActive = isActive
      if (order !== undefined) planType.order = order

      await planType.save()

      return response.ok({
        success: true,
        message: 'Tipo de plano atualizado com sucesso',
        data: planType,
      })
    } catch (error) {
      console.error('Erro ao atualizar tipo de plano:', error)
      return response.internalServerError({
        success: false,
        message: 'Erro ao atualizar tipo de plano',
        error: error.message,
      })
    }
  }

  /**
   * Ativar/desativar tipo de plano
   */
  async toggle({ params, response }: HttpContext) {
    try {
      const planType = await PlanType.find(params.id)

      if (!planType) {
        return response.notFound({
          success: false,
          message: 'Tipo de plano não encontrado',
        })
      }

      planType.isActive = !planType.isActive
      await planType.save()

      return response.ok({
        success: true,
        message: `Tipo de plano ${planType.isActive ? 'ativado' : 'desativado'} com sucesso`,
        data: planType,
      })
    } catch (error) {
      console.error('Erro ao alternar tipo de plano:', error)
      return response.internalServerError({
        success: false,
        message: 'Erro ao alternar tipo de plano',
        error: error.message,
      })
    }
  }
}
