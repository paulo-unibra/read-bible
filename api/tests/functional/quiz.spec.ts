import { test } from '@japa/runner'

test.group('Quiz generation', () => {
  test('should validate required fields', async ({ client }) => {
    const response = await client.post('/generate-quiz').json({})

    response.assertStatus(400)
    response.assertBodyContains({
      error: 'bibleText, bookName e chapter são obrigatórios',
    })
  })

  test('example quiz structure', async () => {
    // Este teste mostra o formato esperado do quiz
    const expectedQuizFormat = {
      name: 'Salmos 1',
      category: 'Bíblia - Antigo Testamento',
      questions: [
        {
          id: '1',
          pergunta: 'Pergunta de exemplo?',
          alternativas: ['Opção 1', 'Opção 2', 'Opção 3', 'Opção 4'],
          respostaCorreta: 'Opção 1',
        },
      ],
    }

    // Valida que possui todas as propriedades necessárias
    expect(expectedQuizFormat).toHaveProperty('name')
    expect(expectedQuizFormat).toHaveProperty('category')
    expect(expectedQuizFormat).toHaveProperty('questions')
    expect(Array.isArray(expectedQuizFormat.questions)).toBe(true)
  })
})
