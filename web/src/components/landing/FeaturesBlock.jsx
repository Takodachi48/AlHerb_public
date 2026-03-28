import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";

const FEATURE_KEYS = [
  "Personalised Recommendations",
  "Herb Comparison",
  "Plant Identification",
  "Interactive Map",
];

export default function FeaturesBlock({ features }) {
  const [hovered, setHovered] = useState(0);
  const navigate = useNavigate();

  const subset = features.filter((f) => FEATURE_KEYS.includes(f.title));
  const active = subset[hovered] ?? subset[0];

  return (
    <div>
      {/* ── Section header */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem" }}>
        <span style={{ display: "block", width: 28, height: 1, background: "var(--accent-400)", flexShrink: 0 }} />
        <h3 style={{
          fontFamily: "var(--font-accent)",
          fontSize: "0.75rem",
          fontWeight: 700,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--text-tertiary)",
          margin: 0,
        }}>
          Key Features
        </h3>
      </div>

      {/* ── Two-column body: list + preview panel */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", alignItems: "start" }}>

        {/* Left — feature list */}
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {subset.map((f, i) => {
            const isActive = hovered === i;
            return (
              <li key={f.title}>
                <motion.button
                  onHoverStart={() => setHovered(i)}
                  onFocus={() => setHovered(i)}
                  style={{
                    width: "100%",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.65rem",
                    padding: "0.7rem 0.5rem",
                    borderBottom: i < subset.length - 1
                      ? "1px solid var(--border-subtle, rgba(255,255,255,0.06))"
                      : "none",
                    textAlign: "left",
                    position: "relative",
                  }}
                >
                  {/* Active indicator bar */}
                  <motion.span
                    animate={{ opacity: isActive ? 1 : 0, scaleY: isActive ? 1 : 0 }}
                    transition={{ duration: 0.2 }}
                    style={{
                      position: "absolute",
                      left: 0,
                      top: "20%",
                      bottom: "20%",
                      width: 2,
                      background: "var(--accent-400)",
                      borderRadius: 2,
                      transformOrigin: "center",
                    }}
                  />

                  {/* Icon */}
                  <motion.span
                    animate={{ color: isActive ? "var(--icon-brand)" : "var(--text-tertiary)", opacity: isActive ? 1 : 0.45 }}
                    transition={{ duration: 0.2 }}
                    style={{ display: "flex", alignItems: "center", flexShrink: 0 }}
                  >
                    {f.icon}
                  </motion.span>

                  {/* Title */}
                  <motion.span
                    animate={{ color: isActive ? "var(--text-strong)" : "var(--text-secondary)" }}
                    transition={{ duration: 0.2 }}
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: "0.88rem",
                      fontWeight: isActive ? 700 : 500,
                      lineHeight: 1.3,
                    }}
                  >
                    {f.title}
                  </motion.span>
                </motion.button>
              </li>
            );
          })}
        </ul>

        {/* Right — fixed description panel */}
        <div style={{
          position: "relative",
          minHeight: "7rem",
          padding: "0.85rem",
          borderRadius: "8px",
          background: "var(--surface-primary, rgba(255,255,255,0.03))",
          border: "1px solid var(--border-subtle, rgba(255,255,255,0.06))",
          overflow: "hidden",
        }}>
          {/* Subtle accent glow in corner */}
          <span style={{
            position: "absolute",
            top: -20,
            right: -20,
            width: 60,
            height: 60,
            borderRadius: "50%",
            background: "var(--accent-400)",
            opacity: 0.06,
            filter: "blur(16px)",
            pointerEvents: "none",
          }} />

          <AnimatePresence mode="wait">
            <motion.div
              key={active?.title}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              {/* Feature counter */}
              <p style={{
                fontFamily: "var(--font-accent)",
                fontSize: "0.75rem",
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                color: "var(--accent-400)",
                margin: "0 0 0.5rem",
                opacity: 0.8,
              }}>
                0{hovered + 1} / 0{subset.length}
              </p>

              {/* Description */}
              <p style={{
                fontFamily: "var(--font-core)",
                fontSize: "0.85rem",
                lineHeight: 1.65,
                color: "var(--text-secondary)",
                margin: 0,
              }}>
                {active?.desc ?? ""}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* ── "All features" link */}
      <motion.button
        whileHover={{ x: 4 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        onClick={() => navigate('/home')}
        style={{
          background: "none",
          border: "none",
          padding: "0.6rem 0",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "0.4rem",
          marginTop: "0.75rem",
        }}
      >
        <span style={{
          fontFamily: "var(--font-accent)",
          fontSize: "0.78rem",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--accent-400)",
        }}>
          Explore all features
        </span>
        <svg width="14" height="10" viewBox="0 0 14 10" fill="none" style={{ color: "var(--accent-400)" }}>
          <path d="M1 5h12M9 1l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </motion.button>
    </div>
  );
}
