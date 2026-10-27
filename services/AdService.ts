// Serviço de inicialização do AdMob
// Requer um build nativo com o SDK AdMob, não disponível no Expo Go
import Constants from 'expo-constants';
import { isRunningInExpoGo } from 'expo';
import { Platform, TurboModuleRegistry } from 'react-native';

export function isAdMobAvailable() {
  if (
    (Platform.OS !== 'android' && Platform.OS !== 'ios') ||
    isRunningInExpoGo()
  ) {
    return false;
  }

  // get() retorna null sem lançar o erro de getEnforcing() usado pelo SDK.
  return TurboModuleRegistry.get('RNGoogleMobileAdsModule') != null;
}

export async function initializeAds() {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
    return;
  }

  // Verifica se está rodando em Expo Go
  const isExpoGo = isRunningInExpoGo();
  
  console.log('[AdMob] Tentando inicializar...', {
    isExpoGo,
    appOwnership: Constants.appOwnership,
    isDev: __DEV__,
  });
  
  if (isExpoGo) {
    console.log('[AdMob] ⏭️  Pulando inicialização no Expo Go - será inicializado em production build');
    return;
  }

  try {
    if (!isAdMobAvailable()) {
      console.log('[AdMob] Módulo nativo ausente neste build; anúncios desativados.');
      return;
    }

    // Só importa o SDK quando o módulo já existe no binário nativo.
    const mobileAds = require('react-native-google-mobile-ads')?.default;

    if (typeof mobileAds !== 'function') {
      console.warn('[AdMob] SDK indisponível neste build. Use um build nativo com react-native-google-mobile-ads.');
      return;
    }
    
    const adapterStatuses = await mobileAds().initialize();
    
    console.log('[AdMob] ✅ Inicializado com sucesso');
    console.log('[AdMob] Status dos adaptadores:', JSON.stringify(adapterStatuses, null, 2));
    
    return adapterStatuses;
  } catch (error) {
    console.warn('[AdMob] Não foi possível inicializar os anúncios; o app continuará sem AdMob:', error);
  }
}

export default { initializeAds };
