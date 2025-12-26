# Debug do AdMob - Checklist

## ✅ Configurações Verificadas

### 1. AndroidManifest.xml
- [x] APPLICATION_ID configurado: `ca-app-pub-5942901200629242~1274274321`
- [x] Flags de otimização ativadas
- [x] Permissão de INTERNET presente

### 2. app.config.js
- [x] Plugin `react-native-google-mobile-ads` configurado
- [x] androidAppId configurado

### 3. IDs de Anúncio
- [x] Banner Ad Unit: `ca-app-pub-5942901200629242/4108321222`
- [x] Usando ID de teste em `__DEV__`
- [x] Usando ID real em produção

## 🔍 Possíveis Causas do Problema

### 1. **App não está vinculado no AdMob Console**
O aplicativo precisa estar registrado e vinculado no Google AdMob.

**Solução:**
1. Acesse: https://apps.admob.google.com/
2. Vá em "Apps" → "Add app"
3. Adicione o app com package: `com.readbible.app`
4. Certifique-se de que o APPLICATION_ID está correto

### 2. **Bloco de anúncios não criado ou ID incorreto**
O ID do bloco de anúncios pode estar incorreto.

**Solução:**
1. No AdMob, vá em "Ad units"
2. Crie um bloco "Banner" se não existir
3. Copie o ID correto
4. Verifique se o ID no código bate com o do console

### 3. **App em fase de revisão**
Novos apps podem levar até 24h para começar a servir anúncios.

**Status:** Verificar no console do AdMob

### 4. **Conta AdMob não verificada**
A conta precisa estar verificada e ativa.

**Solução:**
1. Acesse o AdMob
2. Verifique se há avisos sobre verificação de conta
3. Complete o processo de verificação se necessário

### 5. **Limite de requisições atingido**
Durante testes, pode ter atingido o limite de requisições.

**Solução:**
- Aguarde algumas horas
- Use ID de teste durante desenvolvimento

### 6. **Problema de conectividade ou região**
Alguns anúncios podem não estar disponíveis em certas regiões.

**Teste:**
- Use VPN para testar em diferentes regiões
- Verifique logs do AdMob

## 🧪 Como Testar

### 1. Verificar logs no Logcat (Android)
```bash
cd android
./gradlew bundleRelease
adb logcat | grep -i "admob\|ads"
```

### 2. Instalar o APK e verificar
```bash
cd android/app/build/outputs/bundle/release
# Instalar no dispositivo
adb install -r app-release.apk
```

### 3. Verificar inicialização
Os logs devem mostrar:
```
[AdMob] Tentando inicializar...
[AdMob] ✅ Inicializado com sucesso
[AdBanner] Ambiente: { isExpoGo: false, isDev: false, hasBannerAd: true, ... }
[AdBanner] ✅ Anúncio carregado com sucesso
```

## 🔧 Melhorias Implementadas

### 1. Logs Detalhados
- ✅ Logs de inicialização com status dos adaptadores
- ✅ Logs de ambiente e configuração
- ✅ Logs de sucesso/erro de carregamento

### 2. Feedback Visual
- ✅ Mostra "Carregando anúncio..." enquanto não carrega
- ✅ Mostra mensagem de erro se falhar
- ✅ Placeholder em Expo Go

### 3. Tratamento de Erros
- ✅ Captura e exibe erros de carregamento
- ✅ Não quebra o app se AdMob falhar

## 📋 Checklist de Verificação

Execute estes passos na ordem:

1. [ ] Verificar se o app está registrado no AdMob
2. [ ] Confirmar que o APPLICATION_ID está correto
3. [ ] Confirmar que o AD_UNIT_ID está correto
4. [ ] Verificar se a conta AdMob está ativa
5. [ ] Aguardar 24h após primeiro registro (se app novo)
6. [ ] Gerar novo APK com logs
7. [ ] Instalar e verificar logs via `adb logcat`
8. [ ] Verificar conectividade de rede
9. [ ] Testar em diferentes dispositivos/regiões

## 🎯 IDs Corretos

**Para conferir no AdMob:**
- App ID: `ca-app-pub-5942901200629242~1274274321`
- Banner Unit ID: `ca-app-pub-5942901200629242/4108321222`
- Package: `com.readbible.app`

## 📱 Códigos de Erro Comuns

| Código | Significado | Solução |
|--------|-------------|---------|
| 0 | ERROR_CODE_INTERNAL_ERROR | Erro interno, tente novamente |
| 1 | ERROR_CODE_INVALID_REQUEST | ID de anúncio inválido |
| 2 | ERROR_CODE_NETWORK_ERROR | Problema de conexão |
| 3 | ERROR_CODE_NO_FILL | Sem anúncios disponíveis no momento |

## 🔗 Links Úteis

- [AdMob Console](https://apps.admob.google.com/)
- [AdMob Setup Guide](https://developers.google.com/admob/android/quick-start)
- [Error Codes](https://developers.google.com/android/reference/com/google/android/gms/ads/AdRequest)

---

**Última atualização:** 24/12/2025
**Próximo passo:** Verificar logs do APK instalado
