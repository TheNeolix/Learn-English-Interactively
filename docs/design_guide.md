# Gamified Learn English Website - Design Guide

This design guide documents the overarching design system, visual guidelines, typography, layout structures, and gamification UI mechanics used across the **Neolix Studio Learn English** web application. It is designed to onboard UI/UX designers and front-end developers, maintaining absolute visual consistency and premium quality.

---

## 1. Design Philosophy

The platform embraces a **modern, engaging, and premium gamified** learning experience.
* **Dark Mode by Default**: The interface uses a dark background to reduce eye strain, establish a high-tech/gaming environment, and make colorful interactive elements stand out.
* **Vibrant Accent Colors**: Bold neon accents contrast against the dark background, guiding the user's attention to interactive elements, call-to-actions, and progress indicators.
* **Glassmorphism (Frosted Glass)**: Translucent panels blend with moving ambient background glows, creating physical depth and a futuristic feel.
* **Fluid Feedback Loops**: Visual and auditory rewards (micro-animations, audio chimes, progress updates) trigger immediately on correct actions to drive daily engagement and retention.

---

## 2. Typography System

The design establishes hierarchy and energy using two Google Fonts loaded globally:

* **Headings Font**: `'Outfit', sans-serif`
  * **Characteristics**: Geometric, bold, clean, and energetic.
  * **Usage**: Main titles (`h1`, `h2`, `h3`, `h4`), branding (`.logo-text`), node labels, modal headers, level identifiers, and large statistics.
* **Body Font**: `'Inter', sans-serif`
  * **Characteristics**: Highly readable, neutral, screen-optimized sans-serif.
  * **Usage**: Paragraphs, exercise sentences, translations, labels, button texts, settings panels, and tooltips.
* **Responsive Scaling**: Utilizes fluid typography with `clamp()` and viewport units (e.g., `font-size: clamp(1.5rem, 4vw, 2.5rem)`) to scale header typography without breaking layouts.

---

## 3. Color Palette & Theming (OKLCH System)

The core color system is built using the **OKLCH** color space to achieve uniform perceived brightness, highly saturated neon accents, and smooth transitions. The platform implements a **Dynamic Theme Engine** that overrides root CSS variables when themes are purchased and activated via the Jutalom Bolt (Reward Shop).

### 3.1. Default Theme Variables
| Variable | Value | Description | Application |
| :--- | :--- | :--- | :--- |
| `--color-bg-base` | `oklch(0.15 0.01 260)` | Deep Midnight Blue | Body background |
| `--color-bg-surface` | `oklch(0.2 0.02 260 / 0.5)` | Translucent Slate (50% Opacity) | Glassmorphism cards & navigation headers |
| `--color-text-main` | `oklch(0.95 0.01 260)` | Off-White | Primary copy and active states |
| `--color-text-muted` | `oklch(0.7 0.02 260)` | Soft Gray-Blue | Secondary metadata, descriptions, subtitles |
| `--color-accent-in` | `oklch(0.75 0.15 250)` | Neon Blue | Primary accent, links, active roadmap line |
| `--color-accent-on` | `oklch(0.75 0.18 310)` | Electric Magenta | Secondary accent, badges, shop icons |
| `--color-accent-at` | `oklch(0.8 0.18 150)` | Lime Green | Tertiary accent, completion highlights |
| `--color-success` | `oklch(0.75 0.2 150)` | Neon Green | Success indicators, correct quiz answers |
| `--color-error` | `oklch(0.65 0.2 25)` | Coral Red | Warnings, failed attempts, logout danger state |

### 3.2. Dynamic Shop Themes
Activated by applying `data-theme` attributes to the HTML element:

* **Cyberpunk Neon (`[data-theme="cyberpunk"]`)**
  * `--color-bg-base`: `oklch(0.12 0.05 320)` (Deep Magenta-Black)
  * `--color-bg-surface`: `oklch(0.15 0.08 320 / 0.7)` (Highly saturated purple tint)
  * `--color-accent-in`: `oklch(0.7 0.25 320)` (Hot Pink)
  * `--color-accent-on`: `oklch(0.8 0.2 190)` (Cyan)
  * `--color-accent-at`: `oklch(0.85 0.2 120)` (Yellow)
