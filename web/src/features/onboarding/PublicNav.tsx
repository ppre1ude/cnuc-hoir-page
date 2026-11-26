import { ActionLink, Button } from "../../components/ui";
import { choirChannels } from "./choirProfile";
import styles from "./PublicNav.module.css";

/** 공개 메인과 무대 페이지 머리글의 링크 묶음. 데스크톱은 한 줄로 펼치고, 휴대폰은 메뉴 버튼으로 여는 popover입니다. */
export function PublicNav({ current }: { current?: "stage" }) {
  return (
    <div className={styles.root}>
      <Button className={styles.toggle} popoverTarget="public-nav" aria-label="메뉴">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </Button>
      <nav id="public-nav" popover="auto" aria-label="메뉴" className={styles.menu}>
        <ActionLink variant="ghost" href="/stage" aria-current={current === "stage" ? "page" : undefined}>무대</ActionLink>
        <ActionLink href={choirChannels.application} target="_blank" rel="noopener noreferrer" data-public-nav="apply">지원하기</ActionLink>
        <ActionLink variant="secondary" href="/login">단원 로그인</ActionLink>
      </nav>
    </div>
  );
}
