// The editable SVG is the source of truth. Windows requires PNG/ICO derivatives.
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'assets', 'tag-watch.svg');
const images = path.join(root, 'windows', 'TagWatch.Package', 'Images');

async function png(width, height, size) {
  const mark = await sharp(source).resize(size, size).png().toBuffer();
  return sharp({
    create: { width, height, channels: 4, background: '#101315' },
  })
    .composite([{ input: mark, gravity: 'centre' }])
    .png()
    .toBuffer();
}

async function main() {
  const svg = await fs.readFile(source);
  await fs.writeFile(
    path.join(root, 'assets', 'tag-watch-source.json'),
    JSON.stringify({
      uri: `data:image/svg+xml;base64,${svg.toString('base64')}`,
    }),
  );
  const outputs = [
    ['StoreLogo.png', 50, 50, 50],
    ['Square44x44Logo.scale-200.png', 88, 88, 88],
    ['Square44x44Logo.targetsize-24_altform-unplated.png', 24, 24, 24],
    ['Square150x150Logo.scale-200.png', 300, 300, 300],
    ['Wide310x150Logo.scale-200.png', 620, 300, 240],
    ['SplashScreen.scale-200.png', 1240, 600, 280],
    ['LockScreenLogo.scale-200.png', 48, 48, 48],
  ];
  for (const [name, width, height, size] of outputs) {
    // Square icons retain transparent corners outside the rounded tile.
    const data =
      width === height
        ? await sharp(source).resize(width, height).png().toBuffer()
        : await png(width, height, size);
    await fs.writeFile(path.join(images, name), data);
  }
  const sizes = [16, 20, 24, 28, 32, 40, 48, 64, 128, 256];
  const frames = await Promise.all(
    sizes.map(size => sharp(source).resize(size).png().toBuffer()),
  );
  const header = Buffer.alloc(6 + 16 * sizes.length);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);
  let offset = header.length;
  frames.forEach((frame, index) => {
    const entry = 6 + index * 16;
    header[entry] = sizes[index] % 256;
    header[entry + 1] = sizes[index] % 256;
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(frame.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += frame.length;
  });
  const ico = Buffer.concat([header, ...frames]);
  for (const name of ['small.ico', 'TagWatch.ico']) {
    await fs.writeFile(path.join(root, 'windows', 'TagWatch', name), ico);
  }
  await sharp(source)
    .resize(512)
    .png()
    .toFile(path.join(root, 'assets', 'tag-watch-preview.png'));
  console.log('Generated Windows icons from assets/tag-watch.svg');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
