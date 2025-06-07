'use client';

import React from 'react';

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
  if (!isActive) {
    return null;
  }

  return (
    <div
      className="fixed top-0 left-0 w-screen h-screen object-cover z-0 bg-cover bg-center"
      style={{ 
        backgroundImage: poster ? `url(${poster})` : `url(/images/background.avif)`,
        backgroundAttachment: 'fixed'
      }}
    />
  );
};
