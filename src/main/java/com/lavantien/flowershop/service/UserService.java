package com.lavantien.flowershop.service;

import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.util.HexFormat;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class UserService {
	private final Map<Long, String> sessionSecrets = new ConcurrentHashMap<>();

	public String login(long id) {
		String secret = newSecret();
		sessionSecrets.put(id, secret);
		return secret;
	}

	public void logout(long id, String secret) {
		sessionSecrets.remove(id, secret);
	}

	public void logoutAll(long id) {
		sessionSecrets.remove(id);
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
