package kr.ac.jnu.choir.member;

import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import jakarta.persistence.LockModeType;

public interface MemberAllowlistRepository extends JpaRepository<MemberAllowlist, Long> {
    Optional<MemberAllowlist> findByEmailIgnoreCase(String email);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from MemberAllowlist a where a.id = :id")
    Optional<MemberAllowlist> findByIdForUpdate(Long id);
    Page<MemberAllowlist> findAllByOrderByCreatedAtDesc(Pageable pageable);
}
