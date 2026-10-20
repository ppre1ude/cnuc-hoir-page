import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { Linkify } from ".";

afterEach(cleanup);

test("본문의 http·https 주소를 새 탭 링크로 바꾸고 끝의 문장 부호는 글자로 남깁니다", () => {
  const text = "참가 신청: https://forms.gle/abc.\n지도(http://map.example/x?y=1), 끝";
  const { container } = render(<p><Linkify text={text} /></p>);
  const links = screen.getAllByRole("link");
  expect(links.map((link) => link.getAttribute("href"))).toEqual(["https://forms.gle/abc", "http://map.example/x?y=1"]);
  for (const link of links) {
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  }
  expect(container.textContent).toBe(text);
});

test("다른 형식의 주소와 HTML은 링크나 태그로 만들지 않고 글자 그대로 둡니다", () => {
  const text = "javascript:alert(1) <b>굵게</b> www.example.com";
  const { container } = render(<p><Linkify text={text} /></p>);
  expect(screen.queryByRole("link")).toBeNull();
  expect(container.querySelector("b")).toBeNull();
  expect(container.textContent).toBe(text);
});
