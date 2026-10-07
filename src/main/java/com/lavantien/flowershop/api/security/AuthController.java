package com.lavantien.flowershop.api.security;

import com.lavantien.flowershop.api.error.UnauthenticatedException;
import com.lavantien.flowershop.api.user.User;
import com.lavantien.flowershop.api.user.UserRepository;
import com.lavantien.flowershop.api.user.UserView;
import com.lavantien.flowershop.service.PasswordService;
import com.lavantien.flowershop.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
	public record LoginRequest(@NotBlank String email, @NotBlank String password) {}

	private final UserRepository userRepository;
	private final UserService userService;
	private final PasswordService passwordService;

	public AuthController(UserRepository userRepository, UserService userService, PasswordService passwordService) {
		this.userRepository = userRepository;
		this.userService = userService;
		this.passwordService = passwordService;
	}

	@PostMapping("/login")
	public SessionView login(@Valid @RequestBody LoginRequest request) {
		User user = userRepository.findByEmail(request.email());
		// Unknown and disabled addresses still pay the bcrypt cost so response
		// time stops revealing which emails exist; a wrong password on a live
		// account burns the same cost inside matches itself.
		if (user == null || !Boolean.TRUE.equals(user.getEnable())) {
			passwordService.burnDummyComparison(request.password());
			throw new UnauthenticatedException("invalid email or password");
		}
		if (!passwordService.matches(request.password(), user.getPassword())) {
			throw new UnauthenticatedException("invalid email or password");
		}
		// Guarded before the session secret is stored, so a roleless legacy
		// account never leaves an orphaned session behind its 401.
		Auth.requireRole(user.getRole());
		return new SessionView(Auth.mintToken(user.getId(), user.getRole(), userService.login(user.getId())),
			UserView.from(user));
	}

	@PostMapping("/logout")
	public ResponseEntity<Void> logout(HttpServletRequest request) {
		// The interceptor already validated this header against the session
		// store, so the parse below cannot fail here.
		Auth.Session session = Auth.parseSession(request.getHeader(Auth.TOKEN_HEADER));
		userService.logout(session.id(), session.secret());
		return ResponseEntity.noContent().build();
	}
}
