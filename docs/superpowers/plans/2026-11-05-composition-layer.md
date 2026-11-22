# 화면 조립 틀 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 페이지 틀 위층(섹션, 패널, 목록 행, 폼 필드, 사실 표, 뒤로 가기, 안내 상자)을 `components/ui`의 공용 부품으로 뽑고, 운영진 다섯 화면과 일정 상세, 공지, 내 출석이 그 부품을 쓰게 한다.

**Architecture:** 새 부품은 `components/ui/layout.tsx`와 `layout.module.css`에 두고 `index.tsx`가 다시 내보내 기존 `import { ... } from "../../components/ui"`가 그대로 통한다. 기능 화면은 한 화면씩 옮기고, 화면마다 린트, 타입 검사, 그 기능의 vitest, 390px와 1440px 캡처로 확인한다. 공용 CSS에서 중복 정의를 지우는 일은 모든 화면을 옮긴 뒤 한 번에 한다.

**Tech Stack:** Next 16.3.6, React 19, CSS Modules, `tokens.css`, vitest + testing-library, Playwright chromium(캡처 전용, `@playwright/test`가 이미 설치됨).

**Spec:** `docs/superpowers/specs/2026-11-05-composition-layer-design.md`

## Global Constraints

- 패키지를 더하지 않는다. 토큰 값, 색, 글꼴을 바꾸지 않는다. 값은 전부 `tokens.css`의 변수다.
- 공개 메인(`SandLanding`)과 인증 화면(`(auth)/layout`)은 손대지 않는다. 데이터, API, 동작, 권한을 바꾸지 않는다.
- 패널은 한 화면에 한 겹. 패널 안에 패널을 두지 않는다. 390px에서 가로 넘침 없음, 누르는 요소 44px 이상.
- 라벨과 입력 연결, `role`, 초점 표시, 보조 낭독 안내를 지킨다. 기존 테스트가 검증하던 동작은 유지한다.
- 화면 문구에 대시(—)와 가운뎃점(·)을 쓰지 않는다. 범위는 물결표(~).
- 린트의 `react-hooks/refs`, `react-hooks/set-state-in-effect`를 지킨다. 파일의 줄바꿈이 CRLF와 LF로 섞여 있으니 여러 줄 치환 전에 정규화한다.
- 커밋 메시지는 짧고 같은 꼴(`feat(web): ...`, `docs: ...`), Claude 표기 없음. 커밋과 푸시는 사용자 승인 뒤에 한다. 이 계획의 커밋 단계는 "승인받고 커밋"이다.
- 작업은 `origin/main`에서 딴 가지 `feat/composition-layer`에서, 별도 워크트리로 한다. 본 체크아웃은 다른 세션과 공유한다.

## Review Focus

1. `Field`에 오류를 넘기면 입력에 `aria-invalid`와 오류 문구를 가리키는 `aria-describedby`가 붙어야 한다. 보조 낭독이 오류를 읽지 못하면 틀린 값을 모른 채 다시 보낸다. (Task 1 테스트)
2. `RowButton`은 `type="button"`이 기본이어야 한다. 폼 안 목록에서 행을 누를 때 폼이 제출되면 안 된다. (Task 1 테스트)
3. `Section level={3}`은 h3를 그려야 한다. 패널 안 소제목이 h2가 되면 보조 낭독의 제목 차례가 깨진다. (Task 1 테스트)
4. 390px에서 `Facts`의 긴 이메일 값과 운영진 두 칸 작업 영역이 가로로 넘치면 안 된다. (Task 2의 캡처 스크립트가 `scrollWidth`를 검사)
5. 일정 상세에서 취소된 일정은 사실 표에 상태 행이 있고 참석 응답은 없어야 한다. (Task 3 테스트)

---

## 공통 치환표

기능 화면을 옮길 때 이 표대로 바꾼다. 표에 없는 클래스는 그 기능만의 배치이므로 남긴다.

| 지금 | 바꿀 것 |
| --- | --- |
| `styles.page`(composes page/readingPage) | `ui.page` 또는 `ui.readingPage` (`import ui from ".../components/ui/ui.module.css"`) |
| `.panel`, `.detail`(composes surface), `.card`, `.eventPageCard` | `<Panel>` |
| `.section`, `.memberSection`, `.panelHeader`, `.rowHeader`, `.detailHeader`, 맨 `h2` | `<Section title badge actions description level>` |
| `.lead`, `.when`, `p:not([class])` 흐린 문단, `.pendingNote`, `.placeholder`가 아닌 빈 안내 | `ui.muted` |
| `.list`, `.rosterList`, `.pendingList` | `<List as="ul">` 또는 `<List>` |
| `.row`, `.pendingRow` | `<Row>` |
| `.rosterRow`(button), `.list a`(내 출석) | `<RowButton>`, `<RowLink>` |
| `.form`(세로), `.inlineForm`, `.filters` | `<Form>`, `<Form layout="inline">` |
| `label` + 입력 + `.hint`, `.fieldGroup`, `.fieldLabel`(입력 라벨일 때) | `<Field id label hint error>` |
| `.facts` | `<Facts items>` |
| `.back`, `.backLink` | `<BackLink href>` |
| `.callout` | `<Callout>` |
| `.actions`(기능 CSS) | `ui.actions` (이미 `ui.module.css`에 있음) |
| 스켈레톤의 `.skeletonHeader` | `ui.pageHeader` |

