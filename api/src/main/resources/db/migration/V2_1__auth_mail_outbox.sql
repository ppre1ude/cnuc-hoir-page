CREATE TABLE auth_mail_outbox (
    id BIGINT NOT NULL AUTO_INCREMENT,
    member_id BIGINT NOT NULL,
    purpose VARCHAR(32) NOT NULL,
    requested_at DATETIME(6) NOT NULL,
    next_attempt_at DATETIME(6) NOT NULL,
    revision BIGINT NOT NULL DEFAULT 1,
    attempt_count INT NOT NULL DEFAULT 0,
    completed_at DATETIME(6),
    CONSTRAINT pk_auth_mail_outbox PRIMARY KEY (id),
    CONSTRAINT uq_auth_mail_outbox_member_purpose UNIQUE (member_id, purpose),
    CONSTRAINT fk_auth_mail_outbox_member FOREIGN KEY (member_id) REFERENCES member (id)
) ENGINE=InnoDB;

CREATE INDEX ix_auth_mail_outbox_due ON auth_mail_outbox (completed_at, next_attempt_at);
