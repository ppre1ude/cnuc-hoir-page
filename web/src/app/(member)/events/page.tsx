import type { Metadata } from "next";
import { SkeletonRows } from "../../../components/ui";
import { PageGate } from "../../../features/auth/PageGate";
import { EventList } from "../../../features/event/EventList";

export const metadata: Metadata = { title: "일정" };

export default function Page() {
  return <PageGate skeleton={<SkeletonRows count={5} label="일정을 불러오는 중입니다." />}><EventList /></PageGate>;
}
