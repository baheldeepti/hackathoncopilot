
# 🚀 GitHub Deployment Guide

If you are having trouble connecting to GitHub or want to deploy this app, follow these steps to troubleshoot and launch.

## 🔧 Phase 1: Fix Connection Issues

If you see errors like `Permission denied (publickey)` or `Could not resolve host`, you are likely trying to use SSH without keys. **Switching to HTTPS** is the easiest fix.

1.  **Check your current remote**:
    ```bash
    git remote -v
    ```
2.  **Switch to HTTPS** (if the URL starts with `git@github.com`):
    ```bash
    # Replace USERNAME and REPO with your actual details
    git remote set-url origin https://github.com/YOUR_USERNAME/hackathon-copilot.git
    ```
3.  **Authentication**:
    When you push, you will need your **GitHub Username** and a **Personal Access Token**.
    *   *Password* authentication was removed in 2021.
    *   Go to **GitHub Settings** -> **Developer Settings** -> **Personal access tokens (Classic)**.
    *   Generate a new token with `repo` scope.
    *   Use this token string as your password when prompted in the terminal.

---

## 📦 Phase 2: Push Code to GitHub (First Time)

1.  **Create a Repository**: 
    Go to [github.com/new](https://github.com/new) and create a repository named `hackathon-copilot`.
    *   *Important*: Do not check "Add a README" or "Add .gitignore". Keep it empty.

2.  **Initialize Project** (In your terminal/project folder):
    ```bash
    git init
    git add .
    git commit -m "Initial launch of Hackathon Copilot"
    ```

3.  **Link & Push**:
    ```bash
    git branch -M main
    # Replace with YOUR new repository URL
    git remote add origin https://github.com/YOUR_USERNAME/hackathon-copilot.git
    git push -u origin main
    ```

---

## 🌍 Phase 3: Deploy Live

Since this is a React application, the easiest way to host it for free is **Vercel**.

1.  Go to [vercel.com](https://vercel.com) and **Sign Up with GitHub**.
2.  Click **"Add New..."** -> **"Project"**.
3.  Select your `hackathon-copilot` repository from the list.
4.  Click **Deploy**.
    *   Vercel will automatically detect the framework and deploy your site globally.
    *   You will get a live URL (e.g., `hackathon-copilot.vercel.app`) to share.

### Alternative: GitHub Pages
If you prefer GitHub Pages:
1.  Ensure you have a build script in `package.json`.
2.  Go to Repository **Settings** -> **Pages**.
3.  Source: **GitHub Actions**.
