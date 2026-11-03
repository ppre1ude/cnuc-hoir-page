# 운영진 화면 명칭 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 운영진 화면의 일반 어휘(단원 계정, 계정 목록, 미리 승인, 접근 해제, 정보 수정)를 합창단 말(단원 정보 관리, 단원 명단, 사전 등록, 포털 이용 중단, 단원 정보 수정)로 바꾸고 용어 사전을 남긴다.

**Architecture:** 글자만 바꾸는 PR이다. 화면 구조, 경로, API, 서버는 그대로다. 테스트의 기대 문구를 먼저 바꿔 RED를 보고, 화면 문구를 바꿔 GREEN을 본다. 문서 셋(`operations`, `design-system`, 새 `glossary`)을 같은 PR에 넣는다.

**Tech Stack:** Next.js 16, React 19, vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-03-operator-screen-names-design.md`

## Global Constraints

- 화면 문구에 대시(—)와 가운뎃점(·)을 쓰지 않는다. 범위는 물결표. 커밋 메시지는 `type(scope): 대상 수정` 꼴로 짧게.
- 바꾸는 범위는 `web/src`, `web/e2e`, 세 문서뿐. 서버 코드와 메시지, 옛 설계 문서는 건드리지 않는다.
- 경로(`/admin/members`, `/admin/applications`), 권한 이름, API는 그대로.
- 새 스타일을 만들지 않는다. 안내 상자는 지금 `.callout`을 `aside`로 쓴다.

## Review Focus

1. 화면 읽기 이름(`aria-label`)이 보이는 글자와 어긋나면 안 된다. 예: 버튼은 "포털 이용 중단"인데 라벨은 "접근 해제". Task 3 테스트가 `getByLabelText("이서연 포털 이용 중단")`로 둘을 함께 본다.
2. 상태 "이용 중단"인 단원의 "다시 초대" 버튼은 그대로 보여야 한다. Task 3 테스트에서 확인한다.
3. 사전 등록 폼의 제출 버튼 이름이 바뀌어 e2e나 테스트가 옛 이름을 찾으면 안 된다. Task 2에서 `web/`을 통째로 검색한다.
4. 가입 승인 알림 띠(다른 PR)와 같은 화면에 놓였을 때 "사전 등록된 단원"과 "가입 승인을 기다리는 단원"이 서로 다른 사람임이 글로 드러나야 한다. 안내 상자 문장이 이를 말한다(Task 2).
5. 문서의 "자동 승인 명단", "운영진 사전 등록 목록"이 화면에 없는 이름으로 남으면 운영진이 화면에서 찾지 못한다. Task 4가 `operations.md`를 화면 이름으로 고친다.

---

### Task 1: 단원 정보 관리, 단원 명단

**Files:**
- Modify: `web/src/features/member/AdminNavigation.tsx:10`, `web/src/app/(admin)/admin/members/page.tsx:6`, `web/src/features/member/MemberAccountManager.tsx:40,110,138,149,159`, `web/src/features/member/ApplicationQueue.tsx:132`, `web/src/features/member/MemberAccountSkeleton.tsx:6`(주석), `web/e2e/member-journey.spec.ts:25,135`
- Test: `web/src/features/member/AdminNavigation.test.tsx`, `web/src/app/(admin)/admin/members/page.test.tsx`, `web/src/features/member/MemberAccountManager.test.tsx`

- [ ] **Step 1: 테스트 기대 문구 변경** `AdminNavigation.test.tsx:14`의 링크 이름 "단원 계정"을 "단원 정보 관리"로, 테스트 이름도 맞춘다. `MemberAccountManager.test.tsx`에서 제목과 절 제목을 보는 단언이 있으면 "단원 정보 관리", "단원 명단"으로 바꾸고, 없으면 `screen.getByRole("heading", { name: "단원 정보 관리", level: 1 })`과 `getByRole("heading", { name: "단원 명단" })`을 보는 테스트 하나를 더한다. `members/page.test.tsx`의 테스트 이름만 맞춘다.
- [ ] **Step 2: 실패 확인** Run: `npx vitest run src/features/member/AdminNavigation.test.tsx src/features/member/MemberAccountManager.test.tsx` Expected: FAIL, 새 이름을 찾지 못함
- [ ] **Step 3: 화면 문구 변경** 메뉴 label과 `metadata.title`, `PageHeader title`을 "단원 정보 관리"로. `h2` "계정 목록"을 "단원 명단"으로, 스켈레톤 label을 "단원 명단을 불러오는 중입니다."로, 오류를 "단원 명단을 불러오지 못했습니다."로, 빈 목록을 "등록된 단원이 없습니다."로. `ApplicationQueue`의 확인 문구 "단원 계정 화면"을 "단원 정보 관리 화면"으로. e2e 두 줄과 스켈레톤 주석도 바꾼다.
- [ ] **Step 4: 통과 확인** Run: 같은 명령 Expected: PASS
- [ ] **Step 5: 커밋** `git commit -m "feat(web): 운영진 메뉴와 단원 명단 이름 수정"`

### Task 2: 사전 등록

**Files:**
- Modify: `web/src/features/member/MemberRegistration.tsx:45,50-53,69,75-76,103,121,132`, `web/src/features/member/AdminPages.module.css:56`(주석)
- Test: `web/src/features/member/MemberRegistration.test.tsx`, `web/src/features/member/MemberAccountManager.test.tsx:77`

**Interfaces:**
- 화면 문구(정확히 이 글자):
  - 절 제목 `h2` "사전 등록", 제출 버튼 "사전 등록", 목록 제목 `h3` "사전 등록된 단원", 목록 `aria-labelledby`는 그대로 `pending-title`.
  - 안내 상자 `aside`(클래스 `callout`): 첫 문단 `<strong>사전 등록이 뭔가요?</strong>`, 둘째 문단 "명단에 있는 새 단원의 Gmail을 미리 등록해 두는 일입니다. 등록된 사람은 구글 계정으로 처음 로그인할 때 승인 없이 바로 단원이 됩니다. 등록하지 않은 사람이 로그인하면 가입 승인에 올라오고, Gmail이 아닌 주소는 아래 1회용 링크로 초대해 주세요."
  - 목록 안내 "아직 로그인하지 않은 사람입니다. 로그인하면 이 목록에서 사라지고 단원 명단에 나타납니다. 여기서 삭제해도 이미 승인된 단원은 그대로입니다."
  - 빈 목록 "사전 등록된 단원이 없습니다.", 오류 "사전 등록하지 못했습니다.", "사전 등록된 단원을 불러오지 못했습니다.", 페이지 nav 라벨 "사이트 관리자 사전 등록 페이지", "단원 사전 등록 페이지".
  - Gmail 아님 경고 문장의 "가입 승인에서 직접 승인해 주세요"는 그대로.

- [ ] **Step 1: 테스트 기대 문구 변경** `MemberRegistration.test.tsx`의 "미리 승인"(버튼, 제목), "미리 승인한 이메일"(목록 이름), "미리 승인한 단원 이메일이 없습니다."를 위 글자로 바꾼다. 안내 상자를 보는 테스트 하나를 더한다. `expect(screen.getByRole("complementary")).toHaveTextContent("사전 등록이 뭔가요?")`. `MemberAccountManager.test.tsx:77`의 heading 이름도 "사전 등록"으로.
- [ ] **Step 2: 실패 확인** Run: `npx vitest run src/features/member/MemberRegistration.test.tsx src/features/member/MemberAccountManager.test.tsx` Expected: FAIL
- [ ] **Step 3: 화면 문구 변경** Interfaces대로. `div.callout`을 `aside.callout`으로 바꾸고 문단 둘을 넣는다. `.callout p + p { margin-top: var(--space-2); }` 한 줄을 `AdminPages.module.css`의 `.callout p` 옆에 더한다. CSS 주석의 "미리 승인"도 "사전 등록"으로.
- [ ] **Step 4: 통과 확인** Run: 같은 명령 Expected: PASS. 이어서 `grep -rn "미리 승인" web/src web/e2e` Expected: 결과 없음
- [ ] **Step 5: 커밋** `git commit -m "feat(web): 사전 등록 이름과 안내 수정"`

### Task 3: 단원 정보 수정, 포털 이용 중단

**Files:**
- Modify: `web/src/features/member/MemberRoles.tsx:82`, `web/src/features/member/MemberAccountManager.tsx:19,190,213-223,53`, `web/src/components/ui/DesignSystemPreview.tsx:33`, `web/src/features/member/useListDetailFocus.ts`
- Test: `web/src/features/member/MemberRoles.test.tsx:23,99`, `web/src/features/member/MemberAccountManager.test.tsx:59-76,137-171`

**Interfaces:**
- 펼침 제목 "단원 정보 수정", `aria-label` `${item.name} 단원 정보 수정`.
- 상태 라벨 `REVOKED: "이용 중단"`. 펼침 제목 "포털 이용 중단", `aria-label` `${item.name} 포털 이용 중단`. 펼침 안 첫 줄 `p.hint` "이용을 중단한 단원은 다시 초대해야 포털을 쓸 수 있습니다." 입력 라벨 `${item.name} 포털 이용 중단 이유`. 빨간 버튼 `${item.name} 포털 이용 중단`. 실패 문구 "포털 이용을 중단하지 못했습니다. 계정 상태를 확인해 주세요."
- `useListDetailFocus(selected: number | null, detail: RefObject<HTMLDivElement | null>): { leave: (id: number | null) => void }`. 호출하는 쪽이 `useRef`를 만들어 넘기고 `ref={detail}`로 직접 단다. main의 eslint 오류(`react-hooks/refs`, `MemberAccountManager.tsx:162`)를 없애기 위해서다.

- [ ] **Step 1: 테스트 기대 문구 변경** `MemberRoles.test.tsx`의 "정보 수정"을 "단원 정보 수정"으로. `MemberAccountManager.test.tsx`의 "접근 해제" 라벨과 버튼 이름을 "포털 이용 중단"으로, "정보 수정"을 "단원 정보 수정"으로. 상태 "이용 중단"인 단원에게 "다시 초대" 버튼이 보이는 단언이 없으면 한 줄 더한다.
- [ ] **Step 2: 실패 확인** Run: `npx vitest run src/features/member` Expected: FAIL
- [ ] **Step 3: 화면 문구 변경** Interfaces대로. `DesignSystemPreview.tsx:33`의 버튼 글자도 "포털 이용 중단". 주석의 "접근 해제"는 "포털 이용 중단"으로.
- [ ] **Step 4: 초점 훅 시그니처 변경** Interfaces대로 바꾸고 `MemberAccountManager`에서 `const detail = useRef<HTMLDivElement>(null); const focus = useListDetailFocus(selected, detail);`로 쓴다.
- [ ] **Step 5: 통과 확인** Run: `npx vitest run src/features/member && npx eslint src/features/member` Expected: PASS, eslint 오류 0. 이어서 `grep -rn "접근 해제\|단원 계정\|계정 목록" web/src web/e2e` Expected: 결과 없음(주석 포함)
- [ ] **Step 6: 커밋** `git commit -m "feat(web): 단원 정보 수정과 포털 이용 중단 이름 수정"`

### Task 4: 문서와 PR

**Files:**
- Create: `docs/glossary.md`
- Modify: `docs/operations.md:13-14,24,43`(5단계, 6단계, 계정과 권한, 가입 신청자 처리), `docs/design-system.md:170`(용어 줄 아래)
- Add: `docs/superpowers/specs/2026-11-03-operator-screen-names-design.md`, `docs/superpowers/plans/2026-11-03-operator-screen-names.md`

- [ ] **Step 1: `docs/glossary.md` 작성** 제목 "용어 사전", 한 문단 설명(화면 이름은 이 표를 따른다), 표 열은 "화면 이름 | 뜻 | 쓰이는 곳 | 코드". 스펙 "문서" 절의 항목을 모두 넣는다. 마지막에 "쓰지 않는 말" 절: 회원, 행사(일정 전체), 계정 목록, 미리 승인, 접근 해제와 각각 대신 쓰는 말.
- [ ] **Step 2: `operations.md` 수정** 5단계의 "자동 승인 명단에 추가하거나, 운영진으로 지정할 이메일을 운영진 사전 등록 목록에 추가합니다"를 "`/admin/members`(단원 정보 관리)에서 명단과 대조한 이메일을 사전 등록하고, 사이트 관리자로 둘 사람은 '사이트 관리자 권한도 부여'를 켭니다"로. 6단계와 "계정과 권한"의 "자동 승인 명단"은 "사전 등록(자동 승인 명단)"으로 처음 한 번 병기하고 뒤는 "사전 등록"으로. "접근 해제"는 처음 한 번 "포털 이용 중단(접근 해제)"로 병기. "단원 계정 화면"은 "단원 정보 관리 화면"으로.
- [ ] **Step 3: `design-system.md` 수정** 2026-10-22 용어 줄 아래에 "- 2026-11-03: 운영진 화면 이름을 단원 정보 관리, 단원 명단, 사전 등록, 사전 등록된 단원, 단원 정보 수정, 포털 이용 중단으로 맞췄습니다. 운영진 화면 이름은 `docs/glossary.md`를 따릅니다."를 더한다.
- [ ] **Step 4: 전체 확인** Run: `npx vitest run && npx tsc --noEmit -p . && npx eslint` Expected: 전부 PASS, eslint 오류 0
- [ ] **Step 5: 화면 확인** 모의 API로 `/admin/members`를 1440px와 390px에서 캡처해 제목, 사전 등록 안내 상자, 단원 명단 제목, 포털 이용 중단 펼침을 확인하고 가로 넘침이 없음을 본다.
- [ ] **Step 6: 커밋과 PR** `git commit -m "docs: 용어 사전 추가"`. 브랜치 `feat/operator-screen-names`를 올리고 PR "feat(web): 운영진 화면 이름 수정"을 연다.
