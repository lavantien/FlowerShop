package com.lavantien.flowershop.api.error;

import org.springframework.http.HttpStatus;

public final class ConflictException extends ApiException {
	public ConflictException(String code, String detail) {
		super(HttpStatus.CONFLICT, code, detail);
	}
}
