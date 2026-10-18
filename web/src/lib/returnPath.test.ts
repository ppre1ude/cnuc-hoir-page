import { expect, test } from "vitest";
import { loginPath, readReturnPath } from "./returnPath";

const origin = "https://choir.example";

function at(path: string) {
  const url = new URL(path, origin);
  return { pathname: url.pathname, search: url.search, hash: url.hash, origin };
}

test("보던 주소를 로그인 주소의 해시에 담습니다", () => {
  expect(loginPath(at("/notices?notice=5"))).toBe("/login#next=%2Fnotices%3Fnotice%3D5");
});

test("QR 토큰까지 담은 주소가 로그인 뒤 그대로 돌아옵니다", () => {
  const login = loginPath(at("/events/12/check-in#token=abc"));
  expect(login).toBe("/login#next=%2Fevents%2F12%2Fcheck-in%23token%3Dabc");
  expect(readReturnPath(at(login))).toBe("/events/12/check-in#token=abc");
});

test("로그인 화면과 첫 화면에서는 돌아갈 주소를 담지 않습니다", () => {
  expect(loginPath(at("/login"))).toBe("/login");
  expect(loginPath(at("/"))).toBe("/login");
});

test.each(["//evil.example", "/\\evil.example", "https://evil.example/x", "javascript:alert(1)", "/login"])(
  "%s는 돌아갈 주소로 받지 않습니다",
  (next) => {
    expect(readReturnPath({ hash: `#${new URLSearchParams({ next })}`, origin })).toBeNull();
  },
);

test("돌아갈 주소가 없으면 받지 않습니다", () => {
  expect(readReturnPath({ hash: "", origin })).toBeNull();
});
