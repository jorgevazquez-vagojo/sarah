# Mobile Optimization Guide

## Overview
Sarah widget is fully optimized for mobile, tablet, and desktop devices.

## Breakpoints
- **xs** (< 640px): Mobile phones
- **sm** (641-768px): Tablets (portrait)
- **md** (769-1024px): Tablets (landscape)
- **lg** (1025-1280px): Desktop
- **xl** (> 1280px): Large desktop

## Mobile Features

### 1. Full-Screen Layout
- On mobile, widget takes full screen (100% width/height)
- No minimize button on mobile
- Clean, distraction-free UI

### 2. Touch Optimizations
- Minimum 44x44px tap targets
- No hover effects on touch devices
- Smooth scrolling (-webkit-overflow-scrolling: touch)

### 3. Responsive Messages
- Message max-width: 85% (mobile) → 65% (desktop)
- Font sizes scale: 13px (mobile) → 16px (desktop)
- Padding adjusts per breakpoint

### 4. Safe Area Support
- iPhone notch/safe area handled with CSS env vars
- Bottom safe area for home indicator

### 5. Orientation Support
- Landscape mode optimized for horizontal
- Portrait mode with full height scrolling

### 6. Accessibility
- Dark mode support (@media prefers-color-scheme)
- Reduced motion support (@media prefers-reduced-motion)
- High DPI display optimization

## Performance

### Bundle Sizes
- JavaScript: 85KB gzip (no increase)
- CSS: 4.57KB gzip
- Total: ~90KB

### Load Time
- First paint: < 500ms
- Interactive: < 1500ms
- Complete: < 2000ms

## Testing

### Real Device Testing
```bash
# Start dev server
npm -w widget run dev

# Test on mobile (same network)
# http://192.168.x.x:3000/widget/test.html
```

### DevTools Testing
```
Chrome/Firefox DevTools
→ Toggle Device Toolbar (Ctrl+Shift+M)
→ Test breakpoints:
   - iPhone 12: 390x844
   - iPad: 768x1024
   - Desktop: 1920x1080
```

## Common Issues & Fixes

### Widget not fullscreen on mobile
**Check**: Breakpoint in CSS should be `max-width: 640px`

### Text too small
**Check**: Font sizes for breakpoint
```css
@media (max-width: 640px) {
  .rc-message { font-size: 13px; }
}
```

### Tap targets too small
**Check**: Minimum 44x44px on touch
```css
@media (hover: none) {
  .rc-send-btn { min-height: 44px; min-width: 44px; }
}
```

## Future Improvements
- [ ] PWA (installable on home screen)
- [ ] Offline mode (service worker)
- [ ] Voice input
- [ ] Native app wrapper (React Native)
- [ ] Advanced gestures (pinch, swipe)

---
Last Updated: 2026-02-24
