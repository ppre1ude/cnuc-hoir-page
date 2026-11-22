import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NoticeForm } from "./NoticeForm";
import { createNotice } from "./notices";
import { ApiRequestError } from "../../lib/api";
import { nav } from "../../test/navigation";
import { renderWithSession, sessionFixture } from "../../test/session";

vi.mock("./notices", () => ({ createNotice: vi.fn(), updateNotice: vi.fn() }));
vi.mock("next/navigation", () => import("../../test/navigation"));

const staff = sessionFixture({ permissions: ["MANAGE_EVENTS"] });
const saved = { id: 7, title: "t", body: "b", author: "운영진", published: true, createdAt: "", updatedAt: "", publishedAt: null };
const publish = () => screen.getByRole("button", { name: "게시하기" });
const draft = () => screen.getByRole("button", { name: "초안으로 저장" });
async function fill(title = "정기 연주회", body = "12월 1일 저녁") {
  await userEvent.type(screen.getByLabelText("제목"), title);
  await userEvent.type(screen.getByLabelText("본문"), body);
}

beforeEach(() => {
  sessionStorage.clear();
  nav.reset();
  nav.pathname = "/admin/notices/new";
  vi.mocked(createNotice).mockResolvedValue(saved);
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

test("게시하기는 published true로, 초안으로 저장은 false로 보내고 목록으로 돌아갑니다", async () => {
  renderWithSession(<NoticeForm mode="new" />, staff);
  await fill();
  await userEvent.click(publish());
  expect(createNotice).toHaveBeenLastCalledWith({ title: "정기 연주회", body: "12월 1일 저녁", published: true });
  await waitFor(() => expect(nav.pushed.at(-1)).toBe("/admin/notices?done=published"));
  cleanup();
  renderWithSession(<NoticeForm mode="new" />, staff);
  await fill("회비 안내", "이번 달 회비");
  await userEvent.click(draft());
  expect(createNotice).toHaveBeenLastCalledWith({ title: "회비 안내", body: "이번 달 회비", published: false });
  await waitFor(() => expect(nav.pushed.at(-1)).toBe("/admin/notices?done=draft"));
});

test("제목이나 본문이 비면 두 버튼이 꺼집니다", async () => {
  renderWithSession(<NoticeForm mode="new" />, staff);
  expect(publish()).toBeDisabled();
  expect(draft()).toBeDisabled();
  await userEvent.type(screen.getByLabelText("제목"), "제목만");
  expect(publish()).toBeDisabled();
  await userEvent.type(screen.getByLabelText("본문"), "본문도");
  expect(publish()).toBeEnabled();
  expect(draft()).toBeEnabled();
});

test("투표를 참석 / 불참으로 고르면 선택지가 채워지고 직접 고치면 직접 입력이 되며 함께 보냅니다", async () => {
  renderWithSession(<NoticeForm mode="new" />, staff);
  await fill();
  expect(screen.queryByLabelText("질문")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "참석 / 불참" }));
  expect(screen.getByRole("button", { name: "참석 / 불참" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByLabelText("첫 번째 선택지")).toHaveValue("참석");
  expect(screen.getByLabelText("두 번째 선택지")).toHaveValue("불참");
  await userEvent.clear(screen.getByLabelText("첫 번째 선택지"));
  await userEvent.type(screen.getByLabelText("첫 번째 선택지"), "갑니다");
  expect(screen.getByRole("button", { name: "직접 입력" })).toHaveAttribute("aria-pressed", "true");
  await userEvent.type(screen.getByLabelText("질문"), "연주회에 오시나요?");
  await userEvent.type(screen.getByLabelText("마감 시각 (한국 시간)"), "2026-12-01T18:00");
  await userEvent.click(publish());
  expect(createNotice).toHaveBeenLastCalledWith({ title: "정기 연주회", body: "12월 1일 저녁", published: true,
    poll: { question: "연주회에 오시나요?", firstOption: "갑니다", secondOption: "불참", closesAt: "2026-12-01T09:00:00.000Z" } });
});

test("투표를 켜고 마감 시각이 비면 저장하지 않고 안내합니다", async () => {
  renderWithSession(<NoticeForm mode="new" />, staff);
  await fill();
  await userEvent.click(screen.getByRole("button", { name: "찬성 / 반대" }));
  await userEvent.type(screen.getByLabelText("질문"), "찬성하시나요?");
  await userEvent.click(publish());
  expect(await screen.findByRole("alert")).toHaveTextContent("투표 마감 시각을 확인해 주세요.");
  expect(createNotice).not.toHaveBeenCalled();
});

test("작성 중이던 공지를 되살리고 지우기로 비웁니다", async () => {
  sessionStorage.setItem("notice-draft", JSON.stringify({ title: "쓰다 만 제목", body: "쓰다 만 본문", poll: "agree", pollQuestion: "", firstOption: "찬성", secondOption: "반대", pollClosesAt: "" }));
  renderWithSession(<NoticeForm mode="new" />, staff);
  expect(screen.getByText("작성 중이던 공지를 되살렸습니다.")).toBeInTheDocument();
  expect(screen.getByLabelText("제목")).toHaveValue("쓰다 만 제목");
  expect(screen.getByRole("button", { name: "찬성 / 반대" })).toHaveAttribute("aria-pressed", "true");
  await userEvent.click(screen.getByRole("button", { name: "지우기" }));
  expect(screen.getByLabelText("제목")).toHaveValue("");
  expect(screen.getByRole("button", { name: "없음" })).toHaveAttribute("aria-pressed", "true");
  expect(sessionStorage.getItem("notice-draft")).toBeNull();
  expect(screen.queryByText("작성 중이던 공지를 되살렸습니다.")).not.toBeInTheDocument();
});

test("저장이 끝나면 임시 저장을 지우고, 서버가 투표 오류를 돌려주면 그 문구를 보입니다", async () => {
  vi.mocked(createNotice).mockRejectedValueOnce(new ApiRequestError(400, "INVALID_POLL", "마감 시각은 지금보다 뒤여야 합니다."));
  renderWithSession(<NoticeForm mode="new" />, staff);
  await fill();
  expect(JSON.parse(sessionStorage.getItem("notice-draft") ?? "{}").title).toBe("정기 연주회");
  await userEvent.click(publish());
  expect(await screen.findByRole("alert")).toHaveTextContent("마감 시각은 지금보다 뒤여야 합니다.");
  expect(sessionStorage.getItem("notice-draft")).not.toBeNull();
  await userEvent.click(publish());
  await waitFor(() => expect(sessionStorage.getItem("notice-draft")).toBeNull());
});

test("공지 폼의 제목과 본문 입력은 라벨과 이어집니다", () => {
  renderWithSession(<NoticeForm mode="new" />, staff);
  expect(screen.getByLabelText("제목")).toHaveAttribute("id", "notice-title");
  expect(screen.getByLabelText("본문")).toHaveAttribute("id", "notice-body");
});
