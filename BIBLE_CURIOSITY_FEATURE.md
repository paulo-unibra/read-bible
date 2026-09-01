# Feature: Curiosidades Bíblicas Diárias

## Visão Geral

Sistema completo de curiosidades bíblicas geradas por IA (DeepSeek) que exibe uma curiosidade diária na tela inicial do app, com funcionalidade de favoritar e compartilhar.

## Arquitetura

### Backend (API)

#### Database
- **Migration**: `database/migrations/1766381808369_create_bible_curiosities_table.ts`
  - Tabela `bible_curiosities`: id, content, theme, date, is_active
  - Tabela `bible_curiosity_favorites`: user_id, curiosity_id (pivot)

#### Models
- **BibleCuriosity** (`app/models/bible_curiosity.ts`)
  - Relação ManyToMany com User através de `favoritedBy`
  
- **User** (`app/models/user.ts`)
  - Relação ManyToMany com BibleCuriosity através de `favoriteCuriosities`

#### Controller
- **BibleCuriositiesController** (`app/controllers/bible_curiosities_controller.ts`)
  - `generate()`: POST /curiosities/generate - Gera nova curiosidade via DeepSeek API
  - `getToday()`: GET /curiosities/today - Retorna curiosidade do dia (com status de favorito se autenticado)
  - `toggleFavorite()`: POST /curiosities/:id/favorite - Adiciona/remove dos favoritos
  - `getFavorites()`: GET /curiosities/favorites - Lista favoritos do usuário

#### Routes
```typescript
router.post('/curiosities/generate', [BibleCuriositiesController, 'generate'])
router.get('/curiosities/today', [BibleCuriositiesController, 'getToday']).use([middleware.auth({ guards: ['api'] }), middleware.optional()])
router.post('/curiosities/:id/favorite', [BibleCuriositiesController, 'toggleFavorite']).use(middleware.auth({ guards: ['api'] }))
router.get('/curiosities/favorites', [BibleCuriositiesController, 'getFavorites']).use(middleware.auth({ guards: ['api'] }))
```

### Frontend (App)

#### Service
- **BibleCuriosityService** (`services/BibleCuriosityService.ts`)
  - `getTodayCuriosity()`: Busca curiosidade do dia
  - `toggleFavorite(id)`: Toggle favorito
  - `getFavorites()`: Lista favoritos

#### Component
- **BibleCuriosityCard** (`components/BibleCuriosityCard.tsx`)
  - Design: Card com gradiente roxo/azul
  - Funcionalidades: Share via Share API, botão de favorito com coração
  - Props: curiosity, onFavoriteChange

#### Integration
- **Home Screen** (`app/index.tsx`)
  - State: `curiosity` (BibleCuriosity | null)
  - Load: `loadCuriosity()` chamado em `initializeApp()`
  - Render: Card exibido entre AdBanner e Plano de Leitura

## Configuração

### 1. Obter API Key do DeepSeek

```bash
# 1. Acesse: https://platform.deepseek.com/
# 2. Crie uma conta ou faça login
# 3. Vá em API Keys
# 4. Crie uma nova chave
# 5. Copie a chave gerada
```

### 2. Configurar Variável de Ambiente

Adicione ao arquivo `api/.env`:

```env
DEEPSEEK_API_KEY=sua-chave-deepseek
```

### 3. Executar Migration (já executada)

```bash
cd api
node ace migration:run
```

## Como Testar

### 1. Iniciar a API

```bash
cd api
npm run dev
```

### 2. Gerar a Primeira Curiosidade

```bash
# POST request para gerar curiosidade
curl -X POST http://localhost:3333/curiosities/generate \
  -H "Content-Type: application/json"
```

**Resposta esperada:**
```json
{
  "success": true,
  "curiosity": {
    "id": 1,
    "content": "Você sabia que o Salmo 117 é o capítulo mais curto da Bíblia, com apenas 2 versículos?",
    "theme": "Salmos",
    "date": "2025-01-21",
    "is_active": true,
    "created_at": "...",
    "updated_at": "..."
  }
}
```

### 3. Testar no App

```bash
# Em outro terminal, iniciar o app
npm start
```

No app:
1. Abra a tela inicial (home)
2. Você verá o card da curiosidade entre o banner de anúncio e o plano de leitura
3. O card tem:
   - Gradiente roxo/azul de fundo
   - Texto da curiosidade
   - Botão de compartilhar (ícone share)
   - Botão de favoritar (coração - apenas se autenticado)

