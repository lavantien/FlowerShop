package com.lavantien.flowershop.api.user;

import com.lavantien.flowershop.api.error.ConflictException;
import com.lavantien.flowershop.api.error.ForbiddenException;
import com.lavantien.flowershop.api.error.NotFoundException;
import com.lavantien.flowershop.api.error.UnauthenticatedException;
import com.lavantien.flowershop.api.order.OrderRepository;
import com.lavantien.flowershop.api.security.Auth;
import com.lavantien.flowershop.api.security.RequireRole;
import com.lavantien.flowershop.api.security.SessionView;
import com.lavantien.flowershop.service.PasswordService;
import com.lavantien.flowershop.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/user")
public class UserController {
	// Self registration never binds the entity raw: a submitted id would
	// merge into someone else's row and a submitted enable or role would
	// leak admin powers onto a public endpoint. The Size ceilings mirror the
	// 255-wide columns so a wide string fails validation instead of blowing
	// up at the database.
	public record CreateRequest(@NotBlank @Size(max = 255) String name, @NotBlank @Size(max = 255) String email,
		@NotBlank String password, @Size(max = 255) String phone, @Size(max = 255) String address,
		@Size(max = 255) String district, @Size(max = 255) String city, @Size(max = 255) String answer) {}

	public record UpdateMeRequest(@NotBlank @Size(max = 255) String name, @Size(max = 255) String phone,
		@Size(max = 255) String address, @Size(max = 255) String district, @Size(max = 255) String city) {}

	public record PasswordChangeRequest(@NotBlank String currentPassword, @NotBlank String newPassword) {}

	public record AdminUpdateRequest(@NotBlank @Size(max = 255) String name, @Size(max = 255) String phone,
		Role role, Boolean enable) {}

	public record ResetPasswordRequest(@NotBlank String email, @NotBlank String answer, @NotBlank String newPassword) {}

	private final UserRepository userRepository;
	private final OrderRepository orderRepository;
	private final UserService userService;
	private final PasswordService passwordService;

	public UserController(UserRepository userRepository, OrderRepository orderRepository, UserService userService,
		PasswordService passwordService) {
		this.userRepository = userRepository;
		this.orderRepository = orderRepository;
		this.userService = userService;
		this.passwordService = passwordService;
	}

	@GetMapping("/me")
	public UserView me(HttpServletRequest request) {
		return UserView.from(currentUser(request));
	}

	@PutMapping("/me")
	public UserView updateMe(@Valid @RequestBody UpdateMeRequest changes, HttpServletRequest request) {
		User managed = currentUser(request);
		managed.setName(changes.name());
		managed.setPhone(changes.phone());
		managed.setAddress(changes.address());
		managed.setDistrict(changes.district());
		managed.setCity(changes.city());
		return UserView.from(userRepository.save(managed));
	}

	@PostMapping("/me/password")
	public ResponseEntity<Void> changePassword(@Valid @RequestBody PasswordChangeRequest changes,
		HttpServletRequest request) {
		User managed = currentUser(request);
		if (!passwordService.matches(changes.currentPassword(), managed.getPassword())) {
			throw new UnauthenticatedException("the current password is wrong");
		}
		managed.setPassword(passwordService.hash(changes.newPassword()));
		userRepository.save(managed);
		userService.logoutAll(managed.getId());
		return ResponseEntity.noContent().build();
	}

	@RequireRole(Role.ADMIN)
	@GetMapping
	public List<UserView> getAll() {
		return userRepository.findAll().stream().map(UserView::from).toList();
	}

	@RequireRole(Role.ADMIN)
	@PutMapping("/{id}")
	public UserView update(@PathVariable Long id, @Valid @RequestBody AdminUpdateRequest changes) {
		User managed = userRepository.findById(id)
			.orElseThrow(() -> new NotFoundException("no user with id " + id));
		managed.setName(changes.name());
		managed.setPhone(changes.phone());
		if (changes.role() != null) {
			managed.setRole(changes.role());
		}
		if (changes.enable() != null) {
			managed.setEnable(changes.enable());
		}
		return UserView.from(userRepository.save(managed));
	}

	@RequireRole(Role.ADMIN)
	@DeleteMapping("/{id}")
	public ResponseEntity<Void> delete(@PathVariable Long id) {
		userRepository.findById(id).orElseThrow(() -> new NotFoundException("no user with id " + id));
		if (orderRepository.existsByUserId(id)) {
			throw new ConflictException("HAS_ORDERS", "user " + id + " has orders; disable the account instead");
		}
		userRepository.deleteById(id);
		return ResponseEntity.noContent().build();
	}

	@GetMapping("/{id}")
	public UserView getById(@PathVariable Long id, HttpServletRequest request) {
		if (!Auth.ownIdOrAdmin(id, request)) {
			throw new ForbiddenException("only the owner or an admin may read this account");
		}
		return UserView.from(userRepository.findById(id)
			.orElseThrow(() -> new NotFoundException("no user with id " + id)));
	}

	@PostMapping("/create")
	public ResponseEntity<UserView> create(@Valid @RequestBody CreateRequest request) {
		refuseEmailInUse(request.email());
		User user = new User(request.name(), request.password(), request.email(), request.phone(), request.address(),
			request.district(), request.city(), request.answer());
		user.setRole(Role.USER);
		hashPassword(user);
		return ResponseEntity.status(HttpStatus.CREATED).body(UserView.from(userRepository.save(user)));
	}

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
		// Guarded before the session secret is stored, so a roleless legacy
		// account never leaves an orphaned session behind its 401.
		Auth.requireRole(foundUser.getRole());
		foundUser.setPassword(passwordService.hash(request.newPassword()));
		userRepository.save(foundUser);
		return new SessionView(Auth.mintToken(foundUser.getId(), foundUser.getRole(), userService.login(foundUser.getId())),
			UserView.from(foundUser));
	}

	private User currentUser(HttpServletRequest request) {
		return userRepository.findById(Auth.userId(request))
			.orElseThrow(() -> new NotFoundException("the session user no longer exists"));
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
