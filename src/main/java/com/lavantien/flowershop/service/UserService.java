package com.lavantien.flowershop.service;

import org.springframework.stereotype.Service;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

@Service
public class UserService {
	public List<Long> loggedInIds = new CopyOnWriteArrayList<>();
}
