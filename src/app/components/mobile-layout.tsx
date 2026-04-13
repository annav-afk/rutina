import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Outlet, useNavigate, useLocation } from "react-router";
import { Home, ListChecks, Repeat, Smile, User } from "lucide-react";
import { motion } from "motion/react";
import { useApp } from "./app-context";
import { PomodoroTimer } from "./pomodoro-timer";
import { CelebrationOverlay } from "./confetti";
import { Onboarding } from "./onboarding";
import { Toaster } from "sonner";
import { getThemeColors } from "./theme";
import { FeatureTour, dashboardTour, tasksTour, habitsTour, moodTour, profileTour } from "./feature-tour";
import { BreathingWidget } from "./breathing-widget";
import { LeafMascot } from "./leaf-mascot";
import { FloatingDock } from "./floating-dock";
import { AmbientBlobs, SparkleField, MeshGradientBg } from "./ambient-elements";

const tabs = [
  { path: "/", icon: Home, label: "Главная" },
  { path: "/tasks", icon: ListChecks, label: "Задачи" },
  { path: "/habits", icon: Repeat, label: "Привычки" },
  { path: "/mood", icon: Smile, label: "Настроение" },
  { path: "/profile", icon: User, label: "Профиль" },
];

const tourMap: Record<string, { key: string; steps: typeof dashboardTour }> = {
  "/": { key: "tour-dashboard", steps: dashboardTour },
  "/tasks": { key: "tour-tasks", steps: tasksTour },
  "/habits": { key: "tour-habits", steps: habitsTour },
  "/mood": { key: "tour-mood", steps: moodTour },
  "/profile": { key: "tour-profile", steps: profileTour },
};

