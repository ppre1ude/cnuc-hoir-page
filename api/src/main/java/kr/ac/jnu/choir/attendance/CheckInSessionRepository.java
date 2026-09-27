package kr.ac.jnu.choir.attendance;

import org.springframework.data.jpa.repository.JpaRepository;

public interface CheckInSessionRepository extends JpaRepository<CheckInSession, Long> {}
