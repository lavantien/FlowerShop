package com.lavantien.flowershop.api.type;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;

@Entity
public class Type {
	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;
	private String name;
	private String categoryName;

	public Type() {
	}

	public Type(String name, String categoryName) {
		this.name = name;
		this.categoryName = categoryName;
	}

	@Override
	public String toString() {
		return "Type{" +
			"id=" + id +
			", name='" + name + '\'' +
			", categoryName='" + categoryName + '\'' +
			'}';
	}

	public Long getId() {
		return id;
	}

	public void setId(Long id) {
		this.id = id;
	}

	public String getName() {
		return name;
	}

	public void setName(String name) {
		this.name = name;
	}

	public String getCategoryName() {
		return categoryName;
	}

	public void setCategoryName(String categoryName) {
		this.categoryName = categoryName;
	}
}
