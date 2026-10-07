package com.lavantien.flowershop.api.security;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.ViewControllerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.List;

@Configuration
public class WebConfig implements WebMvcConfigurer {
	// The Angular routes that exist as deep links; /test is left out on purpose.
	private static final List<String> SPA_ROUTES = List.of("/", "/shop", "/contact", "/admin", "/info", "/summary");

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
		for (String route : SPA_ROUTES) {
			registry.addViewController(route).setViewName("forward:/index.html");
		}
	}
}
