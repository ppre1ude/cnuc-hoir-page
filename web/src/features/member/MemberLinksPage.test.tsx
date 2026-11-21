import { afterEach, beforeEach, expect, test } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemberLinksPage } from "./MemberLinksPage";
import { choirChannels } from "../onboarding/choirProfile";

const previous = { sheet: process.env.NEXT_PUBLIC_PRACTICE_SHEET_URL, drive: process.env.NEXT_PUBLIC_MATERIALS_DRIVE_URL, photos: process.env.NEXT_PUBLIC_CONCERT_PHOTOS_DRIVE_URL };

beforeEach(() => {
  process.env.NEXT_PUBLIC_PRACTICE_SHEET_URL = "https://docs.google.com/spreadsheets/d/sheet-id/edit";
  process.env.NEXT_PUBLIC_MATERIALS_DRIVE_URL = "https://drive.google.com/drive/folders/drive-id";
  delete process.env.NEXT_PUBLIC_CONCERT_PHOTOS_DRIVE_URL;
});

afterEach(() => {
  cleanup();
  process.env.NEXT_PUBLIC_PRACTICE_SHEET_URL = previous.sheet;
  process.env.NEXT_PUBLIC_MATERIALS_DRIVE_URL = previous.drive;
  process.env.NEXT_PUBLIC_CONCERT_PHOTOS_DRIVE_URL = previous.photos;
});

test("연주회 사진 원본 링크는 주소를 넣었을 때만 보입니다", () => {
  const { unmount } = render(<MemberLinksPage />);
  expect(screen.queryByRole("heading", { name: "연주회 기록" })).toBeNull();
  unmount();

  process.env.NEXT_PUBLIC_CONCERT_PHOTOS_DRIVE_URL = "https://drive.google.com/drive/folders/photos-id";
  render(<MemberLinksPage />);
  expect(screen.getByRole("link", { name: /제2회 정기연주회 사진 원본/ })).toHaveAttribute("href", "https://drive.google.com/drive/folders/photos-id");
});

test("연습 자료와 공식 채널을 나눠 보여 주고 모두 새 탭으로 엽니다", () => {
  render(<MemberLinksPage />);
  const practice = within(screen.getByRole("heading", { name: "연습 자료" }).closest("section")!);
  expect(practice.getByRole("link", { name: /연습 일정 시트/ })).toHaveAttribute("href", "https://docs.google.com/spreadsheets/d/sheet-id/edit");
  expect(practice.getByRole("link", { name: /악보와 자료 드라이브/ })).toHaveAttribute("href", "https://drive.google.com/drive/folders/drive-id");
  const channels = within(screen.getByRole("heading", { name: "공식 채널" }).closest("section")!);
  expect(channels.getByRole("link", { name: /인스타그램/ })).toHaveAttribute("href", choirChannels.instagram);
  expect(channels.getByRole("link", { name: /유튜브/ })).toHaveAttribute("href", choirChannels.youtube);
  for (const link of screen.getAllByRole("link")) {
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  }
});

test("주소가 비어 있는 연습 자료 링크는 숨기고, 둘 다 비면 묶음째 숨깁니다", () => {
  process.env.NEXT_PUBLIC_MATERIALS_DRIVE_URL = "";
  const { unmount } = render(<MemberLinksPage />);
  expect(screen.getByRole("link", { name: /연습 일정 시트/ })).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /악보와 자료 드라이브/ })).toBeNull();
  unmount();

  delete process.env.NEXT_PUBLIC_PRACTICE_SHEET_URL;
  render(<MemberLinksPage />);
  expect(screen.queryByRole("heading", { name: "연습 자료" })).toBeNull();
  expect(screen.getByRole("heading", { name: "공식 채널" })).toBeInTheDocument();
});
