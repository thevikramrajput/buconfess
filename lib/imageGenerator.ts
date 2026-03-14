import { createCanvas } from '@napi-rs/canvas';
import fs from 'fs';
import path from 'path';

const CANVAS_SIZE = 1080;
const PADDING = 80;
const MAX_CHARS_PER_IMAGE = 450;
const FONT_SIZE = 36;
const LINE_HEIGHT = 52;

export function splitTextIntoParts(text: string): string[] {
  if (text.length <= MAX_CHARS_PER_IMAGE) return [text];
  const parts: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= MAX_CHARS_PER_IMAGE) {
      parts.push(remaining);
      break;
    }
    let splitAt = MAX_CHARS_PER_IMAGE;
    // Find last space before limit
    while (splitAt > 0 && remaining[splitAt] !== ' ') splitAt--;
    if (splitAt === 0) splitAt = MAX_CHARS_PER_IMAGE;
    parts.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }
  return parts;
}

function wrapText(ctx: any, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  for (const word of words) {
    const testLine = currentLine ? currentLine + ' ' + word : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

export async function generateConfessionImage(
  text: string,
  confessionNumber: number,
  partIndex: number,
  totalParts: number,
  outputDir: string
): Promise<string> {
  const canvas = createCanvas(CANVAS_SIZE, CANVAS_SIZE);
  const ctx = canvas.getContext('2d');

  // Background gradient
  const gradient = ctx.createLinearGradient(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  gradient.addColorStop(0, '#0f0f23');
  gradient.addColorStop(1, '#1a1a3e');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  // Top accent line
  ctx.fillStyle = '#6366f1';
  ctx.fillRect(PADDING, 60, 80, 4);

  // Header
  ctx.fillStyle = '#6366f1';
  ctx.font = 'bold 28px Arial';
  ctx.fillText('BU Confessions', PADDING, 55);

  // Confession number
  ctx.fillStyle = '#888';
  ctx.font = '22px Arial';
  const partLabel = totalParts > 1 ? ` (${partIndex + 1}/${totalParts})` : '';
  ctx.fillText(`#${confessionNumber}${partLabel}`, CANVAS_SIZE - PADDING - 120, 55);

  // Main text
  ctx.fillStyle = '#ffffff';
  ctx.font = `${FONT_SIZE}px Arial`;
  const maxWidth = CANVAS_SIZE - PADDING * 2;
  const lines = wrapText(ctx, text, maxWidth);
  const totalTextHeight = lines.length * LINE_HEIGHT;
  const startY = (CANVAS_SIZE - totalTextHeight) / 2;

  lines.forEach((line, i) => {
    ctx.fillText(line, PADDING, startY + i * LINE_HEIGHT);
  });

  // Footer
  ctx.fillStyle = '#555';
  ctx.font = '22px Arial';
  ctx.fillText('@bu.confess', PADDING, CANVAS_SIZE - 50);

  // Watermark dots
  ctx.fillStyle = '#6366f1';
  ctx.beginPath();
  ctx.arc(CANVAS_SIZE - 60, CANVAS_SIZE - 50, 6, 0, Math.PI * 2);
  ctx.fill();

  // Save file
  fs.mkdirSync(outputDir, { recursive: true });
  const filename = `confession_${confessionNumber}_part${partIndex + 1}.jpg`;
  const filepath = path.join(outputDir, filename);
  const buffer = (canvas as any).toBuffer('image/jpeg', 95);
  fs.writeFileSync(filepath, buffer);
  return filepath;
}
