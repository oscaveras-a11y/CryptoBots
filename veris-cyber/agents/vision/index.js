// VISION processes image metadata through an injected, explicitly configured adapter.
// It does not pretend to understand pixels without a vision model.
const MAX_IMAGES = 4;
const MAX_BYTES = 10 * 1024 * 1024;
const MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
export function validateImages(images) {
  if (!Array.isArray(images) || images.length < 1 || images.length > MAX_IMAGES) throw new TypeError('invalid_image_count');
  return images.map((image, index) => {
    if (!image || typeof image !== 'object' || Array.isArray(image)) throw new TypeError('invalid_image_' + index);
    if (!MIME.has(image.mimeType)) throw new TypeError('unsupported_image_type');
    if (!Number.isInteger(image.byteLength) || image.byteLength < 1 || image.byteLength > MAX_BYTES) throw new TypeError('invalid_image_size');
    if (typeof image.id !== 'string' || !image.id.trim() || image.id.length > 256) throw new TypeError('invalid_image_id');
    return { id: image.id, mimeType: image.mimeType, byteLength: image.byteLength };
  });
}
export default async function vision({ instruction = '', data = {} } = {}, context = {}) {
  const images = Array.isArray(data.images) ? data.images : data.image ? [data.image] : [];
  if (!images.length) return { status: 'requires_image', verified: false, observations: [] };
  const validated = validateImages(images);
  if (context.signal?.aborted) throw new Error('vision_aborted');
  if (typeof context.analyzeImages !== 'function') {
    return { status: 'requires_image_adapter', images: validated, verified: false, observations: [] };
  }
  const result = await context.analyzeImages({ instruction: String(instruction).slice(0, 1000), images: validated }, { signal: context.signal });
  if (context.signal?.aborted) throw new Error('vision_aborted');
  if (!result || !Array.isArray(result.observations)) throw new Error('invalid_vision_adapter_response');
  const observations = result.observations.slice(0, 30).filter(x => x && typeof x.description === 'string').map(x => ({
    description: x.description.slice(0, 1000),
    confidence: Number.isFinite(x.confidence) ? Math.max(0, Math.min(1, x.confidence)) : null,
    imageId: typeof x.imageId === 'string' ? x.imageId : null
  }));
  return { status: 'observations_ready', images: validated, observations, verified: false, requiresVerification: true };
}
