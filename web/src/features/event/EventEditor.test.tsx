import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventEditor } from "./EventEditor";
import { ApiRequestError } from "../../lib/api";
import { renderWithSession, sessionFixture } from "../../test/session";

const getEvents = vi.fn();
const updateEvent = vi.fn();
const cancelEvent = vi.fn();
const restoreEvent = vi.fn();
const deleteEvent = vi.fn();
vi.mock("./events", async (importOriginal) => ({
  ...await importOriginal<typeof import("./events")>(),
  getEvents: (...args: unknown[]) => getEvents(...args),
  updateEvent: (...args: unknown[]) => updateEvent(...args),
  cancelEvent: (...args: unknown[]) => cancelEvent(...args),
  restoreEvent: (...args: unknown[]) => restoreEvent(...args),
  deleteEvent: (...args: unknown[]) => deleteEvent(...args),
}));

const septemberEvent = {
  id: 1, title: "정기 연습", description: "연습실", startAt: "2026-09-20T10:00:00Z",
  endAt: "2026-09-20T12:00:00Z", kind: "EVENT", part: null, obEligible: false, publicVisible: false,
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
    expect(screen.getByRole("link", { name: "홈으로 가기" })).toHaveAttribute("href", "/dashboard");
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

  it("등록이 위, 등록된 일정이 아래이고 목록에서 고른 일정만 오른쪽 상세에 나온다", async () => {
    getEvents.mockResolvedValue([septemberEvent]);
    renderWithSession(<EventEditor />, sessionFixture({ admin: true }));
    const headings = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    expect(headings).toEqual(["일정 등록", "등록된 일정"]);
    expect(screen.queryByText(/한 번에/)).not.toBeInTheDocument();
    expect(screen.getByText("목록에서 일정을 선택하세요.")).toBeInTheDocument();
    const row = await screen.findByRole("button", { name: /정기 연습/ });
    expect(row).not.toHaveTextContent("·");
    expect(screen.queryByLabelText("시작 시각 (한국 시간)")).not.toBeInTheDocument();
    fireEvent.click(row);
    expect(row).toHaveAttribute("aria-current", "true");
    expect(screen.queryByText("목록에서 일정을 선택하세요.")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "정기 연습" })).toBeInTheDocument();
    expect(screen.getByLabelText("시작 시각 (한국 시간)")).toHaveValue("2026-09-20T19:00");
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

  describe("일정 취소", () => {
    const cancelledEvent = { ...septemberEvent, cancelledAt: "2026-09-27T03:00:00Z" };
    afterEach(() => { vi.restoreAllMocks(); cancelEvent.mockReset(); restoreEvent.mockReset(); deleteEvent.mockReset(); });

    it("확인 창에서 거절하면 취소 요청을 보내지 않는다", async () => {
      getEvents.mockResolvedValue([septemberEvent]);
      const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
      renderWithSession(<EventEditor />, sessionFixture({ admin: true }));
      fireEvent.click(await screen.findByRole("button", { name: /정기 연습/ }));
      fireEvent.click(screen.getByRole("button", { name: "이 일정 취소하기" }));
      expect(confirm.mock.calls[0][0]).toContain("이미 받은 기록은 그대로 남습니다.");
      expect(cancelEvent).not.toHaveBeenCalled();
    });

    it("확인하면 취소하고 상세에 취소됨과 되돌리기를 보여 준다", async () => {
      getEvents.mockResolvedValueOnce([septemberEvent]).mockResolvedValue([cancelledEvent]);
      cancelEvent.mockResolvedValue(cancelledEvent);
      restoreEvent.mockResolvedValue(septemberEvent);
      vi.spyOn(window, "confirm").mockReturnValue(true);
      renderWithSession(<EventEditor />, sessionFixture({ admin: true }));
      fireEvent.click(await screen.findByRole("button", { name: /정기 연습/ }));
      fireEvent.click(screen.getByRole("button", { name: "이 일정 취소하기" }));
      expect(await screen.findByText("일정을 취소했습니다.")).toBeInTheDocument();
      expect(cancelEvent).toHaveBeenCalledWith(1);
      expect(screen.getByRole("button", { name: /정기 연습.*취소됨/ })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "이 일정 취소하기" })).not.toBeInTheDocument();
      fireEvent.click(await screen.findByRole("button", { name: "취소 되돌리기" }));
      await waitFor(() => expect(restoreEvent).toHaveBeenCalledWith(1));
      expect(await screen.findByRole("button", { name: "이 일정 취소하기" })).toBeInTheDocument();
    });

    it("기록이 있어 삭제가 거부되면 서버가 알려 준 이유를 보여 주고 상세를 유지한다", async () => {
      getEvents.mockResolvedValue([cancelledEvent]);
      deleteEvent.mockRejectedValue(new ApiRequestError(409, "EVENT_HAS_RECORDS", "출석 기록이 있어 삭제할 수 없습니다."));
      vi.spyOn(window, "confirm").mockReturnValue(true);
      renderWithSession(<EventEditor />, sessionFixture({ admin: true }));
      fireEvent.click(await screen.findByRole("button", { name: /정기 연습/ }));
      fireEvent.click(screen.getByRole("button", { name: "완전히 삭제" }));
      expect(await screen.findByText("출석 기록이 있어 삭제할 수 없습니다.")).toBeInTheDocument();
      expect(screen.getByRole("heading", { level: 3, name: "정기 연습" })).toBeInTheDocument();
    });

    it("삭제하면 상세를 닫고 목록을 다시 불러온다", async () => {
      getEvents.mockResolvedValueOnce([cancelledEvent]).mockResolvedValue([]);
      deleteEvent.mockResolvedValue(undefined);
      vi.spyOn(window, "confirm").mockReturnValue(true);
      renderWithSession(<EventEditor />, sessionFixture({ admin: true }));
      fireEvent.click(await screen.findByRole("button", { name: /정기 연습/ }));
      fireEvent.click(screen.getByRole("button", { name: "완전히 삭제" }));
      expect(await screen.findByText("일정을 삭제했습니다.")).toBeInTheDocument();
      expect(await screen.findByText("이번 달 등록된 일정이 없습니다.")).toBeInTheDocument();
      expect(screen.getByText("목록에서 일정을 선택하세요.")).toBeInTheDocument();
    });
  });

  it("고른 일정에 등록한 사람을 보이고, 시각 칸을 누르면 선택기가 열리며 종료 시각은 따로 둔다", async () => {
    getEvents.mockResolvedValue([{ ...septemberEvent, createdBy: "김하늘" }]);
    renderWithSession(<EventEditor />, sessionFixture({ admin: true }));
    fireEvent.click(await screen.findByRole("button", { name: /정기 연습/ }));
    expect(await screen.findByText("등록한 사람: 김하늘")).toBeInTheDocument();
    const showPicker = vi.fn();
    HTMLInputElement.prototype.showPicker = showPicker;
    const start = screen.getByLabelText("시작 시각 (한국 시간)");
    expect(start).toHaveValue("2026-09-20T19:00");
    fireEvent.click(start);
    expect(showPicker).toHaveBeenCalledTimes(1);
    fireEvent.change(start, { target: { value: "2026-09-20T18:30" } });
    expect(screen.getByLabelText("종료 시각 (한국 시간)")).toHaveValue("2026-09-20T21:00");
    expect(start).toHaveAttribute("step", "300");
    expect(start).toHaveAttribute("min", "2000-01-01T00:00");
  });

});
