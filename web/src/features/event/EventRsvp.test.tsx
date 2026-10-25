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

describe("참석 응답 표시", () => {
  beforeEach(() => { setEventRsvp.mockReset(); });
  afterEach(cleanup);
  const past = { ...event, startAt: "2020-10-04T10:00:00Z" };

  it("지난 일정의 목록 응답은 출석과 헷갈리지 않게 응답이라고 쓴다", () => {
    const view = render(<EventRsvp event={past} memberType="ACTIVE" choice="ATTENDING" onSaved={vi.fn()} compact />);
    expect(screen.getByRole("group")).toHaveTextContent("참석 응답");
    view.rerender(<EventRsvp event={past} memberType="ACTIVE" choice={null} onSaved={vi.fn()} compact />);
    expect(screen.getByRole("group")).toHaveTextContent("미응답");
  });

  it("목록 버튼 이름에 날짜를 붙여 같은 이름의 일정을 구분한다", () => {
    render(<EventRsvp event={event} memberType="ACTIVE" choice={null} onSaved={vi.fn()} compact />);
    expect(screen.getByRole("button", { name: "10월 4일 정기 연습 참석" })).toHaveTextContent(/^참석$/);
  });

  it("저장하는 동안 누른 버튼을 끄지 않아 초점을 지키고 다시 눌러도 한 번만 보낸다", async () => {
    let resolve!: (value: unknown) => void;
    setEventRsvp.mockReturnValue(new Promise((done) => { resolve = done; }));
    render(<EventRsvp event={event} memberType="ACTIVE" choice={null} onSaved={vi.fn()} />);
    const button = screen.getByRole("button", { name: "참석" });
    button.focus();
    fireEvent.click(button);
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveFocus();
    fireEvent.click(button);
    expect(setEventRsvp).toHaveBeenCalledTimes(1);
    resolve({ eventId: 7, choice: "ATTENDING" });
    await waitFor(() => expect(button).not.toHaveAttribute("aria-disabled"));
  });
});
