import Quiz from '#models/quiz'
import QuizQuestion from '#models/quiz_question'
import env from '#start/env'
import type { HttpContext } from '@adonisjs/core/http'
import { Storage } from '@google-cloud/storage'

export default class ImportController {
  /**
   * Importar quizzes do Google Cloud Storage para o banco de dados
   * GET /import/quizzes?prefix=arc
   */
  async importQuizzes({ request, response }: HttpContext) {
    try {
      const prefix = request.input('prefix')

      console.log('🚀 Iniciando importação de quizzes...')

      // Verificar credenciais
      const gcsCredentials = env.get('GCS_CREDENTIALS', '')
      const bucketName = env.get('GCS_BUCKET_NAME', '')

      if (!gcsCredentials || !bucketName) {
        return response.badRequest({
          success: false,
          message: 'Credenciais do Cloud Storage não configuradas',
        })
      }

      // Inicializar Cloud Storage
      console.log('🔧 Inicializando Cloud Storage...')
      const credentials = JSON.parse(gcsCredentials)
      const storage = new Storage({ credentials })

      // Listar arquivos no bucket
      console.log(`📦 Buscando arquivos no bucket: ${bucketName}`)
      const [files] = await storage.bucket(bucketName).getFiles({
        prefix: prefix ? `quizzes/${prefix}` : 'quizzes/',
      })

      const jsonFiles = files.filter((f) => f.name.endsWith('.json'))
      console.log(`📄 Encontrados ${jsonFiles.length} arquivos JSON`)

      if (jsonFiles.length === 0) {
        return response.ok({
          success: true,
          message: 'Nenhum arquivo JSON encontrado',
          imported: 0,
          skipped: 0,
          errors: 0,
        })
      }

      let imported = 0
      let skipped = 0
      let errors = 0
      const errorDetails: string[] = []

      // Processar cada arquivo
      for (const file of jsonFiles) {
        try {
          console.log(`📖 Processando: ${file.name}`)

          // Download do arquivo
          const [content] = await file.download()
          const quizData = JSON.parse(content.toString())

          // Extrair informações do nome do arquivo
          const fileName = file.name.replace('quizzes/', '').replace('.json', '')
          const decodedFileName = decodeURIComponent(fileName)
          const parts = decodedFileName.split('-')

          let bibleVersion = 'ARC'
          let bookName = ''
          let chapter = 0

          if (parts.length >= 3) {
            bibleVersion = parts[0].toUpperCase()

            if (!isNaN(Number.parseInt(parts[1]))) {
              // Formato: arc-1-samuel-1
              const bookNumber = parts[1]
              const bookBaseName = parts.slice(2, -1).join('-')
              bookName = `${bookNumber} ${this.capitalizeBookName(bookBaseName)}`
              chapter = Number.parseInt(parts[parts.length - 1])
            } else {
              // Formato: arc-genesis-1
              const bookBaseName = parts.slice(1, -1).join('-')
              bookName = this.capitalizeBookName(bookBaseName)
              chapter = Number.parseInt(parts[parts.length - 1])
            }
          } else {
            console.warn(`⚠️  Formato inválido: ${file.name}`)
            errors++
            errorDetails.push(`Formato inválido: ${file.name}`)
            continue
          }

          // Verificar se já existe
          const existing = await Quiz.query()
            .where('book_name', bookName)
            .where('chapter', chapter)
            .where('bible_version', bibleVersion)
            .first()

          if (existing) {
            console.log(`⏭️  Quiz já existe (ID: ${existing.id})`)
            skipped++
            continue
          }

          // Criar quiz
          const testament = this.getTestament(bookName)
          const publicUrl = `https://storage.googleapis.com/${bucketName}/${file.name}`

          const quiz = await Quiz.create({
            bookName,
            chapter,
            bibleVersion,
            testament,
            category: quizData.category || `${bookName} ${chapter}`,
            cloudStorageUrl: publicUrl,
          })

          // Criar questões
          if (quizData.questions && Array.isArray(quizData.questions)) {
            for (let i = 0; i < quizData.questions.length; i++) {
              const q = quizData.questions[i]
              await QuizQuestion.create({
                quizId: quiz.id,
                questionId: q.id || `q${i + 1}`,
                pergunta: q.pergunta,
                alternativas: q.alternativas,
                respostaCorreta: q.respostaCorreta,
                order: i + 1,
              })
            }
          }

          console.log(
            `✅ Quiz importado: ${bookName} ${chapter} (${bibleVersion}) - ${quizData.questions?.length || 0} questões`
          )
          imported++
        } catch (error: any) {
          console.error(`❌ Erro ao processar ${file.name}: ${error.message}`)
          errors++
          errorDetails.push(`${file.name}: ${error.message}`)
        }
      }

      return response.ok({
        success: true,
        message: 'Importação concluída',
        summary: {
          imported,
          skipped,
          errors,
          total: jsonFiles.length,
        },
        errorDetails: errorDetails.length > 0 ? errorDetails : undefined,
      })
    } catch (error: any) {
      console.error('❌ Erro fatal:', error.message)
      return response.internalServerError({
        success: false,
        message: 'Erro ao importar quizzes',
        error: error.message,
      })
    }
  }

