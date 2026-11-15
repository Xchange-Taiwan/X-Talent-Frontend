/**
 * Backwards-compatible exports for visual-parity helpers.
 * Core multimodal orchestration now lives in `./pipeline.mjs`.
 */
import { isUiReviewFile } from './lib/ticket.mjs';
import { MAX_EVIDENCE_IMAGES, MAX_REF_IMAGES } from './lib/visuals.mjs';
import { shouldSkipVisualParity } from './pipeline.mjs';

export {
  isUiReviewFile,
  MAX_EVIDENCE_IMAGES,
  MAX_REF_IMAGES,
  shouldSkipVisualParity,
};
