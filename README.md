# Vibecraft Launcher

This is the official cross-platform launcher for the [Vibecraft Engine](https://github.com/quirinklr/vibecraft). It is built with modern web technologies using **Electron** and **Node.js** to provide a seamless and user-friendly experience for downloading, managing, and playing all available versions of the game.

## ✨ Features

*   **Automatic Release Fetching:** Pulls all available game versions directly from the official GitHub Releases page.
*   **Version Management:** Easily select and play any version, from the latest build to older, nostalgic releases. The newest version is always clearly marked with a "LATEST" tag.
*   **Automatic Updates:** Intelligently checks if an installed version has a new update on GitHub before every launch and downloads it if necessary.
*   **Embedded Release Notes:** Displays the official, fully formatted release notes (including images) for each version directly within the launcher.
*   **Modern, Dark-Themed UI:** A sleek, custom-designed user interface for a great user experience, including a modern, dark-themed scrollbar.

## 🚀 Getting Started (Running from Source)

This launcher is an Electron application. To run it from the source code, follow these steps:

#### Prerequisites

*   [Node.js](https://nodejs.org/) (which includes npm)

#### Steps

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/quirinklr/vibecraft-launcher.git
    cd vibecraft-launcher
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Run the application:**
    ```bash
    npm start
    ```

## 🎮 The Game Engine

This launcher is designed to run the **Vibecraft Engine**, a high-performance voxel engine built from scratch in C++20 with Vulkan. For more details on the game itself, please visit the main project repository:

➡️ **[Vibecraft Engine on GitHub](https://github.com/quirinklr/vibecraft)**

## 📄 License

This project is licensed under the MIT License. See the `LICENSE` file for more details.