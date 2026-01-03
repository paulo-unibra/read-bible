# Guia de Teste - Painel Administrativo

Este guia mostra como testar o sistema de autenticação do painel administrativo.

## Pré-requisitos

1. Banco de dados MySQL rodando
2. Variáveis de ambiente configuradas no backend (`/api/.env`)
3. Migrations executadas
4. Seeder de roles executado

## Passo 1: Preparar o Backend

### 1.1 Executar Migrations

```bash
cd api
node ace migration:run
```

Isso criará as tabelas:
- `users`
- `roles`
- `user_roles`
- Outras tabelas do sistema

### 1.2 Executar Seeder de Roles

```bash
node ace db:seed
```

Isso criará 3 roles:
- **Administrador** (com todas as permissões)
- **Editor** (permissões limitadas)
- **Usuário** (sem permissões administrativas)

### 1.3 Criar Usuário Administrador de Teste

```bash
node ace create:admin
```

Isso criará um usuário com as credenciais:
- **Email**: `admin@readbible.com`
- **Senha**: `Admin@123`

Se o usuário já existir, o comando irá apenas atribuir a role de Administrador.

### 1.4 Iniciar o Backend

```bash
npm run dev
```

O backend estará disponível em: `http://localhost:3333`

## Passo 2: Preparar o Frontend

### 2.1 Instalar Dependências

```bash
cd ../admin
npm install
```

### 2.2 Configurar Variáveis de Ambiente

Verifique se o arquivo `.env` existe na pasta `/admin` com:

```env
VITE_API_URL=http://localhost:3333
```

### 2.3 Iniciar o Frontend

```bash
npm run dev
```

O painel estará disponível em: `http://localhost:5173`

## Passo 3: Testar o Sistema

### 3.1 Teste de Login

1. Acesse `http://localhost:5173`
2. Você será redirecionado para `/login`
3. Digite as credenciais:
   - **Email**: `admin@readbible.com`
   - **Senha**: `Admin@123`
4. Clique em "Entrar"

**Resultado Esperado:**
- ✅ Redirecionamento para `/dashboard`
- ✅ Token armazenado em `localStorage` (chave: `admin_token`)
- ✅ Dados do usuário armazenados em `localStorage` (chave: `admin_user`)

### 3.2 Teste do Dashboard

Após o login, você deverá ver:

1. **Header**:
   - Nome do usuário no canto superior direito
   - Botão "Sair"

2. **Welcome Card**:
   - Mensagem de boas-vindas com nome do usuário
   - Badge "Administrador" (role)
   - Lista de permissões em grade:
     - acessar_painel_administrativo
     - gerenciar_usuarios
     - gerenciar_conteudo
     - gerenciar_questionarios
     - visualizar_relatorios
     - gerenciar_roles
     - configurar_sistema

3. **Dashboard Grid**:
   - 4 cards: Relatórios, Usuários, Questionários, Conteúdo
   - Botões "Em breve" desabilitados

### 3.3 Teste de Logout

1. Clique no botão "Sair" no header
2. Você será redirecionado para `/login`
3. Token e dados do usuário serão removidos do `localStorage`

**Resultado Esperado:**
- ✅ Redirecionamento para `/login`
- ✅ `localStorage` limpo
- ✅ Não é possível acessar `/dashboard` sem fazer login novamente

### 3.4 Teste de Proteção de Rotas

1. Faça logout (ou limpe o `localStorage`)
2. Tente acessar diretamente `http://localhost:5173/dashboard`

**Resultado Esperado:**
- ✅ Redirecionamento automático para `/login`

### 3.5 Teste de Permissões Insuficientes

Para testar um usuário sem permissão:

1. Crie um usuário comum no backend:

```bash
node ace tinker
```

```javascript
const User = (await import('#models/user')).default
const Role = (await import('#models/role')).default

const user = await User.create({
  email: 'usuario@exemplo.com',
  password: 'Senha@123',
  fullName: 'Usuário Comum'
})

const userRole = await Role.findBy('slug', 'usuario')
await user.related('roles').attach([userRole.id])
```

