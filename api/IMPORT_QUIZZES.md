# Importar Quizzes do Cloud Storage

Este comando permite importar quizzes existentes no Google Cloud Storage para o banco de dados.

## Pré-requisitos

Configure as variáveis de ambiente no `.env`:

```env
GCS_CREDENTIALS='{"type":"service_account",...}'
GCS_BUCKET_NAME='seu-bucket-name'
```

## Uso

### Importar todos os quizzes

```bash
node ace import:quizzes
```

### Importar quizzes com prefixo específico

```bash
# Importar apenas quizzes da versão NVI
node ace import:quizzes nvi

# Importar apenas quizzes de Gênesis
node ace import:quizzes genesis

# Importar apenas NVI - Gênesis
node ace import:quizzes nvi-genesis
```

## Formato esperado dos arquivos

Os arquivos JSON devem estar na pasta `quizzes/` e seguir o formato de nome:

**Formato**: `versao-livro-capitulo.json`

### Exemplos reais:

- `arc-gênesis-1.json`
- `arc-êxodo-1.json`
- `arc-1-samuel-1.json` (livros com número)
- `arc-2-crônicas-1.json`
- `arc-salmos-1.json`

**Importante**:

- Aceita acentos nos nomes (gênesis, êxodo, etc)
- Aceita URL encoding (%C3%AA para ê)
- Suporta livros com números (1 Samuel, 2 Reis, etc)

### Estrutura do JSON

```json
{
  "name": "Gênesis 1",
  "category": "Criação",
  "questions": [
    {
      "id": "q1",
      "pergunta": "Qual foi o primeiro dia da criação?",
      "alternativas": ["a) Luz", "b) Terra", "c) Água", "d) Plantas"],
      "respostaCorreta": "a"
    }
  ]
}
```

## Comportamento

- ✅ **Importa**: Quizzes que não existem no banco
- ⏭️ **Ignora**: Quizzes que já existem (mesmo livro + capítulo + versão)
- ❌ **Erro**: Arquivos com formato inválido ou JSON corrompido

## Saída

O comando exibe:

- 📄 Total de arquivos encontrados
- 📖 Processamento de cada arquivo
- ✅ Quizzes importados com sucesso
- ⏭️ Quizzes ignorados (duplicados)
- ❌ Erros encontrados
- 📊 Resumo final

## Exemplo de execução

```bash
$ node ace import:quizzes

🔧 Inicializando Cloud Storage...
📦 Buscando arquivos no bucket: bibliaquiz-files

📄 Encontrados 150 arquivos JSON

📖 Processando: quizzes/arc-gênesis-1.json
✅ Quiz importado: Gênesis 1 (ARC) - 10 questões

📖 Processando: quizzes/arc-êxodo-1.json
✅ Quiz importado: Êxodo 1 (ARC) - 10 questões

📖 Processando: quizzes/arc-1-samuel-1.json
✅ Quiz importado: 1 Samuel 1 (ARC) - 10 questões

📖 Processando: quizzes/arc-gênesis-2.json
⏭️  Quiz já existe no banco (ID: 42)

==================================================
📊 RESUMO DA IMPORTAÇÃO
==================================================
✅ Importados: 148
⏭️  Ignorados (já existiam): 2
❌ Erros: 0
==================================================
```

## APIs disponíveis após importação

### Listar quizzes

```bash
GET /quizzes
GET /quizzes?testament=old
GET /quizzes?bookName=Gênesis
GET /quizzes?bibleVersion=NVI
```

### Buscar quiz específico

```bash
GET /quizzes/:id
```

### Gerar novo quiz

```bash
POST /generate-quiz
{
  "bookName": "Gênesis",
  "chapter": "1",
  "bibleVersion": "NVI"
}
```

## Troubleshooting

### Erro: Credenciais não configuradas

Configure `GCS_CREDENTIALS` e `GCS_BUCKET_NAME` no `.env`

### Erro: Formato de arquivo inválido

Os arquivos devem estar na pasta `quizzes/` e seguir o formato:

- `versao-livro-capitulo.json` (ex: `arc-gênesis-1.json`)
- `versao-numero-livro-capitulo.json` (ex: `arc-1-samuel-1.json`)

Aceita acentos e URL encoding automaticamente.

### Erro: JSON inválido

Valide o conteúdo do arquivo JSON em https://jsonlint.com/
