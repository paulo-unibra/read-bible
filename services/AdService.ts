// Serviço de inicialização do AdMob
// Funciona apenas em production build, não em Expo Go
import Constants from 'expo-constants';

export async function initializeAds() {
  // Verifica se está rodando em Expo Go
  const isExpoGo = Constants.appOwnership === 'expo';
  
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
    // Importa dinamicamente para evitar erro em Expo Go
    const mobileAds = require('react-native-google-mobile-ads').default;
    
    const adapterStatuses = await mobileAds().initialize();
    
    console.log('[AdMob] ✅ Inicializado com sucesso');
    console.log('[AdMob] Status dos adaptadores:', JSON.stringify(adapterStatuses, null, 2));
    
    return adapterStatuses;
  } catch (error) {
    console.error('[AdMob] ❌ Erro ao inicializar:', error);
    throw error;
  }
}

export default { initializeAds };
