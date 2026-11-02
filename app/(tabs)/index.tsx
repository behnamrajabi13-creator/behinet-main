import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState, type ComponentProps } from "react";
import {
  ActivityIndicator,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  addSubscription,
  deleteSubscription,
  getActiveSubscriptionId,
  loadSubscriptions,
  refreshSubscription,
  setActiveSubscriptionId,
  updateSubscriptionStats,
  validateSubscriptionInput,
  type SubscriptionProfile,
} from "@/lib/local-subscriptions";

const C = {
  ink: "#102D2B",
  teal: "#256A68",
  mint: "#80C6A4",
  paper: "#F6F5EF",
  card: "#FFFFFF",
  muted: "#71817B",
  line: "#E4E8DF",
  lime: "#D8F56B",
  danger: "#BC5149",
  pale: "#ECF2E9",
};
const STORE_URL = "http://behinet.xyz/panel/sale";
const TELEGRAM_URL = "https://t.me/behi_net";
const GENERATED_MARK = "/manus-storage/async-images/4tohxgyIU9KHtS6gI3p9YI/image-1.webp";

function FText({ children, style, ...rest }: ComponentProps<typeof Text>) {
  return (
    <Text {...rest} style={[styles.rtlText, style]}>
      {children}
    </Text>
  );
}

function BrandIcon({ size = 40 }: { size?: number }) {
  const [remoteFailed, setRemoteFailed] = useState(false);
  const source = Platform.OS === "web" && !remoteFailed
    ? { uri: GENERATED_MARK }
    : require("../../assets/images/icon.png");
  return (
    <Image
      source={source}
      onError={() => setRemoteFailed(true)}
      resizeMode="contain"
      style={{ width: size, height: size, borderRadius: Math.max(10, size * 0.28), backgroundColor: C.ink }}
    />
  );
}

function MenuGlyph() {
  return (
    <View style={styles.menuGlyph}>
      <View style={[styles.menuLine, { width: 20 }]} />
      <View style={[styles.menuLine, { width: 15 }]} />
      <View style={[styles.menuLine, { width: 20 }]} />
    </View>
  );
}

