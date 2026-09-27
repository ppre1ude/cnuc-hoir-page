package kr.ac.jnu.choir.notice;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Clock;
import java.time.Instant;
import kr.ac.jnu.choir.member.Member;

@Entity
@Table(name = "notice")
public class Notice {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, length = 200)
    private String title;
    @Column(nullable = false, columnDefinition = "TEXT")
    private String body;
    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "author_member_id", nullable = false)
    private Member author;
    @Column(nullable = false)
    private boolean published;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
    @Column(name = "published_at")
    private Instant publishedAt;

    protected Notice() {}

    public Notice(String title, String body, boolean published, Member author, Clock clock) {
        this.author = author;
        this.createdAt = clock.instant();
        update(title, body, published, clock);
    }

    public void update(String title, String body, boolean published, Clock clock) {
        this.title = title.strip();
        this.body = body;
        this.updatedAt = clock.instant();
        if (published && !this.published) this.publishedAt = updatedAt;
        if (!published) this.publishedAt = null;
        this.published = published;
    }

    public Long getId() { return id; }
    public String getTitle() { return title; }
    public String getBody() { return body; }
    public Member getAuthor() { return author; }
    public boolean isPublished() { return published; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public Instant getPublishedAt() { return publishedAt; }
}