### 4. Testar Favoritos (requer autenticação)

```bash
# 1. Faça login no app
# 2. Clique no coração no card da curiosidade
# 3. Verificar se o coração fica preenchido

# Via API:
curl -X POST http://localhost:3333/curiosities/1/favorite \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"

# Listar favoritos:
curl -X GET http://localhost:3333/curiosities/favorites \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"
```

### 5. Testar Compartilhamento

1. No app, clique no ícone de compartilhar
2. Deve abrir o menu nativo de compartilhamento do sistema
3. Texto compartilhado: "Curiosidade Bíblica: [conteúdo da curiosidade]"

## Fluxo de Uso

### Fluxo Diário Automatizado (Recomendado)

Para gerar automaticamente uma curiosidade por dia, configure um cron job ou agendador:

```bash
# Exemplo usando cron (Linux/Mac)
# Adicione ao crontab para executar todo dia às 6h:
0 6 * * * curl -X POST http://localhost:3333/curiosities/generate

# Ou via AdonisJS Scheduler (se configurado)
```

### Fluxo Manual

1. Administrador chama POST /curiosities/generate quando quiser
2. API gera curiosidade via DeepSeek
3. Salva no banco com date = hoje, is_active = true
4. Desativa curiosidades antigas (is_active = false)
5. App exibe automaticamente a curiosidade ativa do dia

## Exemplo de Prompt DeepSeek

O sistema envia este prompt para a IA:

```
Você é um especialista em Bíblia. Gere uma curiosidade bíblica interessante, educativa e envolvente. 
A curiosidade deve ser curta (máximo 2-3 frases) e acessível para todos os públicos. 
Forneça apenas o texto da curiosidade, sem introduções ou formatações extras.
Exemplos de temas: personagens bíblicos, eventos históricos, simbolismos, curiosidades sobre versículos, etc.
```

## Estrutura de Dados

### BibleCuriosity
```typescript
{
  id: number
  content: string         // Texto da curiosidade
  theme: string          // Tema/categoria
  date: string           // Data no formato YYYY-MM-DD
  is_active: boolean     // Se é a curiosidade ativa
  created_at: DateTime
  updated_at: DateTime
  isFavorited?: boolean  // Apenas no frontend
}
```

## Possíveis Melhorias Futuras

1. **Tela de Favoritos**: Criar uma tela dedicada para listar todas as curiosidades favoritadas
2. **Categorias**: Adicionar filtros por tema/categoria
3. **Histórico**: Exibir curiosidades passadas
4. **Notificações**: Enviar push notification quando nova curiosidade for gerada
5. **Offline**: Cache de curiosidades para modo offline
6. **Personalização**: Permitir usuário escolher temas de interesse
7. **Estatísticas**: Mostrar quantas curiosidades o usuário já leu/favoritou
8. **Múltiplos Idiomas**: Gerar curiosidades em outros idiomas

## Troubleshooting

### Curiosidade não aparece no app
- Verifique se a API está rodando
- Verifique se existe uma curiosidade no banco: `select * from bible_curiosities where is_active = true`
- Verifique logs do console no app
- Teste o endpoint diretamente: `curl http://localhost:3333/curiosities/today`

### Erro ao gerar curiosidade
- Verifique se DEEPSEEK_API_KEY está configurado corretamente
- Verifique créditos da API no dashboard do DeepSeek
- Verifique logs da API para mensagens de erro

### Botão de favorito não funciona
- Certifique-se de estar autenticado no app
- Verifique se o token de autenticação está válido
- Teste o endpoint de toggle manualmente com curl

## Status

✅ Backend completo (migration, models, controller, routes)
✅ Database migration executada com sucesso
✅ Frontend service criado
✅ Componente de UI criado com gradiente
✅ Integração na home screen completa
✅ expo-linear-gradient instalado

⏳ Pendente: Configurar DEEPSEEK_API_KEY
⏳ Pendente: Gerar primeira curiosidade
⏳ Pendente: Testes end-to-end

## Comandos Úteis

```bash
# Gerar curiosidade
curl -X POST http://localhost:3333/curiosities/generate

# Ver curiosidade do dia
curl http://localhost:3333/curiosities/today

# Ver todas as curiosidades (banco)
# No PostgreSQL:
SELECT * FROM bible_curiosities ORDER BY created_at DESC;

# Limpar curiosidades antigas (manter apenas últimas 30)
# Via API ou script personalizado
```
