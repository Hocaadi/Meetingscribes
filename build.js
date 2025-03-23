const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Log the current directory
console.log('Current directory:', process.cwd());

// Install dependencies in the frontend directory
console.log('Installing frontend dependencies...');
execSync('cd frontend && npm install', { stdio: 'inherit' });

// Build the frontend
console.log('Building frontend...');
execSync('cd frontend && npm run build', { stdio: 'inherit' });

// Create a dist directory if it doesn't exist
const distDir = path.join(process.cwd(), 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir);
}

// Copy the frontend build to the dist directory using fs instead of cp
console.log('Copying frontend build to dist directory...');
const buildDir = path.join(process.cwd(), 'frontend', 'build');

// Function to copy files recursively
function copyDir(src, dest) {
  // Create the destination directory if it doesn't exist
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  // Read all files in the source directory
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    // If it's a directory, copy it recursively
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      // Otherwise, copy the file
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Copy the build directory to the dist directory
copyDir(buildDir, distDir);

console.log('Build completed successfully!'); 