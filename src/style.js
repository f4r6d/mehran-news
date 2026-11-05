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

footer {
  margin-top: 56px;
  padding-top: 20px;
  border-top: 1px solid var(--line);
  color: var(--muted);
  font-size: 12.5px;
}

footer p {
  margin: 0;
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
`;
