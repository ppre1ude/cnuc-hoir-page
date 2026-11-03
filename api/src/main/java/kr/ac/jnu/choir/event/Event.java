package kr.ac.jnu.choir.event;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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
import kr.ac.jnu.choir.member.Part;

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
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 32)
    private EventKind kind;
    @Enumerated(EnumType.STRING) @Column(length = 16)
    private Part part;
    @Column(name = "ob_eligible", nullable = false)
    private boolean obEligible;
    @Column(name = "public_visible", nullable = false)
    private boolean publicVisible;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
    @Column(name = "cancelled_at")
    private Instant cancelledAt;
    // 등록한 단원입니다. 이 기록을 두기 전의 일정은 null입니다. 목록마다 함께 읽으므로 즉시 로딩합니다.
    // ponytail: 한 달 일정 30개면 단원 조회도 몇 번 더 나갈 뿐이라 join fetch는 두지 않음, 느려지면 EventRepository 쿼리에 join fetch 추가
    @ManyToOne(fetch = FetchType.EAGER) @JoinColumn(name = "created_by_member_id")
    private Member createdBy;

    protected Event() {}

    public Event(String title, String description, Instant startAt, Instant endAt, EventKind kind, Part part,
            boolean obEligible, boolean publicVisible, Member createdBy, Clock clock) {
        this.createdAt = clock.instant();
        this.createdBy = createdBy;
        update(title, description, startAt, endAt, kind, part, obEligible, publicVisible, clock);
    }

    public void update(String title, String description, Instant startAt, Instant endAt, EventKind kind, Part part,
            boolean obEligible, boolean publicVisible, Clock clock) {
        this.title = title.strip();
        this.description = description;
        this.startAt = startAt;
        this.endAt = endAt;
        this.kind = kind;
        this.part = part;
        this.obEligible = obEligible;
        this.publicVisible = publicVisible;
        this.updatedAt = clock.instant();
    }

    public void cancel(Clock clock) {
        if (cancelledAt != null) return;
        this.cancelledAt = clock.instant();
        this.updatedAt = cancelledAt;
    }

    public void restore(Clock clock) {
        this.cancelledAt = null;
        this.updatedAt = clock.instant();
    }

    public boolean isCancelled() { return cancelledAt != null; }
    public Instant getCancelledAt() { return cancelledAt; }
    public Member getCreatedBy() { return createdBy; }
    public Long getId() { return id; }
    public String getTitle() { return title; }
    public String getDescription() { return description; }
    public Instant getStartAt() { return startAt; }
    public Instant getEndAt() { return endAt; }
    public EventKind getKind() { return kind; }
    public Part getPart() { return part; }
    public boolean isObEligible() { return obEligible; }
    public boolean isPublicVisible() { return publicVisible; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
