package com.lavantien.flowershop.api.security;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.ViewControllerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.ArrayList;
import java.util.List;

@Configuration
public class WebConfig implements WebMvcConfigurer {
	// Locked decision 14: every GET whose segments carry no dot and whose
	// first segment is not api forwards to the SPA index, so new Angular
	// routes work without backend edits. Dotted paths stay with the static
	// handler, unmatched /api paths keep 404ing in the dispatcher.
	private static final int SPA_MAX_DEPTH = 4;
	private static final List<String> SPA_CATCH_ALL = catchAllPatterns(SPA_MAX_DEPTH);

	private final TokenInterceptor tokenInterceptor;

	public WebConfig(TokenInterceptor tokenInterceptor) {
		this.tokenInterceptor = tokenInterceptor;
	}

	@Override
	public void addInterceptors(InterceptorRegistry registry) {
		registry.addInterceptor(tokenInterceptor).addPathPatterns("/api/**");
	}

	@Override
	public void addViewControllers(ViewControllerRegistry registry) {
		registry.addViewController("/").setViewName("forward:/index.html");
		for (String pattern : SPA_CATCH_ALL) {
			registry.addViewController(pattern).setViewName("forward:/index.html");
		}
	}

	static List<String> catchAllPatterns(int maxDepth) {
		List<String> patterns = new ArrayList<>(maxDepth);
		StringBuilder pattern = new StringBuilder();
		for (int depth = 1; depth <= maxDepth; depth++) {
			pattern.append(depth == 1 ? "/{first:^(?!api$)[^\\.]+}" : "/{p" + depth + ":[^\\.]+}");
			patterns.add(pattern.toString());
		}
		return patterns;
	}
}
