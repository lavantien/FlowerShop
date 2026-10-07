package com.lavantien.flowershop.api.security;

import com.lavantien.flowershop.api.user.UserView;

public record SessionView(String token, UserView user) {}
