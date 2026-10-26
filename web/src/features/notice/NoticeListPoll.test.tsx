import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NoticeList } from "./NoticeList";
import { NoticePollPreview } from "./NoticePollPreview";
import { renderWithSession } from "../../test/session";
import type { PollView } from "./notices";

const api = vi.hoisted(() => ({ getNotices: vi.fn(), getNotice: vi.fn(), getNoticePoll: vi.fn(), voteNoticePoll: vi.fn() }));
vi.mock("./notices", () => api);

const poll: PollView = { question: "연습에 참석하시나요?", firstOption: "참석", secondOption: "불참",
  closesAt: "2099-01-01T00:00:00Z", closed: false, firstCount: 0, secondCount: 0, myChoice: null };
const notice = { id: 1, title: "연습 참여 조사", body: "연습 공지 본문", author: "운영진", poll };

describe("공지 목록 투표 미리보기", () => {
  afterEach(() => { cleanup(); vi.useRealTimers(); });
  beforeEach(() => {
    vi.resetAllMocks();
    api.getNotices.mockResolvedValue({ items: [notice], page: 0, size: 20, total: 1 });
    api.getNotice.mockResolvedValue(notice);
    api.getNoticePoll.mockResolvedValue(poll);
  });

  it("투표가 있는 공지에만 미참여·본인 선택·마감 상태를 표시한다", async () => {
    api.getNotices.mockResolvedValue({ items: [notice,
      { ...notice, id: 2, title: "참여한 조사", poll: { ...poll, myChoice: 2 } },
      { ...notice, id: 3, title: "끝난 조사", poll: { ...poll, closed: true, myChoice: 1 } },
      { ...notice, id: 4, title: "일반 공지", poll: null }], page: 0, size: 20, total: 4 });
    renderWithSession(<NoticeList />);
    const trigger = await screen.findByRole("button", { name: "연습 참여 조사" });
    expect(trigger).toHaveAccessibleDescription("미참여");
    expect(screen.getByText("미참여").className).toContain("neutral");
    expect(screen.getByRole("button", { name: "참여한 조사" })).toHaveAccessibleDescription("불참");
    expect(screen.getByText("불참").className).toContain("positive");
    expect(screen.getByText("마감 · 참석").className).toContain("neutral");
    expect(screen.getByRole("button", { name: "일반 공지" })).not.toHaveAttribute("aria-describedby");
    expect(api.getNoticePoll).not.toHaveBeenCalled();
  });

  it("저장에 성공한 선택만 목록에 반영하고 변경 후 닫아도 새 선택을 유지한다", async () => {
    api.voteNoticePoll.mockResolvedValueOnce({ ...poll, myChoice: 1, firstCount: 1 })
      .mockResolvedValueOnce({ ...poll, myChoice: 2, secondCount: 1 });
    renderWithSession(<NoticeList />);
    const trigger = await screen.findByRole("button", { name: "연습 참여 조사" });
    fireEvent.click(trigger);
    fireEvent.click(await screen.findByRole("radio", { name: /^참석/ }));
    expect(trigger).toHaveAccessibleDescription("미참여");
    fireEvent.click(screen.getByRole("button", { name: "투표하기" }));
    await waitFor(() => expect(trigger).toHaveAccessibleDescription("참석"));
    fireEvent.click(screen.getByRole("radio", { name: /^불참/ }));
    expect(trigger).toHaveAccessibleDescription("참석");
    // 내 선택은 서버 응답 전에 먼저 보이므로, 저장이 끝나 버튼 이름이 바뀔 때까지 기다립니다.
    await waitFor(() => expect(screen.getByRole("button", { name: "선택 변경" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "선택 변경" }));
    await waitFor(() => expect(trigger).toHaveAccessibleDescription("불참"));
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(trigger).toHaveAccessibleDescription("불참");
    expect(trigger).toHaveFocus();
    expect(api.voteNoticePoll.mock.calls).toEqual([[1, 1], [1, 2]]);
  });

  it("저장 실패 시 선택을 목록에 반영하지 않고 재시도할 수 있다", async () => {
    api.voteNoticePoll.mockRejectedValueOnce(new Error("연결 실패"));
    renderWithSession(<NoticeList />);
    const trigger = await screen.findByRole("button", { name: "연습 참여 조사" });
    fireEvent.click(trigger);
    fireEvent.click(await screen.findByRole("radio", { name: /^참석/ }));
    fireEvent.click(screen.getByRole("button", { name: "투표하기" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("투표를 저장하지 못했습니다.");
    expect(trigger).toHaveAccessibleDescription("미참여");
    expect(screen.getByRole("button", { name: "투표하기" })).toBeEnabled();
  });

  it("상세 조회에서 마감을 확인하면 목록에서도 마감 상태와 선택을 유지한다", async () => {
    api.getNoticePoll.mockResolvedValue({ ...poll, closed: true, myChoice: 2, secondCount: 1 });
    renderWithSession(<NoticeList />);
    const trigger = await screen.findByRole("button", { name: "연습 참여 조사" });
    fireEvent.click(trigger);
    await screen.findByText("마감 · 불참");
    expect(trigger).toHaveAccessibleDescription("마감 · 불참");
    expect(within(screen.getByRole("form", { name: poll.question })).queryByRole("button")).not.toBeInTheDocument();
  });

  it("목록을 열어 둔 채 마감 시각이 지나면 새로고침 없이 회색 마감 상태로 전환한다", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T00:00:00Z"));
    render(<NoticePollPreview id="deadline-status" poll={{ ...poll, closesAt: "2026-10-01T00:00:01Z", myChoice: 1 }} />);
    expect(screen.getByText("참석").className).toContain("positive");
    await act(async () => { vi.advanceTimersByTime(1001); });
    expect(screen.getByText("마감 · 참석").className).toContain("neutral");
  });
});
