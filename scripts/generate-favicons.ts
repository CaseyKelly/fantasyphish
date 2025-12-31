import sharp from "sharp"
import { writeFileSync } from "fs"
import { join } from "path"

// Donut SVG template with exact colors from DonutLogo component
const createDonutSVG = (size: number, strokeWidth: number) => `
<svg width="${size}" height="${size}" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
  <rect width="120" height="120" fill="#2d4654"/>
  <circle cx="60" cy="60" r="40" stroke="#c23a3a" stroke-width="${strokeWidth}" fill="none"/>
</svg>
`

const publicDir = join(process.cwd(), "public")

async function generateFavicons() {
  console.log("🍩 Generating favicon files...")

  // Configuration for different sizes
  const configs = [
    { name: "favicon-16x16.png", size: 16, strokeWidth: 24 },
    { name: "favicon-32x32.png", size: 32, strokeWidth: 24 },
    { name: "apple-touch-icon.png", size: 180, strokeWidth: 24 },
    { name: "android-chrome-192x192.png", size: 192, strokeWidth: 24 },
    { name: "android-chrome-512x512.png", size: 512, strokeWidth: 24 },
  ]

  // Generate PNG files
  for (const config of configs) {
    const svg = createDonutSVG(config.size, config.strokeWidth)
    const buffer = Buffer.from(svg)

    await sharp(buffer)
      .resize(config.size, config.size)
      .png()
      .toFile(join(publicDir, config.name))

    console.log(`✅ Created ${config.name}`)
  }

  // Generate favicon.ico (multi-resolution: 16x16, 32x32, 48x48)
  // ICO format requires special handling - we'll create a 32x32 as the main favicon
  const svg32 = createDonutSVG(32, 24)
  const buffer32 = Buffer.from(svg32)

  await sharp(buffer32)
    .resize(32, 32)
    .png()
    .toFile(join(publicDir, "favicon.ico"))

  console.log("✅ Created favicon.ico")

  console.log("\n🎉 All favicons generated successfully!")
}

generateFavicons().catch(console.error)
