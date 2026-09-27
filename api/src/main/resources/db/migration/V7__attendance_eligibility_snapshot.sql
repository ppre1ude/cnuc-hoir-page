CREATE TABLE attendance_eligibility_snapshot (
    check_in_session_id BIGINT NOT NULL,
    member_id BIGINT NOT NULL,
    snapshotted_at DATETIME(6) NOT NULL,
    PRIMARY KEY (check_in_session_id, member_id),
    CONSTRAINT fk_attendance_snapshot_session FOREIGN KEY (check_in_session_id) REFERENCES check_in_session (id),
    CONSTRAINT fk_attendance_snapshot_member FOREIGN KEY (member_id) REFERENCES member (id),
    INDEX ix_attendance_snapshot_member (member_id, check_in_session_id)
) ENGINE=InnoDB;
