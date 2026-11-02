import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { Pressable, StyleSheet } from "react-native";

export function VpnFab() {
  return (
    <Link href="/(tabs)/vpn" asChild>
      <Pressable style={styles.fab}>
        <Ionicons name="shield-checkmark" size={24} color="#102D2B" />
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#80C6A4",
    alignItems: "center",
    justifyContent: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
});
