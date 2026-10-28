import { redirect } from "next/navigation";

// 일정 목록은 홈 달력의 목록 보기로 옮겼습니다. 예전 주소로 들어오면 홈으로 보냅니다.
export default function EventsPage() {
  redirect("/dashboard");
}
