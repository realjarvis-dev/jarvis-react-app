'use client'


// import logoPng from "@/public/images/icon.svg"; // adjust path as needed
// import Image from "next/image";

// export function IconLogo({ style, ...props }: React.ComponentProps<typeof Image>) {
//   return (
//     <Image
//       {...props}
//       src={logoPng}
//       alt="Jarvis Logo"
//       width={32}
//       height={32}
//       style={{ display: "inline-block", ...style }}
//     />
//   );
// }

import * as React from "react";

export function IconLogo(
  { className, priority = false, ...props }: React.ComponentProps<"svg"> & { priority?: boolean }
) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      {/* Black circle background */}
      <circle cx="32" cy="32" r="32" fill="black" />

      {/* Upside-down (inverted) white triangle centered in the circle */}
      <path d="M14 20 L50 20 L32 50 Z" fill="white" />
    </svg>
  );
}

