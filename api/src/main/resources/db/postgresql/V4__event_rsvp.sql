CREATE TABLE event_rsvp (
    event_id BIGINT NOT NULL CONSTRAINT fk_event_rsvp_event REFERENCES event (id),
    member_id BIGINT NOT NULL CONSTRAINT fk_event_rsvp_member REFERENCES member (id),
    choice VARCHAR(16) NOT NULL CONSTRAINT ck_event_rsvp_choice CHECK (choice IN ('ATTENDING', 'ABSENT')),
    created_at TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL,
    CONSTRAINT pk_event_rsvp PRIMARY KEY (event_id, member_id)
);
CREATE INDEX ix_event_rsvp_member ON event_rsvp (member_id, event_id);
