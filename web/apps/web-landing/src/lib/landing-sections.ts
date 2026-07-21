export type ProductTab = 'run' | 'recover' | 'prove';

export const LANDING_PRODUCT_TAB_EVENT = 'igris:landing-product-tab';
export const LANDING_PRODUCT_REVEAL_EVENT = 'igris:landing-product-reveal';

export const LANDING_SECTIONS = {
  hero: 'vision-hero',
  problem: 'vision-problem',
  howItWorks: 'vision-how-it-works',
  outcomes: 'vision-outcomes',
  sdk: 'vision-sdk',
  useCases: 'vision-use-cases',
  runProof: 'vision-run-proof',
  cta: 'vision-cta',
  // Legacy aliases kept for older deep links; resolve to current sections.
  product: 'vision-how-it-works',
  productRun: 'vision-how-it-works',
  productRecover: 'vision-outcomes',
  productProve: 'vision-run-proof',
  overview: 'vision-problem',
  actionEndpoint: 'vision-sdk',
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
    case 'product-run':
      return { elementId: LANDING_SECTIONS.howItWorks };
    case LANDING_SECTIONS.productRecover:
    case 'product-recover':
      return { elementId: LANDING_SECTIONS.outcomes };
    case LANDING_SECTIONS.productProve:
    case 'product-prove':
      return { elementId: LANDING_SECTIONS.runProof };
    case LANDING_SECTIONS.product:
    case 'product':
      return { elementId: LANDING_SECTIONS.howItWorks };
    case LANDING_SECTIONS.overview:
    case 'overview':
      return { elementId: LANDING_SECTIONS.problem };
    case LANDING_SECTIONS.actionEndpoint:
    case 'action-endpoint':
      return { elementId: LANDING_SECTIONS.sdk };
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
