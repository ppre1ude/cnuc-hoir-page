import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import { NoticeManager } from "./NoticeManager";
import { getAdminNotices, type Notice } from "./notices";
import { nav } from "../../test/navigation";
import { renderWithSession, sessionFixture } from "../../test/session";

vi.mock("./notices", () => ({ getAdminNotices: vi.fn() }));
vi.mock("next/navigation", () => import("../../test/navigation"));

const staff = sessionFixture({ permissions: ["MANAGE_EVENTS"] });
const notice = (id: number, title: string, published: boolean): Notice => ({
  id, title, body: "본문", author: "운영진", published, createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-05T00:00:00Z", publishedAt: published ? "2026-10-02T00:00:00Z" : null,
});

beforeEach(() => {
  nav.reset();
  nav.pathname = "/admin/notices";
  Element.prototype.scrollIntoView = vi.fn();
  vi.mocked(getAdminNotices).mockResolvedValue({ items: [notice(5, "연주회 안내", true), notice(6, "초안 공지", false)], page: 0, size: 20, total: 2 });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

test("공지를 제목, 상태, 날짜와 수정 화면 링크로 늘어놓습니다", async () => {
  renderWithSession(<NoticeManager />, staff);
  const published = await screen.findByRole("link", { name: /연주회 안내/ });
  expect(published).toHaveAttribute("href", "/admin/notices/5");
  expect(published).toHaveTextContent("게시");
  expect(published).toHaveTextContent("2026. 10. 2.");
  const draft = screen.getByRole("link", { name: /초안 공지/ });
  expect(draft).toHaveTextContent("초안");
  expect(draft).toHaveTextContent("2026. 10. 5.");
});

test("새 공지 작성 링크가 제목 옆에 있습니다", async () => {
  renderWithSession(<NoticeManager />, staff);
  expect(await screen.findByRole("link", { name: "새 공지 작성" })).toHaveAttribute("href", "/admin/notices/new");
});

test("2쪽의 행 링크는 쪽 번호를 들고 갑니다", async () => {
  nav.search = "page=2";
  vi.mocked(getAdminNotices).mockResolvedValue({ items: [notice(5, "연주회 안내", true)], page: 1, size: 1, total: 2 });
  renderWithSession(<NoticeManager />, staff);
  expect(await screen.findByRole("link", { name: /연주회 안내/ })).toHaveAttribute("href", "/admin/notices/5?page=2");
  expect(getAdminNotices).toHaveBeenCalledWith(1);
});

test("돌아온 결과 안내를 한 번 보이고 주소에서 지웁니다", async () => {
  nav.search = "done=published&page=2";
  vi.mocked(getAdminNotices).mockResolvedValue({ items: [notice(5, "연주회 안내", true)], page: 1, size: 1, total: 2 });
  renderWithSession(<NoticeManager />, staff);
  expect(await screen.findByText("공지를 게시했습니다.")).toBeInTheDocument();
  await waitFor(() => expect(nav.replaced.at(-1)).toBe("/admin/notices?page=2"));
  expect(screen.getByText("공지를 게시했습니다.")).toBeInTheDocument();
  expect(await screen.findByRole("link", { name: /연주회 안내/ })).toBeInTheDocument();
  expect(getAdminNotices).toHaveBeenCalledTimes(1);
});

test("빈 목록과 실패를 안내합니다", async () => {
  vi.mocked(getAdminNotices).mockResolvedValue({ items: [], page: 0, size: 20, total: 0 });
  renderWithSession(<NoticeManager />, staff);
  expect(await screen.findByText(/작성된 공지가 없습니다/)).toBeInTheDocument();
  cleanup();
  vi.mocked(getAdminNotices).mockRejectedValue(new Error("끊김"));
  renderWithSession(<NoticeManager />, staff);
  expect(await screen.findByRole("alert")).toHaveTextContent("공지 목록을 불러오지 못했습니다.");
  expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
});
