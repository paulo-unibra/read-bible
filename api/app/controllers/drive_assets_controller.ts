import env from '#start/env'
import { Readable } from 'node:stream'
import type { HttpContext } from '@adonisjs/core/http'

const DRIVE_API = 'https://www.googleapis.com/drive/v3'
const MAX_PUBLIC_DRIVE_FILE_BYTES = 250 * 1024 * 1024

function googleApiKey() {
  const apiKey = env.get('GOOGLE_API_KEY')
  if (!apiKey) throw new Error('GOOGLE_API_KEY não configurada')
  return apiKey
}

function folderId(
  name:
    | 'GOOGLE_BIBLE_DRIVE_FOLDER_ID'
    | 'GOOGLE_AUDIO_DRIVE_FOLDER_ID'
    | 'GOOGLE_HARPA_DRIVE_FOLDER_ID'
) {
  const id = env.get(name)
  if (!id) throw new Error(`${name} não configurada`)
  return id
}

function escapeDriveQuery(value: string) {
  return value.replace(/'/g, "\\'")
}

async function driveList(q: string, fields: string) {
  const params = new URLSearchParams({ q, fields, key: googleApiKey() })
  const response = await fetch(`${DRIVE_API}/files?${params.toString()}`)
  if (!response.ok) throw new Error(`Drive API error: ${response.status}`)
  return (await response.json()) as { files?: any[] }
}

async function findPublicFileInFolder(fileId: string, folderName: Parameters<typeof folderId>[0]) {
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(fileId)) return null

  const folder = folderId(folderName)
  const params = new URLSearchParams({
    fields: 'id,name,mimeType,size,parents,trashed',
    key: googleApiKey(),
  })
  const result = await fetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?${params}`, {
    signal: AbortSignal.timeout(10_000),
  })
  if (result.status === 404) return null
  if (!result.ok) throw new Error(`Drive API error: ${result.status}`)

  const file = (await result.json()) as {
    id?: string
    name?: string
    mimeType?: string
    size?: string
    parents?: string[]
    trashed?: boolean
  }
  if (file.id !== fileId || file.trashed || !file.parents?.includes(folder)) return null
  return file
}

async function streamDriveFile(
  fileId: string,
  folderName: Parameters<typeof folderId>[0],
  response: HttpContext['response'],
  isAllowedFile: (name: string) => boolean
) {
  const file = await findPublicFileInFolder(fileId, folderName)
  if (!file || !isAllowedFile(String(file.name || ''))) {
    return response.notFound({ success: false, message: 'Arquivo não encontrado' })
  }

  const size = Number(file.size)
  if (!Number.isSafeInteger(size) || size < 0 || size > MAX_PUBLIC_DRIVE_FILE_BYTES) {
    return response
      .status(413)
      .send({ success: false, message: 'Arquivo indisponível para download' })
  }

  const params = new URLSearchParams({ alt: 'media', key: googleApiKey() })
  const fileResponse = await fetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?${params}`, {
    signal: AbortSignal.timeout(30_000),
  })

  if (!fileResponse.ok || !fileResponse.body) {
    return response.status(fileResponse.status).send({
      success: false,
      message: 'Erro ao baixar arquivo do Drive',
    })
  }

  const contentType = fileResponse.headers.get('content-type')
  const contentLength = fileResponse.headers.get('content-length')

  if (contentType) response.header('Content-Type', contentType)
  if (contentLength) response.header('Content-Length', contentLength)
  response.header('Cache-Control', 'public, max-age=86400')

  return response.stream(Readable.fromWeb(fileResponse.body as any))
}

