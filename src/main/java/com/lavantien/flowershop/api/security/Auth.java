package com.lavantien.flowershop.api.security;

import jakarta.servlet.http.HttpServletRequest;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

public final class Auth {
	public static final String USER_ID_ATTRIBUTE = "authUserId";
	public static final String TYPE_ATTRIBUTE = "authType";
	public static final String ADMIN_TYPE = "ADMIN";

	private Auth() {
	}

	// id and type stay first and second so the frontend split('+') parsers keep
	// working; the third segment is the unguessable per-login session secret.
	public record Session(long id, String type, String secret) {}

	public static Session parseSession(String token) {
		try {
			String decoded = new String(Base64.getDecoder().decode(token), StandardCharsets.UTF_8);
			int first = decoded.indexOf('+');
			int second = decoded.indexOf('+', first + 1);
			if (first <= 0 || second < 0) {
				throw new IllegalArgumentException("missing segments");
			}
			return new Session(Long.parseLong(decoded.substring(0, first)),
				decoded.substring(first + 1, second), decoded.substring(second + 1));
		} catch (RuntimeException malformed) {
			throw new IllegalArgumentException("malformed token", malformed);
		}
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
