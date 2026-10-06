import { afterEach, expect, test, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GoogleButton } from "./GoogleButton";
import { getGoogleNonce } from "./session";

vi.mock("next/script", () => ({ default: ({ onReady }: { onReady: () => void }) =>
  <button type="button" onClick={onReady}>스크립트 준비</button> }));
vi.mock("./session", () => ({ getGoogleNonce: vi.fn() }));

const previousClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  window.google = undefined;
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = previousClientId;
  vi.resetAllMocks();
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
