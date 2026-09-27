CREATE TABLE admin_action_log (
    id BIGINT NOT NULL AUTO_INCREMENT,
    actor_member_id BIGINT NOT NULL,
    target_member_id BIGINT NOT NULL,
    action VARCHAR(32) NOT NULL,
    previous_status VARCHAR(32) NOT NULL,
    new_status VARCHAR(32) NOT NULL,
    reason VARCHAR(500),
    acted_at DATETIME(6) NOT NULL,
    CONSTRAINT pk_admin_action_log PRIMARY KEY (id),
    CONSTRAINT fk_admin_action_actor FOREIGN KEY (actor_member_id) REFERENCES member (id),
    CONSTRAINT fk_admin_action_target FOREIGN KEY (target_member_id) REFERENCES member (id)
) ENGINE=InnoDB;

CREATE INDEX ix_admin_action_target ON admin_action_log (target_member_id, acted_at);
