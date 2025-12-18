const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withAndroidManifestFix(config) {
  return withAndroidManifest(config, async (config) => {
    const mainApplication = config.modResults.manifest.application[0];
    
    // Remove a meta-data que causa conflito
    if (mainApplication['meta-data']) {
      mainApplication['meta-data'] = mainApplication['meta-data'].filter(
        (metaData) => {
          const name = metaData.$?.['android:name'];
          return name !== 'com.google.android.gms.ads.DELAY_APP_MEASUREMENT_INIT';
        }
      );
    }
    
    return config;
  });
};
