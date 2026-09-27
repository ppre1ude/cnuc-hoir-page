package kr.ac.jnu.choir.common;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AdminActionLogRepository extends JpaRepository<AdminActionLog, Long> {
    @Query("select count(log) from AdminActionLog log where log.target.id = :targetMemberId")
    long countByTargetMemberId(@Param("targetMemberId") Long targetMemberId);
}
