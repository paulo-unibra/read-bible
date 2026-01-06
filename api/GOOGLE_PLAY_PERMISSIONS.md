# 🔐 Como Conceder Acesso à Service Account no Google Play Console

## ❌ Problema Atual

O app `com.readbible.app` **está publicado** na Play Store, mas a API retorna erro 404 porque a Service Account não tem permissão para acessá-lo.

**Service Account:** `play-store-reporting@nutotia.iam.gserviceaccount.com`

---

## ✅ Solução: Conceder Acesso no Google Play Console

### **Passo 1: Acesse o Google Play Console**

1. Acesse: **https://play.google.com/console/**
2. Faça login com a conta que gerencia o app
3. Selecione o app **Bíblia em Foco** (`com.readbible.app`)

---

### **Passo 2: Vá para Configurações de API**

1. No menu lateral esquerdo, role até o final
2. Clique em **"Configurações"** (⚙️ ícone de engrenagem)
3. No menu suspenso, clique em **"Acesso à API"**

Ou acesse diretamente:
```
https://play.google.com/console/developers/YOUR_DEVELOPER_ID/api-access
```

---

### **Passo 3: Encontre a Service Account**

Na página **"Acesso à API"**, você verá duas seções:

1. **"Contas de serviço vinculadas"** - Lista de Service Accounts já configuradas
2. **"Vincular um projeto do Google Cloud"** - Se ainda não vinculou

**Procure por:** `play-store-reporting@nutotia.iam.gserviceaccount.com`

#### **Se a Service Account JÁ aparecer na lista:**

1. Clique no email da Service Account
2. Clique em **"Gerenciar permissões"**
3. Pule para o **Passo 4**

#### **Se a Service Account NÃO aparecer:**

1. Clique em **"Vincular um projeto do Google Cloud"**
2. Insira o **Project ID**: `nutotia`
3. Clique em **"Vincular"**
4. Após vincular, a Service Account aparecerá
5. Clique no email e depois em **"Gerenciar permissões"**

---

### **Passo 4: Configure as Permissões**

Na tela de permissões, você verá várias seções. **Marque as seguintes opções:**

#### ✅ **Permissões de App (obrigatório)**

- [x] **Ver informações do app e fazer o download de relatórios em massa (somente leitura)**
  - Esta permissão permite acessar métricas de instalação, desinstalação, etc.

#### ✅ **Permissões Financeiras (obrigatório)**

- [x] **Ver dados financeiros, pedidos e respostas a pesquisas de cancelamento**
  - Necessário para acessar métricas detalhadas do Google Play Reporting API

#### ❌ **NÃO marque** (não necessário):

- [ ] Gerenciar versões de produção
- [ ] Gerenciar versões de teste
- [ ] Responder a avaliações
- [ ] Ver feedback do usuário

---

### **Passo 5: Selecione o App**

1. Role para baixo até a seção **"Aplicativos"**
2. Certifique-se de que o app **Bíblia em Foco** (`com.readbible.app`) está selecionado
3. Se não estiver, clique em **"Adicionar app"** e selecione-o

---

### **Passo 6: Salve as Alterações**

1. Clique no botão **"Convidar usuário"** ou **"Salvar alterações"** no final da página
2. Aguarde a confirmação

---

## ⏱️ Tempo de Propagação

As permissões podem levar **de 5 a 30 minutos** para serem aplicadas. Seja paciente!

---

## 🧪 Testando a Conexão

Após conceder as permissões e aguardar alguns minutos, teste novamente:

```bash
cd /home/paulo-trabalho/Documentos/PROJETOS_PESSOAIS/ReadBible/api
node ace test:play-console
```

### **Resultado Esperado:**

```
✅ Credenciais carregadas
✅ Autenticação bem-sucedida
✅ App encontrado e acessível!
📊 Métricas disponíveis: { ... }
```

---

## 🔍 Verificando se Funcionou

1. Reinicie o servidor backend: `npm run dev`
2. Acesse o admin panel: **http://localhost:5173** (ou a porta do seu admin)
3. Faça login
4. Vá em **Relatórios**
5. Você deverá ver as estatísticas do Google Play Store!

---

## ❓ Troubleshooting

### **Erro 404 persiste após 30 minutos:**

- Verifique se o **Project ID** está correto: `nutotia`
- Verifique se o **app selecionado** é o correto: `com.readbible.app`
- Tente desconectar e reconectar a Service Account

### **Erro 403 (Acesso Negado):**

- As permissões não foram marcadas corretamente
- Volte ao Passo 4 e marque as permissões obrigatórias

### **Service Account não aparece:**

- Certifique-se de que criou a Service Account no projeto correto (`nutotia`)
- Verifique se a API "Google Play Developer Reporting API" está habilitada no Google Cloud Console

---

## 📚 Links Úteis

- **Google Play Console:** https://play.google.com/console/
- **Google Cloud Console:** https://console.cloud.google.com/
- **Documentação API:** https://developers.google.com/play/developer/reporting

---

## 🎯 Resumo Rápido

1. ✅ Acesse Google Play Console
2. ✅ Vá em: Configurações → Acesso à API
3. ✅ Encontre: `play-store-reporting@nutotia.iam.gserviceaccount.com`
4. ✅ Marque permissões: "Ver informações" + "Ver dados financeiros"
5. ✅ Selecione o app: `com.readbible.app`
6. ✅ Salve e aguarde 5-30 minutos
7. ✅ Teste: `node ace test:play-console`
