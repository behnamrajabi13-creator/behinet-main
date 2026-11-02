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
