import { afterEach, beforeEach, expect, onTestFinished, test, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApplicationQueue } from "./ApplicationQueue";
import { approveApplication, getApplications, rejectApplication, type ApplicationItem } from "./adminMembers";
import { ApiRequestError } from "../../lib/api";

vi.mock("./adminMembers", () => ({ getApplications: vi.fn(), approveApplication: vi.fn(), rejectApplication: vi.fn() }));

beforeEach(() => {
  vi.mocked(getApplications).mockResolvedValue({ items: [{ id: 2, name: "신청자", email: "member@example.org", status: "APPROVAL_PENDING", createdAt: "2026-09-27T00:00:00Z", part: null, cohort: null }], page: 0, size: 20, total: 1 });
  vi.mocked(approveApplication).mockResolvedValue();
  vi.mocked(rejectApplication).mockResolvedValue();
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

// 왼쪽 목록에는 이름과 파트, 기수만 보이고, 고른 신청자의 정보가 오른쪽 상세 칸에 나옵니다.
const roster = async () => within(await screen.findByRole("list", { name: "신청자 목록" }));
const fact = (detail: HTMLElement, label: string) => within(detail).getByText(label, { selector: "dt" }).nextElementSibling;

test("신청자 상세는 사실 표와 라벨이 이어진 반려 이유 입력을 보여 줍니다", async () => {
  render(<ApplicationQueue />);
  await screen.findByText("member@example.org");
  expect(screen.getByText("이메일", { selector: "dt" }).nextElementSibling).toHaveTextContent("member@example.org");
  expect(screen.getByLabelText("반려 이유")).toHaveAttribute("id", "reason-2");
  expect(screen.getByRole("heading", { level: 2, name: "신청자" })).toBeInTheDocument();
});

test("마지막 페이지의 마지막 신청을 처리하면 첫 페이지를 다시 불러옵니다", async () => {
  const firstPage = Array.from({ length: 20 }, (_, index) => ({
    id: index + 2, name: `${index + 1}번 신청자`, email: `member${index + 1}@example.org`,
    status: "APPROVAL_PENDING" as const, createdAt: "2026-09-27T00:00:00Z", part: null, cohort: null,
  }));
  const last = { id: 22, name: "마지막 신청자", email: "last@example.org", status: "APPROVAL_PENDING" as const, createdAt: "2026-09-27T00:00:00Z", part: null, cohort: null };
  vi.mocked(getApplications).mockImplementation(async (page = 0) => {
    if (page === 0) return { items: firstPage, page: 0, size: 20,
      total: vi.mocked(approveApplication).mock.calls.length === 0 ? 21 : 20 };
    if (vi.mocked(approveApplication).mock.calls.length === 0) return { items: [last], page: 1, size: 20, total: 21 };
    return { items: [], page: 1, size: 20, total: 20 };
  });
  render(<ApplicationQueue />);
  await screen.findByText("member1@example.org");
  await userEvent.click(screen.getByRole("button", { name: "다음" }));
  await screen.findByText("last@example.org");
  await userEvent.click(screen.getByRole("button", { name: "마지막 신청자 승인" }));
  await waitFor(() => expect(getApplications).toHaveBeenLastCalledWith(0));
  expect(await screen.findByText("member1@example.org")).toBeInTheDocument();
});

test("신청 목록에서 OB를 선택해 승인합니다", async () => {
  render(<ApplicationQueue />);
  expect(await screen.findByText("member@example.org")).toBeInTheDocument();
  const choice = within(screen.getByRole("group", { name: "신청자 단원 구분" }));
  await userEvent.click(choice.getByRole("button", { name: "OB" }));
  expect(choice.getByRole("button", { name: "OB" })).toHaveAttribute("aria-pressed", "true");
  expect(choice.getByRole("button", { name: "활동 단원" })).toHaveAttribute("aria-pressed", "false");
  await userEvent.click(screen.getByRole("button", { name: "신청자 승인" }));
  expect(approveApplication).toHaveBeenCalledWith(2, "OB");
});

test("신청 목록 조회 실패 후 다시 시도하면 목록을 표시합니다", async () => {
  vi.mocked(getApplications).mockRejectedValueOnce(new Error("연결 실패"))
    .mockResolvedValueOnce({ items: [{ id: 2, name: "신청자", email: "member@example.org",
      status: "APPROVAL_PENDING", createdAt: "2026-09-27T00:00:00Z", part: null, cohort: null }], page: 0, size: 20, total: 1 });
  render(<ApplicationQueue />);
  expect(await screen.findByRole("alert")).toHaveTextContent("신청 목록을 불러오지 못했습니다");
  expect(screen.queryByText("신청 목록을 불러오는 중입니다.")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "다시 시도" }));
  expect(await screen.findByText("member@example.org")).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("반려는 확인 대화상자에서 취소하면 요청하지 않습니다", async () => {
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  onTestFinished(() => confirm.mockRestore());
  render(<ApplicationQueue />);
  await screen.findByText("member@example.org");
  await userEvent.type(screen.getByLabelText("신청자 반려 이유"), "명단 확인 불가");
  await userEvent.click(screen.getByRole("button", { name: "신청자 반려" }));
  expect(confirm).toHaveBeenCalledWith(expect.stringContaining("신청자의 가입 신청을 반려할까요?"));
  expect(rejectApplication).not.toHaveBeenCalled();
});

test("반려 이유를 입력하고 충돌을 안내합니다", async () => {
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
  onTestFinished(() => confirm.mockRestore());
  vi.mocked(rejectApplication).mockRejectedValue(new ApiRequestError(409, "INVALID_MEMBER_STATE", "이미 처리됨"));
  render(<ApplicationQueue />);
  await screen.findByText("member@example.org");
  await userEvent.type(screen.getByLabelText("신청자 반려 이유"), "명단 확인 불가");
  await userEvent.click(screen.getByRole("button", { name: "신청자 반려" }));
  expect(rejectApplication).toHaveBeenCalledWith(2, "명단 확인 불가");
  expect(await screen.findByRole("alert")).toHaveTextContent("이미 처리된 신청");
});

test("목록에는 이름과 파트, 기수만 보이고, 처음 신청자가 골라져 상세 칸에 파트, 기수, 신청일, 이메일이 표로 나옵니다", async () => {
  vi.mocked(getApplications).mockResolvedValue({ items: [
    { id: 3, name: "홍길동", email: "hong@example.org", status: "APPROVAL_PENDING", createdAt: "2026-09-27T00:00:00Z", part: "SOPRANO", cohort: 5 },
    { id: 4, name: "Kim", email: "kim@example.org", status: "APPROVAL_PENDING", createdAt: "2026-09-27T00:00:00Z", part: null, cohort: null },
  ], page: 0, size: 20, total: 2 });
  render(<ApplicationQueue />);
  const first = await (await roster()).findByRole("button", { name: /^홍길동/ });
  expect(first).toHaveTextContent("소프라노 5기");
  expect(first).toHaveAttribute("aria-current", "true");
  expect((await roster()).getByRole("button", { name: /^Kim/ })).toHaveTextContent("정보 미입력");
  const detail = screen.getByRole("heading", { name: "홍길동" }).closest("section")!;
  expect(fact(detail, "파트")).toHaveTextContent("소프라노");
  expect(fact(detail, "기수")).toHaveTextContent("5기");
  expect(fact(detail, "신청일")).toHaveTextContent("2026. 9. 27.");
  expect(fact(detail, "이메일")).toHaveTextContent("hong@example.org");
  expect(screen.queryByText("kim@example.org")).not.toBeInTheDocument();
  // 반려는 접혀 있고 승인만 바로 보입니다.
  expect(screen.getByLabelText("홍길동 가입 신청 반려").closest("details")).not.toHaveAttribute("open");
  await userEvent.click((await roster()).getByRole("button", { name: /^Kim/ }));
  const kim = (await screen.findByRole("heading", { name: "Kim" })).closest("section")!;
  expect(screen.queryByRole("heading", { name: "홍길동" })).not.toBeInTheDocument();
  expect(fact(kim, "파트")).toHaveTextContent("미입력");
  expect(fact(kim, "기수")).toHaveTextContent("미입력");
  await userEvent.click(screen.getByRole("button", { name: "Kim 승인" }));
  expect(approveApplication).toHaveBeenCalledWith(4, "ACTIVE");
});

test("좁은 화면에서 목록으로 돌아가면 상세 칸이 비고, 다시 고를 수 있습니다", async () => {
  render(<ApplicationQueue />);
  await screen.findByText("member@example.org");
  await userEvent.click(screen.getByRole("button", { name: "목록으로" }));
  expect(screen.getByText("목록에서 신청자를 선택하세요.")).toBeInTheDocument();
  await userEvent.click((await roster()).getByRole("button", { name: /^신청자/ }));
  expect(await screen.findByText("member@example.org")).toBeInTheDocument();
});

test("API가 아직 파트와 기수를 보내지 않아도 정보 미입력으로 표시합니다", async () => {
  // 웹이 API보다 먼저 배포되면 예전 응답에는 part와 cohort 키가 없습니다.
  const legacy = { id: 5, name: "Lee", email: "lee@example.org", status: "APPROVAL_PENDING", createdAt: "2026-09-27T00:00:00Z" } as unknown as ApplicationItem;
  vi.mocked(getApplications).mockResolvedValue({ items: [legacy], page: 0, size: 20, total: 1 });
  render(<ApplicationQueue />);
  expect(await (await roster()).findByRole("button", { name: /^Lee/ })).toHaveTextContent("정보 미입력");
  const detail = screen.getByRole("heading", { name: "Lee" }).closest("section")!;
  expect(fact(detail, "기수")).toHaveTextContent("미입력");
});

test("가운데 신청자를 처리하면 그 앞이 아니라 다음 신청자가 골라집니다", async () => {
  const applicant = (id: number, name: string) => ({ id, name, email: `${id}@example.org`, status: "APPROVAL_PENDING" as const,
    createdAt: "2026-09-27T00:00:00Z", part: null, cohort: null });
  const [a, b, c] = [applicant(1, "가"), applicant(2, "나"), applicant(3, "다")];
  vi.mocked(getApplications)
    .mockResolvedValueOnce({ items: [a, b, c], page: 0, size: 20, total: 3 })
    .mockResolvedValueOnce({ items: [a, c], page: 0, size: 20, total: 2 });
  render(<ApplicationQueue />);
  await userEvent.click((await roster()).getByRole("button", { name: /나/ }));
  await userEvent.click(screen.getByRole("button", { name: "나 승인" }));
  await waitFor(() => expect((within(screen.getByRole("list", { name: "신청자 목록" })).getByRole("button", { name: /다/ }))).toHaveAttribute("aria-current", "true"));
});
