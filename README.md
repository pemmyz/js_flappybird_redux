# js_flappybird_redux

# Flappy Bird 2.5D Redux

A modern **2.5D Three.js remake** of the classic Flappy Bird ---
featuring real 3D models, shadows, lighting, difficulty modes, and an
optional AI "Autobot."

This project renders the world in WebGL using **Three.js (r128)** while
keeping gameplay logic classic, simple, and fast.

------------------------------------------------------------------------

## 🎮 Features

### ⭐ 2.5D Rendering (Three.js)

-   Fully 3D bird, pipe models, lighting, and shadows\
-   Perspective camera tuned to mimic the original 2D gameplay feel\
-   Smooth transitions and animation-based bird rotation

### ⭐ Game Mechanics

-   Classic Flappy Bird movement, pipe spawning, and scoring\
-   Three difficulty modes:
    -   **Normal**
    -   **Hard**
    -   **Extra Hard**\
-   Adjustable pipe gap displayed in real time\
-   On-screen mobile controls

### ⭐ Autobot System

-   Optional AI "Autobot" that plays automatically\
-   Idle countdown auto-start demo mode\
-   Demo status UI indicator

### ⭐ UX & Visuals

-   Clean UI overlays for score, difficulty, autopilot, pipe gap\
-   Start / Pause / Game Over overlays\
-   Mobile-friendly layout with touchscreen flap + pause buttons

------------------------------------------------------------------------

## 🧩 Controls

  Action              Key / Input
  ------------------- -------------------------------------------------------------
  Flap                **SPACE**, **UP ARROW**, **Left Click**, or **FLAP Button**
  Pause               **P** or Pause Button
  Change Difficulty   **N** or MODE Button
  Toggle Autobot      **B**

------------------------------------------------------------------------

## 🚀 Setup & Run

1.  Place the following files in the same directory:
    -   `index.html`
    -   `style.css`
    -   `script.js`
2.  Simply open **index.html** in any modern browser.\
    No build tools are required.

------------------------------------------------------------------------

## 📁 File Structure

    /
    ├── index.html   # UI layout + Three.js canvas container
    ├── style.css    # Styling for UI and overlays
    └── script.js    # Game logic + rendering + physics + autobot

------------------------------------------------------------------------

## 🛠️ Technologies Used

-   **Three.js r128**
-   **WebGL** for rendering
-   **HTML/CSS** for UI overlays
-   **Vanilla JavaScript** for game logic

------------------------------------------------------------------------

## 📝 License

You may freely modify, share, and use this project in any personal or
educational context.
