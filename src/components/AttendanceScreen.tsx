import React, { useState, useEffect } from 'react';
import { Geolocation } from '@capacitor/geolocation';

export function AttendanceScreen({ currentUser }: { currentUser: any }) {
  const [clockedIn, setClockedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [watchId, setWatchId] = useState<string | null>(null);

  useEffect(() => {
    // Check if they are already clocked in by fetching their latest log from the server
    fetch('/api/attendance')
      .then(res => res.json())
      .then(data => {
        const myLogs = data.filter((l: any) => l.username === currentUser.username);
        const lastLog = myLogs[myLogs.length - 1];
        if (lastLog && !lastLog.clockOutTime) {
          setClockedIn(true);
          startTracking(); // resume tracking
        }
      });
  }, []);

  const requestPermissions = async () => {
    try {
      const status = await Geolocation.requestPermissions();
      return status.location === 'granted';
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const startTracking = async () => {
    try {
      const id = await Geolocation.watchPosition({ enableHighAccuracy: true }, (pos, err) => {
        if (pos) {
          fetch('/api/locations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: currentUser.username,
              operatorName: currentUser.name,
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              timestamp: new Date().toISOString()
            })
          });
        }
      });
      setWatchId(id);
    } catch (e) {
      console.error('Error starting tracker', e);
    }
  };

  const stopTracking = () => {
    if (watchId) {
      Geolocation.clearWatch({ id: watchId });
      setWatchId(null);
    }
  };

  const handleClockIn = async () => {
    setLoading(true);
    const hasPerms = await requestPermissions();
    if (!hasPerms) {
      alert("Location permission is required to clock in.");
      setLoading(false);
      return;
    }

    try {
      await fetch('/api/attendance/clock-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: currentUser.username,
          operatorName: currentUser.name,
          clockInTime: new Date().toISOString()
        })
      });
      setClockedIn(true);
      await startTracking();
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleClockOut = async () => {
    setLoading(true);
    try {
      await fetch('/api/attendance/clock-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: currentUser.username,
          clockOutTime: new Date().toISOString()
        })
      });
      setClockedIn(false);
      stopTracking();
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-8 bg-gray-900 text-white rounded-xl p-8 shadow-2xl">
      <h1 className="text-3xl font-bold tracking-wider">Attendance</h1>
      <p className="text-gray-400 text-center mb-8">
        Please clock in to start your shift. You must allow location access to verify your presence.
      </p>

      {!clockedIn ? (
        <button 
          onClick={handleClockIn}
          disabled={loading}
          className="w-64 h-64 rounded-full bg-green-500 hover:bg-green-400 flex items-center justify-center text-4xl font-black shadow-[0_0_50px_rgba(34,197,94,0.5)] transition-all transform hover:scale-105 active:scale-95"
        >
          CLOCK IN
        </button>
      ) : (
        <button 
          onClick={handleClockOut}
          disabled={loading}
          className="w-64 h-64 rounded-full bg-red-500 hover:bg-red-400 flex items-center justify-center text-4xl font-black shadow-[0_0_50px_rgba(239,68,68,0.5)] transition-all transform hover:scale-105 active:scale-95"
        >
          CLOCK OUT
        </button>
      )}

      {clockedIn && (
        <p className="text-green-400 font-medium animate-pulse mt-8">
          ● Shift Active & Recording
        </p>
      )}
    </div>
  );
}
