import { motion } from "framer-motion";

/**
 * Neon/silver single‑loop border background
 *
 * – Uses an SVG <rect> whose stroke dashoffset animates once around the viewport
 * – Neon silver glow via filter / drop‑shadow
 * – Tailwind for sizing / positioning
 */
export default function NeonBorderBackground() {
  // viewport‑size box (slightly inset so glow isn't clipped)
  return (
    <div className="fixed inset-0 -z-10 flex items-center justify-center bg-black">
      <motion.svg
        className="w-[90vw] h-[90vh]"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        initial={{ strokeDashoffset: 400 }}
        animate={{ strokeDashoffset: 0 }}
        transition={{ duration: 6, ease: "easeInOut" }}
      >
        <defs>
          {/* silver‑neon gradient */}
          <linearGradient id="silver" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e0e0e0" />
            <stop offset="100%" stopColor="#a0a0a0" />
          </linearGradient>
          {/* glow filter */}
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="2" floodColor="#ffffff" floodOpacity="0.6" />
            <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#ffffff" floodOpacity="0.4" />
          </filter>
        </defs>
        <motion.rect
          x="1" y="1" width="98" height="98"
          fill="none"
          stroke="url(#silver)"
          strokeWidth="2"
          rx="2" ry="2"
          strokeDasharray="400"
          strokeLinecap="round"
          filter="url(#glow)"
        />
      </motion.svg>
    </div>
  );
}