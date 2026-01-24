import Constants from "expo-constants";
import React, { useEffect, useState } from "react";
import { Platform, Text, View } from "react-native";

// Componente placeholder que carrega o AdMob apenas em production build
// Em Expo Go, mostra mensagem informativa
let BannerAd: any = null;
let BannerAdSize: any = null;
let TestIds: any = null;

// Verifica se está rodando em ambiente nativo (não Expo Go)
const isExpoGo = Constants.appOwnership === "expo";

// Tenta importar AdMob apenas se não estiver no Expo Go
if (!isExpoGo) {
  try {
    const AdMobModule = require("react-native-google-mobile-ads");
    BannerAd = AdMobModule.BannerAd;
    BannerAdSize = AdMobModule.BannerAdSize;
    TestIds = AdMobModule.TestIds;
  } catch (error) {
    console.log(
      "[AdBanner] Módulo AdMob não disponível - será carregado em production build",
    );
  }
}

interface AdBannerProps {
  size?: any;
  adUnitId?: string; // ID customizado do bloco de anúncio
}

export default function AdBanner({
  size,
  adUnitId: customAdUnitId,
}: AdBannerProps) {
  const [adLoaded, setAdLoaded] = useState(false);
  const [adError, setAdError] = useState<string | null>(null);

  // Usar ID customizado se fornecido, senão usa o padrão (Home)
  const adUnitId =
    customAdUnitId ||
    (__DEV__
      ? TestIds?.BANNER || "test-banner"
      : Platform.OS === "android"
        ? "ca-app-pub-5942901200629242/1666856687" // ID real do bloco de anúncios Home
        : "ca-app-pub-5942901200629242/1666856687");

  useEffect(() => {
    console.log("[AdBanner] Ambiente:", {
      isExpoGo,
      isDev: __DEV__,
      hasBannerAd: !!BannerAd,
      adUnitId,
      platform: Platform.OS,
    });
  }, []);

  // Se o módulo não estiver disponível (Expo Go), renderiza placeholder
  if (!BannerAd) {
    return (
      <View
        style={{
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 16,
          paddingVertical: 8,
          height: 50,
          backgroundColor: "#f0f0f0",
          borderTopWidth: 2,
          borderColor: "#d0d0d0",
          borderStyle: "dashed",
        }}
      >
        <Text
          style={{
            color: "#888",
            fontSize: 13,
            fontWeight: "600",
          }}
        >
          📢 Espaço reservado para anúncio
        </Text>
        <Text style={{ color: "#999", fontSize: 10, marginTop: 4 }}>
          {isExpoGo ? "Expo Go" : "Módulo não carregado"}
        </Text>
      </View>
    );
  }

  const bannerSize = size || BannerAdSize.ANCHORED_ADAPTIVE_BANNER;

  return (
    <View
      style={{
        alignItems: "center",
        justifyContent: "center",
        minHeight: 50,
        width: "100%",
        backgroundColor: "#fff",
      }}
    >
      {!adLoaded && !adError && (
        <View style={{ padding: 10 }}>
          <Text style={{ color: "#999", fontSize: 12 }}>
            Carregando anúncio...
          </Text>
        </View>
      )}
      {adError && (
        <View
          style={{
            padding: 8,
            backgroundColor: "#f0f0f0",
            width: "100%",
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#666", fontSize: 10, textAlign: "center" }}>
            Nenhum anúncio disponível no momento
          </Text>
        </View>
      )}
      <BannerAd
        unitId={adUnitId}
        size={bannerSize}
        requestOptions={{
          requestNonPersonalizedAdsOnly: false,
        }}
        onAdLoaded={() => {
          console.log("[AdBanner] ✅ Anúncio carregado com sucesso");
          setAdLoaded(true);
          setAdError(null);
        }}
        onAdFailedToLoad={(error: any) => {
          const errorCode = error?.code;
          const errorMsg = error?.message || JSON.stringify(error);

          // Código 3 = NO_FILL (sem anúncios disponíveis)
          if (errorCode === 3) {
            console.log(
              "[AdBanner] ℹ️  Nenhum anúncio disponível no momento (NO_FILL)",
            );
            setAdError("NO_FILL");
          } else {
            console.error("[AdBanner] ❌ Erro ao carregar anúncio:", errorMsg);
            setAdError(errorMsg);
          }
        }}
      />
    </View>
  );
}
