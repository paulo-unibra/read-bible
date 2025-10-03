# 📚 Funcionalidade de Questionários Bíblicos

Esta funcionalidade permite aos usuários responderem questionários sobre os capítulos bíblicos diretamente no aplicativo ReadBible.

## 📋 Como Funciona

### 🔗 Integração com Google Drive
- Os arquivos JSON dos questionários estão armazenados no Google Drive (ID da pasta: `12CZeaVlNKMfO3gT5PpOFdVgvY7fEQ0Yq`)
- O aplicativo verifica automaticamente se existe questionário para cada capítulo
- Os arquivos seguem o padrão de nomenclatura: `{nome-do-livro}-{numero-do-capitulo}.json`
- Exemplo: `apocalipse-7.json` para Apocalipse capítulo 7

### 📝 Estrutura dos Questionários
```json
{
  "name": "Apocalipse 7",
  "category": "Bíblia - Novo Testamento",
  "questions": [
    {
      "id": "1",
      "pergunta": "Quantos anjos João viu sobre os quatro cantos da terra?",
      "alternativas": [
        "Quatro",
        "Sete", 
        "Doze",
        "Três"
      ],
      "respostaCorreta": "Quatro"
    }
  ]
}
```

### 🎛️ Interface do Usuário
- **Botão de Quiz**: Aparece no cabeçalho do capítulo (ícone ❓) quando há questionário disponível
- **Estados Visuais**:
  - ⏳ Carregando (verificando disponibilidade)
  - ❓ Questionário disponível
  - 🚫 Oculto (quando não há questionário)

### ⏱️ Sistema de Quiz
- **Timer**: 30 segundos por pergunta
- **Feedback Visual**: Respostas corretas em verde, incorretas em vermelho
- **Progresso**: Barra de progresso mostra questão atual
- **Animações**: Timer pulsa quando restam 10 segundos

## 🏗️ Arquitetura Técnica

### 📁 Arquivos Criados

#### `services/QuizService.ts`
- Serviço singleton para gerenciar questionários
- Conecta com API do Google Drive
- Verifica disponibilidade de questionários
- Carrega e processa dados JSON
- Gerencia sessões de quiz
- Calcula pontuação e estatísticas

#### `components/QuizButton.tsx`
- Componente React que renderiza o botão de questionário
- Verifica automaticamente disponibilidade
- Integra com navigation para abrir tela do quiz
- Suporte a modo escuro/claro

#### `app/quiz.tsx`
- Tela completa do questionário
- Timer com animações
- Sistema de perguntas e respostas
- Tela de resultados com estatísticas
- Navegação entre questões

#### `app/chapter-reader.tsx` (modificado)
- Adiciona o componente QuizButton no cabeçalho
- Integrado ao lado do AudioPlayer e configurações

### 🗺️ Mapeamento de Livros
O serviço mapeia os IDs numéricos dos livros bíblicos para os nomes dos arquivos:

```typescript
// Exemplos do mapeamento:
1: 'genesis',      // genesis-1.json, genesis-2.json, etc.
40: 'mateus',      // mateus-1.json, mateus-2.json, etc.
66: 'apocalipse',  // apocalipse-1.json, apocalipse-7.json, etc.
```

## 🚀 Como Usar

1. **Acesse um capítulo**: Navegue para qualquer capítulo da bíblia
2. **Localize o botão**: Procure pelo ícone ❓ no cabeçalho (só aparece se houver questionário)
3. **Inicie o quiz**: Toque no botão e confirme no alerta
4. **Responda as perguntas**: Você tem 30 segundos por pergunta
5. **Veja o resultado**: Ao final, veja sua pontuação e estatísticas
6. **Refaça se desejar**: Opção de refazer o questionário

## ⚡ Funcionalidades do Quiz

### ⏰ Sistema de Timer
- **30 segundos** por pergunta
- **Animação visual** da contagem regressiva
- **Pulso vermelho** quando restam 10 segundos
- **Auto-avançar** quando o tempo acaba

### 🎯 Sistema de Pontuação
- **Feedback imediato** após cada resposta
- **Cores visuais**: Verde (correto), Vermelho (incorreto)
- **Estatísticas completas**:
  - Pontuação total (X/Y)
  - Porcentagem de acertos
  - Tempo total gasto
  - Tempo médio por pergunta

### 📊 Tela de Resultados
- **Pontuação grande** e visual
- **Mensagem motivacional** baseada na performance:
  - 90%+: "Excelente! Você domina este capítulo! 🏆"
  - 80%+: "Muito bom! Continue assim! 🌟"
  - 70%+: "Bom trabalho! 👍"
  - 60%+: "Razoável. Que tal revisar o capítulo? 📖"
  - <60%: "Precisa estudar mais este capítulo. 📚"
- **Estatísticas detalhadas**
- **Opções**: Refazer ou Concluir

## 🎨 Experiência do Usuário

### 🌙 Modo Escuro/Claro
- Interface adapta automaticamente ao tema
- Cores consistentes com o design system

### 📱 Responsividade
- Funciona em diferentes tamanhos de tela
- Layout otimizado para dispositivos móveis

### ⚡ Performance
- **Verificação assíncrona** de disponibilidade
- **Loading states** apropriados
- **Cache de resultados** para evitar verificações desnecessárias

## 🔄 Estados de Loading
- **Carregando questionário**: Indicator na tela principal
- **Verificando disponibilidade**: Spinner no botão
- **Transições suaves** entre questões

## ⚠️ Tratamento de Erros

- **Quiz não encontrado**: Botão não aparece
- **Erro de carregamento**: Mensagem clara e opção de voltar
- **Problemas de conectividade**: Feedback apropriado
- **Timeout de rede**: Retry automático em alguns casos

## 🔮 Possíveis Melhorias Futuras

1. **Histórico**: Salvar resultados dos questionários
2. **Rankings**: Sistema de pontuação global
3. **Dificuldades**: Níveis fácil, médio, difícil
4. **Tipos de Pergunta**: Múltipla escolha, verdadeiro/falso, completar
5. **Modo Offline**: Cache local dos questionários
6. **Compartilhar Resultados**: Opção de compartilhar pontuação
7. **Desafios Diários**: Questionários temáticos diários
8. **Progresso**: Tracking de capítulos estudados
9. **Tempo Personalizado**: Configurar tempo por pergunta
10. **Audio Quiz**: Perguntas narradas

## 🐛 Resolução de Problemas

### Botão não aparece
- Verificar se existe arquivo JSON no Google Drive
- Confirmar se o nome do arquivo segue o padrão correto
- Verificar conectividade com internet

### Quiz não carrega
- Verificar conexão com internet
- Confirmar se o arquivo JSON está bem formatado
- Verificar se a API do Google Drive está funcionando

### Timer não funciona
- Verificar se o JavaScript está habilitado
- Confirmar se não há problemas de performance no dispositivo

## 📝 Exemplo Prático

Para testar com o arquivo exemplo (`apocalipse-7.json`):

1. Navegue até **Apocalipse, capítulo 7**
2. Observe o ícone ❓ ao lado do áudio e configurações
3. Toque no ícone e confirme "Iniciar"
4. Responda as perguntas sobre o capítulo
5. Veja seu resultado e estatísticas

A funcionalidade está **100% integrada** e pronta para uso! 🎯📚