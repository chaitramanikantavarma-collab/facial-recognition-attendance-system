import React, { useState, useRef, useEffect } from "react";
import { Clock, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface ClockPickerProps {
  id: string;
  value: string; // 24-hour style "HH:MM", e.g., "14:30"
  onChange: (time: string) => void;
  label?: string;
}

export function ClockPicker({ id, value, onChange, label }: ClockPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<"hours" | "minutes">("hours");
  const popoverRef = useRef<HTMLDivElement>(null);

  // Parse existing value (format "HH:MM")
  const tempTime = value || "09:00";
  const [hStr, mStr] = tempTime.split(":");
  let parsedHour = parseInt(hStr, 10);
  const parsedMinute = parseInt(mStr, 10);

  // Convert parsed 24h hour to 12h + AM/PM
  const isPm = parsedHour >= 12;
  const displayHour = parsedHour % 12 === 0 ? 12 : parsedHour % 12;
  const amPm = isPm ? "PM" : "AM";

  const handleTimeChange = (newHour12: number, newMin: number, newAmPm: "AM" | "PM") => {
    let finalHour24 = newHour12;
    if (newAmPm === "PM" && newHour12 < 12) {
      finalHour24 += 12;
    } else if (newAmPm === "AM" && newHour12 === 12) {
      finalHour24 = 0;
    }
    const hh = String(finalHour24).padStart(2, "0");
    const mm = String(newMin).padStart(2, "0");
    onChange(`${hh}:${mm}`);
  };

  const setHour = (h: number) => {
    handleTimeChange(h, parsedMinute, amPm);
    // Auto shift to minutes picker automatically for smooth workflow
    setTimeout(() => {
      setMode("minutes");
    }, 250);
  };

  const setMinute = (m: number) => {
    handleTimeChange(displayHour, m, amPm);
  };

  const toggleAmPm = (target: "AM" | "PM") => {
    handleTimeChange(displayHour, parsedMinute, target);
  };

  const incrementTime = () => {
    if (mode === "hours") {
      let nextH = displayHour + 1;
      if (nextH > 12) nextH = 1;
      handleTimeChange(nextH, parsedMinute, amPm);
    } else {
      let nextM = (parsedMinute + 5) % 60;
      handleTimeChange(displayHour, nextM, amPm);
    }
  };

  const decrementTime = () => {
    if (mode === "hours") {
      let prevH = displayHour - 1;
      if (prevH < 1) prevH = 12;
      handleTimeChange(prevH, parsedMinute, amPm);
    } else {
      let prevM = parsedMinute - 5;
      if (prevM < 0) prevM = 55;
      handleTimeChange(displayHour, prevM, amPm);
    }
  };

  // Quick preset shortcuts for teachers
  const presets = [
    { label: "09:00 AM", value: "09:00" },
    { label: "10:30 AM", value: "10:30" },
    { label: "11:30 AM", value: "11:30" },
    { label: "01:00 PM", value: "13:00" },
    { label: "02:30 PM", value: "14:30" },
    { label: "03:30 PM", value: "15:30" },
    { label: "04:00 PM", value: "16:00" }
  ];

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Radius for clock numbers layout
  const radius = 94;

  // Render the numbers in a perfect circle (30 degree intervals)
  const hourPositions = Array.from({ length: 12 }, (_, i) => {
    const hourVal = i === 0 ? 12 : i;
    const angle = (hourVal * 30 * Math.PI) / 180;
    const x = Math.sin(angle) * radius;
    const y = -Math.cos(angle) * radius;
    return { value: hourVal, x, y };
  });

  const minutePositions = Array.from({ length: 12 }, (_, i) => {
    const minVal = i * 5;
    const angle = (i * 30 * Math.PI) / 180;
    const x = Math.sin(angle) * radius;
    const y = -Math.cos(angle) * radius;
    return { value: minVal, x, y };
  });

  // Calculate hand angle
  const handAngle =
    mode === "hours"
      ? displayHour * 30 // 30 deg per hour
      : parsedMinute * 6; // 6 deg per minute (360/60)

  return (
    <div className="relative inline-block w-full font-sans text-slate-800" ref={popoverRef}>
      {label && <span className="block text-xs font-bold text-slate-505 text-slate-500 mb-1">{label}</span>}
      
      <button
        type="button"
        id={`${id}-trigger`}
        onClick={() => {
          setIsOpen(!isOpen);
          setMode("hours");
        }}
        className="w-full flex items-center justify-between rounded-xl border border-slate-200 p-3 font-semibold text-xs text-slate-800 bg-white hover:bg-slate-50 hover:border-slate-350 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition duration-150 cursor-pointer text-left shadow-sm"
      >
        <span className="flex items-center gap-2">
          <Clock className="h-4.5 w-4.5 text-indigo-600 shrink-0" />
          <span className="text-sm font-bold tracking-tight text-slate-900">
            {`${String(displayHour).padStart(2, "0")}:${String(parsedMinute).padStart(2, "0")} ${amPm}`}
          </span>
        </span>
        <span className="text-[10px] text-indigo-600 font-extrabold uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100/50">
          SELECT CLOCK
        </span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="absolute left-0 lg:left-0 mt-2 z-50 bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 w-[310px] flex flex-col items-center"
            id={`${id}-popover`}
          >
            {/* DIGITAL DISPLAY HEADER */}
            <div className="w-full bg-slate-950 text-white rounded-xl p-4 mb-4 flex flex-col items-center relative shadow-inner overflow-hidden">
              <div className="absolute top-0 right-0 p-1">
                <span className="text-[8px] bg-slate-800 text-slate-400 font-bold px-1 py-0.5 rounded">
                  PORTAL TIME
                </span>
              </div>
              
              {/* Interactive Large Digital Face */}
              <div className="flex items-center gap-1.5 mt-1.5">
                {/* Decrement Arrow */}
                <button
                  type="button"
                  id={`${id}-dec-btn`}
                  onClick={decrementTime}
                  className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition cursor-pointer"
                  title={`Decrease ${mode}`}
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>

                {/* Digital Hour Area */}
                <button
                  type="button"
                  id={`${id}-digi-hour-btn`}
                  onClick={() => setMode("hours")}
                  className={`text-3xl font-black rounded-lg px-2 py-1 transition cursor-pointer ${
                    mode === "hours" 
                      ? "bg-indigo-600 text-white shadow-md animate-pulse" 
                      : "text-slate-400 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  {String(displayHour).padStart(2, "0")}
                </button>

                <span className="text-2xl font-bold text-slate-600 animate-pulse">:</span>

                {/* Digital Min Area */}
                <button
                  type="button"
                  id={`${id}-digi-min-btn`}
                  onClick={() => setMode("minutes")}
                  className={`text-3xl font-black rounded-lg px-2 py-1 transition cursor-pointer ${
                    mode === "minutes" 
                      ? "bg-indigo-600 text-white shadow-md animate-pulse" 
                      : "text-slate-400 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  {String(parsedMinute).padStart(2, "0")}
                </button>

                {/* Increment Arrow */}
                <button
                  type="button"
                  id={`${id}-inc-btn`}
                  onClick={incrementTime}
                  className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition cursor-pointer"
                  title={`Increase ${mode}`}
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>

              {/* AM/PM Switcher pill */}
              <div className="flex mt-3 bg-slate-900 rounded-lg p-0.5 border border-slate-800 w-max">
                <button
                  type="button"
                  id={`${id}-am-btn`}
                  onClick={() => toggleAmPm("AM")}
                  className={`text-[9px] font-extrabold px-3 py-1 rounded-md transition cursor-pointer ${
                    amPm === "AM" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  AM
                </button>
                <button
                  type="button"
                  id={`${id}-pm-btn`}
                  onClick={() => toggleAmPm("PM")}
                  className={`text-[9px] font-extrabold px-3 py-1 rounded-md transition cursor-pointer ${
                    amPm === "PM" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  PM
                </button>
              </div>
            </div>

            {/* TAB SELECTORS (Hour / Minute) */}
            <div className="flex items-center gap-1.5 w-full bg-slate-100 p-1 rounded-lg border border-slate-200/50 mb-4">
              <button
                type="button"
                id={`${id}-set-hours-btn`}
                onClick={() => setMode("hours")}
                className={`flex-1 py-1 rounded-md text-[11px] font-bold transition cursor-pointer text-center ${
                  mode === "hours" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-505 text-slate-500 hover:text-slate-800"
                }`}
              >
                Hours Dial
              </button>
              <button
                type="button"
                id={`${id}-set-minutes-btn`}
                onClick={() => setMode("minutes")}
                className={`flex-1 py-1 rounded-md text-[11px] font-bold transition cursor-pointer text-center ${
                  mode === "minutes" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-550 text-slate-500 hover:text-slate-800"
                }`}
              >
                Minutes Dial
              </button>
            </div>

            {/* HIGH FIDELITY ANALOG CLOCK VIEW */}
            <div className="relative h-[230px] w-[230px] bg-slate-50 rounded-full border border-slate-200 shadow-inner flex items-center justify-center p-2 mb-4">
              {/* Outer dial ticks representation */}
              <div className="absolute inset-1.5 rounded-full border border-slate-200/40 pointer-events-none" />
              
              {/* Inner Circle guideline */}
              <div className="absolute h-4 w-4 rounded-full bg-slate-900 border-2 border-white z-30 shadow-md" />

              {/* Dial Line Indicator (Hand) */}
              <div
                className="absolute origin-bottom z-10"
                style={{
                  height: `${radius - 10}px`,
                  width: "3px",
                  bottom: "50%",
                  transform: `rotate(${handAngle}deg)`,
                  transformOrigin: "bottom center",
                  transition: "transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)",
                }}
              >
                <div className="w-full h-full bg-indigo-500 relative rounded-full">
                  {/* Glowing end knob */}
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-indigo-600 border border-white shadow flex items-center justify-center text-[10px] text-white font-black">
                    {mode === "hours" ? displayHour : parsedMinute}
                  </div>
                </div>
              </div>

              {/* Render Numbers */}
              <AnimatePresence mode="wait">
                {mode === "hours" ? (
                  <motion.div
                    key="hours-dial"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="absolute inset-0 z-20"
                  >
                    {hourPositions.map((item) => {
                      const isSelected = displayHour === item.value;
                      return (
                        <button
                          key={item.value}
                          type="button"
                          id={`${id}-hour-opt-${item.value}`}
                          onClick={() => setHour(item.value)}
                          style={{
                            position: "absolute",
                            left: `calc(50% - 15px + ${item.x}px)`,
                            top: `calc(50% - 15px + ${item.y}px)`,
                          }}
                          className={`w-[30px] h-[30px] rounded-full flex items-center justify-center text-[11px] font-extrabold transition-all duration-150 cursor-pointer ${
                            isSelected 
                              ? "bg-indigo-600 text-white shadow-md scale-110 border border-indigo-400" 
                              : "text-slate-700 hover:bg-slate-200 hover:scale-105"
                          }`}
                        >
                          {item.value}
                        </button>
                      );
                    })}
                  </motion.div>
                ) : (
                  <motion.div
                    key="minutes-dial"
                    initial={{ scale: 1.1, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 1.1, opacity: 0 }}
                    className="absolute inset-0 z-20"
                  >
                    {minutePositions.map((item) => {
                      const isSelected = parsedMinute === item.value;
                      return (
                        <button
                          key={item.value}
                          type="button"
                          id={`${id}-min-opt-${item.value}`}
                          onClick={() => setMinute(item.value)}
                          style={{
                            position: "absolute",
                            left: `calc(50% - 15px + ${item.x}px)`,
                            top: `calc(50% - 15px + ${item.y}px)`,
                          }}
                          className={`w-[30px] h-[30px] rounded-full flex items-center justify-center text-[10px] font-extrabold transition-all duration-150 cursor-pointer ${
                            isSelected 
                              ? "bg-indigo-600 text-white shadow-md scale-110 border border-indigo-400" 
                              : "text-slate-600 hover:bg-slate-200 hover:scale-105"
                          }`}
                        >
                          {String(item.value).padStart(2, "0")}
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* PRESETS CONTAINER FOR ROBUST SCHEDULING */}
            <div className="w-full border-t border-slate-100 pt-3 mb-3">
              <span className="block text-[9px] text-slate-400 font-extrabold uppercase tracking-widest mb-1.5 text-center">
                Standard Lecture Blocks
              </span>
              <div className="flex flex-wrap gap-1 justify-center max-h-[50px] overflow-y-auto">
                {presets.map((preset) => {
                  const [ph, pm] = preset.value.split(":");
                  const pHour24 = parseInt(ph, 10);
                  const isPresetActive = parsedHour === pHour24 && parsedMinute === parseInt(pm, 10);
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        onChange(preset.value);
                        setIsOpen(false);
                      }}
                      className={`text-[9px] font-bold px-2 py-1 rounded border transition cursor-pointer ${
                        isPresetActive
                          ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* CONFIRM BUTTON */}
            <div className="w-full flex items-center justify-end border-t border-slate-100 pt-3">
              <button
                type="button"
                id={`${id}-confirm-btn`}
                onClick={() => setIsOpen(false)}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-2 text-xs font-bold transition duration-150 cursor-pointer shadow-md"
              >
                <Check className="h-4 w-4" />
                Done
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
