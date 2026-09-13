# Audio com tela bloqueada

## Causa e correcao

No Android 15+ (apps com target SDK 35+), solicitar foco de audio exige
que o app esteja em primeiro plano ou tenha um foreground service ativo.
O player anterior usava expo-av e liberava o foco ao descarregar cada
capitulo. Uma notificacao comum de expo-notifications nao satisfaz essa
exigencia. Alterar DuckOthers ou repetir playAsync nao corrige isso.

O AudioService agora usa expo-audio 1.1.1, compativel com Expo SDK 54.
Ele ativa os controles nativos na primeira reproducao e mantem o mesmo
player/MediaSession ao substituir a fonte do capitulo. Apenas parar ou
sair do leitor remove os controles e libera a sessao de audio.
O expo-av continua instalado para a Harpa e gravacoes, que nao foram migradas.

## Build obrigatorio

Esta mudanca adiciona um modulo nativo. Recarregar o Metro ou atualizar
somente o JavaScript de um APK antigo nao instala o novo servico.

Para um APK de teste usando o perfil existente:

```sh
npx eas-cli build --platform android --profile apk
```

Para desenvolvimento local com aparelho conectado:

```sh
npm run android
```

Nao usar Expo Go como validacao de background. Instalar o novo build no
aparelho e iniciar a reproducao com o app aberto antes de bloquear a tela.

## Teste no aparelho

1. Em Android 15 ou superior, iniciar um capitulo e confirmar os controles
   nativos de midia na notificacao.
2. Avancar para alguns segundos antes do final, bloquear a tela e esperar
   o proximo capitulo tocar sem desbloquear. Repetir por tres capitulos.
3. Testar tambem a passagem do ultimo capitulo de um livro para outro.
4. Repetir com audio do Drive e BibleBrain, com e sem o proximo arquivo
   previamente baixado. Verificar que os metadados acompanham o capitulo.
5. Pausar e retomar pela notificacao com a tela bloqueada. Confirmar que
   pausar perto do fim nao avanca sozinho e desbloquear nao pula capitulos.
6. Parar durante um download ou sair do leitor: o audio nao deve comecar
   depois e os controles de midia devem desaparecer.
7. Verificar uma interrupcao por chamada/outro app de midia, sem forcar
   reproducao durante a chamada. Repetir o fluxo basico em Android anterior
   ao 15 e iOS; no iOS, verificar tambem replay e liberacao da sessao ao parar.

Diagnostico opcional com ADB durante a reproducao:

```sh
adb shell dumpsys activity services com.readbible.app
adb shell dumpsys media_session
adb logcat -v time AudioModule:V AudioService:V ReactNativeJS:V AndroidRuntime:E '*:S'
```

O servico esperado e `expo.modules.audio.service.AudioControlsService`,
com foreground ativo. A transicao ainda depende do callback JavaScript do
leitor; esta correcao nao implementa fila nativa nem reproducao apos o
usuario encerrar o app/processo.

## Verificacoes automatizadas

```sh
npm run test:audio
npx eslint services/AudioService.ts app.config.js
```

Os testes usam mocks dos modulos nativos e cobrem persistencia do player,
ativacao e liberacao da sessao, eventos atrasados de capitulos anteriores,
conversao de segundos para milissegundos, termino unico, replay iOS,
cancelamento durante download e falha/timeout ao iniciar reproducao.
Eles nao substituem o teste de tela bloqueada em um build nativo.
