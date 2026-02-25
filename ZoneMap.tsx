import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import type { ZoneResult } from '../types.ts';

// Use the correct API base URL (same as api.ts)
const API_BASE = (import.meta as any).env?.VITE_API_URL || '/api';

interface ZoneMapProps {
  zoneResults?: ZoneResult[];
  height?: string;
  className?: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  vert: '#22c55e',
  orange: '#f59e0b',
  rouge: '#ef4444',
  default: '#94a3b8',
};

export default function ZoneMap({ zoneResults, height = '420px', className = '' }: ZoneMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors',
          },
        },
        layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
      },
      center: [7.363, 46.232],
      zoom: 12.5,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update zone layers when results change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const updateLayers = () => {
      // Load zones GeoJSON
      fetch(`${API_BASE}/data`)
        .then(r => r.json())
        .then((data: any) => {
          const geojson = data.zones;
          if (!geojson) return;

          // Add result data to features
          const enriched = {
            ...geojson,
            features: geojson.features.map((f: any) => {
              const zoneId = f.properties.zoneId;
              const result = zoneResults?.find(r => r.zoneId === zoneId);
              return {
                ...f,
                properties: {
                  ...f.properties,
                  category: result?.category || 'default',
                  elasticityScore: result?.elasticityScore || 0,
                  shiftIndex: result ? (result.shiftIndex * 100).toFixed(0) + '%' : '—',
                  equityFlag: result?.equityFlag || false,
                },
              };
            }),
          };

          // Remove existing layers/sources
          if (map.getLayer('zones-fill')) map.removeLayer('zones-fill');
          if (map.getLayer('zones-outline')) map.removeLayer('zones-outline');
          if (map.getLayer('zones-labels')) map.removeLayer('zones-labels');
          if (map.getSource('zones')) map.removeSource('zones');

          map.addSource('zones', { type: 'geojson', data: enriched });

          map.addLayer({
            id: 'zones-fill',
            type: 'fill',
            source: 'zones',
            paint: {
              'fill-color': [
                'match', ['get', 'category'],
                'vert', '#22c55e',
                'orange', '#f59e0b',
                'rouge', '#ef4444',
                '#94a3b8',
              ],
              'fill-opacity': zoneResults ? 0.35 : 0.15,
            },
          });

          map.addLayer({
            id: 'zones-outline',
            type: 'line',
            source: 'zones',
            paint: {
              'line-color': [
                'match', ['get', 'category'],
                'vert', '#16a34a',
                'orange', '#d97706',
                'rouge', '#dc2626',
                '#64748b',
              ],
              'line-width': 1.5,
              'line-opacity': 0.7,
            },
          });

          // Labels
          map.addLayer({
            id: 'zones-labels',
            type: 'symbol',
            source: 'zones',
            layout: {
              'text-field': ['get', 'label'],
              'text-size': 11,
              'text-font': ['Open Sans Regular'],
              'text-anchor': 'center',
            },
            paint: {
              'text-color': '#0f1117',
              'text-halo-color': '#ffffff',
              'text-halo-width': 2,
            },
          });

          // Popups on click
          map.on('click', 'zones-fill', (e) => {
            if (!e.features?.[0]) return;
            const props = e.features[0].properties;
            const result = zoneResults?.find(r => r.zoneId === props.zoneId);

            new maplibregl.Popup({ closeButton: true, maxWidth: '260px' })
              .setLngLat(e.lngLat)
              .setHTML(`
                <div style="font-family: 'DM Sans', sans-serif; padding: 4px;">
                  <div style="font-weight: 600; font-size: 14px; margin-bottom: 6px;">${props.label}</div>
                  ${result ? `
                    <div style="display:flex; gap: 8px; flex-wrap: wrap; margin-bottom: 6px;">
                      <span style="background: ${CATEGORY_COLORS[result.category]}20; color: ${CATEGORY_COLORS[result.category]}; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 12px; border: 1px solid ${CATEGORY_COLORS[result.category]}40;">
                        ${result.category.toUpperCase()}
                      </span>
                    </div>
                    <div style="font-size: 12px; color: #374151;">
                      <div>Élasticité: <strong>${result.elasticityScore}/100</strong></div>
                      <div>Shift modal: <strong>${(result.shiftIndex * 100).toFixed(0)}%</strong></div>
                      ${result.estimatedThreshold ? `<div>Seuil bascule: <strong>~${result.estimatedThreshold.toFixed(1)} CHF/h</strong></div>` : ''}
                      ${result.equityFlag ? `<div style="color:#ef4444; margin-top:4px;">⚠ Risque équité détecté</div>` : ''}
                    </div>
                  ` : `<div style="font-size: 12px; color: #6b7280;">${props.description}</div>`}
                </div>
              `)
              .addTo(map);
          });

          map.on('mouseenter', 'zones-fill', () => {
            map.getCanvas().style.cursor = 'pointer';
          });
          map.on('mouseleave', 'zones-fill', () => {
            map.getCanvas().style.cursor = '';
          });
        })
        .catch(console.error);
    };

    if (map.isStyleLoaded()) {
      updateLayers();
    } else {
      map.on('load', updateLayers);
    }
  }, [zoneResults]);

  return (
    <div
      ref={containerRef}
      className={`rounded-xl overflow-hidden ${className}`}
      style={{ height }}
    />
  );
}
