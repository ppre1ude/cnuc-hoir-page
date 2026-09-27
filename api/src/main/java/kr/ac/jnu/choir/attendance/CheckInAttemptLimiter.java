package kr.ac.jnu.choir.attendance;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.util.HexFormat;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CheckInAttemptLimiter {
    private final JdbcTemplate jdbc;
    private final Clock clock;

    public CheckInAttemptLimiter(JdbcTemplate jdbc, Clock clock) {
        this.jdbc = jdbc;
        this.clock = clock;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean reserve(long memberId, String ip) {
        boolean accountAllowed = increment("ACCOUNT", Long.toString(memberId));
        boolean ipAllowed = increment("IP", ip);
        return accountAllowed && ipAllowed;
    }

    private boolean increment(String kind, String identity) {
        String key = sha256(identity);
        Timestamp now = Timestamp.from(clock.instant());
        Timestamp expired = Timestamp.from(clock.instant().minus(Duration.ofMinutes(1)));
        jdbc.update("INSERT INTO check_in_attempt (kind,identity_hash,window_start,attempt_count) VALUES (?,?,?,1) "
                + "ON DUPLICATE KEY UPDATE attempt_count = IF(window_start <= ?, 1, attempt_count + 1), "
                + "window_start = IF(window_start <= ?, VALUES(window_start), window_start)",
                kind, key, now, expired, expired);
        Integer count = jdbc.queryForObject("SELECT attempt_count FROM check_in_attempt WHERE kind = ? AND identity_hash = ?",
                Integer.class, kind, key);
        return count != null && count <= 10;
    }

    private static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256을 사용할 수 없습니다.", exception);
        }
    }
}
