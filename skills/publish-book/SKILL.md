---
name: publish-book
description: Make a complete Ledgerbound book ready to publish - the publish file (metadata, blurb, keywords), the front and back pages, and an EPUB from `lb export`. Use when a book is done and the user wants to publish it, or wants an EPUB of a book to read or share (a draft export).
---

# publish-book

The **publish file** `books/NN/publish.yaml` holds the metadata of one book and the order of its **front pages** and **back pages**. `title-page` and `contents` are built in; every other page is a file `books/NN/pages/<id>.md`. `lb export` turns the book into an EPUB. The formats are in `${CLAUDE_PLUGIN_ROOT}/reference/formats.md`. What goes on each page, the blurb and keyword rules and the store notes are in `${CLAUDE_PLUGIN_ROOT}/reference/publishing.md`: read it before step 3.

## Steps

1. **Book.** Run `lb run --book N --json`, where N is the book the user names, else the current book.
   - The book is complete: continue with step 2.
   - Chapters are open, and the user wants an EPUB only to read or share: make a **draft export**. When there is no publish file, write one with only `author` (ask for it) and the default pages. Then go to step 7 with `--draft`.
   - Chapters are open, and the user wants to publish: tell them which chapters are open, and that `generate-book` completes them. Stop here.

   When `accepted` in the output lists chapters, show them first, with their open errors: autopilot committed them with those errors. Ask if the user wants to fix them before publishing.
   Done when the book is complete, or the user chose a draft export.

2. **Read** `bible.md` (the draws and decisions), `series.md`, the book plan, and the publish file and pages when they exist: keep what the user wrote in them. For book 2 or later, also read the memory files of the earlier books.

3. **Details.** Ask the user in one round, only for what is still missing:
   - the author name on the cover (a pen name is fine), the language, the publication date;
   - the ISBN, the publisher or imprint, and a cover designer to credit (each optional);
   - the cover image: the path of a JPEG or PNG in the novel repo. You cannot make a cover; the book can be exported without one;
   - for a series: the series name;
   - the personal pages they want, with their words for each: dedication, epigraph, author's note, acknowledgments, about the author, other books, newsletter or links.

   Done when each item has an answer, or the user said to leave it out.

4. **Blurb and keywords.** Draft the blurb and the keywords by the rules in `publishing.md`, from the bible, the draws and the book plan. Show both to the user, and change them until they approve.
   Done when the user approved the blurb and the keywords.

5. **Pages.** Write `books/NN/pages/<id>.md` for each page, and `books/NN/publish.yaml` with the metadata, the blurb as `description`, the keywords, and `front` and `back` in the order in `publishing.md`.
   - The copyright page: from the template in `publishing.md`, with the user's details.
   - The personal pages: the user's words, with only spelling and punctuation fixed. A page that the user gave no words for stays out of the book.
   - The previously page (book 2 or later): by the rules in `publishing.md`. Run `lb lint` on it, and fix each error.

   Run `lb validate`.
   Done when it reports no error for the publish file or the pages.

6. **Approve.** Show the user the metadata, the blurb, the keywords, the order of the pages, and the full text of each page that you wrote (the copyright page, the previously page). Make the changes they ask for, and run `lb validate` again.
   Done when the user approves.

7. **Export.** Run `lb export --book N` (add `--draft` for a draft export). When `command -v epubcheck` finds epubcheck, run `epubcheck <file>`. Fix each error that comes from the publish file or a page; report any other error to the user with its message.
   Done when `lb export` exits 0, and epubcheck reports no error or is not installed.

8. **Git.** Make sure `.gitignore` in the novel repo has the line `exports/`: the EPUB is a build output. Commit the publish file and the pages: `Book <N>: publish file and pages`.

9. **Report**, in a few lines: the EPUB path, its chapters and words, the warnings of `lb export`, the epubcheck result (or that epubcheck is not installed, and that it is the check the stores use), and what the stores still need from the user. Tell them to open the file in an e-reader app (for example calibre or Kindle Previewer) and read the first pages before they upload it.
