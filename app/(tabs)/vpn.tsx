import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { connectVpn, disconnectVpn } from "../../lib/vpn/vpn-connector";
import { NativeVpnEngine } from "../../lib/vpn/native-engine";

const C = {
  ink: "#102D2B",
  teal: "#256A68",
  mint: "#80C6A4",
  paper: "#F6F5EF",
  card: "#FFFFFF",
  muted: "#71817B",
  lime: "#D8F56B",
  danger: "#BC5149",
  pale: "#ECF2E9",
};

export default function VpnScreen() {
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);

  const onToggle = async () => {
    if (connected) {
      setConnecting(true);
      try {
        await disconnectVpn();
        setConnected(false);
      } catch (e) {
        Alert.alert("خطا", e instanceof Error ? e.message : "قطع اتصال انجام نشد");
      } finally {
        setConnecting(false);
      }
      return;
    }

    setConnecting(true);
    try {
      // در اینجا باید کانفیگ را از سرور انتخاب‌شده بسازیم
      const dummyConfig = JSON.stringify({
        log: { level: "info" },
        inbounds: [{ type: "tun", address: ["172.19.0.1/30"], auto_route: true, strict_route: true }],
        outbounds: [{ type: "direct", tag: "direct" }],
        route: { auto_detect_interface: true, final: "direct" },
      });
      await connectVpn(dummyConfig);
      setConnected(true);
    } catch (e) {
      Alert.alert("خطا", e instanceof Error ? e.message : "اتصال انجام نشد");
    } finally {
      setConnecting(false);
    }
  };

  const nativeAvailable = NativeVpnEngine.available();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>اتصال VPN</Text>
        <Text style={styles.subtitle}>برای اتصال، دکمه زیر را فشار دهید</Text>

        {!nativeAvailable && (
          <View style={styles.warnBox}>
            <Text style={styles.warnTitle}>موتور VPN نصب نشده</Text>
            <Text style={styles.warnText}>
              این نسخه از برنامه فاقد موتور VPN است. لطفاً از نسخه کامل استفاده کنید.
            </Text>
          </View>
        )}

        <Pressable
          onPress={onToggle}
          disabled={connecting || !nativeAvailable}
          style={[styles.button, { opacity: (!nativeAvailable || connecting) ? 0.5 : 1 }]}
        >
          {connecting ? (
            <ActivityIndicator size="small" color={C.ink} />
          ) : (
            <Ionicons
              name={connected ? "power" : "power-outline"}
              size={24}
              color={C.ink}
            />
          )}
          <Text style={styles.buttonText}>
            {connecting ? "در حال اتصال..." : connected ? "قطع اتصال" : "اتصال"}
          </Text>
        </Pressable>

        <View style={styles.statusCard}>
          <View style={[styles.dot, { backgroundColor: connected ? C.mint : C.muted }]} />
          <Text style={styles.statusText}>{connected ? "متصل" : "قطع"}</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.paper },
  container: { flex: 1, padding: 20, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 24, fontWeight: "800", marginBottom: 8 },
  subtitle: { fontSize: 14, color: C.muted, marginBottom: 40 },
  button: { flexDirection: "row", alignItems: "center", backgroundColor: C.mint, paddingHorizontal: 40, paddingVertical: 15, borderRadius: 999, gap: 10 },
  buttonText: { fontSize: 18, fontWeight: "700", color: C.ink },
  statusCard: { flexDirection: "row", alignItems: "center", marginTop: 30, gap: 8, backgroundColor: C.card, paddingHorizontal: 15, paddingVertical: 10, borderRadius: 999 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { fontSize: 14, color: C.ink, fontWeight: "600" },
  warnBox: { backgroundColor: "#F9EAE7", padding: 15, borderRadius: 12, marginBottom: 20, width: "100%" },
  warnTitle: { color: C.danger, fontWeight: "700", marginBottom: 4 },
  warnText: { color: C.danger, fontSize: 12 },
});
