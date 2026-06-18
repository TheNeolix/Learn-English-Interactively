# Gamified Learn English Website - Design Guide

This design guide documents the overarching design system, color palettes, typography, layout structures, and gamification UI mechanics used across the **Neolix Studio Learn English** web application.

---

## 1. Design Philosophy

The platform embraces a **modern, engaging, and premium gamified** learning experience. It utilizes **Dark Mode by default**, accented with vibrant, neon-inspired colors, **glassmorphism** (frosted glass) UI elements, and fluid animations. The primary objective is to make learning English feel like an immersive, rewarding game, driving user retention through daily mechanics and visual progression.

---

## 2. Typography

The design relies on two complementary Google Fonts to establish a clear hierarchy:

- **Headings Font**: `'Outfit', sans-serif`
  - High-geometry, bold font suited for energetic headers, modal titles, and level indicators.
- **Body Font**: `'Inter', sans-serif`
  - Highly legible, neutral sans-serif font utilized for UI text, lesson content, instructions, and user progress statistics.
- **Fluid Sizing**: Utilizes CSS `clamp()` and responsive units to dynamically scale typography across desktop and mobile screens without breaking structural integrity.

---

## 3. Color Palette & Theming (OKLCH System)

The core palette is built using the **OKLCH** color space to achieve uniform perceived brightness and vibrant saturation. The platform now supports a **Dynamic Theme Engine** (e.g., Cyberpunk, Nature) that seamlessly overrides root CSS variables when purchased via the Gamification Shop.

### 3.1. Default Theme Variables
| Variable             | Value                       | Application                |
| :------------------- | :-------------------------- | :------------------------- |
| `--color-bg-base`    | `oklch(0.15 0.01 260)`      | Primary background         |
| `--color-bg-surface` | `oklch(0.2 0.02 260 / 0.5)` | Glassmorphism cards        |
| `--color-text-main`  | `oklch(0.95 0.01 260)`      | Primary typography         |
| `--color-text-muted` | `oklch(0.7 0.02 260)`       | Secondary text & subtitles |
| `--color-accent-in`  | `oklch(0.75 0.15 250)`      | Primary brand accent (Blue)|
| `--color-accent-on`  | `oklch(0.75 0.18 310)`      | Secondary accent (Purple)  |
| `--color-success`    | `oklch(0.75 0.2 150)`       | Gamification success state |
| `--color-error`      | `oklch(0.65 0.2 25)`        | Errors and failed tests    |

### 3.2. Dynamic Gamification Themes
Themes inject custom values into the `:root` via `[data-theme="..."]`:
- **Cyberpunk Neon**: Swaps backgrounds to deep magenta/cyan hues (`oklch(0.12 0.05 320)`).
- **Nature**: Swaps backgrounds to earthy greens and soft yellows (`oklch(0.15 0.05 140)`).

---

## 4. Layout & UI Components

### 4.1. Glassmorphism Panels
All primary containers, modals, and sidebar cards utilize frosted glass effects to blend into the animated radial gradients in the background:
```css
.proto-card {
    background: var(--color-bg-surface);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid oklch(1 0 0 / 0.1); /* Subtle rim lighting reflection */
    box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
    border-radius: 20px;
}
```

### 4.2. Gamified Learning Roadmap (SVG Nodes)
The central dashboard features a dynamic SVG path representing the learning journey.
- **Background Animations**: A continuously floating `radial-gradient` moves across the background to keep the interface feeling "alive".
- **Roadmap Mechanics**: Nodes representing individual lessons (A1, A2, B1) are absolutely positioned over an SVG stroke. As users progress, the SVG stroke mathematically fills up using `stroke-dashoffset` relative to completion data. On mobile viewports, the roadmap seamlessly shrinks to accommodate smaller screen dimensions.

### 4.3. Modals & Sidebars
- **Sidebar**: The sticky sidebar displays critical gamified states: **Daily Streaks (🔥)**, **Total XP (XP)**, **Daily Quests**, and **Quick Shop Widgets**.
- **Modals (`.auth-modal-overlay`)**: Used universally for Authentication, Daily Quests lists, the full Jutalom Bolt (Shop), and detailed Profile Statistics. They dim the background and center the content using CSS Flexbox.

---

## 5. Micro-interactions and Audio

The platform relies heavily on immediate psychological feedback:
- **Audio Feedback**: A custom built `AudioSynth` synthesizer is integrated to play specific waveforms (`playCorrect()`, `playLevelUp()`, `playSuccess()`) when an action is completed, mirroring video game reward loops.
- **Button States**: Buttons feature transition durations of `0.2s ease` for background shifts, slight scaling (`transform: translateY(-2px)`), and distinct visual feedback when an item transitions from "Feloldás" (Unlock) to "Aktiválva" (Activated).
- **Accessibility**: All animations and Web Audio API interactions respect `prefers-reduced-motion` settings or in-app toggles.

---

## 6. Responsive Strategy

The architecture is responsive by design, automatically reflowing into a vertical single-column stack on screens under `1024px` (and `768px` for mobile).
- The roadmap width and node offsets dynamically recalculate on `window.resize`.
- The main application grid shifts from `grid-template-columns: 1fr 320px` to `grid-template-columns: 1fr`, hiding or repositioning the sidebar modules gracefully below the main roadmap.
