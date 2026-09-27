CREATE TABLE auth_attempt (
    kind VARCHAR(32) NOT NULL,
    identity_hash CHAR(64) NOT NULL,
    window_start DATETIME(6) NOT NULL,
    attempt_count INT NOT NULL,
    CONSTRAINT pk_auth_attempt PRIMARY KEY (kind, identity_hash)
) ENGINE=InnoDB;
