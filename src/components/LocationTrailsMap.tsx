import React, { useEffect, useRef, useState } from 'react';

interface TrailPoint {
  latitude: number;
  longitude: number;
  timestamp: string;
}

interface LocationTrailsMapProps {
  history: TrailPoint[];
  employeeName: string;
}

export default function LocationTrailsMap({ history, employeeName }: LocationTrailsMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [leafletLoaded, setLeafletLoaded] = useState(false);

  // Load Leaflet CDN Assets dynamically if not already loaded globally
  useEffect(() => {
    if ((window as any).L) {
      setLeafletLoaded(true);
      return;
    }

    // Load CSS
    const linkId = 'leaflet-css';
    if (!document.getElementById(linkId)) {
      const link = document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    // Load JS Script
    const scriptId = 'leaflet-js';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => {
        setLeafletLoaded(true);
      };
      document.body.appendChild(script);
    } else {
      const checkInterval = setInterval(() => {
        if ((window as any).L) {
          setLeafletLoaded(true);
          clearInterval(checkInterval);
        }
      }, 100);
      return () => clearInterval(checkInterval);
    }
  }, []);

  // Set up and update Map path, markers, and boundaries
  useEffect(() => {
    if (!leafletLoaded || !mapContainerRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    if (history.length === 0) return;

    const coordinates = history.map(p => [p.latitude, p.longitude] as [number, number]);

    // 1. Initialize Map
    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current, {
        zoomControl: true,
        attributionControl: false
      }).setView(coordinates[0], 14);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(mapRef.current);
    }

    const map = mapRef.current;

    // Clear old map layers
    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    // 2. Draw connecting breadcrumb polyline
    if (coordinates.length > 1) {
      polylineRef.current = L.polyline(coordinates, {
        color: '#0891b2', // cyan-600
        weight: 4,
        opacity: 0.85,
        dashArray: '8, 8',
        lineJoin: 'round'
      }).addTo(map);
    }

    // 3. Draw markers for milestones
    history.forEach((point, idx) => {
      const isFirst = idx === 0;
      const isLatest = idx === history.length - 1;
      let markerColorClass = 'bg-cyan-500';
      let pinEmoji = '⚪';
      let pulseAnim = '';

      if (isFirst) {
        markerColorClass = 'bg-blue-600 border-2 border-white';
        pinEmoji = '🏁'; // start point
      } else if (isLatest) {
        markerColorClass = 'bg-emerald-500 border-2 border-white';
        pinEmoji = '🛰️'; // current / latest location
        pulseAnim = 'animate-ping';
      }

      const customIcon = L.divIcon({
        className: 'trail-div-icon',
        html: `
          <div class="relative flex items-center justify-center">
            ${isLatest ? `<span class="absolute inline-flex h-8 w-8 animate-ping rounded-full bg-emerald-400 opacity-60"></span>` : ''}
            <div class="relative flex h-6 w-6 items-center justify-center rounded-full ${markerColorClass} shadow-md text-white text-[10px] font-sans font-extrabold border border-white">
              ${isFirst || isLatest ? pinEmoji : idx + 1}
            </div>
            <div class="absolute top-7 bg-slate-900/90 text-[7px] font-sans font-bold text-white px-1.5 py-0.5 rounded border border-slate-700 whitespace-nowrap shadow-sm pointer-events-none">
              ${new Date(point.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
          </div>
        `,
        iconSize: [32, 40],
        iconAnchor: [16, 20]
      });

      const milestoneText = isFirst 
        ? '🏁 Start of 24h Trail' 
        : isLatest 
          ? '🛰️ Latest Telemetry Ping' 
          : `Milestone #${idx + 1}`;

      const popupHtml = `
        <div class="p-1.5 font-sans min-w-[150px]">
          <div class="text-[9px] font-extrabold uppercase tracking-wide text-cyan-600 mb-0.5">${milestoneText}</div>
          <div class="font-extrabold text-slate-800 text-xs">${employeeName}</div>
          <div class="mt-1.5 border-t border-slate-100 pt-1 space-y-0.5">
            <div class="text-[9px] text-slate-500 flex justify-between">
              <span>Time:</span>
              <span class="text-slate-800 font-medium">${new Date(point.timestamp).toLocaleString()}</span>
            </div>
            <div class="text-[9px] text-slate-500 flex justify-between">
              <span>Coordinates:</span>
              <span class="font-mono text-slate-700 font-bold">${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}</span>
            </div>
          </div>
        </div>
      `;

      const marker = L.marker([point.latitude, point.longitude], { icon: customIcon })
        .addTo(map)
        .bindPopup(popupHtml);

      markersRef.current.push(marker);
    });

    // 4. Zoom map to perfectly fit the breadcrumb bounds
    if (coordinates.length > 0) {
      if (coordinates.length === 1) {
        map.setView(coordinates[0], 15);
      } else {
        const bounds = L.latLngBounds(coordinates);
        map.fitBounds(bounds.pad(0.18), { animate: true });
      }
    }

    // Recalculate sizes to prevent container rendering issues
    const timeout = setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => {
      clearTimeout(timeout);
    };
  }, [leafletLoaded, history, employeeName]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <div className="relative w-full h-[380px] rounded-3xl overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center shadow-inner no-print">
      {!leafletLoaded && (
        <div className="text-xs text-slate-500 flex items-center gap-2 animate-pulse font-sans font-bold">
          <span>🛰️ Deploying historical route maps...</span>
        </div>
      )}
      <div ref={mapContainerRef} className="w-full h-full" style={{ visibility: leafletLoaded ? 'visible' : 'hidden' }} />
    </div>
  );
}
