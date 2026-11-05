import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { Button, Facts, Field, Input, List, RowButton, Section, StatusBadge } from ".";

afterEach(cleanup);

test("Field는 오류가 있을 때 입력에 aria-invalid와 오류 설명을 잇습니다", () => {
  render(<Field id="email" label="이메일" hint="학교 메일" error="형식이 틀립니다"><Input /></Field>);
  const input = screen.getByLabelText("이메일");
  expect(input).toHaveAttribute("id", "email");
  expect(input).toHaveAttribute("aria-invalid", "true");
  expect(input).toHaveAttribute("aria-describedby", "email-hint email-error");
  expect(screen.getByRole("alert")).toHaveTextContent("형식이 틀립니다");
});

test("Field는 오류가 없으면 aria-invalid를 붙이지 않습니다", () => {
  render(<Field id="email" label="이메일" hint="학교 메일"><Input /></Field>);
  const input = screen.getByLabelText("이메일");
  expect(input).not.toHaveAttribute("aria-invalid");
  expect(input).toHaveAttribute("aria-describedby", "email-hint");
});

test("RowButton은 기본이 type=button입니다", () => {
  render(<form><List><RowButton>행</RowButton></List></form>);
  expect(screen.getByRole("button", { name: "행" })).toHaveAttribute("type", "button");
});

test("Section은 level 3이면 h3를 그리고 배지와 동작을 제목 줄에 둡니다", () => {
  render(<Section level={3} title="참석 응답" badge={<StatusBadge>참석</StatusBadge>} actions={<Button>바꾸기</Button>}>내용</Section>);
  const heading = screen.getByRole("heading", { level: 3, name: "참석 응답" });
  const head = heading.parentElement as HTMLElement;
  expect(within(head).getByText("참석")).toBeInTheDocument();
  expect(within(head).getByRole("button", { name: "바꾸기" })).toBeInTheDocument();
});

test("Section에 id를 주면 section이 그 제목으로 이름을 얻습니다", () => {
  render(<Section id="my-attendance" title="내 출석">내용</Section>);
  expect(screen.getByRole("region", { name: "내 출석" })).toBeInTheDocument();
});

test("Facts는 이름과 값을 dt, dd로 그립니다", () => {
  render(<Facts items={[{ label: "일시", value: "11월 14일" }, { label: "대상", value: "활동 단원" }]} />);
  expect(screen.getAllByRole("term")).toHaveLength(2);
  expect(screen.getAllByRole("definition")).toHaveLength(2);
  // term 역할은 내용으로 이름을 얻지 않아 dt 글자로 찾습니다.
  expect(screen.getByText("일시", { selector: "dt" }).nextElementSibling).toHaveTextContent("11월 14일");
});

test("List as=ul은 ul을 그립니다", () => {
  render(<List as="ul" aria-label="목록"><li>하나</li></List>);
  expect(screen.getByRole("list", { name: "목록" }).tagName).toBe("UL");
});
