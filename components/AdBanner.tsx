import React, { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';

// IDs de anúncio (use TestIds durante desenvolvimento)
const adUnitId = __DEV__ 
  ? TestIds.BANNER 
  : Platform.OS === 'android' 
    ? 'ca-app-pub-5942901200629242/XXXXXXXXXX' // Substitua pelo ID real do AdMob
    : 'ca-app-pub-5942901200629242/YYYYYYYYYY';

interface AdBannerProps {
  size?: BannerAdSize;
}

export default function AdBanner({ size = BannerAdSize.ANCHORED_ADAPTIVE_BANNER }: AdBannerProps) {
  const [adLoaded, setAdLoaded] = useState(false);

  useEffect(() => {
    console.log('[AdBanner] Componente montado, ID:', adUnitId);
  }, []);

  return (
    <View style={{ 
      alignItems: 'center', 
      justifyContent: 'center',
      marginVertical: 10,
      minHeight: adLoaded ? undefined : 50,
    }}>
      <BannerAd
        unitId={adUnitId}
        size={size}
        requestOptions={{
          requestNonPersonalizedAdsOnly: false,
        }}
        onAdLoaded={() => {
          console.log('[AdBanner] Anúncio carregado com sucesso');
          setAdLoaded(true);
        }}
        onAdFailedToLoad={(error) => {
          console.error('[AdBanner] Erro ao carregar anúncio:', error);
        }}
      />
    </View>
  );
}
