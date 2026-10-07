package com.lavantien.flowershop.api.error;

import org.springframework.http.HttpStatus;

public final class ForbiddenException extends ApiException {
	public ForbiddenException(String detail) {
		super(HttpStatus.FORBIDDEN, "FORBIDDEN", detail);
	}
}
