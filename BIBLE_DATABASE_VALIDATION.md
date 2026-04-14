# Validação de Banco de Dados da Bíblia

## Problema Resolvido

O erro "O arquivo da Bíblia está corrompido ou tem estrutura inválida. Tabelas encontradas: nenhuma" ocorria quando o banco de dados SQLite baixado não continha a estrutura esperada.

## Melhorias Implementadas

### 1. Validação no Download (GoogleDriveService)

#### Verificações Implementadas:
- **Tamanho Mínimo**: Arquivo deve ter pelo menos 100KB
- **Assinatura SQLite**: Verifica se o arquivo começa com "SQLite format 3"
- **Limpeza Automática**: Remove arquivos existentes antes de baixar novamente
- **Verificação de Integridade**: Confirma que o arquivo foi baixado completamente

#### Benefícios:
- Detecta problemas no momento do download
- Previne que arquivos corrompidos sejam salvos
- Mensagens de erro mais claras e acionáveis

### 2. Validação na Abertura (BibleReaderService)

#### Verificações em 4 Níveis:

**Nível 1: Validação de Arquivo**
- Verifica se o arquivo existe
- Valida tamanho mínimo (100KB)
- Remove automaticamente arquivos muito pequenos

**Nível 2: Validação de Estrutura**
- Verifica se existe a tabela 'Bible'
- Lista todas as tabelas disponíveis para diagnóstico
- Remove arquivo e exibe estrutura esperada se falhar

**Nível 3: Validação de Colunas**
- Verifica colunas obrigatórias: `Book`, `Chapter`, `Verse`, `Scripture`
- Identifica colunas faltantes
- Remove arquivo e mostra diferenças

**Nível 4: Validação de Dados**
- Verifica se a tabela contém dados (não está vazia)
- Conta o número de versículos
- Remove arquivo se estiver vazio

#### Benefícios:
- Diagnóstico detalhado de problemas
- Auto-recuperação (remove arquivos inválidos)
- Mensagens de erro em português com instruções claras

## Estrutura Esperada do Banco de Dados

### Tabela: `Bible`

```sql
CREATE TABLE Bible (
    Book INTEGER NOT NULL,
    Chapter INTEGER NOT NULL,
    Verse INTEGER NOT NULL,
    Scripture TEXT NOT NULL
);
```

### Descrição dos Campos:

| Campo | Tipo | Descrição | Exemplo |
|-------|------|-----------|---------|
| `Book` | INTEGER | ID do livro (1-66) | `1` (Gênesis) |
| `Chapter` | INTEGER | Número do capítulo | `1` |
| `Verse` | INTEGER | Número do versículo | `1` |
| `Scripture` | TEXT | Texto do versículo (pode conter HTML) | `No princípio...` |

### Exemplo de Dados:

```sql
INSERT INTO Bible (Book, Chapter, Verse, Scripture) VALUES
(1, 1, 1, 'No princípio, criou Deus os céus e a terra.'),
(1, 1, 2, 'E a terra era sem forma e vazia; e havia trevas sobre a face do abismo...'),
(19, 23, 1, 'O SENHOR é o meu pastor; nada me faltará.');
```

## Mapeamento de Livros

### Antigo Testamento (1-39)
- 1: Gênesis
- 2: Êxodo
- 3: Levítico
- 4: Números
- 5: Deuteronômio
- ... (continue para todos os livros)
- 19: Salmos
- 20: Provérbios
- ... (até 39: Malaquias)

### Novo Testamento (40-66)
- 40: Mateus
- 41: Marcos
- 42: Lucas
- 43: João
- 44: Atos
- ... (continue para todos os livros)
- 66: Apocalipse

## Como Criar um Banco de Dados Válido

### Opção 1: Usar SQLite Command Line

```bash
# Criar banco de dados
sqlite3 minha-biblia.db

# Criar tabela
CREATE TABLE Bible (
    Book INTEGER NOT NULL,
    Chapter INTEGER NOT NULL,
    Verse INTEGER NOT NULL,
    Scripture TEXT NOT NULL
);

# Criar índices para melhor performance
CREATE INDEX idx_book ON Bible(Book);
CREATE INDEX idx_book_chapter ON Bible(Book, Chapter);
CREATE INDEX idx_book_chapter_verse ON Bible(Book, Chapter, Verse);

# Inserir dados (exemplo)
INSERT INTO Bible VALUES (1, 1, 1, 'No princípio, criou Deus os céus e a terra.');
```

### Opção 2: Importar de CSV

Se você tem um arquivo CSV com o formato: `Book,Chapter,Verse,Scripture`

```bash
sqlite3 minha-biblia.db

CREATE TABLE Bible (
    Book INTEGER NOT NULL,
    Chapter INTEGER NOT NULL,
    Verse INTEGER NOT NULL,
    Scripture TEXT NOT NULL
);

.mode csv
.import biblia.csv Bible

# Verificar importação
SELECT COUNT(*) FROM Bible;
SELECT * FROM Bible LIMIT 5;
```

### Opção 3: Script Python

