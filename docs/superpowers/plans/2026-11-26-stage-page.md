# 무대 페이지 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 공개 머리글에 "무대" 링크(휴대폰은 메뉴 버튼)를 두고, 합창단이 지나온 행사를 연도별로 보는 `/stage` 페이지를 만든다.

**Architecture:** 자료는 `features/onboarding/newsItems.ts`의 `publicNews`에 선택 칸 `stage`를 더해 둔다. `/stage`는 서버 페이지가 `?event=`를 읽어 고른 행사를 정하고, 왼쪽 연도 목록과 오른쪽 본문을 그린다. 머리글 링크 묶음은 공개 메인과 `/stage`가 함께 쓰는 `PublicNav` 부품이고, 휴대폰에서는 브라우저 기본 popover 메뉴가 된다.

**Tech Stack:** Next.js 16.3.6 App Router, React 19.2, CSS Modules, `web/src/styles/tokens.css`, `components/ui` 부품, Vitest와 Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-26-stage-page-design.md`

## Global Constraints

- 색, 글자 크기, 간격, 모서리, 컨트롤 높이는 `tokens.css` 토큰만 쓴다. 숫자를 직접 쓰는 것은 선 굵기 `1px`, `2px`뿐이다(부품과 같다).
- 공개 페이지 루트에서 `--weight-medium`, `--weight-label`, `--weight-heading`을 각각 `var(--weight-public-medium)`, `var(--weight-public-label)`, `var(--weight-public-heading)`으로 바꾸고, 글꼴은 `var(--font-paperlogy), "Pretendard Variable", "Malgun Gothic", sans-serif`, `word-break: keep-all`이다(`SandLanding.module.css`의 `.landing`과 같다).
- 새 화면 문구는 "무대"(링크, 제목)와 화면 읽기용 이름 "메뉴"뿐이다. 나머지는 이미 쓰는 문구다: 지원하기, 단원 로그인, 일시, 장소, 지휘, 공연 사진 보기, 초대장 보기.
- 대시(—)와 가운뎃점(·)을 쓰지 않는다. 제목과 버튼에 숫자를 붙이지 않는다.
- 휴대폰 경계는 `@media (max-width: 760px)`다.
- 새 의존성은 없다. Next 16은 학습한 버전과 다르다. `page`의 `searchParams`는 `Promise`이고, 코드를 쓰기 전 `web/node_modules/next/dist/docs/`의 해당 문서를 읽는다.
- 이 폴더의 파일은 CRLF와 LF가 섞여 있다. 여러 줄을 바꾸기 전에 줄바꿈을 확인한다.
- 작업 브랜치는 `origin/main`에서 딴 `feat/stage-page`다. 체크아웃을 다른 세션과 같이 쓰므로 커밋 직전마다 `git branch --show-current`로 확인한다. 커밋 메시지는 `feat(web): …` 꼴의 짧은 한 줄이고 Claude 표기를 넣지 않는다.
- 명령은 모두 `web/`에서 실행한다.

## Review Focus

1. **360px, 375px 폰의 머리글.** 로고와 메뉴 버튼이 한 줄에 들어가고, 메뉴를 누르면 링크 셋이 열리고, Esc와 바깥 누르기로 닫혀야 한다. Task 2 시험이 버튼과 메뉴의 연결을, Task 4가 실제 화면을 확인한다.
2. **이상한 주소.** `?event=a&event=b`(배열), 페이지가 없는 행사 id, 없는 id 모두 가장 최근 큰 항목이 열려야 한다. Task 1의 `pickStage` 시험이 맡는다.
3. **소개 글이 없는 행사.** 빈 문단이나 빈 칸이 생기면 안 된다. Task 3의 `StageDetail` 시험이 맡는다.
4. **공개 메인 마지막 장면.** 데스크톱 머리글의 "지원하기"가 숨는 지금 동작이 `PublicNav`로 옮긴 뒤에도 남아야 한다. Task 2 시험이 표지(`data-public-nav="apply"`)를, Task 4가 화면을 확인한다.
5. **노트북 화면(1366x768).** 오른쪽 본문이 화면보다 길어도 "초대장 보기"까지 스크롤로 닿아야 한다. Task 4가 확인한다.

---

### Task 1: 무대 자료와 고르는 규칙

**Files:**
- Modify: `web/src/features/concert/stagePhotos.ts` (`hallPhoto` 추가)
- Modify: `web/src/app/gallery/page.tsx:29,39-40` (`hall`과 직접 적은 `alt`를 `hallPhoto`로 바꿈)
- Modify: `web/src/features/onboarding/newsItems.ts`
- Test: `web/src/features/onboarding/newsItems.test.ts`

**Interfaces:**
- Produces:
  - `hallPhoto: Still` (`stagePhotos.ts`). `stagePhoto(195)`에 갤러리 표지의 설명을 `alt`로 얹은 값: "객석에서 본 민주마루 무대. 나무 벽 앞에 합창단이 줄지어 서 있고 가운데에 그랜드피아노가 놓여 있습니다."
  - `type StageDetail = { name: string; photo: { src: string; width: number; height: number; alt: string }; lead?: string; facts: { label: string; value: string }[]; links: { href: string; label: string }[] }`
  - `PublicNewsItem`에 `stage?: StageDetail` 추가
  - `type StageItem = PublicNewsItem & { stage: StageDetail }`
  - `stageYears(items: PublicNewsItem[]): HistoryYear[]`: 최근 해부터, 한 해 안에서도 최근 일부터. 원래 배열은 바꾸지 않는다.
  - `pickStage(items: PublicNewsItem[], event: string | string[] | undefined): StageItem | undefined`: `event`가 문자열이고 `stage`가 있는 항목의 id와 같으면 그 항목, 아니면 날짜가 가장 늦은 `stage` 항목, 하나도 없으면 `undefined`.

- [ ] **Step 1: 실패하는 시험을 `newsItems.test.ts`에 더한다**

```ts
it("무대 페이지는 최근 해부터, 한 해 안에서도 최근 일부터 둔다", () => {
  const years = stageYears(publicNews);
  expect(years.map((year) => year.year)).toEqual(["2026", "2025", "2024"]);
  expect(years[0].items.map((item) => item.id)).toEqual(["concert-2026", "central-club-2026", "fifth-members-2026"]);
});

