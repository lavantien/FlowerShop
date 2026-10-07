package com.lavantien.flowershop.api.user;

import com.lavantien.flowershop.api.error.ConflictException;
import com.lavantien.flowershop.api.error.ForbiddenException;
import com.lavantien.flowershop.api.error.NotFoundException;
import com.lavantien.flowershop.api.error.UnauthenticatedException;
import com.lavantien.flowershop.api.security.Auth;
import com.lavantien.flowershop.api.security.RequireRole;
import com.lavantien.flowershop.api.security.SessionView;
import com.lavantien.flowershop.service.PasswordService;
import com.lavantien.flowershop.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/user")
public class UserController {
	private final UserRepository userRepository;
	private final UserService userService;
	private final PasswordService passwordService;

	public UserController(UserRepository userRepository, UserService userService, PasswordService passwordService) {
		this.userRepository = userRepository;
		this.userService = userService;
		this.passwordService = passwordService;
	}

	@RequireRole(Role.ADMIN)
	@GetMapping
	public ResponseEntity<List<User>> getAll() {
		return ResponseEntity.ok(userRepository.findAll());
	}

	@RequireRole(Role.ADMIN)
	@PostMapping
	public ResponseEntity<List<User>> createMany(@RequestBody List<User> users) {
		for (User user : users) {
			refuseEmailInUse(user.getEmail());
		}
		for (User user : users) {
			hashPassword(user);
		}
		return ResponseEntity.ok(userRepository.saveAll(users));
	}

	@RequireRole(Role.ADMIN)
	@DeleteMapping
	public ResponseEntity<?> deleteMany(@RequestBody(required = false) List<Long> ids) {
		if (ids == null) {
			userRepository.deleteAll();
			return ResponseEntity.ok().build();
		}
		userRepository.deleteAll(userRepository.findAllById(ids));
		return ResponseEntity.ok().build();
	}

	@GetMapping("/{id}")
	public ResponseEntity<User> getById(@PathVariable Long id, HttpServletRequest request) {
		if (!Auth.ownIdOrAdmin(id, request)) {
			throw new ForbiddenException("only the owner or an admin may read this account");
		}
		return ResponseEntity.ok(userRepository.findById(id)
			.orElseThrow(() -> new NotFoundException("no user with id " + id)));
	}

	@PostMapping("/create")
	public ResponseEntity<User> create(@RequestBody User user) {
		refuseEmailInUse(user.getEmail());
		user.setRole(Role.USER);
		hashPassword(user);
		return ResponseEntity.ok(userRepository.save(user));
	}

	@PutMapping("/{id}")
	public ResponseEntity<User> update(@PathVariable Long id, @RequestBody User user, HttpServletRequest request) {
		if (!Auth.ownIdOrAdmin(id, request)) {
			throw new ForbiddenException("only the owner or an admin may change this account");
		}
		Optional<User> existing = userRepository.findById(id);
		if (existing.isEmpty()) {
			throw new NotFoundException("no user with id " + id);
		}
		User managed = existing.get();
		managed.setName(user.getName());
		managed.setPhone(user.getPhone());
		managed.setAddress(user.getAddress());
		managed.setAnswer(user.getAnswer());
		if (Auth.isAdmin(request)) {
			managed.setRole(user.getRole());
			managed.setEnable(user.getEnable());
		}
		return ResponseEntity.ok(userRepository.save(managed));
	}

	@RequireRole(Role.ADMIN)
	@DeleteMapping("/{id}")
	public ResponseEntity<?> delete(@PathVariable Long id) {
		userRepository.findById(id).orElseThrow(() -> new NotFoundException("no user with id " + id));
		userRepository.deleteById(id);
		return ResponseEntity.ok().build();
	}

	public record ResetPasswordRequest(@NotBlank String email, @NotBlank String answer, @NotBlank String newPassword) {}

	@PostMapping("/resetPassword")
	public SessionView doResetPassword(@Valid @RequestBody ResetPasswordRequest request) {
		User foundUser = userRepository.findByEmail(request.email());
		// A null or blank stored answer must never match: equals(null, null)
		// would hand the account to anyone who simply omits the field.
		boolean answerMatches = foundUser != null
			&& foundUser.getAnswer() != null && !foundUser.getAnswer().isBlank()
			&& foundUser.getAnswer().equals(request.answer());
		if (!answerMatches) {
			throw new UnauthenticatedException("invalid email or answer");
		}
		foundUser.setPassword(passwordService.hash(request.newPassword()));
		userRepository.save(foundUser);
		return new SessionView(Auth.mintToken(foundUser.getId(), foundUser.getRole(), userService.login(foundUser.getId())),
			foundUser);
	}

	private void hashPassword(User user) {
		if (user.getPassword() != null) {
			user.setPassword(passwordService.hash(user.getPassword()));
		}
	}

	private void refuseEmailInUse(String email) {
		// A duplicate row would break findByEmail for that address forever,
		// so refuse instead of letting the unique index explode at runtime.
		if (email != null && userRepository.findByEmail(email) != null) {
			throw new ConflictException("EMAIL_IN_USE", email + " is already registered");
		}
	}
}
