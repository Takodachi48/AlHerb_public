import React, { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Leaf, Sun, Moon, Circle, Square, Menu, X } from "lucide-react";
import LogoWrapper from "../overlays/LogoWrapper";
import SearchButton from "../common/SearchButton";
import DarkModeToggle from "../common/DarkModeToggle";
import { SYSTEM_SHORT_NAME } from "../../../../shared/constants/app.js";

/* ─── tiny helpers ────────────────────────────────────────────────── */
const pad = (n) => String(n).padStart(2, "0");

/*
  Local token strategy
  ─────────────────────
  --ov-line  →  var(--text-strong)
               neutral-950 in light (near-black) / neutral-50 in dark (near-white)
               Maximum contrast in both modes — guaranteed visible.

  --ov-title →  var(--text-brand)
               Keeps the warm brand identity on the animated section name only.

  --ov-glow  →  var(--surface-brand-strong)
               Subtle tint behind the leaf circle.

  All opacity values are 1. Visibility is achieved through token choice,
  not alpha — so there is no more "barely visible" problem.
*/

/* ─── decorative SVG line with diamond terminator ─────────────────── */
const DecorLine = ({ flip = false }) => (
  <svg
    className="flex-1 h-5"
    viewBox="0 0 200 20"
    preserveAspectRatio="none"
    style={{ overflow: "visible" }}
  >
    {/* main rule — 1.6px (was 0.9) */}
    <line
      x1="0" y1="10" x2="200" y2="10"
      stroke="var(--ov-line)"
      strokeWidth="1.6"
    />
    {/* diamond — scaled 1.8x original 6pt half-width to ~11pt */}
    <polygon
      points={
        flip
          ? "11,10 0,5.5 -11,10 0,14.5"
          : "189,10 200,5.5 211,10 200,14.5"
      }
      fill="var(--ov-line)"
    />
    {/* far-end circle terminator — r=4.5 (was 2.5) */}
    <circle
      cx={flip ? 200 : 0} cy={10} r={4.5}
      fill="none"
      stroke="var(--ov-line)"
      strokeWidth="1.6"
    />
  </svg>
);

/* ─── ornamental corner ───────────────────────────────────────────── */
const Corner = ({ pos }) => {
  const t = pos.includes("top") ? 0 : "auto";
  const b = pos.includes("bottom") ? 0 : "auto";
  const l = pos.includes("left") ? 0 : "auto";
  const r = pos.includes("right") ? 0 : "auto";
  const sx = pos.includes("right") ? -1 : 1;
  const sy = pos.includes("bottom") ? -1 : 1;

  return (
    /* 86px (was 48 * 1.8) */
    <svg
      style={{
        position: "absolute",
        top: t, bottom: b, left: l, right: r,
        width: 86, height: 86,
        transform: `scale(${sx},${sy})`,
      }}
      viewBox="0 0 48 48"
    >
      {/* outer L — strokeWidth 1.6 (was 0.9) */}
      <path
        d="M4 44 L4 8 Q4 4 8 4 L44 4"
        fill="none"
        stroke="var(--ov-line)"
        strokeWidth="1.6"
      />
      {/* inner offset L — strokeWidth 1.1 (was 0.6) */}
      <path
        d="M4 44 L4 16 Q4 8 12 8 L44 8"
        fill="none"
        stroke="var(--ov-line)"
        strokeWidth="1.1"
      />
      {/* corner pip — 7x7 (was 4x4 * 1.8) */}
      {/* <rect x="0.5" y="0.5" width="7" height="7" fill="var(--ov-line)" /> */}
    </svg>
  );
};

/* ─── animated section title ──────────────────────────────────────── */
const AnimatedTitle = ({ name }) => {
  const [display, setDisplay] = useState(name);
  const [animState, setAnimState] = useState("idle");
  const timerRef = useRef(null);

  useEffect(() => {
    if (name === display) return;
    setAnimState("exit");
    timerRef.current = setTimeout(() => {
      setDisplay(name);
      setAnimState("enter");
      timerRef.current = setTimeout(() => setAnimState("idle"), 450);
    }, 300);
    return () => clearTimeout(timerRef.current);
  }, [name]);

  return (
    <span
      className="font-display"
      style={{
        transition: "opacity 300ms ease, transform 300ms ease",
        opacity: animState === "exit" ? 0 : 1,
        transform:
          animState === "exit"
            ? "translateY(-10px) skewX(-3deg)"
            : "translateY(0) skewX(0)",
        fontStyle: "italic",
        fontSize: "clamp(1.4rem, 3.5vw, 2.4rem)",
        fontWeight: 700,
        letterSpacing: "0.04em",
        /* title keeps brand colour — everything structural uses --ov-line */
        color: "var(--ov-title)",
        display: "inline-block",
        whiteSpace: "nowrap",
        userSelect: "none",
      }}
    >
      {display}
    </span>
  );
};

