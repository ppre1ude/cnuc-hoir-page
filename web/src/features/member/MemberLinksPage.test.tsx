import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemberLinksPage } from "./MemberLinksPage";
import { choirChannels } from "../onboarding/choirProfile";

afterEach(cleanup);

test("연습 자료와 공식 채널을 나눠 보여 주고 모두 새 탭으로 엽니다", () => {
  render(<MemberLinksPage />);
  const practice = within(screen.getByRole("heading", { name: "연습 자료" }).parentElement!);
  expect(practice.getByRole("link", { name: /연습 일정 시트/ })).toHaveAttribute("href", expect.stringContaining("1G2IDxbM2fZGFoBJYietsiX93yWeSFaTSf5QK8Lz1niM"));
  expect(practice.getByRole("link", { name: /악보와 자료 드라이브/ })).toHaveAttribute("href", "https://drive.google.com/drive/folders/1hcHWeu9WPdZbLpjncsqYOm4k8UHQJAuW?usp=drive_link");
  const channels = within(screen.getByRole("heading", { name: "공식 채널" }).parentElement!);
  expect(channels.getByRole("link", { name: /인스타그램/ })).toHaveAttribute("href", choirChannels.instagram);
  expect(channels.getByRole("link", { name: /유튜브/ })).toHaveAttribute("href", choirChannels.youtube);
  for (const link of screen.getAllByRole("link")) {
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  }
});
