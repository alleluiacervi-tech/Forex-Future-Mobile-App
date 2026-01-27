# Files to Ignore in Git

## ⚠️ CRITICAL - Never Commit These:

### Security & Secrets
- `.env` - Contains sensitive API keys, database credentials, JWT secrets
- `.env.local`, `.env.production.local` - Environment-specific secrets
- `*.key`, `*.p8`, `*.p12` - Private key files
- `*.jks` - Java keystores with sensitive data
- `*.mobileprovision` - iOS provisioning profiles

### Logs & Sensitive Data
- `logs/` - Application logs (may contain user data, errors, stack traces)
- `*.log` - All log files 
- `npm-debug.log`, `yarn-error.log` - Build tool logs
- `tmp/`, `temp/`, `.tmp/` - Temporary files

### Dependencies & Build Output 
- `node_modules/` - NPM/Yarn dependencies (700MB+)
- `package-lock.json`, `yarn.lock` - Lock files (use only for monorepos)
- `dist/`, `build/` - Compiled/bundled output
- `.cache/` - Build cache

### Development Tools
- `.vscode/` - IDE settings (can have personal preferences)
- `.idea/` - JetBrains IDE settings
- `.DS_Store` - macOS system file
- `Thumbs.db` - Windows system file

### Database
- `*.db`, `*.sqlite`, `*.sqlite3` - Local databases
- `.prisma/` - Prisma cache files

### Testing
- `coverage/` - Code coverage reports
- `.nyc_output/` - NYC coverage output

---

## ✅ SHOULD Commit These:

### Configuration Templates
- `.env.example` - Template showing what env vars are needed
- `prisma/schema.prisma` - Database schema
- `tsconfig.json`, `babel.config.js`, etc. - Configuration files

### Source Code
- `src/` - All source code
- `backend/src/` - Backend source code
- `*.ts`, `*.tsx`, `*.js`, `*.json` files

### Documentation
- `README.md` - Project documentation
- `docs/` - Documentation folder

### Package Files
- `package.json` - Dependencies list
- `.gitignore` - Ignore rules
- `LICENSE` - License file

---

## Current Setup:

### Root `.gitignore` includes:
✅ Dependencies (node_modules/)
✅ Environment files (.env, .env.*)
✅ Expo files (.expo/, dist/, web-build/)
✅ Security keys (*.key, *.jks, etc.)
✅ Logs directory (logs/, *.log)
✅ OS files (.DS_Store)
✅ IDE settings (.vscode/, .idea/)

### Backend `.gitignore` includes:
✅ All of the above
✅ Database files (*.db, *.sqlite)
✅ Build cache (.cache/)
✅ Testing coverage (coverage/)

---

## 🚀 Before First Commit:

1. **Verify `.env` is NOT tracked:**
   ```bash
   git status | grep -i ".env"
   # Should show: nothing
   ```

2. **Check `.gitignore` is working:**
   ```bash
   git check-ignore -v backend/.env
   # Should show: backend/.env (matched by pattern)
   ```

3. **Remove accidentally committed files:**
   ```bash
   git rm --cached backend/.env
   git rm --cached -r logs/
   git commit -m "Remove sensitive files from git history"
   ```

4. **Ensure `.env.example` exists:**
   ```bash
   git status backend/.env.example
   # Should show as untracked or staged
   ```

---

## 📝 Developer Setup:

When cloning the repo:

```bash
# Copy the example file
cp backend/.env.example backend/.env

# Edit with your actual values
nano backend/.env

# Frontend (if needed)
cp .env.example .env
nano .env
```

---

## 🔍 Checking Current Status:

List files Git is tracking that shouldn't be:

```bash
git ls-files | grep -E "(\.env|logs/|node_modules/|\.log)"
```

List files in working directory that are correctly ignored:

```bash
git check-ignore -v backend/.env logs/*.log
```
