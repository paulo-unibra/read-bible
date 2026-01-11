# Sistema de Sincronização de Áudios de Hinos

## 📋 Visão Geral

Implementado um sistema completo para gerenciar a sincronização de áudios dos hinos da Harpa Cristã, permitindo ajustar offsets de tempo para que múltiplas faixas toquem perfeitamente sincronizadas.

## 🏗️ Arquitetura

### Backend (API)

#### 1. **Banco de Dados**
Migration: `1768146968734_create_hymn_audio_syncs_table.ts`

Tabela `hymn_audio_syncs`:
- `hymn_number`: Número do hino (1-640)
- `instrument`: Nome do instrumento/faixa (voz, teclado, etc.)
- `file_id`: ID do arquivo no Google Drive
- `file_name`: Nome do arquivo
- `offset_ms`: Offset de sincronização em milissegundos
  - **Positivo**: Atrasa o início da faixa
  - **Negativo**: Adianta (começa mais à frente)
- `duration_ms`: Duração do áudio
- `default_volume`: Volume padrão (0.0 a 1.0)
- `default_muted`: Se deve iniciar mutado
- `display_order`: Ordem de exibição no mixer
- `is_active`: Status ativo/inativo
- `notes`: Notas sobre a sincronização
- `updated_by`: Usuário que fez a última atualização

#### 2. **Modelo**
`HymnAudioSync` - Modelo Lucid com relacionamento com User

#### 3. **Controller**
`HymnAudiosController` com endpoints:

**Públicos (App Mobile):**
- `GET /hymn-audios/:hymnNumber` - Buscar áudios sincronizados

**Admin:**
- `GET /admin/hymn-audios/search/:hymnNumber` - Buscar áudios no Drive
- `POST /admin/hymn-audios` - Criar/atualizar sincronização
- `PATCH /admin/hymn-audios/:id/offset` - Atualizar apenas offset
- `DELETE /admin/hymn-audios/:id` - Deletar sincronização
- `GET /admin/hymn-audios/list` - Listar hinos com áudio

#### 4. **Serviço**
`searchHymnAudiosInDrive()` - Busca áudios no Google Drive

### Mobile App

#### 1. **HymnAudioService**
Atualizado para:
- Buscar dados de sincronização do backend primeiro
- Fallback para busca direta no Google Drive
- Aplicar offset ao tocar áudios:
  - Offset positivo: usa `setTimeout()` para atrasar
  - Offset negativo: usa `setPositionAsync()` para adiantar

#### 2. **Interface Atualizada**
- `HymnAudioTrack` agora inclui `offsetMs` e `displayOrder`
- Player aplica automaticamente os offsets ao tocar

### Painel Admin

#### 1. **Páginas Criadas**

**HymnAudioList** (`/admin/hymn-audios`):
- Lista hinos com áudio configurado
- Campo de busca para acessar qualquer hino
- Estatísticas de hinos com/sem áudio

**HymnAudioManager** (`/admin/hymn-audios/:hymnNumber`):
- Player web com todas as faixas sincronizadas
- Controles individuais por faixa:
  - Volume
  - Offset (botões ±10ms, ±100ms, reset, input manual)
- Visualização em tempo real
- Salva automaticamente no backend

#### 2. **Serviço**
`hymnAudioService.ts` - Cliente HTTP para API de sincronização

## 🎵 Como Usar

### 1. Preparar Áudios
Upload no Google Drive na pasta configurada:
- Formato: `hino-[numero]-[instrumento].mp3`
- Exemplo: `hino-83-voz.mp3`, `hino-83-teclado.mp3`

### 2. Sincronizar no Admin
1. Acesse `/admin/hymn-audios`
2. Digite o número do hino
3. O sistema busca automaticamente os áudios no Drive
4. Use o player para testar a sincronização
5. Ajuste os offsets com os botões:
   - **-10ms / -100ms**: Adianta a faixa
   - **+10ms / +100ms**: Atrasa a faixa
   - **Reset**: Volta para 0ms
6. As mudanças são salvas automaticamente

### 3. Testar no App
1. Abra o hino no app mobile
2. Os áudios serão carregados com sincronização do backend
3. Player aplica automaticamente os offsets

## 🔧 Configuração

### Backend (.env)
```env
GOOGLE_API_KEY=sua_chave_aqui
GOOGLE_DRIVE_CLIENT_ID=...
GOOGLE_DRIVE_CLIENT_SECRET=...
GOOGLE_DRIVE_REFRESH_TOKEN=...
```

### Mobile (.env)
```env
EXPO_PUBLIC_API_URL=http://seu-servidor:3333
EXPO_PUBLIC_GOOGLE_API_KEY=sua_chave_aqui
```

## 📊 Endpoints Criados

```
# Público (App)
GET  /hymn-audios/:hymnNumber

# Admin
GET    /admin/hymn-audios/list
GET    /admin/hymn-audios/search/:hymnNumber
POST   /admin/hymn-audios
PATCH  /admin/hymn-audios/:id/offset
DELETE /admin/hymn-audios/:id
```

## 🎯 Funcionalidades

### Backend
- ✅ Armazenar configurações de sincronização
- ✅ Buscar áudios no Google Drive
- ✅ CRUD completo de sincronizações
- ✅ Auditoria de alterações

### Admin
- ✅ Player web multi-faixa
- ✅ Ajuste visual de offsets
- ✅ Controle de volume por faixa
- ✅ Salvamento automático
- ✅ Lista de hinos com áudio

### Mobile
- ✅ Buscar sincronização do backend
- ✅ Aplicar offsets automaticamente
- ✅ Fallback para busca direta
- ✅ Player multi-faixa sincronizado

## 🚀 Próximos Passos

1. Adicionar link no menu do admin para "Áudios de Hinos"
2. Adicionar notas/comentários sobre cada sincronização
3. Histórico de alterações de offsets
4. Preview visual de ondas de áudio
5. Detectar BPM e sugerir sincronização automática
6. Exportar/importar configurações

## 📝 Observações Técnicas

- **Offset positivo**: Usa `setTimeout()` no mobile e atrasa o `audio.play()` no admin
- **Offset negativo**: Usa `setPositionAsync()` no mobile e `audio.currentTime` no admin
- **Precisão**: Milissegundos (ms) - ajustes finos com botões de ±10ms
- **Sincronização**: Backend → Mobile (sempre atualizado)
- **Performance**: Áudios pré-carregados antes de tocar
