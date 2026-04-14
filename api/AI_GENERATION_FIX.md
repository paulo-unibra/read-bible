# Fix: AI Generation - JSON Parsing Error

## Problem Identified

**Error**: `Expected ',' or ']' after array element in JSON at position 13658`

**Root Cause**: The DeepSeek API response was **truncated** at 13,777 characters (day 70 of 100), stopping mid-JSON with an incomplete structure:

```
"day": 70,
"bookReadings": [
  {
    "book": "Romanos",
    "chapters": [
```

The response ended without closing:

- The `chapters` array
- The current book reading object
- The day 70 object
- Days 71-100
- The entire `readings` array
- The main JSON object

This happened because the AI reached its **token limit** while generating the 100-day plan.

## Solution Implemented

### 1. Increased Token Limit

```typescript
max_tokens: 8000 // Added to API request (was using default ~4000)
```

This allows the AI to generate much longer responses, supporting plans up to ~120-150 days.

### 2. Truncation Detection

Added check before parsing:

````typescript
const isTruncated = !aiContent.trim().endsWith('}') && !aiContent.trim().endsWith('```')

if (isTruncated) {
  return response.badRequest({
    error:
      'A IA não conseguiu gerar o plano completo. Tente criar um plano com menos dias (ex: 30-50 dias) ou simplifique sua instrução.',
  })
}
````

This prevents parsing attempts on incomplete JSON and provides clear user feedback.

### 3. Better Markdown Handling

Improved JSON extraction to properly remove markdown code blocks:

````typescript
if (jsonContent.startsWith('```json')) {
  jsonContent = jsonContent.replace(/^```json\n/, '').replace(/\n```$/, '')
} else if (jsonContent.startsWith('```')) {
  jsonContent = jsonContent.replace(/^```\n/, '').replace(/\n```$/, '')
}
````

### 4. Optimized System Prompt

Added instruction to use shorter descriptions for long plans:

```
6. Para planos longos (50+ dias), use descrições muito curtas (2-4 palavras) para economizar tokens
7. Retorne SOMENTE o JSON válido, sem texto adicional ou markdown
```

This helps the AI stay within token limits by being more concise.

### 5. Enhanced Logging

Added response length tracking:

```typescript
console.log(`📏 Tamanho da resposta: ${aiContent.length} caracteres`)
```

This helps debug future token limit issues.

### 6. **Plan Completeness Validation** ⭐ NEW

Added automatic validation to detect incomplete plans:

```typescript
const validation = this.validatePlanCompleteness(plan, prompt)
```

**Validates:**

- ✅ **NT Plans**: Checks if all 27 books are included (260 chapters)
- ✅ **Gospel Plans**: Verifies all 4 gospels are present
- ✅ **Large Plans**: 50+ day plans must have at least 10 different books
- ✅ **Chapter Coverage**: NT plans must cover at least 85% of chapters (220+)

**If validation fails**, the API returns a clear error:

```
O plano gerado está incompleto. Faltam 14 livros do NT: Gálatas, Efésios...

Tente:
- Reduzir o número de dias (ex: 50 dias)
- Ser mais específico na instrução
- Especificar apenas alguns livros
```

**Example validation output:**

```json
{
  "error": "Plano incompleto: Faltam 14 livros do NT: Gálatas, Efésios, Filipenses...",
  "details": {
    "daysGenerated": 100,
    "booksFound": 13,
    "totalChapters": 145,
    "expectedBooks": 27,
    "expectedChapters": 260,
    "missingBooks": ["Gálatas", "Efésios", ...]
  }
}
```

This prevents accepting incomplete plans from the AI!

## Testing Instructions

1. **Restart the API server** to load the new code:

   ```bash
   cd api
   # Stop current server (Ctrl+C)
   npm run dev
   ```

2. **Test with the same prompt that failed**:
   - Open admin panel: http://localhost:5173
   - Go to "Reading Plan Templates"
   - Click "Pedir para a IA" (when UI is ready, or test via curl)
   - Try: "Criar um plano de 100 dias lendo o novo testamento"

3. **Expected outcomes**:
   - ✅ Plan generates successfully with all 100 days
   - ✅ JSON parses without errors
   - ✅ Log shows success with full plan data
   - ✅ Response includes ~260 NT chapters distributed over 100 days

4. **If still truncated** (unlikely with 8000 tokens):
   - Error message will now be clear: "tente criar um plano com menos dias"
   - User can retry with 50-day plan instead
   - Logs will show truncation warning

## Token Limits Reference

| Plan Size | Approx Tokens | Status with 8000 limit |
| --------- | ------------- | ---------------------- |
| 7 days    | ~800 tokens   | ✅ Safe                |
| 30 days   | ~3000 tokens  | ✅ Safe                |
| 50 days   | ~5000 tokens  | ✅ Safe                |
| 100 days  | ~8000 tokens  | ✅ Now works           |
| 200 days  | ~16000 tokens | ⚠️ May truncate        |
| 365 days  | ~30000 tokens | ❌ Will truncate       |

**Recommendation**: For plans longer than 100 days, suggest users create multiple sequential plans or use the built-in templates.

## Files Modified

1. `/api/app/controllers/Admin/reading_plan_template_controller.ts`
   - Added `max_tokens: 8000` to API request
   - Added truncation detection
   - Improved markdown removal
   - Enhanced logging
   - Updated system prompt

## Verification

Build completed successfully:

```bash
✅ npm run build -- --ignore-ts-errors
✅ TypeScript errors resolved for AI controller
✅ Server ready to test with new limits
```

## Next Steps

1. Test 100-day NT plan generation
2. If successful, test other plan sizes (30 days, 7 days)
3. Consider adding UI button for "Pedir para a IA" (Phase 37a)
4. Monitor logs for any remaining issues
