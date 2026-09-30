package kr.ac.jnu.choir.member;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "member_allowlist")
public class MemberAllowlist {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, length = 320, unique = true)
    private String email;
    @Enumerated(EnumType.STRING)
    @Column(name = "member_type", nullable = false, length = 16)
    private MemberType memberType;
    @Column(name = "display_name", length = 100)
    private String displayName;
    @ManyToOne(optional = false) @JoinColumn(name = "created_by_member_id", nullable = false)
    private Member createdBy;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected MemberAllowlist() {}

    public MemberAllowlist(String email, MemberType type, String displayName, Member createdBy, Instant createdAt) {
        this.email = email;
        this.memberType = type;
        this.displayName = displayName;
        this.createdBy = createdBy;
        this.createdAt = createdAt;
    }

    public Long getId() { return id; }
    public String getEmail() { return email; }
    public MemberType getMemberType() { return memberType; }
    public String getDisplayName() { return displayName; }
    public Member getCreatedBy() { return createdBy; }
    public Instant getCreatedAt() { return createdAt; }
}
