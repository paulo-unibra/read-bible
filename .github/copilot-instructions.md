# Copilot Instructions for ReadBible Project

## Project Structure
- React Native/Expo mobile app (main app)
- AdonisJS API (backend in `/api` folder)
- React Admin Panel (frontend in `/admin` folder) - **NEW**

## Completed Steps
- [x] Create copilot-instructions.md file
- [x] Scaffold AdonisJS API in monorepo structure
- [x] Setup DeepSeek integration and quiz generation endpoint
- [x] Setup Google Drive upload functionality
- [x] Install dependencies and compile project
- [x] Create README and test files
- [x] Implement Harpa Cristã feature (640 hymns lazy loading)
- [x] Add AdMob banners to hymn viewer and audio player
- [x] Create admin panel with role-based authentication
- [x] Setup roles and permissions system
- [x] Create login and dashboard pages
- [x] Implement protected routes by permission

## API Summary

### Quiz Generation

**Endpoint:** POST /generate-quiz

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

### Admin Authentication

**Endpoint:** POST /admin/login

**Request:**
```json
{
  "email": "admin@readbible.com",
  "password": "Admin@123"
}
```

**Requirements:**
- User must have role with `acessar_painel_administrativo` permission

**Response:**
```json
{
  "token": "oat_...",
  "user": {
    "id": 1,
    "email": "admin@readbible.com",
    "fullName": "Administrador Sistema",
    "roles": [...],
    "permissions": [...]
  }
}
```

**Other Admin Endpoints:**
- GET /admin/me (requires auth)
- POST /admin/logout (requires auth)

## Running the Project

### Backend API
```bash
cd api
node ace migration:run    # First time only
node ace db:seed          # First time only
node ace create:admin     # Create test admin user
npm run dev
```

### Admin Panel
```bash
cd admin
npm install               # First time only
npm run dev
```

**Admin Credentials:**
- Email: `admin@readbible.com`
- Password: `Admin@123`

## Admin Panel Details

### Roles & Permissions

- **Administrador** (Administrator): Full access
  - acessar_painel_administrativo
  - gerenciar_usuarios
  - gerenciar_conteudo
  - gerenciar_questionarios
  - visualizar_relatorios
  - gerenciar_roles
  - configurar_sistema

- **Editor**: Limited access
  - acessar_painel_administrativo
  - gerenciar_conteudo
  - gerenciar_questionarios
  - visualizar_relatorios

- **Usuário** (User): No admin access (mobile app only)

### Tech Stack
- React 18 + TypeScript
- Vite for build
- React Router for routing
- Axios for HTTP requests
- Context API for state management

### Files Structure
```
admin/
├── src/
│   ├── components/ProtectedRoute.tsx
│   ├── contexts/AuthContext.tsx
│   ├── pages/Login.tsx, Dashboard.tsx
│   ├── services/api.ts, authService.ts
│   └── App.tsx
└── .env (VITE_API_URL=http://localhost:3333)
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

