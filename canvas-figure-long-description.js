/* ========================================================================
   Canvas LMS — Complex Image Long Description (Figure/Details)
   
   Enhances the Canvas Rich Content Editor's "Upload Image" dialog with
   optional Figure Title and Long Description fields. When provided, the
   uploaded image is wrapped in semantic <figure> / <figcaption> / <details>
   HTML, giving authors a WCAG-compliant way to attach extended text
   descriptions to complex images (charts, diagrams, infographics, etc.).

   Deployment: Add this script to your Canvas theme's custom JavaScript file
   (Admin → Themes → Edit → Upload JavaScript). It runs on every page that
   loads the Rich Content Editor.

   Repository: https://github.com/<your-org>/canvas-figure-long-description
   License:    MIT
   ======================================================================== */

(function () {
  'use strict';

  // State shared across the upload → insertion lifecycle
  let pendingLongDescription = '';
  let pendingImageCaption = '';
  let uploadTimestamp = 0;
  let tooltipCounter = 0;

  // ── Bootstrap ──────────────────────────────────────────────────────────

  function waitForCanvas() {
    if (typeof $ !== 'undefined' && typeof tinymce !== 'undefined') {
      init();
    } else {
      setTimeout(waitForCanvas, 500);
    }
  }

  function init() {
    configureTinyMCE();
    observeDialogs();
  }

  // ── TinyMCE Configuration ─────────────────────────────────────────────
  // Canvas strips HTML elements it doesn't recognise. We add <figure>,
  // <figcaption>, <details>, and <summary> to TinyMCE's allow-list so the
  // editor doesn't discard them on paste or save.

  function configureTinyMCE() {
    var additionalElements =
      'figure[style|class|id],' +
      'figcaption[style|class|id],' +
      'details[style|class|id|open],' +
      'summary[style|class|id]';

    var addElements = function (editor) {
      if (!editor || !editor.settings) return;
      ['valid_elements', 'extended_valid_elements'].forEach(function (prop) {
        if (editor.settings[prop]) {
          editor.settings[prop] += ',' + additionalElements;
        } else {
          editor.settings[prop] = additionalElements;
        }
      });
    };

    if (tinymce.editors) tinymce.editors.forEach(addElements);
    if (tinymce.on) tinymce.on('AddEditor', function (e) { addElements(e.editor); });
    $(document).on('tinymce-init', function (e) { addElements(e.target); });
  }

  // ── Dialog Detection ──────────────────────────────────────────────────
  // Canvas renders the "Upload Image" dialog lazily via React. We use a
  // MutationObserver on <body> to detect it and inject our custom fields.

  function observeDialogs() {
    new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        mutation.addedNodes.forEach(function (node) {
          if (node.nodeType !== 1) return;
          var dialog =
            (node.querySelector && node.querySelector('[aria-label="Upload Image"]')) ||
            (node.getAttribute && node.getAttribute('aria-label') === 'Upload Image' ? node : null);
          if (dialog) setTimeout(function () { enhanceDialog(dialog); }, 100);
        });
      });
    }).observe(document.body, { childList: true, subtree: true });
  }

  // ── Dialog Enhancement ────────────────────────────────────────────────

  function enhanceDialog(dialog) {
    var altTextField = dialog.querySelector('[data-testid="alt-text-field"]');
    if (!altTextField) {
      setTimeout(function () { enhanceDialog(dialog); }, 500);
      return;
    }
    if (dialog.querySelector('#long-description-field')) return;

    // Re-inject fields if React re-renders the dialog contents
    new MutationObserver(function () {
      if (!dialog.querySelector('#long-description-field')) {
        setTimeout(function () { addCustomFields(dialog); }, 100);
      }
    }).observe(dialog, { childList: true, subtree: true });

    addCustomFields(dialog);
    hookFormSubmission(dialog);
  }

  // ── Tooltip Helpers ───────────────────────────────────────────────────

  function createTooltip(id, message) {
    var tooltip = document.createElement('span');
    tooltip.id = id;
    tooltip.className = 'canvas-figure-tooltip';
    tooltip.setAttribute('role', 'tooltip');
    tooltip.innerHTML =
      '<span dir="ltr" class="css-1sdfty9-view--block">' + message + '</span><div></div>';
    document.body.appendChild(tooltip);
    return tooltip;
  }

  function addTooltipBehavior(button, tooltipId, message) {
    var tooltip = createTooltip(tooltipId, message);

    var show = function () {
      tooltip.style.display = 'block';
      tooltip.style.visibility = 'hidden';
      var rect = button.getBoundingClientRect();
      var tooltipRect = tooltip.getBoundingClientRect();
      var left = rect.left + rect.width / 2 - tooltipRect.width / 2;
      var top = rect.top - tooltipRect.height - 12;
      left = Math.max(10, Math.min(left, window.innerWidth - tooltipRect.width - 10));
      var arrow = tooltip.querySelector('div');
      if (top < 10) {
        top = rect.bottom + 12;
        arrow.className = 'arrow-up';
      } else {
        arrow.className = 'arrow-down';
      }
      tooltip.style.left = left + 'px';
      tooltip.style.top = top + 'px';
      tooltip.style.visibility = 'visible';
    };

    var hide = function () {
      tooltip.style.display = 'none';
    };

    button.addEventListener('mouseenter', show);
    button.addEventListener('mouseleave', hide);
    button.addEventListener('focus', show);
    button.addEventListener('blur', hide);
  }

  // ── Custom Field Injection ────────────────────────────────────────────

  function addCustomFields(dialog) {
    if (dialog.querySelector('#long-description-field')) return;

    var longDescTooltipId = 'long-desc-tooltip-' + ++tooltipCounter;
    var captionTooltipId = 'caption-tooltip-' + ++tooltipCounter;

    var helpBtnStyle =
      'background: none; border: none; cursor: pointer; padding: 2px; ' +
      'margin-left: 4px; vertical-align: middle; line-height: 1; ' +
      'border-radius: 50%; display: inline-flex; align-items: center; ' +
      'justify-content: center;';

    var helpIconSvg =
      '<svg viewBox="0 0 1920 1920" style="width: 1em; height: 1em; fill: currentColor;">' +
      '<path d="M960 1807.059c-467.125 0-847.059-379.934-847.059-847.059 ' +
      '0-467.125 379.934-847.059 847.059-847.059 467.125 0 847.059 379.934 ' +
      '847.059 847.059 0 467.125-379.934 847.059-847.059 847.059M960 0C430.645 ' +
      '0 0 430.645 0 960s430.645 960 960 960 960-430.645 960-960S1489.355 0 ' +
      '960 0m.056 1355.181 56.471.113h-56.47v-.113ZM752.64 409.65c83.69-64.715 ' +
      '191.661-86.4 296.696-59.294 114.862 29.703 208.264 123.106 237.968 ' +
      '237.967 23.378 90.466 10.729 183.303-35.464 261.459-45.515 ' +
      '77.026-121.186 133.948-207.586 156.084-13.779 3.502-27.783 ' +
      '14.796-27.783 31.85v91.708H903.529v-91.708c0-66.07 46.306-124.123 ' +
      '112.716-141.29 57.6-14.682 107.971-52.63 138.353-104.018 ' +
      '30.833-52.292 39.19-114.749 23.378-175.85-19.651-75.67-81.204-137.223-' +
      '156.875-156.875-70.927-18.184-143.548-3.953-199.341 39.303-55.68 ' +
      '43.144-87.642 108.311-87.642 178.673H621.176c0-105.6 47.888-203.294 ' +
      '131.464-268.01Zm207.416 832.704c-62.343 0-112.94 50.71-112.94 ' +
      '112.941 0 62.23 50.597 112.941 112.94 112.941 62.231 0 ' +
      '112.942-50.71 112.942-112.94 0-62.231-50.71-112.942-112.942-112.942Z" ' +
      'fill-rule="evenodd"/></svg>';

    var container = document.createElement('div');
    container.className = 'css-4xc4q3-view-flexItem figures-custom-container';

    // Section header with guidance link
    var figuresHeader = document.createElement('div');
    figuresHeader.innerHTML =
      '<div style="margin-bottom: 0.75rem;">' +
        '<h3 style="font-size: 1rem; font-weight: 700; margin: 0 0 0.5rem 0; color: #000;">' +
          'Complex Images Requiring Long Descriptions' +
        '</h3>' +
        '<p style="font-size: 0.875rem; line-height: 1.5; margin: 0; color: #2d3b45;">' +
          'Adds semantic &lt;figure&gt; HTML to uploaded charts, diagrams, or other ' +
          'complex images for easier WCAG compliance. After writing alt text of 120 ' +
          'characters or less, complete the Figure Title and Long Description fields:' +
        '</p>' +
      '</div>';

    // Figure Title field
    var figureTitleContainer = document.createElement('div');
    figureTitleContainer.style.cssText = 'margin-bottom: 1rem;';
    figureTitleContainer.innerHTML =
      '<label for="image-caption-field" class="css-bym9jl-formFieldLayout">' +
        '<span class="css-oj1gve-formFieldLayout__label">' +
          '<span dir="ltr" direction="row" wrap="no-wrap" class="css-magkya-view--flex-flex">' +
            '<span dir="ltr" class="css-1chn3gv-view-flexItem">Figure Title</span>' +
            '<span dir="ltr" class="css-uoul0t-view-flexItem">' +
              '<button dir="ltr" aria-describedby="' + captionTooltipId + '" type="button" ' +
                'class="caption-help-btn" style="' + helpBtnStyle + '">' + helpIconSvg + '</button>' +
            '</span>' +
          '</span>' +
        '</span>' +
        '<span class="css-j7s35e-formFieldLayout__children">' +
          '<div class="css-18zvyld-textArea__layout" style="min-height: 2.5rem;">' +
            '<textarea id="image-caption-field" ' +
              'placeholder="Descriptive title for the figure" ' +
              'class="css-1q8psur-textArea" ' +
              'style="resize: vertical; height: 2.5rem; overflow-y: hidden;">' +
            '</textarea>' +
            '<span aria-hidden="true" class="css-1pmvvex-textArea__outline"></span>' +
          '</div>' +
        '</span>' +
      '</label>';

    // Long Description field
    var longDescContainer = document.createElement('div');
    longDescContainer.innerHTML =
      '<label for="long-description-field" class="css-bym9jl-formFieldLayout">' +
        '<span class="css-oj1gve-formFieldLayout__label">' +
          '<span dir="ltr" direction="row" wrap="no-wrap" class="css-magkya-view--flex-flex">' +
            '<span dir="ltr" class="css-1chn3gv-view-flexItem">Long Description</span>' +
            '<span dir="ltr" class="css-uoul0t-view-flexItem">' +
              '<button dir="ltr" aria-describedby="' + longDescTooltipId + '" type="button" ' +
                'class="long-desc-help-btn" style="' + helpBtnStyle + '">' + helpIconSvg + '</button>' +
            '</span>' +
          '</span>' +
        '</span>' +
        '<span class="css-j7s35e-formFieldLayout__children">' +
          '<div class="css-18zvyld-textArea__layout" style="min-height: 4rem;">' +
            '<textarea id="long-description-field" ' +
              'placeholder="Detailed text explanation of the figure" ' +
              'class="css-1q8psur-textArea" ' +
              'style="resize: vertical; height: 4rem; overflow-y: hidden;">' +
            '</textarea>' +
            '<span aria-hidden="true" class="css-1pmvvex-textArea__outline"></span>' +
          '</div>' +
        '</span>' +
      '</label>';

    container.appendChild(figuresHeader);
    container.appendChild(figureTitleContainer);
    container.appendChild(longDescContainer);

    // Insert after the "decorative image" checkbox
    var decorativeCheckbox = dialog.querySelector('input[type="checkbox"]');
    var checkboxContainer = decorativeCheckbox
      ? decorativeCheckbox.closest('.css-4xc4q3-view-flexItem')
      : null;

    if (checkboxContainer) {
      checkboxContainer.after(container);

      var captionBtn = container.querySelector('.caption-help-btn');
      var longDescBtn = container.querySelector('.long-desc-help-btn');

      if (captionBtn) {
        addTooltipBehavior(
          captionBtn, captionTooltipId,
          'The figure title expands to reveal the long description text.'
        );
      }
      if (longDescBtn) {
        addTooltipBehavior(
          longDescBtn, longDescTooltipId,
          'A long description is a complete text explanation of the figure.'
        );
      }

      // Prevent help buttons from submitting the form
      [captionBtn, longDescBtn].forEach(function (btn) {
        if (btn) btn.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); });
      });
    }
  }

  // ── Form Submission Hook ──────────────────────────────────────────────
  // When the user clicks "Submit" we stash field values and begin
  // watching TinyMCE for the newly-inserted <img> element.

  function hookFormSubmission(dialog) {
    var submitButton = dialog.querySelector('button[type="submit"]');
    if (!submitButton) return;

    submitButton.addEventListener('click', function () {
      var longDescField = dialog.querySelector('#long-description-field');
      var captionField = dialog.querySelector('#image-caption-field');
      var altTextField = dialog.querySelector('[data-testid="alt-text-field"]');
      var hasLongDesc = longDescField && longDescField.value.trim();
      var hasCaption = captionField && captionField.value.trim();

      if (hasLongDesc || hasCaption) {
        // Mark every image already in the editor so we can identify the new one
        try {
          if (typeof tinymce !== 'undefined' && tinymce.editors) {
            tinymce.editors.forEach(function (editor) {
              var body = editor && editor.getBody && editor.getBody();
              if (body) {
                body.querySelectorAll('img').forEach(function (img) {
                  if (!img.hasAttribute('data-ld-checked')) {
                    img.setAttribute('data-ld-existing', 'true');
                  }
                });
              }
            });
          }
        } catch (e) {
          console.warn('Canvas Long Description: Could not mark existing images', e);
        }

        pendingLongDescription = hasLongDesc || '';
        pendingImageCaption = hasCaption || '';

        // Fall back to alt text → generic label if no explicit title was given
        if (!pendingImageCaption && hasLongDesc) {
          pendingImageCaption = (altTextField && altTextField.value.trim()) || 'Image Description';
        }

        uploadTimestamp = Date.now();
        setTimeout(watchForImageCompletion, 100);
      }
    });
  }

  // ── Image Insertion Watcher ───────────────────────────────────────────
  // After Canvas finishes uploading the file it inserts a bare <img> into
  // TinyMCE. We poll until we find it, then wrap it in <figure> markup.

  function watchForImageCompletion() {
    var attempts = 0;
    var maxAttempts = 100; // ~50 seconds

    var interval = setInterval(function () {
      attempts++;

      for (var e = 0; e < tinymce.editors.length; e++) {
        var editor = tinymce.editors[e];
        if (!editor || !editor.getBody) continue;
        var body = editor.getBody();
        if (!body) continue;

        // Wait for any upload placeholders to resolve
        if (body.querySelectorAll('.mceNonEditable[data-placeholder-for]').length > 0) continue;

        var images = body.querySelectorAll('img:not(figure img)');
        for (var i = images.length - 1; i >= 0; i--) {
          var img = images[i];
          if (img.src.startsWith('data:')) continue;
          if (img.hasAttribute('data-ld-checked')) continue;
          if (img.hasAttribute('data-ld-existing')) continue;

          img.setAttribute('data-ld-checked', 'true');
          wrapImageWithLongDescription(img, editor);
          clearInterval(interval);
          uploadTimestamp = 0;
          return;
        }
      }

      if (attempts >= maxAttempts) {
        clearInterval(interval);
        pendingLongDescription = '';
        pendingImageCaption = '';
        uploadTimestamp = 0;
      }
    }, 500);
  }

  // ── Figure Markup Builder ─────────────────────────────────────────────

  function wrapImageWithLongDescription(img, editor) {
    if (!pendingLongDescription && !pendingImageCaption) return;

    try {
      img.removeAttribute('data-ld-checked');

      var src = img.src;
      var alt = img.alt || '';
      var style = img.getAttribute('style') || 'width: 100%;';

      // ── Inline styles applied to the generated HTML ──
      var baseImgStyle = style + ' border: 1px solid #000000; display: block;';
      var figureStyle  = 'margin: 1.25rem 0; display: inline-block; max-width: fit-content;';
      var captionStyle =
        'margin-top: 0.75rem; padding: 16px; background: #fafbfc; ' +
        'border: 1px solid #d6dde0; border-radius: 0 0 8px 8px; ' +
        'color: #2d3b45; font-size: 14pt; font-weight: 600; line-height: 1.5;';
      var detailsStyle =
        'border: 1px solid #d6dde0; border-radius: 0 0 8px 8px; ' +
        'padding: 16px; background: #fafbfc; box-sizing: border-box;';
      var summaryStyle =
        'cursor: pointer; font-weight: 600; color: #2d3b45; font-size: 14pt; ' +
        'display: flex; align-items: center; list-style: none;';
      var descStyle =
        'margin-top: 12px; padding-top: 8px; border-top: 1px solid #e8edf0; ' +
        'color: #2d3b45; line-height: 1.5; font-size: 12pt; ' +
        'word-wrap: break-word; overflow-wrap: break-word;';

      var figureHTML = '';

      if (pendingImageCaption && !pendingLongDescription) {
        // Title only — simple figcaption, no expandable details
        figureHTML =
          '<figure style="' + figureStyle + '">' +
            '<img style="' + baseImgStyle + '" src="' + src + '" alt="' + alt + '" />' +
            '<figcaption style="' + captionStyle + '">' + pendingImageCaption + '</figcaption>' +
          '</figure>';

      } else if (pendingLongDescription && !pendingImageCaption) {
        // Long description only — expandable with generic title
        figureHTML =
          '<figure style="' + figureStyle + ' width: auto;">' +
            '<img style="' + baseImgStyle + '" src="' + src + '" alt="' + alt + '" />' +
            '<figcaption style="margin-top: 0.75rem; width: 100%;">' +
              '<details open class="figure-details" style="' + detailsStyle + '">' +
                '<summary style="' + summaryStyle + '">' +
                  '<span class="arrow-icon" style="margin-right: 8px; font-size: 0.8em; color: #666;">&#9660;</span>' +
                  '<span style="flex: 1;">Image Description</span>' +
                '</summary>' +
                '<div style="' + descStyle + '">' +
                  '<p style="margin: 0; white-space: pre-wrap;">' + pendingLongDescription + '</p>' +
                '</div>' +
              '</details>' +
            '</figcaption>' +
          '</figure>';

      } else {
        // Both title and long description — full expandable figure
        figureHTML =
          '<figure style="' + figureStyle + ' width: auto;">' +
            '<img style="' + baseImgStyle + '" src="' + src + '" alt="' + alt + '" />' +
            '<figcaption style="margin-top: 0.75rem; width: 100%;">' +
              '<details open class="figure-details" style="' + detailsStyle + '">' +
                '<summary style="' + summaryStyle + '">' +
                  '<span class="arrow-icon" style="margin-right: 8px; font-size: 0.8em; color: #666;">&#9660;</span>' +
                  '<span style="flex: 1;">' + pendingImageCaption + '</span>' +
                '</summary>' +
                '<div style="' + descStyle + '">' +
                  '<p style="margin: 0; white-space: pre-wrap;">' + pendingLongDescription + '</p>' +
                '</div>' +
              '</details>' +
            '</figcaption>' +
          '</figure>';
      }

      // Attempt replacement via TinyMCE API, fall back to raw DOM
      if (editor && editor.dom && editor.dom.setOuterHTML) {
        try { editor.dom.setOuterHTML(img, figureHTML); return; } catch (_) { /* fall through */ }
      }
      if (editor && editor.insertContent) {
        try { editor.selection.select(img); editor.insertContent(figureHTML); return; } catch (_) { /* fall through */ }
      }
      var temp = document.createElement('div');
      temp.innerHTML = figureHTML;
      if (img.parentNode) img.parentNode.replaceChild(temp.firstElementChild, img);

    } catch (e) {
      console.error('Canvas Long Description: Error wrapping image', e);
    } finally {
      pendingLongDescription = '';
      pendingImageCaption = '';
    }
  }

  // ── Start ─────────────────────────────────────────────────────────────
  waitForCanvas();
})();
