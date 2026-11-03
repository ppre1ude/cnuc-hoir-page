// 일정 폼의 시각 값은 한국 시간입니다. 수정 화면은 "YYYY-MM-DDTHH:MM"(datetime-local), 일괄 등록은 "HH:MM"입니다.

// UTC 시각을 datetime-local 값으로 바꿉니다.
export function localInput(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(value));
  const part = (name: string) => parts.find((item) => item.type === name)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

// datetime-local 값을 UTC ISO 문자열로 바꿉니다. 잘못된 값이면 null입니다.
export function utcInput(value: string) {
  const date = new Date(`${value}:00+09:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

// 시각 칸을 누르면 바로 선택기를 엽니다. 기본 입력은 오른쪽 끝 시계 아이콘만 선택기를 열고
// "오후" 글자를 눌러도 바꿀 수 없어, 누른 자리에서 고칠 수 있다는 기대와 어긋납니다. 선택기가 없는 브라우저는 기본 동작 그대로입니다.
export function openPicker(input: HTMLInputElement) {
  try { input.showPicker(); } catch { /* 사용자 동작이 아니거나 지원하지 않으면 기본 동작으로 둡니다. */ }
}