/* ─── leaf with slow spin on mount ───────────────────────────────── */
const AnimatedLeaf = () => {
  const [spin, setSpin] = useState(false);
  useEffect(() => { setSpin(true); }, []);
  return (
    <div
      style={{
        transition: "transform 900ms cubic-bezier(.23,1,.32,1)",
        transform: spin ? "rotate(0deg)" : "rotate(-120deg)",
        color: "var(--ov-line)",
      }}
    >
      {/* size=40 (was 22 * 1.8), strokeWidth=2.5 (was 1.4 * 1.8) */}
      <Leaf size={40} strokeWidth={2.5} />
    </div>
  );
};

const CounterFlashValue = ({ value }) => {
  const DURATION_MS = 160;
  const [displayValue, setDisplayValue] = useState(pad(value));
  const [flashOn, setFlashOn] = useState(false);
  const timeoutRef = useRef(null);

  useEffect(() => {
    const nextValue = pad(value);
    if (nextValue === displayValue) return undefined;

    setDisplayValue(nextValue);
    setFlashOn(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setFlashOn(false);
      timeoutRef.current = null;
    }, DURATION_MS);
    return undefined;
  }, [value]);

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  return (
    <span
      style={{
        position: "relative",
        display: "inline-flex",
        width: "1.45em",
        height: "1.1em",
        overflow: "hidden",
        justifyContent: "center",
        alignItems: "center",
        marginRight: "0.2em",
        lineHeight: 1,
        opacity: flashOn ? 0.5 : 1,
        transition: `opacity ${DURATION_MS}ms ease`,
      }}
    >
      <span
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          textAlign: "center",
          lineHeight: 1,
        }}
      >
        {displayValue}
      </span>
    </span>
  );
};