2. Faça login no painel com:
   - **Email**: `usuario@exemplo.com`
   - **Senha**: `Senha@123`

**Resultado Esperado:**
- ✅ Erro de login: "Usuário não tem permissão para acessar o painel administrativo"

## Passo 4: Testar Funcionalidades da API

### 4.1 Endpoint: POST /admin/login

```bash
curl -X POST http://localhost:3333/admin/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@readbible.com",
    "password": "Admin@123"
  }'
```

**Resposta Esperada:**
```json
{
  "token": "oat_...",
  "user": {
    "id": 1,
    "email": "admin@readbible.com",
    "fullName": "Administrador Sistema",
    "roles": [
      {
        "id": 1,
        "name": "Administrador",
        "slug": "administrador",
        "permissions": [...]
      }
    ],
    "permissions": [
      "acessar_painel_administrativo",
      "gerenciar_usuarios",
      ...
    ]
  }
}
```

### 4.2 Endpoint: GET /admin/me

```bash
TOKEN="seu_token_aqui"

curl -X GET http://localhost:3333/admin/me \
  -H "Authorization: Bearer $TOKEN"
```

**Resposta Esperada:**
```json
{
  "id": 1,
  "email": "admin@readbible.com",
  "fullName": "Administrador Sistema",
  "roles": [...],
  "permissions": [...]
}
```

### 4.3 Endpoint: POST /admin/logout

```bash
TOKEN="seu_token_aqui"

curl -X POST http://localhost:3333/admin/logout \
  -H "Authorization: Bearer $TOKEN"
```

**Resposta Esperada:**
```json
{
  "message": "Logout realizado com sucesso"
}
```

## Troubleshooting

### Erro: "Role 'administrador' não encontrada"

**Solução**: Execute o seeder de roles:
```bash
cd api
node ace db:seed
```

### Erro: "Cannot find module '#models/user'"

**Solução**: Compile o projeto TypeScript:
```bash
cd api
npm run build
```

### Erro de CORS no frontend

**Solução**: Verifique se o backend tem CORS habilitado no arquivo `/api/config/cors.ts`:

```typescript
{
  enabled: true,
  origin: true, // ou ['http://localhost:5173']
  // ...
}
```

### Token não sendo enviado nas requisições

**Solução**: Verifique se:
1. O token está armazenado no `localStorage` (chave: `admin_token`)
2. O interceptor do Axios está configurado corretamente em `/admin/src/services/api.ts`
3. O formato do header é: `Authorization: Bearer <token>`

### Redirecionamento infinito para /login

**Solução**: Verifique se:
1. O endpoint `/admin/me` está retornando 200 OK
2. O `AuthContext` está carregando o usuário corretamente
3. Não há erros no console do navegador

## Checklist de Validação

- [ ] Backend rodando em `http://localhost:3333`
- [ ] Frontend rodando em `http://localhost:5173`
- [ ] Migrations executadas
- [ ] Seeder de roles executado
- [ ] Usuário administrador criado
- [ ] Login funciona corretamente
- [ ] Token armazenado no localStorage
- [ ] Dashboard exibe informações do usuário
- [ ] Roles e permissões são exibidas
- [ ] Logout funciona corretamente
- [ ] Proteção de rotas funcionando (redireciona para /login)
- [ ] Usuários sem permissão não conseguem fazer login
- [ ] Endpoints da API retornam respostas corretas

## Próximos Passos

Após validar o sistema de autenticação, você pode:

1. Criar páginas adicionais:
   - Gerenciamento de usuários
   - Gerenciamento de roles
   - Visualização de relatórios
   - Gerenciamento de conteúdo

2. Adicionar mais endpoints na API:
   - CRUD de usuários
   - CRUD de roles
   - Relatórios e estatísticas

3. Implementar funcionalidades avançadas:
   - Paginação
   - Filtros e busca
   - Upload de arquivos
   - Gráficos e dashboards
