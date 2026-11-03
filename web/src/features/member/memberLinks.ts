import { choirChannels } from "../onboarding/choirProfile";

type MemberLink = { label: string; href: string; note?: string };

// 로그인한 단원에게만 보여 주는 외부 자료 링크입니다. 시트와 드라이브 주소는 저장소에 두지 않고 Vercel 환경 변수로 넣습니다.
// 값은 빌드 때 화면 코드에 실리므로 실제 공개 범위는 각 서비스의 공유 설정이 정합니다. 값이 비면 그 링크는 숨깁니다.
export function memberLinkGroups(): { title: string; links: MemberLink[] }[] {
  const practice: MemberLink[] = [
    { label: "연습 일정 시트", href: process.env.NEXT_PUBLIC_PRACTICE_SHEET_URL ?? "",
      note: "연습 일정은 이 시트가 기준입니다. 참석 일정이 바뀌면 시트에 적어 주세요." },
    { label: "악보와 자료 드라이브", href: process.env.NEXT_PUBLIC_MATERIALS_DRIVE_URL ?? "" },
  ].filter((link) => link.href);
  return [
    { title: "연습 자료", links: practice },
    { title: "공식 채널", links: [
      { label: "인스타그램", href: choirChannels.instagram },
      { label: "유튜브", href: choirChannels.youtube },
    ] },
  ].filter((group) => group.links.length > 0);
}
