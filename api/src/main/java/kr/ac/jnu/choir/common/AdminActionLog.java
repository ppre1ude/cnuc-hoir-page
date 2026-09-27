package kr.ac.jnu.choir.common;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import kr.ac.jnu.choir.member.AccountStatus;
import kr.ac.jnu.choir.member.Member;

@Entity
@Table(name = "admin_action_log")
public class AdminActionLog {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(optional = false) @JoinColumn(name = "actor_member_id", nullable = false)
    private Member actor;
    @ManyToOne(optional = false) @JoinColumn(name = "target_member_id", nullable = false)
    private Member target;
    @Column(nullable = false, length = 32)
    private String action;
    @Column(name = "previous_status", nullable = false, length = 32)
    private String previousStatus;
    @Column(name = "new_status", nullable = false, length = 32)
    private String newStatus;
    @Column(name = "event_id")
    private Long eventId;
    @Column(length = 500)
    private String reason;
    @Column(name = "acted_at", nullable = false)
    private Instant actedAt;

    protected AdminActionLog() {}

    public AdminActionLog(Member actor, Member target, String action, AccountStatus previousStatus,
            AccountStatus newStatus, String reason, Instant actedAt) {
        this.actor = actor;
        this.target = target;
        this.action = action;
        this.previousStatus = previousStatus.name();
        this.newStatus = newStatus.name();
        this.reason = reason;
        this.actedAt = actedAt;
    }
}
