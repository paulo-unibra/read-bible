module.exports = ({ config }) => {
  return {
    ...config,
    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        {
          image: './assets/images/splash-icon.png',
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: '#ffffff',
          dark: {
            backgroundColor: '#000000',
          },
        },
      ],
      [
        'react-native-google-mobile-ads',
        {
          androidAppId: 'ca-app-pub-5942901200629242~1274274321',
          iosAppId: 'ca-app-pub-5942901200629242~1274274321',
        },
      ],
      './plugins/withAndroidManifestFix',
    ],
  };
};
