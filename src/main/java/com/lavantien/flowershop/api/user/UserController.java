package com.lavantien.flowershop.api.user;

import com.lavantien.flowershop.api.security.Auth;
import com.lavantien.flowershop.api.security.RequireRole;
import com.lavantien.flowershop.service.PasswordService;
import com.lavantien.flowershop.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Base64;
import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/user")
public class UserController {
	private UserRepository userRepository;
	private UserService userService;
	private PasswordService passwordService;

	public UserController(UserRepository userRepository, UserService userService, PasswordService passwordService) {
		this.userRepository = userRepository;
		this.userService = userService;
		this.passwordService = passwordService;
	}

	@RequireRole(Auth.ADMIN_TYPE)
	@GetMapping
	public ResponseEntity<List<User>> getAll() {
		return ResponseEntity.ok(userRepository.findAll());
	}

	@RequireRole(Auth.ADMIN_TYPE)
	@PostMapping
	public ResponseEntity<List<User>> createMany(@RequestBody List<User> users) {
		for (User user : users) {
			if (emailInUse(user.getEmail())) {
				return ResponseEntity.status(HttpStatus.CONFLICT).build();
			}
		}
		for (User user : users) {
			hashPassword(user);
		}
		return ResponseEntity.ok(userRepository.saveAll(users));
	}

