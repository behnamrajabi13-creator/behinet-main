import { NativeModules, Platform } from "react-native";

const getBridge = () => {
  if (Platform.OS === "web") return null;
  return NativeModules.BehiNetVpnEngine;
};

export const connectVpn = async (configJson: string) => {
  const bridge = getBridge();
  if (!bridge) throw new Error("Native module not found");
  await bridge.start(configJson);
};

export const disconnectVpn = async () => {
  const bridge = getBridge();
  if (!bridge) throw new Error("Native module not found");
  await bridge.stop();
};
