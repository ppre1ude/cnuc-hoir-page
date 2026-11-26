import { hallPhoto } from "../concert/stagePhotos";

export type PublicNewsItem = {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  title: string;
  description?: string;
  /** 그 일을 더 볼 수 있는 사이트 안 페이지가 있을 때만 적습니다. */
  link?: { href: string; label: string };
  /** 무대 페이지에서 크게 다룰 행사에만 적습니다. 없으면 연도 안의 한 줄로 보입니다. */
  stage?: StageDetail;
};

export type StageDetail = {
  /** 큰 항목 이름. 예: "제2회 정기연주회" */
  name: string;
  photo: { src: string; width: number; height: number; alt: string };
  /** 합창단이 직접 쓴 소개 글. 글을 받기 전에는 비워 둡니다. */
  lead?: string;
  facts: { label: string; value: string }[];
  /** 첫 링크가 주요 버튼입니다. */
  links: { href: string; label: string }[];
};

export type StageItem = PublicNewsItem & { stage: StageDetail };

// 공개 연혁은 합창단이 확인한 사실만 정적으로 관리하며 회원 공지와 분리합니다.
export const publicNews: PublicNewsItem[] = [
  {
    id: "concert-2026",
    date: "2026-11-20",
    title: "제2회 정기연주회 개최",
    description: "전남대학교 민주마루",
    link: { href: "/gallery", label: "공연 사진 보기" },
    stage: {
      name: "제2회 정기연주회",
      photo: hallPhoto,
      // concert.ts는 다음 연주회가 정해지면 바뀌므로 값을 옮겨 적습니다.
      facts: [
        { label: "일시", value: "2026. 11. 20. (금) 19:00" },
        { label: "장소", value: "전남대학교 민주마루" },
        { label: "지휘", value: "박찬영, 박예영" },
      ],
      links: [
        { href: "/gallery", label: "공연 사진 보기" },
        { href: "/concert", label: "초대장 보기" },
      ],
    },
  },
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

/** 무대 페이지 순서. 최근 해부터, 한 해 안에서도 최근 일부터 둡니다. */
export function stageYears(items: PublicNewsItem[]): HistoryYear[] {
  return historyByYear(items).reverse().map((year) => ({ ...year, items: year.items.reverse() }));
}

const hasStage = (item: PublicNewsItem): item is StageItem => item.stage !== undefined;

/** 주소의 ?event=로 고른 큰 항목. 없거나 틀리면(배열 주소 포함) 가장 최근 큰 항목을 고릅니다. */
export function pickStage(items: PublicNewsItem[], event: string | string[] | undefined): StageItem | undefined {
  const stages = items.filter(hasStage);
  return stages.find((item) => typeof event === "string" && item.id === event)
    ?? stages.reduce<StageItem | undefined>((latest, item) => (!latest || item.date > latest.date ? item : latest), undefined);
}
