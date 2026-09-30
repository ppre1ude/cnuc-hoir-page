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

    @Column(name = "google_subject", length = 255, unique = true)
    private String googleSubject;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(name = "password_hash")
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

    public static Member invited(String email, String name, MemberType type, Clock clock) {
        Member member = new Member();
        member.email = email.strip().toLowerCase(Locale.ROOT);
        member.name = name.strip();
        member.status = AccountStatus.INVITED;
        member.memberType = type;
        member.createdAt = clock.instant();
        member.updatedAt = member.createdAt;
        return member;
    }

    public static Member googleApplicant(String email, String name, String subject, Clock clock) {
        Member member = new Member();
        member.email = email.strip().toLowerCase(Locale.ROOT);
        member.name = name.strip();
        member.googleSubject = subject;
        member.status = AccountStatus.APPROVAL_PENDING;
        member.emailVerifiedAt = clock.instant();
        member.createdAt = member.emailVerifiedAt;
        member.updatedAt = member.createdAt;
        return member;
    }

    public Long getId() {
        return id;
    }

    public String getEmail() {
        return email;
    }

    public String getGoogleSubject() {
        return googleSubject;
    }

    public void connectGoogle(String subject, Clock clock) {
        if (googleSubject != null && !googleSubject.equals(subject)) {
            throw new IllegalStateException("다른 구글 계정이 연결되어 있습니다.");
        }
        googleSubject = subject;
        passwordHash = null;
        emailVerifiedAt = clock.instant();
        if (status == AccountStatus.INVITED) status = AccountStatus.APPROVED;
        authVersion++;
        updatedAt = clock.instant();
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

    public void reinvite(Clock clock) {
        if (status != AccountStatus.REVOKED) {
            throw new IllegalStateException("접근 해제된 계정만 다시 초대할 수 있습니다.");
        }
        status = AccountStatus.INVITED;
        passwordHash = null;
        googleSubject = null;
        admin = false;
        authVersion++;
        updatedAt = clock.instant();
    }

    public void approve(MemberType type, Clock clock) {
        status = AccountStatus.APPROVED;
        memberType = type;
        authVersion++;
        updatedAt = clock.instant();
    }

    public void reject(Clock clock) {
        status = AccountStatus.REJECTED;
        authVersion++;
        updatedAt = clock.instant();
    }

    public void revoke(Clock clock) {
        status = AccountStatus.REVOKED;
        admin = false;
        authVersion++;
        updatedAt = clock.instant();
    }
}
