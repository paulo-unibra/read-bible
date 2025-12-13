import mobileAds from 'react-native-google-mobile-ads';

export async function initializeAds() {
  try {
    await mobileAds().initialize();
    console.log('[AdMob] Inicializado com sucesso');
  } catch (error) {
    console.error('[AdMob] Erro ao inicializar:', error);
  }
}

export default { initializeAds };
