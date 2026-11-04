# Checkpoint, Git and submission guide — Windows PowerShell

The three ZIPs are cumulative snapshots, not three separate projects. Download all three into Downloads. Commands below assume their names have not changed. A line starting with `#` is an explanation, not a command.

## Part 1: new folder and first commit

In PowerShell:

```powershell
$parent = Join-Path $HOME 'Desktop\fse-01-assessment'
if (Test-Path $parent) { throw 'Folder already exists. Choose a different NEW folder.' }
New-Item -ItemType Directory -Path $parent | Out-Null
Expand-Archive -LiteralPath (Join-Path $HOME 'Downloads\production-dashboard-part1.zip') -DestinationPath $parent
$project = Join-Path $parent 'production-dashboard'
Set-Location $project
Get-ChildItem -Force
Get-Content .gitignore
git init
git status --short
git check-ignore .env
```

`git check-ignore .env` should print `.env`. Never place CA private keys or credentials in the project. Review files. Then:

```powershell
git add .
git diff --cached --stat
git diff --cached --name-only
# Optional full review: git diff --cached
git commit -m "Add PostgreSQL event processing and REST endpoints"
```

If Git requests a name or email, set your own with `git config user.name "Your Name"` and `git config user.email "your-email@example.com"`, using your actual choices; then repeat the commit. Confirm `git log --oneline -1`. Do not claim it worked unless the output confirms it.

## Part 2: safely overlay and commit

Confirm you are in `$project` and `git status --short` shows no unexpected changes. This checkpoint replaces only files named in its ZIP; check the filenames first and do not overwrite unrelated files you care about. There are **no required deletions or renames** between these checkpoints. The ZIP contains no .git, .env, secrets or node_modules.

```powershell
$project = Join-Path $HOME 'Desktop\fse-01-assessment\production-dashboard'
Set-Location $project
$unpack = Join-Path $env:TEMP ('fse-part2-' + [guid]::NewGuid().ToString())
Expand-Archive -LiteralPath (Join-Path $HOME 'Downloads\production-dashboard-part2.zip') -DestinationPath $unpack
Get-ChildItem -LiteralPath (Join-Path $unpack 'production-dashboard') -Force
Get-ChildItem -LiteralPath (Join-Path $unpack 'production-dashboard') -Force | Copy-Item -Destination $project -Recurse -Force
git status --short
git diff --stat
git diff
# Review before staging, then:
git add .
git diff --cached --stat
git diff --cached --name-only
git commit -m "Add production review dashboard"
```

Inspect the staged filenames before committing: no `.env`, certificates, keys, node_modules or unrelated files. If something unsafe is staged, stop and unstage it before committing.

## Part 3: safely overlay and commit

Again, check for uncommitted changes and conflicting unrelated files first. **No project files require deletion or renaming.** This overlay preserves `.git`, `.env`, and node_modules; it can replace same-named project files and the dependency lockfile. Then install updated dependencies and inspect the changes:

```powershell
Set-Location $project
$unpack = Join-Path $env:TEMP ('fse-part3-' + [guid]::NewGuid().ToString())
Expand-Archive -LiteralPath (Join-Path $HOME 'Downloads\production-dashboard-part3.zip') -DestinationPath $unpack
Get-ChildItem -LiteralPath (Join-Path $unpack 'production-dashboard') -Force
Get-ChildItem -LiteralPath (Join-Path $unpack 'production-dashboard') -Force | Copy-Item -Destination $project -Recurse -Force
npm install
git status --short
git diff --stat
git diff
git add .
git diff --cached --stat
git diff --cached --name-only
git commit -m "Add MQTT challenge handling and assessment tests"
git log --oneline -3
```

## GitHub

On GitHub, create a NEW empty repository (no starter README). Copy its HTTPS URL. In the project folder, replace the placeholder in the first line with your own URL:

```powershell
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
git branch -M main
git push -u origin main
git status
git log --oneline -3
git ls-remote origin refs/heads/main
git rev-parse HEAD
```

Use Git's normal secure authentication flow. If the remote already exists, inspect `git remote -v` rather than adding another. The hash from `ls-remote` should match `rev-parse HEAD`. Also open the repository in GitHub and check the files and three commits. A push is not successful until Git reports success and you verify it. You may push earlier checkpoints as well, after reviewing each.

## Test and final ZIP

Follow SUPABASE_SETUP_GUIDE.md for the NEW database. After privately configuring `.env`, run `npm run migrate`, `npm test`, and `npm start`. Open the dashboard and `/health`; check with the examiner's MQTT simulator. Tests insert synthetic data and do not delete it. Capture genuine dashboard, REST and successful MQTT evidence without secrets. Add screenshots to `screenshots/`, review and commit them (a fourth commit is fine), and push. Update TEST_RESULTS.md and AI_USAGE.md truthfully; commit and push any edits.

When all intended submission files are tracked and committed:

```powershell
git status --short
git ls-files
git ls-files | Select-String '(^|/)(\.env$|node_modules/|\.git/)|\.(pem|key|crt)$'
git archive --format=zip --output="$HOME\Desktop\final-source.zip" HEAD
tar -tf "$HOME\Desktop\final-source.zip"
git ls-remote origin refs/heads/main
git rev-parse HEAD
```

The secret-file search should return no matches. Inspect the archive listing. `git archive` includes the committed files from HEAD, not untracked files; `git status --short` must be clear if the working folder is to match it. Confirm the GitHub hash matches HEAD. Never include secrets or generated dependencies. Provide the complete relevant AI record by the examiner's accepted method, including assessment help from other chats. Ask about redacting unrelated personal material.

## Form and demo

Form: your full name; Candidate Id `04`; Email Address your real email (not 04); final GitHub link; upload `final-source.zip` (100 MB max); actual technology stack; relevant AI-use link or file (file max 10 MB); choose I agree only if the listed files are actually in the repository.

Demo: show the dashboard; submit COUNT +5; resend the same JSON and show a duplicate without another increase; submit a VOID before its matching COUNT and show resolution; acknowledge pending rows; ask the examiner to send a real MQTT challenge and show its correlated response and an exception. Report honestly if any part fails or cannot be verified.
