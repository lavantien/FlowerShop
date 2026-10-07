package com.lavantien.flowershop.api.error;

import org.springframework.http.HttpStatus;

public final class UnauthenticatedException extends ApiException {
	public UnauthenticatedException(String detail) {
		super(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", detail);
	}
}
