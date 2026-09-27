CREATE TABLE check_in_session (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    event_id BIGINT NOT NULL,
    opened_at DATETIME(6) NOT NULL,
    expires_at DATETIME(6) NOT NULL,
    closed_at DATETIME(6),
    qr_token_hash CHAR(64) NOT NULL,
    code_hash CHAR(64) NOT NULL,
    active_event_id BIGINT GENERATED ALWAYS AS (CASE WHEN closed_at IS NULL THEN event_id ELSE NULL END) STORED,
    CONSTRAINT fk_check_in_session_event FOREIGN KEY (event_id) REFERENCES event (id),
    CONSTRAINT uq_check_in_session_active_event UNIQUE (active_event_id),
    INDEX ix_check_in_session_event (event_id, id)
) ENGINE=InnoDB;

CREATE TABLE attendance (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    event_id BIGINT NOT NULL,
    member_id BIGINT NOT NULL,
    status VARCHAR(16) NOT NULL,
    checked_in_at DATETIME(6),
    corrected_at DATETIME(6),
    CONSTRAINT fk_attendance_event FOREIGN KEY (event_id) REFERENCES event (id),
    CONSTRAINT fk_attendance_member FOREIGN KEY (member_id) REFERENCES member (id),
    CONSTRAINT uq_attendance_event_member UNIQUE (event_id, member_id),
    INDEX ix_attendance_member (member_id, event_id)
) ENGINE=InnoDB;

CREATE TABLE check_in_attempt (
    kind VARCHAR(16) NOT NULL,
    identity_hash CHAR(64) NOT NULL,
    window_start DATETIME(6) NOT NULL,
    attempt_count INT NOT NULL,
    PRIMARY KEY (kind, identity_hash)
) ENGINE=InnoDB;

ALTER TABLE admin_action_log
    ADD COLUMN event_id BIGINT NULL,
    ADD CONSTRAINT fk_admin_action_event FOREIGN KEY (event_id) REFERENCES event (id);
