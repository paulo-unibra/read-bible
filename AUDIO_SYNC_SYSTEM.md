# Sistema de Sincronização de Áudio Bíblico

## Visão Geral

Implementado um sistema completo de sincronização manual de áudio bíblico com versículos. O sistema permite que administradores sincronizem manualmente cada versículo com seu timestamp no áudio, proporcionando uma experiência muito mais precisa do que o cálculo automático.

## Arquitetura

### 1. Backend (API - AdonisJS)

#### Tabela: `audio_sync_timestamps`

```sql
- id: integer (primary key)
- book_id: integer (ID do livro bíblico)
- chapter_number: integer (número do capítulo)
- verse_number: integer (número do versículo)
- timestamp_ms: integer (timestamp em milissegundos)
- created_at, updated_at: timestamps
```

**Índices:**

- Único: `[book_id, chapter_number, verse_number]`
- Busca: `[book_id, chapter_number]`

#### Endpoints

##### Admin (protegidos por autenticação):

- **POST `/admin/audio-sync`**
  - Salvar timestamps de um capítulo
  - Body: `{ bookId, chapterNumber, timestamps: [{ verseNumber, timestampMs }] }`
  - Usa transação para garantir atomicidade
  - Remove timestamps antigos antes de inserir novos

- **GET `/admin/audio-sync/list`**
  - Listar todos os capítulos sincronizados
  - Retorna: `[{ bookId, chapterNumber, totalVerses }]`

- **GET `/admin/audio-sync/:bookId/:chapterNumber`**
  - Buscar timestamps de um capítulo específico (também disponível publicamente para o app)

##### Público (para o app mobile):

- **GET `/audio-sync/:bookId/:chapterNumber`**
  - Retorna: `{ success: true, data: [{ verseNumber, timestampMs }] }`

### 2. Admin Panel (React + TypeScript)

#### Página: `/audio-sync`

**Funcionalidades:**

- Seleção de livro e capítulo
- Player de áudio HTML5 integrado
- Lista de versículos com botões de ação
- Indicador de progresso de sincronização
- Lista de capítulos já sincronizados

**Interface do Usuário:**

- **Painel de Controle** (esquerda):
  - Seletor de livro/capítulo
  - Player de áudio com seek bar
  - Progresso da sincronização
  - Botão de salvar
  - Instruções de uso

- **Painel de Versículos** (direita):
  - Lista scrollável de versículos
  - Cada versículo mostra:
    - Número do versículo
    - Texto (pode ser mock ou real da API)
    - Timestamp (se já sincronizado)
    - Botões de ação:
      - **Marcar**: grava timestamp atual
      - **Ir**: pula para o timestamp
      - **Limpar**: remove timestamp

- **Lista de Sincronizados** (rodapé):
  - Grid com todos os capítulos sincronizados
  - Clicável para editar

**Workflow de Sincronização:**

1. Usuário seleciona livro e capítulo
2. Reproduz o áudio
3. Ao ouvir cada versículo, clica em "Marcar"
4. O timestamp atual é gravado
5. Após completar todos, clica em "Salvar Sincronização"
6. Dados são enviados ao backend

**Estilos:**

- Design responsivo com grid layout
- Cores indicativas:
  - Versículo selecionado: amarelo
  - Versículo sincronizado: verde
  - Progresso: gradient verde

### 3. Mobile App (React Native + Expo)

#### AudioService Atualizado

**Novo comportamento:**

1. Quando um capítulo é carregado, busca timestamps do backend
2. Se timestamps existirem, usa-os para determinar versículo atual
3. Se não existirem, usa cálculo baseado em tempo (fallback)

**Método adicionado:**

```typescript
async fetchVerseTimestamps(bookId: number, chapterNumber: number)
```

**Lógica de detecção do versículo:**

```typescript
if (verseTimestamps.length > 0) {
  // Usa timestamps reais
  // Encontra o versículo baseado no timestamp mais próximo
} else {
  // Fallback: cálculo por divisão de tempo
}
```

