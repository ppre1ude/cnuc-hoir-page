export type ChoirMilestone = {
  id: string;
  date: string;
  title: string;
  venue?: string;
  featured?: boolean;
};

// 합창단이 제공한 공식 연혁을 최신순으로 표시합니다.
export const choirMilestones: ChoirMilestone[] = [
  {
    id: "central-club-2026",
    date: "2026년 2학기",
    title: "전남대학교 중앙동아리 승격",
    featured: true,
  },
  {
    id: "concert-2025",
    date: "2025. 09. 12",
    title: "정기연주회 개최",
    venue: "전남대학교 예술대학 3호관 예향홀",
  },
  {
    id: "founding-2024",
    date: "2024. 12",
    title: "창단식",
  },
];

export const choirChannels = {
  instagram: "https://www.instagram.com/cnuc.hoir/",
  youtube: "https://www.youtube.com/@전남대학교합창단",
};
