import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NoticeList } from "./NoticeList";

const getSession = vi.fn();
const getNotices = vi.fn();
vi.mock("../auth/session", () => ({ getSession: () => getSession() }));
vi.mock("./notices", () => ({ getNotices: (page: number) => getNotices(page) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));

describe("공지 목록", () => {
  beforeEach(() => {
    getSession.mockReset();
    getNotices.mockReset();
    getSession.mockResolvedValue({ status: "APPROVED" });
  });

  it("최신 공지를 먼저 표시하고 다음 페이지로 이동한다", async () => {
    getNotices.mockImplementation((page: number) => Promise.resolve(page === 0
      ? { items: [{ id: 2, title: "최근", body: "본문", author: "운영진", published: true, createdAt: "2026-09-02T00:00:00Z", updatedAt: "2026-09-02T00:00:00Z", publishedAt: "2026-09-02T00:00:00Z" }], page, size: 1, total: 2 }
      : { items: [{ id: 1, title: "이전", body: "본문", author: "운영진", published: true, createdAt: "2026-09-01T00:00:00Z", updatedAt: "2026-09-01T00:00:00Z", publishedAt: "2026-09-01T00:00:00Z" }], page, size: 1, total: 2 }));
    render(<NoticeList />);
    expect(await screen.findByText("최근")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    expect(await screen.findByText("이전")).toBeInTheDocument();
    await waitFor(() => expect(getNotices).toHaveBeenCalledWith(1));
  });

  it("공지 목록이 비면 빈 상태를 표시한다", async () => {
    getNotices.mockResolvedValue({ items: [], page: 0, size: 20, total: 0 });
    render(<NoticeList />);
    expect(await screen.findByText("게시된 공지가 없습니다.")).toBeInTheDocument();
  });
});
