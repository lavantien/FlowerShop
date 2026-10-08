package com.lavantien.flowershop.api.coupon;

import jakarta.validation.Constraint;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import jakarta.validation.Payload;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import java.math.BigDecimal;

@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = PercentCap.Validator.class)
public @interface PercentCap {
	String message() default "a percent coupon cannot exceed 100";

	Class<?>[] groups() default {};

	Class<? extends Payload>[] payload() default {};

	class Validator implements ConstraintValidator<PercentCap, CouponInput> {
		private String message;

		@Override
		public void initialize(PercentCap constraint) {
			message = constraint.message();
		}

		@Override
		public boolean isValid(CouponInput input, ConstraintValidatorContext context) {
			if (input == null || input.kind() != CouponKind.PERCENT || input.value() == null) {
				return true;
			}
			if (input.value().compareTo(BigDecimal.valueOf(100)) <= 0) {
				return true;
			}
			context.disableDefaultConstraintViolation();
			context.buildConstraintViolationWithTemplate(message)
				.addPropertyNode("value")
				.addConstraintViolation();
			return false;
		}
	}
}
