import Image from "next/image";
import { ActionLink, PageHeader } from "../components/ui";
import styles from "../components/ui/ui.module.css";

export default function NotFound() {
  return <main id="member-content" tabIndex={-1} className={styles.screen}>
    <Image src="/images/dragon-search.png" width={200} height={200} alt="" />
    <PageHeader title="찾는 화면이 없습니다" />
    <p>주소가 바뀌었거나 잘못 입력된 것 같습니다.</p>
    <ActionLink variant="secondary" href="/">홈으로 가기</ActionLink>
  </main>;
}