export default class DriveAssetsController {
  async listBibles({ response }: HttpContext) {
    try {
      const folder = folderId('GOOGLE_BIBLE_DRIVE_FOLDER_ID')
      const data = await driveList(
        `'${folder}' in parents and trashed=false`,
        'files(id,name,webContentLink,size,modifiedTime)'
      )

      const files = (data.files || [])
        .filter((file) => file.name?.endsWith('.db'))
        .map((file) => ({
          id: file.id,
          name: file.name,
          webContentLink: `/drive/bibles/${encodeURIComponent(file.id)}/download`,
          size: file.size,
          modifiedTime: file.modifiedTime,
        }))

      return response.ok({ success: true, files })
    } catch (error) {
      console.error('[DriveAssetsController] Erro ao listar bíblias:', error)
      return response.internalServerError({
        success: false,
        message: 'Erro ao listar bíblias',
        error: error.message,
      })
    }
  }

  async downloadBible({ params, response }: HttpContext) {
    return streamDriveFile(
      String(params.fileId || ''),
      'GOOGLE_BIBLE_DRIVE_FOLDER_ID',
      response,
      (name) => name.toLowerCase().endsWith('.db')
    )
  }

  async audioMetadata({ params, response }: HttpContext) {
    try {
      const folder = folderId('GOOGLE_AUDIO_DRIVE_FOLDER_ID')
      const fileName = escapeDriveQuery(params.fileName)
      const data = await driveList(
        `'${folder}' in parents and name='${fileName}' and trashed=false`,
        'files(id,name,size,mimeType)'
      )
      const file = data.files?.[0]

      if (!file) {
        return response.notFound({ success: false, message: 'Áudio não encontrado' })
      }

      return response.ok({ success: true, file })
    } catch (error) {
      console.error('[DriveAssetsController] Erro ao buscar áudio:', error)
      return response.internalServerError({
        success: false,
        message: 'Erro ao buscar áudio',
        error: error.message,
      })
    }
  }

  async downloadAudio({ params, response }: HttpContext) {
    try {
      const folder = folderId('GOOGLE_AUDIO_DRIVE_FOLDER_ID')
      const fileName = escapeDriveQuery(params.fileName)
      const data = await driveList(
        `'${folder}' in parents and name='${fileName}' and trashed=false`,
        'files(id,name)'
      )
      const file = data.files?.[0]

      if (!file) {
        return response.notFound({ success: false, message: 'Áudio não encontrado' })
      }

      return streamDriveFile(file.id, 'GOOGLE_AUDIO_DRIVE_FOLDER_ID', response, (name) =>
        name.toLowerCase().endsWith('.mp3')
      )
    } catch (error) {
      console.error('[DriveAssetsController] Erro ao baixar áudio:', error)
      return response.internalServerError({
        success: false,
        message: 'Erro ao baixar áudio',
        error: error.message,
      })
    }
  }

  async harpaMetadata({ params, response }: HttpContext) {
    try {
      const folder = folderId('GOOGLE_HARPA_DRIVE_FOLDER_ID')
      const numberStr = String(params.hymnNumber).padStart(3, '0')
      const fileName = escapeDriveQuery(`HC ${numberStr}`)
      const data = await driveList(
        `'${folder}' in parents and name contains '${fileName}' and trashed=false`,
        'files(id,name)'
      )
      const file = (data.files || []).find(
        (item) =>
          item.name?.startsWith(`HC ${numberStr}`) && item.name.toLowerCase().endsWith('.xml')
      )

      if (!file) {
        return response.notFound({ success: false, message: 'Hino não encontrado' })
      }

      return response.ok({ success: true, file })
    } catch (error) {
      console.error('[DriveAssetsController] Erro ao buscar hino:', error)
      return response.internalServerError({
        success: false,
        message: 'Erro ao buscar hino',
        error: error.message,
      })
    }
  }

  async downloadHarpa({ params, response }: HttpContext) {
    return streamDriveFile(
      String(params.fileId || ''),
      'GOOGLE_HARPA_DRIVE_FOLDER_ID',
      response,
      (name) => name.startsWith('HC ') && name.toLowerCase().endsWith('.xml')
    )
  }
}
