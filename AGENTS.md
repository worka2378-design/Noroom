# Design System & UI Guidelines

## 1. Input Fields & Panels (Panels, Search, Vault Inputs)
- **Border Radius**: Always use full rounded styling (`rounded-full`) for all text inputs, password inputs, search bars, and dropdown selects across the application.
- **Background & Borders**: Default input background is `bg-neutral-50` with subtle border `border-neutral-200`. On focus: `focus:bg-white focus:border-neutral-900`.
- **Typography & Placeholders**: Input text is `text-neutral-900` with `placeholder:text-neutral-400`. Do not use redundant upper floating labels when placeholder is clear and self-explanatory.
- **Embedded Action Controls**: Action buttons inside inputs (e.g. password visibility toggle, search clear, submit arrows) must be embedded on the right inside the rounded container (`absolute right-1.5` / `right-3`) with proper internal padding (`pr-14` or `pr-9`).
- **Dropdown Selects**: Use `appearance-none` with an explicit `ChevronDown` icon positioned cleanly (`pr-9` padding) so the dropdown arrow never sticks to the edge.

## 2. Action Buttons & Controls
- **Text Color**: Pure dark/black text (`text-neutral-900`), not white text on dark gray boxes.
- **Button Styling**: `bg-neutral-100 hover:bg-neutral-200 active:bg-neutral-300 border border-neutral-300/80 rounded-full font-semibold text-xs transition-colors`.
- **Cancel / Secondary Buttons**: `text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-full font-medium text-xs`.
- **Icon Actions (Trash / Delete / Reset)**: By default neutral (`text-neutral-400`), transition to red on hover (`hover:text-red-600 hover:bg-red-50/60`).

## 3. Typography & Font Family
- **Global UI Font**: Strict native system font stack: `system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`.
- **Note Content Typography**: Rich text editor content uses serif typography (`Times New Roman`, `Tinos`, Georgia, serif) with customizable font styles.

## 4. Modal Cards & Containers
- **Card Styling**: `rounded-2xl shadow-xl border border-neutral-200 bg-white p-6`.
- **Backdrop**: Subtle dark blur `bg-black/20 backdrop-blur-xs`.
- **Lock Screen**: Clean minimalist card, centered logo (`LogoIcon`), embedded input submit arrow, no unnecessary dividers or technical encryption subtitles.
