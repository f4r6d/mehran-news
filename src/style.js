export const CSS = `
:root {
  color-scheme: light dark;
  --bg: #fbfaf8;
  --fg: #1c1917;
  --muted: #78716c;
  --line: #e7e2dc;
  --surface: #f3efea;
  --accent: #c2410c;
  --accent-soft: #fdece1;
  --accent-fg: #ffffff;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #131211;
    --fg: #ece8e2;
    --muted: #a8a29e;
    --line: #2b2825;
    --surface: #1c1a18;
    --accent: #fb923c;
    --accent-soft: #2a1c12;
    --accent-fg: #1b120a;
  }
}

* {
  box-sizing: border-box;
}

html {
  -webkit-text-size-adjust: 100%;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--fg);
  font-family: "Vazirmatn", "IRANSansX", "Noto Naskh Arabic", "Segoe UI", Tahoma, sans-serif;
  font-size: 16px;
  line-height: 1.7;
}

a {
  color: inherit;
  text-decoration: none;
}

:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

::selection {
  background: var(--accent-soft);
}

.wrap {
  max-width: 760px;
  margin: 0 auto;
  padding: 0 20px 72px;
}

.masthead {
  padding: 48px 0 8px;
}

.topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.mark {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 0 6px var(--accent-soft);
}

h1 {
  margin: 0;
  font-size: 26px;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.tagline {
  margin: 16px 0 0;
  color: var(--muted);
  font-size: 14.5px;
}

.status {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 18px;
  padding-top: 18px;
  border-top: 1px solid var(--line);
  color: var(--muted);
  font-size: 13px;
}

.status .sep {
  opacity: 0.4;
}

.flash {
  color: var(--accent);
  font-weight: 600;
}

.refresh button,
.empty button {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 15px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: transparent;
  color: var(--fg);
  font: inherit;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.refresh button:hover {
  background: var(--surface);
  border-color: var(--muted);
}

.day {
  margin-top: 44px;
}

.day-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 4px;
}

.day-head h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 800;
}

.day-head span {
  color: var(--muted);
  font-size: 12.5px;
}

.card {
  display: flex;
  gap: 16px;
  padding: 18px 0;
  border-bottom: 1px solid var(--line);
}

.card h3 {
  margin: 0 0 6px;
  font-size: 17px;
  font-weight: 700;
  line-height: 1.6;
}

.card h3 a {
  transition: color 0.15s ease;
}

.card:hover h3 a {
  color: var(--accent);
}

.summary {
  display: -webkit-box;
  margin: 0 0 10px;
  overflow: hidden;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.75;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.meta {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--muted);
  font-size: 12px;
}

.source {
  color: var(--fg);
  font-weight: 600;
  opacity: 0.75;
}

.dot {
  opacity: 0.35;
}

.thumb {
  flex: 0 0 108px;
  align-self: flex-start;
  height: 72px;
  overflow: hidden;
  border-radius: 10px;
  background: var(--surface);
}

.thumb img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.empty {
  padding: 72px 20px;
  text-align: center;
}

.empty h2 {
  margin: 0 0 8px;
  font-size: 20px;
  font-weight: 800;
}

.empty p {
  max-width: 420px;
  margin: 0 auto 24px;
  color: var(--muted);
  font-size: 14px;
}

.empty button.primary {
  border-color: var(--accent);
  background: var(--accent);
  color: var(--accent-fg);
}

@media (max-width: 520px) {
  .masthead {
    padding-top: 36px;
  }

  h1 {
    font-size: 22px;
  }

  .card {
    gap: 12px;
  }

  .thumb {
    flex-basis: 84px;
    height: 60px;
  }
}

.nav {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px;
  font-size: 13.5px;
  color: var(--muted);
}

.nav a:hover,
.nav .link-button:hover {
  color: var(--accent);
}

.inline {
  display: inline;
  margin: 0;
}

.link-button {
  border: 0;
  background: none;
  padding: 0;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.text-link {
  color: var(--accent);
}

.flash {
  margin: 18px 0 0;
  padding: 10px 14px;
  border: 1px solid var(--accent);
  border-radius: 10px;
  background: var(--accent-soft);
  color: var(--fg);
  font-size: 13.5px;
  font-weight: 500;
}

.card .meta {
  flex-wrap: wrap;
}

.comments-link {
  color: var(--muted);
}

.comments-link:hover {
  color: var(--accent);
}

.like-form {
  display: inline;
  margin: 0;
}

.like {
  border: 0;
  background: none;
  padding: 0;
  color: var(--muted);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.like.liked,
.like:hover {
  color: var(--accent);
}

button {
  font: inherit;
  cursor: pointer;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 420px;
  margin: 18px 0;
}

.form label {
  color: var(--muted);
  font-size: 13px;
}

.form input,
.form textarea {
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--bg);
  color: var(--fg);
  font: inherit;
}

.form textarea {
  resize: vertical;
  min-height: 90px;
}

.form input:focus,
.form textarea:focus {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.form button,
.row-actions button,
.panel button,
.empty button,
.notice button {
  padding: 8px 14px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: transparent;
  color: var(--fg);
  font-size: 13px;
  font-weight: 600;
}

.form button:hover,
.row-actions button:hover,
.panel button:hover {
  border-color: var(--muted);
}

button.primary,
.empty button.primary {
  border-color: var(--accent);
  background: var(--accent);
  color: var(--accent-fg);
}

button.danger,
.row-actions button.danger {
  color: #dc2626;
  border-color: currentColor;
}

.danger-link {
  border: 0;
  background: none;
  padding: 0;
  color: #dc2626;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}

.button-link {
  display: inline-block;
  padding: 8px 14px;
  border: 1px solid var(--accent);
  border-radius: 999px;
  color: var(--accent);
  font-size: 13px;
  font-weight: 600;
}

.panel {
  margin: 30px 0;
  padding: 20px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--surface);
}

.panel.narrow {
  max-width: 440px;
  margin: 40px auto;
}

.panel h2 {
  margin: 0 0 10px;
  font-size: 20px;
}

.panel h3 {
  margin: 24px 0 6px;
  font-size: 15px;
}

.kv {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 8px 0;
  border-bottom: 1px dashed var(--line);
  font-size: 14px;
}

.kv:last-child {
  border-bottom: 0;
}

.hint {
  color: var(--muted);
  font-size: 13px;
}

.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 14px 0;
}

.tabs a {
  padding: 6px 12px;
  border: 1px solid var(--line);
  border-radius: 999px;
  color: var(--muted);
  font-size: 13px;
}

.tabs a.active {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 700;
}

.tabs.sub {
  margin-top: 0;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: 10px;
  margin: 16px 0;
}

.stat {
  display: block;
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--bg);
  text-align: center;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.stat:hover {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.stat strong {
  display: block;
  color: var(--accent);
  font-size: 22px;
}

.stat span {
  color: var(--muted);
  font-size: 12px;
}

.row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: flex-start;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid var(--line);
}

.row-main {
  display: flex;
  flex: 1 1 60%;
  flex-direction: column;
  gap: 3px;
  font-size: 14px;
}

.row-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.row-actions button {
  padding: 6px 10px;
  font-size: 12px;
}

.badge {
  display: inline-block;
  padding: 1px 8px;
  border: 1px solid var(--line);
  border-radius: 999px;
  color: var(--muted);
  font-size: 11px;
}

.badge.pending {
  border-color: #b45309;
  color: #b45309;
}

.badge.active {
  border-color: #15803d;
  color: #15803d;
}

.badge.blocked {
  border-color: #dc2626;
  color: #dc2626;
}

.article {
  margin: 28px 0;
}

.article h2 {
  margin: 0 0 10px;
  font-size: 23px;
  line-height: 1.55;
}

.article .meta {
  flex-wrap: wrap;
  margin-bottom: 14px;
}

.article-summary {
  color: var(--muted);
  font-size: 15px;
  line-height: 1.9;
}

.comments {
  margin-top: 36px;
}

.comments h2 {
  margin: 0 0 6px;
  font-size: 18px;
}

.comment {
  padding: 14px 0;
  border-bottom: 1px solid var(--line);
}

.comment-head {
  margin-bottom: 4px;
  color: var(--muted);
  font-size: 12.5px;
}

.comment p {
  margin: 0;
  font-size: 14px;
}

.reply {
  margin-top: 8px;
  padding: 8px 12px;
  border-right: 3px solid var(--accent);
  border-radius: 8px;
  background: var(--accent-soft);
  font-size: 13px;
}

.admin-comment .row-actions {
  margin-top: 8px;
}

.admin-comment.unread {
  margin-bottom: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--accent-soft);
}

.reply-form {
  flex-direction: row;
  max-width: none;
  align-items: center;
}

.reply-form input {
  flex: 1;
}

.notice {
  margin: 14px 0;
  padding: 12px 14px;
  border: 1px dashed var(--accent);
  border-radius: 10px;
  background: var(--bg);
}

.mono {
  font-family: ui-monospace, "Cascadia Code", monospace;
  font-size: 12px;
  word-break: break-all;
}

.check {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--fg);
  font-size: 13.5px;
}

.inline-form {
  flex-direction: row;
  flex-wrap: wrap;
  align-items: flex-end;
  max-width: none;
}

.inline-form input {
  flex: 1 1 160px;
}

.status .refresh {
  margin: 0 0 0 auto;
}

@media (max-width: 520px) {
  .nav {
    gap: 10px;
    font-size: 13px;
  }

  .panel {
    padding: 16px;
  }

  .row-actions {
    width: 100%;
  }

  .status .refresh {
    margin: 0;
  }
}
`;
