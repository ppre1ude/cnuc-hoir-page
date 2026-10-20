import { StrictMode } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GoogleButton } from "./GoogleButton";
import { getGoogleNonce } from "./session";
import { openExternally } from "./inAppBrowser";

vi.mock("next/script", () => ({ default: ({ onReady }: { onReady: () => void }) =>
  <button type="button" onClick={onReady}>스크립트 준비</button> }));
vi.mock("./session", () => ({ getGoogleNonce: vi.fn() }));
vi.mock("./inAppBrowser", async (importActual) =>
  ({ ...await importActual<typeof import("./inAppBrowser")>(), openExternally: vi.fn() }));

const previousClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  window.google = undefined;
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = previousClientId;
  vi.resetAllMocks();
  vi.restoreAllMocks();
});

function fakeGoogle() {
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = "test-client";
  const initialize = vi.fn();
  window.google = { accounts: { id: { initialize, renderButton: vi.fn() } } };
  return initialize;
}

test("3초가 지나도 준비가 끝나지 않으면 같은 알림 영역이 서버를 깨우는 안내로 바뀝니다", () => {
  vi.useFakeTimers();
  fakeGoogle();
  vi.mocked(getGoogleNonce).mockReturnValue(new Promise(() => undefined));
  render(<GoogleButton onCredential={vi.fn()} onError={vi.fn()} />);
  const status = screen.getByRole("status");
  expect(status).toHaveTextContent("구글 로그인 준비 중...");
  act(() => { vi.advanceTimersByTime(3000); });
  expect(screen.getByRole("status")).toBe(status);
  expect(status).toHaveTextContent("서버를 깨우고 있습니다. 오랜만에 접속하면 1분 정도 걸릴 수 있어요.");
});

test("준비 요청이 실패하면 한 번 자동으로 다시 받아 버튼을 그립니다", async () => {
  const initialize = fakeGoogle();
  vi.mocked(getGoogleNonce).mockRejectedValueOnce(new TypeError("Failed to fetch"))
    .mockResolvedValueOnce({ nonce: "second" });
  const onError = vi.fn();
  render(<GoogleButton onCredential={vi.fn()} onError={onError} />);
  await userEvent.click(screen.getByRole("button", { name: "스크립트 준비" }));
  expect(initialize).toHaveBeenCalledWith(expect.objectContaining({ nonce: "second" }));
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(onError).not.toHaveBeenCalled();
});

test("자동으로 다시 받아도 실패하면 준비 안내 대신 오류와 다시 시도 버튼을 보여 주고, 다시 시도하면 버튼을 그립니다", async () => {
  const initialize = fakeGoogle();
  vi.mocked(getGoogleNonce).mockRejectedValueOnce(new TypeError("Failed to fetch"))
    .mockRejectedValueOnce(new TypeError("Failed to fetch"))
    .mockResolvedValueOnce({ nonce: "third" });
  render(<GoogleButton onCredential={vi.fn()} onError={vi.fn()} />);
  await userEvent.click(screen.getByRole("button", { name: "스크립트 준비" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  expect(screen.queryByText("구글 로그인 준비 중...")).not.toBeInTheDocument();
  expect(initialize).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "다시 시도" }));
  expect(initialize).toHaveBeenCalledWith(expect.objectContaining({ nonce: "third" }));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(getGoogleNonce).toHaveBeenCalledTimes(3);
});

