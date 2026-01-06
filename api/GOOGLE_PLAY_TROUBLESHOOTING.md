# 🔍 Troubleshooting: App não encontrado (404)

## ✅ Status Atual

- ✅ Google Play Reporting API inicializada com sucesso
- ✅ Credenciais configuradas corretamente
- ✅ Autenticação funcionando
- ⚠️ App retorna erro 404 (não encontrado)

---

## 🎯 Causa do Erro 404

O erro **"App não encontrado"** acontece quando:

1. **As permissões ainda não propagaram completamente**
   - Tempo de propagação: 5 minutos até 48 horas
   - Recomendação: Aguardar algumas horas

2. **O app não tem dados suficientes**
   - A API do Google Play Developer Reporting só retorna dados para apps com:
     - ✅ Versão publicada em **produção**
     - ✅ Usuários ativos
     - ✅ Dados de crashes/ANRs coletados

3. **Tipo de permissão insuficiente**
   - A Service Account precisa de permissões específicas por app

---

## 🔧 Checklist de Verificação

### 1. Verificar se o app está em produção

```
✓ App publicado: https://play.google.com/store/apps/details?id=com.readbible.app
✓ Status: Publicado
? Tem usuários ativos? (Necessário para a API funcionar)
```

### 2. Verificar permissões da Service Account

**Acesse:** https://play.google.com/console/

1. Selecione o app: **Bíblia em Foco**
2. Vá em: **Configurações** → **Permissões de usuário**
3. Procure por: `play-store-reporting@nutotia.iam.gserviceaccount.com`
4. **Verifique se as permissões estão assim:**

#### ✅ Permissões Necessárias:

- [x] **Ver informações do app e fazer o download de relatórios em massa (somente leitura)**
- [x] **Ver dados financeiros, pedidos e respostas a pesquisas de cancelamento**

#### ❌ NÃO necessário:

- [ ] Gerenciar versões de produção
- [ ] Gerenciar versões de teste
- [ ] Responder a avaliações

### 3. Verificar no Google Cloud Console

**Acesse:** https://console.cloud.google.com/

1. Selecione o projeto: **nutotia**
2. Vá em: **APIs e Serviços** → **Biblioteca**
3. Procure: **Google Play Developer Reporting API**
4. Status deve estar: **✅ ATIVADO**

---

## 🧪 Teste Manual

Execute o comando de teste:

```bash
cd /home/paulo-trabalho/Documentos/PROJETOS_PESSOAIS/ReadBible/api
node ace test:play-console
```

### Resultado Esperado (quando funcionando):

```
✅ Credenciais carregadas
✅ Autenticação bem-sucedida
✅ App encontrado e acessível!
📊 Dados disponíveis: { ... }
```

### Resultado Atual:

```
✅ Credenciais carregadas
✅ Autenticação bem-sucedida
❌ App "com.readbible.app" NÃO ENCONTRADO
```

---

## 💡 Soluções

### Solução 1: Aguardar Propagação (Recomendado)

As permissões podem levar tempo para propagar. Aguarde:

- ⏱️ **Mínimo:** 15-30 minutos
- ⏱️ **Comum:** 2-6 horas
- ⏱️ **Máximo:** 24-48 horas

**Teste periodicamente:**

```bash
node ace test:play-console
```

---

### Solução 2: Verificar Permissões por App

No Google Play Console:

1. Acesse: **Configurações** → **Acesso à API**
2. Clique na Service Account: `play-store-reporting@nutotia.iam.gserviceaccount.com`
3. Clique em **"Permissões do app"**
4. Verifique se **Bíblia em Foco** está na lista
5. Se não estiver, clique em **"Adicionar app"** e selecione

---

### Solução 3: Verificar se o App Tem Dados

A API só funciona se o app tiver:

1. **Pelo menos 1 versão em produção** com usuários ativos
2. **Dados de crashes/ANRs coletados** (pode levar alguns dias após publicação)
3. **Firebase Crashlytics ou Play Console Vitals** configurados

**Como verificar:**

1. Acesse: https://play.google.com/console/
2. Selecione seu app
3. Vá em: **Qualidade** → **Android vitals**
4. Verifique se há dados de crashes/ANRs

Se não houver dados, a API retornará 404 mesmo com permissões corretas.

---

### Solução 4: Revogar e Recriar Permissões

Se depois de 48h ainda não funcionar:

1. No Google Play Console, **remova** a Service Account
2. Aguarde 10 minutos
3. **Adicione novamente** a Service Account
4. Conceda as permissões novamente
5. Aguarde mais 30 minutos

---

## 🎨 Como o Admin se Comporta

**Enquanto o erro 404 persistir:**

- ✅ Admin carrega normalmente
- ✅ Seção "Google Play Store" aparece
- ℹ️ Mostra aviso: "App não configurado no Google Play Console"
- 📊 Dados aparecem como 0 (vazios)

**Quando funcionar:**

- ✅ Dados de crashes aparecem
- ✅ Dados de ANRs aparecem
- ℹ️ Aviso sobre instalações (não disponíveis na API)

---

## 📞 Suporte

Se após 48 horas o problema persistir, verifique:

1. **Documentação oficial:**
   - https://developers.google.com/play/developer/reporting

2. **Fóruns do Google:**
   - https://support.google.com/googleplay/android-developer/

3. **Stack Overflow:**
   - Tag: `google-play-developer-api`

---

## 🔄 Status Atual do Sistema

```
✅ Backend funcionando
✅ API integrada
✅ Credenciais configuradas
✅ Frontend preparado
⏳ Aguardando propagação de permissões
```

**Próximo passo:** Aguardar e testar periodicamente com:

```bash
node ace test:play-console
```

---

## 📝 Notas Importantes

1. **A API NÃO fornece dados de instalações** - apenas métricas de qualidade
2. **Dados têm delay de ~48h** - métricas não são em tempo real
3. **API gratuita** - não há custos para usar
4. **Sem limite de requisições** documentado oficialmente

---

**Última atualização:** 5 de janeiro de 2026
