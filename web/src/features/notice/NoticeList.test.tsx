import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NoticeList } from "./NoticeList";
import { renderWithSession } from "../../test/session";
import { nav } from "../../test/navigation";

const getNotices = vi.fn();
const getNotice = vi.fn();
vi.mock("./notices", () => ({ getNotices: (page: number) => getNotices(page), getNotice: (id: number) => getNotice(id) }));
vi.mock("./NoticePoll", () => ({ NoticePoll: () => <div>공지 투표</div> }));
vi.mock("next/navigation", () => import("../../test/navigation"));

describe("공지 목록", () => {
  afterEach(cleanup);
  beforeEach(() => {
    getNotices.mockReset();
    getNotice.mockReset();
    window.history.replaceState(null, "", "/notices");
    nav.reset();
    Element.prototype.scrollIntoView = vi.fn();
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

  it("공지 본문의 주소를 새 탭 링크로 연다", async () => {
    const notice = { id: 4, title: "참가 신청", body: "신청: https://forms.gle/abc.", author: "운영진" };
    getNotices.mockResolvedValue({ items: [notice], page: 0, size: 20, total: 1 });
    getNotice.mockResolvedValue(notice);
    renderWithSession(<NoticeList />);
    fireEvent.click(await screen.findByRole("button", { name: "참가 신청" }));
    const link = await screen.findByRole("link", { name: "https://forms.gle/abc" });
    expect(link).toHaveAttribute("href", "https://forms.gle/abc");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("대시보드에서 연결한 공지를 첫 페이지 목록 밖에서도 연다", async () => {
    window.history.replaceState(null, "", "/notices?notice=30");
    nav.search = "notice=30";
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

describe("공지 목록 쪽 넘김과 바로 펼침", () => {
  afterEach(cleanup);
  beforeEach(() => {
    getNotices.mockReset();
    getNotice.mockReset();
    nav.reset();
    Element.prototype.scrollIntoView = vi.fn();
  });
  const row = (id: number, title: string) => ({ id, title, body: `${title} 본문`, author: "운영진", publishedAt: "2026-09-02T00:00:00Z" });

  it("목록에 있는 공지는 상세 요청 없이 바로 펼친다", async () => {
    getNotices.mockResolvedValue({ items: [row(3, "참여 조사")], page: 0, size: 20, total: 1 });
    renderWithSession(<NoticeList />);
    fireEvent.click(await screen.findByRole("button", { name: "참여 조사" }));
    expect(await screen.findByText("참여 조사 본문")).toBeInTheDocument();
    expect(getNotice).not.toHaveBeenCalled();
  });

  it("범위 밖 쪽으로 들어오면 마지막 쪽으로 보정한다", async () => {
    nav.search = "page=9";
    getNotices.mockImplementation((page: number) => Promise.resolve(page === 1
      ? { items: [row(1, "둘째 쪽 공지")], page, size: 1, total: 2 }
      : { items: [], page, size: 1, total: 2 }));
    renderWithSession(<NoticeList />);
    expect(await screen.findByRole("heading", { name: "둘째 쪽 공지" })).toBeInTheDocument();
    expect(nav.replaced.at(-1)).toBe("/notices?page=2");
  });

  it("쪽을 바꾸면 주소에 남기고 본문 영역으로 초점을 옮긴다", async () => {
    getNotices.mockImplementation((page: number) => Promise.resolve({ items: [row(10 - page, `${page + 1}쪽 공지`)], page, size: 1, total: 3 }));
    renderWithSession(<NoticeList />);
    await screen.findByRole("heading", { name: "1쪽 공지" });
    fireEvent.click(screen.getByRole("button", { name: "3쪽" }));
    expect(await screen.findByRole("heading", { name: "3쪽 공지" })).toBeInTheDocument();
    expect(nav.replaced.at(-1)).toBe("/notices?page=3");
    expect(document.activeElement).toBe(document.getElementById("member-content"));
  });
});
