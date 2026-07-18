import React, { useEffect, useRef, useState } from 'react';

interface TrackingEmployee {
  id: string;
  name: string;
  username: string;
  role: string;
  latitude?: number;
  longitude?: number;
  locationTimestamp?: string;
}

interface StaffUnifiedMapProps {
  employees: TrackingEmployee[];
  focusedEmployeeId: string | null;
  onSelectEmployee: (id: string) => void;
}

export default function StaffUnifiedMap({ employees, focusedEmployeeId, onSelectEmployee }: StaffUnifiedMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<{ [key: string]: any }>({});
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

  // Sync and plot all active employees
  useEffect(() => {
    if (!leafletLoaded || !mapContainerRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    // Filter employees with valid geolocation coordinates
    const activeEmployees = employees.filter(e => e.latitude !== undefined && e.longitude !== undefined);

    // Default center to Delhi, India (or first active employee)
    let centerLat = 28.6139;
    let centerLng = 77.2090;

    if (activeEmployees.length > 0) {
      // Focus on the explicitly focused employee, or calculate average
      const focusedEmp = activeEmployees.find(e => e.id === focusedEmployeeId);
      if (focusedEmp && focusedEmp.latitude !== undefined && focusedEmp.longitude !== undefined) {
        centerLat = focusedEmp.latitude;
        centerLng = focusedEmp.longitude;
      } else {
        centerLat = activeEmployees[0].latitude!;
        centerLng = activeEmployees[0].longitude!;
      }
    }

    // 1. Initialize map instance
    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current, {
        zoomControl: true,
        attributionControl: false
      }).setView([centerLat, centerLng], 12);

      // Add high contrast elegant tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(mapRef.current);
    }

    const map = mapRef.current;

    // 2. Diff and update map markers
    const currentMarkerIds = new Set(Object.keys(markersRef.current));
    const activeEmpIds = new Set(activeEmployees.map(e => e.id));

    // Remove stale markers
    currentMarkerIds.forEach(id => {
      if (!activeEmpIds.has(id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });

    // Add or update active markers
    activeEmployees.forEach(emp => {
      const { id, name, username, role, latitude, longitude, locationTimestamp } = emp;
      if (latitude === undefined || longitude === undefined) return;

      const isFocused = id === focusedEmployeeId;
      const isSales = role === 'salesperson';
      
      // Distinct visual styles: Cyan for Assembly, Emerald/Orange for Sales
      const badgeColor = isSales ? 'bg-orange-500' : 'bg-cyan-500';
      const labelText = isSales ? '💼 Sales' : '🛠️ Assembly';
      const pulseColor = isSales ? 'bg-orange-400' : 'bg-cyan-400';

      const customIcon = L.divIcon({
        className: 'custom-staff-icon',
        html: `
          <div class="relative flex items-center justify-center transition-all duration-300 transform ${isFocused ? 'scale-125 z-[1000]' : 'hover:scale-110'}">
            <span class="absolute inline-flex h-10 w-10 animate-ping rounded-full ${pulseColor} opacity-50"></span>
            <div class="relative flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 border-2 ${isFocused ? 'border-amber-400' : 'border-white'} shadow-lg text-white">
              <span class="text-[11px]">${isSales ? '💼' : '🛠️'}</span>
            </div>
            <div class="absolute -bottom-7 bg-slate-900/90 text-[8px] font-sans font-extrabold text-white px-2 py-0.5 rounded-md border border-slate-700 whitespace-nowrap shadow-sm">
              ${name.split(' ')[0]}
            </div>
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      });

      const popupHtml = `
        <div class="p-1.5 font-sans min-w-[160px]">
          <div class="flex items-center gap-1.5 mb-1">
            <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span class="text-[9px] font-extrabold ${isSales ? 'text-orange-600' : 'text-cyan-600'} uppercase tracking-wide">${labelText}</span>
          </div>
          <div class="font-extrabold text-slate-800 text-xs">${name}</div>
          <div class="text-[9px] text-slate-500 mt-0.5">@${username}</div>
          <div class="mt-2 border-t border-slate-100 pt-1.5 space-y-1">
            <div class="text-[9px] text-slate-500 flex justify-between">
              <span>Coords:</span>
              <span class="font-mono text-slate-700 font-bold">${latitude.toFixed(5)}, ${longitude.toFixed(5)}</span>
            </div>
            ${locationTimestamp ? `
              <div class="text-[9px] text-slate-500 flex flex-col mt-1">
                <span>Last active ping:</span>
                <span class="font-sans text-slate-700 font-bold mt-0.5">${new Date(locationTimestamp).toLocaleString()}</span>
              </div>
            ` : ''}
          </div>
        </div>
      `;

      if (markersRef.current[id]) {
        // Update position and popup
        const marker = markersRef.current[id];
        marker.setLatLng([latitude, longitude]);
        marker.setIcon(customIcon);
        marker.getPopup().setContent(popupHtml);
      } else {
        // Create new marker
        const marker = L.marker([latitude, longitude], { icon: customIcon })
          .addTo(map)
          .bindPopup(popupHtml);

        // Click marker selection handler
        marker.on('click', () => {
          onSelectEmployee(id);
        });

        markersRef.current[id] = marker;
      }
    });

    // 3. Pan/Zoom to focused employee if specified
    if (focusedEmployeeId && markersRef.current[focusedEmployeeId]) {
      const targetMarker = markersRef.current[focusedEmployeeId];
      const targetLatLng = targetMarker.getLatLng();
      map.flyTo(targetLatLng, 14, {
        animate: true,
        duration: 1.5
      });
      setTimeout(() => {
        if (targetMarker) {
          targetMarker.openPopup();
        }
      }, 1000);
    } else if (activeEmployees.length > 0 && !focusedEmployeeId) {
      // Auto-fit bounds to see everyone on initial load
      const group = L.featureGroup(Object.values(markersRef.current));
      map.fitBounds(group.getBounds().pad(0.15));
    }

    // Invalidate size in case layout or tab changes altered sizes
    const resizeTimeout = setTimeout(() => {
      map.invalidateSize();
    }, 300);

    return () => {
      clearTimeout(resizeTimeout);
    };
  }, [leafletLoaded, employees, focusedEmployeeId]);

  // Cleanup on map unmount
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markersRef.current = {};
      }
    };
  }, []);

  return (
    <div className="relative w-full h-[480px] rounded-3xl overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center shadow-inner">
      {!leafletLoaded && (
        <div className="text-xs text-slate-500 flex items-center gap-2 animate-pulse font-sans font-bold">
          <span>🛰️ Deploying interactive tracking grid satellites...</span>
        </div>
      )}
      <div ref={mapContainerRef} className="w-full h-full" style={{ visibility: leafletLoaded ? 'visible' : 'hidden' }} />
    </div>
  );
}