남기는 것: `.workspace`, `.roster`, `.toList`, `.placeholder`, `.pagination`, `.grid`, `.registerGrid`, `.approval`, `.decision`, `.choice`, `.reject`, `.more`, `.issued`, `.roles`, `.roleList`, `.time`, `.code`, `.qr`, `.newItem`, `.check`, `.pollFields`, `.pollDetails`, `.rsvp*`, `.fields`, `.fieldGrid`, `.picker`, `.days`, `.day`, `.weekdays`, `.selectedDates`, 공지의 `h2 button` 펼침, `.chevron`, `.rowMeta`, `.meta`, `.expanded`, `.body`, `.close`, `.standalone`, 내 출석의 `.date`, `.eventTitle`, `.arrow`.

---

### Task 1: 조립 부품

**Files:**
- Create: `web/src/components/ui/layout.tsx`
- Create: `web/src/components/ui/layout.module.css`
- Create: `web/src/components/ui/layout.test.tsx`
- Modify: `web/src/components/ui/index.tsx` (맨 끝에 `export * from "./layout";`)
- Modify: `web/src/components/ui/ui.module.css` (`.muted` 추가)

**Interfaces:**
- Consumes: `ui.module.css`의 `surface`, `message`, `Feedback`
- Produces (뒤 Task가 모두 쓴다):
  - `Section({ title, badge?, actions?, description?, level?: 2 | 3, id?, className?, children? })` → `<section>`; 제목 줄 `div.sectionHead`에 `h2|h3`, `badge`, `div.sectionActions`; `description`은 `p.muted`. `id`가 있으면 제목에 `id`, section에 `aria-labelledby`
  - `Panel(props: ComponentProps<"div">)` → `div.panel`(composes surface)
  - `List({ as?: "ul" | "div", ...props })` → 기본 `div.list`, `ul`이면 점과 안쪽 여백 제거
  - `Row(props: ComponentProps<"div">)` → `div.row`
  - `RowLink(props: ComponentProps<typeof Link>)` → `Link.selectRow`
  - `RowButton(props: ComponentProps<"button">)` → `button.selectRow`, `type` 기본 `"button"`
  - `Form({ layout?: "stack" | "inline", ...props: ComponentProps<"form"> })` → `form.form` 또는 `form.inlineForm`
  - `Field({ id: string, label, hint?, error?, className?, children: ReactElement })` → `label[for=id]`, `cloneElement(children, { id, "aria-describedby": [hint && id+"-hint", error && id+"-error"].filter(Boolean).join(" ") || undefined, "aria-invalid": error ? "true" : undefined })`, `p#id-hint.hint`, `Feedback tone="error" id=id-error`
  - `Facts({ items: { label: ReactNode; value: ReactNode }[], className? })` → `dl.facts > div > dt + dd`
  - `BackLink(props: ComponentProps<typeof Link>)` → `Link.back`
  - `Callout(props: ComponentProps<"div">)` → `div.callout`

- [ ] **Step 1: 워크트리와 가지를 만든다**

superpowers:using-git-worktrees대로 `origin/main`에서 `feat/composition-layer` 워크트리를 만든다. `web/node_modules`는 정션이 아니라 복사한다(`robocopy /E /NFL /NDL /NJH /NJS`). 본 체크아웃의 `docs/superpowers/specs/2026-11-05-composition-layer-design.md`와 이 계획 파일을 워크트리로 옮긴다(복사 뒤 본 체크아웃에서 삭제).

- [ ] **Step 2: 설계 문서와 계획을 커밋한다(승인받고)**

```bash
git add docs/superpowers/specs/2026-11-05-composition-layer-design.md docs/superpowers/plans/2026-11-05-composition-layer.md
git commit -m "docs: 화면 조립 틀 설계와 계획 추가"
```

- [ ] **Step 3: 실패하는 테스트를 쓴다** (`layout.test.tsx`, 기존 `Skeleton.test.tsx`와 같은 꼴)

```tsx
test("Field는 오류가 있을 때 입력에 aria-invalid와 오류 설명을 잇습니다", () => {
  render(<Field id="email" label="이메일" hint="학교 메일" error="형식이 틀립니다"><Input /></Field>);
  const input = screen.getByLabelText("이메일");
  expect(input).toHaveAttribute("id", "email");
  expect(input).toHaveAttribute("aria-invalid", "true");
  expect(input).toHaveAttribute("aria-describedby", "email-hint email-error");
  expect(screen.getByRole("alert")).toHaveTextContent("형식이 틀립니다");
});
test("Field는 오류가 없으면 aria-invalid를 붙이지 않습니다", ...)  // aria-describedby는 "email-hint"만
test("RowButton은 기본이 type=button입니다", ...)  // <form><List><RowButton>행</RowButton></List></form>에서 type="button"
test("Section은 level 3이면 h3를 그리고 배지와 동작을 제목 줄에 둡니다", ...)
  // getByRole("heading", { level: 3, name: "참석 응답" }); 배지 텍스트와 actions 버튼이 그 section 안에 있음
test("Section에 id를 주면 section이 그 제목으로 이름을 얻습니다", ...)  // getByRole("region", { name: "내 출석" })
test("Facts는 이름과 값을 dt, dd로 그립니다", ...)  // getByRole("term") 두 개, getByRole("definition") 두 개
test("List as=ul은 ul을 그립니다", ...)  // getByRole("list")
```

