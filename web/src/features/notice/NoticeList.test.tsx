import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NoticeList } from "./NoticeList";
import { renderWithSession } from "../../test/session";

const getNotices = vi.fn();
const getNotice = vi.fn();
vi.mock("./notices", () => ({ getNotices: (page: number) => getNotices(page), getNotice: (id: number) => getNotice(id) }));
vi.mock("./NoticePoll", () => ({ NoticePoll: () => <div>공지 투표</div> }));

describe("공지 목록", () => {
  afterEach(cleanup);
  beforeEach(() => {
    getNotices.mockReset();
    getNotice.mockReset();
    window.history.replaceState(null, "", "/notices");
  });

  it("제목 바로 아래 본문을 펼치고 닫으면 제목으로 초점을 돌린다", async () => {
    const notice = { id: 3, title: "참여 조사", body: "조사 본문", author: "운영진", publishedAt: "2026-09-02T00:00:00Z" };
    getNotices.mockResolvedValue({ items: [notice], page: 0, size: 20, total: 1 });
    getNotice.mockResolvedValue(notice);
    renderWithSession(<NoticeList />);
    const trigger = await screen.findByRole("button", { name: "참여 조사" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    expect(await screen.findByText("조사 본문")).toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const panel = document.getElementById(trigger.getAttribute("aria-controls")!);
    expect(panel).toContainElement(screen.getByText("조사 본문"));
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(trigger).toHaveFocus();
    expect(screen.queryByText("조사 본문")).not.toBeInTheDocument();
  });

  it("빠르게 다른 공지를 선택해도 늦게 도착한 본문이 현재 선택을 덮지 않는다", async () => {
    let resolveFirst!: (value: unknown) => void;
    const first = { id: 1, title: "첫 공지", body: "오래된 본문", author: "운영진" };
    const second = { id: 2, title: "둘째 공지", body: "현재 본문", author: "운영진" };
    getNotices.mockResolvedValue({ items: [first, second], page: 0, size: 20, total: 2 });
    getNotice.mockImplementation((id: number) => id === 1 ? new Promise((resolve) => { resolveFirst = resolve; }) : Promise.resolve(second));
    renderWithSession(<NoticeList />);
    fireEvent.click(await screen.findByRole("button", { name: "첫 공지" }));
    await waitFor(() => expect(getNotice).toHaveBeenCalledWith(1));
    fireEvent.click(screen.getByRole("button", { name: "둘째 공지" }));
    await screen.findByText("현재 본문");
    resolveFirst(first);
    await waitFor(() => expect(screen.queryByText("오래된 본문")).not.toBeInTheDocument());
    expect(screen.getByText("현재 본문")).toBeInTheDocument();
  });

  it("대시보드에서 연결한 공지를 첫 페이지 목록 밖에서도 연다", async () => {
    window.history.replaceState(null, "", "/notices?notice=30");
    getNotices.mockResolvedValue({ items: [], page: 0, size: 20, total: 0 });
    getNotice.mockResolvedValue({ id: 30, title: "연결한 공지", body: "연결한 본문" });
    renderWithSession(<NoticeList initialNoticeId={30} />);
    expect(await screen.findByText("연결한 본문")).toBeInTheDocument();
    expect(getNotice).toHaveBeenCalledWith(30);
  });

  it("최신 공지를 먼저 표시하고 다음 페이지로 이동한다", async () => {
    getNotices.mockImplementation((page: number) => Promise.resolve(page === 0
      ? { items: [{ id: 2, title: "최근", body: "본문", author: "운영진", published: true, createdAt: "2026-09-02T00:00:00Z", updatedAt: "2026-09-02T00:00:00Z", publishedAt: "2026-09-02T00:00:00Z" }], page, size: 1, total: 2 }
      : { items: [{ id: 1, title: "이전", body: "본문", author: "운영진", published: true, createdAt: "2026-09-01T00:00:00Z", updatedAt: "2026-09-01T00:00:00Z", publishedAt: "2026-09-01T00:00:00Z" }], page, size: 1, total: 2 }));
    renderWithSession(<NoticeList />);
    expect(await screen.findByText("최근")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    expect(await screen.findByRole("heading", { name: "이전" })).toBeInTheDocument();
    await waitFor(() => expect(getNotices).toHaveBeenCalledWith(1));
  });

  it("공지 목록이 비면 빈 상태를 표시한다", async () => {
    getNotices.mockResolvedValue({ items: [], page: 0, size: 20, total: 0 });
    renderWithSession(<NoticeList />);
    expect(await screen.findByText("게시된 공지가 없습니다.")).toBeInTheDocument();
  });

  it("다음 페이지 조회 실패 시 이전 페이지를 새 페이지로 표시하지 않고 재시도 후 오류를 지운다", async () => {
    getNotices.mockImplementation((page: number) => page === 0
      ? Promise.resolve({ items: [{ id: 1, title: "첫 페이지", author: "운영진", publishedAt: "2026-09-01T00:00:00Z" }], page, size: 1, total: 2 })
      : getNotices.mock.calls.filter(([requested]) => requested === 1).length === 1
        ? Promise.reject(new Error("네트워크 오류"))
        : Promise.resolve({ items: [{ id: 2, title: "둘째 페이지", author: "운영진", publishedAt: "2026-09-02T00:00:00Z" }], page, size: 1, total: 2 }));
    renderWithSession(<NoticeList />);
    await screen.findByText("첫 페이지");
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("공지 목록을 불러오지 못했습니다.");
    expect(screen.queryByText("첫 페이지")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(await screen.findByText("둘째 페이지")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
