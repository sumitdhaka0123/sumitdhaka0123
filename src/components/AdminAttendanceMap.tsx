import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Clock, MapPin } from 'lucide-react';

// Fix Leaflet's default icon path issues
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

export function AdminAttendanceMap() {
  const [activeTab, setActiveTab] = useState<'map'|'logs'>('map');
  const [locations, setLocations] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    // Poll for live locations and attendance logs every 30 seconds
    const fetchData = async () => {
      try {
        const [locRes, logRes] = await Promise.all([
          fetch('/api/locations'),
          fetch('/api/attendance')
        ]);
        const locData = await locRes.json();
        const logData = await logRes.json();
        
        // Convert live locations object to array
        const locArray = Object.values(locData || {});
        setLocations(locArray);
        
        // Sort logs newest first
        const sortedLogs = (logData || []).sort((a: any, b: any) => 
          new Date(b.clockInTime).getTime() - new Date(a.clockInTime).getTime()
        );
        setLogs(sortedLogs);
      } catch (e) {
        console.error("Error fetching map data", e);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full max-w-6xl mx-auto p-4 bg-gray-900 rounded-xl text-white shadow-2xl mt-8">
      <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-4">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
          Live Employee Tracking
        </h2>
        <div className="flex space-x-2">
          <button 
            onClick={() => setActiveTab('map')}
            className={`px-4 py-2 flex items-center space-x-2 rounded-lg font-medium transition-colors ${activeTab === 'map' ? 'bg-emerald-500 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
          >
            <MapPin size={18} />
            <span>Live Map</span>
          </button>
          <button 
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-2 flex items-center space-x-2 rounded-lg font-medium transition-colors ${activeTab === 'logs' ? 'bg-blue-500 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
          >
            <Clock size={18} />
            <span>Attendance Logs</span>
          </button>
        </div>
      </div>

      <div className="w-full h-[600px] rounded-xl overflow-hidden border border-gray-700 bg-gray-800">
        {activeTab === 'map' ? (
          <MapContainer center={[28.7041, 77.1025]} zoom={11} style={{ height: '100%', width: '100%', background: '#1f2937' }}>
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            />
            {locations.map((loc: any, i) => (
              <Marker key={i} position={[loc.latitude, loc.longitude]}>
                <Popup>
                  <div className="font-bold text-gray-900">{loc.operatorName}</div>
                  <div className="text-sm text-gray-600">Updated: {new Date(loc.timestamp).toLocaleTimeString()}</div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        ) : (
          <div className="overflow-auto h-full p-4">
            <table className="w-full text-left">
              <thead className="bg-gray-800 sticky top-0 border-b border-gray-700 text-gray-400">
                <tr>
                  <th className="p-3">Employee</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Clock In</th>
                  <th className="p-3">Clock Out</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log: any) => (
                  <tr key={log.id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                    <td className="p-3 font-medium">{log.operatorName}</td>
                    <td className="p-3">{new Date(log.clockInTime).toLocaleDateString()}</td>
                    <td className="p-3 text-emerald-400">{new Date(log.clockInTime).toLocaleTimeString()}</td>
                    <td className="p-3 text-red-400">
                      {log.clockOutTime ? new Date(log.clockOutTime).toLocaleTimeString() : '--'}
                    </td>
                    <td className="p-3">
                      {!log.clockOutTime ? (
                        <span className="px-2 py-1 rounded text-xs font-bold bg-green-500/20 text-green-400 border border-green-500/30">
                          Active Now
                        </span>
                      ) : (
                        <span className="text-gray-500 text-sm">Completed</span>
                      )}
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-500">No attendance records found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
