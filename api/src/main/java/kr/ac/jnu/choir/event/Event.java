package kr.ac.jnu.choir.event;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Clock;
import java.time.Instant;

@Entity
@Table(name = "event")
public class Event {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, length = 200)
    private String title;
    @Column(nullable = false, columnDefinition = "TEXT")
    private String description;
    @Column(name = "start_at", nullable = false)
    private Instant startAt;
    @Column(name = "end_at", nullable = false)
    private Instant endAt;
    @Column(name = "ob_eligible", nullable = false)
    private boolean obEligible;
    @Column(name = "public_visible", nullable = false)
    private boolean publicVisible;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Event() {}

    public Event(String title, String description, Instant startAt, Instant endAt,
            boolean obEligible, boolean publicVisible, Clock clock) {
        this.createdAt = clock.instant();
        update(title, description, startAt, endAt, obEligible, publicVisible, clock);
    }

    public void update(String title, String description, Instant startAt, Instant endAt,
            boolean obEligible, boolean publicVisible, Clock clock) {
        this.title = title.strip();
        this.description = description;
        this.startAt = startAt;
        this.endAt = endAt;
        this.obEligible = obEligible;
        this.publicVisible = publicVisible;
        this.updatedAt = clock.instant();
    }

    public Long getId() { return id; }
    public String getTitle() { return title; }
    public String getDescription() { return description; }
    public Instant getStartAt() { return startAt; }
    public Instant getEndAt() { return endAt; }
    public boolean isObEligible() { return obEligible; }
    public boolean isPublicVisible() { return publicVisible; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