- [ ] **Step 4: 실패를 확인한다**

Run: `cd web && npx vitest run src/components/ui/layout.test.tsx`
Expected: FAIL, `layout` 모듈 없음

- [ ] **Step 5: `layout.tsx`를 구현한다**

위 Interfaces의 시그니처대로. `join` 헬퍼는 `index.tsx`의 것과 같은 한 줄을 다시 쓴다(순환 import 피함).

- [ ] **Step 6: `layout.module.css`를 쓴다**

설계 문서 "조립 부품" 표의 값 그대로. 핵심만 적는다.

- `.section + .section`, `.panel .section + .section`: 위 32px. 패널 안에서는 위에 1px `--color-line` 구분선과 안쪽 위 24px
- `.sectionHead`: flex, `align-items: center`, `gap: var(--space-3)`, 아래 16px. 제목 `margin: 0; font-size: var(--text-section); font-weight: var(--weight-heading); letter-spacing: var(--tracking-heading)`. `.sectionActions { margin-left: auto; display: flex; gap: var(--space-2); flex-wrap: wrap }`. 760px 이하 `flex-wrap: wrap`
- `.panel { composes: surface from "./ui.module.css" }`
- `.list { border-top: 2px solid var(--color-ink) }`, `ul.list { margin: 0; padding: 0; list-style: none }`, `.panel .list { border-top: 0 }`
- `.row { padding: var(--space-5) 0; border-bottom: 1px solid var(--color-line) }`, `.panel .row:first-child { padding-top: 0 }`, `.panel .row:last-child { padding-bottom: 0; border-bottom: 0 }`
- `.selectRow`: `display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: baseline; column-gap: var(--space-3); width: 100%; min-height: var(--control-medium); padding: var(--space-3) var(--space-2); border: 0; border-bottom: 1px solid var(--color-line); border-left: 3px solid transparent; background: transparent; color: var(--color-ink); font: inherit; text-align: left; text-decoration: none; cursor: pointer`. `:hover { background: var(--color-subtle) }`. `[aria-current="true"], [aria-pressed="true"] { border-left-color: var(--color-primary); background: var(--color-selected) }`. 안의 `strong { font-weight: var(--weight-label); overflow-wrap: anywhere }`, `span { color: var(--color-muted); font-size: var(--text-small) }`, `small { grid-column: 1 / -1; font-size: var(--text-small) }`, `[data-tone="attention"] { color: var(--color-attention) }`, `[data-tone="negative"] { color: var(--color-danger) }`
- `.form { display: flex; flex-direction: column; gap: var(--space-4) }`, `.form > button[type="submit"] { align-self: flex-start; margin-top: var(--space-3) }`
- `.inlineForm { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2) }`, 안의 `label { font-size: var(--text-small); font-weight: var(--weight-label) }`, `select, input { width: auto; min-width: 120px }`
- `.field { display: grid; gap: var(--space-2) }`, `.field > label { font-size: var(--text-label); font-weight: var(--weight-label) }`, `.hint { margin: 0; color: var(--color-muted); font-size: var(--text-small); line-height: 1.6 }`
- `.facts`: `AdminPages.module.css` 127~132행 그대로 옮기되 `margin: 0`, `border-radius: var(--radius-panel)`. 760px 이하 `grid-template-columns: minmax(0, 1fr)`, `dd { border-top: 0 }`
- `.back`: `AdminPages.module.css` 69~70행 그대로
- `.callout { padding: var(--space-4) var(--space-5); border: 1px solid var(--color-highlight); border-radius: var(--radius-control); background: var(--color-subtle) }`, `.callout p { margin: 0; font-size: var(--text-label); line-height: 1.7 }`
- `ui.module.css`에 `.muted { margin: 0; color: var(--color-muted); font-size: var(--text-label); line-height: 1.65 }`

- [ ] **Step 7: 테스트 통과를 확인한다**

Run: `cd web && npx vitest run src/components/ui`
Expected: PASS (기존 ui 테스트 포함)

- [ ] **Step 8: 린트와 타입 검사**

Run: `cd web && npm run lint && npx next typegen && npx tsc --noEmit`
Expected: 오류 0

- [ ] **Step 9: 커밋(승인받고)**

```bash
git add web/src/components/ui
git commit -m "feat(web): 화면 조립 부품 추가"
```

---

### Task 2: 미리보기 전시와 캡처 준비

**Files:**
- Modify: `web/src/components/ui/DesignSystemPreview.tsx`, `preview.module.css`
- Create (스크래치패드, 커밋 안 함): `capture.mjs`
- Modify: `.claude/launch.json` (본 체크아웃. 워크트리용 `web-composition` 항목, 포트 3001)

