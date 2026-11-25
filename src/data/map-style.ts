import type { StyleSpecification } from '@maplibre/maplibre-react-native'
import { mapPalette, type MapPalette } from '@/lib/map-palette'

/**
 * Подложка карты рынка (OpenStreetMap) — рынок поверх неё рисуют слои из lib/market-cell-layers.
 * Тайлы — OpenFreeMap (OpenStreetMap, OpenMapTiles): бесплатные, без ключа и лимитов.
 * Атрибуция обязательна: «OpenFreeMap © OpenMapTiles Data from OpenStreetMap».
 */
export function marketMapStyle(p: MapPalette = mapPalette): StyleSpecification {
	return {
		version: 8,
		name: 'Кудайберген',
		glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
		// мягкий тёплый свет: бока коробок темнее крыш, цвета не плывут
		light: { anchor: 'viewport', color: p.light.color, intensity: p.light.intensity, position: [1.3, 210, 32] },
		sources: {
			openmaptiles: {
				type: 'vector',
				url: 'https://tiles.openfreemap.org/planet',
			},
		},
		layers: [
			{ id: 'background', type: 'background', paint: { 'background-color': p.ground } },
			{
				id: 'landuse-block',
				type: 'fill',
				source: 'openmaptiles',
				'source-layer': 'landuse',
				filter: ['in', 'class', 'residential', 'commercial', 'industrial', 'retail'],
				paint: { 'fill-color': p.block },
			},
			{
				id: 'landcover-green',
				type: 'fill',
				source: 'openmaptiles',
				'source-layer': 'landcover',
				filter: ['in', 'class', 'grass', 'wood', 'scrub'],
				paint: { 'fill-color': p.green },
			},
			{ id: 'park', type: 'fill', source: 'openmaptiles', 'source-layer': 'park', paint: { 'fill-color': p.green } },
			{ id: 'water', type: 'fill', source: 'openmaptiles', 'source-layer': 'water', paint: { 'fill-color': p.water } },
			{
				id: 'road-casing',
				type: 'line',
				source: 'openmaptiles',
				'source-layer': 'transportation',
				filter: ['!in', 'class', 'path', 'track', 'ferry'],
				layout: { 'line-cap': 'round', 'line-join': 'round' },
				paint: {
					'line-color': p.roadCasing,
					'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 12, 3, 16, 14, 19, 36],
				},
			},
			{
				id: 'road',
				type: 'line',
				source: 'openmaptiles',
				'source-layer': 'transportation',
				filter: ['!in', 'class', 'path', 'track', 'ferry'],
				layout: { 'line-cap': 'round', 'line-join': 'round' },
				paint: {
					'line-color': p.road,
					'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 12, 1.5, 16, 11, 19, 31],
				},
			},
			{
				// тень домов на земле — сдвинута от солнца, даёт глубину даже сверху
				id: 'building-shadow',
				type: 'fill',
				source: 'openmaptiles',
				'source-layer': 'building',
				minzoom: 14,
				paint: {
					'fill-color': p.buildingShadow,
					'fill-translate': ['interpolate', ['linear'], ['zoom'], 14, ['literal', [1, 1.5]], 18, ['literal', [6, 9]]],
					'fill-translate-anchor': 'map',
					'fill-antialias': false,
				},
			},
			{
				// дома вокруг рынка — объёмные; чем выше, тем светлее крыша
				id: 'building',
				type: 'fill-extrusion',
				source: 'openmaptiles',
				'source-layer': 'building',
				minzoom: 14,
				paint: {
					'fill-extrusion-color': [
						'interpolate',
						['linear'],
						['coalesce', ['get', 'render_height'], 6],
						0,
						p.building,
						30,
						p.buildingTop,
					],
					'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 14, 0, 15, ['coalesce', ['get', 'render_height'], 6]],
					'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
					'fill-extrusion-opacity': 0.92,
					'fill-extrusion-vertical-gradient': true,
				},
			},
			{
				id: 'road-label',
				type: 'symbol',
				source: 'openmaptiles',
				'source-layer': 'transportation_name',
				minzoom: 14,
				layout: {
					'symbol-placement': 'line',
					'text-field': ['get', 'name'],
					'text-font': ['Noto Sans Regular'],
					'text-size': 11,
					'text-letter-spacing': 0.18,
				},
				paint: { 'text-color': p.roadLabel, 'text-halo-color': p.roadLabelHalo, 'text-halo-width': 1.4 },
			},
			{
				id: 'place-label',
				type: 'symbol',
				source: 'openmaptiles',
				'source-layer': 'place',
				filter: ['in', 'class', 'city', 'town', 'village', 'suburb', 'neighbourhood'],
				layout: {
					'text-field': ['get', 'name'],
					'text-font': ['Noto Sans Bold'],
					'text-size': 12,
					'text-transform': 'uppercase',
					'text-letter-spacing': 0.22,
				},
				paint: { 'text-color': p.roadLabel, 'text-halo-color': p.roadLabelHalo, 'text-halo-width': 1.4 },
			},
		],
	}
}
