import { afterEach, expect, test, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import MembersPage from "./page";
import { renderWithSession, sessionFixture } from "../../../../test/session";

vi.mock("../../../../features/member/MemberAccountManager", () => ({ MemberAccountManager: () => <p>본문</p> }));
afterEach(cleanup);

test("단원 정보 관리는 단원 조회 권한이 있어야 보입니다", () => {
  renderWithSession(<MembersPage />, sessionFixture({ permissions: ["MANAGE_EVENTS", "VIEW_MINUTES"] }));
  expect(screen.getByText("이 기능을 쓸 권한이 없습니다.")).toBeInTheDocument();
  expect(screen.queryByText("본문")).not.toBeInTheDocument();
  cleanup();
  renderWithSession(<MembersPage />, sessionFixture({ permissions: ["VIEW_MEMBERS"] }));
  expect(screen.getByText("본문")).toBeInTheDocument();
});
