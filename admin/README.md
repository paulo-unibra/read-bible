# Painel Administrativo - ReadBible

Painel administrativo web para gerenciar usuários, conteúdo e questionários do aplicativo ReadBible.

## Tecnologias

- **React 18** com TypeScript
- **Vite** para build e desenvolvimento
- **React Router DOM** para roteamento
- **Axios** para requisições HTTP
- **Context API** para gerenciamento de estado de autenticação

## Estrutura do Projeto

```
admin/
├── src/
│   ├── components/
│   │   └── ProtectedRoute.tsx    # Componente para proteger rotas por permissão
│   ├── contexts/
│   │   └── AuthContext.tsx       # Context de autenticação
│   ├── pages/
│   │   ├── Login.tsx             # Página de login
│   │   ├── Login.css
│   │   ├── Dashboard.tsx         # Dashboard principal
│   │   └── Dashboard.css
│   ├── services/
│   │   ├── api.ts                # Cliente Axios configurado
│   │   └── authService.ts        # Serviços de autenticação
│   ├── App.tsx                   # Configuração de rotas
│   └── main.tsx                  # Entry point
├── .env                          # Variáveis de ambiente
└── package.json
```

## Configuração

1. Instalar dependências:
```bash
npm install
```

2. Configurar arquivo `.env`:
```env
VITE_API_URL=http://localhost:3333
```

## Sistema de Autenticação

### Roles e Permissões

O sistema utiliza **roles** (papéis) com **permissões** específicas:

- **Administrador**: Acesso total ao painel
  - `acessar_painel_administrativo`
  - `gerenciar_usuarios`
  - `gerenciar_conteudo`
  - `gerenciar_questionarios`
  - `visualizar_relatorios`
  - `gerenciar_roles`
  - `configurar_sistema`

- **Editor**: Acesso limitado ao painel
  - `acessar_painel_administrativo`
  - `gerenciar_conteudo`
  - `gerenciar_questionarios`
  - `visualizar_relatorios`

- **Usuário**: Sem acesso ao painel (usuário comum do app)

### Rotas Protegidas

Todas as rotas internas do painel são protegidas pelo componente `ProtectedRoute`:

```tsx
<ProtectedRoute permission="acessar_painel_administrativo">
  <Dashboard />
</ProtectedRoute>
```

Se o usuário não estiver autenticado ou não tiver a permissão necessária, será redirecionado para a página de login ou exibirá mensagem de acesso negado.

### Armazenamento

- **Token**: `localStorage.getItem('admin_token')`
- **Usuário**: `localStorage.getItem('admin_user')` (JSON com dados do usuário)
- **Expiração**: Tokens expiram em 7 dias

## Desenvolvimento

Iniciar servidor de desenvolvimento:

```bash
npm run dev
```

O painel estará disponível em: `http://localhost:5173`

**Importante**: A API backend deve estar rodando em `http://localhost:3333` (configurado em `.env`)

## Build para Produção

```bash
npm run build
```

Os arquivos otimizados serão gerados na pasta `dist/`.

## Credenciais de Teste

Para testar o sistema, crie um usuário no backend e associe-o à role "Administrador":

```typescript
// No backend AdonisJS
const user = await User.create({
  email: 'admin@exemplo.com',
  password: 'senha123',
  fullName: 'Administrador Sistema'
})

const adminRole = await Role.findBy('slug', 'administrador')
await user.related('roles').attach([adminRole.id])
```

## Funcionalidades Implementadas

- ✅ Sistema de login com validação
- ✅ Verificação de permissões por role
- ✅ Dashboard com informações do usuário
- ✅ Exibição de roles e permissões
- ✅ Logout com limpeza de sessão
- ✅ Proteção de rotas
- ✅ Interceptor de requisições (token automático)
- ✅ Tratamento de erros 401 (auto-logout)

## Próximas Funcionalidades

- [ ] Página de gerenciamento de usuários
- [ ] Página de gerenciamento de roles
- [ ] Página de gerenciamento de conteúdo
- [ ] Página de gerenciamento de questionários
- [ ] Visualização de relatórios
- [ ] Configurações do sistema

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
