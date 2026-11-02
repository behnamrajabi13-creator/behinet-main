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
