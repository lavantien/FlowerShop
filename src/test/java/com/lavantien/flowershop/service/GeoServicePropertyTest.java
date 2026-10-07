package com.lavantien.flowershop.service;

import com.lavantien.flowershop.SeededGenerator;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

// Property view of the geo half of GeoService: haversine symmetry, the zero
// self-distance, a sane half-circumference on antipodes, the tenth-of-a-km
// ceiling everywhere, and the district-city-default fallback chain over the
// real vn-geo.json dataset.
class GeoServicePropertyTest {
	private static final long SEED = 20261008L;
	// Half circumference for R = 6371.0088: pi * R = 20015.1144 km, which the
	// tenth ceiling always lifts to 20015.2.
	private static final double HALF_CIRCUMFERENCE_KM = 20015.2;

	private final SeededGenerator gen = new SeededGenerator(SEED);
	private final GeoService geoService = new GeoService(new ShopProperties(
		new ShopProperties.Delivery(20000, 5000, 200000, 1000),
		new ShopProperties.Payment("dev-only-secret", "/pay")));

	private static GeoService.Point antipode(GeoService.Point point) {
		return new GeoService.Point(-point.lat(), point.lng() <= 0 ? point.lng() + 180 : point.lng() - 180);
	}

	// Hanoi's numeric district names ("1" to "12") are reachable by the plain
	// string generator, so redraw until the candidate matches nothing known.
	private String unknownName() {
		String candidate = gen.string(20);
		while (geoService.knownDistricts().contains(candidate) || geoService.knownCities().contains(candidate)) {
			candidate = gen.string(20);
		}
		return candidate;
	}

	@Test
	void haversineIsSymmetricInItsTwoArguments() {
		for (int i = 0; i < 400; i++) {
			double[] first = gen.coordinate();
			double[] second = gen.coordinate();
			GeoService.Point a = new GeoService.Point(first[0], first[1]);
			GeoService.Point b = new GeoService.Point(second[0], second[1]);
			assertEquals(geoService.distanceKm(a, b), geoService.distanceKm(b, a),
				"distance is not symmetric for " + a + " and " + b);
		}
	}

	@Test
	void everyPointIsAtDistanceZeroFromItself() {
		for (int i = 0; i < 200; i++) {
			GeoService.Point point = new GeoService.Point(gen.coordinate()[0], gen.coordinate()[1]);
			assertEquals(0.0, geoService.distanceKm(point, point), "self-distance is not zero for " + point);
		}
	}

	@Test
	void antipodesSitOneHalfCircumferenceApart() {
		for (int i = 0; i < 150; i++) {
			GeoService.Point point = new GeoService.Point(gen.coordinate()[0], gen.coordinate()[1]);
			assertEquals(HALF_CIRCUMFERENCE_KM, geoService.distanceKm(point, antipode(point)),
				"antipode of " + point + " is not half a circumference away");
		}
	}

	@Test
	void everyDistanceStaysOnTheTenthOfAKilometerGrid() {
		for (int i = 0; i < 400; i++) {
			double[] first = gen.coordinate();
			double[] second = gen.coordinate();
			double km = geoService.distanceKm(new GeoService.Point(first[0], first[1]),
				new GeoService.Point(second[0], second[1]));
			assertTrue(Math.abs(km * 10 - Math.round(km * 10)) < 1e-6,
				"distance " + km + " km is not a whole tenth");
		}
	}

	@Test
	void resolveFallsBackFromDistrictToCityToDefault() {
		GeoService.Point fallback = geoService.resolve(null, null);
		for (String district : geoService.knownDistricts()) {
			GeoService.Point expected = geoService.resolve(district, null);
			assertEquals(expected, geoService.resolve(district, unknownName()),
				"a known district must win over an unknown city");
			assertEquals(expected, geoService.resolve(district, null));
		}
		for (String city : geoService.knownCities()) {
			GeoService.Point expected = geoService.resolve(null, city);
			assertEquals(expected, geoService.resolve(unknownName(), city),
				"a known city must win over an unknown district");
		}
		for (int i = 0; i < 120; i++) {
			assertEquals(fallback, geoService.resolve(unknownName(), unknownName()),
				"an unknown pair must land on the default point");
			assertEquals(fallback, geoService.resolve(null, unknownName()));
		}
	}
}
