'use client';

import React, { useEffect, useRef } from 'react';

interface VideoBackgroundProps {
  src: string;
  poster?: string;
  isActive: boolean;
  playbackRate?: number;
}

export const VideoBackground: React.FC<VideoBackgroundProps> = ({
  src,
  poster,
  isActive,
  playbackRate = 0.5 // Default to 0.5x speed, adjust as needed
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  if (!isActive) {
    return null;
  }

  return (
    <video
      ref={videoRef}
      autoPlay
      loop
      muted
      playsInline
      poster={poster}
      className="fixed top-0 left-0 w-screen h-screen object-cover z-0" // Covers the whole screen, behind other content
      src={src}
      key="chat-background-video" // Added key for potential re-renders
    >
      Your browser does not support the video tag.
    </video>
  );
};