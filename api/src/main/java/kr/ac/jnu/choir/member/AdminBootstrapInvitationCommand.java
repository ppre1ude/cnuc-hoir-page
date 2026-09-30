package kr.ac.jnu.choir.member;

import java.io.Console;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.sql.DriverManager;
import java.sql.Statement;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Arrays;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;

/** DB 관리자가 최초 운영진에게 일회용 계정 설정 토큰을 발급하는 명령입니다. */
public final class AdminBootstrapInvitationCommand {
    private AdminBootstrapInvitationCommand() {}

    public static void main(String[] args) throws Exception {
        if (args.length != 5) {
            throw new IllegalArgumentException("사용법: bootstrapAdminInvite --args='<JDBC URL> <DB 사용자> <이메일> <이름> <ACTIVE|OB>'");
        }
        Console console = System.console();
        String suppliedPassword = System.getenv("CHOIR_BOOTSTRAP_DB_PASSWORD");
        char[] password = suppliedPassword != null ? suppliedPassword.toCharArray()
                : console == null ? null : console.readPassword("DB 비밀번호: ");
        if (password == null || password.length == 0) {
            throw new IllegalArgumentException("콘솔 또는 CHOIR_BOOTSTRAP_DB_PASSWORD로 DB 비밀번호를 전달해 주세요.");
        }
        try {
            String token = run(args[0], args[1], new String(password), args[2], args[3],
                    MemberType.valueOf(args[4]));
            System.out.println("최초 운영진의 1회용 계정 설정 토큰: " + token);
            System.out.println("24시간 안에 비공개 채널로 전달하고, 터미널 기록에 남지 않도록 관리해 주세요.");
        } finally {
            Arrays.fill(password, '\0');
        }
    }

    static String run(String url, String user, String password, String email, String name, MemberType type)
            throws Exception {
        String normalized = email.strip().toLowerCase(Locale.ROOT);
        if (!normalized.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+") || name.isBlank()
                || normalized.length() > 254 || name.strip().length() > 100) {
            throw new IllegalArgumentException("이메일과 이름을 확인해 주세요.");
        }
        byte[] randomBytes = new byte[32];
        new SecureRandom().nextBytes(randomBytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(randomBytes);
        String tokenHash = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                .digest(token.getBytes(StandardCharsets.UTF_8)));
        Instant now = Instant.now();
        try (var connection = DriverManager.getConnection(url, user, password)) {
            connection.setAutoCommit(false);
            try {
                try (var lock = connection.prepareStatement("SELECT pg_try_advisory_xact_lock(1280199248, 1)");
                        var result = lock.executeQuery()) {
                    result.next();
                    if (!result.getBoolean(1)) throw new IllegalStateException("운영진 지정 잠금을 얻지 못했습니다.");
                }
                try (var count = connection.prepareStatement("SELECT COUNT(*) FROM member WHERE admin = TRUE");
                        var result = count.executeQuery()) {
                    result.next();
                    if (result.getLong(1) != 0) throw new IllegalStateException("이미 운영진이 존재합니다.");
                }
                long memberId;
                try (var insert = connection.prepareStatement("""
                        INSERT INTO member (email, name, password_hash, status, member_type, admin,
                            auth_version, created_at, updated_at)
                        VALUES (?, ?, NULL, 'INVITED', ?, TRUE, 0, ?, ?)
                        """, Statement.RETURN_GENERATED_KEYS)) {
                    insert.setString(1, normalized);
                    insert.setString(2, name.strip());
                    insert.setString(3, type.name());
                    insert.setTimestamp(4, Timestamp.from(now));
                    insert.setTimestamp(5, Timestamp.from(now));
                    if (insert.executeUpdate() != 1) throw new IllegalStateException("계정을 만들지 못했습니다.");
                    try (var keys = insert.getGeneratedKeys()) {
                        if (!keys.next()) throw new IllegalStateException("계정 번호를 확인하지 못했습니다.");
                        memberId = keys.getLong(1);
                    }
                }
                try (var insert = connection.prepareStatement("""
                        INSERT INTO auth_token (member_id, purpose, token_hash, expires_at, created_at)
                        VALUES (?, 'ACCOUNT_SETUP', ?, ?, ?)
                        """)) {
                    insert.setLong(1, memberId);
                    insert.setString(2, tokenHash);
                    insert.setTimestamp(3, Timestamp.from(now.plusSeconds(86400)));
                    insert.setTimestamp(4, Timestamp.from(now));
                    if (insert.executeUpdate() != 1) throw new IllegalStateException("초대 토큰을 저장하지 못했습니다.");
                }
                try (var audit = connection.prepareStatement("""
                        INSERT INTO admin_action_log
                            (actor_member_id, target_member_id, action, previous_status, new_status, reason, acted_at)
                        VALUES (?, ?, 'BOOTSTRAP_INVITE', 'INVITED', 'INVITED', '최초 운영진 초대', ?)
                        """)) {
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
