import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

export type SubscriptionProfile = {
  id: string;
  name: string;
  url: string;
  createdAt: string;
  nodeCount: number;
  lastUpdated: string | null;
};

type StoredProfile = Omit<SubscriptionProfile, "url"> & { urlParts: number };
type SubscriptionDraft = Pick<SubscriptionProfile, "name" | "url">;

const INDEX_KEY = "behinet.subscriptions.index.v1";
const ACTIVE_KEY = "behinet.subscriptions.active.v1";
const URL_PREFIX = "behinet.subscriptions.url.v1";
const URL_PART_SIZE = 1500;
const MAX_URL_LENGTH = 30_000;
const DIRECT_PROTOCOLS = new Set([
  "vless:",
  "vmess:",
  "trojan:",
  "ss:",
  "ssr:",
  "socks:",
  "wireguard:",
  "hysteria:",
  "hysteria2:",
  "tuic:",
]);
const CONFIG_LINE = /^(?:vless|vmess|trojan|ss|ssr|socks|wireguard|hysteria2?|tuic):\/\//i;

function browserStorage(): Storage | null {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function urlPartKey(id: string, index: number): string {
  return `${URL_PREFIX}.${id}.${index}`;
}

async function getItem(key: string): Promise<string | null> {
  const storage = browserStorage();
  if (storage) return storage.getItem(key);
  if (Platform.OS === "web") return null;
  return SecureStore.getItemAsync(key);
}

async function setItem(key: string, value: string): Promise<void> {
  const storage = browserStorage();
  if (storage) {
    storage.setItem(key, value);
    return;
  }
  if (Platform.OS === "web") throw new Error("مرورگر اجازه‌ی ذخیره‌سازی محلی نداد.");
  await SecureStore.setItemAsync(key, value);
}

async function deleteItem(key: string): Promise<void> {
  const storage = browserStorage();
  if (storage) {
    storage.removeItem(key);
    return;
  }
  if (Platform.OS === "web") return;
  await SecureStore.deleteItemAsync(key);
}

async function readIndex(): Promise<StoredProfile[]> {
  const raw = await getItem(INDEX_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is StoredProfile =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as StoredProfile).id === "string" &&
        typeof (item as StoredProfile).name === "string" &&
        typeof (item as StoredProfile).urlParts === "number",
    );
  } catch {
    return [];
  }
}

async function writeIndex(items: StoredProfile[]): Promise<void> {
  await setItem(INDEX_KEY, JSON.stringify(items));
}

async function removeUrlParts(id: string, count: number): Promise<void> {
  await Promise.all(
    Array.from({ length: count }, (_, index) =>
      deleteItem(urlPartKey(id, index)).catch(() => undefined),
    ),
  );
}

export async function loadSubscriptions(): Promise<SubscriptionProfile[]> {
  const stored = await readIndex();
  const loaded = await Promise.all(
    stored.map(async (entry): Promise<SubscriptionProfile | null> => {
      try {
        const parts = await Promise.all(
          Array.from({ length: entry.urlParts }, (_, index) => getItem(urlPartKey(entry.id, index))),
        );
        if (parts.some((part) => part === null)) return null;
        return {
          id: entry.id,
          name: entry.name,
          createdAt: entry.createdAt,
          nodeCount: entry.nodeCount,
          lastUpdated: entry.lastUpdated,
          url: parts.join(""),
        };
      } catch {
        return null;
      }
    }),
  );
  return loaded.filter((entry): entry is SubscriptionProfile => entry !== null);
}

export function validateSubscriptionInput(raw: string): string | null {
  const value = raw.trim();
  if (!value) return "لینک اشتراک را وارد کن.";
  if (value.length > MAX_URL_LENGTH) return "این لینک بیش از اندازه طولانی است.";
  try {
    const parsed = new URL(value);
    if (DIRECT_PROTOCOLS.has(parsed.protocol.toLowerCase()) && parsed.hostname) return null;
    if (parsed.protocol === "https:" && parsed.hostname) return null;
    if (parsed.protocol === "http:" && parsed.hostname) {
      return "برای محافظت از لینک اشتراک، نشانی HTTPS وارد کن.";
    }
  } catch {
    return "نشانی واردشده معتبر نیست.";
  }
  return "لینک باید HTTPS یا یک کانفیگ پشتیبانی‌شده باشد.";
}

