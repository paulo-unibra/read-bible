import OpenAI from 'openai'
import env from '#start/env'

interface QuizQuestion {
  id: string
  pergunta: string
  alternativas: string[]
  respostaCorreta: string
}

interface QuizResponse {
  name: string
  category: string
  questions: QuizQuestion[]
}

export default class DeepSeekService {
  private client: OpenAI

  constructor() {
    this.client = new OpenAI({
      apiKey: env.get('DEEPSEEK_API_KEY'),
      baseURL: 'https://api.deepseek.com'
    })
  }

  async generateQuiz(
    bookName: string,
    chapter: string,
    bibleVersion: string
  ): Promise<QuizResponse> {
    const testament = this.getTestament(bookName)

    const prompt = `
Você é um especialista em criação de questionários bíblicos educacionais.

Crie um questionário sobre ${bookName} capítulo ${chapter} da versão ${bibleVersion} da Bíblia.

IMPORTANTE: Use o texto EXATO da versão ${bibleVersion}. As perguntas devem referenciar as palavras e expressões específicas dessa versão.

Crie um questionário com 10 perguntas objetivas de múltipla escolha. Cada pergunta deve:
- Ter 4 alternativas
- Ter apenas uma resposta correta
- Testar a compreensão do texto bíblico
- Usar terminologia fiel à versão ${bibleVersion}
- Ser clara e objetiva

IMPORTANTE: Retorne APENAS um JSON válido no seguinte formato, sem markdown ou texto adicional:

{
  "name": "${bookName} ${chapter}",
  "category": "Bíblia - ${testament}",
  "bibleVersion": "${bibleVersion}",
  "questions": [
    {
      "id": "1",
      "pergunta": "Pergunta aqui?",
      "alternativas": ["Opção 1", "Opção 2", "Opção 3", "Opção 4"],
      "respostaCorreta": "Opção correta"
    }
  ]
}
`

    try {
      const completion = await this.client.chat.completions.create({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: 'Você é um assistente que cria questionários bíblicos. Retorne APENAS JSON válido, sem formatação markdown.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })

      const content = completion.choices[0]?.message?.content
      if (!content) {
        throw new Error('Resposta vazia da API')
      }

      // Remover markdown se presente
      let jsonContent = content.trim()
      if (jsonContent.startsWith('```json')) {
        jsonContent = jsonContent.replace(/```json\n?/g, '').replace(/```\n?$/g, '')
      } else if (jsonContent.startsWith('```')) {
        jsonContent = jsonContent.replace(/```\n?/g, '').replace(/```\n?$/g, '')
      }

      const quizData = JSON.parse(jsonContent) as QuizResponse

      // Validar estrutura
      if (!quizData.name || !quizData.category || !Array.isArray(quizData.questions)) {
        throw new Error('Estrutura de quiz inválida')
      }

      return quizData
    } catch (error) {
      console.error('Erro ao chamar DeepSeek API:', error)
      throw new Error(`Falha ao gerar quiz: ${error.message}`)
    }
  }

  private getTestament(bookName: string): string {
    const oldTestament = [
      'Gênesis', 'Êxodo', 'Levítico', 'Números', 'Deuteronômio',
      'Josué', 'Juízes', 'Rute', '1 Samuel', '2 Samuel',
      '1 Reis', '2 Reis', '1 Crônicas', '2 Crônicas', 'Esdras',
      'Neemias', 'Ester', 'Jó', 'Salmos', 'Provérbios',
      'Eclesiastes', 'Cânticos', 'Isaías', 'Jeremias', 'Lamentações',
      'Ezequiel', 'Daniel', 'Oseias', 'Joel', 'Amós',
      'Obadias', 'Jonas', 'Miqueias', 'Naum', 'Habacuque',
      'Sofonias', 'Ageu', 'Zacarias', 'Malaquias'
    ]

    return oldTestament.includes(bookName) ? 'Antigo Testamento' : 'Novo Testamento'
  }
}
