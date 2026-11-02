const { withAndroidManifest, withAppBuildGradle, withDangerousMod, withMainApplication } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");
const SERVICE_NAME = ".vpn.BehiNetVpnService";

function withBehiNetVpn(config) {
  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    manifest["uses-permission"] = manifest["uses-permission"] || [];
    for (const name of ["android.permission.INTERNET","android.permission.FOREGROUND_SERVICE","android.permission.FOREGROUND_SERVICE_SPECIAL_USE","android.permission.POST_NOTIFICATIONS"]) {
      if (!manifest["uses-permission"].some((p) => p.$?.["android:name"] === name)) {
        manifest["uses-permission"].push({ $: { "android:name": name } });
      }
    }
    const app = manifest.application?.[0];
    if (!app) throw new Error("No application node");
    app.service = app.service || [];
    if (!app.service.some((s) => s.$?.["android:name"] === SERVICE_NAME)) {
      app.service.push({
        $: { "android:name": SERVICE_NAME, "android:permission": "android.permission.BIND_VPN_SERVICE", "android:exported": "false", "android:foregroundServiceType": "specialUse" },
        "intent-filter": [{ action: [{ $: { "android:name": "android.net.VpnService" } }] }],
      });
    }
    return config;
  });

  config = withAppBuildGradle(config, (config) => {
    let c = config.modResults.contents;
    if (!c.includes('implementation files("libs/libbox.aar")')) {
      c += `\n dependencies { implementation files("libs/libbox.aar") }\n`;
    }
    if (!c.includes('abiFilters "arm64-v8a"')) {
      c += `\n android { defaultConfig { ndk { abiFilters "arm64-v8a", "armeabi-v7a" } } }\n`;
    }
    config.modResults.contents = c;
    return config;
  });

  config = withMainApplication(config, (config) => {
    const pkg = config.android?.package;
    if (!pkg) return config;
    let c = config.modResults.contents;
    const imp = `import ${pkg}.vpn.BehiNetVpnPackage`;
    if (!c.includes("BehiNetVpnPackage")) {
      const p = c.match(/^package\s+[^\r\n]+\r?\n/m);
      if (p) c = c.replace(p[0], `${p[0]}${imp}\n`);
      const m = "PackageList(this).packages.apply {";
      if (c.includes(m)) c = c.replace(m, `${m}\n            add(BehiNetVpnPackage())`);
    }
    config.modResults.contents = c;
    return config;
  });

  return withDangerousMod(config, ["android", async (config) => {
    const pkg = config.android?.package;
    if (!pkg) return config;
    const aarSrc = path.join(config.modRequest.projectRoot, "native/android/libs/libbox.aar");
    if (!fs.existsSync(aarSrc)) throw new Error("libbox.aar missing");
    const aarDst = path.join(config.modRequest.platformProjectRoot, "app/libs");
    fs.mkdirSync(aarDst, { recursive: true });
    fs.copyFileSync(aarSrc, path.join(aarDst, "libbox.aar"));

    const ktSrc = path.join(config.modRequest.projectRoot, "native/android/src");
    if (!fs.existsSync(ktSrc)) throw new Error("Kotlin src missing");
    const ktDst = path.join(config.modRequest.platformProjectRoot, "app/src/main/java", ...pkg.split("."), "vpn");
    fs.mkdirSync(ktDst, { recursive: true });
    for (const f of fs.readdirSync(ktSrc)) {
      if (!f.endsWith(".kt")) continue;
      const txt = fs.readFileSync(path.join(ktSrc, f), "utf8").replaceAll("__BEHINET_PACKAGE__", pkg);
      fs.writeFileSync(path.join(ktDst, f), txt);
    }
    return config;
  }]);
}
module.exports = withBehiNetVpn;
