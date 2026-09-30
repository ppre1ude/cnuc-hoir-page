import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventRsvp } from "./EventRsvp";

const setEventRsvp = vi.fn();
vi.mock("./events", async (importOriginal) => ({
  ...await importOriginal<typeof import("./events")>(),
  setEventRsvp: (...args: unknown[]) => setEventRsvp(...args),
}));

const event = {
  id: 7, title: "정기 연습", description: "", startAt: "2099-10-04T10:00:00Z", endAt: "2099-10-04T12:00:00Z",
  obEligible: false, publicVisible: false, createdAt: "2026-09-01T00:00:00Z", updatedAt: "2026-09-01T00:00:00Z",
};

describe("행사 참석 응답", () => {
  beforeEach(() => { setEventRsvp.mockReset(); });
  afterEach(cleanup);

  it("참석 응답을 저장하고 마감 전에는 불참으로 바꿀 수 있다", async () => {
    const onSaved = vi.fn();
    setEventRsvp.mockResolvedValueOnce({ eventId: 7, choice: "ATTENDING" })
      .mockResolvedValueOnce({ eventId: 7, choice: "ABSENT" });
    const view = render(<EventRsvp event={event} memberType="ACTIVE" choice={null} onSaved={onSaved} />);
    fireEvent.click(screen.getByRole("button", { name: "참석" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith("ATTENDING"));
    view.rerender(<EventRsvp event={event} memberType="ACTIVE" choice="ATTENDING" onSaved={onSaved} />);
    fireEvent.click(screen.getByRole("button", { name: "불참" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith("ABSENT"));
  });

  it("참여 대상이 아니거나 시작된 행사에서는 새 응답을 받지 않는다", () => {
    const onSaved = vi.fn();
    const view = render(<EventRsvp key={event.startAt} event={event} memberType="OB" choice={null} onSaved={onSaved} />);
    expect(screen.queryByRole("button", { name: "참석" })).toBeNull();
    view.rerender(<EventRsvp key="2020-10-04T10:00:00Z" event={{ ...event, startAt: "2020-10-04T10:00:00Z" }} memberType="ACTIVE" choice="ABSENT" onSaved={onSaved} />);
    expect(screen.getByLabelText("참석 응답")).toHaveTextContent("불참");
    expect(screen.queryByRole("button", { name: "참석" })).toBeNull();
    expect(setEventRsvp).not.toHaveBeenCalled();
  });
});
