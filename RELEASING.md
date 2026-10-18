# Releasing a new version of Inkling

Releases are built by GitHub Actions. You change the version number, push a tag, and the rest happens on its own.

## Steps

1. **Set the version.** Use the next number: `1.0.1` for fixes, `1.1.0` for new features, `2.0.0` for big changes.

   ```sh
   node desktop/scripts/version.js 1.1.0
   git commit -am "Inkling 1.1.0"
   git push
   ```

   This writes the number into `desktop/package.json` and into `APP_VERSION` in `index.html` (shown in Settings and
   saved in backups).

2. **Tag it and push the tag.**

   ```sh
   git tag v1.1.0
   git push origin v1.1.0
   ```

3. **Wait for the build** (about 15 minutes) on the repository's **Actions** tab. The **Desktop app** workflow runs
   the tests first and stops if any fail. Then it builds the Windows, macOS and Linux installers and publishes a
   GitHub Release with them and their update files (`latest.yml`, `latest-mac.yml`, `latest-linux.yml`, `.blockmap`,
   the macOS `.zip`).

4. **Write the release notes.** Open the new release on the **Releases** page and edit its text: a few plain lines
   on what changed. This is the page people see when they click **What's new** in the app, so write it for writers,
   not developers.

## What people see

- **Windows and Linux:** the app checks for updates at startup (and from **Help › Check for updates…**), downloads the
  new version in the background, then shows **Inkling 1.1.0 is ready to install** with a **Restart to update**
  button. If they choose Later, it installs the next time they quit.
- **macOS:** the app is not code-signed yet, and macOS only lets signed apps replace themselves. So it shows
  **Inkling 1.1.0 is out** with a **Download** button that opens the release page. People download the new `.dmg`
  and drag Inkling into Applications again, replacing the old one.
- After any update, the app says **Inkling was updated** once and offers the release notes.
- Projects are never touched by an update. They live in the projects folder, not inside the app.

People can switch automatic checks off in **Settings › Updates**.

## Telling people by hand

You can always just send people this link and ask them to download and install again over the old version:

    https://github.com/GoMunster/inkling/releases/latest

Installing over the old version keeps their projects and settings.

## Things to know

- **The repository must be public** for installed apps to see new releases. An app can't read releases of a private
  repository without a password built into it, which would be unsafe to ship. If you'd rather keep the code
  private, publish the releases from a second, public repository (change `publish.repo` in `desktop/package.json`
  and `REPO` in `desktop/main.js`).
- **Don't re-use a version number.** If a release is broken, fix it and release the next number.
- **Project format.** `FORMAT` in `index.html` is the version of the saved project layout. Raise it only when old
  projects need converting, and add the conversion to `MIGRATE` (from the old number to the next). A copy of Inkling
  that is older than a project's format opens it read-only and asks for an update, so nothing gets lost.
- **The web version** (the Claude artifact) updates when `index.html` is republished; it has no installer.
- **Testing a build before release:** run the **Desktop app** workflow by hand from the Actions tab (no tag). The
  installers appear under that run's **Artifacts**, and no release is published.
