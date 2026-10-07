package com.lavantien.flowershop.api.coupon;

import com.lavantien.flowershop.api.error.ConflictException;
import com.lavantien.flowershop.api.error.NotFoundException;
import com.lavantien.flowershop.api.security.RequireRole;
import com.lavantien.flowershop.api.user.Role;
import com.lavantien.flowershop.service.CouponService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.List;

@RestController
@RequestMapping("/api/coupon")
public class CouponController {
	private final CouponRepository couponRepository;
	private final CouponService couponService;

	public CouponController(CouponRepository couponRepository, CouponService couponService) {
		this.couponRepository = couponRepository;
		this.couponService = couponService;
	}

	@RequireRole(Role.ADMIN)
	@GetMapping
	public List<Coupon> getAll() {
		return couponRepository.findAll();
	}

	@RequireRole(Role.ADMIN)
	@PostMapping
	public Coupon create(@Valid @RequestBody CouponInput input) {
		requireFreeCode(input.code().strip(), null);
		return couponRepository.save(input.toEntity());
	}

	@RequireRole(Role.ADMIN)
	@PutMapping("/{id}")
	public Coupon update(@PathVariable Long id, @Valid @RequestBody CouponInput input) {
		Coupon managed = couponRepository.findById(id)
			.orElseThrow(() -> new NotFoundException("no coupon with id " + id));
		requireFreeCode(input.code().strip(), id);
		input.applyTo(managed);
		return couponRepository.save(managed);
	}

	@RequireRole(Role.ADMIN)
	@DeleteMapping("/{id}")
	public ResponseEntity<Void> delete(@PathVariable Long id) {
		couponRepository.findById(id).orElseThrow(() -> new NotFoundException("no coupon with id " + id));
		couponRepository.deleteById(id);
		return ResponseEntity.noContent().build();
	}

	// Any live session may preview its cart's discount before committing.
	@PostMapping("/validate")
	public CouponPreview validate(@Valid @RequestBody ValidateRequest request) {
		Coupon coupon = couponService.resolve(request.code().strip());
		return new CouponPreview(coupon.getCode(), coupon.getKind(), coupon.getValue(),
			coupon.discountOn(request.subtotal()));
	}

	public record ValidateRequest(@NotBlank String code, @NotNull @Positive BigDecimal subtotal) {}

	public record CouponPreview(String code, CouponKind kind, BigDecimal value, BigDecimal discountAmount) {}

	private void requireFreeCode(String code, Long ownedBy) {
		boolean taken = ownedBy == null ? couponRepository.existsByCode(code)
			: couponRepository.existsByCodeAndIdNot(code, ownedBy);
		if (taken) {
			throw new ConflictException("NAME_IN_USE", "coupon code " + code + " is already in use");
		}
	}
}
