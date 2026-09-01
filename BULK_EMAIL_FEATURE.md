# Sistema de Envio de E-mails em Lote

## 📧 Visão Geral

Sistema completo para envio de e-mails personalizados em lote para usuários baseado no status de leitura dos seus planos.

---

## ✨ Funcionalidades

### Filtros de Público-Alvo

1. **✅ Em Dia**
   - Usuários que completaram a quantidade de dias esperada
   - Critério: `daysCompleted >= expectedDays` e `daysCompleted < expectedDays + 3`
   - E-mail de incentivo e congratulação

2. **🌟 Adiantado**
   - Usuários que leram mais dias do que o esperado (3+ dias à frente)
   - Critério: `daysCompleted >= expectedDays + 3`
   - E-mail de parabéns e reconhecimento

3. **📖 Atrasado**
   - Usuários que não completaram os dias esperados
   - Critério: `daysCompleted < expectedDays`
   - E-mail de motivação e encorajamento

---

## 🔧 Implementação Técnica

### Backend (API)

#### Arquivo: `api/app/services/email_service.ts`

**Novo método:** `sendReadingStatusEmail()`

- Envia e-mails personalizados com templates HTML e texto
- Templates diferentes para cada status (em_dia, adiantado, atrasado)
- Inclui estatísticas do plano, barra de progresso e versículo
- Suporta modo dev (envia para e-mail de teste) e produção (e-mail real)

#### Arquivo: `api/app/controllers/bulk_email_controller.ts`

**Endpoints criados:**

1. `GET /admin/bulk-email/users`
   - Busca usuários filtrados por status de leitura
   - Query param: `status` (em_dia | adiantado | atrasado)
   - Retorna lista de usuários com dados do plano

2. `POST /admin/bulk-email/send`
   - Envia e-mails em lote para usuários selecionados
   - Body: `{ userIds: number[], status: string }`
   - Delay de 1s entre envios para não sobrecarregar SMTP

3. `GET /admin/bulk-email/preview`
   - Retorna dados de exemplo para preview do e-mail
   - Query param: `status`

**Lógica de Cálculo:**

```sql
-- Dias esperados baseado no tempo decorrido
CEIL(
  total_days *
  (DATEDIFF(CURDATE(), DATE(start_date)) /
   DATEDIFF(DATE(end_date), DATE(start_date)))
)
```

---

### Frontend (Admin Panel)

#### Arquivo: `admin/src/pages/BulkEmail.tsx`

**Componente principal com:**

- Seleção de status (filtros visuais)
- Lista de usuários em cards com checkbox
- Seleção individual ou em massa
- Informações do plano (dias lidos, esperados, progresso)
- Botão de envio com confirmação
- Feedback de progresso e resultado

**Features:**

- ✓ Interface intuitiva e responsiva
- ✓ Cards coloridos por status
- ✓ Seleção múltipla de usuários
- ✓ Aviso sobre modo dev/prod
- ✓ Feedback visual de envio
- ✓ Estatísticas de sucesso/falha

---

## 🎨 Templates de E-mail

### Estrutura HTML

Cada e-mail contém:

- **Cabeçalho** com logo/título "Bíblia em Foco"
- **Saudação** personalizada com nome do usuário
- **Status box** com cor e mensagem específica
- **Estatísticas** (dias lidos, esperados)
- **Barra de progresso** visual
- **Versículo** (Salmos 119:105)
- **Mensagem motivacional** personalizada
- **CTA button** para abrir o app
- **Rodapé** com nome do plano

### Cores por Status

