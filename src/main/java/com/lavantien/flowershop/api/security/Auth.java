package com.lavantien.flowershop.api.security;

import jakarta.servlet.http.HttpServletRequest;

public final class Auth {
	public static final String USER_ID_ATTRIBUTE = "authUserId";
	public static final String TYPE_ATTRIBUTE = "authType";
	public static final String ADMIN_TYPE = "ADMIN";

	private Auth() {
	}

	public static Long userId(HttpServletRequest request) {
		return (Long) request.getAttribute(USER_ID_ATTRIBUTE);
	}

	public static boolean isAdmin(HttpServletRequest request) {
		return ADMIN_TYPE.equals(request.getAttribute(TYPE_ATTRIBUTE));
	}

	public static boolean ownIdOrAdmin(Long id, HttpServletRequest request) {
		return isAdmin(request) || id.equals(userId(request));
	}
}