**Interfaces:**
- Produces: `node capture.mjs <화면키> <상태> [port]` → `scratchpad/captures/<화면키>-<상태>-390.png`, `-1440.png`. 화면키는 `event`, `applications`, `admin-events`, `members`, `admin-notices`, `admin-attendance`, `notices`, `attendance`, `design-system`. 가로 넘침이면 종료 코드 1

- [ ] **Step 1: 미리보기에 섹션을 더한다**

`DesignSystemPreview.tsx`에 "조립 틀" 섹션 하나를 더하고, 안에 `Panel` 하나를 두어 `BackLink`, `Section`(배지와 동작 포함, `level={3}` 하나), `Facts`(일시, 대상, 긴 이메일), `List`+`Row` 둘, `List as="ul"`+`RowButton` 둘(하나는 `aria-current`), `Form`+`Field` 둘(하나는 오류), `Form layout="inline"`, `Callout`을 전시한다. 미리보기 자체의 `.section`, `.form` 정의는 남긴다(전시 틀이지 부품이 아니다).

- [ ] **Step 2: 캡처 스크립트를 쓴다**

메모리의 절차대로. `createRequire("C:/cnuc-hoir/web/package.json")`로 `@playwright/test`의 `chromium`을 쓴다. `page.route(/\/api\/v1\//, …)`로 `/auth/me`, `/auth/csrf`와 화면이 부르는 경로를 가짜 JSON으로 돌려준다. 가짜 데이터는 각 화면의 `*.test.tsx`가 `fetch`에 넣는 픽스처를 그대로 쓴다. `/auth/me`는 `src/test/session.tsx`의 `sessionFixture`와 같은 모양이며 운영진 화면에는 `admin: true`와 권한(`APPROVE_APPLICATIONS`, `MANAGE_EVENTS`, `VIEW_MEMBERS`)을 넣는다. 경로 매칭은 `^`로 고정하고 `/attendance/me`를 `/events/:id/attendance/me`보다 먼저 둔다. `nextjs-portal { display: none }`을 넣는다. 390×844와 1440×900에서 풀페이지로 찍고, 찍기 전에 `document.documentElement.scrollWidth > innerWidth`면 실패로 끝낸다.

- [ ] **Step 3: 개발 서버를 띄운다**

`launch.json`에 워크트리 항목을 더한 뒤 preview_start `web-composition`. 같은 폴더에서 `next dev`는 하나만 뜬다.

- [ ] **Step 4: 옮기기 전 캡처를 찍는다**

Run: 화면키 아홉 개 각각 `node capture.mjs <키> before 3001`
Expected: 파일 18개, 종료 코드 0. 이 캡처가 뒤 Task의 비교 기준이다.

- [ ] **Step 5: 미리보기를 확인한다**

`design-system-before-1440.png`를 보고 부품 전시가 설계 문서의 모양 규칙(패널 한 겹, 섹션 사이 구분선, 사실 표 두 열)과 맞는지 본다. 390 캡처에서 사실 표가 한 열인지 본다.

- [ ] **Step 6: 커밋(승인받고)**

```bash
git add web/src/components/ui/DesignSystemPreview.tsx web/src/components/ui/preview.module.css
git commit -m "feat(web): 디자인 시스템 미리보기에 조립 부품 전시"
```

---

### Task 3: 일정 상세

**Files:**
- Modify: `web/src/features/event/EventPage.tsx`, `EventPageSkeleton.tsx`, `EventRsvp.tsx`, `EventDetail.tsx`, `events.ts`, `EventCalendar.module.css`
- Test: `web/src/features/event/EventPage.test.tsx`, `EventDetail.test.tsx`, `EventRsvp.test.tsx`

**Interfaces:**
- Consumes: Task 1 전부
- Produces: `events.ts`에 `export function eventEndLabel(event: ChoirEvent): string` (지금 `EventDetail.tsx`의 비공개 `endLabel`을 옮긴 것). `EventRsvp`에 `layout?: "row" | "section"` prop(기본 `"row"`). `"row"`는 지금 markup 그대로(홈 달력이 쓴다). `"section"`은 `<Section title="참석 응답" badge={응답 배지와 마감 배지}>` 안에 버튼 쌍, 오류, 저장 안내를 두고 버튼 묶음에 `role="group" aria-label="참석 응답"`을 남긴다. `closed` 계산은 지금처럼 `EventRsvp` 안에 있다

- [ ] **Step 1: 실패하는 테스트를 더한다** (`EventPage.test.tsx`)

```tsx
test("일정 상세는 일시와 대상을 사실 표로, 참석 응답과 내 출석을 섹션으로 보여 줍니다", async () => {
  // 기존 테스트의 세션과 fetch 가짜 응답 재사용
  expect(await screen.findByRole("term", { name: "일시" })).toBeInTheDocument();
  expect(screen.getByRole("term", { name: "대상" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { level: 2, name: "참석 응답" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { level: 2, name: "내 출석" })).toBeInTheDocument();
});
test("취소된 일정은 사실 표에 상태를 적고 참석 응답을 두지 않습니다", async () => {
  // cancelledAt이 있는 일정으로 그린다
  const term = await screen.findByRole("term", { name: "상태" });
  expect(term.nextElementSibling).toHaveTextContent("취소된 일정입니다");
  expect(screen.queryByRole("heading", { name: "참석 응답" })).toBeNull();
});
```

