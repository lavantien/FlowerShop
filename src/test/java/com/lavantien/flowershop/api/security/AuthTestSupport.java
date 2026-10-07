package com.lavantien.flowershop.api.security;

import com.jayway.jsonpath.JsonPath;
import com.lavantien.flowershop.api.user.Role;
import com.lavantien.flowershop.api.user.User;
import com.lavantien.flowershop.api.user.UserRepository;
import com.lavantien.flowershop.service.PasswordService;
import com.lavantien.flowershop.service.UserService;
import org.springframework.test.web.servlet.ResultMatcher;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

public final class AuthTestSupport {
	private static final PasswordService PASSWORD_SERVICE = new PasswordService();
	// tokenOf needs the secret the last prime minted, so forged-id tokens still
	// carry a syntactically valid secret segment while never matching a session.
	private static final Map<Long, String> PRIMED_SECRETS = new ConcurrentHashMap<>();

	private AuthTestSupport() {
	}

	public static User persona(long id, Role role, String email) {
		User user = new User("Demo Persona", PASSWORD_SERVICE.hash("1234qwer"), email, "0900000001",
			"01 Demo Lane", "Binh Thanh", "Ho Chi Minh", "demo");
		user.setId(id);
		user.setRole(role);
		return user;
	}

	public static String tokenOf(long id, Role role) {
		String secret = PRIMED_SECRETS.getOrDefault(id, "never-primed");
		return Base64.getEncoder().encodeToString((id + "+" + role.name() + "+" + secret).getBytes(StandardCharsets.UTF_8));
	}

	public static void prime(UserRepository userRepository, UserService userService, User user) {
		when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
		PRIMED_SECRETS.put(user.getId(), userService.login(user.getId()));
	}

	public static ResultMatcher tokenIdentity(String idAndType) {
		return result -> {
			String token = JsonPath.read(result.getResponse().getContentAsString(), "$.token");
			String decoded = new String(Base64.getDecoder().decode(token), StandardCharsets.UTF_8);
			assertTrue(decoded.startsWith(idAndType + "+"),
				"token must start with " + idAndType + "+ and carry a session secret, got: " + decoded);
		};
	}
}
