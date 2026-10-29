# Descendant Builder

An editable descendant chart that runs entirely in your web browser. Pick a person and see their partners, their children, grandchildren and every generation after. It is the companion to [Pedigree Builder](https://github.com/MaxJohnston/pedigree-builder), which goes the other way (a person and their ancestors), and the two apps can pass people back and forth.

There is nothing to install, no account and no server. Your tree stays in your own browser.

The page opens with a sample: the descendants of **William Randolph of Turkey Island** (about 1651–1711) and his wife **Mary Isham**, from Robert Isham Randolph's *The Randolphs of Virginia* (Chicago, 1936), covering the first five generations (about 1,180 people with their partners) to keep the page light.

---

## Try it

1. **Online.** Open the project's GitHub Pages site.
2. **On your own computer**, offline. Either:
   - **One file:** open the repository's **Releases** page (on the right of the main page), download `descendant-builder.html` from the latest release, and double-click it. Everything is inside that one file.
   - **The whole project:** click the green **Code** button, then **Download ZIP**. Unzip it and double-click `index.html`. Keep the `css` and `js` folders next to it; the page needs them.

The online site and a downloaded copy keep separate trees, because browsers store data per website. Export a backup now and then.

## Reading the chart

- Generations run from **left to right**: the person the chart starts from on the left, their children in the next column, then grandchildren, and so on.
- Each person's **partners** are the lighter cards stacked next to them. The ring symbol shows the marriage year when it is known.
- Partners are joined to the person by a bracket on the right. One partner sits under the person. With several, they alternate above and below (nearest first), each couple has its own bracket, and the brackets step outwards so they stay apart. Each couple's children branch off from the middle of their bracket, so every child is joined to both parents.
- **Colours** follow the lines of descent: each child of the person at the start of the chart has a colour, and all of their descendants share it. The legend above the chart names them; click one to jump to it.
- A **dashed partner card** is someone who also descends from the person at the start of the chart (for example when cousins married); if the couple's children are already drawn under the other cousin, the card says "children elsewhere". A **"Shown above"** card marks a child who is already drawn elsewhere on the chart.
- **View → Hide partners** leaves out the partner cards so only the descendants are shown, which makes the chart much shorter. Partners still show while editing.
- **View → Draw lines to people already shown instead of repeating them** swaps those repeat cards for dashed lines that run to the person's card where it is already drawn. The lines can cross other lines.
- To save space, each family is packed as tightly as its own columns allow: a family slides up into any gap beside its cousins, and someone with no descendants shown sits beside their nieces and nephews. Lines never overlap.
- **+N ›** at the end of a card means that person has N more descendants beyond the generations shown. Click it to start the chart from them.

## Moving around

- **Generations** sets how many columns are shown.
- Drag to pan; Ctrl or ⌘ + scroll to zoom; **Fit to screen** shows everything.
- **Find a person** searches names, places, years and index numbers.
- Click **⌄** on a card for details. Click a name in the details to go to that person.
- **How they descend from …** in a card's details shows only the lines from the start of the tree down to that person, with every route when they descend more than one way (for example through cousins who married). Someone who married a cousin on another line is drawn once, as the partner beside that cousin, with a dashed line from their own parents that comes in from the left like any other child line. The status line counts the lines of descent and how many generations each takes. **Show everyone** under the title goes back to the full chart.
- The tree icon on a card starts the chart from that person. The links under the title go back up to their parents, or back to the start of the tree.

## Notable descendants

Click **★ Notable descendants** in the toolbar to open a list of everyone descended from the person at the start of the chart whose **Notable for** field is filled in (set it with the pencil in edit mode). Each entry gives what they are known for, their relationship (for example *great-grandson*), how many generations down they are, and how many lines of descent they have when there is more than one.

- Click someone in the list to show how they descend: the chart keeps only the lines from the start of the chart down to them. Click them again, or **Show everyone**, to go back.
- The **W** button opens their Wikipedia article (or other linked page) in a new tab.

The Randolph sample marks Thomas Jefferson, Chief Justice John Marshall, Edmund Randolph, Peyton Randolph, John Randolph of Roanoke and others.

Anyone with a **Wikipedia link** also gets a **W** button on their card, partners included.

## Index numbers

Every descendant gets an index number in the style used by *The Randolphs of Virginia*: one digit per generation, each digit the person's place among their brothers and sisters, with `x` for 10, `a` for 11, `b` for 12 and so on. So `237` is the 7th child of the 3rd child of the 2nd child of the person at the start of the tree. The number is shown in each person's details. The sample tree also keeps the number printed in the book.

## Editing

Click **Edit**. Then:

- The **pencil** on a card edits that person: names, sex, dates (exact or about, before, after, between), places, seat or home, occupation, notable for, a Wikipedia link, notes and sources. On a partner card the form also has the marriage date and place.
- Dashed **Add child** and **Add partner** cards appear under everyone shown. Someone with no children yet gets an **Add child** card even in the last generation shown. A card's details (⌄) also have **Add partner** and **Add child** buttons. Big charts draw only the cards near the part you are looking at, so they stay fast with the dashed cards shown. When adding a partner you can link someone already in the tree instead of typing them in again, for example a cousin.
- In a person's form you can move them earlier or later among their brothers and sisters, sort the children by birth year, remove a marriage, open the tree on that person instead, or delete them. Deleting also removes anyone who would no longer be connected to the tree; the form tells you how many first.
- **Undo** and **Redo** (Ctrl or ⌘ + Z / Y) cover every change. Changes save in the browser as you go.

## Backing up, importing and exporting

**Edit → Backup & import**:

- **Export as .txt file**: a full backup.
- **Export as GEDCOM (.ged)**: for Ancestry, FamilySearch, MyHeritage and other programs.
- **Send someone's ancestry to Pedigree Builder**: pick a person and download a Pedigree Builder file of them and all their ancestors in this tree.
- **Import**: a Descendant Builder or **Pedigree Builder** backup (.txt) or read-only web page (.html, including packed pages), or a GEDCOM file. A Pedigree Builder tree's ancestors become a descendant tree. After importing, choose who the chart starts from: the list suggests the people furthest back (with how many generations are below them), or find any ancestor by name. Until you choose, it starts from the earliest paternal ancestor.
- **View → Save as read-only web page** makes a single HTML file of the chart that anyone can open.

## File format

The .txt backup is two header lines, a blank line, then JSON:

```text
{ "v": 1, "app": "descendant-builder", "root": "<id>", "people": [ … ], "unions": [ … ] }
```

People use the same fields as Pedigree Builder (`name`, `fn`, `mn`, `ln`, `sx`, `mln`, `sex`, `l`, `b`, `bm`, `bdy`, `bq`, `b2`, `d`…, `bp`, `dp`, `occ`, `notes`, `star`, `wiki`, `ev`, `src`), plus `id`, `seat` (seat or home) and `idx` (an index number printed in a source). Instead of Ahnentafel numbers, families are `unions`: `{ "id", "p": [person, partner], "ch": [children in order], "m", "mm", "mdy", "mq" (marriage date), "mp" (place), "div" }`.

## For developers

Plain HTML, CSS and JavaScript with no dependencies and no build step.

```text
index.html               The page
css/styles.css           Styles, light and dark
js/sample-data.js        The Randolph sample
js/core.js               State, lookups, names, dates, index numbers, lines of descent
js/chart.js              Layout and drawing, zoom and pan, details, navigation
js/editing.js            Edit mode: forms, adding, linking, deleting
js/storage.js            Saving, undo and redo, view settings, find, keyboard
js/files.js              .txt, GEDCOM, Pedigree Builder and read-only page export/import
js/main.js               Start-up
tools/build-single-file.py   Builds dist/descendant-builder.html (one self-contained file)
.github/workflows/single-file.yml   Attaches that file to each GitHub release
```

### The single-file build

`tools/build-single-file.py` inlines the stylesheet and scripts into `dist/descendant-builder.html`, a single file people can download and use offline. It needs only Python 3:

```sh
python3 tools/build-single-file.py
```

You don't normally need to run it yourself: when a release is published on GitHub, the workflow in `.github/workflows/single-file.yml` builds the file and attaches it to the release.

Edit-only code is wrapped in `/*{edit*/ … /*}edit*/` so the read-only page leaves it out.

## License

MIT. The sample data is transcribed from *The Randolphs of Virginia* by Robert Isham Randolph (1936).
