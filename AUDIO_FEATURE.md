# 🎵 Funcionalidade de Áudio Bíblico

Esta funcionalidade permite aos usuários reproduzir o áudio dos capítulos bíblicos diretamente no aplicativo ReadBible.

## 📋 Como Funciona

### 🔗 Integração com Google Drive
- Os arquivos de áudio estão armazenados no Google Drive (ID da pasta: `1oqKoOzUu1Ae6sFYlb6QI-wMN4aHjKYjw`)
- O aplicativo acessa os arquivos através da API do Google Drive
- Os arquivos seguem o padrão de nomenclatura: `{nome-do-livro}-{numero-do-capitulo}.mp3`
- Exemplo: `apocalipse-7.mp3` para Apocalipse capítulo 7

### 🎛️ Interface do Usuário
- **Botão de Áudio**: Aparece no cabeçalho de cada capítulo ao lado do botão de configurações
- **Estados Visuais**:
  - 🎧 Ícone de fone (áudio disponível, não reproduzindo)
  - 🔊 Ícone de volume (áudio reproduzindo)
  - ⏳ Indicador de carregamento
- **Modal de Controle**: Interface completa de reprodução com barra de progresso e controles

### 🎵 Controles de Áudio
- **Play/Pause**: Reproduzir ou pausar o áudio
- **Voltar 10s**: Retroceder 10 segundos
- **Avançar 10s**: Avançar 10 segundos
- **Barra de Progresso**: Navegar para qualquer posição do áudio
- **Indicador de Tempo**: Mostra tempo atual e duração total
- **Parar**: Para completamente o áudio

## 🏗️ Arquitetura Técnica

### 📁 Arquivos Criados/Modificados

#### `services/AudioService.ts`
- Serviço singleton para gerenciar reprodução de áudio
- Conecta com API do Google Drive
- Gerencia estado do player (isPlaying, currentTime, etc.)
- Mapeia IDs de livros para nomes de arquivos
- Fornece sistema de listeners para atualizações de estado

#### `components/AudioPlayer.tsx`
- Componente React que renderiza o botão de áudio
- Modal com interface completa de controle
- Integra com AudioService para controle de reprodução
- Suporte a modo escuro/claro

#### `app/chapter-reader.tsx` (modificado)
- Adiciona o componente AudioPlayer no cabeçalho do capítulo
- Cleanup automático do áudio quando sair da tela
- Estilo responsivo para acomodar o novo botão

### 🗺️ Mapeamento de Livros
O serviço mapeia os IDs numéricos dos livros bíblicos para os nomes dos arquivos:

```typescript
// Exemplos do mapeamento:
1: 'genesis',      // genesis-1.mp3, genesis-2.mp3, etc.
40: 'mateus',      // mateus-1.mp3, mateus-2.mp3, etc.
66: 'apocalipse',  // apocalipse-1.mp3, apocalipse-7.mp3, etc.
```

### 🔧 Dependências Adicionadas
- `expo-av`: Para reprodução de áudio
- `@react-native-community/slider`: Para barra de progresso

## 🚀 Como Usar

1. **Acesse um capítulo**: Navegue para qualquer capítulo da bíblia
2. **Localize o botão**: Encontre o ícone de fone 🎧 no cabeçalho do capítulo
3. **Toque para reproduzir**: O áudio começará automaticamente
4. **Controle a reprodução**: Use o modal que aparece para controlar o áudio
5. **Navegação**: Pode navegar entre capítulos enquanto o áudio toca

## ⚠️ Tratamento de Erros

- **Áudio não encontrado**: Mensagem clara informando que o áudio não está disponível
- **Erro de conexão**: Alerta sobre problemas de conectividade
- **Falha no carregamento**: Feedback visual e mensagens de erro amigáveis

## 🎨 Experiência do Usuário

### 🌙 Modo Escuro/Claro
- Interface adapta automaticamente ao tema escolhido
- Cores consistentes com o design system do app

### 📱 Responsividade
- Funciona em diferentes tamanhos de tela
- Controles otimizados para toque

### 🔄 Estados de Loading
- Indicadores visuais durante carregamento
- Botões desabilitados durante operações assíncronas

## 🔮 Possíveis Melhorias Futuras

1. **Cache Local**: Baixar e armazenar áudios localmente
2. **Velocidade de Reprodução**: Controle de velocidade (0.5x, 1x, 1.5x, 2x)
3. **Download Offline**: Permitir download para uso offline
4. **Playlist**: Reprodução contínua de múltiplos capítulos
5. **Controles de Mídia**: Integração com controles nativos do sistema
6. **Background Play**: Reprodução em segundo plano
7. **Bookmarks de Áudio**: Marcar posições específicas no áudio

## 🐛 Resolução de Problemas

### Áudio não carrega
- Verificar conexão com internet
- Confirmar se o arquivo existe no Google Drive
- Verificar se o nome do arquivo segue o padrão correto

### Interface não responde
- Aguardar carregamento completo do áudio
- Verificar se não há múltiplas instâncias do player rodando

### Qualidade do áudio
- Depende da qualidade dos arquivos no Google Drive
- Conexão de internet afeta a velocidade de carregamento