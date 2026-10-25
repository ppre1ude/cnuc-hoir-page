import { afterEach, expect, test, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import AdminEventsPage from "./page";
import { renderWithSession, sessionFixture } from "../../../../test/session";

vi.mock("../../../../features/event/EventEditor", () => ({ EventEditor: () => <p>본문</p> }));
afterEach(cleanup);

test("일정 관리는 일정 관리 권한이 있어야 보입니다", () => {
  renderWithSession(<AdminEventsPage />, sessionFixture({ permissions: ["VIEW_MEMBERS", "VIEW_MINUTES"] }));
  expect(screen.getByText("이 기능을 쓸 권한이 없습니다.")).toBeInTheDocument();
  expect(screen.queryByText("본문")).not.toBeInTheDocument();
  cleanup();
  renderWithSession(<AdminEventsPage />, sessionFixture({ permissions: ["MANAGE_EVENTS"] }));
  expect(screen.getByText("본문")).toBeInTheDocument();
});
