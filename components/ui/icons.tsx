'use client'

import { cn } from '@/lib/utils'

// function IconLogo({ className, ...props }: React.ComponentProps<'svg'>) {
//   return (
//     <svg
//       fill="currentColor"
//       viewBox="0 0 256 256"
//       role="img"
//       xmlns="http://www.w3.org/2000/svg"
//       className={cn('h-4 w-4', className)}
//       {...props}
//     >
//       <circle cx="128" cy="128" r="128" fill="black"></circle>
//       <circle cx="102" cy="128" r="18" fill="white"></circle>
//       <circle cx="154" cy="128" r="18" fill="white"></circle>
//     </svg>
//   )
// }

// export function IconLogo({
//   className,
//   ...props
// }: React.ComponentProps<'svg'>) {
//   return (
//     <svg
//       viewBox="0 0 256 256"
//       role="img"
//       xmlns="http://www.w3.org/2000/svg"
//       className={cn('h-6 w-6', className)}
//       {...props}
//     >
//       {/* 1. Solid black disk (fills the whole icon) */}
//       <circle cx="128" cy="128" r="112" fill="black" />

//       {/* 2. White inverted triangle */}
//       <polygon
//         points="128,196 56,84 200,84"
//         fill="none"
//         stroke="currentColor"
//         strokeWidth="12"
//         strokeLinecap="round"
//         strokeLinejoin="round"
//       />

//       {/* 3. White core hexagon */}
//       <polygon
//         points="128,104 148,116 148,140 128,152 108,140 108,116"
//         fill="currentColor"
//       />
//     </svg>
//   )
// }

// export function IconLogo({
//   className,
//   ...props
// }: React.ComponentProps<'svg'>) {
//   return (
//     <svg
//       viewBox="0 0 256 256"
//       role="img"
//       xmlns="http://www.w3.org/2000/svg"
//       className={cn('h-6 w-6 text-white', className)}   // ‹text-white› drives glyph colour
//       {...props}
//     >
//       {/* ---------- gradients & glow ------------- */}
//       <defs>
//         {/* cyan-to-midnight radial core */}
//         <radialGradient id="core" cx="50%" cy="50%" r="70%">
//           <stop offset="0%"   stopColor="#00F7FF" />   {/* electric-cyan */}
//           <stop offset="50%"  stopColor="#0096CA" />
//           <stop offset="100%" stopColor="#001623" />   {/* midnight blue */}
//         </radialGradient>

//         {/* thin rim glow that fades outward */}
//         <radialGradient id="rim" cx="50%" cy="50%" r="100%">
//           <stop offset="70%" stopColor="rgba(0,247,255,0)" />
//           <stop offset="100%" stopColor="rgba(0,247,255,0.55)" />
//         </radialGradient>
//       </defs>

//       {/* 1. Energy core */}
//       <circle cx="128" cy="128" r="112" fill="url(#core)" />

//       {/* 2. Rim glow overlay (very subtle) */}
//       <circle cx="128" cy="128" r="112" fill="url(#rim)" />

//       {/* 3. White inverted triangle outline */}
//       <polygon
//         points="128,196 56,84 200,84"
//         fill="none"
//         stroke="currentColor"
//         strokeWidth="12"
//         strokeLinecap="round"
//         strokeLinejoin="round"
//       />

//       {/* 4. White hexagon core */}
//       <polygon
//         points="128,104 148,116 148,140 128,152 108,140 108,116"
//         fill="currentColor"
//       />
//     </svg>
//   )
// }


export function IconLogo({
  className,
  ...props
}: React.ComponentProps<'svg'>) {
  return (
    <svg
      viewBox="0 0 256 256"
      role="img"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('h-6 w-6 text-white', className)}
      {...props}
    >
      {/* ===== gradients & filters ===== */}
      <defs>
        {/* neon-yellow core */}
        <radialGradient id="coreY" cx="50%" cy="50%" r="75%">
          <stop offset="0%"  stopColor="#FFF809" />   {/* pure neon */}
          <stop offset="40%" stopColor="#FFD640" />   {/* warm gold */}
          <stop offset="100%" stopColor="#4f4200" />  {/* olive umbra */}
        </radialGradient>

        {/* amber rim glow */}
        <radialGradient id="rimY" cx="50%" cy="50%" r="100%">
          <stop offset="70%" stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="rgba(255,216,64,0.55)" />
        </radialGradient>

        {/* inner energy ring */}
        <radialGradient id="ringY" cx="50%" cy="50%" r="60%">
          <stop offset="58%" stopColor="rgba(255,255,255,0)" />
          <stop offset="70%" stopColor="rgba(255,255,170,0.45)" />
          <stop offset="100%" stopColor="rgba(255,255,170,0)" />
        </radialGradient>
      </defs>

      {/* ===== layers ===== */}
      {/* 1. Blending rim glow */}
      <circle cx="128" cy="128" r="112" fill="url(#rimY)" />

      {/* 2. Neon core */}
      <circle cx="128" cy="128" r="108" fill="url(#coreY)" />

      {/* 3. Inner faint energy ring */}
      <circle cx="128" cy="128" r="80" fill="url(#ringY)" />

      {/* 4. White inverted triangle */}
      <polygon
        points="128,196 56,84 200,84"
        fill="none"
        stroke="currentColor"
        strokeWidth="12"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* 5. White hexagon */}
      <polygon
        points="128,104 148,116 148,140 128,152 108,140 108,116"
        fill="currentColor"
      />
    </svg>
  )
}
