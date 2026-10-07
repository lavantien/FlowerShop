package com.lavantien.flowershop.api.error;

import org.springframework.http.HttpStatus;

public final class NotFoundException extends ApiException {
	public NotFoundException(String detail) {
		super(HttpStatus.NOT_FOUND, "NOT_FOUND", detail);
	}
}