```python
import sqlite3
import json

# Conectar ao banco de dados
conn = sqlite3.connect('minha-biblia.db')
cursor = conn.cursor()

# Criar tabela
cursor.execute('''
    CREATE TABLE Bible (
        Book INTEGER NOT NULL,
        Chapter INTEGER NOT NULL,
        Verse INTEGER NOT NULL,
        Scripture TEXT NOT NULL
    )
''')

# Carregar dados de JSON (exemplo)
with open('biblia.json', 'r', encoding='utf-8') as f:
    data = json.load(f)
    
# Inserir dados
for livro in data['livros']:
    book_id = livro['id']
    for capitulo in livro['capitulos']:
        chapter_num = capitulo['numero']
        for versiculo in capitulo['versiculos']:
            cursor.execute(
                'INSERT INTO Bible VALUES (?, ?, ?, ?)',
                (book_id, chapter_num, versiculo['numero'], versiculo['texto'])
            )

# Criar índices
cursor.execute('CREATE INDEX idx_book ON Bible(Book)')
cursor.execute('CREATE INDEX idx_book_chapter ON Bible(Book, Chapter)')

# Salvar mudanças
conn.commit()
conn.close()

print("Banco de dados criado com sucesso!")
```

## Verificando Integridade do Banco de Dados

### Comando SQLite

```bash
sqlite3 minha-biblia.db

# Verificar tabelas
.tables

# Verificar estrutura da tabela
.schema Bible

# Verificar colunas
PRAGMA table_info(Bible);

# Contar registros
SELECT COUNT(*) FROM Bible;

# Verificar livros únicos
SELECT DISTINCT Book FROM Bible ORDER BY Book;

# Verificar capítulos de um livro
SELECT DISTINCT Chapter FROM Bible WHERE Book = 1 ORDER BY Chapter;

# Ver primeiros versículos
SELECT * FROM Bible LIMIT 5;

# Verificar integridade
PRAGMA integrity_check;
```

### Validações Mínimas

Um banco de dados válido deve:
1. ✓ Ter tamanho >= 100KB
2. ✓ Começar com "SQLite format 3"
3. ✓ Conter tabela 'Bible'
4. ✓ Ter colunas: Book, Chapter, Verse, Scripture
5. ✓ Conter pelo menos 31.102 versículos (Bíblia completa)

## Solução de Problemas

### Erro: "Tabelas encontradas: nenhuma"

**Causa**: O arquivo não é um banco de dados SQLite válido ou está vazio.

**Solução**:
1. O app remove automaticamente o arquivo corrompido
2. Faça o download novamente do Google Drive
3. Verifique se o arquivo correto foi compartilhado

### Erro: "Colunas faltando: Book, Chapter, Verse, Scripture"

**Causa**: A tabela Bible existe mas não tem as colunas esperadas.

**Solução**:
1. O app remove automaticamente o arquivo inválido
2. Verifique a estrutura do banco de dados no Google Drive
3. Recrie o banco seguindo a estrutura documentada acima

### Erro: "Arquivo muito pequeno"

**Causa**: O download foi interrompido ou o arquivo está incompleto.

**Solução**:
1. O app remove automaticamente o arquivo
2. Verifique sua conexão com a internet
3. Tente fazer o download novamente

### Erro: "Não é um banco de dados SQLite válido"

**Causa**: O arquivo tem extensão .db mas não é SQLite.

**Solução**:
1. O app remove automaticamente o arquivo
2. Verifique se o arquivo correto foi carregado no Google Drive
3. Certifique-se de usar um arquivo .db SQLite válido

## Google Drive - Configuração Correta

### Estrutura de Pastas

```
ReadBible (Pasta Pública)
├── ARC-Almeida Revista e Corrigida.db
├── NVI-Nova Versão Internacional.db
└── ...outras traduções
```

### Permissões

- Compartilhamento: "Qualquer pessoa com o link"
- Acesso: "Visualizador"

### Tamanho dos Arquivos

Traduções típicas:
- Bíblia completa: 2-5 MB
- Novo Testamento apenas: 500KB - 1MB
- Bíblia com notas/recursos: 5-20 MB

## Logs de Diagnóstico

O app registra informações detalhadas no console:

```
Opening Bible from SQLite directory: ARC-Almeida Revista e Corrigida.db
Available tables in database: [{ name: 'Bible' }]
Bible database validated successfully: 31102 verses found
```

Se houver problemas:

```
ERROR: Invalid database structure. Deleting corrupted files...
File size too small: 45678 bytes
Tabelas encontradas: sqlite_sequence, android_metadata
```

## Melhorias Futuras

- [ ] Checksums MD5/SHA256 para verificar integridade
- [ ] Download com retry automático
- [ ] Cache de metadados (número de livros, capítulos)
- [ ] Verificação periódica de integridade em background
- [ ] Compactação/descompactação de arquivos grandes
- [ ] Download incremental (apenas capítulos necessários)

## Suporte

Se o problema persistir:

1. Verifique os logs no console do app
2. Confirme que o arquivo no Google Drive é válido
3. Teste o arquivo localmente com SQLite Browser
4. Verifique as permissões de compartilhamento
5. Tente com outro arquivo/tradução

## Arquivos Relacionados

- [BibleReaderService.ts](./services/BibleReaderService.ts) - Validação na abertura
- [GoogleDriveService.ts](./services/GoogleDriveService.ts) - Validação no download
- [bible-manager.tsx](./app/bible-manager.tsx) - UI de gerenciamento de Bíblias
- [chapter-reader.tsx](./app/chapter-reader.tsx) - Leitura de capítulos

---

**Última atualização**: 11 de fevereiro de 2026  
**Versão**: 1.0.0
