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
    id: "concert-2025",
    date: "2025-09-12",
    dateLabel: "2025. 09. 12",
    title: "정기연주회 개최",
    description: "전남대학교 예술대학 3호관 예향홀",
  },
];