  private capitalizeBookName(name: string): string {
    const bookMap: Record<string, string> = {
      genesis: 'Gênesis',
      gênesis: 'Gênesis',
      exodo: 'Êxodo',
      êxodo: 'Êxodo',
      levitico: 'Levítico',
      levítico: 'Levítico',
      numeros: 'Números',
      números: 'Números',
      deuteronomio: 'Deuteronômio',
      deuteronômio: 'Deuteronômio',
      josue: 'Josué',
      josué: 'Josué',
      juizes: 'Juízes',
      juízes: 'Juízes',
      rute: 'Rute',
      samuel: 'Samuel',
      reis: 'Reis',
      cronicas: 'Crônicas',
      crônicas: 'Crônicas',
      esdras: 'Esdras',
      neemias: 'Neemias',
      ester: 'Ester',
      jo: 'Jó',
      jó: 'Jó',
      salmos: 'Salmos',
      proverbios: 'Provérbios',
      provérbios: 'Provérbios',
      eclesiastes: 'Eclesiastes',
      cantares: 'Cantares de Salomão',
      isaias: 'Isaías',
      isaías: 'Isaías',
      jeremias: 'Jeremias',
      lamentacoes: 'Lamentações',
      lamentações: 'Lamentações',
      ezequiel: 'Ezequiel',
      daniel: 'Daniel',
      oseias: 'Oséias',
      oséias: 'Oséias',
      joel: 'Joel',
      amos: 'Amós',
      amós: 'Amós',
      obadias: 'Obadias',
      jonas: 'Jonas',
      miqueias: 'Miquéias',
      miquéias: 'Miquéias',
      naum: 'Naum',
      habacuque: 'Habacuque',
      sofonias: 'Sofonias',
      ageu: 'Ageu',
      zacarias: 'Zacarias',
      malaquias: 'Malaquias',
      mateus: 'Mateus',
      marcos: 'Marcos',
      lucas: 'Lucas',
      joao: 'João',
      joão: 'João',
      atos: 'Atos',
      romanos: 'Romanos',
      corintios: 'Coríntios',
      coríntios: 'Coríntios',
      galatas: 'Gálatas',
      gálatas: 'Gálatas',
      efesios: 'Efésios',
      efésios: 'Efésios',
      filipenses: 'Filipenses',
      colossenses: 'Colossenses',
      tessalonicenses: 'Tessalonicenses',
      timoteo: 'Timóteo',
      timóteo: 'Timóteo',
      tito: 'Tito',
      filemom: 'Filemom',
      hebreus: 'Hebreus',
      tiago: 'Tiago',
      pedro: 'Pedro',
      judas: 'Judas',
      apocalipse: 'Apocalipse',
    }

    const normalized = name.toLowerCase().trim()
    return bookMap[normalized] || this.capitalizeFirst(name)
  }

  private getTestament(bookName: string): string {
    const oldTestament = [
      'Gênesis',
      'Êxodo',
      'Levítico',
      'Números',
      'Deuteronômio',
      'Josué',
      'Juízes',
      'Rute',
      '1 Samuel',
      '2 Samuel',
      '1 Reis',
      '2 Reis',
      '1 Crônicas',
      '2 Crônicas',
      'Esdras',
      'Neemias',
      'Ester',
      'Jó',
      'Salmos',
      'Provérbios',
      'Eclesiastes',
      'Cantares de Salomão',
      'Isaías',
      'Jeremias',
      'Lamentações',
      'Ezequiel',
      'Daniel',
      'Oséias',
      'Joel',
      'Amós',
      'Obadias',
      'Jonas',
      'Miquéias',
      'Naum',
      'Habacuque',
      'Sofonias',
      'Ageu',
      'Zacarias',
      'Malaquias',
    ]

    return oldTestament.includes(bookName) ? 'old' : 'new'
  }

  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
  }
}
