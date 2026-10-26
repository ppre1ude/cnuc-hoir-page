import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { OfflineNotice } from "./OfflineNotice";

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(navigator, "onLine");
});

function setOnline(value: boolean) {
  Object.defineProperty(navigator, "onLine", { value, configurable: true });
  fireEvent(window, new Event(value ? "online" : "offline"));
}

it("연결이 끊기면 알리고, 다시 연결되면 지운다", () => {
  render(<OfflineNotice />);
  expect(screen.queryByRole("alert")).toBeNull();
  setOnline(false);
  expect(screen.getByRole("alert")).toHaveTextContent("인터넷 연결이 끊겼습니다.");
  setOnline(true);
  expect(screen.queryByRole("alert")).toBeNull();
});
