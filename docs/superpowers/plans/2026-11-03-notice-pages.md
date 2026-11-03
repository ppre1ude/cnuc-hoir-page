# 공지 열람과 작성 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 단원 공지 목록에 번호 있는 페이지 넘김과 바로 펼침을 넣고, 운영진 공지 관리를 목록, 새 공지 작성, 공지 수정 세 화면으로 나눈다.

**Architecture:** 공통 `Pagination`(`components/ui`)이 네 목록의 복제된 이전과 다음을 대신한다. 단원 목록은 받아 둔 본문을 바로 펼치고 `?page=`를 주소에 남긴다. 운영진은 `NoticeManager`(목록), `NoticeForm`(작성과 수정이 함께 쓰는 폼)과 두 라우트(`/admin/notices/new`, `/admin/notices/[id]`)로 나뉘고, 옛 `NoticeEditor`는 지운다. 서버는 바꾸지 않는다.

**Tech Stack:** Next.js 16 App Router(`PageProps<"/admin/notices/[id]">`, `useSearchParams`, `useRouter`), React 19, CSS Modules, vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-03-notice-pages-design.md`

## Global Constraints

- 화면 문구에 대시(—)와 가운뎃점(·)을 쓰지 않는다. 범위는 물결표. 커밋 메시지는 `type(scope): 대상 수정` 꼴로 짧게.
- 새 API 없음. `GET /admin/notices/{id}`는 서버에 이미 있고 클라이언트 함수 `getAdminNotice(id)`만 더한다.
- 한 페이지 20개 유지. 페이지 번호는 최대 7개, 버튼 높이 44px, 현재 페이지 `aria-current="page"`.
- 주소의 `?page=`는 사람 기준 1부터, 1쪽은 생략. 범위 밖이면 마지막 쪽으로 보정하고 주소도 고친다.
- 디자인 시스템의 기존 패턴만 쓴다. 투표 선택 버튼 묶음은 가입 승인의 단원 구분(`role="group"`, `aria-pressed`)과 같은 모양(`AdminPages.module.css`의 `.choice`).

## Review Focus

1. `?page=abc`, `?page=0`, `?page=999`처럼 잘못된 쪽으로 들어와도 빈 화면이 아니라 마지막 쪽이 보여야 한다. Task 2 테스트.
2. `?notice=9`로 바로 연 공지가 현재 쪽 밖이면 지금처럼 상세 API로 받아야 하고, 현재 쪽 안이면 그 행이 펼쳐져야 한다. Task 2 테스트 둘.
3. 작성 화면에서 투표를 켠 채 마감 시각을 비우고 게시하면 저장하지 않고 오류를 보여야 한다. Task 4 테스트.
4. 수정 화면에서 "초안으로 내리기"의 확인 창을 취소하면 아무것도 보내지 않아야 한다. Task 5 테스트.
5. 수정 화면을 열고 공지가 404면 오류 문구와 공지 관리 링크가 보여야 한다. Task 5 테스트.

---

### Task 1: 공통 `Pagination`

**Files:**
- Modify: `web/src/components/ui/index.tsx`(컴포넌트 추가), `web/src/components/ui/ui.module.css`(`.pagination`, `.pages`, `.pageCurrent`, `.pageSummary`와 760px 규칙)
- Test: `web/src/components/ui/Pagination.test.tsx`(새 파일)

**Interfaces:**
- Produces: `export function Pagination({ page, size, total, onChange, label }: { page: number; size: number; total: number; onChange: (page: number) => void; label: string }): ReactElement | null`. `page`는 0부터. `total <= size`면 `null`.
- 마크업: `nav[aria-label=label]` 안에 `button` "이전"(`disabled` on 첫 쪽), 번호 버튼들(`aria-label="N쪽"`, 현재는 `aria-current="page"`), `span.pageSummary`에 "N / M"(`aria-label="M쪽 중 N쪽"`), `button` "다음"(`disabled` on 끝 쪽). 번호는 현재를 가운데 둔 연속 7개(`Math.max(0, Math.min(page - 3, pages - 7))`부터).
- CSS: 번호 사이 `--space-2`, 이전과 다음은 번호 묶음과 `--space-4`, 버튼은 `Button` medium(44px). 현재 번호는 primary 모양. 760px 이하에서 번호 묶음 `display: none`, `.pageSummary`는 그 반대.

- [ ] **Step 1: 실패하는 테스트 작성** `Pagination.test.tsx`
```ts
test("한 쪽뿐이면 그리지 않습니다")                  // total 20, size 20 → container 비어 있음
test("현재 쪽을 가운데 둔 번호 7개와 이전, 다음을 보입니다") // page 5(0부터), total 240 → 버튼 이름 "3쪽"~"9쪽", "6쪽"에 aria-current="page", "이전"과 "다음" 켜짐
test("첫 쪽에서 이전이, 끝 쪽에서 다음이 꺼집니다")      // page 0 → 이전 disabled, 번호 "1쪽"~"7쪽"; page 11 → 다음 disabled, "6쪽"~"12쪽"
test("번호를 누르면 0부터 세는 쪽을 알립니다")           // "4쪽" 클릭 → onChange(3)
test("화면 읽기에는 전체 중 현재 쪽을 읽어 줍니다")      // getByLabelText("12쪽 중 6쪽")
```
- [ ] **Step 2: 실패 확인** Run: `npx vitest run src/components/ui/Pagination.test.tsx` Expected: FAIL, `Pagination`이 export되지 않음
- [ ] **Step 3: 구현** Interfaces대로. 주석 한 줄에 `ponytail: 줄임표와 첫 쪽, 끝 쪽 바로가기 없음. 열 쪽을 넘으면 더한다`.
- [ ] **Step 4: 통과 확인** Run: 같은 명령 Expected: PASS
- [ ] **Step 5: 커밋** `git commit -m "feat(web): 페이지 넘김 컴포넌트 추가"`

### Task 2: 단원 공지 화면

**Files:**
- Create: `web/src/lib/pageParam.ts`(`usePageParam`)
- Modify: `web/src/features/notice/NoticeList.tsx`, `web/src/features/notice/NoticeList.module.css`(`.pagination` 삭제), `web/src/app/(member)/notices/page.tsx`
- Test: `web/src/features/notice/NoticeList.test.tsx`, `web/src/lib/pageParam.test.ts`(새 파일)

**Interfaces:**
- Produces: `export function usePageParam(): [page: number, setPage: (page: number) => void]`. `useSearchParams().get("page")`를 읽어 0부터 세는 쪽으로 바꾸고(없음, 글자, 0 이하는 0), `setPage`는 `router.replace`로 `?page=N+1`(0이면 매개변수 삭제)을 쓰되 다른 매개변수(`notice`)는 유지하고 `{ scroll: false }`다. 범위 보정은 쓰는 쪽이 `total`을 안 뒤에 `setPage(마지막 쪽)`으로 한다.
- `NoticeList`: `useState(page)` 대신 `usePageParam()`. 받은 결과의 `total`로 `page`가 범위 밖이면 `setPage(Math.max(0, Math.ceil(total / size) - 1))`. 목록에 있는 공지를 열면 `getNotice`를 부르지 않고 그 항목의 `body`로 `detail()`을 그린다(`visibleNotice`는 목록 항목 또는 standalone 응답). 쪽을 바꾸면 `document.getElementById("member-content")?.focus()`와 `scrollIntoView({ block: "start" })`.
- `notices/page.tsx`: `searchParams`에서 `page`는 읽지 않는다(클라이언트 훅이 읽는다). `key`는 지금처럼 `notice` 기준.

- [ ] **Step 1: 실패하는 테스트 작성** `pageParam.test.ts`(`next/navigation` 모킹: `useSearchParams`, `useRouter.replace`)
```ts
test("page가 없거나 잘못되면 0쪽입니다")   // "", "abc", "0", "-2" → 0; "3" → 2
test("쪽을 바꾸면 주소에 1부터 센 번호를 남기고 1쪽은 지웁니다") // setPage(2) → replace("?page=3", {scroll:false}); setPage(0) → replace("?") 또는 경로만; notice=9는 유지
```
`NoticeList.test.tsx`에 추가:
```ts
test("목록에 있는 공지는 상세 요청 없이 바로 펼칩니다")    // 제목 클릭 → 본문 보임, getNotice 호출 0회
test("현재 쪽에 없는 공지를 바로 열면 상세 요청으로 받습니다") // initialNoticeId=99 → getNotice(99) 1회
test("범위 밖 쪽으로 들어오면 마지막 쪽으로 보정합니다")    // page=9(총 2쪽) → replace("?page=2"), 2쪽 목록 요청
test("쪽을 바꾸면 본문 영역으로 초점을 옮깁니다")          // "다음" 클릭 → document.activeElement가 main#member-content
```
- [ ] **Step 2: 실패 확인** Run: `npx vitest run src/lib/pageParam.test.ts src/features/notice/NoticeList.test.tsx` Expected: FAIL
- [ ] **Step 3: 구현** Interfaces대로. 이전과 다음 `nav`를 `<Pagination label="공지 목록 페이지" ... />`로 바꾸고 `NoticeList.module.css`의 `.pagination`을 지운다. `detail()`의 `!visibleNotice` 스켈레톤 분기는 standalone일 때만 남는다.
- [ ] **Step 4: 통과 확인** Run: `npx vitest run src/features/notice src/lib` Expected: PASS
- [ ] **Step 5: 커밋** `git commit -m "feat(web): 공지 목록 페이지 넘김과 바로 펼침"`

### Task 3: 공지 관리 목록 `NoticeManager`

**Files:**
- Create: `web/src/features/notice/NoticeManager.tsx`, `web/src/features/notice/NoticeManagerSkeleton.tsx`, `web/src/features/notice/NoticeManager.module.css`
- Modify: `web/src/app/(admin)/admin/notices/page.tsx`(`NoticeEditor` 대신 `NoticeManager`), `web/src/app/(admin)/admin/notices/page.test.tsx`(모킹 대상 이름)
- Delete: `web/src/features/notice/NoticeEditor.tsx`, `NoticeEditor.test.tsx`, `NoticeEditorSkeleton.tsx`(Task 4, 5가 끝난 뒤 이 Task의 마지막 단계에서가 아니라 Task 5 끝에서 지운다. 여기서는 라우트 연결만 바꾼다)
- Test: `web/src/features/notice/NoticeManager.test.tsx`

**Interfaces:**
- Produces: `export function NoticeManager(): ReactElement`. `usePageParam()`과 `getAdminNotices(page)`로 목록을 받는다. `PageHeader title="공지 관리" actions={<ActionLink href="/admin/notices/new">새 공지 작성</ActionLink>}`. 행은 `Link`(`href`는 1쪽이면 `/admin/notices/{id}`, 아니면 `/admin/notices/{id}?page=N+1`)에 제목, `StatusBadge`("게시" neutral, "초안" attention), `time`(게시면 `publishedAt`, 초안이면 `updatedAt`, `ko-KR` medium date), `span[aria-hidden]` →. 목록 마크업은 `ul.list > li > a.row`(굵은 윗선, 가는 구분선, 44px 이상, `AdminPages.module.css`의 `.rowButton`과 같은 규칙을 Link용으로 옮김).
- 결과 안내: `useSearchParams().get("done")`이 `published`면 "공지를 게시했습니다.", `draft`면 "초안으로 저장했습니다."를 `Feedback`으로 보이고 `router.replace`로 `done`만 지운다(쪽은 유지).
- 빈 목록 "작성된 공지가 없습니다. 새 공지 작성으로 첫 공지를 올려 주세요." 실패 "공지 목록을 불러오지 못했습니다." + 다시 시도.

- [ ] **Step 1: 실패하는 테스트 작성** `NoticeManager.test.tsx`(`./notices`의 `getAdminNotices` 모킹, `next/navigation` 모킹)
```ts
test("공지를 제목, 상태, 날짜와 수정 화면 링크로 늘어놓습니다")   // 게시 공지 → "게시" 배지와 게시일, href "/admin/notices/5"; 초안 → "초안" 배지와 수정일
test("새 공지 작성 링크가 제목 옆에 있습니다")               // link name "새 공지 작성" href "/admin/notices/new"
test("2쪽의 행 링크는 쪽 번호를 들고 갑니다")                // page=2 → href "/admin/notices/5?page=2"
test("돌아온 결과 안내를 한 번 보이고 주소에서 지웁니다")     // ?done=published → "공지를 게시했습니다.", replace에 done 없음
test("빈 목록과 실패를 안내합니다")
```
- [ ] **Step 2: 실패 확인** Run: `npx vitest run src/features/notice/NoticeManager.test.tsx` Expected: FAIL
- [ ] **Step 3: 구현** Interfaces대로. 스켈레톤은 제목 자리와 `SkeletonRows count={5}`.
- [ ] **Step 4: 통과 확인** Run: `npx vitest run src/features/notice src/app` Expected: PASS
- [ ] **Step 5: 커밋** `git commit -m "feat(web): 공지 관리 목록 화면 분리"`

### Task 4: `NoticeForm`과 새 공지 작성 `/admin/notices/new`

**Files:**
- Create: `web/src/features/notice/NoticeForm.tsx`, `web/src/features/notice/NoticeFormSkeleton.tsx`, `web/src/features/notice/NoticePollChoice.tsx`(투표 버튼 묶음과 칸), `web/src/features/notice/noticeDraft.ts`(옛 `NoticeEditor`의 `Draft`, `readDraft`, `writeDraft`를 옮김), `web/src/app/(admin)/admin/notices/new/page.tsx`(`metadata.title` "새 공지 작성", `PageGate permission="MANAGE_EVENTS"`)
- Test: `web/src/features/notice/NoticeForm.test.tsx`

**Interfaces:**
- `noticeDraft.ts`: `export type Draft = { title; body; poll: "none" | "attendance" | "agree" | "custom"; pollQuestion; firstOption; secondOption; pollClosesAt }`, `emptyDraft`, `readDraft()`, `writeDraft(draft)`, `clearDraft()`. 저장 키 `notice-draft`는 그대로. `published`와 `includePoll` 필드는 없앤다(버튼과 `poll` 값이 대신한다).
- `NoticePollChoice({ value, onChange, disabled }: { value: Draft; onChange: (patch: Partial<Draft>) => void; disabled?: boolean })`: 라벨 "투표", `role="group" aria-label="투표"` 안에 버튼 넷 "없음", "참석 / 불참", "찬성 / 반대", "직접 입력"(`aria-pressed`). 누르면 `poll`과 선택지(참석과 불참, 찬성과 반대, 직접 입력은 그대로)를 바꾼다. `poll !== "none"`이면 질문(200자), 첫 번째 선택지와 두 번째 선택지(80자, 고치면 `poll: "custom"`), 마감 시각(한국 시간, `datetime-local`)과 안내 세 줄을 보인다.
- `NoticeForm({ mode, initial, notice, onSaved }: { mode: "new" } | { mode: "edit"; notice: Notice; poll: AdminPollView | null })`는 Task 5에서 `edit`를 채운다. 이 Task는 `mode: "new"`만 구현한다. `new`일 때: `readDraft()`로 시작, 바뀔 때마다 `writeDraft`, 되살린 초안이 있으면(`readDraft()`가 `emptyDraft`와 다르면) 위에 `Feedback` "작성 중이던 공지를 되살렸습니다."와 `Button` "지우기"(`clearDraft()` 후 `emptyDraft`). 버튼은 `Button variant="secondary" type="submit" name="publish" value="false"` "초안으로 저장"과 `Button variant="primary" type="submit" name="publish" value="true"` "게시하기"이고 둘 다 제목이나 본문이 비면 `disabled`. 제출은 `event.nativeEvent.submitter`의 `value`로 `published`를 정한다. 투표가 켜졌는데 마감 시각이 비거나 잘못되면 "투표 마감 시각을 확인해 주세요."를 보이고 보내지 않는다. `createNotice({ title, body, published, poll? })` 성공 시 `clearDraft()` 뒤 `router.push("/admin/notices?done=published" 또는 "?done=draft")`. 실패는 `INVALID_POLL`, `POLL_EXISTS`면 서버 문구, 아니면 "공지를 저장하지 못했습니다."
- 작성 화면 위에 `Link` "← 공지 관리로"(`href="/admin/notices"`, 출석 관리의 `.back` 스타일을 `AdminPages.module.css`에서 재사용), 제목 `h1` "새 공지 작성". 본문 아래 `p.hint` "주소를 적으면 단원 화면에서 링크가 됩니다."

- [ ] **Step 1: 실패하는 테스트 작성** `NoticeForm.test.tsx`(`./notices` 모킹, `next/navigation` 모킹, `sessionStorage` 초기화)
```ts
test("게시하기는 published true로, 초안으로 저장은 false로 보내고 목록으로 돌아갑니다") // createNotice 인자와 push("/admin/notices?done=published"), ("?done=draft")
test("제목이나 본문이 비면 두 버튼이 꺼집니다")
test("투표를 참석 / 불참으로 고르면 선택지가 채워지고 직접 고치면 직접 입력이 됩니다")  // aria-pressed 이동, 입력값
test("투표를 켜고 마감 시각이 비면 저장하지 않고 안내합니다")
test("작성 중이던 공지를 되살리고 지우기로 비웁니다")  // sessionStorage에 초안 → Feedback, 지우기 → 빈 폼, 저장소 비움
test("서버가 투표 오류를 돌려주면 그 문구를 보입니다")  // INVALID_POLL
```
- [ ] **Step 2: 실패 확인** Run: `npx vitest run src/features/notice/NoticeForm.test.tsx` Expected: FAIL
- [ ] **Step 3: 구현** Interfaces대로. 옛 `NoticeEditor`의 저장 로직(마감 시각 `+09:00` 변환, 오류 분기)을 옮겨 온다.
- [ ] **Step 4: 통과 확인** Run: `npx vitest run src/features/notice` Expected: PASS
- [ ] **Step 5: 커밋** `git commit -m "feat(web): 새 공지 작성 화면 분리"`

### Task 5: 공지 수정 `/admin/notices/[id]`와 옛 편집기 삭제

**Files:**
- Create: `web/src/app/(admin)/admin/notices/[id]/page.tsx`(`PageProps<"/admin/notices/[id]">`, `metadata.title` "공지 수정", 숫자가 아니면 "공지 주소를 확인해 주세요."), `web/src/features/notice/NoticeEdit.tsx`(불러오기 + `NoticeForm mode="edit"`), `web/src/features/notice/NoticePollResults.tsx`(옛 투표 결과 절)
- Modify: `web/src/features/notice/notices.ts`(`getAdminNotice(id: number): Promise<Notice>` = `GET /admin/notices/{id}`), `web/src/features/notice/NoticeForm.tsx`(`edit` 모드)
- Delete: `web/src/features/notice/NoticeEditor.tsx`, `NoticeEditor.test.tsx`, `NoticeEditorSkeleton.tsx`
- Test: `web/src/features/notice/NoticeEdit.test.tsx`

**Interfaces:**
- `NoticeEdit({ noticeId }: { noticeId: number })`: `getAdminNotice`와 `getAdminNoticePoll`(404면 투표 없음)을 받는다. 받는 동안 `NoticeFormSkeleton`, 404면 `Feedback`(error) "공지를 찾을 수 없습니다."와 `ActionLink` "공지 관리로"(`/admin/notices`), 그 밖의 실패는 "공지를 불러오지 못했습니다."와 다시 시도. `useSearchParams().get("page")`를 읽어 돌아가기 링크 `href`를 `/admin/notices` 또는 `/admin/notices?page=N`으로 만든다.
- `NoticeForm` `edit` 모드: 제목 `h1` "공지 수정" 옆에 `StatusBadge`("게시" 또는 "초안")와 게시일(`time`). 초깃값은 공지의 제목과 본문, `poll: "none"`. 투표가 있으면 `NoticePollResults`(질문, 마감, 선택지별 인원, 응답자 명단. 옛 `NoticeEditor`의 `section[aria-label="투표 결과"]`를 옮김)를 보이고 `NoticePollChoice`는 숨긴다. 버튼: 초안이면 "저장"(secondary, published 그대로 false)과 "게시하기"(primary, true). 게시 중이면 "저장"(primary, true)과 "초안으로 내리기"(secondary, false). "초안으로 내리기"는 `window.confirm("이 공지를 초안으로 내리면 단원에게 보이지 않습니다. 다시 게시하면 게시일이 새로 정해져 목록 맨 위로 올라갑니다. 계속할까요?")`가 참일 때만 보낸다. `updateNotice(id, { title, body, published, poll? })` 성공 시 이 화면에 머물며 "저장했습니다.", "게시했습니다.", "초안으로 내렸습니다." 중 하나를 `Feedback`으로 보이고 응답의 `published`, `publishedAt`으로 배지와 버튼을 바꾼다. 임시 저장은 쓰지 않는다.

- [ ] **Step 1: 실패하는 테스트 작성** `NoticeEdit.test.tsx`
```ts
test("초안 공지는 저장과 게시하기 버튼을, 게시 공지는 저장과 초안으로 내리기를 보입니다")
test("게시하기는 published true로 보내고 머물면서 게시했습니다를 알립니다")   // 배지가 "게시"로 바뀜
test("초안으로 내리기는 확인 창을 취소하면 보내지 않습니다")               // window.confirm → false, updateNotice 0회
test("투표가 있으면 결과와 응답자 명단을 보이고 투표 묶음은 없습니다")       // getAdminNoticePoll 성공
test("투표가 없으면 투표 묶음으로 붙일 수 있습니다")                       // 404 → group "투표" 보임
test("공지가 없으면 안내와 공지 관리 링크를 보입니다")                     // getAdminNotice 404
test("돌아가기 링크는 들어온 쪽을 유지합니다")                             // ?page=3 → href "/admin/notices?page=3"
```
- [ ] **Step 2: 실패 확인** Run: `npx vitest run src/features/notice/NoticeEdit.test.tsx` Expected: FAIL
- [ ] **Step 3: 구현** Interfaces대로. 그 뒤 `NoticeEditor.tsx`, `NoticeEditor.test.tsx`, `NoticeEditorSkeleton.tsx`를 지우고 남은 참조가 없는지 `grep -rn NoticeEditor web/src`로 본다.
- [ ] **Step 4: 통과 확인** Run: `npx vitest run src/features/notice src/app && npx tsc --noEmit -p .` Expected: PASS, tsc 0
- [ ] **Step 5: 커밋** `git commit -m "feat(web): 공지 수정 화면 분리"`

### Task 6: 운영진 목록 둘의 페이지 넘김 교체, 문서, PR

**Files:**
- Modify: `web/src/features/member/ApplicationQueue.tsx:81-85`, `web/src/features/member/MemberRegistration.tsx:132-136`, `web/src/features/member/AdminPages.module.css`(`.pagination` 삭제)
- Modify: `docs/design-system.md`(공통 컴포넌트 절에 `Pagination`, 적용 검증 기록 "공지 열람과 작성 (2026-11-03)"), `docs/operations.md`("공지 투표" 절 앞에 공지 작성 흐름 문단)
- Add: `docs/superpowers/specs/2026-11-03-notice-pages-design.md`, `docs/superpowers/plans/2026-11-03-notice-pages.md`

- [ ] **Step 1: 두 목록의 `nav`를 `Pagination`으로 교체** 라벨은 지금 값 그대로. 기존 테스트가 "이전", "다음" 버튼 이름으로 동작을 보므로 그대로 통과해야 한다. Run: `npx vitest run src/features/member` Expected: PASS
- [ ] **Step 2: 문서** 스펙 "문서" 절대로. 검증 기록에는 테스트 수, tsc, eslint 결과와 화면 확인 결과를 적는다.
- [ ] **Step 3: 전체 확인** Run: `npx vitest run && npx tsc --noEmit -p . && npx eslint` Expected: 전부 PASS
- [ ] **Step 4: 화면 확인** 모의 API로 단원 공지(총 3쪽), 공지 관리, 새 공지 작성, 공지 수정(투표 있음)을 1440px와 390px에서 캡처한다. 390px에서 "이전, 2 / 3, 다음"이 보이고 가로 넘침이 없음을 본다.
- [ ] **Step 5: 커밋과 PR** `git commit -m "feat(web): 운영진 목록 페이지 넘김 교체"`, `git commit -m "docs: 공지 화면 설계와 기록"`. 브랜치 `feat/notice-pages`를 올리고 PR "feat(web): 공지 열람과 작성 화면 개선"을 연다.
