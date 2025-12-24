# Configuração de E-mail para Recuperação de Senha

## ✅ Status: Configurado e Funcionando

O sistema de envio de e-mails está configurado e testado com sucesso.

## 📧 Configurações Atuais

- **Servidor SMTP**: Gmail (smtp.gmail.com:587)
- **E-mail Remetente**: pr1999ricardo@gmail.com
- **Nome do Remetente**: Bíblia em Foco

## 🔧 Como Funciona

1. **Usuário solicita recuperação de senha** no app
2. **API gera token de 6 dígitos** válido por 30 minutos
3. **E-mail HTML é enviado** com o token formatado
4. **Usuário digita o código** no app para redefinir a senha

## 📝 Template do E-mail

O e-mail enviado inclui:
- ✅ Cabeçalho com logo/nome do app
- ✅ Saudação personalizada com nome do usuário
- ✅ Token destacado em fonte grande e monoespaçada
- ✅ Aviso de expiração (30 minutos)
- ✅ Aviso de segurança
- ✅ Rodapé com copyright
- ✅ Versão texto alternativa para clientes que não suportam HTML

## 🧪 Testar Envio de E-mail

Para verificar se o serviço de e-mail está funcionando:

```bash
cd api
node ace test:email
```

Este comando:
1. Verifica a conexão SMTP
2. Envia um e-mail de teste para pr1999ricardo@gmail.com
3. Mostra o resultado no console

## 🔐 Segurança

- **Senha de App**: Configurada no Gmail (não é a senha da conta)
- **Token de 6 dígitos**: Aleatório, único e com expiração
- **Invalidação automática**: Tokens antigos são invalidados ao gerar novo
- **Uso único**: Token só pode ser usado uma vez

## 📋 Variáveis de Ambiente

No arquivo `.env` da API:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=pr1999ricardo@gmail.com
SMTP_PASSWORD=ociqezwznxjkgewi
SMTP_FROM=pr1999ricardo@gmail.com
SMTP_FROM_NAME=Bíblia em Foco
```

## 🔄 Fluxo Completo

### 1. Solicitar Reset
```
POST /password/forgot
Body: { "email": "usuario@exemplo.com" }
```

### 2. Verificar Token
```
POST /password/verify
Body: { "email": "usuario@exemplo.com", "token": "123456" }
```

### 3. Redefinir Senha
```
POST /password/reset
Body: { 
  "email": "usuario@exemplo.com", 
  "token": "123456",
  "newPassword": "novaSenha123"
}
```

## ✅ Checklist de Configuração

- [x] Senha de app criada no Gmail
- [x] Variáveis de ambiente configuradas
- [x] Nodemailer instalado
- [x] Serviço de e-mail criado
- [x] Controller integrado com serviço
- [x] Template HTML criado
- [x] Teste realizado com sucesso
- [x] E-mail recebido corretamente

## 🚀 Próximos Passos

O sistema está pronto para uso! Quando um usuário solicitar recuperação de senha no app, ele receberá o código por e-mail automaticamente.

## 📱 Teste no App

1. Abra o app
2. Vá em "Esqueceu a senha?"
3. Digite o e-mail: pr1999ricardo@gmail.com
4. Verifique o e-mail recebido
5. Digite o código de 6 dígitos
6. Defina nova senha

---

**Última atualização**: 24/12/2025
**Status**: ✅ Funcionando
