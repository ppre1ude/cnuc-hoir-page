-- 전체연습을 정기연습과 비정기연습으로 나눕니다. 제목에 '비정기'가 있으면 비정기연습입니다.
-- V7이 기존 일정을 모두 행사로 옮겼으므로, 제목에 '연습'이 있는 행사도 옮깁니다. 파트를 알 수 없는 파트연습 제목은 행사로 둡니다.
ALTER TABLE event DROP CONSTRAINT ck_event_kind;
UPDATE event
SET kind = CASE WHEN title LIKE '%비정기%' THEN 'EXTRA_REHEARSAL' ELSE 'REGULAR_REHEARSAL' END
WHERE kind = 'FULL_REHEARSAL'
   OR (kind = 'EVENT' AND title LIKE '%연습%' AND title NOT LIKE '%파트%');
ALTER TABLE event ADD CONSTRAINT ck_event_kind
    CHECK (kind IN ('REGULAR_REHEARSAL', 'EXTRA_REHEARSAL', 'PART_REHEARSAL', 'EVENT'));
