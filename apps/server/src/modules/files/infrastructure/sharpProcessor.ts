import sharp from 'sharp';
import type { ImageProcessor } from '../application/ports';

const MAX_PIXELS = 40_000_000;

export class SharpImageProcessor implements ImageProcessor {
  async process(input: Buffer, mime: string) {
    const base = () =>
      sharp(input, { limitInputPixels: MAX_PIXELS, animated: mime === 'image/gif' });
    const meta = await base().metadata();
    if (!meta.width || !meta.height) throw new Error('unreadable image');

    // Re-encode still images: strips EXIF (GPS!) and neutralises polyglot payloads. GIFs stay byte-identical
    // so animations survive.
    let original = input;
    if (mime !== 'image/gif') {
      const pipeline = sharp(input, { limitInputPixels: MAX_PIXELS }).rotate();
      original =
        mime === 'image/png'
          ? await pipeline.png({ compressionLevel: 9 }).toBuffer()
          : mime === 'image/webp'
            ? await pipeline.webp({ quality: 90 }).toBuffer()
            : await pipeline.jpeg({ quality: 90, mozjpeg: true }).toBuffer();
    }
    const thumb = await sharp(input, { limitInputPixels: MAX_PIXELS })
      .rotate()
      .resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer();

    const oriented = meta.orientation && meta.orientation >= 5;
    return {
      original,
      thumb,
      width: oriented ? meta.height : meta.width,
      height: oriented ? meta.width : meta.height,
    };
  }
}
