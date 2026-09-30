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
@Table(name = "operator_preapproval")
public class OperatorPreapproval {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, length = 320, unique = true)
    private String email;
    @Enumerated(EnumType.STRING)
    @Column(name = "member_type", nullable = false, length = 16)
    private MemberType memberType;
    @ManyToOne(optional = false) @JoinColumn(name = "created_by_member_id", nullable = false)
    private Member createdBy;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected OperatorPreapproval() {}

    public OperatorPreapproval(String email, MemberType memberType, Member createdBy, Instant createdAt) {
        this.email = email;
        this.memberType = memberType;
        this.createdBy = createdBy;
        this.createdAt = createdAt;
    }

    public Long getId() { return id; }
    public String getEmail() { return email; }
    public MemberType getMemberType() { return memberType; }
    public Member getCreatedBy() { return createdBy; }
    public Instant getCreatedAt() { return createdAt; }
}
