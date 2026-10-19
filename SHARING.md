# Sharing a project with co-writers

Inkling lets two or more people work on the same novel, each in Inkling on their own computer. This guide explains
how to set it up, what happens when you write at the same time, and what to do if something looks wrong.

Sharing works in the **Inkling desktop app** (Windows, Mac and Linux). The same guide is inside the app under
**Help › How sharing works**.

---

## How it works, in one minute

- The project lives in a folder that a **sync service** keeps the same on every computer: **Dropbox, Google Drive,
  OneDrive or iCloud Drive**. Inkling has no server and no accounts. Your sync service carries the files.
- When a co-writer's changes arrive, Inkling **merges** them with yours, piece by piece. Your new scene and their
  edited character page both survive.
- You can see **who else is in the project**, and which scene they are in.
- Your **pet, daily goal, to-do list, word history and focus timer** stay yours. The story is shared.
- It is **not live typing** like Google Docs. Changes arrive when the sync service delivers them, usually within a
  few seconds to a minute. It works best when co-writers write different scenes, or take turns.

---

## Setting it up

### The person who has the project

1. Open the project in Inkling.
2. Choose **File › Share this project…** (or **Share** next to the project on the **Projects** screen).
3. Under step 1, click **Move to a shared folder…** and pick a folder inside your Dropbox, Google Drive, OneDrive or
   iCloud Drive. Inkling copies the project there, checks the copy, and moves the original to your computer's trash.
   From then on the project lives in that folder and appears on your Projects list with a **Shared folder** tag.
4. In your sync service, share **that project's folder** (the one Inkling named in step 2 of the Share window)
   with your co-writers, and give them permission to **edit**:
   - **Dropbox:** right-click the folder › **Share** › invite by email, set to **Can edit**.
   - **Google Drive:** right-click › **Share** › add people as **Editor**. They then right-click the shared folder
     in **Shared with me** › **Organise › Add shortcut to Drive** so it appears on their computer.
   - **OneDrive:** right-click › **Share** › make sure **Can edit** is chosen. They choose **Add shortcut to My files**.
   - **iCloud Drive (Mac):** right-click › **Share** › **Share Folder**, with **Can make changes**.
5. Type your name under **Settings › You** (or in step 4 of the Share window).

### Each co-writer

