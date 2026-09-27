package kr.ac.jnu.choir.attendance;

import org.springframework.data.jpa.repository.JpaRepository;

public interface AttendanceRepository extends JpaRepository<Attendance, Long> {
    long countByEventIdAndMemberId(Long eventId, Long memberId);
}
