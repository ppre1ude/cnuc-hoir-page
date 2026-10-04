import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PageGate } from "./PageGate";
import { SessionProvider, useSession } from "./SessionProvider";
import { getSession } from "./session";
import { renderWithSession, sessionFixture } from "../../test/session";

vi.mock("./session", async (importOriginal) => ({ ...await importOriginal<typeof import("./session")>(), getSession: vi.fn() }));
vi.mock("../../lib/api", async (importOriginal) => ({ ...await importOriginal<typeof import("../../lib/api")>(), redirectTo: vi.fn() }));

function Body() { return <p>본문:{useSession().name}</p>; }
const skeleton = <p>스켈레톤</p>;

beforeEach(() => { vi.mocked(getSession).mockReset(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

test("세션을 기다리는 동안 스켈레톤을 보여 주고 3초 뒤 대기 안내를 띄웁니다", () => {
  vi.useFakeTimers();
  vi.mocked(getSession).mockReturnValue(new Promise(() => undefined));
  render(<SessionProvider><PageGate skeleton={skeleton}><Body /></PageGate></SessionProvider>);
  expect(screen.getByText("스켈레톤")).toBeInTheDocument();
  const status = screen.getByRole("status");
  expect(status).toHaveTextContent("불러오는 중입니다.");
  act(() => { vi.advanceTimersByTime(2999); });
  expect(screen.queryByText(/서버를 깨우고 있습니다/)).not.toBeInTheDocument();
  act(() => { vi.advanceTimersByTime(1); });
  // 같은 알림 영역이 글자만 바꿔 알리고, 화면에도 같은 안내가 보입니다.
  expect(screen.getByRole("status")).toBe(status);
  expect(status).toHaveTextContent("서버를 깨우고 있습니다. 오랜만에 접속하면 1분 정도 걸릴 수 있어요.");
  expect(screen.getAllByText("서버를 깨우고 있습니다. 오랜만에 접속하면 1분 정도 걸릴 수 있어요.")).toHaveLength(2);
  expect(screen.getByText("스켈레톤")).toBeInTheDocument();
});

test("실패하면 안내와 다시 시도 버튼을 보여 주고, 다시 시도하면 본문을 그립니다", async () => {
  vi.mocked(getSession).mockRejectedValueOnce(new TypeError("Failed to fetch"))
    .mockResolvedValueOnce(sessionFixture({ name: "단원" }));
  render(<SessionProvider><PageGate skeleton={skeleton}><Body /></PageGate></SessionProvider>);
  expect(await screen.findByRole("alert")).toHaveTextContent("서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  await userEvent.click(screen.getByRole("button", { name: "다시 시도" }));
  expect(await screen.findByText("본문:단원")).toBeInTheDocument();
});

test("권한이 없으면 안내와 일정 링크를 보여 줍니다", () => {
  renderWithSession(<PageGate skeleton={skeleton} permission="APPROVE_APPLICATIONS"><Body /></PageGate>,
    sessionFixture({ permissions: ["MANAGE_EVENTS", "VIEW_MINUTES"] }));
  expect(screen.getByText("이 기능을 쓸 권한이 없습니다.")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "일정으로 가기" })).toHaveAttribute("href", "/dashboard");
  expect(screen.queryByText(/본문:/)).not.toBeInTheDocument();
});

test("권한이 있으면 본문을 그립니다", () => {
  renderWithSession(<PageGate skeleton={skeleton} permission="MANAGE_EVENTS"><Body /></PageGate>,
    sessionFixture({ name: "수석", permissions: ["MANAGE_EVENTS", "VIEW_MINUTES"] }));
  expect(screen.getByText("본문:수석")).toBeInTheDocument();
  expect(screen.queryByText("스켈레톤")).not.toBeInTheDocument();
});

test("권한이 필요 없는 페이지는 준비되면 바로 본문을 그립니다", () => {
  renderWithSession(<PageGate skeleton={skeleton}><Body /></PageGate>);
  expect(screen.getByText("본문:단원")).toBeInTheDocument();
});