export default function HomeScreen() {
  const [profiles, setProfiles] = useState<SubscriptionProfile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SubscriptionProfile | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const [loaded, selected] = await Promise.all([
          loadSubscriptions(),
          getActiveSubscriptionId(),
        ]);
        if (!mounted) return;
        setProfiles(loaded);
        setActiveId(selected && loaded.some((item) => item.id === selected) ? selected : loaded[0]?.id ?? null);
      } catch {
        if (mounted) setNotice("ذخیره‌سازی در دسترس نیست. دوباره برنامه را باز کن.");
      } finally {
        if (mounted) setReady(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(""), 4200);
    return () => clearTimeout(timeout);
  }, [notice]);

  const activeProfile = useMemo(
    () => profiles.find((profile) => profile.id === activeId) ?? null,
    [activeId, profiles],
  );

  const haptic = (kind: "success" | "selection" = "selection") => {
    if (Platform.OS === "web") return;
    if (kind === "success") {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    } else {
      void Haptics.selectionAsync().catch(() => undefined);
    }
  };

  const openExternal = async (url: string) => {
    setMenuOpen(false);
    try {
      await Linking.openURL(url);
    } catch {
      setNotice("باز کردن پیوند ممکن نشد. اتصال اینترنت را بررسی کن.");
    }
  };

  const openAdd = () => {
    setNameInput("");
    setUrlInput("");
    setFormError("");
    setAddOpen(true);
    haptic();
  };

  const submitSubscription = async () => {
    const issue = validateSubscriptionInput(urlInput);
    if (issue) {
      setFormError(issue);
      return;
    }
    if (profiles.some((item) => item.url.trim() === urlInput.trim())) {
      setFormError("این لینک قبلاً اضافه شده است.");
      return;
    }
    setSaving(true);
    Keyboard.dismiss();
    try {
      const record = await addSubscription({ name: nameInput, url: urlInput });
      const next = await loadSubscriptions();
      setProfiles(next);
      setActiveId(record.id);
      await setActiveSubscriptionId(record.id);
      setAddOpen(false);
      setNotice("اشتراک روی همین دستگاه ذخیره شد.");
      haptic("success");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "ذخیره‌ی اشتراک انجام نشد.");
    } finally {
      setSaving(false);
    }
  };

  const selectProfile = async (profile: SubscriptionProfile) => {
    setActiveId(profile.id);
    try {
      await setActiveSubscriptionId(profile.id);
    } catch {
      setNotice("انتخاب نشست، در این دستگاه ذخیره نشد.");
    }
    haptic();
  };

  const updateProfile = async (profile: SubscriptionProfile) => {
    if (refreshingId) return;
    setRefreshingId(profile.id);
    try {
      const count = await refreshSubscription(profile);
      const timestamp = new Date().toISOString();
      await updateSubscriptionStats(profile.id, count, timestamp);
      setProfiles((current) =>
        current.map((item) => item.id === profile.id
          ? { ...item, nodeCount: count, lastUpdated: timestamp }
          : item),
      );
      setNotice(`${count.toLocaleString("fa-IR")} سرور در اشتراک پیدا شد.`);
      haptic("success");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "به‌روزرسانی اشتراک انجام نشد.");
    } finally {
      setRefreshingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    try {
      await deleteSubscription(id);
      const next = await loadSubscriptions();
      setProfiles(next);
      if (activeId === id) {
        const newActive = next[0]?.id ?? null;
        setActiveId(newActive);
        await setActiveSubscriptionId(newActive);
      }
      setDeleteTarget(null);
      setNotice("اشتراک از این دستگاه پاک شد.");
      haptic();
    } catch {
      setNotice("حذف اشتراک انجام نشد. دوباره تلاش کن.");
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <StatusBar style="dark" />
      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <View style={styles.brandGroup}>
              <BrandIcon size={42} />
              <View>
                <FText style={styles.brandName}>behinet</FText>
                <FText style={styles.brandCaption}>مدیریت اشتراک، ساده و روشن</FText>
              </View>
            </View>
            <Pressable
              accessibilityLabel="باز کردن منو"
              accessibilityRole="button"
              hitSlop={10}
              onPress={() => setMenuOpen(true)}
              style={({ pressed }) => [styles.menuButton, pressed && styles.pressed]}
            >
              <MenuGlyph />
            </Pressable>
          </View>

          <View style={styles.hero}>
            <View pointerEvents="none" style={styles.heroOrbitOne} />
            <View pointerEvents="none" style={styles.heroOrbitTwo} />
            <View style={styles.heroTopLine}>
              <View style={styles.heroStatus}>
                <View style={styles.statusDot} />
                <FText style={styles.heroStatusText}>مرکز اشتراک‌ها</FText>
              </View>
              <Ionicons name="sparkles-outline" size={19} color={C.lime} />
            </View>
            <FText style={styles.heroTitle}>اشتراک‌هایت،{"\n"}مرتب و یک‌جا</FText>
            <FText style={styles.heroBody}>
              لینک‌ها را روی دستگاهت نگه دار، هر وقت خواستی به‌روزشان کن.
            </FText>
            <Pressable
              accessibilityRole="button"
              onPress={openAdd}
              style={({ pressed }) => [styles.heroCta, pressed && styles.heroCtaPressed]}
            >
              <Ionicons name="add" size={20} color={C.ink} />
              <FText style={styles.heroCtaText}>افزودن اشتراک</FText>
              <Ionicons name="arrow-up" size={16} color={C.ink} />
            </Pressable>
            <FText style={styles.heroFootnote}>پیوندها به سرور behinet فرستاده نمی‌شوند</FText>
          </View>

          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleBlock}>
              <FText style={styles.sectionTitle}>اشتراک‌های من</FText>
              <FText style={styles.sectionCaption}>ذخیره‌شده روی همین دستگاه</FText>
            </View>
            <View style={styles.countPill}>
              <FText style={styles.countText}>{profiles.length.toLocaleString("fa-IR")} مورد</FText>
            </View>
          </View>

          {!ready ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator size="small" color={C.teal} />
              <FText style={styles.loadingText}>در حال خواندن اشتراک‌ها…</FText>
            </View>
          ) : profiles.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}>
                <Ionicons name="link-outline" size={24} color={C.teal} />
              </View>
              <FText style={styles.emptyTitle}>هنوز اشتراکی اینجا نیست</FText>
              <FText style={styles.emptyBody}>اولین لینک را اضافه کن تا فهرستت را بسازیم.</FText>
              <Pressable
                accessibilityRole="button"
                onPress={openAdd}
                style={({ pressed }) => [styles.emptyCta, pressed && styles.pressed]}
              >
                <FText style={styles.emptyCtaText}>افزودن لینک اشتراک</FText>
                <Ionicons name="arrow-up" size={15} color={C.teal} />
              </Pressable>
            </View>
          ) : (
            <View style={styles.profileList}>
              {profiles.map((profile) => {
                const selected = profile.id === activeId;
                const updating = refreshingId === profile.id;
                return (
                  <Pressable
                    key={profile.id}
                    accessibilityRole="button"
                    onPress={() => void selectProfile(profile)}
                    style={({ pressed }) => [
                      styles.profileCard,
                      selected && styles.profileCardSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={styles.profileRow}>
                      <View style={[styles.profileIcon, selected && styles.profileIconSelected]}>
                        <Ionicons name="globe-outline" size={19} color={selected ? C.paper : C.teal} />
                      </View>
                      <View style={styles.profileInfo}>
                        <FText numberOfLines={1} style={styles.profileName}>{profile.name}</FText>
                        <FText numberOfLines={1} style={styles.profileAddress}>{maskAddress(profile.url)}</FText>
                      </View>
                      {selected ? (
                        <View style={styles.selectedBadge}>
                          <Ionicons name="checkmark" size={12} color={C.ink} />
                          <FText style={styles.selectedBadgeText}>انتخاب‌شده</FText>
                        </View>
                      ) : null}
                    </View>
                    <View style={styles.profileFooter}>
                      <View style={styles.nodeSummary}>
                        <View style={styles.nodeDot} />
                        <FText style={styles.nodeText}>
                          {profile.nodeCount.toLocaleString("fa-IR")} سرور شناسایی‌شده
                        </FText>
                      </View>
                      <View style={styles.profileActions}>
                        <Pressable
                          accessibilityLabel="به‌روزرسانی اشتراک"
                          accessibilityRole="button"
                          disabled={Boolean(refreshingId)}
                          onPress={(event) => {
                            event.stopPropagation();
                            void updateProfile(profile);
                          }}
                          style={({ pressed }) => [styles.iconAction, pressed && styles.pressed]}
                        >
                          {updating
                            ? <ActivityIndicator size="small" color={C.teal} />
                            : <Ionicons name="refresh-outline" size={17} color={C.teal} />}
                        </Pressable>
                        <Pressable
                          accessibilityLabel="حذف اشتراک"
                          accessibilityRole="button"
                          onPress={(event) => {
                            event.stopPropagation();
                            setDeleteTarget(profile);
                          }}
                          style={({ pressed }) => [styles.iconAction, pressed && styles.pressed]}
                        >
                          <Ionicons name="trash-outline" size={16} color={C.danger} />
                        </Pressable>
                      </View>
                    </View>
                    {profile.lastUpdated ? (
                      <FText style={styles.updatedAt}>
                        آخرین بررسی: {formatTime(profile.lastUpdated)}
                      </FText>
                    ) : null}
                  </Pressable>
                );
              })}
              <Pressable
                accessibilityRole="button"
                onPress={openAdd}
                style={({ pressed }) => [styles.addAnother, pressed && styles.pressed]}
              >
                <Ionicons name="add-circle-outline" size={19} color={C.teal} />
                <FText style={styles.addAnotherText}>افزودن اشتراک دیگر</FText>
              </Pressable>
            </View>
          )}

          <View style={styles.activePanel}>
            <View style={styles.activePanelIcon}>
              <Ionicons name="radio-outline" size={18} color={C.teal} />
            </View>
            <View style={styles.activePanelCopy}>
              <FText style={styles.activePanelTitle}>اشتراک انتخابی</FText>
              <FText style={styles.activePanelBody}>
                {activeProfile ? activeProfile.name : "با افزودن لینک، فهرستت را شروع کن"}
              </FText>
            </View>
            <View style={styles.offlineBadge}>
              <View style={styles.offlineDot} />
              <FText style={styles.offlineText}>بدون اتصال</FText>
            </View>
          </View>

          <View style={styles.disclosure}>
            <Ionicons name="information-circle-outline" size={17} color={C.muted} />
            <FText style={styles.disclosureText}>
              این نسخه اشتراک‌ها را مدیریت و به‌روزرسانی می‌کند؛ تونل اتصال VPN در این build فعال نیست.
            </FText>
          </View>

          <View style={styles.footerBrand}>
            <View style={styles.footerRule} />
            <FText style={styles.footerText}>بهینت · نسخه ۱٫۰</FText>
            <View style={styles.footerRule} />
          </View>
        </ScrollView>

        {notice ? (
          <View accessibilityLiveRegion="polite" style={styles.notice}>
            <Ionicons name="checkmark-circle-outline" size={18} color={C.lime} />
            <FText style={styles.noticeText}>{notice}</FText>
          </View>
        ) : null}
      </View>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable accessibilityLabel="بستن منو" style={StyleSheet.absoluteFill} onPress={() => setMenuOpen(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View>
                <FText style={styles.sheetTitle}>منوی behinet</FText>
                <FText style={styles.sheetSubTitle}>خرید و راهنمایی</FText>
              </View>
              <Pressable accessibilityLabel="بستن" onPress={() => setMenuOpen(false)} style={styles.closeButton}>
                <Ionicons name="close" size={20} color={C.ink} />
              </Pressable>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => void openExternal(STORE_URL)}
              style={({ pressed }) => [styles.menuOption, pressed && styles.pressed]}
            >
              <View style={[styles.menuOptionIcon, { backgroundColor: "#EDF2E1" }]}>
                <Ionicons name="storefront-outline" size={20} color={C.teal} />
              </View>
              <View style={styles.menuOptionText}>
                <FText style={styles.menuOptionTitle}>فروشگاه</FText>
                <FText style={styles.menuOptionCaption}>مشاهده‌ی پلن‌ها و خرید اشتراک</FText>
              </View>
              <Ionicons name="open-outline" size={16} color={C.muted} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => void openExternal(TELEGRAM_URL)}
              style={({ pressed }) => [styles.menuOption, pressed && styles.pressed]}
            >
              <View style={[styles.menuOptionIcon, { backgroundColor: "#E7F1F2" }]}>
                <Ionicons name="paper-plane-outline" size={19} color={C.teal} />
              </View>
              <View style={styles.menuOptionText}>
                <FText style={styles.menuOptionTitle}>پشتیبانی تلگرام</FText>
                <FText style={styles.menuOptionCaption}>@behi_net</FText>
              </View>
              <Ionicons name="open-outline" size={16} color={C.muted} />
            </Pressable>
            <View style={styles.menuUrlPill}>
              <Ionicons name="lock-closed-outline" size={14} color={C.teal} />
              <FText style={styles.menuUrlPillText}>لینک‌های اشتراک فقط روی دستگاهت می‌مانند</FText>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={addOpen} transparent animationType="slide" onRequestClose={() => setAddOpen(false)}>
        <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <Pressable accessibilityLabel="بستن فرم" style={StyleSheet.absoluteFill} onPress={() => setAddOpen(false)} />
          <View style={styles.formSheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View>
                <FText style={styles.sheetTitle}>افزودن اشتراک</FText>
                <FText style={styles.sheetSubTitle}>اطلاعات روی همین دستگاه ذخیره می‌شود</FText>
              </View>
              <Pressable accessibilityLabel="بستن فرم" onPress={() => setAddOpen(false)} style={styles.closeButton}>
                <Ionicons name="close" size={20} color={C.ink} />
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.formBody}>
              <FText style={styles.fieldLabel}>نام دلخواه</FText>
              <TextInput
                value={nameInput}
                onChangeText={setNameInput}
                placeholder="مثلاً اشتراک شخصی"
                placeholderTextColor="#9AA6A0"
                maxLength={40}
                style={styles.textInput}
                textAlign="right"
                returnKeyType="next"
              />
              <FText style={[styles.fieldLabel, { marginTop: 18 }]}>لینک اشتراک</FText>
              <TextInput
                value={urlInput}
                onChangeText={(value) => {
                  setUrlInput(value);
                  if (formError) setFormError("");
                }}
                placeholder="https://…"
                placeholderTextColor="#9AA6A0"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                textContentType="URL"
                style={[styles.textInput, styles.urlInput]}
                textAlign="left"
                returnKeyType="done"
                onSubmitEditing={() => void submitSubscription()}
              />
              <View style={styles.httpsHint}>
                <Ionicons name="shield-checkmark-outline" size={16} color={C.teal} />
                <FText style={styles.httpsHintText}>برای حفظ امنیت، لینک‌های اشتراک باید با HTTPS باشند.</FText>
              </View>
              {formError ? (
                <View style={styles.formErrorBox}>
                  <Ionicons name="alert-circle-outline" size={16} color={C.danger} />
                  <FText style={styles.formErrorText}>{formError}</FText>
                </View>
              ) : null}
              <Pressable
                accessibilityRole="button"
                disabled={saving}
                onPress={() => void submitSubscription()}
                style={({ pressed }) => [styles.saveButton, saving && styles.buttonDisabled, pressed && !saving && styles.pressed]}
              >
                {saving ? <ActivityIndicator size="small" color={C.paper} /> : <Ionicons name="lock-closed-outline" size={17} color={C.paper} />}
                <FText style={styles.saveButtonText}>{saving ? "در حال ذخیره…" : "ذخیره‌ی امن اشتراک"}</FText>
              </Pressable>
              <FText style={styles.privacyCaption}>
                این برنامه لینک را به سرویس behinet نمی‌فرستد. تازه‌سازی، فقط با درخواست خودت و از دستگاهت انجام می‌شود.
              </FText>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={Boolean(deleteTarget)} transparent animationType="fade" onRequestClose={() => setDeleteTarget(null)}>
        <View style={styles.modalBackdrop}>
          <Pressable accessibilityLabel="بستن تأیید حذف" style={StyleSheet.absoluteFill} onPress={() => setDeleteTarget(null)} />
          <View style={styles.confirmCard}>
            <View style={styles.confirmIcon}>
              <Ionicons name="trash-outline" size={22} color={C.danger} />
            </View>
            <FText style={styles.confirmTitle}>حذف این اشتراک؟</FText>
            <FText style={styles.confirmBody}>
              «{deleteTarget?.name ?? "اشتراک"}» و لینک ذخیره‌شده از این دستگاه پاک می‌شود.
            </FText>
            <View style={styles.confirmActions}>
              <Pressable onPress={() => setDeleteTarget(null)} style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}>
                <FText style={styles.cancelButtonText}>انصراف</FText>
              </Pressable>
              <Pressable onPress={() => void confirmDelete()} style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}>
                <FText style={styles.deleteButtonText}>حذف اشتراک</FText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function maskAddress(value: string): string {
  if (value.startsWith("https://")) {
    try {
      return new URL(value).hostname;
    } catch {
      return "پیوند اشتراک";
    }
  }
  const protocol = value.slice(0, value.indexOf(":")).toUpperCase();
  return protocol ? `کانفیگ مستقیم · ${protocol}` : "پیوند اشتراک";
}

