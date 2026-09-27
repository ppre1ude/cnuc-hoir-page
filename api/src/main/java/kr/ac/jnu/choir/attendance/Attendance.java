package kr.ac.jnu.choir.attendance;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "attendance")
public class Attendance {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "event_id", nullable = false)
    private Long eventId;
    @Column(name = "member_id", nullable = false)
    private Long memberId;
    @Column(nullable = false, length = 16)
    private String status;
    @Column(name = "checked_in_at")
    private Instant checkedInAt;
    @Column(name = "corrected_at")
    private Instant correctedAt;

    protected Attendance() {}
    public Long getId() { return id; }
    public Long getEventId() { return eventId; }
    public Long getMemberId() { return memberId; }
    public String getStatus() { return status; }
    public Instant getCheckedInAt() { return checkedInAt; }
    public Instant getCorrectedAt() { return correctedAt; }
}
