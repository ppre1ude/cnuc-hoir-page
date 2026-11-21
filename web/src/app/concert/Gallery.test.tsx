import { afterEach, expect, test } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Gallery } from "./Gallery";

afterEach(cleanup);

const photos = [1, 2, 3, 4, 5].map((n) => ({ src: `/view/${n}.webp`, thumb: `/thumb/${n}.webp`, alt: `사진 ${n}`, width: 1600, height: 1067 }));
const shown = () => screen.getAllByRole("button", { name: /크게 보기/ }).length;

test("initial만큼 먼저 보이고, 더 보기를 누를 때마다 그만큼씩 늘다가 다 보이면 버튼이 사라집니다", () => {
  render(<Gallery photos={photos} initial={2} />);
  expect(shown()).toBe(2);

  fireEvent.click(screen.getByRole("button", { name: "사진 더 보기" }));
  expect(shown()).toBe(4);

  fireEvent.click(screen.getByRole("button", { name: "사진 더 보기" }));
  expect(shown()).toBe(5);
  expect(screen.queryByRole("button", { name: "사진 더 보기" })).toBeNull();
});
