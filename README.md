# Canvas LMS — Complex Image Long Description

A custom JavaScript addition for Canvas LMS that gives content authors a way to attach semantic, WCAG-compliant long descriptions to complex images (charts, diagrams, infographics) directly from the Rich Content Editor's existing "Upload Image" dialog.

## Why?

This project emerged in response to the 2024 DOJ ruling that establishes WCAG 2.1 Level AA as the accessibility standard for web content. At present, Instructure does not provide a built‑in way to add long descriptions to complex images, and requiring users to manually edit HTML is neither scalable nor user‑friendly. This project explores a better approach: making long descriptions a first‑class part of the image upload process.

## What It Does

When a user opens the **Upload Image** dialog in the Canvas Rich Content Editor, this script injects two optional fields below the existing alt text and decorative image controls:

- **Figure Title** — a short label displayed as the clickable `<summary>` heading
- **Long Description** — extended text explanation of the image

If either field is filled in, the uploaded image is automatically wrapped in semantic `<figure>` / `<figcaption>` / `<details>` HTML instead of a bare `<img>` tag. The result is a collapsible description panel attached directly below the image.

### Output Variants

| Fields Provided | Result |
|---|---|
| Title only | `<figure>` with a static `<figcaption>` |
| Description only | `<figure>` with an expandable `<details>` block using the alt text (or "Image Description") as the toggle label |
| Both | `<figure>` with an expandable `<details>` block using the Figure Title as the toggle label |
| Neither | No modification — standard `<img>` behavior |

## Deployment

This runs as part of your institution's **custom JavaScript file** in Canvas.

1. Go to **Admin → Themes → [Your Theme] → Edit**
2. Under **Upload**, add this script to your custom JS file (or paste it into your existing one)
3. **Save & Apply**

The script loads on every page that initializes the Rich Content Editor. It has no effect on pages without an editor.

## How It Works

1. **TinyMCE configuration** — Adds `<figure>`, `<figcaption>`, `<details>`, and `<summary>` to TinyMCE's `extended_valid_elements` so the editor doesn't strip them on save.
2. **Dialog detection** — A `MutationObserver` on `<body>` watches for the React-rendered "Upload Image" dialog and injects the custom fields when it appears.
3. **Submission interception** — When the user clicks Submit, the script stashes field values and marks all existing `<img>` elements in the editor body.
4. **Image insertion watcher** — Polls TinyMCE for a newly-appeared `<img>` (one not previously marked), then replaces it with the full `<figure>` markup.

All output is inline-styled so it renders correctly on published pages without requiring additional CSS files.

## Width Behavior

The generated `<figure>` uses `max-width: fit-content`, which means:

- When collapsed, the description panel matches the image width
- When expanded, the panel matches the image width **unless** the title text is longer than the image is wide, in which case the figure grows to fit the title — this is expected responsive behavior
- Users can resize the image in the editor; the collapsed panel follows the image width

## Safety & Trade-offs

This approach uses Canvas's **custom JavaScript theme file**, which is a supported approach. Some things to be aware of:

**Advantages over a dedicated LTI tool:**
- Zero infrastructure — no server, no hosting, no maintenance
- Data is not sent to, nor stored temporarily 
- Works inside the native editor workflow; authors don't leave Canvas
- Output is plain HTML stored in Canvas content; it survives course copies, exports, and imports
- No authentication, API keys, or LTI registration required

**Limitations:**
- Relies on Canvas's current Upload Image dialog DOM structure. Instructure UI updates could break field injection (the `MutationObserver` pattern is resilient but not immune).
- TinyMCE `extended_valid_elements` must include the semantic tags. If Canvas changes its editor, this configuration step may need updating.
- The script uses Canvas's InstUI CSS class names (e.g., `css-bym9jl-formFieldLayout`) to match the native look. These are generated class names that could change across Canvas releases.
- Content authors must use this upload flow to get `<figure>` markup. Images added via other methods (drag-and-drop, URL embed) are not intercepted.

## Compatibility

- Tested on Canvas LMS with the New Rich Content Editor
- Requires jQuery and TinyMCE (both provided by Canvas)
- No external dependencies

## License

MIT
