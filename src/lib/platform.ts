export type Platform = "windows" | "android" | "ios" | "mac" | "other";

/**
 * Sistema del visitante a partir del user agent. Los iPad recientes se anuncian como Mac:
 * se distinguen porque tienen pantalla táctil.
 */
export function detectPlatform(
  userAgent: string = navigator.userAgent,
  maxTouchPoints: number = navigator.maxTouchPoints ?? 0,
): Platform {
  if (/android/i.test(userAgent)) return "android";
  if (/iphone|ipad|ipod/i.test(userAgent)) return "ios";
  if (/macintosh|mac os x/i.test(userAgent)) return maxTouchPoints > 1 ? "ios" : "mac";
  if (/windows/i.test(userAgent)) return "windows";
  return "other";
}
