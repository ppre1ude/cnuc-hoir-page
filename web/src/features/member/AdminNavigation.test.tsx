import { afterEach, expect, test, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import { AdminNavigation } from "./AdminNavigation";
import { renderWithSession, sessionFixture } from "../../test/session";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/events" }));

afterEach(cleanup);

test("수석에게는 공지 관리, 일정 관리, 단원 정보 관리만 보입니다", () => {
  renderWithSession(<AdminNavigation />, sessionFixture({ name: "수석",
    permissions: ["MANAGE_EVENTS", "WRITE_MINUTES", "VIEW_MEMBERS", "VIEW_MINUTES"] }));
  expect(screen.getByRole("link", { name: "일정 관리" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "단원 정보 관리" })).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "가입 승인" })).not.toBeInTheDocument();
});

test("사이트 관리자에게는 모든 메뉴가 보입니다", () => {
  renderWithSession(<AdminNavigation />, sessionFixture({ name: "관리자", admin: true }));
  expect(screen.getByRole("link", { name: "가입 승인" })).toBeInTheDocument();
});
