import { afterEach, expect, test } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Gallery } from "./Gallery";

afterEach(cleanup);

const photos = [1, 2, 3].map((n) => ({ src: `/view/${n}.webp`, thumb: `/thumb/${n}.webp`, alt: `사진 ${n}`, width: 1600, height: 1067 }));

test("initial만큼만 먼저 보이고, 더 보기를 누르면 전부 보입니다", () => {
  render(<Gallery photos={photos} initial={2} />);
  expect(screen.getAllByRole("button", { name: /크게 보기/ })).toHaveLength(2);

  fireEvent.click(screen.getByRole("button", { name: "사진 1장 더 보기" }));
  expect(screen.getAllByRole("button", { name: /크게 보기/ })).toHaveLength(3);
  expect(screen.queryByRole("button", { name: /더 보기/ })).toBeNull();
});
