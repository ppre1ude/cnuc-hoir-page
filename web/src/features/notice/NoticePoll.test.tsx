import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NoticePoll } from "./NoticePoll";

const getNoticePoll = vi.fn();
const voteNoticePoll = vi.fn();
vi.mock("./notices", () => ({
  getNoticePoll: (id: number) => getNoticePoll(id),
  voteNoticePoll: (id: number, choice: number) => voteNoticePoll(id, choice),
}));

const openPoll = {
  question: "연습에 참석하시나요?", firstOption: "참석", secondOption: "불참",
  closesAt: "2027-10-01T05:00:00Z", closed: false,
  firstCount: 0, secondCount: 0, myChoice: null,
};

describe("공지 투표", () => {
  afterEach(cleanup);
  beforeEach(() => {
    getNoticePoll.mockReset();
    voteNoticePoll.mockReset();
  });

  it("한 번 투표한 단원이 마감 전 선택을 바꾸고 새 집계를 본다", async () => {
    getNoticePoll.mockResolvedValue(openPoll);
    voteNoticePoll.mockResolvedValueOnce({ ...openPoll, firstCount: 1, myChoice: 1 })
      .mockResolvedValueOnce({ ...openPoll, secondCount: 1, myChoice: 2 });
    render(<NoticePoll noticeId={7} />);
    fireEvent.click(await screen.findByRole("radio", { name: /^참석/ }));
    fireEvent.click(screen.getByRole("button", { name: "투표하기" }));
    expect(await screen.findByText("내 선택: 참석")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /^불참/ }));
    fireEvent.click(screen.getByRole("button", { name: "선택 변경" }));
    expect(await screen.findByText("내 선택: 불참")).toBeInTheDocument();
    await waitFor(() => expect(voteNoticePoll).toHaveBeenNthCalledWith(2, 7, 2));
    expect(screen.getByText(/1명 참여/)).toBeInTheDocument();
  });

  it("투표 전에 선택이 이름과 함께 운영진에게 보인다고 알린다", async () => {
    getNoticePoll.mockResolvedValue(openPoll);
    render(<NoticePoll noticeId={7} />);
    expect(await screen.findByText("선택은 이름과 함께 운영진에게 표시됩니다.")).toBeInTheDocument();
  });

  it("마감된 투표는 집계와 내 선택을 유지하되 변경 버튼을 숨긴다", async () => {
    getNoticePoll.mockResolvedValue({ ...openPoll, closed: true, firstCount: 1, myChoice: 1 });
    render(<NoticePoll noticeId={7} />);
    expect(await screen.findByText("내 선택: 참석")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "선택 변경" })).not.toBeInTheDocument();
    expect(voteNoticePoll).not.toHaveBeenCalled();
  });
});
