# 📥 Importação de Planos de Leitura via JSON

## Como Usar

1. No painel admin, acesse **Planos de Leitura**
2. Clique em **+ Criar Plano**
3. Clique no botão **📥 Importar JSON**
4. Selecione seu arquivo JSON

Os dados do JSON preencherão automaticamente o formulário e você poderá revisar/editar antes de salvar.

---

## Formato do JSON

### Estrutura Completa

```json
{
  "name": "Nome do Plano",
  "description": "Descrição do plano de leitura",
  "type": "annual",
  "duration": 365,
  "testament": "both",
  "isActive": true,
  "order": 0,
  "readings": [
    {
      "day": 1,
      "bookReadings": [
        {
          "book": "Genesis",
          "chapters": [1, 2, 3]
        }
      ],
      "description": "Descrição opcional do dia"
    }
  ]
}
```

---

## Campos Obrigatórios

### Campos Principais

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `name` | string | ✅ Sim | Nome do plano de leitura |
| `description` | string | ✅ Sim | Descrição detalhada |
| `readings` | array | ✅ Sim | Lista de leituras diárias |

### Campos Opcionais

| Campo | Tipo | Padrão | Valores Aceitos | Descrição |
|-------|------|--------|----------------|-----------|
| `type` | string | `"custom"` | `annual`, `custom`, `sequential`, `thematic` | Tipo do plano |
| `duration` | number | `readings.length` | qualquer número positivo | Duração em dias |
| `testament` | string | `"both"` | `old`, `new`, `both` | Testamento(s) |
| `isActive` | boolean | `true` | `true`, `false` | Se o plano está ativo |
| `order` | number | `0` | qualquer número | Ordem de exibição |

---

## Estrutura de Leituras

### Campos da Leitura

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `day` | number | Recomendado | Número do dia (será auto-incrementado se omitido) |
| `bookReadings` | array | ✅ Sim | Lista de livros/capítulos do dia |
| `description` | string | Não | Descrição opcional do dia |

### Campos do Book Reading

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `book` | string | ✅ Sim | Nome do livro bíblico |
| `chapters` | array | ✅ Sim | Lista de números dos capítulos |

---

## Exemplos

### Exemplo Simples (Mínimo)

```json
{
  "name": "Plano Básico",
  "description": "Um plano simples",
  "readings": [
    {
      "bookReadings": [
        {
          "book": "Genesis",
          "chapters": [1]
        }
      ]
    }
  ]
}
```

### Exemplo com Múltiplos Livros por Dia

```json
{
  "name": "Plano AT + NT",
  "description": "Leitura combinada do Antigo e Novo Testamento",
  "type": "sequential",
  "duration": 365,
  "testament": "both",
  "readings": [
    {
      "day": 1,
      "bookReadings": [
        {
          "book": "Genesis",
          "chapters": [1, 2]
        },
        {
          "book": "Mateus",
          "chapters": [1]
        },
        {
          "book": "Salmos",
          "chapters": [1]
        }
      ],
      "description": "Início da criação e início do evangelho"
    }
  ]
}
```

### Exemplo Anual Completo

```json
{
  "name": "Leitura Bíblica Anual",
  "description": "Leia toda a Bíblia em 1 ano",
  "type": "annual",
  "duration": 365,
  "testament": "both",
  "isActive": true,
  "order": 1,
  "readings": [
    {
      "day": 1,
      "bookReadings": [
        {
          "book": "Genesis",
          "chapters": [1, 2, 3]
        }
      ],
      "description": "Criação e queda"
    },
    {
      "day": 2,
      "bookReadings": [
        {
          "book": "Genesis",
          "chapters": [4, 5, 6]
        }
      ],
      "description": "Caim e Abel, genealogias"
    }
  ]
}
```

---

## Nomes de Livros Aceitos

Use os nomes em português dos livros bíblicos:

### Antigo Testamento
- Genesis, Exodo, Levitico, Numeros, Deuteronomio
- Josue, Juizes, Rute
- 1Samuel, 2Samuel, 1Reis, 2Reis
- 1Cronicas, 2Cronicas
- Esdras, Neemias, Ester
- Jo, Salmos, Proverbios, Eclesiastes, Cantares
- Isaias, Jeremias, Lamentacoes, Ezequiel, Daniel
- Oseias, Joel, Amos, Obadias, Jonas, Miqueias, Naum, Habacuque, Sofonias, Ageu, Zacarias, Malaquias

### Novo Testamento
- Mateus, Marcos, Lucas, Joao
- Atos
- Romanos, 1Corintios, 2Corintios, Galatas, Efesios, Filipenses, Colossenses
- 1Tessalonicenses, 2Tessalonicenses
- 1Timoteo, 2Timoteo, Tito, Filemom
- Hebreus, Tiago, 1Pedro, 2Pedro
- 1Joao, 2Joao, 3Joao, Judas
- Apocalipse

---

## Validações

O sistema valida automaticamente:

✅ Presença dos campos obrigatórios  
✅ Formato correto do JSON  
✅ Array de readings não vazio  
✅ BookReadings com livro e capítulos  

⚠️ **Atenção:** Após importar, você pode revisar e editar qualquer campo antes de salvar o plano.

---

## Dicas

1. **Teste com arquivo pequeno primeiro**: Crie um JSON com 2-3 dias para testar
2. **Use o exemplo fornecido**: `exemplo-plano-leitura.json` como base
3. **Copie e adapte**: Duplique readings existentes e altere os valores
4. **Valide o JSON**: Use ferramentas online como jsonlint.com para validar sintaxe
5. **Salve backups**: Antes de importar um plano grande, salve uma cópia

---

## Conversão de Outros Formatos

### De CSV para JSON

Se você tem um CSV com formato:
```
Day,Book,Chapters
1,Genesis,"1,2,3"
2,Genesis,"4,5"
```

Você pode converter para JSON usando Python:

```python
import csv
import json

readings = []
with open('plano.csv') as f:
    reader = csv.DictReader(f)
    for row in reader:
        readings.append({
            "day": int(row['Day']),
            "bookReadings": [{
                "book": row['Book'],
                "chapters": [int(c) for c in row['Chapters'].split(',')]
            }]
        })

plan = {
    "name": "Plano Importado",
    "description": "Convertido de CSV",
    "readings": readings
}

with open('plano.json', 'w') as f:
    json.dump(plan, f, indent=2, ensure_ascii=False)
```

---

## Troubleshooting

### Erro: "JSON inválido"
- Verifique se todas as aspas estão corretas
- Confirme que não há vírgulas extras no final
- Use um validador JSON online

### Erro: "deve conter 'name' e 'readings'"
- Certifique-se que os campos obrigatórios existem
- Verifique a grafia dos campos (case-sensitive)

### Importação funciona mas dados estão errados
- Revise o formato dos arrays de chapters
- Confirme os nomes dos livros bíblicos
- Edite manualmente após importar se necessário

---

## Suporte

Para mais informações ou dúvidas, consulte a documentação do projeto ou entre em contato com a equipe de desenvolvimento.
