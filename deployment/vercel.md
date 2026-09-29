# Vercel 웹 배포 준비

이 저장소에서 Vercel에 올릴 프로젝트 루트는 `web/`입니다. Next.js 빌드는 `web/package.json`의 `build` 명령을 사용하며, 별도의 출력 디렉터리를 지정하지 않습니다.

## 공개 화면 미리보기

1. Vercel에서 `ppre1ude/cnuc-hoir-page` 저장소를 연결하고 Root Directory를 `web`으로 지정합니다. Framework Preset은 Next.js로 둡니다.
2. 실제 배포를 시작하면 발급된 HTTPS 주소에서 첫 화면, 사진, 모바일 레이아웃과 공개 링크를 확인합니다. Git 저장소를 연결한 뒤 `main`에 새 커밋을 푸시하면 해당 프로젝트의 배포가 다시 실행됩니다.
3. 공개 화면만 확인하는 단계에서는 웹 환경 변수에 DB 비밀번호를 넣지 않습니다. `CHOIR_API_ORIGIN`이 비어 있으면 `/api/v1`을 처리할 서버가 없으므로 로그인, 계정 초대, 공지, 투표, 출석은 작동하지 않습니다. 이 단계에서 실제 단원 정보를 입력하지 않습니다.

2026-09-29 기준 Vercel의 `ppre1udes-projects/cnuc-hoir-page` 프로젝트를 만들고 Root Directory를 `web`으로 설정했습니다. 로컬 `web/`도 연결했습니다. Git 저장소 연결과 실제 배포는 아직 수행하지 않았습니다.

## 회원 기능을 포함한 검증 조건

Spring API와 MySQL을 별도 운영 환경에 준비하고 HTTPS 주소를 확정해야 합니다. 웹은 같은 출처의 `/api/v1`을 호출합니다. Vercel 웹 프로젝트의 `CHOIR_API_ORIGIN` 환경 변수에 API의 **경로 없는 HTTPS 출처**를 넣으면 Next.js가 `/api/v1/*` 요청을 해당 출처의 같은 경로로 전달합니다. 값은 빌드 시 적용되므로 변경 뒤 웹을 다시 배포합니다. API 주소가 아직 없으면 이 변수는 비워 둡니다. HTTP 주소, 경로, 쿼리 또는 인증 정보를 넣으면 빌드가 실패합니다.

API 앞단 프록시가 전달 IP 헤더를 다루는 방식도 확정해야 합니다. 현재 Compose Nginx는 연결 주소로 `X-Forwarded-For`를 덮어쓰므로, 그대로 Vercel 앞단에 두면 여러 단원의 요청이 같은 IP로 집계될 수 있습니다. 실제 프록시 경로에서 헤더 위조 차단과 로그인·출석 시도 제한을 검증한 뒤 연결합니다. API 응답의 `Cache-Control: no-store`, `Secure` 세션 쿠키와 CSRF 처리도 공개 HTTPS 주소에서 확인합니다.

API·DB 호스팅의 비용과 변경 범위는 [배포 장소 비교](hosting-options.md)에 정리했습니다. 메일 서비스를 사용하지 않고 운영진이 계정을 발급합니다. Railway MySQL의 엔진 버전은 현재 검증에 사용한 MySQL 8.4와 대조해야 합니다. 서비스가 확정되기 전에는 해당 업체 전용 구성 파일이나 비밀값을 저장소에 넣지 않습니다. [MySQL 연결](https://docs.railway.com/databases/mysql)

초대 링크는 운영진 화면에서 한 번 표시되고, 24시간 동안 한 번만 사용할 수 있습니다. 운영진은 명단으로 단원을 확인한 뒤 개인별 비공개 채널로 전달합니다. DB 비밀번호는 API 운영 환경의 비밀 저장소에서 관리하고 Git과 웹 프로젝트에 넣지 않습니다. 회원 시범 사용 전 점검 순서는 [운영 절차](../docs/operations.md)를 따릅니다.

## 확인 항목

- 공개 화면: `/` 응답, 사진과 로고, 모바일 가로 넘침, 로그인 링크의 목적지.
- API 연결 뒤: `/api/v1/auth/csrf` 응답, 세션 쿠키, 운영진 초대·비밀번호 설정·재발급, 공지 투표와 마감 전 선택 변경, 출석과 IP 제한.
- 공개 경계: 비로그인 요청에 회원 공지·행사·출석 자료가 노출되지 않는지 확인.

[Vercel의 저장소 루트 설정](https://vercel.com/docs/monorepos)과 [외부 API 경로 재작성](https://vercel.com/docs/routing/rewrites)을 참고합니다.
