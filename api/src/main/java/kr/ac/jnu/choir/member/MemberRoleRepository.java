package kr.ac.jnu.choir.member;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MemberRoleRepository extends JpaRepository<MemberRole, Long> {
    List<MemberRole> findByMemberIdOrderByAssignedAtAsc(Long memberId);

    List<MemberRole> findByMemberIdIn(List<Long> memberIds);

    void deleteByMemberId(Long memberId);
}
