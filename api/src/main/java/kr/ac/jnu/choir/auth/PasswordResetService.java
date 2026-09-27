package kr.ac.jnu.choir.auth;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;
import kr.ac.jnu.choir.common.ApiException;
import kr.ac.jnu.choir.member.MemberRepository;
import org.springframework.beans.factory.annotation.Value;
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
    private final MailSender mail;
    private final LoginAttemptLimiter limiter;
    private final Clock clock;
    private final String resetUrl;
    private final SecureRandom random = new SecureRandom();
    private final PasswordEncoder passwords = PasswordEncoderFactories.createDelegatingPasswordEncoder();

    public PasswordResetService(JdbcTemplate jdbc, MemberRepository members, MailSender mail,
            LoginAttemptLimiter limiter, Clock clock, @Value("${choir.mail.verify-base-url}") String verifyUrl) {
        this.jdbc = jdbc;
        this.members = members;
        this.mail = mail;
        this.limiter = limiter;
        this.clock = clock;
        URI base = URI.create(verifyUrl);
        if (!"https".equals(base.getScheme()) || base.getHost() == null) {
            throw new IllegalArgumentException("비밀번호 재설정 주소에는 HTTPS 도메인이 필요합니다.");
        }
        resetUrl = base.resolve("/reset-password").toString();
    }

    @Transactional
    public void request(String email, String ip) {
        String normalized = email == null ? "" : email.strip().toLowerCase(Locale.ROOT);
        limiter.reserve("RESET_IP", ip, 3);
        limiter.reserve("RESET_EMAIL", normalized, 3);
        members.findByEmailForUpdate(normalized).ifPresent(member -> {
            var now = Timestamp.from(clock.instant());
            jdbc.update("UPDATE auth_token SET used_at = ? WHERE member_id = ? AND purpose = ? AND used_at IS NULL",
                    now, member.getId(), PURPOSE);
            byte[] bytes = new byte[32];
            random.nextBytes(bytes);
            String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
            jdbc.update("INSERT INTO auth_token (member_id, purpose, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)",
                    member.getId(), PURPOSE, hash(token), Timestamp.from(clock.instant().plus(Duration.ofMinutes(30))), now);
            mail.sendPasswordReset(member.getEmail(), resetUrl + "#token=" + token);
        });
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
        var rows = jdbc.query("SELECT id, member_id FROM auth_token WHERE token_hash = ? AND purpose = ? AND used_at IS NULL AND expires_at > ? FOR UPDATE",
                (rs, row) -> new long[]{rs.getLong(1), rs.getLong(2)}, hash(token), PURPOSE, Timestamp.from(clock.instant()));
        if (rows.size() != 1) throw invalidToken();
        var member = members.findByIdForUpdate(rows.getFirst()[1]).orElseThrow(PasswordResetService::invalidToken);
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
