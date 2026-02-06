// Setup script to copy and rename images for startups
const fs = require("fs");
const path = require("path");

const SOURCE_DIR = path.join(__dirname, "..", "images");
const DEST_DIR = path.join(__dirname, "public", "images");

// Get list of source images (PNG files only)
const sourceImages = fs.readdirSync(SOURCE_DIR)
    .filter(f => f.endsWith(".png") && !f.includes("removebg") && !f.includes("unnamed"))
    .slice(0, 19); // Take first 19 images

console.log(`Found ${sourceImages.length} source images`);

// Startup slugs (19 startups)
const STARTUPS = [
    "manus",           // 1 - Legendary
    "lovable",         // 2 - Legendary
    "cursor",          // 3 - Legendary
    "anthropic",       // 4 - Legendary
    "openai",          // 5 - Epic Rare
    "browser-use",     // 6 - Epic
    "dedalus-labs",    // 7 - Epic
    "autumn",          // 8 - Epic
    "axiom",           // 9 - Epic
    "multifactor",     // 10 - Rare
    "dome",            // 11 - Rare
    "grazemate",       // 12 - Rare
    "tornyol-systems", // 13 - Rare
    "axiom-rare",      // 14 - Rare
    "pocket",          // 15 - Common
    "caretta",         // 16 - Common
    "axionorbital-space", // 17 - Common
    "freeport-markets",   // 18 - Common
    "ruvo"             // 19 - Common
];

// Create destination directory if not exists
if (!fs.existsSync(DEST_DIR)) {
    fs.mkdirSync(DEST_DIR, { recursive: true });
}

// Copy and rename images
for (let i = 0; i < STARTUPS.length; i++) {
    const sourceImage = sourceImages[i % sourceImages.length]; // Cycle through if not enough images
    const sourcePath = path.join(SOURCE_DIR, sourceImage);
    const destPath = path.join(DEST_DIR, `${STARTUPS[i]}.png`);

    fs.copyFileSync(sourcePath, destPath);
    console.log(`✅ ${STARTUPS[i]}.png <- ${sourceImage}`);
}

console.log(`\n🎉 Done! ${STARTUPS.length} images copied to ${DEST_DIR}`);