it("주소의 행사가 없거나 틀리면 가장 최근 큰 항목을 고른다", () => {
  for (const event of [undefined, "", "없는값", "founding-2024"]) {
    expect(pickStage(publicNews, event)?.id).toBe("concert-2026");
  }
});

it("큰 항목이 여럿이면 주소의 행사를 고르고, 배열 주소는 없는 것으로 본다", () => {
  const concert = publicNews.find((item) => item.id === "concert-2026")!;
  const items = [{ ...concert, id: "old", date: "2025-01-01" }, concert];
  expect(pickStage(items, "old")?.id).toBe("old");
  expect(pickStage(items, ["old"])?.id).toBe("concert-2026");
});

it("큰 항목이 하나도 없으면 고르지 않는다", () => {
  expect(pickStage(publicNews.filter((item) => !item.stage), undefined)).toBeUndefined();
});

it("제2회 정기연주회는 사진, 사실 정보, 페이지 링크를 가진 큰 항목이다", () => {
  const stage = publicNews.find((item) => item.id === "concert-2026")!.stage!;
  expect(stage.name).toBe("제2회 정기연주회");
  expect(stage.photo.src).toMatch(/\/view\/195\.webp$/);
  expect(stage.photo.alt).toMatch(/^객석에서 본 민주마루 무대/);
  expect(stage.lead).toBeUndefined();
  expect(stage.facts).toEqual([
    { label: "일시", value: "2026. 11. 20. (금) 19:00" },
    { label: "장소", value: "전남대학교 민주마루" },
    { label: "지휘", value: "박찬영, 박예영" },
  ]);
  expect(stage.links).toEqual([
    { href: "/gallery", label: "공연 사진 보기" },
    { href: "/concert", label: "초대장 보기" },
  ]);
});
```

- [ ] **Step 2: 시험이 실패하는지 본다**

Run: `npx vitest run src/features/onboarding/newsItems.test.ts`
Expected: FAIL (`stageYears`, `pickStage`를 찾을 수 없음)

- [ ] **Step 3: `hallPhoto`, 타입, `stageYears`, `pickStage`, 제2회 `stage` 자료를 만든다**

`stage.facts` 값은 `features/concert/concert.ts`에서 가져오지 않고 옮겨 적는다(그 파일은 다음 연주회 때 바뀐다). `stage.photo`는 `hallPhoto`다. `stageYears`는 `historyByYear` 결과를 뒤집어 만든다. 갤러리 페이지는 `hallPhoto`를 쓰고 `alt`를 직접 적지 않는다.

- [ ] **Step 4: 시험이 통과하는지 본다**

Run: `npx vitest run src/features/onboarding/newsItems.test.ts src/features/onboarding/SandLanding.test.tsx`
Expected: PASS (기존 `historyByYear` 시험과 공개 메인 시험 포함)

- [ ] **Step 5: 커밋한다 (설계 문서와 이 계획도 함께)**

```bash
git add web/src/features/concert/stagePhotos.ts web/src/app/gallery/page.tsx web/src/features/onboarding/newsItems.ts web/src/features/onboarding/newsItems.test.ts docs/superpowers/specs/2026-11-26-stage-page-design.md docs/superpowers/plans/2026-11-26-stage-page.md
git commit -m "feat(web): 무대 자료 추가"
```

---

### Task 2: 공개 머리글 링크 묶음과 휴대폰 메뉴

**Files:**
- Create: `web/src/features/onboarding/PublicNav.tsx`
- Create: `web/src/features/onboarding/PublicNav.module.css`
- Test: `web/src/features/onboarding/PublicNav.test.tsx`
- Modify: `web/src/features/onboarding/SandLanding.tsx:62-65` (`.actions` 묶음을 `<PublicNav />`로)
- Modify: `web/src/features/onboarding/SandLanding.module.css:24-30` (`.actions`, `.headerApply`, `.login`, 760px 버튼 여백 규칙을 지우고, 마지막 장면 규칙을 `.landing[data-current="6"] [data-public-nav="apply"] { visibility: hidden; }`로)
- Test: `web/src/features/onboarding/SandLanding.test.tsx`

**Interfaces:**
- Consumes: `choirChannels.application` (`features/onboarding/choirProfile.ts`), `ActionLink`, `Button` (`components/ui`)
- Produces: `PublicNav({ current }: { current?: "stage" })`. 메뉴 버튼(`Button`, `aria-label="메뉴"`, `popoverTarget="public-nav"`)과 `<nav id="public-nav" popover="auto" aria-label="메뉴">`를 그린다. 링크 순서는 무대(`/stage`, `ActionLink variant="ghost"`), 지원하기(`choirChannels.application`, `target="_blank" rel="noopener noreferrer"`, 기본 variant, `data-public-nav="apply"`), 단원 로그인(`/login`, `variant="secondary"`). `current="stage"`면 무대 링크에 `aria-current="page"`.

- [ ] **Step 1: 실패하는 시험을 쓴다**

`PublicNav.test.tsx`:

```tsx
it("무대, 지원하기, 단원 로그인 순서로 링크를 둔다", () => {
  render(<PublicNav />);
  const nav = screen.getByRole("navigation", { name: "메뉴" });
  expect(within(nav).getAllByRole("link").map((a) => [a.textContent, a.getAttribute("href")])).toEqual([
    ["무대", "/stage"], ["지원하기", choirChannels.application], ["단원 로그인", "/login"],
  ]);
  expect(within(nav).getByRole("link", { name: "지원하기" })).toHaveAttribute("data-public-nav", "apply");
});

