-- 운영진이 언제든 현재 출석 코드를 다시 볼 수 있게 4자리 숫자 코드를 평문으로 둡니다.
-- 4자리 숫자는 해시해도 1만 번 안에 풀리므로 해시가 주는 보호가 없습니다. code_hash는 옛 행 때문에 남겨 둡니다.
ALTER TABLE check_in_session ADD COLUMN code VARCHAR(8);

-- 배포 전 창은 "연 시각 + 10분"에 만료됐고 closed_at은 비어 있습니다. 새 판정은 closed_at과 행사 시각만 보므로
-- 그대로 두면 옛 창이 행사 시작 30분 전에 저절로 되살아나 끝날 때 전원이 미출석이 됩니다. 옛 만료 시각에 닫힌 것으로 적습니다.
UPDATE check_in_session SET closed_at = expires_at WHERE closed_at IS NULL;
