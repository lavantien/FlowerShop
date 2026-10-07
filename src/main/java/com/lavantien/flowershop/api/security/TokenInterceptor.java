package com.lavantien.flowershop.api.security;

import com.lavantien.flowershop.api.error.ForbiddenException;
import com.lavantien.flowershop.api.error.UnauthenticatedException;
import com.lavantien.flowershop.api.user.Role;
import com.lavantien.flowershop.api.user.User;
import com.lavantien.flowershop.api.user.UserRepository;
import com.lavantien.flowershop.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Component;
import org.springframework.util.AntPathMatcher;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

import java.util.List;

@Component
public class TokenInterceptor implements HandlerInterceptor {
	private record PublicRule(HttpMethod method, String pattern) {}

	private static final List<PublicRule> PUBLIC_RULES = List.of(
		new PublicRule(HttpMethod.GET, "/api/product"),
		new PublicRule(HttpMethod.GET, "/api/product/*"),
		new PublicRule(HttpMethod.GET, "/api/category"),
		new PublicRule(HttpMethod.GET, "/api/category/*"),
		new PublicRule(HttpMethod.GET, "/api/type"),
		new PublicRule(HttpMethod.GET, "/api/type/*"),
		new PublicRule(HttpMethod.POST, "/api/user/login"),
		new PublicRule(HttpMethod.POST, "/api/user/create"),
		new PublicRule(HttpMethod.POST, "/api/user/logout"),
		new PublicRule(HttpMethod.POST, "/api/user/resetPassword"));

	private final UserRepository userRepository;
	private final UserService userService;
	private final AntPathMatcher pathMatcher = new AntPathMatcher();

	public TokenInterceptor(UserRepository userRepository, UserService userService) {
		this.userRepository = userRepository;
		this.userService = userService;
	}

	@Override
	public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
		if (!(handler instanceof HandlerMethod) || isPublic(request)) {
			return true;
		}
		Auth.Session session;
		try {
			session = Auth.parseSession(request.getHeader("X-Auth-Token"));
		} catch (RuntimeException malformed) {
			throw new UnauthenticatedException("a valid X-Auth-Token header is required");
		}
		User user = userRepository.findById(session.id()).orElse(null);
		if (user == null || !Boolean.TRUE.equals(user.getEnable())
				|| session.role() != user.getRole() || !userService.hasSession(session.id(), session.secret())) {
			throw new UnauthenticatedException("the session is no longer valid");
		}
		RequireRole requiredRole = ((HandlerMethod) handler).getMethodAnnotation(RequireRole.class);
		if (requiredRole != null && requiredRole.value() != session.role()) {
			throw new ForbiddenException("this endpoint requires the " + requiredRole.value() + " role");
		}
		request.setAttribute(Auth.USER_ID_ATTRIBUTE, session.id());
		request.setAttribute(Auth.ROLE_ATTRIBUTE, session.role());
		return true;
	}

	private boolean isPublic(HttpServletRequest request) {
		String method = request.getMethod();
		String path = request.getRequestURI().substring(request.getContextPath().length());
		for (PublicRule rule : PUBLIC_RULES) {
			if (rule.method().matches(method) && pathMatcher.match(rule.pattern(), path)) {
				return true;
			}
		}
		return false;
	}
}
