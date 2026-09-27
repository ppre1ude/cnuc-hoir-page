CREATE TABLE notice (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    body TEXT NOT NULL,
    author_member_id BIGINT NOT NULL,
    published BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    published_at DATETIME(6) NULL,
    CONSTRAINT fk_notice_author FOREIGN KEY (author_member_id) REFERENCES member(id),
    INDEX idx_notice_published (published, published_at DESC, id DESC)
);
