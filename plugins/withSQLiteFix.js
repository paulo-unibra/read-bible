const { withPodfile } = require("@expo/config-plugins");

module.exports = function withSQLiteFix(config) {
  return withPodfile(config, (config) => {
    const podfileContent = config.modResults.contents;

    // Add SQLite pod if not already present
    if (!podfileContent.includes("pod 'sqlite3'")) {
      config.modResults.contents = podfileContent.replace(
        /use_expo_modules!/,
        `use_expo_modules!
  
  # Fix SQLite3 issues
  pod 'sqlite3', '3.46.1', :modular_headers => true`,
      );
    }

    return config;
  });
};
