# API - Bíblia em Foco

API REST desenvolvida com AdonisJS 6 para geração automática de questionários bíblicos usando DeepSeek AI e upload para Google Drive.

## 🚀 Funcionalidades

- **Geração de Quiz**: Endpoint que recebe texto bíblico e gera automaticamente questionário com 10 perguntas
- **Integração DeepSeek**: Utiliza DeepSeek API para criar perguntas contextualizadas
- **Upload Google Drive**: Armazena automaticamente os quizzes em pasta específica do Google Drive
- **Nomenclatura Padronizada**: Arquivos salvos como `nome-do-livro-[capitulo].json`

## 📋 Pré-requisitos

- Node.js 20 ou superior
- npm ou yarn
- Conta DeepSeek API
- Credenciais Google Drive Service Account

## 🔧 Instalação

```bash
cd api/api/api
npm install
```

## ⚙️ Configuração

1. Copie o arquivo `.env.example` para `.env`:

```bash
cp .env.example .env
```

2. Configure as variáveis de ambiente no arquivo `.env`:

```env
# DeepSeek API
DEEPSEEK_API_KEY=sk-your-deepseek-api-key

# Google Drive
GOOGLE_DRIVE_FOLDER_ID=12CZeaVlNKMfO3gT5PpOFdVgvY7fEQ0Yq
GOOGLE_DRIVE_CREDENTIALS={"type":"service_account",...}
```

### Obtendo Credenciais do Google Drive

1. Acesse [Google Cloud Console](https://console.cloud.google.com/)
2. Crie um novo projeto ou selecione um existente
3. Ative a API do Google Drive
4. Crie uma Service Account
5. Baixe o arquivo JSON de credenciais
6. Copie todo o conteúdo JSON para `GOOGLE_DRIVE_CREDENTIALS`
7. Compartilhe a pasta do Drive com o email da Service Account

### Obtendo API Key do DeepSeek

1. Acesse [DeepSeek Platform](https://platform.deepseek.com/)
2. Crie uma conta ou faça login
3. Navegue até API Keys
4. Gere uma nova API Key
5. Copie a key para `DEEPSEEK_API_KEY`

## 🏃 Executando

```bash
npm run dev
```

A API estará disponível em `http://localhost:3333`

## 📡 Endpoints

### POST /generate-quiz

Gera um questionário bíblico e faz upload para Google Drive.

**Body:**
```json
{
  "bibleText": "Texto completo do capítulo bíblico aqui...",
  "bookName": "Salmos",
  "chapter": "1"
}
```

**Response:**
```json
{
  "success": true,
  "quiz": {
    "name": "Salmos 1",
    "category": "Bíblia - Antigo Testamento",
    "questions": [
      {
        "id": "1",
        "pergunta": "Qual é a bem-aventurança descrita no primeiro versículo?",
        "alternativas": [
          "Andar segundo o conselho dos ímpios",
          "Não andar segundo o conselho dos ímpios",
          "Permanecer no caminho dos pecadores",
          "Assentar-se na roda dos escarnecedores"
        ],
        "respostaCorreta": "Não andar segundo o conselho dos ímpios"
      }
    ]
  },
  "driveUrl": "https://drive.google.com/file/d/FILE_ID/view"
}
```

## 🏗️ Estrutura do Projeto

```
api/api/api/
├── app/
│   ├── controllers/
│   │   └── quiz_controller.ts      # Controller principal
│   └── services/
│       ├── deep_seek_service.ts     # Integração DeepSeek
│       └── google_drive_service.ts  # Upload Google Drive
├── config/
├── start/
│   ├── env.ts                        # Variáveis de ambiente
│   └── routes.ts                     # Definição de rotas
└── tmp/                              # Arquivos temporários
```

## 🔒 Segurança

- Nunca commite o arquivo `.env` com credenciais reais
- Mantenha suas API keys privadas
- Use variáveis de ambiente em produção
- Rotacione credenciais periodicamente

## 📝 Formato do Quiz Gerado

```json
{
  "name": "Nome do Livro Capítulo",
  "category": "Bíblia - Antigo/Novo Testamento",
  "questions": [
    {
      "id": "1",
      "pergunta": "Pergunta aqui?",
      "alternativas": ["Opção 1", "Opção 2", "Opção 3", "Opção 4"],
      "respostaCorreta": "Opção correta"
    }
  ]
}
```

## 🛠️ Tecnologias

- **AdonisJS 6**: Framework Node.js
- **TypeScript**: Linguagem de programação
- **DeepSeek AI**: Geração de conteúdo
- **Google Drive API**: Armazenamento de arquivos
- **OpenAI SDK**: Cliente para DeepSeek API

## 📄 Licença

Este projeto faz parte do aplicativo Bíblia em Foco.
