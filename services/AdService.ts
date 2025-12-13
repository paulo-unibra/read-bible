// Serviço de inicialização do AdMob
// Funciona apenas em production build, não em Expo Go
import Constants from 'expo-constants';

export async function initializeAds() {
  // Verifica se está rodando em Expo Go
  const isExpoGo = Constants.appOwnership === 'expo';
  
  if (isExpoGo) {
    console.log('[AdMob] Pulando inicialização no Expo Go - será inicializado em production build');
    return;
  }

  try {
    // Importa dinamicamente para evitar erro em Expo Go
    const mobileAds = require('react-native-google-mobile-ads').default;
    await mobileAds().initialize();
    console.log('[AdMob] Inicializado com sucesso');
  } catch (error) {
    console.log('[AdMob] Erro ao inicializar:', error);
  }
}

export default { initializeAds };
