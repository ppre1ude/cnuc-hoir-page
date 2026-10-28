import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventList } from "./EventList";
import type { ChoirEvent, ScheduleKind } from "./events";
import { renderWithSession, sessionFixture } from "../../test/session";

const getEvents = vi.fn();
const getMyEventRsvps = vi.fn();
vi.mock("./events", async (importOriginal) => ({
  ...await importOriginal<typeof import("./events")>(),
  getEvents: (...args: unknown[]) => getEvents(...args),
  getMyEventRsvps: (...args: unknown[]) => getMyEventRsvps(...args),
}));

const tenor = sessionFixture({ part: "TENOR" });
const TODAY = "2026-10-27T15:00:00.000Z";
const UPCOMING_TO = "2027-01-31T15:00:00.000Z";

function event(id: number, kind: ScheduleKind, title: string, startAt: string, endAt: string): ChoirEvent {
  return { id, title, description: "", startAt, endAt, kind, part: kind === "PART_REHEARSAL" ? "TENOR" : null,
    obEligible: false, publicVisible: false, createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-01T00:00:00Z" };
}

// 시각은 UTC입니다. 서울 시각은 9시간을 더합니다.
const upcoming = [
  event(1, "EXTRA_REHEARSAL", "전체 비정기연습", "2026-10-28T10:00:00Z", "2026-10-28T12:00:00Z"),
  event(9, "EVENT", "오전 사진 촬영", "2026-10-28T00:00:00Z", "2026-10-28T01:00:00Z"),
  event(2, "REGULAR_REHEARSAL", "전체 정기연습", "2026-11-01T09:00:00Z", "2026-11-01T11:00:00Z"),
  event(3, "EXTRA_REHEARSAL", "전체 비정기연습", "2026-11-03T10:00:00Z", "2026-11-03T12:00:00Z"),
  event(4, "REGULAR_REHEARSAL", "전체 정기연습", "2026-11-08T09:00:00Z", "2026-11-08T11:00:00Z"),
  event(5, "PART_REHEARSAL", "테너 파트연습", "2026-11-12T10:00:00Z", "2026-11-12T12:00:00Z"),
  event(6, "EVENT", "제2회 정기연주회", "2026-11-20T10:00:00Z", "2026-11-20T12:00:00Z"),
  event(7, "REGULAR_REHEARSAL", "새해 정기연습", "2027-01-09T09:00:00Z", "2027-01-09T11:00:00Z"),
];
const past = [
  event(21, "REGULAR_REHEARSAL", "구월 정기연습", "2026-09-14T09:00:00Z", "2026-09-14T11:00:00Z"),
  event(20, "REGULAR_REHEARSAL", "지난 정기연습", "2026-10-25T09:00:00Z", "2026-10-25T11:00:00Z"),
];

function counts(month: HTMLElement) {
  return within(within(month).getByRole("list", { name: "종류별 개수" })).getAllByRole("listitem").map((item) => item.textContent);
}

describe("다가오는 일정 목록", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-10-28T03:00:00Z"));
    getEvents.mockReset().mockImplementation((from: string) => Promise.resolve(from === TODAY ? upcoming : past));
    getMyEventRsvps.mockReset().mockResolvedValue([{ eventId: 1, choice: "ATTENDING" }]);
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it("오늘부터 3달 뒤 달 말까지 불러온다", async () => {
    renderWithSession(<EventList />, tenor);
    await screen.findByRole("region", { name: "11월" });
    expect(getEvents).toHaveBeenCalledWith(TODAY, UPCOMING_TO);
    expect(getMyEventRsvps).toHaveBeenCalledWith(TODAY, UPCOMING_TO);
  });

  it("달마다 연습 횟수와 종류별 개수를 붙이고 이번 달은 남은 것만 센다", async () => {
    renderWithSession(<EventList />, tenor);
    const october = await screen.findByRole("region", { name: "10월" });
    expect(october).toHaveTextContent("남은 연습 1회");
    expect(counts(october)).toEqual(["비정기 1", "중요 행사 1"]);
    const november = screen.getByRole("region", { name: "11월" });
    expect(november).toHaveTextContent("연습 4회");
    expect(november).not.toHaveTextContent("남은");
    expect(counts(november)).toEqual(["정기 2", "비정기 1", "파트 1", "중요 행사 1"]);
    expect(screen.getByRole("region", { name: "2027년 1월" })).toHaveTextContent("연습 1회");
    expect(screen.queryByRole("region", { name: "12월" })).not.toBeInTheDocument();
  });

  it("줄마다 종류 배지, 제목 링크, 시간, 응답 칩을 보인다", async () => {
    renderWithSession(<EventList />, tenor);
    const link = await screen.findByRole("link", { name: /제2회 정기연주회/ });
    expect(link).toHaveAttribute("href", "/events/6");
    const row = screen.getAllByRole("link", { name: /전체 비정기연습/ })[0].closest("li")!;
    expect(row).toHaveTextContent("비정기");
    expect(row).toHaveTextContent(/7:00.*~.*9:00/);
    expect(within(row).getByText("참석")).toBeInTheDocument();
  });

  it("여러 날에 걸친 일정은 끝나는 날짜를 함께 보인다", async () => {
    getEvents.mockResolvedValue([event(30, "EVENT", "가을 MT", "2026-10-30T01:00:00Z", "2026-10-31T03:00:00Z")]);
    renderWithSession(<EventList />, tenor);
    const row = (await screen.findByRole("link", { name: /가을 MT/ })).closest("li")!;
    expect(row).toHaveTextContent(/10:00~10월 31일 .*12:00/);
  });

  it("오늘 이미 끝난 일정도 남긴다", async () => {
    renderWithSession(<EventList />, tenor);
    expect(await screen.findByRole("link", { name: /오전 사진 촬영/ })).toBeInTheDocument();
  });

  it("참석 응답이 늦어도 일정을 먼저 보이고, 응답이 오면 칩을 붙인다", async () => {
    let answer: (value: unknown) => void = () => undefined;
    getMyEventRsvps.mockReturnValue(new Promise((resolve) => { answer = resolve; }));
    renderWithSession(<EventList />, tenor);
    await screen.findByRole("link", { name: /제2회 정기연주회/ });
    expect(screen.queryByText("참석")).not.toBeInTheDocument();
    answer([{ eventId: 1, choice: "ATTENDING" }]);
    expect(await screen.findByText("참석")).toBeInTheDocument();
  });

  it("참석 응답을 못 불러와도 일정은 보이고 칩만 빠진다", async () => {
    getMyEventRsvps.mockRejectedValue(new Error("응답 조회 실패"));
    renderWithSession(<EventList />, tenor);
    await screen.findByRole("link", { name: /제2회 정기연주회/ });
    expect(screen.queryByText("참석")).not.toBeInTheDocument();
    expect(screen.queryByText("미응답")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("다가오는 일정이 없으면 안내한다", async () => {
    getEvents.mockResolvedValue([]);
    renderWithSession(<EventList />, tenor);
    expect(await screen.findByText("다가오는 일정이 없습니다.")).toBeInTheDocument();
  });

  it("일정을 못 불러오면 알리고 다시 시도할 수 있다", async () => {
    getEvents.mockRejectedValueOnce(new Error("조회 실패"));
    renderWithSession(<EventList />, tenor);
    expect(await screen.findByRole("alert")).toHaveTextContent("일정을 불러오지 못했습니다.");
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(await screen.findByRole("region", { name: "11월" })).toBeInTheDocument();
  });

  it("지난 일정 보기를 누르면 지난 3달을 최신순으로 한 번 불러온다", async () => {
    renderWithSession(<EventList />, tenor);
    fireEvent.click(await screen.findByRole("button", { name: "지난 일정 보기" }));
    const newer = await screen.findByRole("link", { name: /지난 정기연습/ });
    expect(getEvents).toHaveBeenCalledWith("2026-06-30T15:00:00.000Z", TODAY);
    const older = screen.getByRole("link", { name: /구월 정기연습/ });
    expect(newer.compareDocumentPosition(older) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole("button", { name: "지난 일정 보기" })).not.toBeInTheDocument();
    // 누른 버튼이 사라지므로 키보드 초점을 새로 붙은 목록의 제목으로 옮깁니다.
    await waitFor(() => expect(screen.getByRole("heading", { name: "지난 일정" })).toHaveFocus());
  });

  it("달력으로 가는 링크가 있고 화면 문구에 가운뎃점과 대시가 없다", async () => {
    renderWithSession(<EventList />, tenor);
    await screen.findByRole("region", { name: "11월" });
    expect(screen.getByRole("link", { name: "달력" })).toHaveAttribute("href", "/dashboard");
    expect(document.body.textContent).not.toMatch(/[·—–]/);
  });
});
