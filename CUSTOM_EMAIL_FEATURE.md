# Funcionalidade de E-mail Personalizado - Admin Users

## Descrição

Adicionada funcionalidade para enviar e-mails personalizados para usuários selecionados na tela de gerenciamento de usuários do painel administrativo.

## Alterações Realizadas

### 1. Frontend (Admin Panel)

#### `admin/src/pages/Users.tsx`

- ✅ Adicionado state para gerenciar usuários selecionados
- ✅ Adicionado state para modal de composição de e-mail
- ✅ Adicionado checkbox para seleção individual de usuários
- ✅ Adicionado checkbox "Selecionar todos" no cabeçalho da tabela
- ✅ Adicionada barra de seleção com contador e botão de ação
- ✅ Adicionado modal para composição de e-mail com:
  - Campo de assunto
  - Campo de mensagem (textarea)
  - Contador de destinatários
  - Barra de progresso durante envio
  - Validações de campos obrigatórios
- ✅ Funções implementadas:
  - `toggleUserSelection()` - Selecionar/desselecionar usuário
  - `toggleSelectAll()` - Selecionar/desselecionar todos
  - `handleOpenEmailModal()` - Abrir modal de e-mail
  - `handleCloseEmailModal()` - Fechar modal e limpar estados
  - `handleSendEmail()` - Enviar e-mails para usuários selecionados

#### `admin/src/pages/Users.css`

- ✅ Estilos para barra de seleção (`.selection-bar`)
- ✅ Estilos para campos de formulário (`.form-input`, `.form-textarea`)
- ✅ Estilos para barra de progresso (`.progress-bar`, `.progress-track`)
- ✅ Estilos para modal info (`.modal-info`, `.info-box-modal`)
- ✅ Estilos para checkboxes personalizados

### 2. Backend (API)

#### `api/start/routes.ts`

- ✅ Nova rota: `POST /admin/users/send-custom-email`
- ✅ Endpoint protegido por autenticação admin

#### `api/app/controllers/Admin/auth_controller.ts`

- ✅ Importado `emailService`
- ✅ Novo método `sendCustomEmail()`:
  - Valida entrada de dados (userIds, subject, message)
  - Busca usuários no banco de dados
  - Envia e-mails individualmente
  - Contabiliza sucessos e falhas
  - Retorna estatísticas de envio

#### `api/app/services/email_service.ts`

- ✅ Novo método `sendCustomEmail()`:
  - Recebe: recipient, subject, message, userName
  - Cria template HTML responsivo
  - Cria versão texto plano
  - Envia via Resend API
  - Registra logs de sucesso/erro

## Como Usar

### 1. Selecionar Usuários

1. Acesse a tela "Gerenciamento de Usuários" no admin panel
2. Use os checkboxes para selecionar usuários individualmente
3. Ou use o checkbox do cabeçalho para selecionar todos de uma vez
4. Uma barra azul aparecerá mostrando quantos usuários foram selecionados

### 2. Compor E-mail

1. Clique no botão "✉️ Enviar E-mail Personalizado"
2. Preencha o campo "Assunto"
3. Escreva a mensagem no campo "Mensagem"
4. Revise o conteúdo
5. Clique em "Enviar E-mails"

### 3. Acompanhar Envio

- Uma barra de progresso mostrará o andamento
- Após conclusão, um alerta mostrará estatísticas:
  - ✅ E-mails enviados com sucesso
  - ❌ Falhas (se houver)

### 4. Limpar Seleção

- Clique em "Limpar Seleção" na barra azul
- Ou selecione/deselecione usuários individualmente

## Template de E-mail

O e-mail enviado possui:

- **Cabeçalho:** Logo e título "📖 Bíblia em Foco"
- **Saudação:** Personalizada com nome do usuário
- **Conteúdo:** Mensagem personalizada (com quebras de linha preservadas)
- **Rodapé:** Assinatura da equipe

## Endpoint API

### POST /admin/users/send-custom-email

**Headers:**

```
Authorization: Bearer {token}
```

**Body:**

```json
{
  "userIds": [1, 2, 3],
  "subject": "Assunto do e-mail",
  "message": "Mensagem personalizada"
}
```

**Response Success (200):**

```json
{
  "success": true,
  "sent": 3,
  "failed": 0,
  "total": 3
}
```

**Response com falhas parciais (200):**

```json
{
  "success": true,
  "sent": 2,
  "failed": 1,
  "total": 3,
  "errors": ["user@email.com: Error message"]
}
```

**Response Error (400):**

```json
{
  "error": "É necessário selecionar pelo menos um usuário"
}
```

## Dependências

- **Backend:**
  - Resend API (já configurada)
  - `RESEND_API_KEY` (env)
  - `RESEND_FROM_EMAIL` (env)
  - `RESEND_FROM_NAME` (env, opcional)

- **Frontend:**
  - React 18+
  - Axios
  - React Router

## Segurança

- ✅ Rota protegida por autenticação admin
- ✅ Validação de entrada de dados
- ✅ Sanitização de HTML (template controlado)
- ✅ Rate limiting (via Resend)
- ✅ Logs de auditoria

## Melhorias Futuras

- [ ] Preview do e-mail antes de enviar
- [ ] Salvar templates de e-mail
- [ ] Agendamento de envio
- [ ] Histórico de e-mails enviados
- [ ] Suporte a anexos
- [ ] Variáveis dinâmicas ({{nome}}, {{plano}}, etc.)
- [ ] Filtros avançados para seleção de usuários

## Testes

Para testar:

1. Certifique-se que o Resend está configurado
2. Acesse o admin panel
3. Vá em "Gerenciamento de Usuários"
4. Selecione alguns usuários de teste
5. Envie um e-mail de teste
6. Verifique se os e-mails foram recebidos

## Notas

- E-mails são enviados sequencialmente (não em paralelo)
- Cada e-mail é enviado individualmente
- Falhas em um e-mail não impedem o envio dos demais
- Quebras de linha na mensagem são preservadas no HTML
- Nome do usuário é usado na saudação (ou "Usuário" se não houver nome)

---

**Data de Implementação:** 27 de janeiro de 2026
**Status:** ✅ Implementado e testado
