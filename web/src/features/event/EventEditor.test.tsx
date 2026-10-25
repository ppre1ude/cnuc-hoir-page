import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventEditor } from "./EventEditor";
import { renderWithSession, sessionFixture } from "../../test/session";

const getEvents = vi.fn();
const updateEvent = vi.fn();
vi.mock("./events", async (importOriginal) => ({
  ...await importOriginal<typeof import("./events")>(),
  getEvents: (...args: unknown[]) => getEvents(...args),
  updateEvent: (...args: unknown[]) => updateEvent(...args),
}));

const septemberEvent = {
  id: 1, title: "정기 연습", description: "연습실", startAt: "2026-09-20T10:00:00Z",
  endAt: "2026-09-20T12:00:00Z", obEligible: false, publicVisible: false,
};
const octoberEvent = {
  ...septemberEvent, title: "가을 공연", startAt: "2026-10-20T10:00:00Z", endAt: "2026-10-20T12:00:00Z",
};

describe("운영진 일정 편집", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-09-27T03:00:00Z"));
    getEvents.mockReset(); updateEvent.mockReset();
    updateEvent.mockResolvedValue(septemberEvent);
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it("저장 뒤 이전 월 응답이 늦게 도착해도 현재 조회 월 목록을 유지한다", async () => {
    let finishOldMonth!: (events: typeof septemberEvent[]) => void;
    const oldMonthRefresh = new Promise<typeof septemberEvent[]>((resolve) => { finishOldMonth = resolve; });
    getEvents.mockResolvedValueOnce([septemberEvent])
      .mockReturnValueOnce(oldMonthRefresh)
      .mockResolvedValueOnce([octoberEvent]);
    renderWithSession(<EventEditor />, sessionFixture({ admin: true }));
    fireEvent.click(await screen.findByRole("button", { name: /정기 연습/ }));
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(getEvents).toHaveBeenCalledTimes(2));
    fireEvent.change(screen.getByLabelText("조회 월"), { target: { value: "2026-10" } });
    expect(await screen.findByRole("button", { name: /가을 공연/ })).toBeInTheDocument();
    await act(async () => { finishOldMonth([septemberEvent]); });
    expect(screen.getByRole("button", { name: /가을 공연/ })).toBeInTheDocument();
    expect(screen.queryByText("일정을 불러오는 중입니다.")).not.toBeInTheDocument();
  });

  it("저장 요청 중 월을 바꾸면 저장 완료 뒤 현재 월을 다시 조회한다", async () => {
    let finishSave!: (event: typeof octoberEvent) => void;
    const pendingSave = new Promise<typeof octoberEvent>((resolve) => { finishSave = resolve; });
    updateEvent.mockReturnValueOnce(pendingSave);
    getEvents.mockResolvedValueOnce([septemberEvent])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([octoberEvent]);
    renderWithSession(<EventEditor />, sessionFixture({ admin: true }));
    fireEvent.click(await screen.findByRole("button", { name: /정기 연습/ }));
    fireEvent.change(screen.getByLabelText("시작 시각 (한국 시간)"), { target: { value: "2026-10-20T19:00" } });
    fireEvent.change(screen.getByLabelText("종료 시각 (한국 시간)"), { target: { value: "2026-10-20T21:00" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(updateEvent).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByLabelText("조회 월"), { target: { value: "2026-10" } });
    expect(await screen.findByText("이번 달 등록된 일정이 없습니다.")).toBeInTheDocument();
    await act(async () => { finishSave(octoberEvent); });
    expect(await screen.findByRole("button", { name: /가을 공연/ })).toBeInTheDocument();
    expect(getEvents).toHaveBeenCalledTimes(3);
  });

  it("조회 월을 지워도 화면이 멈추지 않고 월을 고르라고 안내한다", async () => {
    getEvents.mockResolvedValue([septemberEvent]);
    renderWithSession(<EventEditor />, sessionFixture({ admin: true }));
    await screen.findByRole("button", { name: /정기 연습/ });
    fireEvent.change(screen.getByLabelText("조회 월"), { target: { value: "" } });
    expect(screen.getByRole("heading", { name: "일정 관리" })).toBeInTheDocument();
    expect(screen.getByText("조회할 월을 골라 주세요.")).toBeInTheDocument();
    expect(getEvents).toHaveBeenCalledTimes(1);
  });

  it("저장 전에 시작된 현재 월 조회가 늦어도 저장 후 목록을 덮지 않는다", async () => {
    let finishSave!: (event: typeof octoberEvent) => void;
    let finishStaleList!: (events: typeof octoberEvent[]) => void;
    const pendingSave = new Promise<typeof octoberEvent>((resolve) => { finishSave = resolve; });
    const staleList = new Promise<typeof octoberEvent[]>((resolve) => { finishStaleList = resolve; });
    updateEvent.mockReturnValueOnce(pendingSave);
    getEvents.mockResolvedValueOnce([septemberEvent])
      .mockReturnValueOnce(staleList)
      .mockResolvedValueOnce([octoberEvent]);
    renderWithSession(<EventEditor />, sessionFixture({ admin: true }));
    fireEvent.click(await screen.findByRole("button", { name: /정기 연습/ }));
    fireEvent.change(screen.getByLabelText("시작 시각 (한국 시간)"), { target: { value: "2026-10-20T19:00" } });
    fireEvent.change(screen.getByLabelText("종료 시각 (한국 시간)"), { target: { value: "2026-10-20T21:00" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(updateEvent).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByLabelText("조회 월"), { target: { value: "2026-10" } });
    await waitFor(() => expect(getEvents).toHaveBeenCalledTimes(2));
    await act(async () => { finishSave(octoberEvent); });
    expect(await screen.findByRole("button", { name: /가을 공연/ })).toBeInTheDocument();
    await act(async () => { finishStaleList([]); });
    expect(screen.getByRole("button", { name: /가을 공연/ })).toBeInTheDocument();
  });
});
