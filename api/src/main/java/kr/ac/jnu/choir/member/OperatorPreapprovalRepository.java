package kr.ac.jnu.choir.member;

import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface OperatorPreapprovalRepository extends JpaRepository<OperatorPreapproval, Long> {
    Optional<OperatorPreapproval> findByEmailIgnoreCase(String email);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from OperatorPreapproval p where p.id = :id")
    Optional<OperatorPreapproval> findByIdForUpdate(Long id);
    Page<OperatorPreapproval> findAllByOrderByCreatedAtDesc(Pageable pageable);
}
