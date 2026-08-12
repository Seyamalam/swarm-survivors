export interface MenuButton {
  label: string;
  action: string;
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
    this.render(
      "Game Over",
      `${kills} kills · survived ${time.toFixed(1)}s`,
      [
        { label: "Retry", action: "play" },
        { label: "Menu", action: "menu" },
      ],
    );
  }

  hide() {
    this.root.classList.remove("visible");
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
