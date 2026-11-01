import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventCalendar } from "./EventCalendar";
import { renderWithSession, sessionFixture } from "../../test/session";

const ob = sessionFixture({ memberType: "OB" });
const getEvents = vi.fn();
const getMyEventRsvps = vi.fn();
const setEventRsvp = vi.fn();
const getNotices = vi.fn();
const getEventAttendance = vi.fn();
const getMyAttendance = vi.fn();
vi.mock("./events", async (importOriginal) => ({
  ...await importOriginal<typeof import("./events")>(),
  getEvents: (...args: unknown[]) => getEvents(...args),
  getMyEventRsvps: (...args: unknown[]) => getMyEventRsvps(...args),
  setEventRsvp: (...args: unknown[]) => setEventRsvp(...args),
}));
vi.mock("../notice/notices", () => ({ getNotices: (...args: unknown[]) => getNotices(...args) }));
vi.mock("../attendance/attendance", async (importOriginal) => ({
  ...await importOriginal<typeof import("../attendance/attendance")>(),
  getEventAttendance: (...args: unknown[]) => getEventAttendance(...args),
  getMyAttendance: (...args: unknown[]) => getMyAttendance(...args),
}));

describe("일정 중심 단원 화면", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-09-27T03:00:00Z"));
    getEvents.mockReset(); getMyEventRsvps.mockReset(); setEventRsvp.mockReset();
    getNotices.mockReset();
    getEventAttendance.mockReset();
    getMyAttendance.mockReset();
    getEvents.mockResolvedValue([
      { id: 1, title: "정기 연습", description: "연습실", startAt: "2026-09-29T10:00:00Z", endAt: "2026-09-29T12:00:00Z", kind: "REGULAR_REHEARSAL", part: null, obEligible: false, publicVisible: false },
      { id: 2, title: "가을 공연", description: "공연장", startAt: "2026-09-30T10:00:00Z", endAt: "2026-09-30T12:00:00Z", kind: "EVENT", part: null, obEligible: true, publicVisible: false },
    ]);
    getNotices.mockResolvedValue({ items: [{ id: 9, title: "공연 안내", publishedAt: "2026-09-20T00:00:00Z" }], page: 0, size: 20, total: 1 });
    getMyAttendance.mockResolvedValue([]);
    getMyEventRsvps.mockResolvedValue([]);
    setEventRsvp.mockImplementation(async (id: number, choice: string) => ({ eventId: id, choice }));
    getEventAttendance.mockImplementation(async (id: number) => ({
      eventId: id, eventTitle: "행사", status: "NOT_OPEN", checkInOpen: id === 2,
    }));
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

  it("다가오는 내 일정에는 대상인 일정만 두고, 처음 열면 다가오는 첫 대상 일정을 고른다", async () => {
    getEvents.mockResolvedValue([
      { id: 31, title: "베이스 파트연습", description: "", startAt: "2026-09-27T09:00:00Z", endAt: "2026-09-27T10:30:00Z", kind: "PART_REHEARSAL", part: "BASS", obEligible: false, publicVisible: false },
      { id: 32, title: "테너 파트연습", description: "", startAt: "2026-09-27T10:00:00Z", endAt: "2026-09-27T11:30:00Z", kind: "PART_REHEARSAL", part: "TENOR", obEligible: false, publicVisible: false },
    ]);
    // 운영진은 다른 파트의 파트연습도 받아 보지만, 다가오는 내 일정에는 띄우지 않습니다.
    renderWithSession(<EventCalendar />, sessionFixture({ part: "TENOR", permissions: ["MANAGE_EVENTS", "VIEW_MINUTES"] }));
    const list = screen.getByRole("region", { name: "다가오는 내 일정" });
    expect(await within(list).findByRole("button", { name: /테너 파트연습/ })).toBeInTheDocument();
    expect(within(list).queryByRole("button", { name: /베이스 파트연습/ })).not.toBeInTheDocument();
    expect(within(list).queryByText("대상 아님")).not.toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "선택한 일정" })).getByRole("heading", { name: "테너 파트연습" })).toBeInTheDocument();
  });

  it("취소된 일정은 달력과 다가오는 일정에 취소됨으로 남고, 처음 고르는 일정에서는 빠지며, 응답을 받지 않는다", async () => {
    const practice = { description: "", kind: "REGULAR_REHEARSAL", part: null, obEligible: false, publicVisible: false };
    getEvents.mockResolvedValue([
      { ...practice, id: 61, title: "취소된 연습", startAt: "2026-09-29T10:00:00Z", endAt: "2026-09-29T12:00:00Z", cancelledAt: "2026-09-27T00:00:00Z" },
      { ...practice, id: 62, title: "다음 연습", startAt: "2026-09-30T10:00:00Z", endAt: "2026-09-30T12:00:00Z", cancelledAt: null },
    ]);
    renderWithSession(<EventCalendar />, sessionFixture());
    const detail = screen.getByRole("region", { name: "선택한 일정" });
    expect(await within(detail).findByRole("heading", { name: "다음 연습" })).toBeInTheDocument();
    const list = screen.getByRole("region", { name: "다가오는 내 일정" });
    const row = within(list).getByRole("button", { name: /취소된 연습/ });
    await waitFor(() => expect(row).toHaveTextContent("취소됨"));
    fireEvent.click(row);
    expect(await within(detail).findByText("취소된 일정입니다")).toBeInTheDocument();
    expect(within(detail).queryByLabelText("참석 응답")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /29일, 일정 1개/ })).toHaveTextContent("취소된 연습");
  });

  it("달력 칸에는 내 일정을 앞세워 두 개까지 보이고 나머지는 +N으로 줄인다", async () => {
    const part = (id: number, title: string, hour: string, value: string) => ({ id, title, description: "", startAt: `2026-09-29T${hour}:00:00Z`,
      endAt: `2026-09-29T${hour}:30:00Z`, kind: "PART_REHEARSAL", part: value, obEligible: false, publicVisible: false });
    getEvents.mockResolvedValue([part(51, "베이스 파트연습", "09", "BASS"), part(52, "알토 파트연습", "10", "ALTO"),
      part(53, "테너 파트연습", "11", "TENOR")]);
    renderWithSession(<EventCalendar />, sessionFixture({ part: "TENOR", permissions: ["MANAGE_EVENTS"] }));
    const day = await screen.findByRole("button", { name: /29일, 일정 3개/ });
    await waitFor(() => expect(day.querySelectorAll(":scope > [data-kind]")).toHaveLength(2));
    expect([...day.querySelectorAll(":scope > [data-kind]")].map((chip) => chip.textContent)).toEqual(["테너 파트연습", "베이스 파트연습"]);
    expect(within(day).getByText("+1")).toBeInTheDocument();
    // 칸에 숨은 일정까지 화면 낭독기가 시간순으로 읽습니다.
    expect(day).toHaveAccessibleDescription(/베이스 파트연습.*알토 파트연습.*테너 파트연습/);
  });

  it("목록 보기로 바꾸면 지난 일정과 대상이 아닌 일정까지 그달 일정을 모두 늘어놓는다", async () => {
    getEvents.mockResolvedValue([
      { id: 41, title: "지난 정기연습", description: "", startAt: "2026-09-06T09:00:00Z", endAt: "2026-09-06T11:00:00Z", kind: "REGULAR_REHEARSAL", part: null, obEligible: false, publicVisible: false },
      { id: 42, title: "베이스 파트연습", description: "", startAt: "2026-09-29T09:00:00Z", endAt: "2026-09-29T10:30:00Z", kind: "PART_REHEARSAL", part: "BASS", obEligible: false, publicVisible: false },
    ]);
    renderWithSession(<EventCalendar />, sessionFixture({ part: "TENOR", permissions: ["MANAGE_EVENTS"] }));
    const calendar = screen.getByRole("region", { name: "일정 달력" });
    expect(within(calendar).getByRole("button", { name: "달력 보기" })).toHaveAttribute("aria-pressed", "true");
    const listView = within(calendar).getByRole("button", { name: "목록 보기" });
    fireEvent.click(listView);
    expect(listView).toHaveAttribute("aria-pressed", "true");
    expect(within(calendar).queryByRole("table")).not.toBeInTheDocument();
    const past = await within(calendar).findByRole("button", { name: /지난 정기연습/ });
    expect(within(calendar).getByRole("button", { name: /베이스 파트연습 .*대상 아님/ })).toBeInTheDocument();
    fireEvent.click(past);
    expect(within(screen.getByRole("region", { name: "선택한 일정" })).getByRole("heading", { name: "지난 정기연습" })).toBeInTheDocument();
  });

  it("달력을 요일 머리글이 있는 표로 표시하고 오늘과 선택 날짜를 구분한다", async () => {
    renderWithSession(<EventCalendar />, ob);
    expect(screen.getByRole("table", { name: "2026년 09월" })).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader")).toHaveLength(7);
    expect(screen.getByRole("button", { name: /27일/ })).toHaveAttribute("aria-current", "date");
    expect(screen.getByRole("button", { name: /27일/ })).toHaveAttribute("aria-pressed", "true");
    expect(await screen.findByRole("link", { name: "공연 안내" })).toHaveAttribute("href", "/notices?notice=9");
  });

  it("자료 링크는 자료실로 옮겨 홈 제목 옆에 두지 않는다", () => {
    renderWithSession(<EventCalendar />, ob);
    expect(screen.getByRole("heading", { level: 1, name: "홈" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /드라이브/ })).toBeNull();
  });

  it("내 출석 요약에 행사 날짜와 요일을 함께 보여 준다", async () => {
    getMyAttendance.mockResolvedValue([
      { eventId: 7, eventTitle: "정기 연습", startAt: "2026-09-20T09:00:00Z", status: "NOT_OPEN", checkInOpen: false },
    ]);
    renderWithSession(<EventCalendar />, ob);
    const summary = screen.getByRole("region", { name: "내 출석 요약" });
    expect(await within(summary).findByRole("link", { name: /09\.20 \(일\) 정기 연습.*출석 기록 없음/ }))
      .toHaveAttribute("href", "/events/7");
  });

  it("내 출석 요약에서 출석 창이 열린 행사는 출석 전으로 보인다", async () => {
    getMyAttendance.mockResolvedValue([
      { eventId: 7, eventTitle: "정기 연습", startAt: "2026-09-27T02:50:00Z", status: "NOT_OPEN", checkInOpen: true },
    ]);
    renderWithSession(<EventCalendar />, ob);
    const summary = screen.getByRole("region", { name: "내 출석 요약" });
    expect(await within(summary).findByRole("link", { name: /정기 연습.*출석 전/ })).toBeInTheDocument();
  });

  it("다가오는 내 일정은 오늘부터 2주를 따로 받고, 달력에서 달을 넘겨도 그대로 둔다", async () => {
    vi.setSystemTime(new Date("2026-10-29T03:00:00Z"));
    const items = [
      { id: 11, title: "지난 연습", description: "", startAt: "2026-10-27T10:00:00Z", endAt: "2026-10-27T12:00:00Z", kind: "EVENT", part: null, obEligible: false, publicVisible: false },
      { id: 12, title: "전체 연습", description: "", startAt: "2026-11-02T10:00:00Z", endAt: "2026-11-02T12:00:00Z", kind: "EVENT", part: null, obEligible: false, publicVisible: false },
    ];
    getEvents.mockImplementation(async (from: string, to: string) => items.filter((item) => item.endAt > from && item.startAt < to));
    renderWithSession(<EventCalendar />, sessionFixture({ memberType: "ACTIVE" }));
    const list = screen.getByRole("region", { name: "다가오는 내 일정" });
    const next = await within(list).findByRole("button", { name: /11\.02 \(월\) 전체 연습 미응답/ });
    expect(within(list).queryByRole("button", { name: /지난 연습/ })).toBeNull();
    expect(getEvents).toHaveBeenCalledWith("2026-10-28T15:00:00.000Z", "2026-11-12T03:00:00.000Z");
    expect(getMyEventRsvps).toHaveBeenCalledWith("2026-10-28T15:00:00.000Z", "2026-11-12T03:00:00.000Z");
    // 이번 달에 남은 일정이 없으면 다가오는 첫 일정의 달로 달력을 옮겨 그날을 고릅니다.
    expect(await screen.findByRole("table", { name: "2026년 11월" })).toBeInTheDocument();
    expect(getEvents).toHaveBeenCalledWith("2026-10-31T15:00:00.000Z", "2026-11-30T15:00:00.000Z");
    const detail = screen.getByRole("region", { name: "선택한 일정" });
    expect(await within(detail).findByRole("heading", { name: "전체 연습" })).toBeInTheDocument();
    expect(await within(detail).findByRole("group", { name: "참석 응답" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "이전 달" }));
    expect(await screen.findByRole("table", { name: "2026년 10월" })).toBeInTheDocument();
    expect(within(list).getByRole("button", { name: /11\.02 \(월\) 전체 연습/ })).toBe(next);
    fireEvent.click(next);
    expect(await screen.findByRole("table", { name: "2026년 11월" })).toBeInTheDocument();
    expect(await within(detail).findByRole("heading", { name: "전체 연습" })).toBeInTheDocument();
  });

  it("다가오는 일정의 응답만 못 받으면, 그달 응답이 늦게 와도 안내와 다시 시도를 남긴다", async () => {
    let failUpcoming = true;
    getMyEventRsvps.mockImplementation(async (from: string) => {
      if (from === "2026-09-26T15:00:00.000Z" && failUpcoming) { failUpcoming = false; throw new Error("응답 장애"); }
      await new Promise((resolve) => setTimeout(resolve, 20));
      return [];
    });
    renderWithSession(<EventCalendar />, ob);
    const list = screen.getByRole("region", { name: "다가오는 내 일정" });
    expect(await within(list).findByRole("alert")).toHaveTextContent("참석 응답을 불러오지 못했습니다.");
    await waitFor(() => expect(getMyEventRsvps).toHaveBeenCalledTimes(2));
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(within(list).getByRole("alert")).toBeInTheDocument();
    fireEvent.click(within(list).getByRole("button", { name: "다시 시도" }));
    expect(await within(list).findByRole("button", { name: /가을 공연 미응답/ })).toBeInTheDocument();
    await waitFor(() => expect(within(list).queryByRole("alert")).toBeNull());
  });

  it("다가오는 일정 요청의 끝 시각은 한 시간 단위로 올려 주소를 고정하고 범위를 줄이지 않는다", async () => {
    vi.setSystemTime(new Date("2026-10-29T03:20:00Z"));
    getEvents.mockResolvedValue([]);
    renderWithSession(<EventCalendar />, sessionFixture({ memberType: "ACTIVE" }));
    await waitFor(() => expect(getEvents).toHaveBeenCalledWith("2026-10-28T15:00:00.000Z", "2026-11-12T04:00:00.000Z"));
  });

  it("빈 날을 누르면 다른 날 일정을 고르지 않고 그날 일정이 없다고 알린다", async () => {
    renderWithSession(<EventCalendar />, ob);
    // OB는 오늘 일정이 없어 다가오는 첫 일정인 가을 공연 날이 골라집니다.
    await waitFor(() => expect(screen.getByRole("button", { name: /^2026년 09월 30일/ })).toHaveAttribute("aria-pressed", "true"));
    const detail = screen.getByRole("region", { name: "선택한 일정" });
    expect(await within(detail).findByRole("heading", { name: "가을 공연" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^2026년 09월 28일/ }));
    expect(within(detail).getByText("9월 28일에는 일정이 없습니다.")).toBeInTheDocument();
    expect(within(detail).queryByRole("heading")).toBeNull();
    expect(within(screen.getByRole("region", { name: "다가오는 내 일정" })).queryByRole("button", { pressed: true })).toBeNull();
    // OB가 대상이 아닌 29일 정기 연습은 건너뛰고, 내 다음 일정인 가을 공연을 바로가기로 내밉니다.
    fireEvent.click(within(detail).getByRole("button", { name: "다음 일정: 9월 30일 (수) 가을 공연" }));
    expect(await within(detail).findByRole("heading", { name: "가을 공연" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^2026년 09월 30일/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("일정과 출석을 조회하는 동안 빈 기록으로 잘못 안내하지 않는다", () => {
    getEvents.mockReturnValue(new Promise(() => {}));
    getMyAttendance.mockReturnValue(new Promise(() => {}));
    renderWithSession(<EventCalendar />, ob);
    expect(screen.getByText("일정을 불러오는 중입니다.")).toBeInTheDocument();
    expect(screen.queryByText("일정 없음")).not.toBeInTheDocument();
    expect(screen.queryByText("등록된 일정이 없습니다.")).not.toBeInTheDocument();
    expect(screen.queryByText("앞으로 2주 동안 내 일정이 없습니다.")).not.toBeInTheDocument();
    expect(screen.queryByText("출석 기록이 없습니다.")).not.toBeInTheDocument();
  });

  it("날짜를 고르면 해당 행사 상세와 OB 출석 대상 여부를 표시한다", async () => {
    renderWithSession(<EventCalendar />, ob);
    await screen.findByRole("button", { name: /29일/ });
    fireEvent.click(screen.getByRole("button", { name: /29일/ }));
    expect(await screen.findByRole("heading", { name: "정기 연습" })).toBeInTheDocument();
    expect(screen.getByText("OB 참여 불가")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^2026년 09월 30일/ }));
    expect(await screen.findByRole("heading", { name: "가을 공연" })).toBeInTheDocument();
    expect(screen.getByText("OB 참여 가능")).toBeInTheDocument();
    await waitFor(() => expect(getEvents).toHaveBeenCalledTimes(2));
  });

  it("달력, 다가오는 내 일정, 선택 행사, 최근 공지, 출석 요약 순서로 배치한다", async () => {
    renderWithSession(<EventCalendar />, ob);
    const calendar = await screen.findByRole("region", { name: "일정 달력" });
    const list = screen.getByRole("region", { name: "다가오는 내 일정" });
    const detail = screen.getByRole("region", { name: "선택한 일정" });
    const notices = screen.getByRole("region", { name: "최근 공지" });
    const attendance = screen.getByRole("region", { name: "내 출석 요약" });
    expect(calendar.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(list.compareDocumentPosition(detail) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(detail.compareDocumentPosition(notices) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(notices.compareDocumentPosition(attendance) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(await screen.findByText("공연 안내")).toBeInTheDocument();
  });

  it("출석 창이 열린 대상 행사에서만 참여 경로를 보여준다", async () => {
    renderWithSession(<EventCalendar />, ob);
    fireEvent.click(await screen.findByRole("button", { name: /29일/ }));
    expect(await screen.findByRole("heading", { name: "정기 연습" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "현장 출석하기" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^2026년 09월 30일/ }));
    expect(await screen.findByRole("heading", { name: "가을 공연" })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "현장 출석하기" })).toHaveAttribute("href", "/events/2/check-in");
  });

  it("출석 창이 열린 내 일정은 어느 일정을 골랐든 맨 위에 출석 안내를 띄우고, 창이 닫히면 내린다", async () => {
    const practice = { description: "", kind: "REGULAR_REHEARSAL", part: null, obEligible: false, publicVisible: false, cancelledAt: null };
    getEvents.mockResolvedValue([
      { ...practice, id: 2, title: "곧 시작하는 연습", startAt: "2026-09-27T03:20:00Z", endAt: "2026-09-27T05:00:00Z" },
      { ...practice, id: 3, title: "내일 연습", startAt: "2026-09-28T03:20:00Z", endAt: "2026-09-28T05:00:00Z" },
    ]);
    renderWithSession(<EventCalendar />, sessionFixture());
    const banner = await screen.findByRole("region", { name: "지금 출석" });
    expect(banner).toHaveTextContent("곧 시작하는 연습");
    expect(within(banner).getByRole("link", { name: "현장 출석하기" })).toHaveAttribute("href", "/events/2/check-in");
    // 시작까지 30분이 넘게 남은 일정은 물어보지 않습니다.
    expect(getEventAttendance).not.toHaveBeenCalledWith(3);
    getEventAttendance.mockResolvedValue({ eventId: 2, eventTitle: "행사", status: "CHECKED_IN", checkInOpen: false });
    await vi.advanceTimersByTimeAsync(15000);
    await waitFor(() => expect(screen.queryByRole("region", { name: "지금 출석" })).toBeNull());
  });

  it("목록에서 행사를 고르고 상세에서 응답하면 목록 칩이 바뀐다", async () => {
    renderWithSession(<EventCalendar />, sessionFixture({ memberType: "ACTIVE" }));
    const list = screen.getByRole("region", { name: "다가오는 내 일정" });
    const detail = screen.getByRole("region", { name: "선택한 일정" });
    fireEvent.click(await within(list).findByRole("button", { name: /가을 공연 미응답/ }));
    expect(await within(detail).findByRole("heading", { name: "가을 공연" })).toBeInTheDocument();
    fireEvent.click(within(detail).getByRole("button", { name: "참석" }));
    await waitFor(() => expect(setEventRsvp).toHaveBeenCalledWith(2, "ATTENDING"));
    expect(await within(list).findByRole("button", { name: /가을 공연 참석$/ })).toHaveAttribute("aria-pressed", "true");
    // 눌린 표시는 서버 응답 전에 먼저 바뀌므로, 저장이 끝난 뒤에 다음 응답을 누릅니다.
    await waitFor(() => expect(within(detail).getByRole("group", { name: "참석 응답" })).toHaveAttribute("aria-busy", "false"));
    fireEvent.click(within(detail).getByRole("button", { name: "불참" }));
    await waitFor(() => expect(setEventRsvp).toHaveBeenCalledWith(2, "ABSENT"));
    expect(await within(list).findByRole("button", { name: /가을 공연 불참$/ })).toBeInTheDocument();
  });

  it("목록 행은 응답 버튼 없이 종류 아이콘과 응답 상태만 보여 준다", async () => {
    getMyEventRsvps.mockResolvedValue([{ eventId: 1, choice: "ABSENT" }, { eventId: 2, choice: null }]);
    const view = renderWithSession(<EventCalendar />, ob);
    const list = screen.getByRole("region", { name: "다가오는 내 일정" });
    // OB 대상이 아닌 정기 연습은 OB의 목록에서 빠지고(달력 칸에는 남음), 가을 공연은 미응답으로 보입니다.
    expect(await within(list).findByRole("button", { name: /09\.30 \(수\) 가을 공연 미응답/ })).toBeInTheDocument();
    expect(within(list).queryByRole("button", { name: /정기 연습/ })).toBeNull();
    expect(within(list).queryByRole("button", { name: /^참석$|^불참$/ })).toBeNull();
    expect(view.container.querySelectorAll("[data-kind='regular']").length).toBeGreaterThan(0);
    expect(view.container.querySelectorAll("[data-kind='concert']").length).toBeGreaterThan(0);
  });

  it("폰 너비에서는 목록 행을 누르면 상세로 내려간다", async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
    renderWithSession(<EventCalendar />, ob);
    const list = screen.getByRole("region", { name: "다가오는 내 일정" });
    fireEvent.click(await within(list).findByRole("button", { name: /가을 공연/ }));
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    vi.unstubAllGlobals();
  });

  it("달을 바꾸면 행사만 다시 받고 세션은 다시 받지 않는다", async () => {
    // 행사·공지·출석 요청은 모두 목이므로 fetch가 불리면 세션 요청입니다.
    const fetch = vi.spyOn(globalThis, "fetch");
    renderWithSession(<EventCalendar />, ob);
    // 처음에는 달력과 다가오는 내 일정이 따로 받습니다.
    await waitFor(() => expect(getEvents).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole("button", { name: "다음 달" }));
    await waitFor(() => expect(getEvents).toHaveBeenCalledTimes(3));
    expect(screen.getByRole("table", { name: "2026년 10월" })).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("공지 조회가 실패해도 행사를 탐색하고 공지만 다시 불러온다", async () => {
    getNotices.mockRejectedValueOnce(new Error("공지 장애"));
    renderWithSession(<EventCalendar />, ob);
    fireEvent.click(await screen.findByRole("button", { name: /29일/ }));
    expect(await screen.findByRole("heading", { name: "정기 연습" })).toBeInTheDocument();
    const noticeRegion = screen.getByRole("region", { name: "최근 공지" });
    expect(within(noticeRegion).getByRole("alert")).toHaveTextContent("공지를 불러오지 못했습니다.");
    fireEvent.click(within(noticeRegion).getByRole("button", { name: "다시 시도" }));
    expect(await within(noticeRegion).findByText("공연 안내")).toBeInTheDocument();
    expect(getEvents).toHaveBeenCalledTimes(2);
  });
});
