-- 일정을 지우지 않고 취소 상태로 둡니다. 값이 있으면 취소된 일정입니다. 받은 응답과 출석 기록은 그대로 남습니다.
ALTER TABLE event ADD COLUMN cancelled_at TIMESTAMP(6);
