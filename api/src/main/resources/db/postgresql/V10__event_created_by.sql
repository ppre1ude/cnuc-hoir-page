-- 일정을 등록한 단원입니다. 운영진이 누가 만든 일정인지 알 수 있게 합니다. 이 기록을 두기 전에 만든 일정은 비어 있습니다.
ALTER TABLE event ADD COLUMN created_by_member_id BIGINT REFERENCES member(id);