it("휴대폰 메뉴 버튼이 링크 묶음을 연다", () => {
  render(<PublicNav />);
  const nav = screen.getByRole("navigation", { name: "메뉴" });
  expect(nav).toHaveAttribute("popover", "auto");
  expect(screen.getByRole("button", { name: "메뉴" })).toHaveAttribute("popovertarget", nav.id);
});

it("무대 페이지에서는 무대 링크가 지금 페이지임을 알린다", () => {
  render(<PublicNav current="stage" />);
  expect(screen.getByRole("link", { name: "무대" })).toHaveAttribute("aria-current", "page");
});
```

`SandLanding.test.tsx`에 더한다:

```tsx
it("머리글에서 무대 페이지로 갈 수 있다", () => {
  const { container } = render(<SandLanding />);
  expect(within(container.querySelector("header")!).getByRole("link", { name: "무대" })).toHaveAttribute("href", "/stage");
});
```

- [ ] **Step 2: 시험이 실패하는지 본다**

Run: `npx vitest run src/features/onboarding/PublicNav.test.tsx src/features/onboarding/SandLanding.test.tsx`
Expected: FAIL (`PublicNav` 없음, 머리글에 "무대" 링크 없음)

- [ ] **Step 3: `PublicNav`를 만들고 공개 메인 머리글에 넣는다**

메뉴 아이콘은 선 세 개짜리 인라인 SVG(`aria-hidden`, `stroke="currentColor"`)다. CSS 결정:
- 761px 이상: 메뉴 버튼은 `display: none`. `nav`는 UA의 popover 숨김을 덮어 `display: flex; position: static; inset: auto; margin: 0; padding: 0; border: 0; background: transparent; overflow: visible; gap: var(--space-2)`로 한 줄에 둔다. 링크는 `white-space: nowrap`.
- 760px 이하: 메뉴 버튼은 `width: var(--control-medium); padding: 0`인 정사각형. 열린 메뉴(`:popover-open`)는 `position: fixed; inset: var(--space-16) var(--space-5) auto auto; margin: 0; display: flex; flex-direction: column; gap: var(--space-2); padding: var(--space-3); border: 1px solid var(--color-line); border-radius: var(--radius-panel); background: var(--color-surface)`이고 링크는 폭을 꽉 채운다.
- `[aria-current="page"]` 링크는 `background: var(--color-selected)`.

- [ ] **Step 4: 시험이 통과하는지 본다**

Run: `npx vitest run src/features/onboarding`
Expected: PASS

- [ ] **Step 5: 커밋한다**

```bash
git add web/src/features/onboarding/PublicNav.tsx web/src/features/onboarding/PublicNav.module.css web/src/features/onboarding/PublicNav.test.tsx web/src/features/onboarding/SandLanding.tsx web/src/features/onboarding/SandLanding.module.css web/src/features/onboarding/SandLanding.test.tsx
git commit -m "feat(web): 공개 머리글에 무대 링크와 메뉴 추가"
```

---

### Task 3: 무대 페이지

**Files:**
- Create: `web/src/app/stage/page.tsx`
- Create: `web/src/app/stage/StageDetail.tsx`
- Create: `web/src/app/stage/stage.module.css`
- Test: `web/src/app/stage/StageDetail.test.tsx`
- Test: `web/src/app/stage/page.test.tsx`

**Interfaces:**
- Consumes: `stageYears`, `pickStage`, `StageItem`, `publicNews` (Task 1), `PublicNav` (Task 2), `paperlogy` (`app/fonts/paperlogy.ts`), `BrandLogo`, `PageHeader`, `ActionLink`, `Section`, `List`, `Row`, `RowLink`, `Facts`
- Produces:
  - `StageDetail({ item, className }: { item: StageItem; className?: string })`: 사진(`next/image`, `unoptimized`), 이름 `h3`, 소개 글 `p`(있을 때만, 이 부품의 유일한 `p`), `Facts`, 링크(첫 링크 `ActionLink size="large"`, 나머지는 `variant="secondary" size="large"`).
  - `default async function StagePage({ searchParams }: { searchParams: Promise<{ event?: string | string[] }> })`, `metadata = { title: "무대" }`

화면 구조:
- 루트 `div`에 `paperlogy.variable`과 공개 페이지 굵기, 글꼴 규칙(Global Constraints). 배경 `var(--color-surface)`.
- 머리글: 홈 링크(`aria-label="전남대학교 합창단 처음으로"`, `BrandLogo alt=""`, `--logo-width: min(36vw, 190px)`)와 `<PublicNav current="stage" />`. 높이 `var(--space-16)`, 좌우 `var(--page-gutter)`, 아래 `1px solid var(--color-line)`.
- `main`: `max-width: var(--layout-public)`, 가운데, 여백 `var(--page-top) var(--page-gutter) var(--page-bottom)`.
- `PageHeader title="무대"`. 이 페이지에서만 `h1`을 `--text-display`로(부품의 `.title`보다 구체적인 선택자).
- 두 칸 `grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); gap: var(--space-16); align-items: start`. 오른쪽 `aside`는 `position: sticky; top: var(--space-8)`이고 고른 항목의 `StageDetail`을 담는다.
- 연도마다 `Section title={year} id={"year-" + year}`, 그 안에 `List as="ul"`.
  - 큰 항목: `li` 안에 `RowLink href={"/stage?event=" + id} scroll={false} aria-current={고름 ? "true" : undefined}`, 안에 `strong`(stage.name)과 `span`(monthDay). 이 `strong`은 `--text-title`, `--weight-heading`, `letter-spacing: var(--tracking-heading)`, 줄 위아래 여백 `var(--space-4)`. 고른 항목이면 `li` 안 `RowLink` 아래에 `StageDetail`을 한 번 더 그린다(휴대폰용).
  - 작은 줄: `Row as="li"`, 안에 `strong`(title, `--text-body`)과 `span`(monthDay). 이름과 날짜를 두 칸 grid로.
  - 날짜 `span`은 둘 다 `--text-label`, `--color-muted`.
- `StageDetail` 안: 사진 `aspect-ratio: 3 / 2; object-fit: cover; border-radius: var(--radius-panel)`, 이름 `--text-title`, 소개 글 `--text-section`과 `--weight-body`, `Facts`의 `dt`는 `--text-label`, `dd`는 `--text-body`(선택자 두 단계로 부품 규칙을 이긴다), 사이 간격은 `--space-*`.
- 760px 이하: 한 칸, `aside`는 `display: none`, 목록 안 `StageDetail`만 보인다. 761px 이상: 목록 안 `StageDetail`은 `display: none`.

- [ ] **Step 1: 실패하는 시험을 쓴다**

`StageDetail.test.tsx`:

```tsx
const concert = publicNews.find((item) => item.id === "concert-2026") as StageItem;

