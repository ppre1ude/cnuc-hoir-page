package kr.ac.jnu.choir.member;

import java.io.Console;
import java.sql.DriverManager;
import java.util.Arrays;
import java.util.Locale;

/** DB 접속 권한을 가진 배포자가 명시적으로 실행하는 최초 운영진 지정 명령입니다. */
public final class AdminBootstrapCommand {
    private AdminBootstrapCommand() {}

    public static void main(String[] args) throws Exception {
        if (args.length != 4) {
            throw new IllegalArgumentException("사용법: bootstrapAdmin --args='<JDBC URL> <DB 사용자> <이메일> <ACTIVE|OB>'");
        }
        MemberType type = MemberType.valueOf(args[3]);
        String email = args[2].strip().toLowerCase(Locale.ROOT);
        Console console = System.console();
        String suppliedPassword = System.getenv("CHOIR_BOOTSTRAP_DB_PASSWORD");
        char[] password = suppliedPassword != null ? suppliedPassword.toCharArray()
                : console == null ? null : console.readPassword("DB 비밀번호: ");
        if (password == null || password.length == 0) {
            throw new IllegalArgumentException("콘솔 또는 CHOIR_BOOTSTRAP_DB_PASSWORD로 DB 비밀번호를 전달해 주세요.");
        }
        try {
            run(args[0], args[1], new String(password), email, type);
            System.out.println("최초 운영진 지정이 완료되었습니다.");
        } finally {
            Arrays.fill(password, '\0');
        }
    }

    static void run(String url, String user, String password, String email, MemberType type) throws Exception {
        try (var connection = DriverManager.getConnection(url, user, password)) {
            connection.setAutoCommit(false);
            boolean locked = false;
            try {
                try (var lock = connection.prepareStatement("SELECT GET_LOCK('choir_first_admin', 10)")) {
                    try (var result = lock.executeQuery()) {
                        result.next();
                        locked = result.getInt(1) == 1;
                    }
                }
                if (!locked) throw new IllegalStateException("운영진 지정 잠금을 얻지 못했습니다.");
                try (var count = connection.prepareStatement("SELECT COUNT(*) FROM member WHERE admin = TRUE")) {
                    try (var result = count.executeQuery()) {
                        result.next();
                        if (result.getLong(1) != 0) throw new IllegalStateException("이미 운영진이 존재합니다.");
                    }
                }
                try (var update = connection.prepareStatement("""
                        UPDATE member SET status = 'APPROVED', member_type = ?, admin = TRUE,
                            auth_version = auth_version + 1, updated_at = CURRENT_TIMESTAMP(6)
                        WHERE email = ? AND status = 'APPROVAL_PENDING' AND email_verified_at IS NOT NULL
                        """)) {
                    update.setString(1, type.name());
                    update.setString(2, email);
                    if (update.executeUpdate() != 1) {
                        throw new IllegalStateException("이메일 확인된 승인 대기 계정 한 명을 찾지 못했습니다.");
                    }
                }
                try (var audit = connection.prepareStatement("""
                        INSERT INTO admin_action_log
                            (actor_member_id, target_member_id, action, previous_status, new_status, reason, acted_at)
                        SELECT id, id, 'BOOTSTRAP_ADMIN', 'APPROVAL_PENDING', 'APPROVED',
                            '최초 운영진 지정', CURRENT_TIMESTAMP(6)
                        FROM member WHERE email = ?
                        """)) {
                    audit.setString(1, email);
                    if (audit.executeUpdate() != 1) throw new IllegalStateException("운영진 지정 기록을 저장하지 못했습니다.");
                }
                connection.commit();
            } catch (Exception failure) {
                connection.rollback();
                throw failure;
            } finally {
                if (locked) {
                    try (var unlock = connection.prepareStatement("SELECT RELEASE_LOCK('choir_first_admin')")) {
                        unlock.executeQuery().close();
                    }
                }
            }
        }
    }
}
