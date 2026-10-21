/**
 * Petit utilitaire pour créer des éléments HTML.
 * Le texte passe toujours par textContent : un nom de joueur ne peut pas injecter de HTML.
 *
 *   h("button", { class: "primary", onclick: () => ... }, "Créer")
 */
type Attrs = Record<string, string | boolean | ((ev: Event) => void) | undefined>;
type Child = Node | string | null | undefined | false;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K, attrs: Attrs = {}, ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    if (typeof value === "function") el.addEventListener(key.replace(/^on/, ""), value);
    else if (value === true) el.setAttribute(key, "");
    else el.setAttribute(key, value);
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    el.append(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return el;
}

/** Remplace tout le contenu de l'écran principal. */
export function showScreen(...content: Node[]) {
  document.querySelector("#screen")!.replaceChildren(...content);
}
