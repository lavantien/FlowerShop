package com.lavantien.flowershop.api.security;

import com.lavantien.flowershop.api.user.User;

public record SessionView(String token, User user) {}
