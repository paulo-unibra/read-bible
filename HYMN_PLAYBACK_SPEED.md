# Controle de Velocidade de Reprodução - Hinos da Harpa

## Funcionalidade Implementada

Adicionado controle de velocidade de reprodução para os áudios dos hinos da Harpa Cristã, permitindo que o usuário ajuste a velocidade conforme sua preferência.

## Características

### Opções de Velocidade

- **0.5x** - Metade da velocidade (mais lento)
- **0.75x** - 75% da velocidade
- **1.0x** - Velocidade normal (padrão)
- **1.25x** - 25% mais rápido
- **1.5x** - 50% mais rápido

### Interface do Usuário

O controle de velocidade está localizado no player expandido do hino, abaixo dos controles principais (play/pause/stop):

```
┌─────────────────────────────────┐
│  ⚪ Controles de reprodução    │
│                                 │
│  ⚡ Velocidade: [1.0x]         │
│                                 │
│  ━━━━━━━━━━ Barra de progresso │
└─────────────────────────────────┘
```

- **Ícone**: Velocímetro (speedometer-outline)
- **Label**: "Velocidade:"
- **Botão**: Mostra a velocidade atual (ex: "1.0x")
- **Ação**: Toque no botão para alternar entre as velocidades de forma cíclica

### Comportamento

1. **Alternância Cíclica**: Ao tocar no botão, a velocidade muda para a próxima opção:
   - 0.5x → 0.75x → 1.0x → 1.25x → 1.5x → 0.5x (recomeça)

2. **Persistência**: A velocidade selecionada é mantida durante:
   - Pause/Play
   - Busca na timeline (seek)
   - Parada e reinício

3. **Novo Carregamento**: Ao carregar novos áudios, se houver uma velocidade diferente de 1.0x selecionada, ela é automaticamente aplicada

4. **Correção de Pitch**: A velocidade é aplicada COM correção de pitch (`shouldCorrectPitch: true`), mantendo o tom original da música

## Implementação Técnica

### Arquivos Modificados

#### 1. `/app/hymn-viewer.tsx`

**Estado adicionado:**

```typescript
const [playbackRate, setPlaybackRate] = useState(1.0);
```

**Função de controle:**

```typescript
const handlePlaybackRateChange = async () => {
  const rates = [0.5, 0.75, 1.0, 1.25, 1.5];
  const currentIndex = rates.indexOf(playbackRate);
  const nextRate = rates[(currentIndex + 1) % rates.length];

  try {
    await hymnAudioService.setPlaybackRateAll(audioTracks, nextRate);
    setPlaybackRate(nextRate);
  } catch (error) {
    console.error("Erro ao alterar velocidade:", error);
  }
};
```

**Componente UI:**

```tsx
<View style={styles.speedControl}>
  <Ionicons name="speedometer-outline" size={16} color={colors.textSecondary} />
  <Text style={[styles.speedLabel, { color: colors.textSecondary }]}>
    Velocidade:
  </Text>
  <TouchableOpacity
    onPress={handlePlaybackRateChange}
    style={[styles.speedButton, { backgroundColor: colors.accent }]}
  >
    <Text style={styles.speedButtonText}>{playbackRate}x</Text>
  </TouchableOpacity>
</View>
```

#### 2. `/services/HymnAudioService.ts`

**Nova função:**

```typescript
async setPlaybackRateAll(tracks: HymnAudioTrack[], rate: number): Promise<void> {
  console.log(`⚡ [HymnAudioService] Alterando velocidade para ${rate}x...`);

  const loadedTracks = tracks.filter(t => t.sound && t.isLoaded);

  try {
    await Promise.all(
      loadedTracks.map(async (track) => {
        try {
          await track.sound!.setRateAsync(rate, true); // true = pitch correction
          console.log(`✅ [HymnAudioService] ${track.instrument} velocidade alterada para ${rate}x`);
        } catch (error) {
          console.error(`❌ [HymnAudioService] Erro ao alterar velocidade de ${track.instrument}:`, error);
        }
      })
    );

    console.log(`✅ [HymnAudioService] Velocidade de todos os áudios alterada para ${rate}x`);
  } catch (error) {
    console.error(`❌ [HymnAudioService] Erro ao alterar velocidade:`, error);
    throw error;
  }
}
```

### Estilos CSS

```typescript
speedControl: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  marginBottom: 12,
  paddingHorizontal: 16,
},
speedLabel: {
  fontSize: 14,
},
speedButton: {
  paddingHorizontal: 16,
  paddingVertical: 8,
  borderRadius: 20,
  minWidth: 60,
  alignItems: 'center',
},
speedButtonText: {
  color: '#fff',
  fontSize: 14,
  fontWeight: '600',
},
```

## API do Expo AV Utilizada

```typescript
sound.setRateAsync(rate: number, shouldCorrectPitch: boolean)
```

**Parâmetros:**

- `rate`: Taxa de reprodução (0.5 a 2.0 são valores comuns)
- `shouldCorrectPitch`: `true` mantém o tom original, `false` altera o tom

## Casos de Uso

1. **Aprendizado**: Diminuir velocidade (0.5x ou 0.75x) para aprender hinos novos
2. **Acompanhamento**: Velocidade normal (1.0x) para cantar junto
3. **Prática**: Aumentar velocidade (1.25x ou 1.5x) para desafios ou quando familiar

## Notas Importantes

- ✅ Funciona com múltiplas faixas simultaneamente (voz, teclado, etc.)
- ✅ Mantém sincronização entre as faixas
- ✅ Não altera o tom da música (pitch correction ativado)
- ✅ Funciona tanto com áudios em cache quanto em streaming
- ✅ Design responsivo com tema claro/escuro

## Testado

- [x] Alternância entre velocidades
- [x] Manutenção da velocidade ao pausar/retomar
- [x] Aplicação da velocidade em novos carregamentos
- [x] Sincronização com múltiplas faixas
- [x] Interface responsiva

## Versão

Data de implementação: 23 de janeiro de 2026
