import { choirChannels } from "../onboarding/choirProfile";

// 로그인한 단원에게만 보여 주는 외부 자료 링크입니다. 주소는 화면 코드에 실려 배포되므로 실제 공개 범위는 각 서비스의 공유 설정이 정합니다.
export const memberLinkGroups: { title: string; links: { label: string; href: string; note?: string }[] }[] = [
  { title: "연습 자료", links: [
    { label: "연습 일정 시트", href: "https://docs.google.com/spreadsheets/d/1G2IDxbM2fZGFoBJYietsiX93yWeSFaTSf5QK8Lz1niM/edit?gid=0#gid=0",
      note: "연습 일정은 이 시트가 기준입니다. 참석 일정이 바뀌면 시트에 적어 주세요." },
    { label: "악보와 자료 드라이브", href: "https://drive.google.com/drive/folders/1hcHWeu9WPdZbLpjncsqYOm4k8UHQJAuW?usp=drive_link" },
  ] },
  { title: "공식 채널", links: [
    { label: "인스타그램", href: choirChannels.instagram },
    { label: "유튜브", href: choirChannels.youtube },
  ] },
];