function formatTime(value: string): string {
  try {
    return new Date(value).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "به‌تازگی";
  }
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: C.paper },
  screen: { flex: 1, backgroundColor: C.paper },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32, maxWidth: 560, width: "100%", alignSelf: "center" },
  rtlText: { color: C.ink, textAlign: "right", writingDirection: "rtl" },
  header: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginBottom: 22 },
  brandGroup: { flexDirection: "row-reverse", alignItems: "center", gap: 10 },
  brandName: { fontSize: 18, fontWeight: "800", letterSpacing: 0.2, lineHeight: 22 },
  brandCaption: { fontSize: 10, color: C.muted, marginTop: 1 },
  menuButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", backgroundColor: C.card, borderRadius: 15, borderWidth: 1, borderColor: C.line },
  menuGlyph: { alignItems: "flex-start", gap: 4 },
  menuLine: { height: 2, borderRadius: 2, backgroundColor: C.ink },
  hero: { position: "relative", overflow: "hidden", backgroundColor: C.ink, borderRadius: 26, paddingHorizontal: 21, paddingTop: 19, paddingBottom: 15, marginBottom: 28 },
  heroOrbitOne: { position: "absolute", width: 240, height: 240, borderRadius: 120, borderWidth: 1, borderColor: "rgba(216,245,107,0.11)", top: 36, left: -122 },
  heroOrbitTwo: { position: "absolute", width: 172, height: 172, borderRadius: 86, borderWidth: 1, borderColor: "rgba(128,198,164,0.16)", top: 68, left: -87 },
  heroTopLine: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginBottom: 17 },
  heroStatus: { flexDirection: "row-reverse", alignItems: "center", backgroundColor: "rgba(255,255,255,0.09)", paddingHorizontal: 11, paddingVertical: 7, borderRadius: 99, gap: 7 },
  statusDot: { width: 7, height: 7, borderRadius: 5, backgroundColor: C.lime },
  heroStatusText: { fontSize: 11, color: "#E8F0DB", fontWeight: "600" },
  heroTitle: { fontSize: 29, lineHeight: 39, color: C.paper, fontWeight: "800", marginBottom: 8 },
  heroBody: { maxWidth: 285, fontSize: 13, lineHeight: 22, color: "#C5D2C9", marginBottom: 18 },
  heroCta: { alignSelf: "flex-start", flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 45, paddingHorizontal: 15, borderRadius: 15, backgroundColor: C.lime },
  heroCtaPressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  heroCtaText: { fontSize: 13, fontWeight: "800", color: C.ink },
  heroFootnote: { color: "#A8B8AF", fontSize: 10, marginTop: 12 },
  sectionHeader: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  sectionTitleBlock: { gap: 3 },
  sectionTitle: { fontSize: 18, fontWeight: "800" },
  sectionCaption: { fontSize: 11, color: C.muted },
  countPill: { backgroundColor: "#E7ECE3", paddingHorizontal: 11, paddingVertical: 7, borderRadius: 50 },
  countText: { fontSize: 11, fontWeight: "700", color: C.teal },
  loadingCard: { flexDirection: "row-reverse", alignItems: "center", gap: 10, minHeight: 84, paddingHorizontal: 18, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 22 },
  loadingText: { fontSize: 12, color: C.muted },
  emptyCard: { alignItems: "flex-start", padding: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 22 },
  emptyIcon: { width: 45, height: 45, alignItems: "center", justifyContent: "center", backgroundColor: "#EAF1E6", borderRadius: 16, marginBottom: 13 },
  emptyTitle: { fontSize: 15, fontWeight: "800", marginBottom: 5 },
  emptyBody: { fontSize: 12, lineHeight: 19, color: C.muted },
  emptyCta: { flexDirection: "row-reverse", alignItems: "center", gap: 6, paddingVertical: 10, marginTop: 5 },
  emptyCtaText: { color: C.teal, fontSize: 12, fontWeight: "800" },
  profileList: { gap: 10 },
  profileCard: { padding: 15, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 21 },
  profileCardSelected: { borderColor: "#9FC1A1", borderWidth: 1.4, backgroundColor: "#FEFFF9" },
  profileRow: { flexDirection: "row-reverse", alignItems: "center", gap: 11 },
  profileIcon: { width: 42, height: 42, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "#EAF1E6" },
  profileIconSelected: { backgroundColor: C.teal },
  profileInfo: { flex: 1, minWidth: 0, alignItems: "flex-start" },
  profileName: { maxWidth: "100%", fontSize: 14, fontWeight: "800", marginBottom: 4 },
  profileAddress: { maxWidth: "100%", fontSize: 10, color: C.muted, writingDirection: "ltr", textAlign: "left" },
  selectedBadge: { flexDirection: "row-reverse", alignItems: "center", gap: 2, backgroundColor: C.lime, paddingHorizontal: 7, paddingVertical: 5, borderRadius: 99 },
  selectedBadgeText: { color: C.ink, fontSize: 9, fontWeight: "800" },
  profileFooter: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginTop: 13, paddingTop: 11, borderTopWidth: 1, borderTopColor: "#EEF0EA" },
  nodeSummary: { flexDirection: "row-reverse", alignItems: "center", gap: 6, flex: 1 },
  nodeDot: { width: 6, height: 6, borderRadius: 4, backgroundColor: C.mint },
  nodeText: { color: C.muted, fontSize: 10 },
  profileActions: { flexDirection: "row-reverse", gap: 5 },
  iconAction: { width: 34, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 11, backgroundColor: C.pale },
  updatedAt: { fontSize: 9, color: "#91A099", marginTop: 6 },
  addAnother: { flexDirection: "row-reverse", alignItems: "center", alignSelf: "flex-start", gap: 7, paddingVertical: 8, paddingHorizontal: 3 },
  addAnotherText: { color: C.teal, fontSize: 12, fontWeight: "700" },
  activePanel: { flexDirection: "row-reverse", alignItems: "center", gap: 10, marginTop: 19, padding: 13, backgroundColor: "#EEF1EA", borderRadius: 18 },
  activePanelIcon: { width: 35, height: 35, borderRadius: 12, backgroundColor: C.card, alignItems: "center", justifyContent: "center" },
  activePanelCopy: { flex: 1 },
  activePanelTitle: { color: C.muted, fontSize: 9, marginBottom: 3 },
  activePanelBody: { fontSize: 12, fontWeight: "700" },
  offlineBadge: { flexDirection: "row-reverse", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 99, backgroundColor: "#E1E5DE" },
  offlineDot: { width: 6, height: 6, borderRadius: 4, backgroundColor: "#88938B" },
  offlineText: { color: "#5F6D64", fontSize: 9, fontWeight: "700" },
  disclosure: { flexDirection: "row-reverse", alignItems: "flex-start", gap: 8, marginTop: 16, paddingHorizontal: 3 },
  disclosureText: { flex: 1, color: C.muted, fontSize: 10, lineHeight: 18 },
  footerBrand: { flexDirection: "row-reverse", alignItems: "center", gap: 10, marginTop: 25 },
  footerRule: { flex: 1, height: 1, backgroundColor: C.line },
  footerText: { fontSize: 9, color: "#95A098" },
  actionButton: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 14, minHeight: 42, backgroundColor: C.ink, borderRadius: 14 },
  actionButtonSecondary: { backgroundColor: C.pale },
  actionButtonText: { color: C.paper, fontSize: 12, fontWeight: "800" },
  actionButtonTextSecondary: { color: C.teal },
  pressed: { opacity: 0.72 },
  buttonDisabled: { opacity: 0.55 },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(9,26,24,0.43)" },
  sheet: { backgroundColor: C.paper, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 20, paddingTop: 10, paddingBottom: Platform.OS === "ios" ? 34 : 24 },
  formSheet: { maxHeight: "92%", backgroundColor: C.paper, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 20, paddingTop: 10, paddingBottom: Platform.OS === "ios" ? 26 : 18 },
  sheetHandle: { alignSelf: "center", width: 38, height: 4, backgroundColor: "#C7CEC5", borderRadius: 3, marginBottom: 18 },
  sheetHeader: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  sheetTitle: { fontSize: 19, fontWeight: "800" },
  sheetSubTitle: { color: C.muted, fontSize: 11, marginTop: 3 },
  closeButton: { width: 36, height: 36, borderRadius: 13, backgroundColor: C.card, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.line },
  menuOption: { flexDirection: "row-reverse", alignItems: "center", gap: 12, paddingVertical: 14, borderTopWidth: 1, borderTopColor: C.line },
  menuOptionIcon: { width: 42, height: 42, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  menuOptionText: { flex: 1 },
  menuOptionTitle: { fontSize: 14, fontWeight: "800", marginBottom: 4 },
  menuOptionCaption: { fontSize: 10, color: C.muted },
  menuUrlPill: { flexDirection: "row-reverse", alignItems: "center", gap: 7, alignSelf: "flex-start", backgroundColor: "#E9EFE5", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 99, marginTop: 8 },
  menuUrlPillText: { color: C.teal, fontSize: 10, fontWeight: "600" },
  formBody: { paddingBottom: 10 },
  fieldLabel: { fontSize: 12, fontWeight: "800", marginBottom: 8 },
  textInput: { minHeight: 50, backgroundColor: C.card, borderColor: C.line, borderWidth: 1, borderRadius: 15, paddingHorizontal: 14, fontSize: 13, color: C.ink },
  urlInput: { writingDirection: "ltr", textAlign: "left", fontSize: 12 },
  httpsHint: { flexDirection: "row-reverse", alignItems: "center", gap: 7, marginTop: 10 },
  httpsHintText: { flex: 1, color: C.muted, fontSize: 10, lineHeight: 17 },
  formErrorBox: { flexDirection: "row-reverse", alignItems: "center", gap: 7, backgroundColor: "#F9EAE7", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 9, marginTop: 12 },
  formErrorText: { color: C.danger, flex: 1, fontSize: 11, lineHeight: 17 },
  saveButton: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 50, backgroundColor: C.ink, borderRadius: 15, marginTop: 18 },
  saveButtonText: { color: C.paper, fontSize: 13, fontWeight: "800" },
  privacyCaption: { textAlign: "center", color: C.muted, fontSize: 9, lineHeight: 16, marginTop: 12, paddingHorizontal: 8 },
  confirmCard: { marginHorizontal: 23, marginBottom: "auto", marginTop: "auto", backgroundColor: C.paper, borderRadius: 24, padding: 21, alignItems: "center" },
  confirmIcon: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: 16, backgroundColor: "#F9EAE7", marginBottom: 12 },
  confirmTitle: { fontSize: 17, fontWeight: "800", marginBottom: 7 },
  confirmBody: { textAlign: "center", fontSize: 12, color: C.muted, lineHeight: 20, marginBottom: 20 },
  confirmActions: { flexDirection: "row-reverse", width: "100%", gap: 9 },
  cancelButton: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", backgroundColor: "#E8ECE5", borderRadius: 13 },
  cancelButtonText: { color: C.ink, fontSize: 12, fontWeight: "700" },
  deleteButton: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", backgroundColor: C.danger, borderRadius: 13 },
  deleteButtonText: { color: C.card, fontSize: 12, fontWeight: "700" },
  notice: { position: "absolute", bottom: 12, left: 16, right: 16, flexDirection: "row-reverse", alignItems: "center", gap: 9, backgroundColor: C.ink, borderRadius: 15, paddingHorizontal: 14, paddingVertical: 12, elevation: 8, shadowColor: "#071B19", shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } },
  noticeText: { color: C.paper, flex: 1, fontSize: 11, lineHeight: 17 },
});
