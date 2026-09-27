package kr.ac.jnu.choir.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.Timestamp;
import java.time.Clock;
import java.util.HexFormat;
import java.util.Locale;
import kr.ac.jnu.choir.common.ApiException;
import kr.ac.jnu.choir.member.MemberRepository;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PasswordResetService {
    private static final String PURPOSE = "PASSWORD_RESET";
    private final JdbcTemplate jdbc;
    private final MemberRepository members;
    private final MailOutboxService outbox;
    private final LoginAttemptLimiter limiter;
    private final Clock clock;
    private final PasswordEncoder passwords = PasswordEncoderFactories.createDelegatingPasswordEncoder();

    public PasswordResetService(JdbcTemplate jdbc, MemberRepository members, MailOutboxService outbox,
            LoginAttemptLimiter limiter, Clock clock) {
        this.jdbc = jdbc;
        this.members = members;
        this.outbox = outbox;
        this.limiter = limiter;
        this.clock = clock;
    }

    @Transactional
    public void request(String email, String ip) {
        String normalized = email == null ? "" : email.strip().toLowerCase(Locale.ROOT);
        limiter.reserve("RESET_IP", ip, 3);
        limiter.reserve("RESET_EMAIL", normalized, 3);
        members.findByEmailForUpdate(normalized).ifPresent(member -> outbox.enqueue(member.getId(), PURPOSE));
    }

    @Transactional
    public void confirm(String token, String newPassword) {
        if (newPassword == null || newPassword.length() < 12) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "WEAK_PASSWORD", "비밀번호는 12자 이상 입력해 주세요.");
        }
        if (newPassword.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "PASSWORD_TOO_LONG", "비밀번호는 UTF-8 기준 72바이트 이하로 입력해 주세요.");
        }
        if (token == null || !token.matches("[A-Za-z0-9_-]{43}")) throw invalidToken();
        var owners = jdbc.queryForList("SELECT member_id FROM auth_token WHERE token_hash = ? AND purpose = ?",
                Long.class, hash(token), PURPOSE);
        if (owners.size() != 1) throw invalidToken();
        var member = members.findByIdForUpdate(owners.getFirst()).orElseThrow(PasswordResetService::invalidToken);
        var rows = jdbc.query("SELECT id, member_id FROM auth_token WHERE token_hash = ? AND purpose = ? AND used_at IS NULL AND expires_at > ? FOR UPDATE",
                (rs, row) -> new long[]{rs.getLong(1), rs.getLong(2)}, hash(token), PURPOSE, Timestamp.from(clock.instant()));
        if (rows.size() != 1) throw invalidToken();
        member.resetPassword(passwords.encode(newPassword), clock);
        jdbc.update("UPDATE auth_token SET used_at = ? WHERE id = ?", Timestamp.from(clock.instant()), rows.getFirst()[0]);
    }

    private static ApiException invalidToken() {
        return new ApiException(HttpStatus.CONFLICT, "INVALID_RESET_TOKEN", "사용할 수 없는 재설정 링크입니다.");
    }

    private static String hash(String token) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256을 사용할 수 없습니다.", exception);
        }
    }
}
