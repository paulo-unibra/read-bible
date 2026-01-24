import { BaseCommand } from '@adonisjs/core/ace'
import { CommandOptions } from '@adonisjs/core/types/ace'
import ReadingPlan from '#models/reading_plan'
import ReadingPlanItem from '#models/reading_plan_item'
import db from '@adonisjs/lucid/services/db'

export default class CreateBeginnerPlan extends BaseCommand {
  static commandName = 'create:beginner-plan'
  static description =
   
    'Cria o plano de leitura para iniciantes que divide a Bíblia até o fim do ano'

  static options: CommandOptions = {
    startApp: true,
  }

  // Dados de versículos por capítulo (Todos os 1189 capítulos da Bíblia)
  private bibleStructure = [
    /
/      Antigo Testamen
t     o
     
        
       
       ,
      ,
   
    {
     
     
     
        
       ,
      ,
   
     
      book: 'Gênesis',
     
     
        
       ,
      ,
   
     
      bookId: 1,
     
     
        
       ,
      ,
   
     
      chapters: [
     
     
        
       ,
      ,
   
     
        31, 25, 24, 
2     6, 32, 22,
      24, 22, 29,
         32, 32, 20, 18, 24, 21, 16, 27, 33, 38, 18, 34, 24, 20,
       ,
      ,
   
     
        67, 34, 35, 4
6     , 22, 35, 
4     3, 55, 32, 
        20, 31, 29, 43, 36, 30, 23, 23, 57, 38, 34, 34, 28, 34,,
      ,
   
        31, 22, 33, 26,
     
      ],
     
     
        
       ,
      ,
   
    }
,     
     
     
        
       ,
      ,
   
    {
     
     
     
        ,
      ,
   
     
      book: 'Êxodo',
     
     
        
       ,
      ,
   
     
      bookId: 2,
     
     
        
       ,
      ,
   
     
      chapters: [
     
     
        
       ,
      ,
   
        22, 25, 22, 31, 23, 30, 25, 32, 35, 29, 10, 51, 22, 31, 27, 36, 16, 27, 25, 26, 36, 31, 33,
        18, 40, 37, 21, 43, 46, 38, 18, 35, 23, 35, 35, 38, 29, 31, 43, 38,
      ],
    }
     ,
     
     
        
       ,
      ,
   
    {
     
     
     
        
       
       
       
       
       ,
      ,
   
     
      book: 'Levítico',
     
     
        
       ,
      ,
   
      bookId: 3,
      chapters: [
     
        17, 16, 17, 3
5     , 19, 30, 3
8     , 36, 24, 2
        0, 47, 8, 59, 57, 33, 34, 16, 30, 37, 27, 24, 33, 44,
       
       ,
      ,
   
     
        23, 55, 46, 34,
     
     
        
       
       ,
      ,
   
      ],
    }
     ,
     
     
        
       
       ,
      ,
   
    {
     
      book: 'Números'
     ,
     ,
   
      bookId: 4,
      chapters: [
        54, 34, 51, 49, 31, 27, 89, 26, 23, 36, 35, 16, 33, 45, 41, 50, 13, 32, 22, 29, 35, 41, 30,
        25, 18, 65, 23, 31, 40, 16, 54, 42, 56, 29, 34, 13,
      ],
    },
    {
      book: 'Deuteronômio',
      bookId: 5,
     
      chapters: [
     
     ,
   
        46, 37, 29, 49, 33, 25, 26, 20, 29, 22, 32, 32, 18, 29, 23, 22, 20, 22, 21, 20, 23, 30, 25,
        22, 19, 19, 26, 68, 29, 20, 30, 52, 29, 12,
     
      ],
     
     
        
       ,
      ,
   
    }
,     
     
     ,
   
    {
     
     
     
        
       ,
      ,
   
     
      book: 'Josué'
,     
     
        ,
      ,
   
     
      bookId: 6,
     
     
        
       ,
      ,
   
     
      chapters: [
     
     ,
   
     
        18, 24, 17, 24, 15
     , 27, 26, 35
     , 27, 43, 23, 24, 33, 15, 63, 10, 18, 28, 51, 9, 45, 34, 16,,
   
     
        33,
     
     ,
   
      ],
    },
    {
      book: 'Juízes',
      bookId: 7,
      chapters: [
        36, 23, 31, 24, 31, 40, 25, 35, 57, 18, 40, 15, 25, 20, 20, 31, 13, 31, 30, 48, 25,
      ],
    },
    { book: 'Rute', bookId: 8, chapters: [22, 23, 18, 22] },
    {
      book: '1 Samuel',
      bookId: 9,
      chapters: [
        28, 36, 21, 22, 12, 21, 17, 22, 27, 27, 15, 25, 23, 52, 35, 23, 58, 30, 24, 42, 15, 23, 29,
        22, 44, 25, 12, 25, 11, 31, 13,
      ],
    },
    {
     
     
     
        ,
      ,
   
      book: '2 Samuel',
      bookId: 10,
      chapters: [
        27, 32, 39, 12, 25, 23, 29, 18, 13, 19, 27, 31, 39, 33, 37, 23, 29, 33, 43, 26, 22, 51, 39,
        25,
      ],
    },
    {
      book: '1 Reis',
      bookId: 11,
      chapters: [
        53, 46, 28, 34, 18, 38, 51, 66, 28, 29, 43, 33, 34, 31, 34, 34, 24, 46, 21, 43, 29, 53,
      ],
    },
    {
      book: '2 Reis',
      bookId: 12,
      chapters: [
        18, 25, 27, 44, 27, 33, 20, 29, 37, 36, 21, 21, 25, 29, 38, 20, 41, 37, 37, 21, 26, 20, 37,
        20, 30,
      ],
    },
    {
      book: '1 Crônicas',
      bookId: 13,
      chapters: [
        54, 55, 24, 43, 26, 81, 40, 40, 44, 14, 47, 40, 14, 17, 29, 43, 27, 17, 19, 8, 30, 19, 32,
        31, 31, 32, 34, 21, 30,
      ],
    },
    {
      book: '2 Crônicas',
      bookId: 14,
      chapters: [
        17, 18, 17, 22, 14, 42, 22, 18, 31, 19, 23, 16, 22, 15, 19, 14, 19, 34, 11, 37, 20, 12, 21,
        27, 28, 23, 9, 27, 36, 27, 21, 33, 25, 33, 27, 23,
      ],
    },
    { book: 'Esdras', bookId: 15, chapters: [11, 70, 13, 24, 17, 22, 28, 36, 15, 44] },
    { book: 'Neemias', bookId: 16, chapters: [11, 20, 32, 23, 19, 19, 73, 18, 38, 39, 36, 47, 31] },
    { book: 'Ester', bookId: 17, chapters: [22, 23, 15, 17, 14, 14, 10, 17, 32, 3] },
    {
      book: 'Jó',
      bookId: 18,
      chapters: [
        22, 13, 26, 21, 27, 30, 21, 22, 35, 22, 20, 25, 28, 22, 35, 22, 16, 21, 29, 29, 34, 30, 17,
        25, 6, 14, 23, 28, 25, 31, 40, 22, 33, 37, 16, 33, 24, 41, 30, 24, 34, 17,
      ],
    },
    {
      book: 'Salmos',
      bookId: 19,
      chapters: [
        6, 12, 8, 8, 12, 10, 17, 9, 20, 18, 7, 8, 6, 7, 5, 11, 15, 50, 14, 9, 13, 31, 6, 10, 22, 12,
        14, 9, 11, 12, 24, 11, 22, 22, 28, 12, 40, 22, 13, 17, 13, 11, 5, 26, 17, 11, 9, 14, 20, 23,
        19, 9, 6, 7, 23, 13, 11, 11, 17, 12, 8, 12, 11, 10, 13, 20, 7, 35, 36, 5, 24, 20, 28, 23,
        10, 12, 20, 72, 13, 19, 16, 8, 18, 12, 13, 17, 7, 18, 52, 17, 16, 15, 5, 23, 11, 13, 12, 9,
        9, 5, 8, 28, 22, 35, 45, 48, 43, 13, 31, 7, 10, 10, 9, 8, 18, 19, 2, 29, 176, 7, 8, 9, 4, 8,
        5, 6, 5, 6, 8, 8, 3, 18, 3, 3, 21, 26, 9, 8, 24, 13, 10, 7, 12, 15, 21, 10, 20, 14, 9, 6,
      ],
    },
    {
      book: 'Provérbios',
      bookId: 20,
      chapters: [
        33, 22, 35, 27, 23, 35, 27, 36, 18, 32, 31, 28, 25, 35, 33, 33, 28, 24, 29, 30, 31, 29, 35,
        34, 28, 28, 27, 28, 27, 33, 31,
      ],
    },
    { book: 'Eclesiastes', bookId: 21, chapters: [18, 26, 22, 16, 20, 12, 29, 17, 18, 20, 10, 14] },
    { book: 'Cânticos', bookId: 22, chapters: [17, 17, 11, 16, 16, 13, 13, 14] },
    {
      book: 'Isaías',
      bookId: 23,
      chapters: [
        31, 22, 26, 6, 30, 13, 25, 22, 21, 34, 16, 6, 22, 32, 9, 14, 14, 7, 25, 6, 17, 25, 18, 23,
        12, 21, 13, 29, 24, 33, 9, 20, 24, 17, 10, 22, 38, 22, 8, 31, 29, 25, 28, 28, 25, 13, 15,
        22, 26, 11, 23, 15, 12, 17, 13, 12, 21, 14, 21, 22, 11, 12, 19, 12, 25, 24,
      ],
    },
    {
      book: 'Jeremias',
      bookId: 24,
      chapters: [
        19, 37, 25, 31, 31, 30, 34, 22, 26, 25, 23, 17, 27, 22, 21, 21, 27, 23, 15, 18, 14, 30, 40,
        10, 38, 24, 22, 17, 32, 24, 40, 44, 26, 22, 19, 32, 21, 28, 18, 16, 18, 22, 13, 30, 5, 28,
        7, 47, 39, 46, 64, 34,
      ],
    },
    { book: 'Lamentações', bookId: 25, chapters: [22, 22, 66, 22, 22] },
    {
      book: 'Ezequiel',
      bookId: 26,
      chapters: [
        28, 10, 27, 17, 17, 14, 27, 18, 11, 22, 25, 28, 23, 23, 8, 63, 24, 32, 14, 49, 32, 31, 49,
        27, 17, 21, 36, 26, 21, 26, 18, 32, 33, 31, 15, 38, 28, 23, 29, 49, 26, 20, 27, 31, 25, 24,
        23, 35,
      ],
    },
    { book: 'Daniel', bookId: 27, chapters: [21, 49, 30, 37, 31, 28, 28, 27, 27, 21, 45, 13] },
    {
      book: 'Oséias',
      bookId: 28,
      chapters: [11, 23, 5, 19, 15, 11, 16, 14, 17, 15, 12, 14, 16, 9],
    },
    { book: 'Joel', bookId: 29, chapters: [20, 32, 21] },
    { book: 'Amós', bookId: 30, chapters: [1: 'Obadias', bookId: 31, chapters: [2: 'Jonas', bookId: 32, chapters: [17, 10, 10, 11] },
    { book: 'Miquéias', bookId: 33, chapters: [16, 13, 12, 13, 15, 16, 20] },
    { book: 'Naum', bookId: 34, chapters: [15, 13, 19] },
    { book: 'Habacuque', bookId: 35, chapters: [17, 20, 19] },
    { book: 'Sofonias', bookId: 36, chapters: [18, 15, 20] },
    { book: 'Ageu', bookId: 37, chapters: [15, 23] },
    {
        
      
      book: 'Zacarias',
      bookId: 38,
      chapters: [21, 13, 10, 14, 11, 15, 14, 23, 17, 12, 17, 14, 9, 21],
    },
    { book: 'Malaquias', bookId: 39, chapters: [14, 17, 18, 6] },
    // Novo Testamento
    {
      book: 'Mateus',
      bookId: 40,
      chapters: [
        25, 23, 17, 25, 48, 34, 29, 34, 38, 42, 30, 50, 58, 36, 39, 28, 27, 35, 30, 34, 46, 46, 39,
        51, 46, 75, 66, 20,
      ],
    },
    {
      book: 'Marcos',
      bookId: 41,
      chapters: [45, 28, 35, 41, 43, 56, 37, 38, 50, 52, 33, 44, 37, 72, 47, 20],
    },
    {
      book: 'Lucas',
      bookId: 42,
      chapters: [
        80, 52, 38, 44, 39, 49, 50, 56, 62, 42, 54, 59, 35, 35, 32, 31, 37, 43, 48, 47, 38, 71, 56,
        53,
      ],
    },
    {
      book: 'João',
      bookId: 43,
      chapters: [
        51, 25, 36, 54, 47, 71, 53, 59, 41, 42, 57, 50, 38, 31, 27, 33, 26, 40, 42, 31, 25,
      ],
    },
    {
      book: 'Atos',
      bookId: 44,
      chapters: [
        26, 47, 26, 37, 42, 15, 60, 40, 43, 48, 30, 25, 52, 28, 41, 40, 34, 28, 41, 38, 40, 30, 35,
        27, 27, 32, 44, 31,
      ],
    },
    {
      book: 'Romanos',
      bookId: 45,
      chapters: [32, 29, 31, 25, 21, 23, 25, 39, 33, 21, 36, 21, 14, 23, 33, 27],
    },
    {
      book: '1 Coríntios',
      bookId: 46,
      chapters: [31, 16, 23, 21, 13, 20, 40, 13, 27, 33, 34, 31, 13, 40, 58, 24],
    },
    {
      book: '2 Coríntios',
      bookId: 47,
      chapters: [24, 17, 18, 18, 21, 18, 16, 24, 15, 18, 33, 21, 14],
    },
    { book: 'Gálatas', bookId: 48, chapters: [24, 21, 29, 31, 26, 18] },
    { book: 'Efésios', bookId: 49, chapters: [23, 22, 21, 32, 33, 24] },
    { book: 'Filipenses', bookId: 50, chapters: [30, 30, 21, 23] },
    { book: 'Colossenses', bookId: 51, chapters: [29, 23, 25, 18] },
    { book: '1 Tessalonicenses', bookId: 52, chapters: [10, 20, 13, 18, 28] },
    { book: '2 Tessalonicenses', bookId: 53, chapters: [12, 17, 18] },
    { book: '1 Timóteo', bookId: 54, chapters: [20, 15, 16, 16, 25, 21] },
    { book: '2 Timóteo', bookId: 55, chapters: [18, 26, 17, 22] },
    { book: 'Tito', bookId: 56, chapters: [16, 15, 15] },
    { book: 'Filemom', bookId: 57, chapters: [25] },
    { book: 'Hebreus', bookId: 58, chapters: [14, 18, 19, 16, 14, 20, 28, 13, 28, 39, 40, 29, 25] },
    { book: 'Tiago', bookId: 59, chapters: [27, 26, 18, 17, 20] },
    { book: '1 Pedro', bookId: 60, chapters: [25, 25, 22, 19, 14] },
    { book: '2 Pedro', bookId: 61, chapters: [21, 22, 18] },
    { book: '1 João', bookId: 62, chapters: [10, 29, 24, 21, 21] },
    { book: '2 João', bookId: 63, chapters: [13] },
    { book: '3 João', bookId: 64, chapters: [14] },
    { book: 'Judas', bookId: 65, chapters: [25] },
    {
      book: 'Apocalipse',
      bookId: 66,
      chapters: [
        20, 29, 22, 11, 14, 17, 17, 13, 21, 11, 19, 17, 18, 20, 8, 21, 18, 24, 21, 15, 27, 21,
      ],
    },
  ]

  async run() {
    this.logger.info('Criando Plano de Leitura para Iniciantes...')

    // Calcular dias até o fim do ano
    const today = new Date()
    const endOfYear = new Date(today.getFullYear(), 11, 31) // 31 de dezembro
    const daysUntilEndOfYear = Math.ceil(
      (endOfYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    )

    this.logger.info(`📅 Dias até o fim do ano: ${daysUntilEndOfYear}`)

    // Total de versículos na Bíblia
    const totalVerses = 31102
    const versesPerDay = Math.ceil(totalVerses / daysUntilEndOfYear)

    this.logger.info(`📖 Versículos por dia: ${versesPerDay}`)

    // Criar estrutura de leituras
    const readings: Array<{
      dayNumber: number
      chapters: Array<{ bookId: number; book: string; chapter: number; verses: number }>
      totalVerses: number
    }> = []

    let currentDay = 1
    let currentVerses = 0
    let currentChapters: Array<{
      bookId: number
      book: string
      chapter: number
      verses: number
    }> = []

    // Percorrer toda a Bíblia
    for (const book of this.bibleStructure) {
      for (let chapterIndex = 0; chapterIndex < book.chapters.length; chapterIndex++) {
        const chapterNumber = chapterIndex + 1
        const versesInChapter = book.chapters[chapterIndex]

        // Adicionar capítulo atual
        currentChapters.push({
          bookId: book.bookId,
          book: book.book,
          chapter: chapterNumber,
          verses: versesInChapter,
        })
        currentVerses += versesInChapter

        // Se atingiu ou ultrapassou o mínimo, criar uma leitura
        if (currentVerses >= versesPerDay) {
          readings.push({
            dayNumber: currentDay,
            chapters: [...currentChapters],
            totalVerses: currentVerses,
          })

          currentDay++
          currentVerses = 0
          currentChapters = []
        }
      }
    }

    // Se sobrou algum capítulo, adicionar como última leitura
    if (currentChapters.length > 0) {
      readings.push({
        dayNumber: currentDay,
        chapters: [...currentChapters],
        totalVerses: currentVerses,
      })
    }

    this.logger.info(`📚 Total de leituras criadas: ${readings.length}`)

    // Usar transação para criar tudo
    await db.transaction(async (trx) => {
      // Criar o plano
      const plan = await ReadingPlan.create(
        {
          name: 'Plano para Iniciantes',
          description: 'Leia toda a Bíblia até o fim do ano de forma leve',
          totalDays: readings.length,
          isDefault: false,
        },
        { client: trx }
      )

      this.logger.info(`✅ Plano criado com ID: ${plan.id}`)

      // Criar as primeiras 5 leituras como exemplo
      const itemsToCreate = readings.slice(0, 5).map((reading) => ({
        readingPlanId: plan.id,
        dayNumber: reading.dayNumber,
        content: JSON.stringify(reading.chapters),
      }))

      await ReadingPlanItem.createMany(itemsToCreate, { client: trx })

      this.logger.info(`✅ Primeiras 5 leituras criadas`)

      // Mostrar resumo das primeiras 5
      this.logger.info('\n📋 Resumo das primeiras 5 leituras:')
      readings.slice(0, 5).forEach((reading) => {
        const chaptersStr = reading.chapters.map((c) => `${c.book} ${c.chapter}`).join(', ')
        this.logger.info(
          `   Dia ${reading.dayNumber}: ${reading.totalVerses} versículos - ${chaptersStr}`
        )
      })

      this.logger.info(
        `\n💡 Para criar o resto das leituras, execute: node ace create:remaining-readings ${plan.id}`
      )
    })

    this.logger.success('Plano criado com sucesso!')
  }
}