test("늦게 끝난 준비 요청과 화면 종료 뒤 구글 응답을 무시합니다", async () => {
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = "test-client";
  const initialize = vi.fn<(options: { client_id: string; nonce: string;
    callback: (response: { credential: string }) => void }) => void>();
  window.google = { accounts: { id: { initialize, renderButton: vi.fn() } } };
  const resolvers: Array<(value: { nonce: string }) => void> = [];
  vi.mocked(getGoogleNonce).mockImplementation(() => new Promise((resolve) => { resolvers.push(resolve); }));
  const onCredential = vi.fn(async () => {});
  const onError = vi.fn();
  const view = render(<GoogleButton onCredential={onCredential} onError={onError} />);

  await userEvent.click(screen.getByRole("button", { name: "스크립트 준비" }));
  await userEvent.click(screen.getByRole("button", { name: "스크립트 준비" }));
  await act(async () => { resolvers[1]({ nonce: "second" }); });
  await act(async () => { resolvers[0]({ nonce: "first" }); });

  expect(initialize).toHaveBeenCalledTimes(1);
  expect(initialize).toHaveBeenCalledWith(expect.objectContaining({ nonce: "second" }));
  const callback = initialize.mock.calls[0][0].callback;
  view.unmount();
  callback({ credential: "credential" });
  expect(onCredential).not.toHaveBeenCalled();
  expect(onError).not.toHaveBeenCalled();
});

const userAgents = {
  kakao: "Mozilla/5.0 (Linux; Android 14; SM-S921N Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.100 Mobile Safari/537.36;KAKAOTALK 2410850",
  instagram: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.25.84 (iPhone15,2; iOS 17_6; ko_KR; ko; scale=3.00; 1179x2556; 642393245)",
  chrome: "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36",
};

test("카카오톡에서는 안내와 함께 외부 브라우저로 한 번만 넘기고 구글 버튼도 그대로 둡니다", () => {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(userAgents.kakao);
  fakeGoogle();
  const expected = "kakaotalk://web/openExternal?url=https%3A%2F%2Fexample.com%2Factivate%23token%3Dabc";
  render(<StrictMode><GoogleButton onCredential={vi.fn()} onError={vi.fn()} reopenUrl="https://example.com/activate#token=abc" /></StrictMode>);
  expect(screen.getByRole("alert")).toHaveTextContent("카카오톡 안에서는 구글 로그인이 막힐 수 있습니다. 다른 브라우저에서 열어 주세요.");
  expect(screen.getByRole("link", { name: "다른 브라우저로 열기" })).toHaveAttribute("href", expected);
  expect(screen.getByText("버튼이 안 되면 메뉴에서 '다른 브라우저로 열기'를 눌러 주세요.")).toBeInTheDocument();
  expect(openExternally).toHaveBeenCalledTimes(1);
  expect(openExternally).toHaveBeenCalledWith(expected);
  expect(screen.getByRole("button", { name: "스크립트 준비" })).toBeInTheDocument();
});

test("인스타그램에서는 메뉴로 여는 방법만 안내하고 직접 넘기지 않습니다", () => {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(userAgents.instagram);
  fakeGoogle();
  render(<GoogleButton onCredential={vi.fn()} onError={vi.fn()} />);
  expect(screen.getByRole("alert")).toHaveTextContent("인스타그램 안에서는 구글 로그인이 막힐 수 있습니다.");
  expect(screen.getByText("메뉴에서 '외부 브라우저로 열기'를 눌러 주세요.")).toBeInTheDocument();
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
  expect(openExternally).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "스크립트 준비" })).toBeInTheDocument();
});

test("일반 브라우저에서는 안내 없이 구글 버튼만 보입니다", () => {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(userAgents.chrome);
  fakeGoogle();
  render(<GoogleButton onCredential={vi.fn()} onError={vi.fn()} />);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
  expect(openExternally).not.toHaveBeenCalled();
});

test("구글 창이 안 될 때 다시 누르고 계속 안 되면 운영진에게 알리라고 안내합니다", () => {
  fakeGoogle();
  vi.mocked(getGoogleNonce).mockReturnValue(new Promise(() => undefined));
  render(<GoogleButton onCredential={vi.fn()} onError={vi.fn()} />);
  expect(screen.getByText("구글 창이 열리지 않거나, 닫히거나, 오류가 보이면 버튼을 다시 눌러 주세요. 계속 안 되면 운영진에게 알려 주세요.")).toBeInTheDocument();
});
