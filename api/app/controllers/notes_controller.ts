import type { HttpContext } from '@adonisjs/core/http'
import Note from '#models/note'
import { createNoteValidator, updateNoteValidator } from '#validators/note'

export default class NotesController {
  /**
   * Listar todas as anotações do usuário
   */
  async index({ auth, response }: HttpContext) {
    try {
      const user = auth.user!
      const notes = await Note.query()
        .where('user_id', user.id)
        .orderBy('updated_at', 'desc')

      return response.ok({
        success: true,
        data: notes,
      })
    } catch (error) {
      console.error('Error fetching notes:', error)
      return response.internalServerError({
        success: false,
        message: 'Erro ao buscar anotações',
      })
    }
  }

  /**
   * Listar anotações de um capítulo específico
   */
  async byChapter({ auth, params, response }: HttpContext) {
    try {
      const user = auth.user!
      const { bookId, chapterNumber } = params

      const notes = await Note.query()
        .where('user_id', user.id)
        .where('book_id', bookId)
        .where('chapter_number', chapterNumber)
        .orderBy('created_at', 'asc')

      return response.ok({
        success: true,
        data: notes,
      })
    } catch (error) {
      console.error('Error fetching chapter notes:', error)
      return response.internalServerError({
        success: false,
        message: 'Erro ao buscar anotações do capítulo',
      })
    }
  }

  /**
   * Buscar uma anotação específica
   */
  async show({ auth, params, response }: HttpContext) {
    try {
      const user = auth.user!
      const note = await Note.query()
        .where('id', params.id)
        .where('user_id', user.id)
        .firstOrFail()

      return response.ok({
        success: true,
        data: note,
      })
    } catch (error) {
      return response.notFound({
        success: false,
        message: 'Anotação não encontrada',
      })
    }
  }

  /**
   * Criar nova anotação
   */
  async store({ auth, request, response }: HttpContext) {
    try {
      console.log('🔵 [STORE] Iniciando criação de nota')
      console.log('🔵 [STORE] Auth user:', auth.user?.id, auth.user?.email)
      
      const user = auth.user!
      console.log('🔵 [STORE] Request body:', request.body())
      
      const payload = await request.validateUsing(createNoteValidator)
      console.log('🔵 [STORE] Payload validado:', JSON.stringify(payload, null, 2))

      // Verificar se já existe uma anotação para esses versículos
      console.log('🔵 [STORE] Verificando se nota já existe...')
      const existingNote = await Note.query()
        .where('user_id', user.id)
        .where('book_id', payload.bookId)
        .where('chapter_number', payload.chapterNumber)
        .whereRaw('JSON_CONTAINS(verse_numbers, ?)', [JSON.stringify(payload.verseNumbers)])
        .first()

      console.log('🔵 [STORE] Nota existente:', existingNote ? `ID ${existingNote.id}` : 'Nenhuma')

      if (existingNote) {
        // Atualizar anotação existente
        console.log('🔵 [STORE] Atualizando nota existente...')
        existingNote.note = payload.note
        existingNote.verseText = payload.verseText
        existingNote.isPrivate = payload.isPrivate ?? true
        await existingNote.save()
        console.log('✅ [STORE] Nota atualizada com sucesso:', existingNote.id)

        return response.ok({
          success: true,
          message: 'Anotação atualizada com sucesso',
          data: existingNote,
        })
      }

      // Criar nova anotação
      console.log('🔵 [STORE] Criando nova nota...')
      const noteData = {
        userId: user.id,
        bookId: payload.bookId,
        bookName: payload.bookName,
        chapterNumber: payload.chapterNumber,
        verseNumbers: payload.verseNumbers,
        verseText: payload.verseText,
        note: payload.note,
        isPrivate: payload.isPrivate ?? true,
      }
      console.log('🔵 [STORE] Dados da nota:', JSON.stringify(noteData, null, 2))
      
      const note = await Note.create(noteData)
      console.log('✅ [STORE] Nota criada com sucesso:', note.id)

      return response.created({
        success: true,
        message: 'Anotação criada com sucesso',
        data: note,
      })
    } catch (error) {
      console.error('❌ [STORE] Erro ao criar nota:', error)
      console.error('❌ [STORE] Error stack:', error.stack)
      console.error('❌ [STORE] Error messages:', error.messages)
      return response.badRequest({
        success: false,
        message: 'Erro ao criar anotação',
        errors: error.messages || error.message,
      })
    }
  }

  /**
   * Atualizar anotação
   */
  async update({ auth, params, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const payload = await request.validateUsing(updateNoteValidator)

      const note = await Note.query()
        .where('id', params.id)
        .where('user_id', user.id)
        .firstOrFail()

      note.note = payload.note ?? note.note
      note.isPrivate = payload.isPrivate ?? note.isPrivate
      await note.save()

      return response.ok({
        success: true,
        message: 'Anotação atualizada com sucesso',
        data: note,
      })
    } catch (error) {
      console.error('Error updating note:', error)
      return response.badRequest({
        success: false,
        message: 'Erro ao atualizar anotação',
      })
    }
  }

  /**
   * Deletar anotação
   */
  async destroy({ auth, params, response }: HttpContext) {
    try {
      const user = auth.user!
      const note = await Note.query()
        .where('id', params.id)
        .where('user_id', user.id)
        .firstOrFail()

      await note.delete()

      return response.ok({
        success: true,
        message: 'Anotação excluída com sucesso',
      })
    } catch (error) {
      console.error('Error deleting note:', error)
      return response.badRequest({
        success: false,
        message: 'Erro ao excluir anotação',
      })
    }
  }
}