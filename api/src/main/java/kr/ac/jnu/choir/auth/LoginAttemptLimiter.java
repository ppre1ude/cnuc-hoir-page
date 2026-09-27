package kr.ac.jnu.choir.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.util.HexFormat;
import kr.ac.jnu.choir.common.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class LoginAttemptLimiter {
    private final JdbcTemplate jdbc;
    private final Clock clock;

    public LoginAttemptLimiter(JdbcTemplate jdbc, Clock clock) {
        this.jdbc = jdbc;
        this.clock = clock;
    }

    @Transactional
    public void reserve(String kind, String identity, int limit) {
        String key = hash(identity);
        Timestamp now = Timestamp.from(clock.instant());
        Timestamp threshold = Timestamp.from(clock.instant().minus(Duration.ofMinutes(15)));
        jdbc.update("INSERT INTO auth_attempt (kind, identity_hash, window_start, attempt_count) VALUES (?, ?, ?, 1) "
                        + "ON DUPLICATE KEY UPDATE attempt_count = IF(window_start <= ?, 1, attempt_count + 1), "
                        + "window_start = IF(window_start <= ?, VALUES(window_start), window_start)",
                kind, key, now, threshold, threshold);
        Integer count = jdbc.queryForObject("SELECT attempt_count FROM auth_attempt WHERE kind = ? AND identity_hash = ?",
                Integer.class, kind, key);
        if (count != null && count > limit) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "RATE_LIMITED", "잠시 후 다시 시도해 주세요.");
        }
    }

    public void release(String kind, String identity) {
        jdbc.update("UPDATE auth_attempt SET attempt_count = GREATEST(attempt_count - 1, 0) "
                + "WHERE kind = ? AND identity_hash = ?", kind, hash(identity));
    }

    public void clear(String kind, String identity) {
        jdbc.update("DELETE FROM auth_attempt WHERE kind = ? AND identity_hash = ?", kind, hash(identity));
    }

    private static String hash(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256을 사용할 수 없습니다.", exception);
        }
    }

}
