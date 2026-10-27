const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("node:fs/promises");
const path = require("node:path");

const marker = "# Preserve the WorkManager Room constructor used through reflection.";
const rule = `${marker}
-keep class androidx.work.impl.WorkDatabase_Impl {
    public <init>();
}
`;

module.exports = function withWorkManagerProguardFix(config) {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const rulesPath = path.join(
        config.modRequest.platformProjectRoot,
        "app",
        "proguard-rules.pro",
      );
      const contents = await fs.readFile(rulesPath, "utf8");
      if (!contents.includes(marker)) {
        await fs.writeFile(rulesPath, `${contents}\n${rule}`);
      }
      return config;
    },
  ]);
};
