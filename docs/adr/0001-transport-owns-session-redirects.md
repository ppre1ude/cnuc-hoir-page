# 세션 만료와 미승인 리다이렉트는 요청 transport가 맡는다

웹의 `apiRequest`는 모든 API 응답을 보므로, 401이면 `/login`, 403 `APPROVAL_REQUIRED`면 `/application-status`로 보내는 일을 이것 하나가 맡습니다. 회원·운영진 화면을 감싸는 세션 provider는 자기 `/auth/me` 요청이 실패한 경우만 직접 처리합니다. `/auth/*` 경로는 transport의 리다이렉트에서 빠지기 때문입니다. 페이지는 인증 때문에 리다이렉트하지 않습니다. 이전에는 transport와 페이지 11곳이 같은 판단을 각자 내려서 결과가 네 가지로 갈렸습니다.

## Considered Options

- **세션 provider가 유일한 소유자**: transport의 리다이렉트를 없애고, 요청 중 401이 나면 transport가 provider에 알립니다. 리다이렉트 판단이 React 안으로 모이지만, provider 밖에서 나가는 요청(인증 전 화면, 향후 서버 코드)은 따로 처리해야 합니다.
- **transport가 유일한 소유자 (채택)**: 모든 요청을 가장 먼저 보는 곳이고 이미 그 일을 하고 있어서 페이지 코드만 줄이면 됩니다.

## Consequences

권한 부족(403 `PERMISSION_REQUIRED`)은 리다이렉트하지 않습니다. transport는 provider에 알려 세션을 다시 받게 하고, 무엇을 보여 줄지는 provider와 권한 안내 화면이 정합니다.
