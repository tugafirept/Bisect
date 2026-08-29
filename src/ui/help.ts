import { t } from "../i18n";

const SEEN_KEY = "bisect/seen-help";

function readSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function markSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* private mode — the dialog will just show again next visit */
  }
}

/** Wire the "how to play" dialog: opens on first visit and from the ? button. */
export function setupHelp(
  dialog: HTMLDialogElement,
  openButton: HTMLButtonElement,
): void {
  const bullets = t.help.bullets.map((b) => `<li>${b}</li>`).join("");
  dialog.innerHTML = `
    <h2>${t.help.title}</h2>
    <p>${t.help.intro}</p>
    <ul>${bullets}</ul>
    <form method="dialog"><button class="btn-primary" value="ok">${t.help.start}</button></form>
  `;

  openButton.addEventListener("click", () => dialog.showModal());
  dialog.addEventListener("close", markSeen);

  if (!readSeen()) {
    requestAnimationFrame(() => {
      try {
        dialog.showModal();
      } catch {
        /* not supported / already open */
      }
    });
  }
}