#### ChapterReader Atualizado

**Efeito adicionado:**

```typescript
useEffect(() => {
  if (verses.length > 0 && currentChapter > 0) {
    AudioService.setTotalVerses(verses.length);
    AudioService.fetchVerseTimestamps(currentBookId, currentChapter);
  }
}, [verses, currentChapter, currentBookId]);
```

**Comportamento:**

- Busca timestamps automaticamente ao carregar capítulo
- Versículo atual é destacado com fundo amarelo e borda
- Auto-scroll para manter versículo visível
- Só destaca se houver sincronização manual ou usa fallback

## Fluxo Completo

```
1. Admin acessa /audio-sync no painel
2. Seleciona livro/capítulo
3. Reproduz áudio e marca cada versículo
4. Salva sincronização
5. Dados vão para o banco

6. Usuário abre capítulo no app
7. App busca timestamps do backend
8. Se existir: usa timestamps reais
9. Se não existir: usa cálculo automático
10. Versículo atual é destacado durante reprodução
```

## Melhorias vs Sistema Anterior

### Antes:

- ❌ Cálculo automático impreciso
- ❌ Versículos não sincronizavam corretamente
- ❌ Impossível ajustar manualmente

### Agora:

- ✅ Sincronização manual precisa
- ✅ Interface dedicada para sincronizar
- ✅ Timestamps persistidos no banco
- ✅ Fallback automático se não houver sincronização
- ✅ Lista de capítulos sincronizados
- ✅ Edição de sincronizações existentes

## Tecnologias Utilizadas

- **Backend**: AdonisJS 6, Lucid ORM, PostgreSQL
- **Admin**: React 18, TypeScript, React Router, HTML5 Audio API
- **Mobile**: React Native, Expo, Fetch API
- **Autenticação**: JWT (via middleware do AdonisJS)

## Próximos Passos Sugeridos

1. **Integração com Google Drive**
   - Buscar arquivos de áudio diretamente do Drive
   - Listar livros/capítulos disponíveis

2. **Importação de Versículos Reais**
   - Integrar com API da Bíblia
   - Substituir texto mock por versículos reais

3. **Validação e Preview**
   - Preview da sincronização antes de salvar
   - Validação de gaps nos timestamps

4. **Exportação/Importação**
   - Exportar sincronizações em JSON
   - Importar de arquivos externos

5. **Atalhos de Teclado**
   - Espaço: Play/Pause
   - Enter: Marcar versículo
   - Setas: Navegar versículos

6. **Visualização em Forma de Onda**
   - Biblioteca WaveSurfer.js
   - Visualização dos timestamps no áudio

## Arquivos Criados/Modificados

### Backend (API):

- ✅ `database/migrations/*_create_audio_sync_timestamps_table.ts`
- ✅ `app/models/audio_sync_timestamp.ts`
- ✅ `app/controllers/audio_sync_timestamps_controller.ts`
- ✅ `start/routes.ts` (rotas adicionadas)

### Admin Panel:

- ✅ `src/pages/AudioSync/AudioSync.tsx`
- ✅ `src/pages/AudioSync/AudioSync.css`
- ✅ `src/pages/AudioSync/index.ts`
- ✅ `src/App.tsx` (rota adicionada)
- ✅ `src/pages/Dashboard.tsx` (card adicionado)

### Mobile App:

- ✅ `services/AudioService.ts` (métodos e lógica atualizados)
- ✅ `app/chapter-reader.tsx` (busca de timestamps adicionada)

## Como Testar

1. **Rodar a migration**:

   ```bash
   cd api
   node ace migration:run
   ```

2. **Acessar o admin**:

   ```
   http://localhost:5173/admin/audio-sync
   ```

3. **Sincronizar um capítulo**:
   - Selecionar livro e capítulo
   - Reproduzir áudio (precisa configurar audioUrl correto)
   - Marcar cada versículo
   - Salvar

4. **Testar no app mobile**:
   - Abrir o mesmo capítulo
   - Reproduzir áudio
   - Verificar destaque do versículo
