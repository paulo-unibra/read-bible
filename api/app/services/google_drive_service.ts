import { google } from 'googleapis'
import env from '#start/env'
import fs from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import path from 'node:path'

export default class GoogleDriveService {
  private drive

  constructor() {
    const clientId = env.get('GOOGLE_DRIVE_CLIENT_ID')
    const clientSecret = env.get('GOOGLE_DRIVE_CLIENT_SECRET')
    const refreshToken = env.get('GOOGLE_DRIVE_REFRESH_TOKEN')

    // Validar se as credenciais OAuth estão configuradas
    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error(
        'Google Drive OAuth não configurado. Configure GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET e GOOGLE_DRIVE_REFRESH_TOKEN no .env'
      )
    }

    // Criar cliente OAuth2
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      'http://localhost:3333/oauth2callback'
    )

    // Configurar refresh token
    oauth2Client.setCredentials({
      refresh_token: refreshToken,
    })

    this.drive = google.drive({ version: 'v3', auth: oauth2Client })
  }

  async uploadQuiz(quizData: any, fileName: string): Promise<string> {
    console.log('[GoogleDrive] Iniciando upload...', fileName)
    const folderId = env.get('GOOGLE_DRIVE_FOLDER_ID')

    // Criar arquivo temporário
    const tmpDir = path.join(process.cwd(), 'tmp')
    const tmpFilePath = path.join(tmpDir, fileName)

    try {
      // Garantir que o diretório tmp existe
      console.log('[GoogleDrive] Criando diretório temporário...')
      await fs.mkdir(tmpDir, { recursive: true })

      // Escrever JSON no arquivo temporário
      console.log('[GoogleDrive] Escrevendo arquivo temporário...')
      await fs.writeFile(tmpFilePath, JSON.stringify(quizData, null, 2), 'utf-8')

      // Verificar se arquivo já existe no Drive
      console.log('[GoogleDrive] Verificando arquivos existentes...')
      const query = folderId
        ? `name='${fileName}' and '${folderId}' in parents and trashed=false`
        : `name='${fileName}' and trashed=false`

      const existingFiles = await this.drive.files.list({
        q: query,
        fields: 'files(id, name)',
      })

      let fileId: string

      if (existingFiles.data.files && existingFiles.data.files.length > 0) {
        // Atualizar arquivo existente
        fileId = existingFiles.data.files[0].id!
        console.log('[GoogleDrive] Atualizando arquivo existente:', fileId)
        
        await this.drive.files.update({
          fileId,
          media: {
            mimeType: 'application/json',
            body: createReadStream(tmpFilePath),
          },
        })
      } else {
        // Criar novo arquivo
        console.log('[GoogleDrive] Criando novo arquivo...')
        const fileMetadata: any = {
          name: fileName,
        }

        if (folderId) {
          fileMetadata.parents = [folderId]
        }

        const media = {
          mimeType: 'application/json',
          body: createReadStream(tmpFilePath),
        }

        const file: any = await this.drive.files.create({
          requestBody: fileMetadata,
          media: media,
          fields: 'id, webViewLink',
        })

        fileId = file.data.id!
        console.log('[GoogleDrive] Arquivo criado:', fileId)
      }

      // Remover arquivo temporário
      await fs.unlink(tmpFilePath)

      return `https://drive.google.com/file/d/${fileId}/view`
    } catch (error) {
      console.error('Erro ao fazer upload para Google Drive:', error)

      // Tentar limpar arquivo temporário em caso de erro
      try {
        await fs.unlink(tmpFilePath)
      } catch {}

      throw new Error(`Falha no upload para Google Drive: ${error.message}`)
    }
  }
}
