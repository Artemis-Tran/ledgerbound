# Publishing a book

The reference for the `publish-book` skill: the pages of a book, the blurb, the keywords, and what the stores need. The file formats are in `formats.md`.

## Pages and their order

A page ID is the file name in `books/NN/pages/` (`copyright` → `books/NN/pages/copyright.md`), or a built-in page. Leave out each page that has no content.

| Where | ID | Content | Title |
|---|---|---|---|
| front | `title-page` | Built in: the title, subtitle, series and book number, author and publisher, from the publish file. | – |
| front | `copyright` | The template below. | none |
| front | `dedication` | The user's words, often one line in italics. | none |
| front | `epigraph` | A quotation the user chose, with its source. | none |
| front | `contents` | Built in: a link to each chapter, and to each page that has a title. | – |
| front | `previously` | Book 2 or later: the rules below. | `Previously` |
| back | `afterword` | The user's author's note. | `Author's Note` |
| back | `acknowledgments` | The user's words. | `Acknowledgments` |
| back | `about-author` | The user's facts, in the third person, 50–150 words, and their links. | `About the Author` |
| back | `also-by` | The user's other books, in reading order; a series in its order. | `Also by <author>` |
| back | `newsletter` | One or two lines and the link that the user gave: what a reader gets when they sign up. | a short call, for example `Get the Next Book First` |

A page with a `title` in its frontmatter gets that heading, and a line in the contents. A page without a title is not in the contents.

## The copyright page

Use this text, with the user's details. Leave out each line that has no value. It is the common form for a novel; tell the user that it is not legal advice.

```markdown
Copyright © <year> <author>

All rights reserved. No part of this book may be reproduced in any form without written permission from the author, except for brief quotations in a review.

This is a work of fiction. Names, characters, places and events are the product of the author's imagination. Any resemblance to real persons, living or dead, is coincidental.

ISBN: <isbn>

Cover design by <designer>

Published by <publisher>

First edition, <year>
```

## The previously page

A reader of book 2 or later needs the facts that this book depends on, in 300–600 words.

- Take the events from the `summary` of the memory files of the earlier books, and the open threads from the `open_questions` of the last one: the handoff.
- Take each number, rank and item from `lb fold <last point of the previous book>`, never from memory. With windows `on`, end on one status window of the protagonist in the window template.
- Write in the past tense, plainly, in the voice of the book. Tell only what happened on the page. The events that this book turns on come first; the others, in one line each or not at all.

## The blurb

The blurb is the store description, and `description` in the publish file. 150–250 words.

- Start with the protagonist in their situation, and the hook, in the first two sentences: a reader decides there.
- Then the pressure of act 1, and what the protagonist stands to lose.
- Tell only the setup of the book; its turns and its ending stay for the reader.
- End on the question of the book, and then one line that names the `gives` draws in a reader's words (for example "A slow-burn progression fantasy with a crafting System and zero romance.").
- Write in the tone of the book. Use the setting's own nouns, one or two of them.

## The keywords

Up to 7 phrases (Amazon KDP has 7 fields, up to 50 characters each). Each is a phrase a reader types into a store search: take them from the `gives` and `excludes` draws, the subgenre (LitRPG, progression fantasy, cultivation, dungeon core) and the setting. Use only generic terms: other authors' names and book titles are not allowed in KDP keywords.

## What the stores need

- **The cover.** Upload it to the store separately too. Amazon KDP recommends a JPEG of 2,560 × 1,600 pixels (height × width).
- **The ISBN.** An ebook on Amazon KDP needs none. Some other stores and aggregators ask for one; an ISBN for the ebook differs from the ISBN of a print edition.
- **The EPUB.** Amazon KDP, Apple Books, Kobo and Google Play accept EPUB. The stores check it with epubcheck: `brew install epubcheck`, or the release on github.com/w3c/epubcheck (it needs Java).
- **The store form.** It asks for the blurb and the keywords again, and for categories: take them from the same draws and subgenre.
