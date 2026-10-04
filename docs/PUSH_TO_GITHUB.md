# Push StayOps AI to GitHub

Suggested new repository name:

`StayOps-AI-PG-Management`

Create an empty GitHub repository with that name, then from this project directory run:

```bash
git remote add origin https://github.com/<your-username>/StayOps-AI-PG-Management.git
git push -u origin main
```

The local repository already has its full history and the current `main` branch.

Important before pushing:

- Do not commit `backend/.env` or any API key.
- Set `GEMINI_API_KEY` only in the backend deployment environment.
- Run the three SQL setup/migration files in the README.
- Run `npm ci` in both `backend` and `frontend` before the first local build.
