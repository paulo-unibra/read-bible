import { test } from '@japa/runner'
import User from '#models/user'

test.group('Quiz generation', () => {
  test('should validate required fields', async ({ client }) => {
    const user = await User.create({
      fullName: 'Quiz Test User',
      email: `quiz-fields-${Date.now()}@example.invalid`,
      password: 'TemporaryTestPassword123',
      emailVerified: true,
    })

    try {
      const token = await User.accessTokens.create(user)
      const response = await client
        .post('/generate-quiz')
        .header('Authorization', `Bearer ${token.value!.release()}`)
        .json({})

      response.assertStatus(400)
      response.assertBodyContains({
        error: 'bookName, chapter e bibleVersion são obrigatórios (ex: NVI, ARC, ARA, NVT)',
      })
    } finally {
      await user.delete()
    }
  })

  test('example quiz structure', async ({ assert }) => {
    // Este teste mostra o formato esperado do quiz
    const expectedQuizFormat = {
      name: 'Salmos 1',
      category: 'Bíblia - Antigo Testamento',
      questions: [
        {
          id: '1',
          pergunta: 'Pergunta de exemplo?',
          alternativas: ['Opção 1', 'Opção 2', 'Opção 3', 'Opção 4'],
        },
      ],
    }

    // Valida que possui todas as propriedades necessárias
    assert.property(expectedQuizFormat, 'name')
    assert.property(expectedQuizFormat, 'category')
    assert.property(expectedQuizFormat, 'questions')
    assert.isArray(expectedQuizFormat.questions)
    assert.notProperty(expectedQuizFormat.questions[0], 'respostaCorreta')
  })
})
