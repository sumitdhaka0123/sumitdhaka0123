import React, { useEffect, useRef, useState } from 'react';

interface EmployeeMapProps {
  latitude: number;
  longitude: number;
  employeeName: string;
}

export default function EmployeeMap({ latitude, longitude, employeeName }: EmployeeMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [leafletLoaded, setLeafletLoaded] = useState(false);

  // Inject Leaflet CDN dynamically if not already present
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

  // Initialize and update map coordinates
  useEffect(() => {
    if (!leafletLoaded || !mapContainerRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    if (!mapRef.current) {
      // Create fresh map instance
      mapRef.current = L.map(mapContainerRef.current, {
        zoomControl: true,
        attributionControl: false
      }).setView([latitude, longitude], 15);

      // Add OpenStreetMap Tile Layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(mapRef.current);

      // Add visual custom pin with CSS-based pulse animation
      const customIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `
          <div class="relative flex items-center justify-center">
            <span class="absolute inline-flex h-12 w-12 animate-ping rounded-full bg-cyan-500 opacity-60"></span>
            <div class="relative flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 border-2 border-white shadow-xl text-white">
              <span class="text-xs">📍</span>
            </div>
          </div>
        `,
        iconSize: [48, 48],
        iconAnchor: [24, 24]
      });

      markerRef.current = L.marker([latitude, longitude], { icon: customIcon })
        .addTo(mapRef.current)
        .bindPopup(`
          <div class="p-1 font-sans">
            <div class="font-bold text-slate-800 text-xs">${employeeName}</div>
            <div class="text-[10px] text-slate-500 mt-0.5">Coordinates: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}</div>
          </div>
        `)
        .openPopup();
    } else {
      // Smoothly fly or pan to the updated coordinate
      mapRef.current.setView([latitude, longitude], 15);
      if (markerRef.current) {
        markerRef.current.setLatLng([latitude, longitude]);
        markerRef.current.getPopup().setContent(`
          <div class="p-1 font-sans">
            <div class="font-bold text-slate-800 text-xs">${employeeName}</div>
            <div class="text-[10px] text-slate-500 mt-0.5">Coordinates: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}</div>
          </div>
        `);
      }
    }

    // Force tile recalculation in case container transitions altered layout dimensions
    const resizeTimeout = setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    }, 250);

    return () => {
      clearTimeout(resizeTimeout);
    };
  }, [leafletLoaded, latitude, longitude, employeeName]);

  // Clean up Map instance on component destruction
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);

  return (
    <div className="relative w-full h-[320px] rounded-3xl overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center shadow-sm">
      {!leafletLoaded && (
        <div className="text-xs text-slate-500 flex items-center gap-2 animate-pulse font-sans">
          <span>🔄 Loading interactive map...</span>
        </div>
      )}
      <div ref={mapContainerRef} className="w-full h-full" style={{ visibility: leafletLoaded ? 'visible' : 'hidden' }} />
    </div>
  );
}
