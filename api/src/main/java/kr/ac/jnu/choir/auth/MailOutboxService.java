package kr.ac.jnu.choir.auth;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class MailOutboxService {
    public static final String VERIFY = "EMAIL_VERIFICATION";
    public static final String RESET = "PASSWORD_RESET";
    private final JdbcTemplate jdbc;
    private final Clock clock;
    private final MailDeliveryAttempt delivery;

    public MailOutboxService(JdbcTemplate jdbc, Clock clock, MailDeliveryAttempt delivery) {
        this.jdbc = jdbc;
        this.clock = clock;
        this.delivery = delivery;
    }

    public void enqueue(long memberId, String purpose) {
        Timestamp now = Timestamp.from(clock.instant());
        jdbc.update("INSERT INTO auth_mail_outbox (member_id, purpose, requested_at, next_attempt_at, attempt_count) "
                        + "VALUES (?, ?, ?, ?, 0) ON DUPLICATE KEY UPDATE requested_at = VALUES(requested_at), "
                        + "next_attempt_at = VALUES(next_attempt_at), attempt_count = 0, completed_at = NULL, "
                        + "revision = revision + 1",
                memberId, purpose, now, now);
    }

    public boolean queuedWithin(long memberId, String purpose, Duration interval) {
        Long count = jdbc.queryForObject("SELECT COUNT(*) FROM auth_mail_outbox WHERE member_id = ? AND purpose = ? "
                        + "AND requested_at > ?", Long.class, memberId, purpose,
                Timestamp.from(clock.instant().minus(interval)));
        return count != null && count > 0;
    }

    public void dispatchDue() {
        var jobs = jdbc.query("SELECT id, revision FROM auth_mail_outbox WHERE completed_at IS NULL "
                        + "AND next_attempt_at <= ? ORDER BY next_attempt_at, id LIMIT 20",
                (rs, row) -> new DueJob(rs.getLong(1), rs.getLong(2)), Timestamp.from(clock.instant()));
        for (DueJob job : jobs) {
            try {
                delivery.deliver(job.id(), job.revision());
            } catch (RuntimeException exception) {
                delivery.markFailure(job.id(), job.revision());
            }
        }
    }

    private record DueJob(long id, long revision) {}
}
