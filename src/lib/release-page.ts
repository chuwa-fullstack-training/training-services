/**
 * Generates the HTML page for the /release endpoint.
 * Embeds raw markdown and renders it client-side with marked.js.
 * Supports four themes switchable via a selector; persisted in localStorage.
 */
export function generateReleasePage(markdown: string): string {
  // JSON.stringify safely escapes all special characters for embedding in JS
  const escaped = JSON.stringify(markdown);

  return /* html */ `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Changelog</title>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <style>
    /* ── Theme variables ───────────────────────────────────────────────── */
    :root,
    [data-theme="light"] {
      --bg:         #ffffff;
      --surface:    #f6f8fa;
      --text:       #24292f;
      --text-muted: #57606a;
      --border:     #d0d7de;
      --code-bg:    #f6f8fa;
      --link:       #0969da;
      --tag-bg:     #ddf4ff;
      --tag-text:   #0550ae;
      --h2-border:  #d0d7de;
      --select-bg:  #f6f8fa;
    }
    [data-theme="dark"] {
      --bg:         #0d1117;
      --surface:    #161b22;
      --text:       #e6edf3;
      --text-muted: #8b949e;
      --border:     #30363d;
      --code-bg:    #1f2428;
      --link:       #58a6ff;
      --tag-bg:     #1f3352;
      --tag-text:   #79c0ff;
      --h2-border:  #30363d;
      --select-bg:  #161b22;
    }
    [data-theme="dracula"] {
      --bg:         #282a36;
      --surface:    #21222c;
      --text:       #f8f8f2;
      --text-muted: #6272a4;
      --border:     #44475a;
      --code-bg:    #44475a;
      --link:       #8be9fd;
      --tag-bg:     #44475a;
      --tag-text:   #bd93f9;
      --h2-border:  #44475a;
      --select-bg:  #21222c;
    }
    [data-theme="slate"] {
      --bg:         #1e2433;
      --surface:    #252d3e;
      --text:       #cbd5e1;
      --text-muted: #94a3b8;
      --border:     #334155;
      --code-bg:    #0f172a;
      --link:       #7dd3fc;
      --tag-bg:     #1e3a5f;
      --tag-text:   #93c5fd;
      --h2-border:  #334155;
      --select-bg:  #252d3e;
    }

    /* ── Reset ─────────────────────────────────────────────────────────── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    /* ── Base ──────────────────────────────────────────────────────────── */
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      transition: background 0.15s, color 0.15s;
    }

    /* ── Nav ───────────────────────────────────────────────────────────── */
    nav {
      position: sticky;
      top: 0;
      z-index: 100;
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      padding: 0.625rem 1.5rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .nav-left {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      font-weight: 600;
      font-size: 0.9375rem;
    }
    .badge {
      font-size: 0.6875rem;
      font-weight: 500;
      background: var(--tag-bg);
      color: var(--tag-text);
      padding: 0.125rem 0.5rem;
      border-radius: 999px;
      letter-spacing: 0.02em;
    }
    select {
      appearance: none;
      background: var(--select-bg);
      color: var(--text);
      border: 1px solid var(--border);
      padding: 0.375rem 2rem 0.375rem 0.625rem;
      border-radius: 6px;
      font-size: 0.8125rem;
      cursor: pointer;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 0.5rem center;
      transition: border-color 0.15s;
    }
    select:focus { outline: none; border-color: var(--link); }

    /* ── Content ───────────────────────────────────────────────────────── */
    #content {
      max-width: 820px;
      margin: 0 auto;
      padding: 2.5rem 1.5rem 4rem;
    }

    /* ── Markdown element styles ───────────────────────────────────────── */
    #content h1 {
      font-size: 1.75rem;
      font-weight: 700;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid var(--border);
      margin-bottom: 0.5rem;
    }
    #content > p:first-of-type {
      color: var(--text-muted);
      font-size: 0.875rem;
      margin-bottom: 2rem;
    }
    #content h2 {
      font-size: 1.125rem;
      font-weight: 600;
      margin: 2.5rem 0 0.875rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid var(--h2-border);
      color: var(--text);
    }
    #content h2 code {
      font-size: 1rem;
    }
    #content h3 {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--text-muted);
      margin: 1.25rem 0 0.5rem;
    }
    #content ul {
      list-style: none;
      padding-left: 0;
    }
    #content li {
      position: relative;
      padding-left: 1.25rem;
      margin: 0.3rem 0;
      font-size: 0.9375rem;
      color: var(--text);
    }
    #content li::before {
      content: '–';
      position: absolute;
      left: 0;
      color: var(--text-muted);
    }
    #content code {
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
      font-size: 0.8125em;
      background: var(--code-bg);
      border: 1px solid var(--border);
      padding: 0.1em 0.35em;
      border-radius: 4px;
    }
    #content a {
      color: var(--link);
      text-decoration: none;
    }
    #content a:hover { text-decoration: underline; }
    #content p {
      color: var(--text-muted);
      margin: 0.5rem 0;
      font-size: 0.9375rem;
    }
    #content hr {
      border: none;
      border-top: 1px solid var(--border);
      margin: 2rem 0;
    }
  </style>
</head>
<body>
  <nav>
    <div class="nav-left">
      <span>Changelog</span>
      <span class="badge" id="version-badge">loading…</span>
    </div>
    <select id="theme-selector" title="Switch theme" aria-label="Theme selector">
      <option value="light">Light</option>
      <option value="dark">Dark</option>
      <option value="dracula">Dracula</option>
      <option value="slate">Slate</option>
    </select>
  </nav>

  <div id="content"></div>

  <script>
    // ── Render markdown ─────────────────────────────────────────────────
    const raw = ${escaped};
    document.getElementById('content').innerHTML = marked.parse(raw);

    // ── Version badge — pick first ## [x.y.z] heading ──────────────────
    const versionMatch = raw.match(/##\\s+\\[([^\\]]+)\\]/);
    if (versionMatch) {
      document.getElementById('version-badge').textContent = 'latest ' + versionMatch[1];
    }

    // ── Theme selector ──────────────────────────────────────────────────
    const STORAGE_KEY = 'changelog-theme';
    const selector = document.getElementById('theme-selector');
    const root = document.documentElement;

    function applyTheme(theme) {
      root.setAttribute('data-theme', theme);
      selector.value = theme;
    }

    const saved = localStorage.getItem(STORAGE_KEY) || 'light';
    applyTheme(saved);

    selector.addEventListener('change', function () {
      const theme = this.value;
      localStorage.setItem(STORAGE_KEY, theme);
      applyTheme(theme);
    });
  </script>
</body>
</html>`;
}
