"use client";

import { useParams } from "next/navigation";
import { CheckInPanel } from "../../../../../features/attendance/CheckInPanel";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const eventId = Number(id);
  return <main style={{ maxWidth: 640, margin: "auto", padding: 24 }}>
    {Number.isSafeInteger(eventId) && eventId > 0 ? <CheckInPanel eventId={eventId} />
      : <p>행사 주소를 확인해 주세요.</p>}
  </main>;
}
