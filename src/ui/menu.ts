export interface MenuButton {
  label: string;
  action: string;
}

export interface DraftCard {
  name: string;
  desc: string;
  level?: number;
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
    const buttons: MenuButton[] = [{ label: "Play", action: "play" }];
    if (isDesktop) buttons.push({ label: "Quit", action: "quit" });
    this.render("Swarm Survivors", "prototype build", buttons);
  }

  showGameOver(kills: number, time: number) {
    this.render("Game Over", `${kills} kills · survived ${time.toFixed(1)}s`, [
      { label: "Retry", action: "play" },
      { label: "Menu", action: "menu" },
    ]);
  }

  showVictory(kills: number, time: number) {
    this.render(
      "Victory!",
      `Hive Tyrant slain · ${kills} kills · ${time.toFixed(1)}s`,
      [
        { label: "Play Again", action: "play" },
        { label: "Menu", action: "menu" },
      ]
    );
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
