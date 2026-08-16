export interface MenuButton {
  label: string;
  action: string;
}

export interface DraftCard {
  name: string;
  desc: string;
  level?: number;
}

export interface RunStats {
  kills: number;
  time: number;
  level: number;
  totalDamage: number;
  weapons: { name: string; level: number }[];
}

export interface SettingsCallbacks {
  volume: number;
  zoom: number;
  isDesktop: boolean;
  onVolume: (v: number) => void;
  onZoom: (z: number) => void;
  onFullscreen: () => void;
  onWindowSize: (w: number, h: number) => void;
  onBack: () => void;
}

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function statsHtml(stats: RunStats): string {
  const dps = stats.time > 0 ? Math.round(stats.totalDamage / stats.time) : 0;
  const rows = [
    ["Survived", fmtTime(stats.time)],
    ["Kills", String(stats.kills)],
    ["Level", String(stats.level)],
    ["DPS", String(dps)],
    ...stats.weapons.map((w) => [w.name, `Lv ${w.level}`] as [string, string]),
  ];
  return `<table class="stats">${rows
    .map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`)
    .join("")}</table>`;
}

export class Menu {
  private root: HTMLDivElement;

  constructor(onAction: (action: string) => void) {
    this.root = document.createElement("div");
    this.root.id = "menu-overlay";
    document.body.appendChild(this.root);
    this.root.addEventListener("click", (e) => {
      const action = (e.target as HTMLElement).dataset?.action;
      if (action) onAction(action);
    });
  }

  showMain(isDesktop: boolean) {
    const buttons: MenuButton[] = [
      { label: "Play", action: "play" },
      { label: "Settings", action: "settings" },
    ];
    if (isDesktop) buttons.push({ label: "Quit", action: "quit" });
    this.render(
      '<span class="logo">Swarm Survivors</span>',
      "Outlast the swarm. WASD to move — weapons fire themselves.",
      buttons
    );
  }

  showPause(stats: RunStats) {
    this.root.innerHTML = `
      <div class="panel">
        <h1>Paused</h1>
        ${statsHtml(stats)}
        <button data-action="resume">Resume</button>
        <button data-action="settings">Settings</button>
        <button data-action="play">Restart</button>
        <button data-action="menu">Menu</button>
      </div>`;
    this.root.classList.add("visible");
  }

  showSettings(cb: SettingsCallbacks) {
    this.root.innerHTML = `
      <div class="panel">
        <h1>Settings</h1>
        <div class="setting-row">
          <label for="vol">Volume</label>
          <input id="vol" type="range" min="0" max="100" value="${Math.round(cb.volume * 100)}" />
        </div>
        <div class="setting-row">
          <label for="zoom">Zoom <span id="zoomval">${Math.round(cb.zoom * 100)}%</span></label>
          <input id="zoom" type="range" min="60" max="200" value="${Math.round(cb.zoom * 100)}" />
        </div>
        <div class="setting-row">
          <label>Fullscreen</label>
          <button class="inline" data-setting="fullscreen">Toggle (F11)</button>
        </div>
        ${
          cb.isDesktop
            ? `<div class="setting-row">
          <label>Window</label>
          <span>
            <button class="inline" data-size="1280x720">1280×720</button>
            <button class="inline" data-size="1600x900">1600×900</button>
            <button class="inline" data-size="1920x1080">1920×1080</button>
          </span>
        </div>`
            : ""
        }
        <button data-setting="back">Back</button>
      </div>`;
    this.root.classList.add("visible");

    this.root.querySelector("#vol")?.addEventListener("input", (e) => {
      cb.onVolume(Number((e.target as HTMLInputElement).value) / 100);
    });
    this.root.querySelector("#zoom")?.addEventListener("input", (e) => {
      const z = Number((e.target as HTMLInputElement).value) / 100;
      const label = this.root.querySelector("#zoomval");
      if (label) label.textContent = `${Math.round(z * 100)}%`;
      cb.onZoom(z);
    });
    this.root
      .querySelector('[data-setting="fullscreen"]')
      ?.addEventListener("click", () => {
        cb.onFullscreen();
      });
    for (const btn of this.root.querySelectorAll("[data-size]")) {
      btn.addEventListener("click", () => {
        const [w, h] = (btn.getAttribute("data-size") ?? "1280x720")
          .split("x")
          .map(Number);
        cb.onWindowSize(w, h);
      });
    }
    this.root
      .querySelector('[data-setting="back"]')
      ?.addEventListener("click", () => {
        cb.onBack();
      });
  }

  showGameOver(stats: RunStats) {
    this.renderEnd("Game Over", "The swarm claims another.", stats);
  }

  showVictory(stats: RunStats) {
    this.renderEnd("Victory!", "Hive Tyrant slain.", stats);
  }

  private renderEnd(title: string, subtitle: string, stats: RunStats) {
    this.root.innerHTML = `
      <div class="panel">
        <h1>${title}</h1>
        <p>${subtitle}</p>
        ${statsHtml(stats)}
        <button data-action="play">Play Again</button>
        <button data-action="menu">Menu</button>
      </div>`;
    this.root.classList.add("visible");
  }

  showWeaponSelect(
    weapons: { id: string; name: string; desc: string }[],
    onPick: (id: string) => void
  ) {
    this.root.innerHTML = `
      <div class="panel">
        <h1>Choose Your Weapon</h1>
        <p>More unlock during the run</p>
        <div class="cards weapon-grid">
          ${weapons
            .map(
              (w) => `
            <button class="card" data-weapon="${w.id}">
              <strong>${w.name}</strong>
              <span>${w.desc}</span>
            </button>`
            )
            .join("")}
        </div>
      </div>`;
    this.root.classList.add("visible");
    const handler = (e: Event) => {
      const el = (e.target as HTMLElement).closest("[data-weapon]");
      if (!el) return;
      this.root.removeEventListener("click", handler);
      onPick(el.getAttribute("data-weapon") ?? "");
    };
    this.root.addEventListener("click", handler);
  }

  showDraft(options: DraftCard[], onPick: (index: number) => void) {
    this.root.innerHTML = `
      <div class="panel">
        <h1>Level Up!</h1>
        <p>Choose an upgrade</p>
        <div class="cards">
          ${options
            .map(
              (o, i) => `
            <button class="card" data-draft="${i}">
              <strong>${o.name}${o.level ? ` <span class="lvl">Lv ${o.level}</span>` : ""}</strong>
              <span>${o.desc}</span>
            </button>`
            )
            .join("")}
        </div>
      </div>`;
    this.root.classList.add("visible");
    const handler = (e: Event) => {
      const el = (e.target as HTMLElement).closest("[data-draft]");
      if (!el) return;
      this.root.removeEventListener("click", handler);
      onPick(Number(el.getAttribute("data-draft")));
    };
    this.root.addEventListener("click", handler);
  }

  hide() {
    this.root.classList.remove("visible");
    this.root.innerHTML = "";
  }

  private render(title: string, subtitle: string, buttons: MenuButton[]) {
    this.root.innerHTML = `
      <div class="panel">
        <h1>${title}</h1>
        <p>${subtitle}</p>
        ${buttons.map((b) => `<button data-action="${b.action}">${b.label}</button>`).join("")}
      </div>`;
    this.root.classList.add("visible");
  }
}
