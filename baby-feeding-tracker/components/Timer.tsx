"use client";

import { useState, useEffect, useRef } from "react";

interface TimerProps {
  isRunning: boolean;
  startTime: Date | null;
}

export default function Timer({ isRunning, startTime }: TimerProps) {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isRunning && startTime) {
      intervalRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTime.getTime()) / 1000));
      }, 1000);
    } else {
      setElapsed(0);
    }
    return () => {
      if (intervalRef.current && typeof intervalRef.current !== "number") {
          clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, startTime]);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  return (
    <div className="text-center my-8">
      <div className="text-7xl font-bold text-[#6B8CAE] tabular-nums tracking-wider">
        {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
      </div>
      <p className="text-sm text-gray-400 mt-2">
        {isRunning ? "מודד זמן..." : "לחץ כדי להתחיל"}
      </p>
    </div>
  );
}