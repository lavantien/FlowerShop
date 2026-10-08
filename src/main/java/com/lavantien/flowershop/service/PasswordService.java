package com.lavantien.flowershop.service;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class PasswordService {
	private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
	private final String dummyHash = encoder.encode("never matches anything");

	public String hash(String rawPassword) {
		return encoder.encode(rawPassword);
	}

	public boolean matches(String rawPassword, String hashedPassword) {
		return encoder.matches(rawPassword, hashedPassword);
	}

	public void burnDummyComparison(String rawPassword) {
		encoder.matches(rawPassword == null ? "" : rawPassword, dummyHash);
	}
}
