package com.lavantien.flowershop.service;

import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.util.HexFormat;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class UserService {
	// Sessions are keyed by user id and carry a random secret that only the
	// login response ever hands out, so encoding the public id and type into a
	// token no longer lets a forger impersonate a logged in account.
	private final Map<Long, String> sessionSecrets = new ConcurrentHashMap<>();

	public String login(long id) {
		String secret = newSecret();
		sessionSecrets.put(id, secret);
		return secret;
	}

	public void logout(long id, String secret) {
		sessionSecrets.remove(id, secret);
	}

	public boolean hasSession(long id, String secret) {
		return secret != null && secret.equals(sessionSecrets.get(id));
	}

	public boolean isLoggedIn(long id) {
		return sessionSecrets.containsKey(id);
	}

	private static String newSecret() {
		byte[] bytes = new byte[16];
		new SecureRandom().nextBytes(bytes);
		return HexFormat.of().formatHex(bytes);
	}
}
