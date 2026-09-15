import env from '#start/env'
import { Readable } from 'node:stream'
import type { HttpContext } from '@adonisjs/core/http'

const DRIVE_API = 'https://www.googleapis.com/drive/v3'

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

async function streamDriveFile(fileId: string, response: HttpContext['response']) {
  const params = new URLSearchParams({ alt: 'media', key: googleApiKey() })
  const fileResponse = await fetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?${params}`)

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
  async listBibles({ request, response }: HttpContext) {
    try {
      const folder = folderId('GOOGLE_BIBLE_DRIVE_FOLDER_ID')
      const data = await driveList(
        `'${folder}' in parents and trashed=false`,
        'files(id,name,webContentLink,size,modifiedTime)'
      )

      const baseUrl = `${request.protocol()}://${request.host()}`
      const files = (data.files || [])
        .filter((file) => file.name?.endsWith('.db'))
        .map((file) => ({
          id: file.id,
          name: file.name,
          webContentLink: `${baseUrl}/drive/bibles/${file.id}/download`,
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
    return streamDriveFile(params.fileId, response)
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

      return streamDriveFile(file.id, response)
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
    return streamDriveFile(params.fileId, response)
  }
}