export function MobileLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { darkMode, onboardingDone, seenTours, markTourSeen } = useApp();
  const t = getThemeColors(darkMode);

  // ─── Track input focus to hide bottom nav ───
  const [inputFocused, setInputFocused] = useState(false);
  const inputFocusTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    const container = document.querySelector("[data-mobile-root]");
    if (!container) return;

    const onFocusIn = (e: Event) => {
      const el = e.target as HTMLElement;
      if (
        el.tagName === "INPUT" ||
        el.tagName === "TEXTAREA" ||
        el.getAttribute("contenteditable") === "true"
      ) {
        // Don't hide for file inputs, range sliders, etc.
        const type = (el as HTMLInputElement).type;
        if (type === "file" || type === "range" || type === "checkbox" || type === "radio" || type === "color") return;
        clearTimeout(inputFocusTimer.current);
        setInputFocused(true);

        // Broadcast input focus event for other components (FloatingDock, etc.)
        document.dispatchEvent(new CustomEvent("input-focus-change", { detail: { focused: true } }));

        // Controlled scroll to input — prevent layout jumps
        requestAnimationFrame(() => {
          el.scrollIntoView({ block: "nearest", behavior: "smooth" });
        });
      }
    };

    const onFocusOut = () => {
      // Small delay to avoid flicker when switching between inputs
      inputFocusTimer.current = setTimeout(() => {
        const active = document.activeElement;
        if (
          active &&
          (active.tagName === "INPUT" ||
            active.tagName === "TEXTAREA" ||
            active.getAttribute("contenteditable") === "true")
        ) {
          const type = (active as HTMLInputElement).type;
          if (type !== "file" && type !== "range" && type !== "checkbox" && type !== "radio" && type !== "color") return;
        }
        setInputFocused(false);
      }, 120);
    };

    // Also broadcast unfocus
    const origOnFocusOut = onFocusOut;
    const wrappedFocusOut = () => {
      origOnFocusOut();
      // Broadcast after same delay
      setTimeout(() => {
        const active = document.activeElement;
        const isStillFocused = active && (
          active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.getAttribute("contenteditable") === "true"
        );
        if (isStillFocused) {
          const type = (active as HTMLInputElement).type;
          if (type !== "file" && type !== "range" && type !== "checkbox" && type !== "radio" && type !== "color") return;
        }
        document.dispatchEvent(new CustomEvent("input-focus-change", { detail: { focused: false } }));
      }, 130);
    };

    container.addEventListener("focusin", onFocusIn);
    container.addEventListener("focusout", wrappedFocusOut);
    return () => {
      container.removeEventListener("focusin", onFocusIn);
      container.removeEventListener("focusout", wrappedFocusOut);
      clearTimeout(inputFocusTimer.current);
    };
  }, []);

  // Stable viewport height — lock on mount to prevent keyboard resize shifts
  const [stableHeight, setStableHeight] = useState<number | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    // Capture initial full viewport height before any keyboard opens
    const h = window.innerHeight;
    setStableHeight(h);
    setIsDesktop(window.innerWidth >= 768);

    // Use visualViewport to detect keyboard, but keep layout stable
    const vv = window.visualViewport;
    if (vv) {
      let initialH = vv.height;
      const onResize = () => {
        // Only update if viewport GREW (keyboard closed / orientation change)
        if (vv.height > initialH) {
          initialH = vv.height;
          setStableHeight(vv.height);
        }
        setIsDesktop(window.innerWidth >= 768);
      };
      vv.addEventListener("resize", onResize);
      return () => vv.removeEventListener("resize", onResize);
    }

    // Fallback: listen to resize for orientation changes
    const onResize = () => {
      setIsDesktop(window.innerWidth >= 768);
      setStableHeight(window.innerHeight);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const containerHeight = stableHeight
    ? (isDesktop ? Math.min(stableHeight, 850) : stableHeight)
    : undefined;

  // Parallax scroll state
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollY, setScrollY] = useState(0);

  const handleScroll = useCallback(() => {
    if (scrollRef.current) {
      setScrollY(scrollRef.current.scrollTop);
    }
  }, []);

  // Smooth reset scrollY on page change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
    setScrollY(0);
  }, [location.pathname]);

  // Auto-detect time-of-day for gradient variant
  const meshVariant = useMemo(() => {
    const h = new Date().getHours();
    if (h >= 21 || h < 5) return "night" as const;
    if (h >= 17) return "warm" as const;
    if (h >= 5 && h < 10) return "calm" as const;
    return "default" as const;
  }, []);

  // Fade-out thresholds per variant (night fades slower, warm/calm faster)
  const fadeConfig = useMemo(() => {
    switch (meshVariant) {
      case "night":  return { meshDist: 1800, meshFloor: 0.05, ambDist: 2200, ambFloor: 0.2 };
      case "warm":   return { meshDist: 1000, meshFloor: 0,    ambDist: 1300, ambFloor: 0.12 };
      case "calm":   return { meshDist: 1100, meshFloor: 0,    ambDist: 1400, ambFloor: 0.15 };
      default:       return { meshDist: 1200, meshFloor: 0,    ambDist: 1500, ambFloor: 0.15 };
    }
  }, [meshVariant]);

  // Track pomodoro state for dock display
  const [pomodoroState, setPomodoroState] = useState<{
    isRunning: boolean; time: string; color: string;
  }>({ isRunning: false, time: "25:00", color: "#7B8F71" });

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) setPomodoroState(detail);
    };
    document.addEventListener("pomodoro-state", handler);
    return () => document.removeEventListener("pomodoro-state", handler);
  }, []);

  if (!onboardingDone) {
    return <Onboarding />;
  }

  const currentTour = tourMap[location.pathname];

  return (
    <>
      <Toaster position="top-center" richColors />
      <CelebrationOverlay />
      <div
        className="flex items-center justify-center relative overflow-hidden"
        style={{
          fontFamily: "'Inter', sans-serif",
          height: stableHeight ? `${stableHeight}px` : '100dvh',
          minHeight: stableHeight ? `${stableHeight}px` : '100dvh',
          background: darkMode
            ? "linear-gradient(135deg, #1A1918 0%, #1E1D1C 40%, #1A1918 100%)"
            : "linear-gradient(135deg, #F0EDE8 0%, #EDE9E2 30%, #F2EFE9 60%, #F0EDE8 100%)",
        }}
      >
        <div
          className="w-full max-w-[430px] md:rounded-[2.5rem] md:shadow-2xl md:border flex flex-col overflow-hidden relative"
          data-mobile-root
          style={{
            borderColor: darkMode ? "#3A373430" : "#E8E3DC60",
            height: stableHeight ? `${containerHeight}px` : '100dvh',
          }}
        >
          {/* Animated mesh gradient background */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              opacity: Math.max(fadeConfig.meshFloor, 1 - scrollY / fadeConfig.meshDist),
              willChange: "opacity",
              transition: "opacity 0.3s ease-out",
            }}
          >
            <MeshGradientBg darkMode={darkMode} variant={meshVariant} />
          </div>

          {/* Ambient decorative blobs + sparkles */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              opacity: Math.max(fadeConfig.ambFloor, 1 - scrollY / fadeConfig.ambDist),
              willChange: "opacity",
              transition: "opacity 0.35s ease-out",
            }}
          >
            <AmbientBlobs darkMode={darkMode} variant={meshVariant === "warm" ? "focus" : meshVariant} />
            <SparkleField count={meshVariant === "night" ? 15 : 10} darkMode={darkMode} />
          </div>

          <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto overflow-x-hidden pb-28 relative z-[1]">
            <Outlet />
          </div>

          {/* Bottom nav */}
          <motion.div
            className="absolute left-0 right-0 px-1 pb-[env(safe-area-inset-bottom)]"
            animate={{
              bottom: inputFocused ? -80 : 0,
              opacity: inputFocused ? 0 : 1,
            }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            style={{
              pointerEvents: inputFocused ? "none" : "auto",
              backgroundColor: darkMode ? "rgba(26,25,24,0.85)" : "rgba(250,248,245,0.75)",
              backdropFilter: "blur(24px) saturate(1.3)",
              WebkitBackdropFilter: "blur(24px) saturate(1.3)",
              borderTop: `1px solid ${darkMode ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.5)"}`,
              boxShadow: darkMode
                ? "0 -4px 20px rgba(0,0,0,0.3)"
                : "0 -4px 20px rgba(0,0,0,0.03), inset 0 1px 0 rgba(255,255,255,0.6)",
              zIndex: 10,
            }}
          >
            <div className="flex items-center justify-around py-2.5">
              {tabs.map((tab) => {
                const isActive = tab.path === "/"
                  ? location.pathname === "/"
                  : location.pathname.startsWith(tab.path);
                return (
                  <button
                    key={tab.path}
                    onClick={() => navigate(tab.path)}
                    className="flex flex-col items-center gap-0.5 px-3 py-1 relative"
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute -top-2.5 w-8 h-1 rounded-full"
                        style={{ backgroundColor: t.sage }}
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      />
                    )}
                    <tab.icon
                      className="w-[20px] h-[20px] transition-colors"
                      style={{ color: isActive ? "#6B8F71" : t.textFaint }}
                    />
                    <span
                      className="transition-colors"
                      style={{
                        fontSize: "0.6rem",
                        fontWeight: isActive ? 600 : 400,
                        color: isActive ? "#6B8F71" : t.textFaint,
                      }}
                    >
                      {tab.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>

          <PomodoroTimer />
          <BreathingWidget />
          <LeafMascot />
          <FloatingDock
            pomodoroActive={pomodoroState.isRunning}
            pomodoroTime={pomodoroState.time}
            pomodoroColor={pomodoroState.color}
          />
        </div>
      </div>

      {/* Contextual feature tour */}
      {currentTour && (
        <FeatureTour
          key={currentTour.key}
          tourKey={currentTour.key}
          steps={currentTour.steps}
          seenTours={seenTours}
          onComplete={markTourSeen}
          delay={1000}
        />
      )}
    </>
  );
}