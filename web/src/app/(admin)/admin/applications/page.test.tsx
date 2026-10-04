import { afterEach, expect, test, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import ApplicationsPage from "./page";
import { renderWithSession, sessionFixture } from "../../../../test/session";

vi.mock("../../../../features/member/ApplicationQueue", () => ({ ApplicationQueue: () => <p>본문</p> }));
afterEach(cleanup);

test("가입 승인은 가입 승인 권한이 있어야 보입니다", () => {
  renderWithSession(<ApplicationsPage />, sessionFixture({ name: "수석", permissions: ["MANAGE_EVENTS", "VIEW_MEMBERS"] }));
  expect(screen.getByText("이 기능을 쓸 권한이 없습니다.")).toBeInTheDocument();
  expect(screen.queryByText("본문")).not.toBeInTheDocument();
  cleanup();
  renderWithSession(<ApplicationsPage />, sessionFixture({ permissions: ["APPROVE_APPLICATIONS"] }));
  expect(screen.getByText("본문")).toBeInTheDocument();
});
