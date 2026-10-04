import { ApplicationQueue } from "../../../../features/member/ApplicationQueue";
import { ApplicationQueueSkeleton } from "../../../../features/member/ApplicationQueueSkeleton";
import { PageGate } from "../../../../features/auth/PageGate";

export default function ApplicationsPage() {
  return <main>
    <PageGate skeleton={<ApplicationQueueSkeleton />} permission="APPROVE_APPLICATIONS"><ApplicationQueue /></PageGate>
  </main>;
}
