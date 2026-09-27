package kr.ac.jnu.choir.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import kr.ac.jnu.choir.common.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class AuthTokenService {
    private static final String PURPOSE = MailOutboxService.VERIFY;
    private static final Duration LIFETIME = Duration.ofHours(24);
    private final JdbcTemplate jdbc;
    private final Clock clock;
    private final SecureRandom random = new SecureRandom();

    public AuthTokenService(JdbcTemplate jdbc, Clock clock) {
        this.jdbc = jdbc;
        this.clock = clock;
    }

    public String issue(long memberId) {
        return issue(memberId, PURPOSE, LIFETIME);
    }

    public String issuePasswordReset(long memberId) {
        return issue(memberId, MailOutboxService.RESET, Duration.ofMinutes(30));
    }

    private String issue(long memberId, String purpose, Duration lifetime) {
        Instant now = clock.instant();
        jdbc.update("UPDATE auth_token SET used_at = ? WHERE member_id = ? AND purpose = ? AND used_at IS NULL",
                Timestamp.from(now), memberId, purpose);
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        jdbc.update("INSERT INTO auth_token (member_id, purpose, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)",
                memberId, purpose, hash(token), Timestamp.from(now.plus(lifetime)), Timestamp.from(now));
        return token;
    }

    public boolean issuedWithin(long memberId, Duration interval) {
        Long count = jdbc.queryForObject("SELECT COUNT(*) FROM auth_token WHERE member_id = ? AND purpose = ? AND created_at > ?",
                Long.class, memberId, PURPOSE, Timestamp.from(clock.instant().minus(interval)));
        return count != null && count > 0;
    }

    public long consume(String token) {
        validateToken(token);
        Instant now = clock.instant();
        var rows = jdbc.query("SELECT id, member_id FROM auth_token WHERE token_hash = ? AND purpose = ? AND used_at IS NULL AND expires_at > ? FOR UPDATE",
                (rs, row) -> new long[]{rs.getLong("id"), rs.getLong("member_id")},
                hash(token), PURPOSE, Timestamp.from(now));
        if (rows.size() != 1) {
            throw invalidToken();
        }
        jdbc.update("UPDATE auth_token SET used_at = ? WHERE id = ?", Timestamp.from(now), rows.getFirst()[0]);
        return rows.getFirst()[1];
    }

    public long memberIdFor(String token) {
        validateToken(token);
        var rows = jdbc.queryForList("SELECT member_id FROM auth_token WHERE token_hash = ? AND purpose = ?",
                Long.class, hash(token), PURPOSE);
        if (rows.size() != 1) {
            throw invalidToken();
        }
        return rows.getFirst();
    }

    private static void validateToken(String token) {
        if (token == null || !token.matches("[A-Za-z0-9_-]{43}")) {
            throw invalidToken();
        }
    }

    private static String hash(String token) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256을 사용할 수 없습니다.", exception);
        }
    }

    private static ApiException invalidToken() {
        return new ApiException(HttpStatus.CONFLICT, "INVALID_VERIFICATION_TOKEN", "사용할 수 없는 확인 링크입니다.");
    }
}
