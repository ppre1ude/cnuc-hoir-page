CREATE TABLE notice_poll (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    notice_id BIGINT NOT NULL,
    question VARCHAR(200) NOT NULL,
    first_option VARCHAR(80) NOT NULL,
    second_option VARCHAR(80) NOT NULL,
    closes_at DATETIME(6) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    CONSTRAINT uq_notice_poll_notice UNIQUE (notice_id),
    CONSTRAINT fk_notice_poll_notice FOREIGN KEY (notice_id) REFERENCES notice (id)
) ENGINE=InnoDB;

CREATE TABLE notice_poll_vote (
    poll_id BIGINT NOT NULL,
    member_id BIGINT NOT NULL,
    choice TINYINT NOT NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    CONSTRAINT pk_notice_poll_vote PRIMARY KEY (poll_id, member_id),
    CONSTRAINT fk_notice_poll_vote_poll FOREIGN KEY (poll_id) REFERENCES notice_poll (id),
    CONSTRAINT fk_notice_poll_vote_member FOREIGN KEY (member_id) REFERENCES member (id),
    CONSTRAINT ck_notice_poll_vote_choice CHECK (choice IN (1, 2))
) ENGINE=InnoDB;
