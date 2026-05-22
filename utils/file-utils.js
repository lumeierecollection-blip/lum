/**
 * Lumière Collection — File I/O Utilities
 * Safe file and directory helpers with auto-creation.
 */

import fs from 'fs';
import path from 'path';

/**
 * Ensure a directory exists, creating it recursively if needed.
 * @param {string} dirPath
 */
export function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Write a file safely, creating parent directories as needed.
 * @param {string} filePath
 * @param {string|Buffer} content
 * @param {string} encoding - default 'utf8'
 */
export function writeFileSafe(filePath, content, encoding = 'utf8') {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, encoding);
}

/**
 * Write a JSON file with 2-space indentation.
 * @param {string} filePath
 * @param {object} data
 */
export function writeJsonFile(filePath, data) {
  writeFileSafe(filePath, JSON.stringify(data, null, 2));
}

/**
 * Read and parse a JSON file.
 * @param {string} filePath
 * @returns {object|null}
 */
export function readJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Append text to a file, creating it if it doesn't exist.
 * @param {string} filePath
 * @param {string} content
 */
export function appendFileSafe(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.appendFileSync(filePath, content, 'utf8');
}

/**
 * List all files in a directory (non-recursive).
 * @param {string} dirPath
 * @returns {string[]} Array of full file paths
 */
export function listFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  return fs
    .readdirSync(dirPath)
    .map((f) => path.join(dirPath, f))
    .filter((f) => fs.statSync(f).isFile());
}

/**
 * List all subdirectories in a directory.
 * @param {string} dirPath
 * @returns {string[]} Array of full dir paths
 */
export function listDirs(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  return fs
    .readdirSync(dirPath)
    .map((f) => path.join(dirPath, f))
    .filter((f) => fs.statSync(f).isDirectory());
}

/**
 * Delete a file if it exists.
 * @param {string} filePath
 */
export function deleteFileSafe(filePath) {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

/**
 * Get file size in bytes.
 * @param {string} filePath
 * @returns {number}
 */
export function getFileSize(filePath) {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return 0;
  }
}

/**
 * Check if a path exists (file or directory).
 * @param {string} targetPath
 * @returns {boolean}
 */
export function exists(targetPath) {
  return fs.existsSync(targetPath);
}

/**
 * Copy a file to a destination, creating dirs as needed.
 * @param {string} src
 * @param {string} dest
 */
export function copyFileSafe(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

/**
 * Generate a product output directory path.
 * @param {string} baseOutputDir
 * @param {string} productSlug
 * @returns {string}
 */
export function productOutputDir(baseOutputDir, productSlug) {
  return path.join(baseOutputDir, productSlug);
}

/**
 * Print a directory tree to a string (for terminal output).
 * @param {string} dirPath
 * @param {string} prefix
 * @param {number} maxDepth
 * @returns {string}
 */
export function printTree(dirPath, prefix = '', maxDepth = 3, depth = 0) {
  if (depth > maxDepth) return '';
  if (!fs.existsSync(dirPath)) return '';

  let result = '';
  const entries = fs.readdirSync(dirPath).sort();

  entries.forEach((entry, i) => {
    const isLast = i === entries.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    const childPrefix = prefix + (isLast ? '    ' : '│   ');
    const fullPath = path.join(dirPath, entry);
    const stat = fs.statSync(fullPath);

    result += prefix + connector + entry + '\n';

    if (stat.isDirectory() && depth < maxDepth) {
      result += printTree(fullPath, childPrefix, maxDepth, depth + 1);
    }
  });

  return result;
}
