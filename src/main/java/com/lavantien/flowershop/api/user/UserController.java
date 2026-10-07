package com.lavantien.flowershop.api.user;

import com.lavantien.flowershop.api.security.Auth;
import com.lavantien.flowershop.api.security.RequireRole;
import com.lavantien.flowershop.service.MailService;
import com.lavantien.flowershop.service.PasswordService;
import com.lavantien.flowershop.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Base64;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

@RestController
@RequestMapping("/api/user")
public class UserController {
	private UserRepository userRepository;
	@SuppressWarnings("unused")
	private MailService mailService;
	private UserService userService;
	private PasswordService passwordService;

	public UserController(UserRepository userRepository, MailService mailService, UserService userService,
			PasswordService passwordService) {
		this.userRepository = userRepository;
		this.mailService = mailService;
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

	@SuppressWarnings("null")
	@PostMapping(value = "/login", consumes = "text/plain")
	public ResponseEntity<TokenDto> doLogin(@RequestBody String info) {
		String decodedInfo = new String(Base64.getDecoder().decode(info));
		int index = decodedInfo.indexOf("j0z");
		String email = decodedInfo.substring(0, index);
		String password = decodedInfo.substring(index + 3);
		User foundUser = userRepository.findByEmail(email);
		TokenDto tokenDto = new TokenDto(guessToken(), "0", "A, Cau Giay, Hanoi");
		if (foundUser != null && passwordService.matches(password, foundUser.getPassword())) {
			markLoggedIn(foundUser);
			tokenDto.setToken(userToken(foundUser));
			tokenDto.setPhone(foundUser.getPhone());
			tokenDto.setDetailAddress(foundUser.getAddress() + ", " + foundUser.getDistrict() + ", " + foundUser.getCity());
		}
		return ResponseEntity.ok(tokenDto);
	}

	@PostMapping("/logout")
	public ResponseEntity<TokenDto> doLogout(@RequestBody TokenDto tokenDto) {
		String decodedInfo = new String(Base64.getDecoder().decode(tokenDto.getToken()));
		int index = decodedInfo.indexOf("+");
		Long id = Long.parseLong(decodedInfo.substring(0, index));
//		String type = decodedInfo.substring(index + 1);
		if (!userService.loggedInIds.isEmpty()) {
			userService.loggedInIds.remove(id);
		}
		return ResponseEntity.ok(new TokenDto(Base64.getEncoder().encodeToString("0+GUESS".getBytes()), "0", "A, Cau Giay, Hanoi"));
	}

	@PostMapping("/resetPassword")
	public ResponseEntity<TokenDto> doResetPassword(@RequestBody ForgotDto forgotDto) {
		User foundUser = userRepository.findByEmail(forgotDto.getEmail());
		boolean answerMatches = foundUser != null && forgotDto.getPassword() != null
			&& Objects.equals(foundUser.getAnswer(), forgotDto.getAnswer());
		if (!answerMatches) {
			return ResponseEntity.ok(new TokenDto(guessToken(), "0", "A, Cau Giay, Hanoi"));
		}
		foundUser.setPassword(passwordService.hash(forgotDto.getPassword()));
		userRepository.save(foundUser);
		markLoggedIn(foundUser);
		return ResponseEntity.ok(new TokenDto(userToken(foundUser), foundUser.getPhone(), foundUser.getAddress() + ", " + foundUser.getDistrict() + ", " + foundUser.getCity()));
	}

	private void hashPassword(User user) {
		if (user.getPassword() != null) {
			user.setPassword(passwordService.hash(user.getPassword()));
		}
	}

	private void markLoggedIn(User user) {
		if (!userService.loggedInIds.contains(user.getId())) {
			userService.loggedInIds.add(user.getId());
		}
	}

	private static String userToken(User user) {
		return Base64.getEncoder().encodeToString((user.getId() + "+" + user.getType()).getBytes());
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
