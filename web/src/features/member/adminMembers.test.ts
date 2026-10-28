import { expect, test, vi } from "vitest";
import { apiRequest } from "../../lib/api";
import { getMembers } from "./adminMembers";

vi.mock("../../lib/api", () => ({ apiRequest: vi.fn() }));

test("단원이 1000명을 넘으면 모든 페이지를 기억 없이 새로 받아 한 목록으로 합친다", async () => {
  const member = (id: number) => ({ id });
  vi.mocked(apiRequest)
    .mockResolvedValueOnce({ items: [member(0)], page: 0, size: 1000, total: 2001 })
    .mockResolvedValueOnce({ items: [member(1)], page: 0, size: 1000, total: 2001 })
    .mockResolvedValueOnce({ items: [member(2)], page: 1, size: 1000, total: 2001 })
    .mockResolvedValueOnce({ items: [member(3)], page: 2, size: 1000, total: 2001 });
  const result = await getMembers();
  expect(apiRequest).toHaveBeenCalledWith("/admin/members?page=0&size=1000", { cache: "reload" });
  expect(apiRequest).toHaveBeenLastCalledWith("/admin/members?page=2&size=1000", { cache: "reload" });
  expect(result.items.map((item) => item.id)).toEqual([1, 2, 3]);
});

test("단원이 한 페이지면 요청을 더 하지 않는다", async () => {
  vi.mocked(apiRequest).mockReset().mockResolvedValueOnce({ items: [{ id: 1 }], page: 0, size: 1000, total: 1 });
  expect((await getMembers()).items).toEqual([{ id: 1 }]);
  expect(apiRequest).toHaveBeenCalledTimes(1);
});