* **Természet / Nature Theme (`[data-theme="nature"]`)**
  * `--color-bg-base`: `oklch(0.15 0.05 140)` (Deep Forest Green)
  * `--color-bg-surface`: `oklch(0.2 0.08 140 / 0.6)` (Soft Moss Tint)
  * `--color-accent-in`: `oklch(0.75 0.2 140)` (Vibrant Leaf Green)
  * `--color-accent-on`: `oklch(0.8 0.15 100)` (Golden Lime)
  * `--color-accent-at`: `oklch(0.7 0.15 60)` (Warm Earth Orange)

---

## 4. Layout & UI Components

### 4.1. Glassmorphism Panels (`.proto-card`)
Containers utilize frosted glass properties to overlay cleanly onto the animated radial gradients in the background:
```css
.proto-card {
    background: var(--color-bg-surface);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid oklch(1 0 0 / 0.1); /* Subtle rim lighting */
    box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
    border-radius: 20px;
}
```

### 4.2. Header & Mobile Navigation Drawer
* **Desktop Header**: Fixed to the top (`70px` height) with blurred background. Houses the logo, horizontal navigation links, user greeting, and logout button.
* **Mobile Hamburger Toggle**: Consists of 3 horizontal lines (`.hamburger-line`) that rotate and morph into an "X" when clicked (`.mobile-menu-toggle.is-active`).
* **Navigation Drawer**: A full-width vertical menu that slides down (`translateY(0)`) from the header on mobile viewports.

### 4.3. Interactive Learning Roadmap
The centerpiece of the dashboard is an interactive SVG path mapping out the lessons:
* **The Living Line**: An SVG path winding dynamically down the page. As lessons are completed, the path fills in with a glowing gradient utilizing dynamic `stroke-dasharray` and `stroke-dashoffset` computations.
* **Roadmap Nodes (`.roadmap-node`)**:
  * **Locked**: Dimmed, opaque, non-clickable state (`pointer-events: none`).
  * **Unlocked/Active**: Highlighted with pulse glow, pulsing indicators, and full color gradients indicating they can be started.
  * **Completed**: Solid neon green border/shadow with a checkmark indicator or rating indicator.
* **Hero Roadmap Header**: Displays current level statistics, dynamic progress bars, and "Resume Learning" call-to-actions.

### 4.4. Interactive Exercise Panels
* **Vocabulary Cards**: Structured lists of words with dynamic pronunciation icons (`🔊`) and click-to-expand details.
* **Word-Order Chips (`.word-chip`)**: Individual interactive buttons representing words in a scrambled sentence. When clicked, they move smoothly into the target builder field.
* **Dialog Modals (`.modal-overlay`)**: Dimmed, blurred background overlays (`backdrop-filter: blur(8px)`) centering content cards with entry animations (`scale` and `translateY`).

---

## 5. Micro-interactions & Animations

To keep the application feeling responsive and alive, animations are used to direct focus:

* **Background Radial Gradients (`livingRoadmapBg` & `gradientMove`)**: Continuous, slow shifting of ambient background radial gradients (`15s` duration, infinite looping) to create visual depth.
* **Floating XP Pops (`floatUpFade` / `feedbackPop`)**: Floating numeric labels (e.g., `+10 XP`) that float upwards and fade out at the cursor position when points are awarded.
* **Locked Modal Alerts**: Pulsing text animations (`pulse` keyframe) and shake indicators to signal that pre-requisite exercises are still locked.
* **Button Transitions**: Interactive buttons use a standard transition (`0.3s ease` or `0.2s ease`) with scale changes (`transform: translateY(-2px) scale(1.02)`) and box-shadow glows.

---

## 6. Accessibility & Responsiveness Strategy

### 6.1. Mobile-First Optimization
* Layout shifts from a multi-column desktop grid (`grid-template-columns: 1fr 320px` to handle main learning area next to the sticky sidebar) to a single-column layout on screens below `1024px`.
* Touch targets for all interactive actions (close buttons, chips, menu items) enforce a minimum height of `44px` for fingers.

### 6.2. Motion Safeguards
All keyframes and transition timings are wrapped or bypassed if the user has system or application-level reduced-motion settings enabled:
```css
@media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
        animation-delay: -1ms !important;
        animation-duration: -1ms !important;
        animation-iteration-count: 1 !important;
        background-attachment: initial !important;
        scroll-behavior: auto !important;
        transition-duration: 0s !important;
    }
}
```
In JavaScript, `AudioSynth.reducedMotion` is set to `true`, preventing synthetic audio playbacks to keep operations non-intrusive.
