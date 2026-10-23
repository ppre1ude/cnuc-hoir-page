export type PublicNewsItem = {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  title: string;
  description?: string;
};

// 공개 연혁은 합창단이 확인한 사실만 정적으로 관리하며 회원 공지와 분리합니다.
export const publicNews: PublicNewsItem[] = [
  {
    id: "central-club-2026",
    date: "2026-09-29",
    title: "전남대학교 중앙동아리 승격",
    description: "문예분과",
  },
  {
    id: "fifth-members-2026",
    date: "2026-09-03",
    title: "5기 단원 입단",
  },
  {
    id: "concert-2025",
    date: "2025-09-12",
    title: "정기연주회 개최",
    description: "전남대학교 예술대학 3호관 예향홀",
  },
  {
    id: "founding-2024",
    date: "2024-12-06",
    title: "합창단 창단식",
  },
];

export type HistoryYear = {
  year: string;
  items: (PublicNewsItem & { monthDay: string })[];
};

/** '걸어온 길'에 보일 순서로 바꿉니다. 오래된 일부터 연도별로 묶고, 날짜는 "MM. DD"로 적습니다. */
export function historyByYear(items: PublicNewsItem[]): HistoryYear[] {
  const years: HistoryYear[] = [];
  for (const item of [...items].sort((a, b) => a.date.localeCompare(b.date))) {
    const [year, ...rest] = item.date.split("-");
    const entry = { ...item, monthDay: rest.join(". ") };
    const last = years[years.length - 1];
    if (last?.year === year) last.items.push(entry);
    else years.push({ year, items: [entry] });
  }
  return years;
}
