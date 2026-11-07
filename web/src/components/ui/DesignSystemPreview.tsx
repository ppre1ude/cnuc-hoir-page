"use client";

import { useState } from "react";
import {
  ActionLink, BackLink, BrandLogo, Button, Callout, Facts, Feedback, Field, Form, Input, List, PageHeader, Panel, Row, RowButton,
  Section, Select, StatusBadge, Textarea,
} from "./index";
import styles from "./preview.module.css";
import ui from "./ui.module.css";

const swatches = [
  ["브랜드", "--color-brand"], ["주요 동작", "--color-primary"], ["본문", "--color-ink"],
  ["작은 정보", "--color-muted"], ["구분선", "--color-line"], ["선택 배경", "--color-selected"],
] as const;

export function DesignSystemPreview() {
  const [attending, setAttending] = useState(true);
  return <main className={styles.page}>
    <BrandLogo />
    <PageHeader title="디자인 시스템" actions={<ActionLink href="/" variant="secondary">메인 보기</ActionLink>} />
    <section className={styles.section}>
      <h2>팔레트</h2>
      <div className={styles.swatches}>{swatches.map(([label, token]) => <div key={token}>
        <div className={styles.swatch} style={{ background: `var(${token})` }} />
        <strong>{label}</strong><code>{token}</code>
      </div>)}</div>
    </section>
    <section className={styles.section}>
      <h2>글자</h2>
      <p className={styles.display}>합창으로 전하는<br /><strong>울림과 감동</strong>의 이야기</p>
      <p className={styles.title}>일정</p><p>본문 16px</p><label>입력 라벨 14px</label>
    </section>
    <section className={styles.section}>
      <h2>버튼</h2>
      <div className={styles.actions}>
        <Button variant="primary">저장</Button><Button>닫기</Button>
        <Button variant="danger">포털 이용 중단</Button><Button variant="ghost">다시 시도</Button>
        <Button variant="primary" disabled>저장 중</Button>
      </div>
      <div className={styles.actions}>
        <Button size="small">작은 버튼</Button><Button>일반 버튼</Button><Button size="large" variant="primary">큰 버튼</Button>
      </div>
    </section>
    <section className={styles.section}>
      <h2>선택과 상태</h2>
      <div className={styles.actions}>
        <Button aria-pressed={attending} onClick={() => setAttending(true)}>참석</Button>
        <Button aria-pressed={!attending} onClick={() => setAttending(false)}>불참</Button>
        <StatusBadge tone="positive">승인</StatusBadge><StatusBadge>미응답</StatusBadge><StatusBadge tone="attention">승인 대기</StatusBadge><StatusBadge tone="negative">이용 중단</StatusBadge>
      </div>
    </section>
    <section className={styles.section}>
      <h2>입력과 피드백</h2>
      <div className={styles.form}>
        <label htmlFor="preview-title">제목</label><Input id="preview-title" defaultValue="정기연습" />
        <label htmlFor="preview-type">단원 구분</label><Select id="preview-type"><option>활동 단원</option><option>OB</option></Select>
        <label htmlFor="preview-body">내용</label><Textarea id="preview-body" rows={3} />
        <label htmlFor="preview-email">이메일 오류 상태</label>
        <Input id="preview-email" aria-invalid="true" aria-describedby="preview-error" defaultValue="잘못된 이메일" />
        <Feedback tone="error" id="preview-error">이메일 주소를 확인해 주세요.</Feedback>
        <label htmlFor="preview-disabled">비활성 입력</label><Input id="preview-disabled" value="수정 불가" disabled />
        <Feedback>저장했습니다.</Feedback>
      </div>
    </section>
    <section className={styles.section}>
      <h2>조립 틀</h2>
      <BackLink href="/design-system">← 홈</BackLink>
      <Panel>
        <Section title="일정 정보" badge={<StatusBadge tone="positive">참석</StatusBadge>}
          actions={<Button size="small">수정</Button>} description="섹션 제목 옆에 상태 배지, 오른쪽 끝에 동작, 아래에 설명 한 줄을 둡니다.">
          <Facts items={[
            { label: "일시", value: "2026. 11. 14. 오후 5:00 ~ 오후 8:00" },
            { label: "대상", value: <StatusBadge tone="positive">활동 단원 대상</StatusBadge> },
            { label: "이메일", value: "very.long.email.address.for.wrapping.check@example.com" },
          ]} />
        </Section>
        <Section title="내용 행 목록">
          <List>
            <Row><strong>정기연습 안내</strong><p className={ui.muted}>11월 14일 토요일, 1생 323호</p></Row>
            <Row><strong>연주회 리허설</strong><p className={ui.muted}>11월 21일 토요일, 대강당</p></Row>
          </List>
        </Section>
        <Section title="선택 행 목록" level={3}>
          <List as="ul" aria-label="단원 목록">
            <li><RowButton aria-current="true"><strong>김하늘</strong><span>소프라노 23기</span></RowButton></li>
            <li><RowButton><strong>이도윤</strong><span>베이스 24기</span><small data-tone="attention">승인 대기</small></RowButton></li>
          </List>
        </Section>
        <Section title="폼과 필드">
          <Form onSubmit={(event) => event.preventDefault()}>
            <Field id="layout-name" label="이름" hint="실명으로 적어 주세요."><Input defaultValue="김하늘" /></Field>
            <Field id="layout-email" label="이메일" error="이메일 주소를 확인해 주세요."><Input defaultValue="잘못된 이메일" /></Field>
            <Button variant="primary" type="submit">저장</Button>
          </Form>
        </Section>
        <Section title="가로 폼">
          <Form layout="inline" onSubmit={(event) => event.preventDefault()}>
            <label htmlFor="layout-month">조회 월</label><Input id="layout-month" type="month" defaultValue="2026-11" />
            <label htmlFor="layout-part">파트</label><Select id="layout-part"><option>전체</option><option>테너</option></Select>
          </Form>
        </Section>
        <Section title="안내 상자">
          <Callout><p>이 상자는 운영진에게 다음에 할 일을 알려 주는 자리입니다. 한 화면에 하나만 둡니다.</p></Callout>
        </Section>
      </Panel>
    </section>
  </main>;
}
