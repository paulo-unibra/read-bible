import { Storage } from '@google-cloud/storage'
import env from '#start/env'
import fs from 'node:fs/promises'
import path from 'node:path'

export default class CloudStorageService {
  private storage: Storage
  private bucketName: string

  constructor() {
    const credentialsStr = env.get('GCS_CREDENTIALS')
    const bucketName = env.get('GCS_BUCKET_NAME')

    if (!credentialsStr || !bucketName) {
      throw new Error(
        'Google Cloud Storage não configurado. Configure GCS_CREDENTIALS e GCS_BUCKET_NAME no .env'
      )
    }

    let credentials
    try {
      credentials = JSON.parse(credentialsStr)
    } catch (error) {
      throw new Error(`GCS_CREDENTIALS inválido. Deve ser um JSON válido. Erro: ${error.message}`)
    }

    this.storage = new Storage({
      credentials,
      projectId: credentials.project_id,
    })

    this.bucketName = bucketName
  }

  async uploadQuiz(quizData: any, fileName: string): Promise<string> {
    console.log('[CloudStorage] Iniciando upload...', fileName)

    const tmpDir = path.join(process.cwd(), 'tmp')
    const tmpFilePath = path.join(tmpDir, fileName)

    try {
      // Garantir que o diretório tmp existe
      await fs.mkdir(tmpDir, { recursive: true })

      // Escrever JSON no arquivo temporário
      await fs.writeFile(tmpFilePath, JSON.stringify(quizData, null, 2), 'utf-8')

      // Upload para Cloud Storage
      const bucket = this.storage.bucket(this.bucketName)
      const file = bucket.file(`quizzes/${fileName}`)

      await file.save(JSON.stringify(quizData, null, 2), {
        contentType: 'application/json',
        metadata: {
          cacheControl: 'public, max-age=3600',
        },
      })

      console.log('[CloudStorage] Arquivo enviado com sucesso:', fileName)

      // Remover arquivo temporário
      await fs.unlink(tmpFilePath)

      // Retornar URL pública
      const publicUrl = `https://storage.googleapis.com/${this.bucketName}/quizzes/${fileName}`
      return publicUrl
    } catch (error) {
      console.error('Erro ao fazer upload para Cloud Storage:', error)

      // Tentar limpar arquivo temporário
      try {
        await fs.unlink(tmpFilePath)
      } catch {}

      throw new Error(`Falha no upload para Cloud Storage: ${error.message}`)
    }
  }
}
