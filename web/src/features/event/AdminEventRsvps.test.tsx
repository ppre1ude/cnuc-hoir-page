import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { AdminEventRsvps } from "./AdminEventRsvps";

const getAdminEventRsvps = vi.fn();
vi.mock("./events", async (importOriginal) => ({
  ...await importOriginal<typeof import("./events")>(),
  getAdminEventRsvps: (id: number) => getAdminEventRsvps(id),
}));

afterEach(cleanup);

test("참석 응답 명단은 이메일 없이 이름 옆에 파트와 기수를 붙여 동명이인을 가립니다", async () => {
  getAdminEventRsvps.mockResolvedValue({ eventId: 1, attending: 1, absent: 0, unanswered: 1, members: [
    { memberId: 1, name: "김민지", part: "SOPRANO", cohort: 5, choice: "ATTENDING" },
    { memberId: 2, name: "김민지", part: null, cohort: null, choice: null },
  ] });
  render(<AdminEventRsvps eventId={1} />);

  expect(await screen.findByText("김민지 소프라노 5기")).toBeInTheDocument();
  expect(screen.getByText("김민지")).toBeInTheDocument();
  expect(document.body).not.toHaveTextContent("@");
});
