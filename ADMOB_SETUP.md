# Configuração do Google AdMob - Bíblia em Foco

## ✅ Arquivos Configurados

### 1. **app-ads.txt** (Raiz do projeto)
Arquivo criado com o snippet fornecido pelo Google:
```
google.com, pub-5942901200629242, DIRECT, f08c47fec0942fa0
```

**Importante**: Este arquivo precisa ser publicado na raiz do seu **site de desenvolvedor** (ex: `seudominio.com/app-ads.txt`), não apenas no projeto React Native.

### 2. **app.json**
Configurado com:
- `android.config.googleMobileAdsAppId`: ID do app Android
- Plugin `react-native-google-mobile-ads` com IDs para Android/iOS

### 3. **Componente AdBanner** (`components/AdBanner.tsx`)
- Banner adaptativo
- Modo de teste automático em desenvolvimento (`__DEV__`)
- Logs para debug

### 4. **Tela Inicial** (`app/(tabs)/index.tsx`)
- Banner de anúncio adicionado após a seção "Leitura de Hoje"

### 5. **Serviço de Anúncios** (`services/AdService.ts`)
- Inicialização centralizada do AdMob
- Chamado no `_layout.tsx` principal

## 📋 Próximos Passos

### 1. Obter IDs Reais do AdMob

Atualmente os IDs no código são placeholders. Você precisa:

1. Acessar [Google AdMob Console](https://apps.admob.com/)
2. Criar/acessar seu app
3. Obter os IDs reais:
   - **App ID Android**: `ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY`
   - **Banner Ad Unit ID**: `ca-app-pub-XXXXXXXXXXXXXXXX/ZZZZZZZZZZ`

4. Substituir nos arquivos:

**`app.json`** (linha ~26 e plugin):
```json
"config": {
  "googleMobileAdsAppId": "ca-app-pub-5942901200629242~SEU_APP_ID_REAL"
}
```

```json
[
  "react-native-google-mobile-ads",
  {
    "androidAppId": "ca-app-pub-5942901200629242~SEU_APP_ID_REAL",
    "iosAppId": "ca-app-pub-5942901200629242~SEU_IOS_APP_ID"
  }
]
```

**`components/AdBanner.tsx`** (linha ~8):
```typescript
const adUnitId = __DEV__ 
  ? TestIds.BANNER 
  : Platform.OS === 'android' 
    ? 'ca-app-pub-5942901200629242/SEU_BANNER_AD_UNIT_ID' 
    : 'ca-app-pub-5942901200629242/SEU_IOS_BANNER_ID';
```

### 2. Publicar app-ads.txt

1. Acesse o domínio registrado no Google Play Console
2. Faça upload do arquivo `app-ads.txt` na raiz do site
3. Certifique-se que está acessível em: `seudominio.com/app-ads.txt`
4. Aguarde o Google validar (pode levar algumas horas)

### 3. Recompilar o App

Após configurar os IDs reais:

```bash
# Limpar build anterior
cd android
./gradlew clean
cd ..

# Recompilar
npx expo prebuild --clean
cd android && ./gradlew bundleRelease
```

### 4. Testar em Modo Desenvolvimento

Durante desenvolvimento, o app usa automaticamente IDs de teste do Google:
- Anúncios aparecem normalmente
- Não gera receita
- Não viola políticas do AdMob

### 5. Validar em Produção

1. Publique o AAB no Google Play
2. No AdMob Console, verifique:
   - Status do app: "Ativo"
   - Solicitações de anúncios aparecendo
   - Taxa de preenchimento
3. Monitore métricas nos primeiros dias

## 🎯 Localização dos Anúncios

Atualmente configurado apenas na **tela inicial** (`app/(tabs)/index.tsx`), após a seção "Leitura de Hoje".

### Para adicionar em outras telas:

1. Importe o componente:
```typescript
import AdBanner from '../../components/AdBanner';
```

2. Adicione onde desejar:
```tsx
<AdBanner />
```

## ⚠️ Avisos Importantes

1. **Não clique nos próprios anúncios** - viola políticas do Google
2. **Use IDs de teste em desenvolvimento** - já configurado com `__DEV__`
3. **Aguarde aprovação do app-ads.txt** - pode levar até 24h
4. **Respeite limites de anúncios** - não sobrecarregue o app

## 🔍 Debug

Para ver logs dos anúncios:
```bash
npx react-native log-android
# ou
npx react-native log-ios
```

Procure por tags:
- `[AdBanner]` - Componente de banner
- `[AdMob]` - Inicialização do serviço

## 📚 Documentação

- [Google AdMob](https://admob.google.com/)
- [react-native-google-mobile-ads](https://docs.page/invertase/react-native-google-mobile-ads)
- [app-ads.txt Spec](https://iabtechlab.com/ads-txt/)

## 🐛 Problemas Comuns

### "Ad failed to load"
- Verifique se os IDs estão corretos
- Confirme que o app foi aprovado no AdMob
- Aguarde algumas horas após primeira configuração

### Anúncios não aparecem
- Em dev, use IDs de teste (já configurado)
- Em produção, verifique se app está ativo no AdMob
- Confirme que app-ads.txt foi validado

### Erro de compilação
```bash
cd android
./gradlew clean
cd ..
npx expo prebuild --clean
```
