#!/bin/bash
set -e

echo "Creating lib/vpn directory..."
mkdir -p lib/vpn

echo "Creating native-engine.ts..."
cat > lib/vpn/native-engine.ts << 'ENDOFFILE'
import { NativeModules, Platform } from "react-native";

type NativeBridge = {
  prepare?: () => Promise<boolean>;
  start: (payload: string) => Promise<void>;
  stop: () => Promise<void>;
};

const getBridge = () => {
  if (Platform.OS === "web") return null;
  return (NativeModules as any).BehiNetVpnEngine as NativeBridge | null;
};

export const NativeVpnEngine = {
  available: () => Boolean(getBridge()?.start && getBridge()?.stop),
  async connect(configJson: string) {
    const bridge = getBridge();
    if (!bridge?.start) throw new Error("Native VPN engine not available");
    if (bridge.prepare) {
      const ready = await bridge.prepare();
      if (!ready) throw new Error("VPN permission required");
    }
    await bridge.start(configJson);
  },
  async disconnect() {
    const bridge = getBridge();
    if (!bridge?.stop) throw new Error("Native VPN engine not available");
    await bridge.stop();
  },
};
ENDOFFILE

echo "Creating parser.ts..."
cat > lib/vpn/parser.ts << 'ENDOFFILE'
export const convertSubscriptionToSingBox = (lines: string[]): string => {
  // This is a simplified placeholder. In production, you'd parse vless/vmess/trojan URIs.
  const outbounds = lines.map((line, i) => {
    return { type: "direct", tag: `proxy-${i}` };
  });
  return JSON.stringify({
    log: { level: "info" },
    inbounds: [{ type: "tun", address: ["172.19.0.1/30"], auto_route: true, strict_route: true }],
    outbounds: [...outbounds, { type: "direct", tag: "direct" }],
    route: { auto_detect_interface: true, final: outbounds[0]?.tag ?? "direct" },
  });
};
ENDOFFILE

echo "Creating plugins dir..."
mkdir -p plugins
cat > plugins/with-behinet-vpn.js << 'ENDOFFILE'
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
ENDOFFILE

echo "Creating native Kotlin stubs..."
mkdir -p native/android/src
cat > native/android/src/BehiNetVpnService.kt << 'ENDOFFILE'
package __BEHINET_PACKAGE__.vpn
import android.net.VpnService
import android.content.Intent
import android.os.ParcelFileDescriptor

class BehiNetVpnService : VpnService() {
    private var tunFd: ParcelFileDescriptor? = null
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int) = START_STICKY
    override fun onDestroy() { tunFd?.close(); tunFd = null; super.onDestroy() }
}
ENDOFFILE

cat > native/android/src/BehiNetVpnEngineModule.kt << 'ENDOFFILE'
package __BEHINET_PACKAGE__.vpn
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
class BehiNetVpnEngineModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
    override fun getName() = "BehiNetVpnEngine"
}
ENDOFFILE

cat > native/android/src/BehiNetVpnPackage.kt << 'ENDOFFILE'
package __BEHINET_PACKAGE__.vpn
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager
class BehiNetVpnPackage : ReactPackage {
    override fun createNativeModules(c: ReactApplicationContext): List<NativeModule> = listOf(BehiNetVpnEngineModule(c))
    override fun createViewManagers(c: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
ENDOFFILE

mkdir -p native/android/libs
echo "Copying libbox.aar from other project..."
cp /g/BEHI/behinet-native/native/android/libs/libbox.aar native/android/libs/libbox.aar || echo "Warning: libbox.aar not found in previous project"

echo "Adding plugin to app.config.ts..."
sed -i 's/plugins: \[/plugins: [\n    ".\/plugins\/with-behinet-vpn",/' app.config.ts

echo "DONE. Now commit and push."