1. Install Inkling from the [download page](https://github.com/GoMunster/inkling/releases/latest).
2. Make sure the shared folder has **finished syncing** to your computer (your sync service's icon shows a tick).
3. In Inkling choose **File › Open a shared project…** (or **Open a shared project…** on the Projects screen) and
   pick the project's folder: the one with `project.json` inside it.
4. Type your name under **Settings › You**.

The shared project is now on your Projects list. Inkling remembers where it is; you only do this once.

---

## Writing at the same time

### Who is here

- A chip at the top of the window shows who else has the project open (**"Ben is here"**). Click it to see which
  scene each person is in, and which version of Inkling they use.
- A coloured letter beside a scene in the binder shows who is in that scene.
- When you open a scene someone else is in, a note above the text says so.

### Sprinting together

When a co-writer starts a focus sprint, the chip at the top says so ("Ben sprinting") and Inky tells you. Click the
chip and choose **Join the sprint**: your focus timer starts and ends at the same moment as theirs, and their Inky sits
beside yours until it ends. Each of you keeps your own session and word count.

### What merges

Inkling checks for a co-writer's changes every few seconds, when you come back to the window, and whenever it saves.
When changes arrive, a message says who changed what.

| You and a co-writer… | What happens |
|---|---|
| change **different scenes** | Both changes are kept. |
| add **new** scenes, chapters, characters, places, things, timelines, outlines, notes, maps or trees | All of them are kept, in place. |
| **reorder** or **rename** chapters and scenes | Both people's moves and renames are kept; if you both renamed the same thing, the newer name wins. |
| change the **same scene** before the sync catches up | The newer text stays in the scene. The other person's text is saved as a **snapshot** of that scene, named after them ("Ann's version"). A note appears with a **Compare** button. |
| change the **same story page, timeline, outline, note, map or tree** | The newer change is kept. Earlier versions are in the project's Backups. |
| one **deletes** something the other is still changing | If the change came after the deletion, the item comes back. Otherwise it stays deleted. |

**Nothing you type is thrown away.** In a clash, the other text is in the scene's **Snapshots** (the clock button
above a scene, or **Edit › Scene snapshots…**), where you can compare it with the current text and copy back what
you need, or restore it.

### What stays yours

- **Yours alone:** your Inkling pet, your daily goal and today's words, your to-do list, your word history chart, your
  focus timer settings and your writing sessions. They are kept under the name you set, so use the **same name on each of your
  own computers** and your pet follows you.
- **Per computer:** appearance settings (theme, font, text size, spacing, page width, side panel widths, spellcheck)
  and whether Inky reads over your shoulder.
- **Shared by everyone:** all the writing and planning (scenes, chapter notes, story pages and pictures,
  timelines, outlines, notes and brainstorms, relationship maps, family trees, snapshots) and the export settings.

---

## Good habits

- **Agree who writes what.** Splitting by chapter or scene avoids clashes almost entirely.
- **Let the sync finish** before you start writing, especially after a computer has been asleep or offline.
- **Use the same version of Inkling.** Inkling tells you when a co-writer has a different version. Use
  **Help › Check for updates…**.
- **Keep the folder on your computer.** Some services keep files online-only until opened, which can make Inkling
  wait. Turn that off for the project folder:
  - Google Drive: right-click › **Offline access › Available offline** (or use "Mirror files" in its settings).
  - OneDrive: right-click › **Always keep on this device**.
  - iCloud Drive: right-click › **Keep Downloaded** (or **Download Now**).
  - Dropbox: right-click › **Make available offline**.
- **Take a snapshot before a big rewrite** of a scene someone else also works on.
- **Writing alone on two computers?** The same setup works: put the project in your sync folder and open it on both.

---

## If something looks wrong

**A co-writer's changes have not arrived.**
Check that their sync service is running and shows everything synced, and that yours does too. Then switch to
another window and back to Inkling, which makes it look again straight away.

**Text I expected is missing from a scene.**
Open that scene's **Snapshots**. A clash keeps the other version there, named after its writer. You can also open
**Projects › Backups**: Inkling saves a copy of the whole project at most every 10 minutes, and opening one makes a
separate project, so nothing is overwritten.

**There are files called "conflicted copy", "(1)" or with a computer's name in the project folder.**
Sync services make these when two saves cross. Inkling merges them in automatically and moves them into the
project's `backups` folder. You don't need to do anything.

**The shared project says "not found" on the Projects screen.**
Its folder was moved, renamed, or hasn't synced to this computer yet. Wait for the sync, or use
**Remove from list** and then **Open a shared project…** again at the folder's new place.

**Inkling says the project was made by a newer version.**
A co-writer has a newer Inkling. Update yours (**Help › Check for updates…**). Until you do, Inkling won't open the
project, and if it was already open it stops saving to it, so nothing of theirs gets overwritten.

**I want to stop sharing.**
In your sync service, stop sharing the folder or remove a person's access. To take a shared project off your own
Projects list without affecting anyone else, use **Remove from list**. (A shared project can't be deleted from
inside Inkling, so a co-writer can't delete it by accident. Delete the folder in your sync service if you really
mean to.)

**I want my own separate copy.**
Use **Duplicate** on the Projects screen. The copy is a normal project on your computer, not shared.

---

## Privacy

- The project is stored by your sync service, under that service's privacy terms.
- Everyone you share the folder with can read and change all of the project, including chapter notes and
  brainstorms.
- Inkling itself sends nothing anywhere. It only reads and writes the files in the folder.

---

## How it works, for the curious

- Each project folder holds `project.json` (the whole project), `info.json` (title and word count for the Projects
  list), `pictures/`, `backups/`, and `.inkling-here/` (one tiny file per computer that has the project open,
  refreshed every 30 seconds; that is how Inkling knows who is here).
- Every scene, story page, timeline, outline, note, map, tree, snapshot and session is a separate record carrying
  the time it last changed and who changed it. Deleting something leaves a dated marker.
- Inkling only replaces `project.json` if it is still the version it last read. If someone else saved in between,
  Inkling reads their version, merges record by record against the last version both of you had, and saves the
  result. A record changed on one side is taken from that side; a record changed on both keeps the newer change.
- Sync services' conflicted copies are merged the same way, then moved into `backups/`.