- **Em Dia:** Verde (#4CAF50)
- **Adiantado:** Azul (#2196F3)
- **Atrasado:** Laranja (#FF9800)

---

## 🔒 Segurança e Permissões

### Permissão Necessária

- `gerenciar_usuarios` - Requerida para acessar e enviar e-mails

### Modo Desenvolvimento vs Produção

**Desenvolvimento (`NODE_ENV !== 'production'`):**

- Todos os e-mails são enviados para: `TEST_EMAIL_RECIPIENT`
- Aviso visual na interface
- Útil para testes sem enviar para usuários reais

**Produção:**

- E-mails enviados para os e-mails reais dos usuários
- Confirmação antes do envio

---

## ⚙️ Configuração

### Variáveis de Ambiente

**Arquivo:** `api/.env`

```env
# Email configuration for password reset
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu-email@gmail.com
SMTP_PASSWORD=sua-senha-de-app
SMTP_FROM=seu-email@gmail.com
SMTP_FROM_NAME=Bíblia em Foco

# Email testing - Em desenvolvimento, todos os e-mails vão para este endereço
# Em produção, comente esta linha para enviar para os e-mails reais dos usuários
TEST_EMAIL_RECIPIENT=seu-email@gmail.com
```

**Arquivo:** `api/start/env.ts`

```typescript
TEST_EMAIL_RECIPIENT: Env.schema.string.optional(),
```

---

## 🚀 Como Usar

### 1. Acessar o Painel Admin

```
http://localhost:5173/admin/bulk-email
```

### 2. Selecionar Público-Alvo

Clique em um dos filtros:

- ✅ Em Dia
- 🌟 Adiantado
- 📖 Atrasado

### 3. Selecionar Usuários

- Marque usuários individualmente clicando nos cards
- Ou use "Selecionar Todos" para marcar todos de uma vez

### 4. Enviar E-mails

- Clique em "✉️ Enviar para X selecionados"
- Confirme o envio no popup
- Aguarde o processo (delay de 1s entre cada e-mail)
- Veja o resultado (sucessos e falhas)

---

## 📊 Estatísticas de Envio

Após o envio, o sistema mostra:

- ✓ **Total de e-mails enviados com sucesso**
- ✗ **Total de falhas**
- 📋 **Lista de erros** (se houver)

---

## 🧪 Testando Localmente

### 1. Inicie o Backend

```bash
cd api
npm run dev
```

### 2. Inicie o Admin Panel

```bash
cd admin
npm run dev
```

### 3. Acesse

```
http://localhost:5173/admin/bulk-email
```

### 4. Verifique E-mail de Teste

Com `TEST_EMAIL_RECIPIENT` configurado, todos os e-mails vão para o e-mail de teste, mesmo com usuários diferentes selecionados.

---

## 🐛 Troubleshooting

### E-mails não são enviados

1. Verifique as credenciais SMTP no `.env`
2. Teste a conexão SMTP: `node ace test:email`
3. Verifique os logs do backend para erros

### Usuários não aparecem

1. Certifique-se de que existem usuários com planos ativos
2. Verifique se os planos estão no período correto (entre start_date e end_date)
3. Verifique os critérios de cada status

### Erros de permissão

- Certifique-se de que seu usuário tem a permissão `gerenciar_usuarios`

---

## 📝 Exemplo de E-mail Enviado

### Para: Usuário com leitura em dia

```
Assunto: ✅ Parabéns! Sua leitura está em dia - Bíblia em Foco

Olá, João Silva!

✅ Parabéns! Sua leitura está em dia

Continue assim! Você está mantendo o ritmo perfeito de leitura.

Estatísticas:
- Dias Lidos: 45
- Dias Esperados: 43
- Progresso: 12% (45 de 365 dias)

"Lâmpada para os meus pés é a tua palavra e, luz para os meus caminhos."
Salmos 119:105

Sua dedicação é inspiradora. A Palavra de Deus está transformando sua vida a cada dia!

[Abrir Bíblia em Foco]
```

---

## 🎯 Próximas Melhorias

- [ ] Agendar envios automáticos (cron jobs)
- [ ] Histórico de e-mails enviados
- [ ] Preview visual do e-mail antes de enviar
- [ ] Templates customizáveis pelo admin
- [ ] Segmentação por plano específico
- [ ] Relatórios de taxa de abertura/clique

---

## 📚 Arquivos Relacionados

### Backend

- `api/app/services/email_service.ts`
- `api/app/controllers/bulk_email_controller.ts`
- `api/start/routes.ts`
- `api/start/env.ts`
- `api/.env`

### Frontend

- `admin/src/pages/BulkEmail.tsx`
- `admin/src/pages/BulkEmail.css`
- `admin/src/pages/Dashboard.tsx`
- `admin/src/App.tsx`

---

## 📞 Suporte

Para dúvidas ou problemas, verifique:

1. Logs do backend em `api/logs/`
2. Console do navegador (F12)
3. Documentação do EMAIL_SETUP.md
