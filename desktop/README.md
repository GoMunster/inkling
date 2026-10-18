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
    .inkling-here/   one small file per computer that has the project open (who is here, which scene)
```

Saving happens as you write and again when the window closes. Every save is written to a temporary file first
and then swapped in, so a crash or power cut cannot leave a half-written project. **File › Projects…**
(Ctrl/Cmd+O) lists every project, with New, Open, Duplicate, Backups (open any automatic backup as a copy),
Show folder and Delete (which moves the folder to the computer's trash, so it can be recovered).

## Using Dropbox, iCloud, Google Drive or OneDrive, and sharing with co-writers

For writers: the full guide is [SHARING.md](../SHARING.md) (also in the app under **Help › How sharing works**).

### Moving all your projects

**Settings › Projects folder › Change folder…** moves your projects into any folder, for example
`Dropbox/Inkling`. Each project is copied, checked, and only then is the old copy put in the trash. Choose **Use it
as it is** instead when the folder already holds your projects (setting up a second computer). The sync service
then backs everything up and carries it between computers.

### Sharing one project

**File › Share this project…** moves a single project into a folder you pick (say `Dropbox/Shared/`) and keeps it
on your list as a *linked* project (`settings.links` in the app's settings file maps its id to the folder).
Co-writers use **File › Open a shared project…** to link the same folder on their computers. Linked projects can't
be deleted from Inkling (only **Remove from list**), so nobody trashes everyone's copy by accident.

How two computers stay safe without a server:

- **Compare-and-swap saves.** `main.js` remembers the hash of `project.json` as this computer last read or wrote it,
  and refuses a save (`{conflict: true}`) when the file on disk is different. The page then reads the disk version
  (`DESK.read`, which also returns any conflicted copies a sync service made), merges, and saves with that version's
  token, so a third save arriving in between is never overwritten.
- **Record-by-record merge** in `index.html` (`mergeProjects`): three-way against the version both sides last had
  (`PJ.base`), using each record's change time (`_m`), author (`_by`) and the deletion times in `meta.gone`. A scene
  both sides changed keeps the newer text and saves the other as a snapshot.
- **Presence.** `.inkling-here/<computer>.json` holds name, scene and Inkling version, refreshed every 30 seconds;
  entries older than 2.5 minutes are ignored.
- **Personal stats** (pet, daily goal, word history, timer settings) are stored per writer in `meta.writers`.

The page checks for changes every 8 seconds and when the window gets focus.

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
`preload.js`) and saves through it instead of the browser or the Claude artifact. The page can only use the fixed
list of actions in `preload.js`, and `main.js` checks every project id and file name it is given.

```sh
cd desktop
npm install
npm start            # run it
npm run dist         # build an installer for this computer into desktop/dist/
```

### Updates and releasing

Installed copies check GitHub Releases for a newer version (electron-updater). Windows and Linux download it in the
background and offer **Restart to update**; macOS, unsigned, offers **Download** and opens the release page. See
[RELEASING.md](../RELEASING.md) for the steps: `node desktop/scripts/version.js 1.1.0`, commit, then push the tag
`v1.1.0`. The **Desktop app** workflow runs the tests, builds all three installers and publishes the release.

### Code signing (optional, later)

Without signing, people see the warnings described above. To remove them you need an Apple Developer account
($99/year) for macOS notarization and a Windows code-signing certificate. electron-builder reads them from the
`CSC_LINK` / `CSC_KEY_PASSWORD` (and, for Apple, `APPLE_ID` / `APPLE_APP_SPECIFIC_PASSWORD` / `APPLE_TEAM_ID`)
secrets; remove `CSC_IDENTITY_AUTO_DISCOVERY: false` and `"identity": null` when you add them.
