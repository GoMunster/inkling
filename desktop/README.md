# Inkling desktop app

A downloadable Inkling for Windows, macOS and Linux. It needs no Claude account and no internet connection,
and keeps any number of projects on the computer.

## Where projects are saved

Each project is a folder in **Documents › Inkling Projects** (on Linux without a Documents folder, in your home
folder):

```
Inkling Projects/
  the-glass-orchard-x7k2p/
    project.json     the whole novel (same format as a "Back up project" file)
    info.json        title, word count and last save, for the Projects screen
    pictures/        story page pictures, one file each
    backups/         automatic copies, at most one every 10 minutes, newest 40 kept
```

Saving happens as you write and again when the window closes. Every save is written to a temporary file first
and then swapped in, so a crash or power cut cannot leave a half-written project. **File › Projects…**
(Ctrl/Cmd+O) lists every project, with New, Open, Duplicate, Backups (open any automatic backup as a copy),
Show folder and Delete (which moves the folder to the computer's trash, so it can be recovered).

**File › Import a backup as a new project…** opens a backup made anywhere: in the desktop app, in a browser, or
in the Claude artifact. Pictures come with it.

## Installing (for users)

Download the file for your computer from the latest release on the
[Releases page](https://github.com/GoMunster/inkling/releases):

- **Windows:** `Inkling-…-win-x64.exe`. Run it and follow the installer. Windows may say *Windows protected your
  PC*, because the app isn't code-signed yet: click **More info → Run anyway**.
- **macOS:** `Inkling-…-mac-universal.dmg` (Apple silicon and Intel). Open it and drag Inkling into
  Applications. The first time, **right-click Inkling → Open → Open**, because it isn't notarized yet. If macOS
  says the app "is damaged", open Terminal and run `xattr -cr /Applications/Inkling.app`, then open it again.
- **Linux:** `Inkling-…-linux-x86_64.AppImage`. Make it executable (`chmod +x Inkling-*.AppImage`) and run it.

## Building (for developers)

The app is the same `index.html` as the web version. `scripts/prepare.js` copies it into `app/`, swaps the
Google Fonts link for bundled copies of the fonts (from Fontsource, SIL Open Font License) and adds a content
security policy that blocks all network access. `index.html` notices `window.inklingDesktop` (from
`preload.js`) and saves through it instead of the browser or the Claude artifact.

```sh
cd desktop
npm install
npm start            # run it
npm run dist         # build an installer for this computer into desktop/dist/
```

### Releasing

Push a version tag and GitHub Actions builds all three installers and attaches them to a new release:

```sh
git tag v1.0.0
git push origin v1.0.0
```

You can also run the **Desktop app** workflow by hand from the Actions tab; the installers then appear under
that run's **Artifacts**.

### Code signing (optional, later)

Without signing, people see the warnings described above. To remove them you need an Apple Developer account
($99/year) for macOS notarization and a Windows code-signing certificate. electron-builder reads them from the
`CSC_LINK` / `CSC_KEY_PASSWORD` (and, for Apple, `APPLE_ID` / `APPLE_APP_SPECIFIC_PASSWORD` / `APPLE_TEAM_ID`)
secrets; remove `CSC_IDENTITY_AUTO_DISCOVERY: false` and `"identity": null` when you add them.
