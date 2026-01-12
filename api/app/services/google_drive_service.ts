import env from '#start/env'
import { google } from 'googleapis'
import { createReadStream } from 'node:fs'
import fs from 'node:fs/promises'
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

/**
 * Busca áudios de um hino específico no Google Drive
 */
export async function searchHymnAudiosInDrive(hymnNumber: number) {
  const AUDIO_FOLDER_ID = '1kpVk7VeWDts852XfWk9fZRIgjwa8OYoN'
  const API_KEY = env.get('GOOGLE_API_KEY')

  if (!API_KEY) {
    throw new Error('GOOGLE_API_KEY não configurada no .env')
  }

  const fileName = `hino-${hymnNumber}-`

  const listUrl = `https://www.googleapis.com/drive/v3/files?q='${AUDIO_FOLDER_ID}'+in+parents+and+name+contains+'${fileName}'&key=${API_KEY}&fields=files(id,name,size,mimeType,webContentLink)`

  const response = await fetch(listUrl)

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`Erro HTTP ${response.status} ao buscar áudios:`, errorText)
    throw new Error(`Erro ao buscar áudios no Drive: ${response.status}`)
  }

  const data = await response.json()

  if (data.error) {
    console.error('Erro API Drive:', data.error)
    throw new Error(`Erro API Drive: ${data.error.message}`)
  }

  if (!data.files || data.files.length === 0) {
    return []
  }

  // Filtrar arquivos .mp3 que correspondem ao padrão hino-[numero]-[instrumento].mp3
  const audios = data.files
    .filter((f: any) => {
      const match = f.name.match(new RegExp(`^hino-${hymnNumber}-(.*)\\.mp3$`, 'i'))
      return match !== null
    })
    .map((f: any) => {
      const match = f.name.match(new RegExp(`^hino-${hymnNumber}-(.*)\\.mp3$`, 'i'))
      const instrument = match![1]

      return {
        fileId: f.id,
        fileName: f.name,
        instrument,
        size: f.size ? parseInt(f.size) : null,
        mimeType: f.mimeType,
        downloadUrl: `https://www.googleapis.com/drive/v3/files/${f.id}?alt=media&key=${API_KEY}`,
      }
    })

  console.log(`[GoogleDrive] Encontrados ${audios.length} áudios para hino ${hymnNumber}:`, audios.map((a: any) => a.instrument))

  return audios
}

/**
 * Lista todos os números de hinos que têm áudios no Google Drive
 */
export async function listAllHymnsWithAudioInDrive(): Promise<number[]> {
  const AUDIO_FOLDER_ID = '1kpVk7VeWDts852XfWk9fZRIgjwa8OYoN'
  const API_KEY = env.get('GOOGLE_API_KEY')

  if (!API_KEY) {
    throw new Error('GOOGLE_API_KEY não configurada no .env')
  }

  // Buscar todos os arquivos MP3 na pasta de áudios
  const listUrl = `https://www.googleapis.com/drive/v3/files?q='${AUDIO_FOLDER_ID}'+in+parents+and+mimeType='audio/mpeg'&key=${API_KEY}&fields=files(name)&pageSize=1000`

  const response = await fetch(listUrl)

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`Erro HTTP ${response.status} ao listar hinos:`, errorText)
    throw new Error(`Erro ao listar hinos no Drive: ${response.status}`)
  }

  const data = await response.json()

  if (data.error) {
    console.error('Erro API Drive:', data.error)
    throw new Error(`Erro API Drive: ${data.error.message}`)
  }

  if (!data.files || data.files.length === 0) {
    return []
  }

  // Extrair números únicos dos nomes dos arquivos (padrão: hino-123-instrumento.mp3)
  const hymnNumbers = new Set<number>()
  
  for (const file of data.files) {
    const match = file.name.match(/^hino-(\d+)-.*\.mp3$/i)
    if (match) {
      hymnNumbers.add(parseInt(match[1]))
    }
  }

  const sortedNumbers = Array.from(hymnNumbers).sort((a, b) => a - b)
  
  console.log(`[GoogleDrive] Encontrados ${sortedNumbers.length} hinos com áudios no Drive`)

  return sortedNumbers
}
