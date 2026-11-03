# 전남대학교 합창단 포털

전남대학교 합창단의 공개 소개 페이지와 단원 포털입니다. 승인된 단원은 일정, 공지, 출석을 확인하고 운영진은 이를 관리합니다.

운영 주소: https://cnuchoir.com

## 구성

| 폴더 | 내용 |
| --- | --- |
| `web/` | Next.js 웹. Vercel에 배포합니다. |
| `api/` | Spring Boot API. Render에 Docker로 배포합니다. |
| `deployment/` | 로컬 프록시 구성, 배포 점검 스크립트, 배포 절차 문서 |
| `docs/` | 용어, 운영 절차, 설계 문서 |

웹은 같은 출처의 `/api/v1`을 호출하고 Vercel이 이를 Render의 API로 전달합니다. 데이터는 Supabase PostgreSQL에 있습니다. 로그인은 구글 계정으로 하고, 운영진이 단원 명단과 대조해 승인합니다.

## 로컬 실행

웹만 띄울 때:

```bash
cd web
npm install
npm run dev
```

API까지 띄우려면 PostgreSQL이 필요합니다. `compose.yaml`로 DB를 올린 뒤 `.env.example`의 변수를 채워 `api`에서 `gradlew.bat bootRun`을 실행합니다. 실제 비밀값은 저장소에 넣지 않습니다. 프록시를 포함한 전체 구성은 [deployment/README.md](deployment/README.md)를 따릅니다.

## 문서

- 용어와 규칙: [CONTEXT.md](CONTEXT.md)
- 운영 절차: [docs/operations.md](docs/operations.md)
- 배포: [deployment/vercel.md](deployment/vercel.md), [deployment/hosting-options.md](deployment/hosting-options.md)
