-- 일정 종류(전체연습·파트연습·행사)와 파트연습의 파트입니다. 기존 일정은 모두 행사로 채웁니다.
ALTER TABLE event ADD COLUMN kind VARCHAR(32) NOT NULL DEFAULT 'EVENT';
ALTER TABLE event ALTER COLUMN kind DROP DEFAULT;
ALTER TABLE event ADD COLUMN part VARCHAR(16);

ALTER TABLE event ADD CONSTRAINT ck_event_kind CHECK (kind IN ('FULL_REHEARSAL', 'PART_REHEARSAL', 'EVENT'));
-- 파트연습에만 파트가 하나 있고, 전체연습과 행사에는 파트가 없습니다.
-- 검사 제약은 결과가 NULL이면 통과하므로 part가 NULL일 때도 참·거짓이 정해지는 식으로 씁니다.
ALTER TABLE event ADD CONSTRAINT ck_event_part CHECK (
    (kind = 'PART_REHEARSAL') = (part IS NOT NULL)
    AND (part IS NULL OR part IN ('SOPRANO', 'ALTO', 'TENOR', 'BASS', 'PIANO')));
