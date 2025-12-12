# Copilot Instructions for ReadBible Project

## Project Structure
- React Native/Expo mobile app (main app)
- AdonisJS API (backend monorepo in `/api/api/api` folder)

## Completed Steps
- [x] Create copilot-instructions.md file
- [x] Scaffold AdonisJS API in monorepo structure
- [x] Setup DeepSeek integration and quiz generation endpoint
- [x] Setup Google Drive upload functionality
- [x] Install dependencies and compile project
- [x] Create README and test files

## API Summary

### Endpoint: POST /generate-quiz

**Request:**
```json
{
  "bibleText": "Texto do capítulo bíblico",
  "bookName": "Salmos",
  "chapter": "1"
}
```

**Process:**
1. Recebe texto bíblico do usuário
2. Envia para DeepSeek API com prompt estruturado
3. Gera 10 perguntas de múltipla escolha
4. Faz upload do JSON para Google Drive (folder ID: 12CZeaVlNKMfO3gT5PpOFdVgvY7fEQ0Yq)
5. Arquivo salvo como: `nome-do-livro-[capitulo].json`

**Response:**
```json
{
  "success": true,
  "quiz": { /* quiz data */ },
  "driveUrl": "https://drive.google.com/file/d/FILE_ID/view"
}
```

## Running the API

```bash
cd api/api/api
npm run dev
```

## Configuration Required

1. Copy `.env.example` to `.env`
2. Add `DEEPSEEK_API_KEY` (from https://platform.deepseek.com/)
3. Add `GOOGLE_DRIVE_CREDENTIALS` (Service Account JSON)
4. Share Drive folder with Service Account email

## Next Steps

- Configure environment variables with real credentials
- Test endpoint with sample Bible text
- Integrate with mobile app

