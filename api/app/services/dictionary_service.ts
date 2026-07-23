import env from '#start/env'
import Database from 'better-sqlite3'
import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'

const DICTIONARIES_DIR = new URL('../../public/dictionaries/', import.meta.url)

interface DriveFile {
  id: string
  name: string
  webContentLink?: string
  size: string
}

interface DictionaryEntry {
  word: string
  definition: string
  transcription?: string
}

class DictionaryService {
  private db: Database.Database | null = null
  private tableName = 'dictionary'
  private wordColumn = 'word'
  private definitionColumn = 'definition'

  async listDriveFiles(): Promise<DriveFile[]> {
    const folderId = env.get('EXPO_PUBLIC_DICTIONARY_DRIVE_FOLDER_ID') || '1uOQqOPGnImUTApeyY94XJ7BCvIFBzG0H'
    const apiKey = env.get('GOOGLE_API_KEY') || env.get('EXPO_PUBLIC_GOOGLE_API_KEY')

    const url = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents&key=${apiKey}&fields=files(id,name,webContentLink,size)`
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Drive API error: ${response.status}`)
    const data = (await response.json()) as { files?: DriveFile[] }
    return data.files || []
  }

  async downloadLatest(): Promise<{ fileName: string; filePath: string }> {
    const files = await this.listDriveFiles()
    const dctFile = files.find((f) => f.name.endsWith('.mybible') || f.name.endsWith('.dct'))
    if (!dctFile) throw new Error('Nenhum arquivo de dicionário encontrado no Drive')

    if (!existsSync(DICTIONARIES_DIR.pathname)) {
      mkdirSync(DICTIONARIES_DIR.pathname, { recursive: true })
    }

    const filePath = `${DICTIONARIES_DIR.pathname}${dctFile.name}`

    const dlUrl = `https://drive.usercontent.google.com/download?id=${dctFile.id}&export=download`
    const response = await fetch(dlUrl)
    if (!response.ok) throw new Error(`Download failed: ${response.status}`)
    const buffer = Buffer.from(await response.arrayBuffer())
    await writeFile(filePath, buffer)

    this.loadDatabase(filePath)
    return { fileName: dctFile.name, filePath }
  }

  private loadDatabase(filePath: string) {
    if (this.db) {
      this.db.close()
      this.db = null
    }

    this.db = new Database(filePath, { readonly: true })

    const tables = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]
    const dictTable = tables.find((t) => ['dictionary', 'dict', 'entries', 'definitions'].includes(t.name.toLowerCase()))
    if (dictTable) {
      this.tableName = dictTable.name
      const cols = this.db.prepare(`PRAGMA table_info("${dictTable.name}")`).all() as { name: string }[]
      const colNames = cols.map((c) => c.name.toLowerCase())
      this.wordColumn = colNames.includes('word') ? 'word' : (colNames.includes('topic') ? 'topic' : cols[0].name)
      this.definitionColumn = colNames.includes('definition') ? 'definition' : (colNames.includes('meaning') ? 'meaning' : (colNames.includes('data') ? 'data' : (colNames.includes('content') ? 'content' : cols[1]?.name || cols[0].name)))
    }
  }

  ensureLoaded(): boolean {
    if (this.db) return true
    const dir = DICTIONARIES_DIR.pathname
    if (!existsSync(dir)) return false
    const files = readdirSync(dir).filter((f) => f.endsWith('.mybible') || f.endsWith('.dct') || f.endsWith('.db'))
    if (files.length === 0) return false
    this.loadDatabase(`${dir}${files[0]}`)
    return true
  }

  private excludeFilter(): string {
    return `"${this.wordColumn}" NOT LIKE 'Prefácio%' AND "${this.wordColumn}" NOT LIKE 'Sobre o Livro%' AND "${this.wordColumn}" NOT GLOB '[0-9].*'`
  }

  async search(query: string, page = 1, perPage = 50): Promise<{ entries: DictionaryEntry[]; total: number; page: number; perPage: number }> {
    if (!this.ensureLoaded()) {
      await this.downloadLatest()
    }
    if (!this.db) throw new Error('Dicionário não carregado')

    const offset = (page - 1) * perPage
    const like = `%${query.toUpperCase()}%`
    const where = `"${this.wordColumn}" LIKE ? AND ${this.excludeFilter()}`
    const countRow = this.db.prepare(`SELECT COUNT(*) as total FROM "${this.tableName}" WHERE ${where}`).get(like) as { total: number }
    const rows = this.db.prepare(`SELECT "${this.wordColumn}" as word, "${this.definitionColumn}" as definition FROM "${this.tableName}" WHERE ${where} ORDER BY "${this.wordColumn}" ASC LIMIT ? OFFSET ?`).all(like, perPage, offset) as DictionaryEntry[]

    return { entries: rows, total: countRow.total, page, perPage }
  }

  async getWord(word: string): Promise<DictionaryEntry | null> {
    if (!this.ensureLoaded()) {
      await this.downloadLatest()
    }
    if (!this.db) throw new Error('Dicionário não carregado')

    const row = this.db.prepare(`SELECT "${this.wordColumn}" as word, "${this.definitionColumn}" as definition FROM "${this.tableName}" WHERE "${this.wordColumn}" = ?`).get(word) as DictionaryEntry | undefined
    return row || null
  }

  async getAlphabetList(page = 1, perPage = 50): Promise<{ entries: DictionaryEntry[]; total: number; page: number; perPage: number }> {
    if (!this.ensureLoaded()) {
      await this.downloadLatest()
    }
    if (!this.db) throw new Error('Dicionário não carregado')

    const offset = (page - 1) * perPage
    const where = this.excludeFilter()
    const countRow = this.db.prepare(`SELECT COUNT(*) as total FROM "${this.tableName}" WHERE ${where}`).get() as { total: number }
    const rows = this.db.prepare(`SELECT "${this.wordColumn}" as word, "${this.definitionColumn}" as definition FROM "${this.tableName}" WHERE ${where} ORDER BY "${this.wordColumn}" ASC LIMIT ? OFFSET ?`).all(perPage, offset) as DictionaryEntry[]

    return { entries: rows, total: countRow.total, page, perPage }
  }

  async getTotalCount(): Promise<number> {
    if (!this.ensureLoaded() || !this.db) return 0
    const where = this.excludeFilter()
    const row = this.db.prepare(`SELECT COUNT(*) as total FROM "${this.tableName}" WHERE ${where}`).get() as { total: number }
    return row.total
  }
}

export default new DictionaryService()