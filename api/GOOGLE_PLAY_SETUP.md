# Integração com Google Play Developer Reporting API

## Configuração

### 1. Criar Service Account no Google Cloud Console

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/)
2. Selecione ou crie um projeto
3. Vá em **IAM & Admin** > **Service Accounts**
4. Clique em **Create Service Account**
5. Configure:
   - **Service account name**: `play-store-reporting`
   - **Service account ID**: `play-store-reporting@seu-projeto.iam.gserviceaccount.com`
   - **Description**: Service account para acessar Google Play Developer Reporting API

### 2. Gerar Chave JSON

1. Após criar o service account, clique nele
2. Vá em **Keys** > **Add Key** > **Create new key**
3. Selecione **JSON**
4. Baixe o arquivo JSON

### 3. Habilitar API

1. No Google Cloud Console, vá em **APIs & Services** > **Library**
2. Procure por **Google Play Developer Reporting API**
3. Clique em **Enable**

### 4. Configurar Permissões no Google Play Console

1. Acesse o [Google Play Console](https://play.google.com/console)
2. Vá em **Configurações** > **API access**
3. Em **Service Accounts**, encontre o service account criado
4. Clique em **Grant access**
5. Selecione as permissões:
   - ✅ **View app information and download bulk reports (read-only)**
   - ✅ **View financial data, orders, and cancellation survey responses**
   - ✅ **Reply to reviews**

### 5. Configurar Variáveis de Ambiente

Adicione no arquivo `.env` do backend:

```env
# Google Play Developer Reporting API
GOOGLE_PLAY_CREDENTIALS='{"type":"service_account","project_id":"seu-projeto","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"play-store-reporting@seu-projeto.iam.gserviceaccount.com","client_id":"105809800147633488379","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"https://www.googleapis.com/robot/v1/metadata/x509/play-store-reporting%40seu-projeto.iam.gserviceaccount.com"}'

# Package name do seu app no Google Play
GOOGLE_PLAY_PACKAGE_NAME=com.biblia.foco
```

**Importante**: Cole o conteúdo completo do arquivo JSON em uma única linha, entre aspas simples.

### 6. Instalar Dependências

No backend, instale a biblioteca do Google APIs:

```bash
cd api
npm install googleapis
```

## Estrutura de Arquivos Criados

### Backend

- **`app/services/google_play_reporting_service.ts`**: Service principal que se comunica com a API do Google Play
- **`app/controllers/Admin/play_store_reports_controller.ts`**: Controller para expor endpoints de relatórios
- **`start/routes.ts`**: Rotas adicionadas para acessar os relatórios

### Frontend Admin

- **`pages/Reports.tsx`**: Página atualizada com seção de estatísticas do Google Play Store
- **`pages/Reports.css`**: Estilos atualizados com botões de período e cards danger

## Endpoints Disponíveis

### GET /admin/reports/play-store/general
Retorna estatísticas gerais (instalações, crashes, ANRs) para um período

**Query Params:**
- `days` (opcional, padrão: 30): Número de dias para buscar estatísticas

**Response:**
```json
{
  "success": true,
  "data": {
    "period": {
      "startDate": "2025-12-06",
      "endDate": "2026-01-04",
      "days": 30
    },
    "installs": {
      "totals": {
        "installs": 1500,
        "uninstalls": 200,
        "updates": 800,
        "installEvents": 2500
      },
      "timeline": [...]
    },
    "crashes": {
      "averages": {
        "crashRate": 0.5,
        "crashRatePerUserPercent": 0.3
      },
      "totals": {
        "distinctCrashes": 10
      },
      "timeline": [...]
    },
    "anrs": {
      "averages": {
        "anrRate": 0.2,
        "anrRatePerUserPercent": 0.1
      },
      "totals": {
        "distinctAnrs": 5
      },
      "timeline": [...]
    }
  }
}
```

### GET /admin/reports/play-store/installs
Retorna apenas métricas de instalações

**Query Params:**
- `startDate` (obrigatório): Data inicial no formato YYYY-MM-DD
- `endDate` (obrigatório): Data final no formato YYYY-MM-DD

### GET /admin/reports/play-store/crashes
Retorna apenas métricas de crashes

**Query Params:**
- `startDate` (obrigatório): Data inicial no formato YYYY-MM-DD
- `endDate` (obrigatório): Data final no formato YYYY-MM-DD

### GET /admin/reports/play-store/anrs
Retorna apenas métricas de ANRs

**Query Params:**
- `startDate` (obrigatório): Data inicial no formato YYYY-MM-DD
- `endDate` (obrigatório): Data final no formato YYYY-MM-DD

## Métricas Disponíveis

### Instalações
- **Instalações**: Número total de instalações do app
- **Desinstalações**: Número total de desinstalações
- **Atualizações**: Número total de atualizações
- **Instalações Líquidas**: Instalações - Desinstalações

### Estabilidade
- **Crashes Distintos**: Número de crashes únicos reportados
- **Taxa de Crash**: Porcentagem de sessões que resultaram em crash
- **ANRs Distintos**: Número de ANRs (Application Not Responding) únicos
- **Taxa de ANR**: Porcentagem de sessões que resultaram em ANR

## Visualização no Admin

No painel admin, acesse **Relatórios** e visualize:

1. **Estatísticas de Usuários** (backend interno)
2. **Estatísticas de Planos de Leitura** (backend interno)
3. **Estatísticas de Questionários** (backend interno)
4. **📱 Estatísticas do Google Play Store** (novo)
   - Selecione o período: 7, 30 ou 90 dias
   - Veja instalações, desinstalações, atualizações
   - Monitore estabilidade: crashes e ANRs

## Troubleshooting

### Erro "403 Forbidden"
- Verifique se o service account tem permissões no Google Play Console
- Confirme se a API está habilitada no Google Cloud Console

### Erro "Invalid credentials"
- Verifique se o JSON das credenciais está correto no `.env`
- Confirme se não há quebras de linha indevidas no JSON

### Dados não aparecem
- O Google Play pode ter delay de até 48h para disponibilizar dados
- Verifique se o package name está correto
- Confirme se há dados suficientes no período selecionado

## Recursos Adicionais

- [Google Play Developer Reporting API Documentation](https://developers.google.com/play/developer/reporting)
- [Service Account Authentication](https://cloud.google.com/docs/authentication/production)
- [Google Play Console API Access](https://support.google.com/googleplay/android-developer/answer/6112435)
