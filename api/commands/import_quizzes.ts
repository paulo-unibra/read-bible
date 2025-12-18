import { BaseCommand, args } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { Storage } from '@google-cloud/storage'
import env from '#start/env'
import db from '@adonisjs/lucid/services/db'
import Quiz from '#models/quiz'
import QuizQuestion from '#models/quiz_question'

export default class ImportQuizzes extends BaseCommand {
  static commandName = 'import:quizzes'
  static description = 'Importar quizzes do Google Cloud Storage para o banco de dados'

  static options: CommandOptions = {
    startInApp: true,
  }

  @args.string({ description: 'Prefixo do arquivo (opcional, ex: nvi-genesis)' })
  declare prefix?: string

  private storage: Storage | null = null
  private bucketName: string = ''

  async prepare() {
    // Força inicialização do Lucid ORM com query simples
    try {
      const Database = (await import('@adonisjs/lucid/services/db')).default
      await Database.rawQuery('SELECT 1')
      this.logger.info('✅ Lucid ORM inicializado')
    } catch (error: any) {
      this.logger.error('❌ Erro ao inicializar Lucid ORM:', error.message)
      throw error
    }
  }

  async run() {
    try {
      this.logger.info('🚀 Iniciando importação de quizzes...')

      this.logger.info('🚀 Iniciando importação de quizzes...')

      // Verificar credenciais
      const gcsCredentials = env.get('GCS_CREDENTIALS', '')
      this.bucketName = env.get('GCS_BUCKET_NAME', '')

      if (!gcsCredentials || !this.bucketName) {
        this.logger.error('❌ Credenciais do Cloud Storage não configuradas')
        this.logger.info('Configure GCS_CREDENTIALS e GCS_BUCKET_NAME no .env')
        return
      }

      // Inicializar Cloud Storage
      this.logger.info('🔧 Inicializando Cloud Storage...')
      const credentials = JSON.parse(gcsCredentials)
      this.storage = new Storage({ credentials })

      // Listar arquivos no bucket
      this.logger.info(`📦 Buscando arquivos no bucket: ${this.bucketName}`)
      const [files] = await this.storage.bucket(this.bucketName).getFiles({
        prefix: this.prefix ? `quizzes/${this.prefix}` : 'quizzes/',
      })

      const jsonFiles = files.filter((f) => f.name.endsWith('.json'))
      this.logger.info(`📄 Encontrados ${jsonFiles.length} arquivos JSON`)

      if (jsonFiles.length === 0) {
        this.logger.warning('⚠️  Nenhum arquivo JSON encontrado')
        return
      }

      let imported = 0
      let skipped = 0
      let errors = 0

      // Processar cada arquivo
      for (const file of jsonFiles) {
        try {
          this.logger.info(`\n📖 Processando: ${file.name}`)

          // Download do arquivo
          const [content] = await file.download()
          const quizData = JSON.parse(content.toString())

          // Extrair informações do nome do arquivo
          // Formato esperado: quizzes/arc-gênesis-1.json ou arc-1-samuel-1.json
          const fileName = file.name.replace('quizzes/', '').replace('.json', '')

          // Decodificar URL encoding (ex: %C3%AA -> ê)
          const decodedFileName = decodeURIComponent(fileName)
          const parts = decodedFileName.split('-')

          let bibleVersion = 'ARC'
          let bookName = ''
          let chapter = 0

          // Formato: versao-livro-capitulo ou versao-numero-livro-capitulo
          if (parts.length >= 3) {
            bibleVersion = parts[0].toUpperCase()

            // Verificar se o segundo elemento é um número (ex: 1-samuel)
            if (!isNaN(parseInt(parts[1]))) {
              // Formato: arc-1-samuel-1
              const bookNumber = parts[1]
              const bookBaseName = parts.slice(2, -1).join('-')
              bookName = `${bookNumber} ${this.capitalizeBookName(bookBaseName)}`
              chapter = parseInt(parts[parts.length - 1])
            } else {
              // Formato: arc-genesis-1
              const bookBaseName = parts.slice(1, -1).join('-')
              bookName = this.capitalizeBookName(bookBaseName)
              chapter = parseInt(parts[parts.length - 1])
            }
          } else {
            this.logger.warning(`⚠️  Formato de arquivo inválido: ${file.name}`)
            errors++
            continue
          }

          // Verificar se já existe
          const existing = await Quiz.query()
            .where('book_name', bookName)
            .where('chapter', chapter)
            .where('bible_version', bibleVersion)
            .first()

          if (existing) {
            this.logger.info(`⏭️  Quiz já existe no banco (ID: ${existing.id})`)
            skipped++
            continue
          }

          // Criar quiz
          const testament = this.getTestament(bookName)
          const publicUrl = `https://storage.googleapis.com/${this.bucketName}/${file.name}`

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

          this.logger.success(
            `✅ Quiz importado: ${bookName} ${chapter} (${bibleVersion}) - ${quizData.questions?.length || 0} questões`
          )
          imported++
        } catch (error: any) {
          this.logger.error(`❌ Erro ao processar ${file.name}: ${error.message}`)
          this.logger.error(`   Stack: ${error.stack?.split('\n').slice(0, 3).join('\n')}`)
          errors++
        }
      }

      // Resumo
      this.logger.info('\n' + '='.repeat(50))
      this.logger.info('📊 RESUMO DA IMPORTAÇÃO')
      this.logger.info('='.repeat(50))
      this.logger.success(`✅ Importados: ${imported}`)
      this.logger.info(`⏭️  Ignorados (já existiam): ${skipped}`)
      if (errors > 0) {
        this.logger.error(`❌ Erros: ${errors}`)
      }
      this.logger.info('='.repeat(50))
    } catch (error) {
      this.logger.error(`❌ Erro fatal: ${error.message}`)
      this.logger.error(error.stack)
    }
  }

  /**
   * Capitalizar nome do livro
   */
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
      cantares: 'Cantares',
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

  /**
   * Capitalizar primeira letra
   */
  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
  }

  /**
   * Determinar testamento
   */
  private getTestament(bookName: string): string {
    const oldTestamentBooks = [
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
      'Cantares',
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

    return oldTestamentBooks.includes(bookName) ? 'old' : 'new'
  }
}
