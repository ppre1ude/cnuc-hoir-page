export type InAppBrowser = { name: string; reopen: ((url: string) => string) | null };

// 구글은 앱 안의 웹뷰에서 로그인을 막습니다. 네이버 앱은 허용한다고 알려져 있어 넣지 않고, 안드로이드 웹뷰 공통 표시인 "; wv)"로도 판단하지 않습니다.
const registry: Array<{ pattern: RegExp } & InAppBrowser> = [
  { pattern: /KAKAOTALK/i, name: "카카오톡", reopen: (url) => `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}` },
  { pattern: /Instagram/, name: "인스타그램", reopen: null },
  { pattern: /FBAN|FBAV/, name: "페이스북", reopen: null },
];

export function detectInAppBrowser(userAgent: string): InAppBrowser | null {
  const found = registry.find(({ pattern }) => pattern.test(userAgent));
  return found ? { name: found.name, reopen: found.reopen } : null;
}

export function openExternally(url: string): void {
  window.location.href = url;
}
