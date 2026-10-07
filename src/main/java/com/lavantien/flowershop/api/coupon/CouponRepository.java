package com.lavantien.flowershop.api.coupon;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CouponRepository extends JpaRepository<Coupon, Long> {

	Optional<Coupon> findByCode(String code);

	boolean existsByCode(String code);

	boolean existsByCodeAndIdNot(String code, Long id);
}