it("사진, 이름, 사실 정보, 페이지 링크를 보여 준다", () => {
  render(<StageDetail item={concert} />);
  expect(screen.getByRole("img", { name: /^객석에서 본 민주마루 무대/ })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "제2회 정기연주회" })).toBeInTheDocument();
  expect(screen.getByText("전남대학교 민주마루")).toBeInTheDocument();
  expect(screen.getAllByRole("link").map((a) => [a.textContent, a.getAttribute("href")])).toEqual([
    ["공연 사진 보기", "/gallery"], ["초대장 보기", "/concert"],
  ]);
});

it("소개 글이 없으면 빈 문단을 두지 않는다", () => {
  const { container } = render(<StageDetail item={concert} />);
  expect(container.querySelectorAll("p")).toHaveLength(0);
});

it("소개 글이 있으면 문단으로 보인다", () => {
  render(<StageDetail item={{ ...concert, stage: { ...concert.stage, lead: "시험 소개 글" } }} />);
  expect(screen.getByText("시험 소개 글").tagName).toBe("P");
});
```

`page.test.tsx`:

```tsx
const page = (event?: string) => Page({ searchParams: Promise.resolve(event === undefined ? {} : { event }) });

it("최근 해부터 연도를 나누고 페이지가 있는 행사만 고를 수 있다", async () => {
  render(await page());
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("무대");
  expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(["2026", "2025", "2024"]);
  const pick = screen.getByRole("link", { name: /제2회 정기연주회/ });
  expect(pick).toHaveAttribute("href", "/stage?event=concert-2026");
  expect(pick).toHaveAttribute("aria-current", "true");
  expect(screen.getByText("전남대학교 중앙동아리 승격")).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /중앙동아리 승격/ })).toBeNull();
});

