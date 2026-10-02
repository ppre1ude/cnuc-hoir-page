export type PublicNewsItem = {
  id: string;
  date: string;
  dateLabel: string;
  title: string;
  description?: string;
};

// 공개 소식은 합창단이 확인한 사실만 정적으로 관리하며 회원 공지와 분리합니다.
export const publicNews: PublicNewsItem[] = [
  {
    id: "central-club-2026",
    date: "2026-09-29",
    dateLabel: "2026. 09. 29",
    title: "전남대학교 중앙동아리 승격",
    description: "문예분과",
  },
  {
    id: "fifth-members-2026",
    date: "2026-09",
    dateLabel: "2026. 09",
    title: "5기 단원 입단",
  },
  {
    id: "concert-2025",
    date: "2025-09-12",
    dateLabel: "2025. 09. 12",
    title: "정기연주회 개최",
    description: "전남대학교 예술대학 3호관 예향홀",
  },
  {
    id: "founding-2024",
    date: "2024-12-06",
    dateLabel: "2024. 12. 06",
    title: "합창단 창단식",
  },
];
