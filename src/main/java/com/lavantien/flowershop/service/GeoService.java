package com.lavantien.flowershop.service;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.lavantien.flowershop.api.branch.Branch;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class GeoService {
	public record Point(double lat, double lng) {}

	record CityPoint(String name, double lat, double lng) {}

	record DistrictPoint(String name, String cityName, double lat, double lng) {}

	record GeoData(@JsonProperty("default") Point defaultPoint, List<CityPoint> cities, List<DistrictPoint> districts) {}

	private static final ObjectMapper MAPPER = new ObjectMapper();
	private static final double EARTH_RADIUS_KM = 6371.0088;

	private final Map<String, Point> districts = new HashMap<>();
	private final Map<String, Point> cities = new HashMap<>();
	private final Point defaultPoint;
	private final ShopProperties.Delivery delivery;

	@Autowired
	public GeoService(ShopProperties properties) {
		this("geo/vn-geo.json", properties);
	}

	GeoService(String resourcePath, ShopProperties properties) {
		this(parse(open(resourcePath)), properties);
	}

	GeoService(GeoData data, ShopProperties properties) {
		for (CityPoint city : data.cities()) {
			cities.put(city.name(), new Point(city.lat(), city.lng()));
		}
		for (DistrictPoint district : data.districts()) {
			districts.put(district.name(), new Point(district.lat(), district.lng()));
		}
		this.defaultPoint = data.defaultPoint();
		this.delivery = properties.delivery();
	}

	static GeoData parse(InputStream in) {
		try (in) {
			return MAPPER.readValue(in, GeoData.class);
		} catch (IOException | RuntimeException broken) {
			throw new IllegalStateException("the geo data is malformed", broken);
		}
	}

	private static InputStream open(String resourcePath) {
		try {
			return new ClassPathResource(resourcePath).getInputStream();
		} catch (IOException missing) {
			throw new IllegalStateException(resourcePath + " is missing from the classpath", missing);
		}
	}

	public Point resolve(String district, String city) {
		if (district != null) {
			Point point = districts.get(district);
			if (point != null) {
				return point;
			}
		}
		if (city != null) {
			Point point = cities.get(city);
			if (point != null) {
				return point;
			}
		}
		return defaultPoint;
	}

	public double distanceKm(Point from, Point to) {
		double latDelta = Math.toRadians(to.lat() - from.lat());
		double lngDelta = Math.toRadians(to.lng() - from.lng());
		double sinLat = Math.sin(latDelta / 2);
		double sinLng = Math.sin(lngDelta / 2);
		double a = sinLat * sinLat
			+ Math.cos(Math.toRadians(from.lat())) * Math.cos(Math.toRadians(to.lat())) * sinLng * sinLng;
		double raw = 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
		return Math.ceil(raw * 10) / 10;
	}

	public long deliveryFee(double distanceKm) {
		BigDecimal raw = BigDecimal.valueOf(delivery.baseFee())
			.add(BigDecimal.valueOf(delivery.perKm()).multiply(BigDecimal.valueOf(distanceKm)));
		return delivery.round(raw.min(BigDecimal.valueOf(delivery.maxFee()))).longValueExact();
	}

	public Branch nearestBranch(List<Branch> branches, Point target) {
		List<Branch> eligible = branches.stream()
			.filter(branch -> Boolean.TRUE.equals(branch.getActive())
				&& branch.getLat() != null && branch.getLng() != null)
			.toList();
		Branch nearest = null;
		double nearestDistance = Double.POSITIVE_INFINITY;
		for (Branch branch : eligible) {
			double distance = distanceKm(new Point(branch.getLat(), branch.getLng()), target);
			if (distance < nearestDistance
					|| (distance == nearestDistance && branch.getId() < nearest.getId())) {
				nearest = branch;
				nearestDistance = distance;
			}
		}
		return nearest;
	}

	Set<String> knownDistricts() {
		return districts.keySet();
	}

	Set<String> knownCities() {
		return cities.keySet();
	}
}
