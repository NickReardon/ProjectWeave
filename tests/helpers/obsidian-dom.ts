/**
 * Obsidian adds a small set of convenience methods to `HTMLElement` at runtime.
 * They are declared in `obsidian.d.ts` but implemented by the application, so a
 * test DOM has to install equivalents before any view can render.
 *
 * These implementations cover only the options Project Weave's views actually
 * pass. Anything beyond that should fail loudly here rather than quietly
 * diverge from Obsidian.
 */

interface DomElementInfo {
  readonly cls?: string | string[];
  readonly text?: string;
  readonly attr?: Record<string, string | number | boolean | null>;
  readonly value?: string;
}

const SUPPORTED_KEYS = new Set(['cls', 'text', 'attr', 'value']);

function applyInfo(element: HTMLElement, info: DomElementInfo): void {
  for (const key of Object.keys(info)) {
    if (!SUPPORTED_KEYS.has(key)) {
      throw new Error(
        `The Obsidian DOM stub does not implement the "${key}" option. ` +
          'Add it here deliberately rather than assuming Obsidian behavior.',
      );
    }
  }

  if (info.cls !== undefined) {
    const classes = Array.isArray(info.cls) ? info.cls : info.cls.split(' ');
    for (const cls of classes) {
      if (cls !== '') {
        element.classList.add(cls);
      }
    }
  }
  if (info.text !== undefined) {
    element.textContent = info.text;
  }
  if (info.attr !== undefined) {
    for (const [name, value] of Object.entries(info.attr)) {
      if (value === null || value === false) {
        continue;
      }
      element.setAttribute(name, String(value));
    }
  }
  if (info.value !== undefined) {
    element.setAttribute('value', info.value);
    if (
      element instanceof HTMLInputElement ||
      element instanceof HTMLOptionElement ||
      element instanceof HTMLSelectElement
    ) {
      element.value = info.value;
    }
  }
}

/**
 * Installs the helpers onto the current environment's `HTMLElement`. Safe to
 * call more than once; later calls replace the same definitions.
 */
export function installObsidianDom(): void {
  const proto = HTMLElement.prototype as unknown as Record<string, unknown>;

  function createEl(
    this: HTMLElement,
    tag: string,
    info: DomElementInfo = {},
  ): HTMLElement {
    const element = this.ownerDocument.createElement(tag);
    applyInfo(element, info);
    this.appendChild(element);
    return element;
  }

  proto.createEl = createEl;

  proto.createDiv = function createDiv(
    this: HTMLElement,
    info: DomElementInfo = {},
  ): HTMLElement {
    return createEl.call(this, 'div', info);
  };

  proto.createSpan = function createSpan(
    this: HTMLElement,
    info: DomElementInfo = {},
  ): HTMLElement {
    return createEl.call(this, 'span', info);
  };

  proto.empty = function empty(this: HTMLElement): void {
    while (this.firstChild !== null) {
      this.removeChild(this.firstChild);
    }
  };

  proto.setText = function setText(this: HTMLElement, text: string): void {
    this.textContent = text;
  };

  proto.appendText = function appendText(
    this: HTMLElement,
    text: string,
  ): void {
    this.appendChild(this.ownerDocument.createTextNode(text));
  };

  proto.addClass = function addClass(
    this: HTMLElement,
    ...classes: string[]
  ): void {
    this.classList.add(...classes);
  };

  proto.removeClass = function removeClass(
    this: HTMLElement,
    ...classes: string[]
  ): void {
    this.classList.remove(...classes);
  };

  proto.toggleClass = function toggleClass(
    this: HTMLElement,
    classes: string | string[],
    value: boolean,
  ): void {
    for (const cls of Array.isArray(classes) ? classes : [classes]) {
      this.classList.toggle(cls, value);
    }
  };

  proto.hasClass = function hasClass(this: HTMLElement, cls: string): boolean {
    return this.classList.contains(cls);
  };

  proto.detach = function detach(this: HTMLElement): void {
    this.remove();
  };
}
