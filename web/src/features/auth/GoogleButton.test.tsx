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
  window.google = undefined;
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = previousClientId;
  vi.clearAllMocks();
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
