package com.lavantien.flowershop.api.coupon;

import com.lavantien.flowershop.api.error.ApiExceptionHandler;
import com.lavantien.flowershop.api.security.TokenInterceptor;
import com.lavantien.flowershop.api.user.Role;
import com.lavantien.flowershop.api.user.UserRepository;
import com.lavantien.flowershop.service.CouponService;
import com.lavantien.flowershop.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static com.lavantien.flowershop.api.security.AuthTestSupport.persona;
import static com.lavantien.flowershop.api.security.AuthTestSupport.prime;
import static com.lavantien.flowershop.api.security.AuthTestSupport.tokenOf;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class CouponControllerTest {
	private CouponRepository couponRepository;
	private UserRepository userRepository;
	private UserService userService;
	private MockMvc mockMvc;

	@BeforeEach
	void setUp() {
		couponRepository = mock(CouponRepository.class);
		userRepository = mock(UserRepository.class);
		userService = new UserService();
		mockMvc = MockMvcBuilders.standaloneSetup(
				new CouponController(couponRepository, new CouponService(couponRepository)))
			.addInterceptors(new TokenInterceptor(userRepository, userService))
			.setControllerAdvice(new ApiExceptionHandler())
			.build();
		prime(userRepository, userService, persona(1, Role.ADMIN, "admin@flowershop.example"));
		prime(userRepository, userService, persona(4, Role.USER, "member@flowershop.example"));
	}

	private static Coupon coupon(long id, String code, CouponKind kind, String value, boolean active,
		Instant expiresAt) {
		Coupon coupon = new Coupon(code, kind, new BigDecimal(value), active, expiresAt);
		coupon.setId(id);
		return coupon;
	}

	@Test
	void anonymousCannotListCoupons() throws Exception {
		mockMvc.perform(get("/api/coupon"))
			.andExpect(status().isUnauthorized());
	}

	@Test
	void memberCannotListCoupons() throws Exception {
		mockMvc.perform(get("/api/coupon").header("X-Auth-Token", tokenOf(4, Role.USER)))
			.andExpect(status().isForbidden());
	}

	@Test
	void adminListsCoupons() throws Exception {
		when(couponRepository.findAll()).thenReturn(List.of(
			coupon(1, "WELCOME10", CouponKind.PERCENT, "10", true, null),
			coupon(2, "SHIP50K", CouponKind.FIXED, "50000", true, Instant.parse("2027-01-01T00:00:00Z")),
			coupon(3, "EXPIRED5", CouponKind.PERCENT, "5", false, null)));

		mockMvc.perform(get("/api/coupon").header("X-Auth-Token", tokenOf(1, Role.ADMIN)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$").isArray())
			.andExpect(jsonPath("$.length()").value(3))
			.andExpect(jsonPath("$[0].id").value(1))
			.andExpect(jsonPath("$[0].code").value("WELCOME10"))
			.andExpect(jsonPath("$[0].kind").value("PERCENT"))
			.andExpect(jsonPath("$[0].value").value(10))
			.andExpect(jsonPath("$[0].active").value(true))
			.andExpect(jsonPath("$[0].expiresAt").doesNotExist())
			.andExpect(jsonPath("$[1].expiresAt").value("2027-01-01T00:00:00Z"))
			.andExpect(jsonPath("$[2].active").value(false));
	}

	@Test
	void adminCreatesAPercentCoupon() throws Exception {
		when(couponRepository.existsByCode("WELCOME10")).thenReturn(false);
		when(couponRepository.save(any(Coupon.class))).thenAnswer(invocation -> invocation.getArgument(0));

		mockMvc.perform(post("/api/coupon").header("X-Auth-Token", tokenOf(1, Role.ADMIN))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"code\":\" WELCOME10 \",\"kind\":\"PERCENT\",\"value\":10}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.code").value("WELCOME10"))
			.andExpect(jsonPath("$.kind").value("PERCENT"))
			.andExpect(jsonPath("$.value").value(10))
			.andExpect(jsonPath("$.active").value(true))
			.andExpect(jsonPath("$.expiresAt").doesNotExist());

		ArgumentCaptor<Coupon> saved = ArgumentCaptor.forClass(Coupon.class);
		verify(couponRepository).save(saved.capture());
		assertEquals("WELCOME10", saved.getValue().getCode(), "the code must be stored stripped");
		assertTrue(saved.getValue().isActive(), "an omitted active must default to true");
		assertEquals(0, saved.getValue().getValue().scale(), "the value must land as whole dong");
	}

	@Test
	void adminCreatesAFixedCouponWithAnExpiry() throws Exception {
		when(couponRepository.existsByCode("SHIP50K")).thenReturn(false);
		when(couponRepository.save(any(Coupon.class))).thenAnswer(invocation -> invocation.getArgument(0));

		mockMvc.perform(post("/api/coupon").header("X-Auth-Token", tokenOf(1, Role.ADMIN))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"code\":\"SHIP50K\",\"kind\":\"FIXED\",\"value\":50000,\"active\":false,"
					+ "\"expiresAt\":\"2027-01-01T00:00:00Z\"}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.active").value(false))
			.andExpect(jsonPath("$.expiresAt").value("2027-01-01T00:00:00Z"));
	}

	@Test
	void createRefusesADuplicateCode() throws Exception {
		when(couponRepository.existsByCode("WELCOME10")).thenReturn(true);

		mockMvc.perform(post("/api/coupon").header("X-Auth-Token", tokenOf(1, Role.ADMIN))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"code\":\"WELCOME10\",\"kind\":\"PERCENT\",\"value\":10}"))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("NAME_IN_USE"));

		verify(couponRepository, never()).save(any(Coupon.class));
	}

	@Test
	void createRequiresACode() throws Exception {
		mockMvc.perform(post("/api/coupon").header("X-Auth-Token", tokenOf(1, Role.ADMIN))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"kind\":\"PERCENT\",\"value\":10}"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("VALIDATION"))
			.andExpect(jsonPath("$.errors.code").value("must not be blank"));
	}

	@Test
	void createRequiresAKindAndAPositiveValue() throws Exception {
		mockMvc.perform(post("/api/coupon").header("X-Auth-Token", tokenOf(1, Role.ADMIN))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"code\":\"BROKEN\"}"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors.kind").value("must not be null"))
			.andExpect(jsonPath("$.errors.value").value("must not be null"));

		mockMvc.perform(post("/api/coupon").header("X-Auth-Token", tokenOf(1, Role.ADMIN))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"code\":\"ZERO\",\"kind\":\"FIXED\",\"value\":0}"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors.value").value("must be greater than 0"));
	}

	@Test
	void createRejectsAPercentValueAbove100() throws Exception {
		mockMvc.perform(post("/api/coupon").header("X-Auth-Token", tokenOf(1, Role.ADMIN))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"code\":\"TOOBIG\",\"kind\":\"PERCENT\",\"value\":150}"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("VALIDATION"))
			.andExpect(jsonPath("$.errors.value").value("a percent coupon cannot exceed 100"));
	}

	@Test
	void createAllowsAFixedValueAbove100() throws Exception {
		when(couponRepository.existsByCode("SHIP50K")).thenReturn(false);
		when(couponRepository.save(any(Coupon.class))).thenAnswer(invocation -> invocation.getArgument(0));

		mockMvc.perform(post("/api/coupon").header("X-Auth-Token", tokenOf(1, Role.ADMIN))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"code\":\"SHIP50K\",\"kind\":\"FIXED\",\"value\":50000}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.value").value(50000));
	}

	@Test
	void adminUpdatesACouponKeepingAnOmittedActive() throws Exception {
		when(couponRepository.findById(1L))
			.thenReturn(Optional.of(coupon(1, "WELCOME10", CouponKind.PERCENT, "10", false, null)));
		when(couponRepository.existsByCodeAndIdNot("WELCOME20", 1L)).thenReturn(false);
		when(couponRepository.save(any(Coupon.class))).thenAnswer(invocation -> invocation.getArgument(0));

		mockMvc.perform(put("/api/coupon/1").header("X-Auth-Token", tokenOf(1, Role.ADMIN))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"code\":\"WELCOME20\",\"kind\":\"PERCENT\",\"value\":15}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.code").value("WELCOME20"))
			.andExpect(jsonPath("$.value").value(15))
			.andExpect(jsonPath("$.active").value(false));

		ArgumentCaptor<Coupon> saved = ArgumentCaptor.forClass(Coupon.class);
		verify(couponRepository).save(saved.capture());
		assertTrue(!saved.getValue().isActive(), "an omitted active must keep the stored value");
	}

	@Test
	void updateAnswers404ForAMissingCoupon() throws Exception {
		when(couponRepository.findById(99L)).thenReturn(Optional.empty());

		mockMvc.perform(put("/api/coupon/99").header("X-Auth-Token", tokenOf(1, Role.ADMIN))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"code\":\"GHOST\",\"kind\":\"PERCENT\",\"value\":10}"))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code").value("NOT_FOUND"));
	}

	@Test
	void updateRefusesACodeAnotherCouponHolds() throws Exception {
		when(couponRepository.findById(1L))
			.thenReturn(Optional.of(coupon(1, "WELCOME10", CouponKind.PERCENT, "10", true, null)));
		when(couponRepository.existsByCodeAndIdNot("SHIP50K", 1L)).thenReturn(true);

		mockMvc.perform(put("/api/coupon/1").header("X-Auth-Token", tokenOf(1, Role.ADMIN))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"code\":\"SHIP50K\",\"kind\":\"PERCENT\",\"value\":10}"))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("NAME_IN_USE"));

		verify(couponRepository, never()).save(any(Coupon.class));
	}

	@Test
	void adminDeletesACoupon() throws Exception {
		when(couponRepository.findById(1L))
			.thenReturn(Optional.of(coupon(1, "WELCOME10", CouponKind.PERCENT, "10", true, null)));

		mockMvc.perform(delete("/api/coupon/1").header("X-Auth-Token", tokenOf(1, Role.ADMIN)))
			.andExpect(status().isNoContent());

		verify(couponRepository).deleteById(1L);
	}

	@Test
	void deleteAnswers404ForAMissingCoupon() throws Exception {
		when(couponRepository.findById(9L)).thenReturn(Optional.empty());

		mockMvc.perform(delete("/api/coupon/9").header("X-Auth-Token", tokenOf(1, Role.ADMIN)))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code").value("NOT_FOUND"));
	}

	@Test
	void validateRequiresASession() throws Exception {
		mockMvc.perform(post("/api/coupon/validate")
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"code\":\"WELCOME10\",\"subtotal\":100000}"))
			.andExpect(status().isUnauthorized());
	}

	@Test
	void validateComputesAPercentDiscountWithACeiling() throws Exception {
		when(couponRepository.findByCode("WELCOME10"))
			.thenReturn(Optional.of(coupon(1, "WELCOME10", CouponKind.PERCENT, "33", true, null)));

		mockMvc.perform(post("/api/coupon/validate").header("X-Auth-Token", tokenOf(4, Role.USER))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"code\":\"WELCOME10\",\"subtotal\":999}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.code").value("WELCOME10"))
			.andExpect(jsonPath("$.kind").value("PERCENT"))
			.andExpect(jsonPath("$.value").value(33))
			.andExpect(jsonPath("$.discountAmount").value(330));
	}

	@Test
	void validateCapsAPercentDiscountAtTheSubtotal() throws Exception {
		when(couponRepository.findByCode("WELCOME10"))
			.thenReturn(Optional.of(coupon(1, "WELCOME10", CouponKind.PERCENT, "100", true, null)));

		mockMvc.perform(post("/api/coupon/validate").header("X-Auth-Token", tokenOf(4, Role.USER))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"code\":\"WELCOME10\",\"subtotal\":999}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.discountAmount").value(999));
	}

	@Test
	void validateClampsAFixedDiscountToTheSubtotal() throws Exception {
		when(couponRepository.findByCode("SHIP50K"))
			.thenReturn(Optional.of(coupon(2, "SHIP50K", CouponKind.FIXED, "50000", true, null)));

		mockMvc.perform(post("/api/coupon/validate").header("X-Auth-Token", tokenOf(4, Role.USER))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"code\":\"SHIP50K\",\"subtotal\":30000}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.discountAmount").value(30000));
	}

	@Test
	void validateAnswers404ForAnUnknownCode() throws Exception {
		when(couponRepository.findByCode("NOPE")).thenReturn(Optional.empty());

		mockMvc.perform(post("/api/coupon/validate").header("X-Auth-Token", tokenOf(4, Role.USER))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"code\":\"NOPE\",\"subtotal\":100000}"))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code").value("NOT_FOUND"));
	}

	@Test
	void validateConflictsForAnInactiveCoupon() throws Exception {
		when(couponRepository.findByCode("EXPIRED5"))
			.thenReturn(Optional.of(coupon(3, "EXPIRED5", CouponKind.PERCENT, "5", false, null)));

		mockMvc.perform(post("/api/coupon/validate").header("X-Auth-Token", tokenOf(4, Role.USER))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"code\":\"EXPIRED5\",\"subtotal\":100000}"))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("COUPON_INACTIVE"));
	}

	@Test
	void validateConflictsForAnExpiredCoupon() throws Exception {
		when(couponRepository.findByCode("OLD1"))
			.thenReturn(Optional.of(coupon(4, "OLD1", CouponKind.PERCENT, "5", true,
				Instant.parse("2020-01-01T00:00:00Z"))));

		mockMvc.perform(post("/api/coupon/validate").header("X-Auth-Token", tokenOf(4, Role.USER))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"code\":\"OLD1\",\"subtotal\":100000}"))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("COUPON_INACTIVE"));
	}

	@Test
	void validateRequiresACodeAndAPositiveSubtotal() throws Exception {
		mockMvc.perform(post("/api/coupon/validate").header("X-Auth-Token", tokenOf(4, Role.USER))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{}"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("VALIDATION"))
			.andExpect(jsonPath("$.errors.code").value("must not be blank"))
			.andExpect(jsonPath("$.errors.subtotal").value("must not be null"));

		mockMvc.perform(post("/api/coupon/validate").header("X-Auth-Token", tokenOf(4, Role.USER))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"code\":\"WELCOME10\",\"subtotal\":0}"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors.subtotal").value("must be greater than 0"));
	}
}
