import type { Metadata } from "next";
import { PageGate } from "../../../../features/auth/PageGate";
import { MemberAccountManager } from "../../../../features/member/MemberAccountManager";
import { MemberAccountSkeleton } from "../../../../features/member/MemberAccountSkeleton";

export const metadata: Metadata = { title: "단원 정보 관리" };

export default function MembersPage() {
  return <main>
    <PageGate skeleton={<MemberAccountSkeleton />} permission="VIEW_MEMBERS"><MemberAccountManager /></PageGate>
  </main>;
}
