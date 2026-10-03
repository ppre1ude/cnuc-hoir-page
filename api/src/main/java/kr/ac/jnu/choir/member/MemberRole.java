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
@Table(name = "member_role")
public class MemberRole {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(optional = false) @JoinColumn(name = "member_id", nullable = false)
    private Member member;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 32)
    private Role role;
    @Enumerated(EnumType.STRING) @Column(length = 32)
    private Department department;
    @Enumerated(EnumType.STRING) @Column(length = 32)
    private Unit unit;
    @Enumerated(EnumType.STRING) @Column(length = 16)
    private Part part;
    @ManyToOne(optional = false) @JoinColumn(name = "assigned_by_member_id", nullable = false)
    private Member assignedBy;
    @Column(name = "assigned_at", nullable = false)
    private Instant assignedAt;

    protected MemberRole() {}

    public MemberRole(Member member, Role role, Department department, Unit unit, Part part, Member assignedBy,
            Instant assignedAt) {
        this.member = member;
        this.role = role;
        this.department = department;
        this.unit = unit;
        this.part = part;
        this.assignedBy = assignedBy;
        this.assignedAt = assignedAt;
    }

    public Long getId() { return id; }
    public Member getMember() { return member; }
    public Role getRole() { return role; }
    public Department getDepartment() { return department; }
    public Unit getUnit() { return unit; }
    public Part getPart() { return part; }
    public Instant getAssignedAt() { return assignedAt; }
}
