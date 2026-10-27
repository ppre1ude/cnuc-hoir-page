-- 운영진이 언제든 현재 출석 코드를 다시 볼 수 있게 4자리 숫자 코드를 평문으로 둡니다.
-- 4자리 숫자는 해시해도 1만 번 안에 풀리므로 해시가 주는 보호가 없습니다. code_hash는 옛 행 때문에 남겨 둡니다.
ALTER TABLE check_in_session ADD COLUMN code VARCHAR(8);