/* ─── main overlay ────────────────────────────────────────────────── */
const SectionOverlay = ({ sectionName, sectionNumber, totalSections, preferences, isWelcome, onSearchClick, showSidenav, setShowSidenav }) => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const isDark = preferences.darkMode === 'dark' || (preferences.darkMode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  return (
    <div
      style={{
        "--ov-line":  "var(--color-brand-primary)",
        "--ov-title": "var(--text-accent)",
        "--ov-glow":  "var(--surface-brand-strong)",

        position: "fixed", top: 0, left: 0,
        width: "100%", height: "100%",
        pointerEvents: "none",
        zIndex: 10,
        transition: "opacity 300ms ease",
        opacity: 1, // Always visible now
        fontFamily: "var(--font-core)",
      }}
    >
      {/* ── corners ── */}
      {/* Corners removed */}

      {/* ── Top band: welcome ↔ default ── */}
      <AnimatePresence mode="wait">
        {isWelcome ? (
          <motion.div key="welcome" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}>
            {/* Welcome navbar elements */}
            {isMobile ? (
              <div style={{
                position: "absolute", top: 18, right: 18,
                display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 12,
                pointerEvents: "auto",
                zIndex: -1
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <LogoWrapper size="sm" transparent={true} />
                  <span className="font-display" style={{
                    fontSize: 16, fontWeight: 600,
                    color: "var(--text-brand)"
                  }}>
                    {SYSTEM_SHORT_NAME}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <SearchButton onClick={onSearchClick} />
                  <DarkModeToggle />
                </div>
              </div>
            ) : (
              <>
                <div style={{
                  position: "absolute", top: 18, left: 18,
                  display: "flex", alignItems: "center", gap: 12,
                  pointerEvents: "auto",
                  zIndex: -1
                }}>
                  <LogoWrapper size="sm" transparent={true} />
                  <span className="font-display" style={{
                    fontSize: 16, fontWeight: 600,
                    color: "var(--text-brand)"
                  }}>
                    {SYSTEM_SHORT_NAME}
                  </span>
                </div>
                <div style={{
                  position: "absolute", top: 18, right: 18,
                  display: "flex", alignItems: "center", gap: 12,
                  pointerEvents: "auto"
                }}>
                  <SearchButton onClick={onSearchClick} />
                  <DarkModeToggle />
                </div>
              </>
            )}
          </motion.div>
        ) : (
          <motion.div key="default" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}>
            {/* ══ TOP BAND ══ */}
            <div style={{
              position: "absolute", top: 18, left: 0, right: 0,
              height: 46,
              display: "flex", alignItems: "center",
              padding: "0 52px",
              gap: 0,
            }}>
              {/* segment 1: left edge → pill — 2px rule (was 1px) */}
              <div style={{ flex: 4, position: 'relative' }}>
                <div style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', left: 0, right: 0, height: 2, background: "var(--ov-line)" }} />
                <div style={{ position: 'absolute', top: 'calc(50% + 6px)', left: 0, width: '50%', height: 2, borderTop: '2px dashed var(--ov-line)' }} />
              </div>

              {/* centred pill — 2px border (was 1px) */}
              <div style={{
                flexShrink: 0,
                width: 250,
                display: "flex", alignItems: "center",
                height: 46,
                position: "relative",
              }}>
                <span style={{
                  position: "absolute", left: 0, top: "50%",
                  transform: "translateY(-50%)",
                  padding: "2px 10px",
                  color: "var(--ov-title)",
                  fontSize: 12, letterSpacing: "0.18em",
                  fontFamily: "var(--font-accent)",
                }}><Square size={8} /></span>
                <div style={{
                  padding: "0 16px",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: "100%",
                }}>
                  <AnimatedTitle name={sectionName} />
                </div>
                <span style={{
                  position: "absolute", right: 0, top: "50%",
                  transform: "translateY(-50%)",
                  padding: "2px 10px",
                  color: "var(--ov-title)",
                  fontSize: 12, letterSpacing: "0.18em",
                  fontFamily: "var(--font-accent)",
                }}><Square size={8} /></span>
              </div>

              {/* segment 2: pill → counter */}
              <div style={{ flex: 2.5, height: 2, background: "var(--ov-line)" }} />

              {/* counter — 2px borders (was 1px) */}
              <div style={{
                flexShrink: 0,
                display: "flex", alignItems: "center",
                height: 46,
                borderLeft: "2px solid var(--ov-line)",
                borderRight: "2px solid var(--ov-line)",
                padding: "0 12px",
                color: "var(--ov-title)",
                fontSize: 13, letterSpacing: "0.2em",
                whiteSpace: "nowrap",
                fontWeight: 600,
                overflow: "hidden",
                fontFamily: "var(--font-accent)",
              }}>
                <CounterFlashValue value={sectionNumber} />
                &thinsp;/&thinsp;{pad(totalSections)}
              </div>

              {/* segment 3: counter → right edge */}
              <div style={{ flex: 1, height: 2, background: "var(--ov-line)" }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Bottom band: own AnimatePresence so it animates independently ── */}
      <AnimatePresence mode="wait">
        {!isWelcome && !isMobile && (
          <motion.div
            key={`bottom-band-${sectionNumber}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.3 }}
            style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
          >
            {/* ══ BOTTOM BAND ══ */}
            <div style={{
              position: "absolute", bottom: 18, left: 0, right: 0, padding: "0 52px",
              display: "flex", alignItems: "center", gap: 20,
            }}>
              {/* ooo cluster left — radii [13,9,5] (was [7,5,3] * 1.8) */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {[13, 9, 5].map((r, i) => (
                  <svg key={i} width={r * 2 + 4} height={r * 2 + 4} viewBox={`0 0 ${r * 2 + 4} ${r * 2 + 4}`}>
                    <circle
                      cx={r + 2} cy={r + 2} r={r}
                      fill="none"
                      stroke="var(--ov-line)"
                      strokeWidth="1.6"
                    />
                  </svg>
                ))}
              </div>

              <DecorLine flip />

              {/* logo centrepiece */}
              <div style={{
                border: "2px solid var(--ov-line)",
                borderRadius: "50%",
                width: 48, height: 48,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "transparent",
                flexShrink: 0,
              }}>
                <img src={(() => {
                  const shouldBeDark = preferences.darkMode === 'dark' || (preferences.darkMode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
                  return shouldBeDark ? "/herb-icon-alt.svg" : "/herb-icon.svg";
                })()} alt="Herb Logo" style={{ width: 40, height: 40 }} />
              </div>

              <DecorLine />

              {/* ooo cluster right */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {[5, 9, 13].map((r, i) => (
                  <svg key={i} width={r * 2 + 4} height={r * 2 + 4} viewBox={`0 0 ${r * 2 + 4} ${r * 2 + 4}`}>
                    <circle
                      cx={r + 2} cy={r + 2} r={r}
                      fill="none"
                      stroke="var(--ov-line)"
                      strokeWidth="1.6"
                    />
                  </svg>
                ))}
              </div>
            </div>

            {/* sub-rule above bottom band — 2px, full opacity (was 1px at 0.2) */}
            <div style={{
              position: "absolute", bottom: 62, left: 90, right: "calc(50% + 24px)",
              height: 0,
              borderTop: "2px dashed var(--ov-line)",
            }} />
            <div style={{
              position: "absolute", bottom: 62, left: "calc(50% + 24px)", right: 90,
              height: 0,
              borderTop: "2px dashed var(--ov-line)",
            }} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SectionOverlay;