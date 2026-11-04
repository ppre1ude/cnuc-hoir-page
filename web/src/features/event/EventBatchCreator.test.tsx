import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventBatchCreator } from "./EventBatchCreator";
import { ApiRequestError } from "../../lib/api";
import { renderWithSession, sessionFixture } from "../../test/session";

const vicePresident = sessionFixture({ roles: [{ id: 1, role: "VICE_PRESIDENT", department: null, unit: null, part: null }],
  permissions: ["MANAGE_FULL_REHEARSALS", "MANAGE_PART_REHEARSALS", "MANAGE_PART_ATTENDANCE", "MANAGE_EVENTS", "VIEW_MINUTES"] });
const tenorLead = sessionFixture({ part: "TENOR", roles: [{ id: 2, role: "SECTION_LEAD", department: null, unit: null, part: "TENOR" }],
  permissions: ["MANAGE_EVENTS", "WRITE_MINUTES", "VIEW_MEMBERS", "VIEW_MINUTES"] });

const createEventsBatch = vi.fn();
vi.mock("./events", async (importOriginal) => ({
  ...await importOriginal<typeof import("./events")>(),
  createEventsBatch: (...args: unknown[]) => createEventsBatch(...args),
}));

describe("운영진 월간 일정 등록", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-09-30T00:00:00Z"));
    createEventsBatch.mockReset().mockResolvedValue([]);
    localStorage.clear();
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it("선택한 여러 날짜를 한 번의 요청으로 등록하고 해당 월 목록을 새로고침한다", async () => {
    const onCreated = vi.fn();
    renderWithSession(<EventBatchCreator onCreated={onCreated} />, vicePresident);
    fireEvent.change(screen.getByLabelText("월"), { target: { value: "2026-10" } });
    const sunday = screen.getByRole("button", { name: "4일" });
    expect(Array.from(sunday.parentElement!.children).indexOf(sunday) % 7).toBe(0);
    fireEvent.click(sunday);
    fireEvent.click(screen.getByRole("button", { name: "11일" }));
    fireEvent.change(screen.getByLabelText("공통 시작 시각 (한국 시간)"), { target: { value: "19:00" } });
    fireEvent.change(screen.getByLabelText("공통 종료 시각 (한국 시간)"), { target: { value: "21:00" } });
    fireEvent.click(screen.getByRole("button", { name: "2개 일정 등록" }));
    await waitFor(() => expect(createEventsBatch).toHaveBeenCalledTimes(1));
    expect(createEventsBatch.mock.calls[0][0]).toEqual([
      expect.objectContaining({ title: "정기연습", description: "", startAt: "2026-10-04T10:00:00.000Z", endAt: "2026-10-04T12:00:00.000Z",
        kind: "REGULAR_REHEARSAL", part: null }),
      expect.objectContaining({ title: "정기연습", description: "", startAt: "2026-10-11T10:00:00.000Z", endAt: "2026-10-11T12:00:00.000Z",
        kind: "REGULAR_REHEARSAL", part: null }),
    ]);
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith("2026-10"));
  });

  it("종류는 정기연습, 비정기연습, 파트연습, 중요 행사 순서이고 고르면 제목이 따라 바뀐다", () => {
    renderWithSession(<EventBatchCreator onCreated={vi.fn()} />, vicePresident);
    const select = screen.getByLabelText("종류") as HTMLSelectElement;
    expect(Array.from(select.options).map((option) => option.textContent)).toEqual(["정기연습", "비정기연습", "파트연습", "중요 행사"]);
    expect(screen.getByLabelText("제목")).toHaveValue("정기연습");
    fireEvent.change(select, { target: { value: "EXTRA_REHEARSAL" } });
    expect(screen.getByLabelText("제목")).toHaveValue("비정기연습");
  });

  it("월을 지우면 날짜를 고를 수 없고 등록 버튼도 꺼진다", () => {
    renderWithSession(<EventBatchCreator onCreated={vi.fn()} />, vicePresident);
    fireEvent.click(screen.getByRole("button", { name: "4일" }));
    fireEvent.change(screen.getByLabelText("월"), { target: { value: "" } });
    expect(screen.queryByRole("button", { name: "4일" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "0개 일정 등록" })).toBeDisabled();
  });

  it("서버가 알려 준 중복 일정 안내를 그대로 보여 준다", async () => {
    const message = "2026년 10월 4일 19:00에 시작하는 일정이 이미 있습니다. 그 날짜를 빼고 다시 등록해 주세요.";
    createEventsBatch.mockRejectedValue(new ApiRequestError(409, "DUPLICATE_EVENT_TIME", message));
    const onCreated = vi.fn();
    renderWithSession(<EventBatchCreator onCreated={onCreated} />, vicePresident);
    fireEvent.change(screen.getByLabelText("월"), { target: { value: "2026-10" } });
    fireEvent.click(screen.getByRole("button", { name: "4일" }));
    fireEvent.change(screen.getByLabelText("공통 시작 시각 (한국 시간)"), { target: { value: "19:00" } });
    fireEvent.change(screen.getByLabelText("공통 종료 시각 (한국 시간)"), { target: { value: "21:00" } });
    fireEvent.click(screen.getByRole("button", { name: "1개 일정 등록" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("수석은 자기 파트의 파트연습과 행사만 등록하고, 파트연습 제목은 파트 이름으로 채운다", async () => {
    renderWithSession(<EventBatchCreator onCreated={vi.fn()} />, tenorLead);
    const kind = screen.getByLabelText("종류");
    expect([...kind.querySelectorAll("option")].map((option) => option.textContent)).toEqual(["파트연습", "중요 행사"]);
    expect([...screen.getByLabelText("파트").querySelectorAll("option")].map((option) => option.textContent)).toEqual(["테너"]);
    expect(screen.getByLabelText("제목")).toHaveValue("테너 파트연습");
    fireEvent.change(screen.getByLabelText("월"), { target: { value: "2026-10" } });
    fireEvent.click(screen.getByRole("button", { name: "27일" }));
    fireEvent.change(screen.getByLabelText("공통 시작 시각 (한국 시간)"), { target: { value: "19:30" } });
    fireEvent.change(screen.getByLabelText("공통 종료 시각 (한국 시간)"), { target: { value: "21:30" } });
    fireEvent.click(screen.getByRole("button", { name: "1개 일정 등록" }));
    await waitFor(() => expect(createEventsBatch).toHaveBeenCalledTimes(1));
    expect(createEventsBatch.mock.calls[0][0]).toEqual([expect.objectContaining({ title: "테너 파트연습",
      startAt: "2026-10-27T10:30:00.000Z", endAt: "2026-10-27T12:30:00.000Z", kind: "PART_REHEARSAL", part: "TENOR" })]);
  });

  it("직접 고친 제목은 종류를 바꿔도 덮어쓰지 않는다", () => {
    renderWithSession(<EventBatchCreator onCreated={vi.fn()} />, tenorLead);
    fireEvent.change(screen.getByLabelText("제목"), { target: { value: "테너 보충 연습" } });
    fireEvent.change(screen.getByLabelText("종류"), { target: { value: "EVENT" } });
    expect(screen.getByLabelText("제목")).toHaveValue("테너 보충 연습");
    expect(screen.queryByLabelText("파트")).not.toBeInTheDocument();
  });

  it("시각 칸을 누르면 바로 선택기가 열리고, 분은 5분 단위이며, 종료 시각은 따로 고른다", () => {
    const showPicker = vi.fn();
    HTMLInputElement.prototype.showPicker = showPicker;
    renderWithSession(<EventBatchCreator onCreated={vi.fn()} />, vicePresident);
    const start = screen.getByLabelText("공통 시작 시각 (한국 시간)");
    const end = screen.getByLabelText("공통 종료 시각 (한국 시간)");
    fireEvent.click(start);
    expect(showPicker).toHaveBeenCalledTimes(1);
    // 5분 간격의 기준점을 자정으로 못 박습니다. min이 없으면 크롬 선택기가 빈 칸을 지금 시각에서 시작해 29, 34처럼 어긋난 분을 보여 줍니다.
    expect(start).toHaveAttribute("step", "300");
    expect(start).toHaveAttribute("min", "00:00");
    expect(end).toHaveAttribute("step", "300");
    expect(end).toHaveAttribute("min", "00:00");
    fireEvent.change(start, { target: { value: "19:00" } });
    expect(end).toHaveValue("");
  });

  it("마지막에 등록한 시각을 기억해 다음에 열 때 채워 둔다", () => {
    localStorage.setItem("event-batch-times", JSON.stringify({ start: "19:30", end: "21:30" }));
    renderWithSession(<EventBatchCreator onCreated={vi.fn()} />, vicePresident);
    expect(screen.getByLabelText("공통 시작 시각 (한국 시간)")).toHaveValue("19:30");
    expect(screen.getByLabelText("공통 종료 시각 (한국 시간)")).toHaveValue("21:30");
    localStorage.removeItem("event-batch-times");
  });

});
