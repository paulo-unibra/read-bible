# Correção da Assinatura Android

## Problema

O comando `npx expo prebuild --clean` sobrescreve o `build.gradle` e usa a keystore de debug ao invés da keystore de produção, causando erro no Play Store.

## Solução Aplicada

### 1. ✅ Configuração do build.gradle corrigida

O arquivo `android/app/build.gradle` foi atualizado para usar a keystore de produção:

```gradle
signingConfigs {
    debug {
        storeFile file('debug.keystore')
        storePassword 'android'
        keyAlias 'androiddebugkey'
        keyPassword 'android'
    }
    release {
        if (project.hasProperty('MYAPP_UPLOAD_STORE_FILE')) {
            storeFile file(MYAPP_UPLOAD_STORE_FILE)
            storePassword MYAPP_UPLOAD_STORE_PASSWORD
            keyAlias MYAPP_UPLOAD_KEY_ALIAS
            keyPassword MYAPP_UPLOAD_KEY_PASSWORD
        }
    }
}
buildTypes {
    debug {
        signingConfig signingConfigs.debug
    }
    release {
        signingConfig signingConfigs.release // CORRIGIDO: antes era debug
        // ... resto das configurações
    }
}
```

### 2. ✅ Credenciais no gradle.properties

As credenciais já estavam corretas em `android/gradle.properties`:

```properties
MYAPP_UPLOAD_STORE_FILE=../../upload-keystore.jks
MYAPP_UPLOAD_KEY_ALIAS=upload
MYAPP_UPLOAD_STORE_PASSWORD=z8618190
MYAPP_UPLOAD_KEY_PASSWORD=z8618190
```

## Como Evitar o Problema no Futuro

### Opção 1: NÃO USE `--clean` (Recomendado)

Ao invés de:

```bash
npx expo prebuild --clean
```

Use apenas:

```bash
npx expo prebuild
```

O `--clean` apaga tudo e regenera do zero. Use apenas em casos extremos.

### Opção 2: Versione a pasta android

Remova `/android` do `.gitignore` e commite as configurações:

1. Edite `.gitignore` e remova a linha `/android`
2. Commit as configurações do Android:

```bash
git add android/
git commit -m "chore: versionar configurações Android"
```

**Vantagens:**

- Configurações preservadas entre rebuilds
- Histórico de mudanças
- Menos chance de perder configurações importantes

**Desvantagens:**

- Mais arquivos no repositório
- Possíveis conflitos em merge

### Opção 3: Script de pós-prebuild

Crie um script que restaura as configurações após o prebuild:

```bash
# scripts/fix-android-signing.sh
#!/bin/bash

# Backup das configurações
if [ ! -f "android/app/build.gradle.backup" ]; then
    cp android/app/build.gradle android/app/build.gradle.backup
fi

# Restaurar após prebuild
cp android/app/build.gradle.backup android/app/build.gradle
```

## Verificação da Assinatura

Para verificar se o App Bundle está usando a keystore correta:

```bash
cd android
./gradlew bundleRelease

# Verificar impressão digital
keytool -printcert -jarfile app/build/outputs/bundle/release/app-release.aab
```

Deve mostrar:

```
SHA1: 45:0E:A7:EC:64:97:F2:50:94:2F:73:DC:D6:5B:4B:37:3D:05:80:81
```

## Build para Produção

Comando correto para gerar o App Bundle:

```bash
cd android
./gradlew bundleRelease
```

O arquivo será gerado em:

```
android/app/build/outputs/bundle/release/app-release.aab
```

## Notas Importantes

- ✅ A configuração já foi corrigida
- ✅ Próximos builds usarão a keystore correta
- ⚠️ Evite `prebuild --clean` a menos que seja absolutamente necessário
- ⚠️ Se usar `--clean`, você precisará reconfigurar o `build.gradle` manualmente

## Comandos Úteis

```bash
# Build release (recomendado)
cd android && ./gradlew bundleRelease

# Limpar build sem apagar configurações
cd android && ./gradlew clean

# Verificar keystore
keytool -list -v -keystore upload-keystore.jks -alias upload
```
