# 무료 미리보기 배포 구성

2026-09-30 기준 시범 배포 구성은 **Vercel 웹 + Render Free Spring API + Supabase Free PostgreSQL**입니다. 메일 발송은 사용하지 않으며, 운영진이 단원 명단을 확인하고 1회용 초대 링크를 발급합니다. 무료 플랜의 제한 때문에 정식 운영 전에 유료 서비스와 백업 방식을 다시 결정해야 합니다.

## 설정 순서

1. Supabase에서 새 프로젝트를 만듭니다. 프로젝트의 **Session pooler** 연결 정보를 확인합니다. Render의 IPv4 환경에서는 직접 연결 주소 대신 Session pooler를 사용합니다. DB 비밀번호는 비밀 저장소에서만 관리합니다.
2. Render에서 GitHub 저장소를 연결하고 저장소 루트의 `render.yaml`로 **New Blueprint**를 만듭니다. 구성에는 `api/` Docker 빌드와 Free 웹 서비스가 정의되어 있습니다. 생성 화면에서 `DB_URL`, `DB_USER`, `DB_PASSWORD`를 입력합니다. `DB_URL`은 Session pooler 주소와 포트 5432를 사용한 `jdbc:postgresql://호스트:5432/postgres?sslmode=require` 형식입니다. 사용자 이름은 Supabase 연결 정보에 표시된 값을 그대로 사용합니다. Render가 제공하는 `PORT`에서 API가 수신합니다.
3. Render 배포가 끝나면 `https://발급된-Render-주소/api/v1/auth/csrf`가 정상 응답하는지 확인합니다. 이때 Flyway가 새 PostgreSQL 데이터베이스에 스키마를 만듭니다.
4. Vercel의 `web/` 프로젝트에 `CHOIR_API_ORIGIN`을 경로 없는 Render HTTPS 출처로 설정하고 다시 배포합니다. 브라우저 요청은 웹의 `/api/v1/*`을 거쳐 API로 전달됩니다. DB 연결값을 Vercel에 넣지 않습니다.
5. [운영 절차](../docs/operations.md)에 따라 첫 운영진을 초대하고 로그인·공지 투표·행사·출석을 실제 HTTPS 주소에서 검증합니다. 실제 단원 명단을 넣기 전에 백업과 복구 방법을 확인합니다.

기존 MySQL 데이터가 있다면 PostgreSQL로 자동 이전되지 않습니다. 이번 구성은 **새 빈 PostgreSQL 데이터베이스**에 적용합니다. 기존 데이터 이전이 필요할 때는 별도 이전 절차와 검증이 필요합니다.

## 무료 플랜의 한계

- Render Free 웹 서비스는 유휴 상태가 15분 이어지면 내려가며, 다음 요청에서 다시 시작하는 데 시간이 걸립니다. 외부 DB로 향하는 트래픽이 비정상적으로 많으면 서비스가 일시 중지될 수도 있습니다. 출석 현장 운영에 그대로 사용하지 않습니다.
- Supabase Free는 데이터베이스 500MB 제한이 있고 비활성 프로젝트가 일시 중지될 수 있습니다. 운영 데이터의 정기 백업과 복구 검증이 필요합니다.
- API 앞단의 실제 접속 IP 전달 방식은 호스팅 경로에서 검증해야 합니다. 검증되지 않은 프록시 주소를 신뢰 목록에 넣지 않습니다.

근거: [Render 무료 서비스](https://render.com/docs/free), [Render Docker 배포](https://render.com/docs/docker), [Supabase 연결 방식](https://supabase.com/docs/guides/database/connecting-to-postgres), [Supabase 요금제](https://supabase.com/pricing)
