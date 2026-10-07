package com.lavantien.flowershop.api.order;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public record CheckoutRequest(
	@NotEmpty(message = "must not be empty") List<@Valid Item> items,
	@NotBlank(message = "must not be blank") @Size(max = 255) String phone,
	@NotBlank(message = "must not be blank") @Size(max = 255) String address,
	@NotBlank(message = "must not be blank") @Size(max = 255) String district,
	@NotBlank(message = "must not be blank") @Size(max = 255) String city,
	Long branchId,
	@Size(max = 255) String couponCode) {

	// The ceiling keeps one absurd quantity from blowing past DECIMAL(12,0)
	// in the line math; no real cart needs five digits of one flower.
	public record Item(@NotNull(message = "is required") Long productId,
		@Min(value = 1, message = "must be at least 1") @Max(value = 10000, message = "must be at most 10000")
		int quantity) {}
}
