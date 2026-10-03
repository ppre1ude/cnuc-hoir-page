import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { AdminNavigation } from "./AdminNavigation";
import { getSession } from "../auth/session";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/events" }));
vi.mock("../auth/session", async (original) => ({ ...(await original<typeof import("../auth/session")>()), getSession: vi.fn() }));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

test("수석에게는 공지·행사 관리와 단원 계정만 보입니다", async () => {
  vi.mocked(getSession).mockResolvedValue({ id: 3, name: "수석", status: "APPROVED", memberType: "ACTIVE", admin: false,
    permissions: ["MANAGE_EVENTS", "WRITE_MINUTES", "VIEW_MEMBERS", "VIEW_MINUTES"] });
  render(<AdminNavigation />);
  expect(await screen.findByRole("link", { name: "행사 관리" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "단원 계정" })).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "가입 승인" })).not.toBeInTheDocument();
});

test("사이트 관리자에게는 모든 메뉴가 보입니다", async () => {
  vi.mocked(getSession).mockResolvedValue({ id: 1, name: "관리자", status: "APPROVED", memberType: "ACTIVE", admin: true });
  render(<AdminNavigation />);
  expect(await screen.findByRole("link", { name: "가입 승인" })).toBeInTheDocument();
});