it.each([undefined, "없는값"])("주소가 %s여도 제2회 정기연주회 본문을 연다", async (event) => {
  render(await page(event));
  const panel = screen.getByRole("complementary");
  expect(within(panel).getByRole("heading", { name: "제2회 정기연주회" })).toBeInTheDocument();
  expect(within(panel).getByRole("link", { name: "공연 사진 보기" })).toHaveAttribute("href", "/gallery");
});

it("머리글의 무대가 지금 페이지임을 알린다", async () => {
  render(await page());
  expect(screen.getByRole("link", { name: "무대" })).toHaveAttribute("aria-current", "page");
});
```

- [ ] **Step 2: 시험이 실패하는지 본다**

Run: `npx vitest run src/app/stage`
Expected: FAIL (`./page`, `./StageDetail` 없음)

- [ ] **Step 3: `StageDetail`, `page.tsx`, `stage.module.css`를 위 구조대로 만든다**

- [ ] **Step 4: 시험과 타입 검사가 통과하는지 본다**

Run: `npx vitest run src/app/stage && npx next typegen && npx tsc --noEmit`
Expected: 시험 PASS, 타입 오류 없음

- [ ] **Step 5: 커밋한다**

```bash
git add web/src/app/stage
git commit -m "feat(web): 무대 페이지 추가"
```

---

### Task 4: 화면 확인과 전체 검사

**Files:** 없음 (고칠 곳이 나오면 해당 Task의 파일을 고치고 그 Task 꼴로 커밋)

- [ ] **Step 1: 개발 서버를 띄운다**

`.claude/launch.json`의 `web`(3000)을 `preview_start`로 띄운다. 같은 폴더에서 `next dev`는 하나만 돌 수 있으니, 이미 3000이 떠 있으면 그것을 쓴다. 워크트리에서 작업했다면 그 워크트리의 서버를 쓴다.

- [ ] **Step 2: 데스크톱(1280x800)에서 `/stage`를 본다**

Expected: 머리글 한 줄(로고, 무대, 지원하기, 단원 로그인)에 "무대"가 고른 바탕. 왼쪽 2026, 2025, 2024 구역. "제2회 정기연주회" 행에 왼쪽 초록 선. 오른쪽에 사진, 이름, 일시, 장소, 지휘, 두 버튼. 목록 안 본문은 보이지 않음. `/stage?event=없는값`도 같은 화면.

- [ ] **Step 3: 노트북(1366x768)에서 맨 아래까지 스크롤한다**

Expected: "초대장 보기" 버튼이 화면 안에 들어온다.

- [ ] **Step 4: 휴대폰(375x812, 360x780)에서 `/stage`와 `/`를 본다**

Expected: 두 페이지 모두 머리글이 로고와 메뉴 버튼 한 줄. 메뉴를 누르면 무대, 지원하기, 단원 로그인이 열리고, Esc와 바깥 누르기로 닫힘. `/stage`는 한 칸이고 오른쪽 본문 칸이 없으며, "제2회 정기연주회" 아래에 본문이 펼쳐져 있음.

- [ ] **Step 5: 공개 메인 데스크톱 마지막 장면을 본다**

Expected: 맨 아래 지원 장면에서 머리글의 "지원하기"가 숨고, 다른 장면에서는 보인다.

- [ ] **Step 6: 새 CSS에 토큰이 아닌 값이 없는지 본다**

Run: `grep -nE "#[0-9a-fA-F]{3,8}\b|[0-9.]+(px|rem|em)\b" src/app/stage/stage.module.css src/features/onboarding/PublicNav.module.css`
Expected: `1px`, `2px` 선 굵기와 `--logo-width: min(36vw, 190px)` 줄만 나온다.

- [ ] **Step 7: 전체 검사를 돌린다**

Run: `npm run lint && npx next typegen && npx tsc --noEmit && npx vitest run`
Expected: 오류 없음, 모든 시험 PASS

- [ ] **Step 8: 화면 캡처를 사용자에게 보낸다**

데스크톱 `/stage`, 휴대폰 `/stage`, 휴대폰 메뉴 열린 모습 세 장을 줄여서 한 번에 보낸다.