export async function addSubscription(draft: SubscriptionDraft): Promise<SubscriptionProfile> {
  const error = validateSubscriptionInput(draft.url);
  if (error) throw new Error(error);
  const url = draft.url.trim();
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const urlParts = Math.max(1, Math.ceil(url.length / URL_PART_SIZE));
  const record: SubscriptionProfile = {
    id,
    name: draft.name.trim() || "اشتراک تازه",
    url,
    createdAt: new Date().toISOString(),
    nodeCount: isDirectConfig(url) ? 1 : 0,
    lastUpdated: isDirectConfig(url) ? new Date().toISOString() : null,
  };
  try {
    await Promise.all(
      Array.from({ length: urlParts }, (_, index) =>
        setItem(urlPartKey(id, index), url.slice(index * URL_PART_SIZE, (index + 1) * URL_PART_SIZE)),
      ),
    );
    const index = await readIndex();
    const stored: StoredProfile = {
      id: record.id,
      name: record.name,
      createdAt: record.createdAt,
      nodeCount: record.nodeCount,
      lastUpdated: record.lastUpdated,
      urlParts,
    };
    await writeIndex([stored, ...index]);
    return record;
  } catch (error) {
    await removeUrlParts(id, urlParts);
    throw error;
  }
}

export async function updateSubscriptionStats(
  id: string,
  nodeCount: number,
  lastUpdated: string,
): Promise<void> {
  const index = await readIndex();
  const exists = index.some((entry) => entry.id === id);
  if (!exists) throw new Error("این اشتراک دیگر در فهرست نیست.");
  await writeIndex(
    index.map((entry) =>
      entry.id === id ? { ...entry, nodeCount, lastUpdated } : entry,
    ),
  );
}

export async function deleteSubscription(id: string): Promise<void> {
  const index = await readIndex();
  const target = index.find((entry) => entry.id === id);
  if (!target) return;
  await removeUrlParts(id, target.urlParts);
  await writeIndex(index.filter((entry) => entry.id !== id));
  if ((await getActiveSubscriptionId()) === id) await setActiveSubscriptionId(null);
}

export async function getActiveSubscriptionId(): Promise<string | null> {
  return getItem(ACTIVE_KEY);
}

export async function setActiveSubscriptionId(id: string | null): Promise<void> {
  if (id) await setItem(ACTIVE_KEY, id);
  else await deleteItem(ACTIVE_KEY);
}

function isDirectConfig(value: string): boolean {
  const protocol = value.slice(0, value.indexOf(":") + 1).toLowerCase();
  return DIRECT_PROTOCOLS.has(protocol);
}

function decodeBase64(input: string): string | null {
  const compact = input.replace(/\s/g, "").replace(/-/g, "+").replace(/_/g, "/");
  if (!compact || !/^[A-Za-z0-9+/=]+$/.test(compact) || compact.length % 4 === 1) return null;
  try {
    if (typeof atob !== "function") return null;
    const binary = atob(compact);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    if (typeof TextDecoder !== "undefined") return new TextDecoder().decode(bytes);
    return binary;
  } catch {
    return null;
  }
}

function countConfigs(text: string): number {
  const entries = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => CONFIG_LINE.test(line));
  return new Set(entries).size;
}

export async function refreshSubscription(profile: SubscriptionProfile): Promise<number> {
  if (isDirectConfig(profile.url)) return 1;
  const error = validateSubscriptionInput(profile.url);
  if (error) throw new Error(error);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(profile.url, {
      method: "GET",
      headers: { Accept: "text/plain, application/octet-stream, */*" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`سرور اشتراک پاسخ ${response.status} داد.`);
    const text = await response.text();
    if (text.length > 1_000_000) throw new Error("پاسخ اشتراک بیش از اندازه بزرگ است.");
    const directCount = countConfigs(text);
    if (directCount > 0) return directCount;
    const decoded = decodeBase64(text);
    const decodedCount = decoded ? countConfigs(decoded) : 0;
    if (decodedCount > 0) return decodedCount;
    throw new Error("پاسخ دریافت شد، اما کانفیگ پشتیبانی‌شده‌ای در آن پیدا نشد.");
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("پاسخ سرور دیر رسید؛ دوباره تلاش کن.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
