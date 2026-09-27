package kr.ac.jnu.choir.auth;

import java.net.URI;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import kr.ac.jnu.choir.member.AccountStatus;
import kr.ac.jnu.choir.member.MemberRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MailDeliveryAttempt {
    private final JdbcTemplate jdbc;
    private final MemberRepository members;
    private final AuthTokenService tokens;
    private final MailSender mail;
    private final Clock clock;
    private final String verifyUrl;
    private final String resetUrl;

    public MailDeliveryAttempt(JdbcTemplate jdbc, MemberRepository members, AuthTokenService tokens,
            MailSender mail, Clock clock, @Value("${choir.mail.verify-base-url}") String verifyUrl) {
        this.jdbc = jdbc;
        this.members = members;
        this.tokens = tokens;
        this.mail = mail;
        this.clock = clock;
        this.verifyUrl = verifyUrl;
        this.resetUrl = URI.create(verifyUrl).resolve("/reset-password").toString();
    }

    @Transactional
    public void deliver(long id, long revision) {
        var owner = jdbc.queryForList("SELECT member_id FROM auth_mail_outbox WHERE id = ?", Long.class, id);
        if (owner.isEmpty()) return;
        var member = members.findByIdForUpdate(owner.getFirst()).orElse(null);
        if (member == null) return;
        var jobs = jdbc.query("SELECT purpose FROM auth_mail_outbox WHERE id = ? AND revision = ? "
                        + "AND completed_at IS NULL AND next_attempt_at <= ? FOR UPDATE",
                (rs, row) -> rs.getString(1), id, revision, Timestamp.from(clock.instant()));
        if (jobs.isEmpty()) return;
        String purpose = jobs.getFirst();
        if (MailOutboxService.VERIFY.equals(purpose) && member.getStatus() != AccountStatus.EMAIL_PENDING) {
            complete(id);
            return;
        }
        if (!MailOutboxService.VERIFY.equals(purpose) && !MailOutboxService.RESET.equals(purpose)) {
            complete(id);
            return;
        }
        String token = MailOutboxService.VERIFY.equals(purpose)
                ? tokens.issue(member.getId()) : tokens.issuePasswordReset(member.getId());
        String link = (MailOutboxService.VERIFY.equals(purpose) ? verifyUrl : resetUrl) + "#token=" + token;
        if (MailOutboxService.VERIFY.equals(purpose)) mail.sendVerification(member.getEmail(), link);
        else mail.sendPasswordReset(member.getEmail(), link);
        complete(id);
    }

    @Transactional
    public void markFailure(long id, long revision) {
        var counts = jdbc.queryForList("SELECT attempt_count FROM auth_mail_outbox WHERE id = ? "
                        + "AND revision = ? AND completed_at IS NULL FOR UPDATE",
                Integer.class, id, revision);
        if (counts.isEmpty()) return;
        int minutes = (int) Math.min(60, Math.pow(2, Math.min(counts.getFirst(), 6)));
        jdbc.update("UPDATE auth_mail_outbox SET attempt_count = attempt_count + 1, next_attempt_at = ? WHERE id = ?",
                Timestamp.from(clock.instant().plus(Duration.ofMinutes(minutes))), id);
    }

    private void complete(long id) {
        jdbc.update("UPDATE auth_mail_outbox SET completed_at = ? WHERE id = ?", Timestamp.from(clock.instant()), id);
    }
}
