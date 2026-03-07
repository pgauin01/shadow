# 🤝 Contributing to Shadow OS

First off, thank you for considering contributing to Shadow OS! It's people like you that make open-source tools great. 

## 🛠️ Local Development Setup

### 1. Backend Setup
1. Navigate to the `/app` directory.
2. Create a virtual environment: `python -m venv venv`
3. Activate the environment:
   - Mac/Linux: `source venv/bin/activate`
   - Windows: `venv\Scripts\activate`
4. Install dependencies: `pip install -r ../requirements.txt`
5. Create your `.env` file (refer to `.env.example`).
6. Start the FastAPI server: `uvicorn main:app --reload`

### 2. Frontend Setup
1. Navigate to the `/shadow-client` directory.
2. Install Node dependencies: `npm install`
3. Start the Vite dev server: `npm run dev`

---

## 🌿 Branch Naming Conventions
To keep the repository clean, please adhere to the following branch naming conventions:

* **Feature:** `feat/your-feature-name` (e.g., `feat/add-dark-mode`)
* **Bugfix:** `fix/issue-description` (e.g., `fix/chat-auto-scroll`)
* **Documentation:** `docs/update-readme`
* **Refactor:** `refactor/api-routes`

---

## 🚀 Pull Request Process

1. **Fork** the repository and clone it locally.
2. **Branch** from `main` using the naming conventions above.
3. **Commit** your changes using clear, descriptive commit messages.
   * *Good:* `feat: implement zero-knowledge vault encryption`
   * *Bad:* `fixed crypto stuff`
4. **Push** your branch to your fork.
5. **Open a Pull Request** against the `main` branch. 
6. Include a clear description of what the PR solves or adds. Include screenshots if it involves a UI change.

## 🎨 Code Style
* **Frontend:** We use ESLint and Prettier. Run `npm run lint` before committing. Please utilize the semantic CSS variables (`bg-theme-card`, `text-theme-primary`) rather than hardcoding hex codes or specific Tailwind colors.
* **Backend:** We follow PEP 8 guidelines. Type hint your functions wherever possible. 

Thank you for contributing! 🌑☀️
