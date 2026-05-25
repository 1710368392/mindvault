// @ts-nocheck

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const THUMB_IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'];

function isImageFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return THUMB_IMAGE_EXTS.includes(ext);
}

const THUMBNAIL_SIZE = 1440;

async function generateImageThumbnail(filePath: string, outputPath: string): Promise<string> {
  if (!isImageFile(filePath)) {
    return '';
  }

  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  await sharp(filePath)
    .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toFile(outputPath);

  return outputPath;
}

function getThumbnailPath(mediaDir: string, filename: string): string {
  const thumbnailsDir = path.join(mediaDir, 'thumbnails');
  return path.join(thumbnailsDir, `thumb_${filename}.jpg`);
}

module.exports = { generateImageThumbnail, getThumbnailPath, isImageFile };
