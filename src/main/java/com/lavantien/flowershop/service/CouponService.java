package com.lavantien.flowershop.service;

import com.lavantien.flowershop.api.coupon.Coupon;
import com.lavantien.flowershop.api.coupon.CouponRepository;
import com.lavantien.flowershop.api.error.ConflictException;
import com.lavantien.flowershop.api.error.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Service
public class CouponService {
	private final CouponRepository couponRepository;

	public CouponService(CouponRepository couponRepository) {
		this.couponRepository = couponRepository;
	}

	@Transactional(readOnly = true)
	public Coupon resolve(String code) {
		Coupon coupon = couponRepository.findByCode(code)
			.orElseThrow(() -> new NotFoundException("no coupon with code " + code));
		Instant now = Instant.now();
		if (!coupon.isActive() || coupon.getExpiresAt() != null && !coupon.getExpiresAt().isAfter(now)) {
			throw new ConflictException("COUPON_INACTIVE", "coupon " + code + " is inactive or expired");
		}
		return coupon;
	}
}
