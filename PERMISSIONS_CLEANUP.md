# Limpeza de Permissões do Android

## Contexto
O Google Play estava solicitando justificativa para permissões de fotos e vídeos que não eram utilizadas pelo app.

## Análise Realizada
Verifiquei todo o código do app e identifiquei que:

### ❌ Permissões Removidas (NÃO utilizadas)
1. `READ_MEDIA_IMAGES` - App não acessa imagens
2. `READ_MEDIA_VIDEO` - App não acessa vídeos
3. `READ_MEDIA_VISUAL_USER_SELECTED` - App não acessa mídia selecionada pelo usuário
4. `RECORD_AUDIO` - App só reproduz áudio, não grava
5. `READ_CALENDAR` - `react-native-calendars` só usa UI, não acessa calendário do sistema
6. `WRITE_CALENDAR` - Não utilizado
7. `READ_EXTERNAL_STORAGE` - Não necessário (API 33+)
8. `WRITE_EXTERNAL_STORAGE` - Não necessário (API 33+)
9. `SYSTEM_ALERT_WINDOW` - Removido (era para debug)

### ✅ Permissões Mantidas (NECESSÁRIAS)
1. `INTERNET` - Comunicação com API e AdMob
2. `MODIFY_AUDIO_SETTINGS` - Player de áudio da Harpa Cristã
3. `READ_MEDIA_AUDIO` - Reprodução de arquivos de áudio dos hinos
4. `VIBRATE` - Feedback tátil na interface

## Bibliotecas Analisadas
- `expo-calendar`: Instalada mas **não utilizada** no código
- `react-native-calendars`: Usada apenas para **UI do calendário**, não acessa o calendário do sistema

## Mudanças Realizadas
1. Removidas 9 permissões desnecessárias do `AndroidManifest.xml`
2. Mantidas apenas 4 permissões essenciais para o funcionamento do app
3. Versão incrementada: 1.0.15 → 1.0.16 (versionCode 15 → 16)

## Arquivo Modificado
- `android/app/src/main/AndroidManifest.xml`

## Próximos Passos
1. ✅ Gerar novo AAB com as permissões corrigidas (v1.0.16)
2. Upload do AAB para Google Play Console
3. O Google Play não deve mais solicitar justificativa para permissões de mídia

## Benefícios
- ✅ Menor solicitação de permissões ao usuário
- ✅ Maior privacidade
- ✅ Conformidade com políticas do Google Play
- ✅ Melhor reputação do app na Play Store
