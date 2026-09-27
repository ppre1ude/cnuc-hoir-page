package kr.ac.jnu.choir.attendance;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "check_in_session")
public class CheckInSession {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "event_id", nullable = false)
    private Long eventId;
    @Column(name = "opened_at", nullable = false)
    private Instant openedAt;
    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;
    @Column(name = "closed_at")
    private Instant closedAt;
    @Column(name = "qr_token_hash", nullable = false, length = 64)
    private String qrTokenHash;
    @Column(name = "code_hash", nullable = false, length = 64)
    private String codeHash;

    protected CheckInSession() {}
    public Long getId() { return id; }
    public Long getEventId() { return eventId; }
    public Instant getExpiresAt() { return expiresAt; }
    public Instant getClosedAt() { return closedAt; }
}
