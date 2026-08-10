# Contributing to the list of problems

If you would like to contribute a new problem or to add or correct information for an existing problem, the best ways to do so are to use the editing form on the website, open a pull request on github or open an issue on github.

## Editing form on website

The easiest way to add a problem or to edit an existing problem is to use the editing form on the website. For new problems, you can reach the editing form by clicking [Submit a New Problem](https://www.openlogicproblems.com/problems/new) in the website's navigation bar. For editing existing problems, you can reach the editing form by visiting the problem's page and clicking the "Suggest an edit" link in the bottom right-hand corner of the problem statement.

## Pull request on github

Problems are stored as Markdown files with YAML frontmatter under `problems/`. If you're comfortable with git, you can edit these files directly and open a pull request instead of using the website's editor.

All problem files must follow a standardized format, which is described below. Note that every pull request that touches `problems/**` is automatically checked (see "Validate Content" in the Actions tab) for schema errors and duplicate ids, and is reviewed manually before merging.

### Editing an existing problem

Edit the corresponding `problems/<id>.md` file directly. Keep its `id` unchanged—that's how the site's automation and the rest of this repo track which problem a file belongs to.

### Proposing a new problem

Add a new file at `problems/pending/<slug>.md` (pick any short, descriptive, kebab-case `<slug>`) with `id: null`. **Never hand-assign a real id yourself**—once your pull request is merged, a GitHub Action assigns the next available id, moves the file to `problems/<id>.md`, and logs the addition on the homepage automatically.

## Issue on github

If you would like a problem added or a change made to an existing problem but don't want to make the change yourself, you may also open an issue on GitHub to request it. However, please be aware that such request will be given relatively low priority. If you really want to see a problem added, the best way to do so is to add it yourself.

# Format for problem files

### Frontmatter fields

```yaml
id: 1                          # a positive integer for an existing problem, or `null` for a new proposal
name: "Vaught's Conjecture"
status: open                   # open | claimed-proof-no-consensus | closed
area: [model-theory]            # one or more of the areas listed below
impact: 3                      # 1, 2, or 3 — see the FAQ for what these mean
canonical_reference:
  key: "vaught1961"            # required once title/author are non-blank; letters, digits, and hyphens only
  title: "Denumerable models of complete theories"
  author: "Robert L. Vaught"
  venue: "Infinitistic Methods (Proc. Symposium on Foundations of Mathematics, Warsaw)"  # optional
  year: 1961                   # optional
  link: "https://example.com"  # optional
  doi: "10.1000/example"       # optional
references:                    # optional — additional references beyond canonical_reference above
  - key: "steel1978"           # required, same rules as canonical_reference's key
    title: "On Vaught's conjecture"
    author: "Steel, J."
    venue: "Cabal Seminar 76-77, Lecture Notes in Mathematics"  # optional
    year: 1978                 # optional
    link: "https://example.com"  # optional
    doi: "10.1000/example"       # optional
```

Valid `area` values: `computability-theory`, `set-theory`, `model-theory`,
`descriptive-set-theory`, `proof-theory`, `categorical-logic`.

`canonical_reference.title` and `.author` can be left as empty strings in unusual cases
where no reference is available, but a reference should be included whenever possible. Every
key (canonical or additional) must be unique within the file.

Any reference — canonical or additional — can be cited from within the body by writing
`[^key]` (e.g. `[^vaught1961]`), which renders as a link reading `[key]` pointing at that
reference's entry. A key that doesn't match any reference in the file renders as plain red
text instead of a link, so a typo is easy to spot.

### Body

Everything after the frontmatter is the problem's Markdown body, split into sections by
`##` headings:

```markdown
## Statement

The problem statement itself. Supports $\LaTeX$ (inline `$...$` or display `$$...$$`).

## Definitions

Optional. Definitions of terms used in the statement.

## Known Partial Results

Optional.

## Claimed Proofs

Optional. Only relevant if `status` is `claimed-proof-no-consensus`.

## Notes

Optional.
```

Only "Statement" is required; the rest can be omitted entirely if there's nothing to put there. See any file under `problems/` for a real example.


# Contributing potential solutions to problems



# Contributing to the code for the website


