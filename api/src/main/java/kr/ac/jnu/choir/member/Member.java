package kr.ac.jnu.choir.member;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Clock;
import java.time.Instant;
import java.util.Locale;

@Entity
@Table(name = "member")
public class Member {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 320, unique = true)
    private String email;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private AccountStatus status;

    @Enumerated(EnumType.STRING)
    @Column(name = "member_type", length = 16)
    private MemberType memberType;

    @Column(nullable = false)
    private boolean admin;

    @Column(name = "auth_version", nullable = false)
    private long authVersion;

    @Column(name = "email_verified_at")
    private Instant emailVerifiedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Member() {
    }

    public Member(String email, String name, String passwordHash, Clock clock) {
        this.email = email.strip().toLowerCase(Locale.ROOT);
        this.name = name;
        this.passwordHash = passwordHash;
        this.status = AccountStatus.EMAIL_PENDING;
        this.createdAt = clock.instant();
        this.updatedAt = this.createdAt;
    }

    public Long getId() {
        return id;
    }

    public String getEmail() {
        return email;
    }

    public String getName() {
        return name;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public AccountStatus getStatus() {
        return status;
    }

    public MemberType getMemberType() {
        return memberType;
    }

    public boolean isAdmin() {
        return admin;
    }

    public long getAuthVersion() {
        return authVersion;
    }

    public Instant getEmailVerifiedAt() {
        return emailVerifiedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void verifyEmail(Clock clock) {
        if (status != AccountStatus.EMAIL_PENDING) {
            throw new IllegalStateException("이메일 확인 대기 상태가 아닙니다.");
        }
        status = AccountStatus.APPROVAL_PENDING;
        emailVerifiedAt = clock.instant();
        updatedAt = emailVerifiedAt;
    }

    public void resetPassword(String hash, Clock clock) {
        passwordHash = hash;
        authVersion++;
        updatedAt = clock.instant();
    }
}