`EventRsvp.test.tsx`에 더한다.

```tsx
test("section 배치는 제목과 응답 배지를 제목 줄에 두고 버튼 묶음 이름을 지킵니다", () => {
  render(<EventRsvp layout="section" event={event} memberType="ACTIVE" choice="ATTENDING" onSaved={() => {}} />);
  expect(screen.getByRole("heading", { level: 2, name: "참석 응답" })).toBeInTheDocument();
  expect(screen.getByRole("group", { name: "참석 응답" })).toBeInTheDocument();
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `cd web && npx vitest run src/features/event/EventPage.test.tsx`
Expected: 새 테스트 둘 FAIL

- [ ] **Step 3: 옮긴다**

- `EventPage.tsx`: `main.ui.readingPage` > `BackLink href="/dashboard"` "← 홈" > `PageHeader` > 오류 `Feedback` > `Panel`. 패널 안 순서: `Facts`(일시 `<time>` 시작 ~ `eventEndLabel`, 대상 배지(`EventDetail`의 `eventAudience`/OB 문구 그대로), 취소면 상태 `StatusBadge` "취소된 일정입니다"), 설명 `p.description`(`Linkify`), `EventRsvp layout="section"`(그리는 조건은 지금 그대로), `Section title="내 출석" badge={출석 배지} actions={canManageRoster면 <ActionLink variant="secondary" size="small" href=.../attendance>운영진 출석 관리</ActionLink>}`에 출석 오류 `Feedback`과 `checkInOpen && isEventTarget`이면 `ActionLink variant="primary"` "현장 출석하기". 취소 일정의 "내 출석" 표시 조건은 지금 그대로.
- `EventDetail.tsx`: `showTitle` prop과 `endLabel`을 지우고 `eventEndLabel`을 쓴다. 홈 달력 카드용으로만 남는다.
- `EventRsvp.tsx`: Interfaces의 `layout` prop. `"row"`는 지금 markup, `"section"`은 `Section`으로 감싼다.
- `EventPageSkeleton.tsx`: `ui.readingPage`, `BackLink` 자리 `div.back`, `ui.pageHeader`, `Panel` 안에 `Skeleton` 여섯 개(지금 개수 유지).
- `EventCalendar.module.css`: `.eventPage`, `.eventPageCard`, `.backLink`, `.eventAttendance`, `.eventPageCard > p:last-child a` 두 줄, `.rsvp`의 윗선과 위 여백(`margin-top`, `padding-top`, `border-top`)을 지운다. `.rsvpButtons`, `.rsvp p[role="alert"]`, `.description`, `.cancelled`는 남긴다.

- [ ] **Step 4: 테스트 통과를 확인한다**

Run: `cd web && npx vitest run src/features/event`
Expected: PASS. "← 홈" 링크, "현장 출석하기", "운영진 출석 관리", h1 제목 테스트가 그대로 통과

- [ ] **Step 5: 린트, 타입 검사, 캡처**

Run: `npm run lint && npx next typegen && npx tsc --noEmit`, 그리고 `node capture.mjs event after 3001`
Expected: 오류 0, 종료 코드 0. `event-after-390.png`와 `event-before-390.png`를 나란히 보고 사실 표가 한 열, 참석 버튼 쌍이 같은 폭, 패널이 한 겹인지 확인

- [ ] **Step 6: 커밋(승인받고)**

```bash
git add web/src/features/event
git commit -m "feat(web): 일정 상세를 조립 부품으로 옮김"
```

---

### Task 4: 가입 신청(운영진)

**Files:**
- Modify: `web/src/features/member/ApplicationQueue.tsx`, `ApplicationQueueSkeleton.tsx`
- Test: `web/src/features/member/ApplicationQueue.test.tsx`

**Interfaces:** Consumes Task 1. 남기는 클래스: `workspace`, `roster`, `toList`, `placeholder`, `pagination`, `approval`, `decision`, `choice`, `reject`, `fieldLabel`(단원 구분 버튼 묶음의 이름표), `actions`.

- [ ] **Step 1: 실패하는 테스트를 더한다**

```tsx
test("신청자 상세는 파트, 기수, 신청일, 이메일을 사실 표로, 반려 이유는 라벨이 이어진 입력으로 보여 줍니다", async () => {
  expect(await screen.findByRole("term", { name: "이메일" })).toBeInTheDocument();
  expect(screen.getByLabelText("반려 이유")).toHaveAttribute("id", expect.stringMatching(/^reason-/));
});
```

- [ ] **Step 2: 실패를 확인한다** Run: `npx vitest run src/features/member/ApplicationQueue.test.tsx` Expected: FAIL(term 없음)

- [ ] **Step 3: 치환표대로 옮긴다**

`section.ui.page`, `rosterList`→`List as="ul"`, `rosterRow`→`RowButton`, `detail`→`Panel`, `h2`+`facts`→`Section title={item.name}` 안 `Facts`, `approval` 안 `p.hint`→`p.ui.muted`, 반려의 `fieldGroup`→`Field id={`reason-${item.id}`} label="반려 이유"`. 스켈레톤은 `ui.page`, `ui.pageHeader`, `List`.

- [ ] **Step 4: 테스트 통과** Run: `npx vitest run src/features/member/ApplicationQueue.test.tsx` Expected: PASS(기존 9개 포함)

- [ ] **Step 5: 린트, 타입 검사, 캡처** `node capture.mjs applications after 3001`. 390에서 목록과 상세가 번갈아 보이는지(`data-view`) 확인

- [ ] **Step 6: 커밋(승인받고)** `git commit -m "feat(web): 가입 신청 화면을 조립 부품으로 옮김"`

---

### Task 5: 일정 관리(운영진)

**Files:**
- Modify: `web/src/features/event/EventEditor.tsx`, `EventEditorSkeleton.tsx`, `EventBatchCreator.tsx`, `AdminEventRsvps.tsx`, `EventEditor.module.css`
- Test: `EventEditor.test.tsx`, `EventBatchCreator.test.tsx`

**Interfaces:** Consumes Task 1. 남기는 클래스: `workspace`, `roster`, `toList`, `placeholder`, `fields`, `fieldGrid`, `wide`, `picker`, `weekdays`, `days`, `day`, `selectedDates`, `check`, `rsvpSummary`, `rsvpCounts`, `rsvpMembers`.

- [ ] **Step 1: 실패하는 테스트를 더한다** (`EventEditor.test.tsx`)

```tsx
test("등록된 일정 섹션과 고른 일정의 제목이 제목 차례를 지킵니다", async () => {
  expect(await screen.findByRole("heading", { level: 2, name: /등록된 일정/ })).toBeInTheDocument();  // 지금 h2 문구 그대로
  // 일정 하나를 고른 뒤
  expect(screen.getByRole("heading", { level: 3 })).toBeInTheDocument();  // 상세 제목은 Section level 3
});
```

- [ ] **Step 2: 실패를 확인한다** Run: `npx vitest run src/features/event/EventEditor.test.tsx`

- [ ] **Step 3: 치환표대로 옮긴다**

`section`→`Section`, `lead`→`description`, `detail`→`Panel`, `detailHeader`+`when`→`Section level={3} title badge={종류 배지} description={when 문구}`, `form`+`label`/`hint`→`Form`+`Field`(id는 지금 입력 id 그대로), `actions`→`ui.actions`, `rosterList`/`rosterRow`→`List as="ul"`/`RowButton`. `EventBatchCreator`의 `section`/`lead`도 `Section`. `EventEditor.module.css`에서 `.page`, `.section`, `.lead`, `.rosterList`, `.rosterRow`, `.detail`, `.detailHeader`, `.when`, `.form`, `.hint`, `.actions`, `.skeletonHeader`, `.skeletonHeading`을 지운다(이 파일은 이 화면만 쓴다).

- [ ] **Step 4: 테스트 통과** Run: `npx vitest run src/features/event` Expected: PASS

- [ ] **Step 5: 린트, 타입 검사, 캡처** `node capture.mjs admin-events after 3001`

- [ ] **Step 6: 커밋(승인받고)** `git commit -m "feat(web): 일정 관리 화면을 조립 부품으로 옮김"`

---

### Task 6: 단원 계정(운영진)

**Files:**
- Modify: `web/src/features/member/MemberAccountManager.tsx`, `MemberAccountSkeleton.tsx`
- Test: `MemberAccountManager.test.tsx`

**Interfaces:** Consumes Task 1. 남기는 클래스: `workspace`, `roster`, `toList`, `placeholder`, `registerGrid`, `issued`, `more`, `approval`, `roles`, `roleList`, `linkInput`, `actions`.

- [ ] **Step 1: 실패하는 테스트를 더한다**

```tsx
test("단원 추가 폼의 입력은 라벨과 이어지고 계정 목록은 섹션 제목입니다", async () => {
  expect(await screen.findByLabelText("이름")).toHaveAttribute("id", "invite-name");
  expect(screen.getByRole("heading", { level: 2, name: "계정 목록" })).toBeInTheDocument();
});
```

- [ ] **Step 2: 실패를 확인한다** Run: `npx vitest run src/features/member/MemberAccountManager.test.tsx`

- [ ] **Step 3: 치환표대로 옮긴다**

`panel`→`Panel`, `panelHeader`→`Section title actions`, `memberSection`→`Section`, `form`/`fieldGroup`/`fieldLabel`/`hint`→`Form`/`Field`, `inlineForm`/`filters`→`Form layout="inline"`, `callout`→`Callout`, `pendingList`/`pendingRow`→`List as="ul"`/`Row`(행 안의 이름과 설명, 버튼 배치는 `li` 안에서 flex로 두되 그 한 줄은 `AdminPages.module.css`에 `.pendingBody`로 남긴다), `rowHeader`→`Section level={3} title badge`, `detail`→`Panel`, `facts`→`Facts`, `rosterList`/`rosterRow`→`List as="ul"`/`RowButton`. 스켈레톤도 같은 부품.

- [ ] **Step 4: 테스트 통과** Run: `npx vitest run src/features/member` Expected: PASS

- [ ] **Step 5: 린트, 타입 검사, 캡처** `node capture.mjs members after 3001`. 1440에서 등록 폼과 대기 목록 두 칸, 390에서 한 칸인지 확인

- [ ] **Step 6: 커밋(승인받고)** `git commit -m "feat(web): 단원 계정 화면을 조립 부품으로 옮김"`

---

### Task 7: 공지 관리(운영진)

**Files:**
- Modify: `web/src/features/notice/NoticeEditor.tsx`, `NoticeEditorSkeleton.tsx`
- Test: `NoticeEditor.test.tsx`

**Interfaces:** Consumes Task 1. 남기는 클래스: `workspace`, `roster`, `newItem`, `pagination`, `check`, `pollFields`, `pollDetails`, `actions`.

- [ ] **Step 1: 실패하는 테스트를 더한다**

```tsx
test("공지 편집 폼의 제목과 본문 입력은 라벨과 이어집니다", async () => {
  expect(await screen.findByLabelText("제목")).toHaveAttribute("id", "notice-title");
  expect(screen.getByLabelText("본문")).toHaveAttribute("id", "notice-body");
});
```

- [ ] **Step 2: 실패를 확인한다** Run: `npx vitest run src/features/notice/NoticeEditor.test.tsx` (이미 통과하면 이 테스트는 지키는 테스트로 두고 넘어간다)

- [ ] **Step 3: 치환표대로 옮긴다** `rosterList`/`rosterRow`→`List as="ul"`/`RowButton`, `detail`→`Panel`, `form`→`Form`+`Field`, `actions`→`ui.actions`. 스켈레톤도 같은 부품.

- [ ] **Step 4: 테스트 통과** Run: `npx vitest run src/features/notice` Expected: PASS

- [ ] **Step 5: 린트, 타입 검사, 캡처** `node capture.mjs admin-notices after 3001`

- [ ] **Step 6: 커밋(승인받고)** `git commit -m "feat(web): 공지 관리 화면을 조립 부품으로 옮김"`

---

### Task 8: 출석 관리(운영진)

**Files:**
- Modify: `web/src/features/attendance/AdminAttendancePanel.tsx`, `AdminAttendanceSkeleton.tsx`
- Test: `AdminAttendancePanel.test.tsx`

**Interfaces:** Consumes Task 1. 남기는 클래스: `workspace`, `roster`, `toList`, `placeholder`, `grid`, `time`, `code`, `qr`, `actions`.

- [ ] **Step 1: 실패하는 테스트를 더한다**

```tsx
test("출석 관리는 뒤로 가기 링크와 출석 창, 단원별 상태 섹션을 보여 줍니다", async () => {
  expect(await screen.findByRole("link", { name: "← 일정 관리로 돌아가기" })).toHaveAttribute("href", "/admin/events");
  expect(screen.getByRole("heading", { level: 2, name: "출석 창" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { level: 2, name: "단원별 상태" })).toBeInTheDocument();
});
```

- [ ] **Step 2: 실패를 확인한다** Run: `npx vitest run src/features/attendance/AdminAttendancePanel.test.tsx`

- [ ] **Step 3: 치환표대로 옮긴다** `back`→`BackLink`, `panel`→`Panel`, `panelHeader`→`Section title actions`, `memberSection`→`Section`, `rowHeader`→`Section level={3} title badge`, `fieldGroup`→`Field`, `detail`→`Panel`, `rosterList`/`rosterRow`→`List as="ul"`/`RowButton`. 정정 이유 입력은 `Field`로 라벨과 잇는다. 스켈레톤도 같은 부품.

- [ ] **Step 4: 테스트 통과** Run: `npx vitest run src/features/attendance` Expected: PASS

- [ ] **Step 5: 린트, 타입 검사, 캡처** `node capture.mjs admin-attendance after 3001`. 390에서 출석 코드와 QR이 패널 안에 들어오는지 확인

- [ ] **Step 6: 커밋(승인받고)** `git commit -m "feat(web): 출석 관리 화면을 조립 부품으로 옮김"`

---

### Task 9: 공지와 내 출석(단원)

**Files:**
- Modify: `web/src/features/notice/NoticeList.tsx`, `NoticeListSkeleton.tsx`, `NoticeList.module.css`, `web/src/features/attendance/MyAttendancePage.tsx`, `MyAttendanceSkeleton.tsx`, `MyAttendancePage.module.css`
- Test: `NoticeList.test.tsx`(있으면), `NoticeListPoll.test.tsx`, `MyAttendancePage.test.tsx`(있으면)

**Interfaces:** Consumes Task 1. 남기는 클래스: 공지 `h2 button` 펼침, `chevron`, `rowMeta`, `meta`, `expanded`, `body`, `close`, `standalone`, `pagination`; 내 출석 `date`, `eventTitle`, `arrow`, `empty`.

- [ ] **Step 1: 실패하는 테스트를 더한다**

```tsx
// MyAttendancePage
test("출석 기록은 목록이고 각 줄은 일정 상세로 가는 링크입니다", async () => {
  expect(await screen.findByRole("list", { name: "일정별 출석 기록" })).toBeInTheDocument();
  expect(screen.getAllByRole("link")[0]).toHaveAttribute("href", "/events/3");
});
```

- [ ] **Step 2: 실패를 확인한다**(이미 통과하면 지키는 테스트로 둔다)

- [ ] **Step 3: 옮긴다**

- `NoticeList.tsx`: `ui.readingPage`, `list`→`List`, `row`→`Row`(펼침 버튼과 `expanded`는 그대로). `NoticeList.module.css`에서 `.page`, `.list`, `.row`의 여백과 아랫선, `.row h2`의 글자 크기, `.skeletonHeader`를 지운다. 760px의 `.row h2 { font-size: 18px }`는 지운다(부품 값 따름).
- `MyAttendancePage.tsx`: `ui.readingPage`, `ul.list`→`List as="ul" aria-label=...`, `li > Link`→`li > RowLink`. `MyAttendancePage.module.css`에서 `.page`, `.list`, `.list li`, `.list a`, `.list a:hover`, `.list a > span`, `.skeletonHeader`를 지우고 `.empty`의 윗선을 `List` 안 `p.ui.muted`로 바꾼다.
- 스켈레톤 둘은 `ui.readingPage`, `ui.pageHeader`, `List`.

- [ ] **Step 4: 테스트 통과** Run: `npx vitest run src/features/notice src/features/attendance` Expected: PASS

- [ ] **Step 5: 린트, 타입 검사, 캡처** `node capture.mjs notices after 3001`, `node capture.mjs attendance after 3001`

- [ ] **Step 6: 커밋(승인받고)** `git commit -m "feat(web): 공지와 내 출석 화면을 조립 부품으로 옮김"`

---

### Task 10: 공용 CSS 정리와 문서

**Files:**
- Modify: `web/src/features/member/AdminPages.module.css`, `web/src/features/event/EventCalendar.module.css`
- Modify: `docs/design-system.md`

- [ ] **Step 1: 안 쓰는 클래스를 찾는다**

Run (Git Bash):
```bash
cd web && for c in $(grep -oE '^\.[a-zA-Z]+' src/features/member/AdminPages.module.css | sort -u | tr -d .); do n=$(grep -rE "styles\.$c\b|composes: $c\b|\.$c\b" src --include=*.tsx --include=*.css | grep -v "AdminPages.module.css:" | wc -l); [ "$n" = 0 ] && echo "$c"; done
```
Expected: `page`, `panel`, `list`, `row`, `rowButton`, `arrow`, `form`, `fieldGroup`, `hint`, `callout`, `pendingList`, `pendingRow`, `pendingNote`, `back`, `memberSection`, `skeletonHeader`, `skeletonHeading`, `inlineForm`, `filters`, `rosterList`, `rosterRow`, `detail`, `rowHeader`, `facts`, `panelHeader` 정도. 목록에 뜬 클래스와 그 하위 규칙(`.row h2`, `.panel .list` 등)을 지운다. 뜨지 않은 것은 지우지 않는다.

- [ ] **Step 2: 남은 기능 CSS를 훑는다**

`CheckInPanel.module.css`, `WaitingScore.module.css`, `PageGate.module.css`, `MemberLinksPage.module.css`, `NoticePoll.module.css`, `MemberNavigation.module.css`에서 `^\.(page|section|panel|list|row|form|hint|facts|back|callout)\b` 정의를 찾는다. 있으면 그 화면도 치환표대로 옮기고 같은 Task 안에서 그 기능의 테스트를 돌린다. 없으면 둔다.

- [ ] **Step 3: 지우고 확인한다**

Run: `npm run lint && npx next typegen && npx tsc --noEmit && npx vitest run`
Expected: 오류 0, 테스트 전부 PASS. `grep -rn "styles\.\(list\|row\|form\|hint\|facts\|back\|callout\)\b" src/features`가 비어 있다.

- [ ] **Step 4: 스켈레톤과 준비된 화면의 높이를 맞춘다**

`capture.mjs`에 상태 `waiting`(`/auth/me`를 1초 늦게 응답)을 더해 화면키 여덟 개를 390으로 찍고, 각 쌍에서 `header`(PageHeader)의 `getBoundingClientRect().top`이 같은지 스크립트가 비교한다. 다르면 그 스켈레톤을 고친다.

- [ ] **Step 5: 운영 빌드**

Run: `cd web && npm run build`
Expected: 성공. `/design-system`은 운영에서 404(지금 코드 그대로).

- [ ] **Step 6: `docs/design-system.md`를 고친다**

"공통 컴포넌트" 절에 `Section`, `Panel`, `List`와 `Row`, `RowLink`, `RowButton`, `Form`과 `Field`, `Facts`, `BackLink`, `Callout`을 기존 항목과 같은 한 줄씩 더한다. "적용 검증 기록"에 "화면 조립 틀 (2026-11-xx)" 항목을 더해 옮긴 화면, 테스트 파일과 개수, 린트와 빌드, 390과 1440 캡처, 모의 API였음을 기존 항목과 같은 꼴로 적는다.

- [ ] **Step 7: 커밋과 PR(승인받고)**

```bash
git add web/src/features docs/design-system.md
git commit -m "refactor(web): 기능 CSS의 중복 틀 정의를 지움"
```
그 뒤 `feat/composition-layer`를 올리고 `main`으로 PR을 연다. PR 본문에는 before와 after 캡처 가운데 일정 상세와 단원 계정 390 두 쌍만 넣는다.
