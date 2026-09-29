export type ActivityPhoto = {
  id: string;
  src: string;
  alt: string;
  objectPosition?: string;
};

export const activityPhotos: ActivityPhoto[] = [
  {
    id: "performance",
    src: "/images/choir-performance.jpg",
    alt: "지휘자와 단원들이 무대에서 합창하는 모습",
    objectPosition: "center bottom",
  },
];
