# Fix: NullPointerException no Database da Harpa

## Problema

Erro ao buscar hinos no banco de dados da Harpa Cristã:

```
ERROR Erro ao criar nova conexão: [Error: Call to function 'NativeDatabase.execAsync' has been rejected.
→ Caused by: java.lang.NullPointerException: java.lang.NullPointerException]

ERROR ❌ Erro em searchHymnsInDatabase: [Error: Call to function 'NativeDatabase.execAsync' has been rejected.
→ Caused by: java.lang.NullPointerException: java.lang.NullPointerException]
```

## Causa Raiz

O método `withFreshConnection()` no `DatabaseService` estava tentando criar novas conexões ao banco de dados **ANTES** da inicialização completa do banco principal. Isso causava um `NullPointerException` no lado nativo (Java/Android).

### Fluxo do Erro

1. Usuário busca por hino na Harpa
2. `HarpaOfflineService.searchInContent()` chama `DatabaseService.searchHymnsInDatabase()`
3. `searchHymnsInDatabase()` usa `withFreshConnection()`
4. `withFreshConnection()` tenta criar nova conexão via `createFreshConnection()`
5. `createFreshConnection()` tenta executar `execAsync()` sem o banco estar pronto
6. **CRASH** - `NullPointerException`

## Solução Implementada

### 1. Garantir Inicialização em `createFreshConnection()`

```typescript
private async createFreshConnection(): Promise<SQLite.SQLiteDatabase> {
  try {
    // GARANTIR que o banco principal foi inicializado primeiro
    if (!this.db && !global.__READBIBLE_DB_HANDLE) {
      console.log('⚠️ Banco não inicializado, inicializando agora...');
      await this.ensureInitialized();
    }

    const connection = await SQLite.openDatabaseAsync(DB_NAME);
    // ... resto do código
  }
}
```

### 2. Garantir Inicialização em `withFreshConnection()`

```typescript
private async withFreshConnection<T>(
  operation: (db: SQLite.SQLiteDatabase) => Promise<T>,
  operationName: string = 'unknown'
): Promise<T> {
  let connection: SQLite.SQLiteDatabase | null = null;

  try {
    // GARANTIR inicialização antes de qualquer operação
    await this.ensureInitialized();

    console.log(`🔧 Criando nova conexão para: ${operationName}`);
    connection = await this.createFreshConnection();
    // ... resto do código
  }
}
```

## Benefícios da Correção

- ✅ **Inicialização Automática**: O banco é inicializado automaticamente se necessário
- ✅ **Prevenção de Crashes**: Evita `NullPointerException` no lado nativo
- ✅ **Experiência do Usuário**: Busca de hinos funciona sem erros
- ✅ **Resiliência**: Sistema se recupera automaticamente de estados inconsistentes

## Testes Recomendados

1. **Busca Imediata**: Abrir app e buscar hino imediatamente
2. **Busca Após Navegação**: Navegar por outras telas e depois buscar
3. **Múltiplas Buscas**: Fazer várias buscas consecutivas
4. **Busca Após Recarregar**: Recarregar app (Fast Refresh) e buscar
5. **Busca com App em Background**: Colocar app em background e retomar

## Arquivos Modificados

- [services/DatabaseService.ts](services/DatabaseService.ts)
  - Método `createFreshConnection()` - linha ~28
  - Método `withFreshConnection()` - linha ~58

## Dependências

- `expo-sqlite`: Conexão com banco de dados SQLite
- `HarpaOfflineService`: Serviço que consome o banco de dados

## Observações

- O método `ensureInitialized()` já existia e faz a inicialização thread-safe
- A solução adiciona verificações de segurança sem afetar performance
- Logs foram melhorados para facilitar debug futuro
- A inicialização é lazy (só acontece quando necessário)

## Data da Correção

24 de janeiro de 2026
