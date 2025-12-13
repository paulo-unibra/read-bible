import Constants from 'expo-constants';
import React, { useEffect, useState } from 'react';
import { Platform, Text, View } from 'react-native';

// Componente placeholder que carrega o AdMob apenas em production build
// Em Expo Go, mostra mensagem informativa
let BannerAd: any = null;
let BannerAdSize: any = null;
let TestIds: any = null;

// Verifica se está rodando em ambiente nativo (não Expo Go)
const isExpoGo = Constants.appOwnership === 'expo';

// Tenta importar AdMob apenas se não estiver no Expo Go
if (!isExpoGo) {
  try {
    const AdMobModule = require('react-native-google-mobile-ads');
    BannerAd = AdMobModule.BannerAd;
    BannerAdSize = AdMobModule.BannerAdSize;
    TestIds = AdMobModule.TestIds;
  } catch (error) {
    console.log('[AdBanner] Módulo AdMob não disponível - será carregado em production build');
  }
}

// IDs de anúncio
const adUnitId = __DEV__ 
  ? (TestIds?.BANNER || 'test-banner')
  : Platform.OS === 'android' 
    ? 'ca-app-pub-5942901200629242/4108321222' // ID real do bloco de anúncios
    : 'ca-app-pub-5942901200629242/4108321222';

interface AdBannerProps {
  size?: any;
}

export default function AdBanner({ size }: AdBannerProps) {
  const [adLoaded, setAdLoaded] = useState(false);

  useEffect(() => {
    if (BannerAd) {
      console.log('[AdBanner] Componente montado, ID:', adUnitId);
    }
  }, []);

  // Se o módulo não estiver disponível (Expo Go), renderiza placeholder
  if (!BannerAd) {
    return (
      <View style={{ 
        alignItems: 'center', 
        justifyContent: 'center',
        marginHorizontal: 16,
        marginVertical: 12,
        height: 50,
        backgroundColor: '#f0f0f0',
        borderRadius: 8,
        borderWidth: 2,
        borderColor: '#d0d0d0',
        borderStyle: 'dashed',
      }}>
        <Text style={{ 
          color: '#888', 
          fontSize: 13,
          fontWeight: '600',
        }}>
          📢 Espaço reservado para anúncio
        </Text>
      </View>
    );
  }

  const bannerSize = size || BannerAdSize.ANCHORED_ADAPTIVE_BANNER;

  return (
    <View style={{ 
      alignItems: 'center', 
      justifyContent: 'center',
      marginVertical: 10,
      minHeight: adLoaded ? undefined : 50,
    }}>
      <BannerAd
        unitId={adUnitId}
        size={bannerSize}
        requestOptions={{
          requestNonPersonalizedAdsOnly: false,
        }}
        onAdLoaded={() => {
          console.log('[AdBanner] Anúncio carregado com sucesso');
          setAdLoaded(true);
        }}
        onAdFailedToLoad={(error: any) => {
          console.error('[AdBanner] Erro ao carregar anúncio:', error);
        }}
      />
    </View>
  );
}
