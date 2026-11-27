/**
 * Shared toggle-group helpers for the docs' interactive components.
 *
 * Canonical implementation of the "deactivate every group element, then
 * activate the clicked one" pattern: keeps the `active` class and the
 * group's aria state (`ariaAttr`, e.g. `aria-pressed` for buttons,
 * `aria-selected` for tabs) in sync across components.
 *
 * `group` accepts a DOM `NodeList` (from `querySelectorAll`) or a plain
 * array of elements.
 */
export type ToggleGroup = readonly Element[] | NodeList;

/**
 * Deactivate every element in `group` (remove `active`, set `ariaAttr` to
 * `'false'`), then activate `clicked` (`active` + `ariaAttr` set to `'true'`).
 */
export function setGroupActive(group: ToggleGroup, clicked: Element, ariaAttr: string): void {
  deactivateGroup(group, ariaAttr);
  clicked.classList.add('active');
  clicked.setAttribute(ariaAttr, 'true');
}

/** Deactivate-only variant: remove `active` and set `ariaAttr='false'` on every element in `group`. */
export function deactivateGroup(group: ToggleGroup, ariaAttr: string): void {
  for (const el of Array.from(group as readonly Element[])) {
    el.classList.remove('active');
    el.setAttribute(ariaAttr, 'false');
  }
}
