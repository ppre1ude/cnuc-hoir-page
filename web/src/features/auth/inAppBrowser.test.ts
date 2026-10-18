import { expect, test } from "vitest";
import { detectInAppBrowser } from "./inAppBrowser";

const cases: Array<[string, string, string | null]> = [
  ["카카오톡 안드로이드", "Mozilla/5.0 (Linux; Android 14; SM-S921N Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.100 Mobile Safari/537.36;KAKAOTALK 2410850", "카카오톡"],
  ["카카오톡 iOS", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.8.5", "카카오톡"],
  ["인스타그램 iOS", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.25.84 (iPhone15,2; iOS 17_6; ko_KR; ko; scale=3.00; 1179x2556; 642393245)", "인스타그램"],
  ["인스타그램 안드로이드", "Mozilla/5.0 (Linux; Android 14; SM-S921N Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.100 Mobile Safari/537.36 Instagram 350.0.0.42.84 Android (34/14; 480dpi; 1080x2340; samsung; SM-S921N; e1q; qcom; ko_KR; 642393245)", "인스타그램"],
  ["페이스북 iOS", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/482.0.0.38.109;FBBV/650000000;FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/17.6;FBSS/3;FBID/phone;FBLC/ko_KR;FBOP/5]", "페이스북"],
  ["크롬 안드로이드", "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36", null],
  ["사파리 iOS", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1", null],
  ["삼성 인터넷", "Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36", null],
  ["데스크톱 크롬", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36", null],
  ["네이버 앱 안드로이드", "Mozilla/5.0 (Linux; Android 14; SM-S921N Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.100 Mobile Safari/537.36 NAVER(inapp; search; 2000; 12.10.3)", null],
];

test.each(cases)("%s의 사용자 에이전트를 알아봅니다", (_, userAgent, name) => {
  expect(detectInAppBrowser(userAgent)?.name ?? null).toBe(name);
});

test("카카오톡은 같은 주소를 외부 브라우저로 여는 주소를 만들고, 인스타그램은 만들지 않습니다", () => {
  const kakao = detectInAppBrowser(cases[0][1]);
  expect(kakao?.reopen?.("https://cnuc-hoir-page.vercel.app/login"))
    .toBe("kakaotalk://web/openExternal?url=https%3A%2F%2Fcnuc-hoir-page.vercel.app%2Flogin");
  expect(detectInAppBrowser(cases[2][1])?.reopen).toBeNull();
});
