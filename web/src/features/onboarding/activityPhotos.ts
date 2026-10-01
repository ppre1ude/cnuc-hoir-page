export type ActivityPhoto = {
  id: string;
  src: string;
  alt: string;
  width: number;
  height: number;
  objectPosition?: string;
};

export const activityPhotos: ActivityPhoto[] = [
  {
    id: "performance",
    src: "/images/choir-performance.jpg",
    alt: "지휘자와 단원들이 무대에서 합창하는 모습",
    width: 2880,
    height: 2160,
  },
  {
    id: "group",
    src: "/images/choir-group.jpg",
    alt: "무대에 모인 전남대학교 합창단 단원들",
    width: 5360,
    height: 3573,
  },
];
