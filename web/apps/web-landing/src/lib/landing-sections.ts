export type ProductTab = 'run' | 'recover' | 'prove';

export const LANDING_PRODUCT_TAB_EVENT = 'igris:landing-product-tab';
export const LANDING_PRODUCT_REVEAL_EVENT = 'igris:landing-product-reveal';

export const LANDING_SECTIONS = {
  product: 'product',
  productRun: 'product-run',
  productRecover: 'product-recover',
  productProve: 'product-prove',
  overview: 'overview',
  actionEndpoint: 'action-endpoint',
} as const;

export function landingHash(sectionId: string): string {
  return `/#${sectionId}`;
}

export function resolveLandingScrollTarget(hash: string): {
  elementId: string;
  productTab?: ProductTab;
} {
  switch (hash) {
    case LANDING_SECTIONS.productRun:
      return { elementId: LANDING_SECTIONS.product, productTab: 'run' };
    case LANDING_SECTIONS.productRecover:
      return { elementId: LANDING_SECTIONS.product, productTab: 'recover' };
    case LANDING_SECTIONS.productProve:
      return { elementId: LANDING_SECTIONS.product, productTab: 'prove' };
    case LANDING_SECTIONS.product:
      return { elementId: LANDING_SECTIONS.product };
    case LANDING_SECTIONS.overview:
      return { elementId: LANDING_SECTIONS.overview };
    case LANDING_SECTIONS.actionEndpoint:
      return { elementId: LANDING_SECTIONS.actionEndpoint };
    default:
      return { elementId: hash };
  }
}

export function dispatchProductTab(tab: ProductTab) {
  window.dispatchEvent(new CustomEvent(LANDING_PRODUCT_TAB_EVENT, { detail: tab }));
}

export function dispatchProductReveal() {
  window.dispatchEvent(new CustomEvent(LANDING_PRODUCT_REVEAL_EVENT));
}

export function scrollToLandingSection(hash: string, behavior: ScrollBehavior = 'smooth') {
  const id = hash.replace(/^#/, '');
  const { elementId, productTab } = resolveLandingScrollTarget(id);

  if (productTab) {
    dispatchProductReveal();
    dispatchProductTab(productTab);
  }

  const scroll = () => {
    document.getElementById(elementId)?.scrollIntoView({ behavior, block: 'start' });
  };

  // Wait for tab swap / reveal before scrolling.
  requestAnimationFrame(() => requestAnimationFrame(scroll));
}