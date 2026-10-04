import { PageGate } from "../../../../features/auth/PageGate";
import { MemberAccountManager } from "../../../../features/member/MemberAccountManager";
import { MemberAccountSkeleton } from "../../../../features/member/MemberAccountSkeleton";

export default function MembersPage() {
  return <main>
    <PageGate skeleton={<MemberAccountSkeleton />} permission="VIEW_MEMBERS"><MemberAccountManager /></PageGate>
  </main>;
}
