import { useState, useRef, useCallback } from "react";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AnalogClockPickerProps {
  value: string;
  onChange: (time: string) => void;
  testIdPrefix?: string;
}

type Mode = "hour" | "minute" | "period";

export function AnalogClockPicker({ value, onChange, testIdPrefix = "" }: AnalogClockPickerProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("hour");
  
  const parsed = parseTime(value);
  const [selectedHour, setSelectedHour] = useState(parsed.hour);
  const [selectedMinute, setSelectedMinute] = useState(parsed.minute);
  const [selectedPeriod, setSelectedPeriod] = useState<"AM" | "PM">(parsed.period);
  const clockRef = useRef<SVGSVGElement>(null);

  function parseTime(timeStr: string): { hour: number; minute: number; period: "AM" | "PM" } {
    if (!timeStr) return { hour: 12, minute: 0, period: "PM" };
    const [h, m] = timeStr.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return { hour: hour12, minute: m || 0, period };
  }

  function to24(hour: number, period: "AM" | "PM"): number {
    if (period === "AM") return hour === 12 ? 0 : hour;
    return hour === 12 ? 12 : hour + 12;
  }

  function emitTime(h: number, m: number, p: "AM" | "PM") {
    const h24 = to24(h, p);
    onChange(`${h24.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
  }

  const handleClockClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg = clockRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const x = e.clientX - rect.left - cx;
    const y = e.clientY - rect.top - cy;
    let angle = Math.atan2(x, -y) * (180 / Math.PI);
    if (angle < 0) angle += 360;

    if (mode === "hour") {
      let hour = Math.round(angle / 30);
      if (hour === 0) hour = 12;
      setSelectedHour(hour);
      emitTime(hour, selectedMinute, selectedPeriod);
      setTimeout(() => setMode("minute"), 200);
    } else if (mode === "minute") {
      let minute = Math.round(angle / 6);
      if (minute === 60) minute = 0;
      minute = Math.round(minute / 5) * 5;
      if (minute === 60) minute = 0;
      setSelectedMinute(minute);
      emitTime(selectedHour, minute, selectedPeriod);
    }
  }, [mode, selectedHour, selectedMinute, selectedPeriod]);

  const togglePeriod = (p: "AM" | "PM") => {
    setSelectedPeriod(p);
    emitTime(selectedHour, selectedMinute, p);
  };

  const openPicker = () => {
    const p = parseTime(value);
    setSelectedHour(p.hour);
    setSelectedMinute(p.minute);
    setSelectedPeriod(p.period);
    setMode("hour");
    setOpen(true);
  };

  const radius = 80;
  const centerX = 100;
  const centerY = 100;

  const numbers = mode === "hour"
    ? Array.from({ length: 12 }, (_, i) => i + 1)
    : [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  const selectedValue = mode === "hour" ? selectedHour : selectedMinute;
  const totalPositions = mode === "hour" ? 12 : 60;
  const handAngle = mode === "hour"
    ? (selectedHour % 12) * 30
    : selectedMinute * 6;

  const handRad = (handAngle - 90) * (Math.PI / 180);
  const handLength = 58;
  const handX = centerX + handLength * Math.cos(handRad);
  const handY = centerY + handLength * Math.sin(handRad);

  const displayTime = value
    ? `${selectedHour}:${selectedMinute.toString().padStart(2, "0")} ${selectedPeriod}`
    : "";

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 text-xs gap-1 px-2"
        onClick={openPicker}
        data-testid={`${testIdPrefix}button-clock-picker`}
      >
        <Clock className="w-3 h-3" />
        {displayTime || "Set Time"}
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 mt-1 right-0 bg-card border rounded-lg shadow-lg p-3 w-[230px]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex gap-1">
                <button
                  className={`px-2 py-1 rounded text-xs font-bold ${mode === "hour" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                  onClick={() => setMode("hour")}
                  data-testid={`${testIdPrefix}button-mode-hour`}
                >
                  {selectedHour}
                </button>
                <span className="text-xs font-bold self-center">:</span>
                <button
                  className={`px-2 py-1 rounded text-xs font-bold ${mode === "minute" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                  onClick={() => setMode("minute")}
                  data-testid={`${testIdPrefix}button-mode-minute`}
                >
                  {selectedMinute.toString().padStart(2, "0")}
                </button>
              </div>
              <div className="flex gap-0.5">
                <button
                  className={`px-2 py-1 rounded text-[10px] font-bold ${selectedPeriod === "AM" ? "bg-primary text-primary-foreground" : "text-muted-foreground border"}`}
                  onClick={() => togglePeriod("AM")}
                  data-testid={`${testIdPrefix}button-am`}
                >
                  AM
                </button>
                <button
                  className={`px-2 py-1 rounded text-[10px] font-bold ${selectedPeriod === "PM" ? "bg-primary text-primary-foreground" : "text-muted-foreground border"}`}
                  onClick={() => togglePeriod("PM")}
                  data-testid={`${testIdPrefix}button-pm`}
                >
                  PM
                </button>
              </div>
            </div>

            <svg
              ref={clockRef}
              viewBox="0 0 200 200"
              className="w-full cursor-pointer"
              onClick={handleClockClick}
              data-testid={`${testIdPrefix}clock-face`}
            >
              <circle cx={centerX} cy={centerY} r={radius + 12} className="fill-muted/30 stroke-border" strokeWidth="1" />
              <circle cx={centerX} cy={centerY} r="3" className="fill-primary" />

              <line
                x1={centerX}
                y1={centerY}
                x2={handX}
                y2={handY}
                className="stroke-primary"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <circle cx={handX} cy={handY} r="14" className="fill-primary/20" />

              {numbers.map((num) => {
                const pos = mode === "hour" ? num : num / 5;
                const totalPos = mode === "hour" ? 12 : 12;
                const angle = (pos * 360) / totalPos - 90;
                const rad = angle * (Math.PI / 180);
                const r = 65;
                const x = centerX + r * Math.cos(rad);
                const y = centerY + r * Math.sin(rad);
                const isSelected = mode === "hour" ? num === selectedHour : num === selectedMinute;

                return (
                  <g key={`${mode}-${num}`}>
                    {isSelected && (
                      <circle cx={x} cy={y} r="14" className="fill-primary" />
                    )}
                    <text
                      x={x}
                      y={y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      className={`text-[11px] font-medium select-none ${isSelected ? "fill-primary-foreground" : "fill-foreground"}`}
                    >
                      {mode === "minute" ? num.toString().padStart(2, "0") : num}
                    </text>
                  </g>
                );
              })}

              {mode === "minute" && Array.from({ length: 60 }, (_, i) => i).filter(i => i % 5 !== 0).map((i) => {
                const angle = (i * 6) - 90;
                const rad = angle * (Math.PI / 180);
                const r = 78;
                const x = centerX + r * Math.cos(rad);
                const y = centerY + r * Math.sin(rad);
                return (
                  <circle key={`dot-${i}`} cx={x} cy={y} r="1.5" className="fill-muted-foreground/40" />
                );
              })}
            </svg>

            <div className="flex justify-end mt-2">
              <Button
                type="button"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setOpen(false)}
                data-testid={`${testIdPrefix}button-clock-done`}
              >
                Done
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
