package com.lavantien.flowershop.api.payment;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;

public interface PaymentSessionRepository extends JpaRepository<PaymentSession, String> {
	Optional<PaymentSession> findByOrderId(Long orderId);

	// Both locked reads follow the same order everywhere, payment row before
	// order row, so the confirm, cancel, and status paths never deadlock.
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select p from PaymentSession p where p.id = :id")
	Optional<PaymentSession> lockById(String id);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select p from PaymentSession p where p.orderId = :orderId")
	Optional<PaymentSession> lockByOrderId(Long orderId);
}