	@RequireRole(Auth.ADMIN_TYPE)
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
			return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
		}
		Optional<User> user = userRepository.findById(id);
		if (user.isEmpty()) {
			return ResponseEntity.badRequest().build();
		}
		return ResponseEntity.ok(user.get());
	}

	@PostMapping("/create")
	public ResponseEntity<User> create(@RequestBody User user) {
		if (emailInUse(user.getEmail())) {
			// A duplicate row would break findByEmail for that address forever,
			// so refuse instead of letting the unique index explode at runtime.
			return ResponseEntity.status(HttpStatus.CONFLICT).build();
		}
		user.setType(User.USER_TYPE);
		hashPassword(user);
		return ResponseEntity.ok(userRepository.save(user));
	}

	@PutMapping("/{id}")
	public ResponseEntity<User> update(@PathVariable Long id, @RequestBody User user, HttpServletRequest request) {
		if (!Auth.ownIdOrAdmin(id, request)) {
			return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
		}
		Optional<User> existing = userRepository.findById(id);
		if (existing.isEmpty()) {
			return ResponseEntity.badRequest().build();
		}
		User managed = existing.get();
		managed.setName(user.getName());
		managed.setPhone(user.getPhone());
		managed.setAddress(user.getAddress());
		managed.setAnswer(user.getAnswer());
		if (Auth.isAdmin(request)) {
			managed.setType(user.getType());
			managed.setEnable(user.getEnable());
		}
		return ResponseEntity.ok(userRepository.save(managed));
	}

	@RequireRole(Auth.ADMIN_TYPE)
	@DeleteMapping("/{id}")
	public ResponseEntity<?> delete(@PathVariable Long id) {
		if (userRepository.findById(id).isEmpty()) {
			return ResponseEntity.badRequest().build();
		}
		userRepository.deleteById(id);
		return ResponseEntity.ok().build();
	}

	@PostMapping(value = "/login", consumes = "text/plain")
	public ResponseEntity<TokenDto> doLogin(@RequestBody String info) {
		TokenDto tokenDto = guestDto();
		// A required String body is never null: Spring answers 400 for absent
		// bodies, so only the decode itself can fail.
		String decodedInfo;
		try {
			decodedInfo = new String(Base64.getDecoder().decode(info));
		} catch (IllegalArgumentException malformed) {
			decodedInfo = null;
		}
		int index = decodedInfo == null ? -1 : decodedInfo.indexOf("j0z");
		if (index >= 0) {
			String email = decodedInfo.substring(0, index);
			String password = decodedInfo.substring(index + 3);
			User foundUser = userRepository.findByEmail(email);
			boolean usable = foundUser != null && Boolean.TRUE.equals(foundUser.getEnable());
			if (!usable) {
				passwordService.burnDummyComparison(password);
			} else if (passwordService.matches(password, foundUser.getPassword())) {
				tokenDto.setToken(userToken(foundUser, startSession(foundUser)));
				tokenDto.setPhone(foundUser.getPhone());
				tokenDto.setDetailAddress(foundUser.getAddress() + ", " + foundUser.getDistrict() + ", " + foundUser.getCity());
			}
		}
		return ResponseEntity.ok(tokenDto);
	}

	@PostMapping("/logout")
	public ResponseEntity<TokenDto> doLogout(@RequestBody TokenDto tokenDto) {
		try {
			Auth.Session session = Auth.parseSession(tokenDto.getToken());
			userService.logout(session.id(), session.secret());
		} catch (RuntimeException malformed) {
			// garbage or secret-less tokens must not end anybody's session
		}
		return ResponseEntity.ok(guestDto());
	}

	@PostMapping("/resetPassword")
	public ResponseEntity<TokenDto> doResetPassword(@RequestBody ForgotDto forgotDto) {
		User foundUser = userRepository.findByEmail(forgotDto.getEmail());
		// A null or blank stored answer must never match: equals(null, null)
		// would hand the account to anyone who simply omits the field.
		boolean answerMatches = foundUser != null && forgotDto.getPassword() != null
			&& foundUser.getAnswer() != null && !foundUser.getAnswer().isBlank()
			&& foundUser.getAnswer().equals(forgotDto.getAnswer());
		if (!answerMatches) {
			return ResponseEntity.ok(guestDto());
		}
		foundUser.setPassword(passwordService.hash(forgotDto.getPassword()));
		userRepository.save(foundUser);
		return ResponseEntity.ok(new TokenDto(userToken(foundUser, startSession(foundUser)), foundUser.getPhone(),
			foundUser.getAddress() + ", " + foundUser.getDistrict() + ", " + foundUser.getCity()));
	}

	private void hashPassword(User user) {
		if (user.getPassword() != null) {
			user.setPassword(passwordService.hash(user.getPassword()));
		}
	}

	private String startSession(User user) {
		return userService.login(user.getId());
	}

	private boolean emailInUse(String email) {
		return email != null && userRepository.findByEmail(email) != null;
	}

	private static String userToken(User user, String secret) {
		return Base64.getEncoder().encodeToString((user.getId() + "+" + user.getType() + "+" + secret).getBytes());
	}

	private static TokenDto guestDto() {
		return new TokenDto(guessToken(), "0", "A, Cau Giay, Hanoi");
	}

	private static String guessToken() {
		return Base64.getEncoder().encodeToString("0+GUESS".getBytes());
	}
}

class TokenDto {
	private String token;
	private String phone;
	private String detailAddress;

	public TokenDto() {
	}

	public TokenDto(String token, String phone, String detailAddress) {
		this.token = token;
		this.phone = phone;
		this.detailAddress = detailAddress;
	}

	public String getToken() {
		return token;
	}

	public void setToken(String token) {
		this.token = token;
	}

	public String getPhone() {
		return phone;
	}

	public void setPhone(String phone) {
		this.phone = phone;
	}

	public String getDetailAddress() {
		return detailAddress;
	}

	public void setDetailAddress(String detailAddress) {
		this.detailAddress = detailAddress;
	}
}

class ForgotDto {
	private String email;
	private String answer;
	private String password;

	public ForgotDto() {
	}

	public ForgotDto(String email, String answer, String password) {
		this.email = email;
		this.answer = answer;
		this.password = password;
	}

	public String getEmail() {
		return email;
	}

	public void setEmail(String email) {
		this.email = email;
	}

	public String getAnswer() {
		return answer;
	}

	public void setAnswer(String answer) {
		this.answer = answer;
	}

	public String getPassword() {
		return password;
	}

	public void setPassword(String password) {
		this.password = password;
	}
}
