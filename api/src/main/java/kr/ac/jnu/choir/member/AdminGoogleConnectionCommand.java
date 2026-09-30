package kr.ac.jnu.choir.member;

import java.io.Console;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.sql.DriverManager;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Arrays;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;

/** DB 관리자가 기존 운영진의 구글 계정 연결 토큰을 발급하는 명령입니다. */
public final class AdminGoogleConnectionCommand {
    private AdminGoogleConnectionCommand() {}

    public static void main(String[] args) throws Exception {
        if (args.length != 3) {
            throw new IllegalArgumentException("사용법: linkExistingAdminGoogle --args='<JDBC URL> <DB 사용자> <운영진 이메일>'");
        }
        Console console = System.console();
        String suppliedPassword = System.getenv("CHOIR_BOOTSTRAP_DB_PASSWORD");
        char[] password = suppliedPassword != null ? suppliedPassword.toCharArray()
                : console == null ? null : console.readPassword("DB 비밀번호: ");
        if (password == null || password.length == 0) {
            throw new IllegalArgumentException("콘솔 또는 CHOIR_BOOTSTRAP_DB_PASSWORD로 DB 비밀번호를 전달해 주세요.");
        }
        try {
            String token = run(args[0], args[1], new String(password), args[2]);
            System.out.println("기존 운영진의 1회용 구글 계정 연결 토큰: " + token);
            System.out.println("24시간 안에 비공개 채널로 전달하고, 터미널 기록에 남지 않도록 관리해 주세요.");
        } finally {
            Arrays.fill(password, '\0');
        }
    }

    static String run(String url, String user, String password, String email) throws Exception {
        String normalized = email.strip().toLowerCase(Locale.ROOT);
        if (!normalized.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+")) {
            throw new IllegalArgumentException("운영진 이메일을 확인해 주세요.");
        }
        byte[] bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        String hash = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                .digest(token.getBytes(StandardCharsets.UTF_8)));
        Instant now = Instant.now();
        try (var connection = DriverManager.getConnection(url, user, password)) {
            connection.setAutoCommit(false);
            try {
                long memberId;
                try (var query = connection.prepareStatement("SELECT id, status, admin, google_subject FROM member WHERE lower(email) = ? FOR UPDATE")) {
                    query.setString(1, normalized);
                    try (var result = query.executeQuery()) {
                        if (!result.next() || !result.getBoolean("admin") || !"APPROVED".equals(result.getString("status"))
                                || result.getString("google_subject") != null) {
                            throw new IllegalStateException("구글 계정 연결이 필요한 승인된 운영진 계정이 아닙니다.");
                        }
                        memberId = result.getLong("id");
                    }
                }
                try (var update = connection.prepareStatement("UPDATE auth_token SET used_at = ? WHERE member_id = ? AND purpose = 'ACCOUNT_SETUP' AND used_at IS NULL")) {
                    update.setTimestamp(1, Timestamp.from(now));
                    update.setLong(2, memberId);
                    update.executeUpdate();
                }
                try (var insert = connection.prepareStatement("INSERT INTO auth_token (member_id, purpose, token_hash, expires_at, created_at) VALUES (?, 'ACCOUNT_SETUP', ?, ?, ?)")) {
                    insert.setLong(1, memberId);
                    insert.setString(2, hash);
                    insert.setTimestamp(3, Timestamp.from(now.plusSeconds(86400)));
                    insert.setTimestamp(4, Timestamp.from(now));
                    if (insert.executeUpdate() != 1) throw new IllegalStateException("연결 토큰을 저장하지 못했습니다.");
                }
                try (var audit = connection.prepareStatement("INSERT INTO admin_action_log (actor_member_id, target_member_id, action, previous_status, new_status, reason, acted_at) VALUES (?, ?, 'GOOGLE_LINK', 'APPROVED', 'APPROVED', '기존 운영진 구글 계정 연결', ?)")) {
                    audit.setLong(1, memberId);
                    audit.setLong(2, memberId);
                    audit.setTimestamp(3, Timestamp.from(now));
                    if (audit.executeUpdate() != 1) throw new IllegalStateException("감사 기록을 저장하지 못했습니다.");
                }
                connection.commit();
                return token;
            } catch (Exception failure) {
                connection.rollback();
                throw failure;
            }
        }
    }
}
