package com.lavantien.flowershop.api.security;

import com.lavantien.flowershop.api.user.User;
import com.lavantien.flowershop.api.user.UserRepository;
import com.lavantien.flowershop.service.PasswordService;
import com.lavantien.flowershop.service.UserService;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Optional;

import static org.mockito.Mockito.when;

public final class AuthTestSupport {
	private static final PasswordService PASSWORD_SERVICE = new PasswordService();

	private AuthTestSupport() {
	}

	public static User persona(long id, String type, String email) {
		User user = new User("Demo Persona", PASSWORD_SERVICE.hash("1234qwer"), email, "0900000001",
			"01 Demo Lane", "Binh Thanh", "Ho Chi Minh", "demo");
		user.setId(id);
		user.setType(type);
		return user;
	}

	public static String tokenOf(long id, String type) {
		return Base64.getEncoder().encodeToString((id + "+" + type).getBytes(StandardCharsets.UTF_8));
	}

	public static void prime(UserRepository userRepository, UserService userService, User user) {
		when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
		userService.loggedInIds.add(user.getId());
	}
}
