import React, { useState, useEffect } from 'react';

interface ViewportSize {
  width: number;
  height: number;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isTouchDevice: boolean;
}

export function useViewport(): ViewportSize {
  const [viewport, setViewport] = useState<ViewportSize>({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768,
    isMobile: false,
    isTablet: false,
    isDesktop: false,
    isTouchDevice: false,
  });

  useEffect(() => {
    function handleResize() {
      const width = window.innerWidth;
      const height = window.innerHeight;
      setViewport({
        width, height,
        isMobile: width < 640,
        isTablet: width >= 640 && width < 1024,
        isDesktop: width >= 1024,
        isTouchDevice: 'ontouchstart' in window,
      });
    }

    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return viewport;
}

export function ResponsiveWidget({ children }: { children: React.ReactNode }) {
  const viewport = useViewport();
  if (viewport.isMobile) return <div className="rc-widget-container rc-mobile">{children}</div>;
  if (viewport.isTablet) return <div className="rc-widget-container rc-tablet">{children}</div>;
  return <div className="rc-widget-container rc-desktop">{children}</div>;
}
