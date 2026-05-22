/**
 * Lumière Collection — Terminal Logger
 * Chalk + Ora based logging with branded terminal output.
 */

import chalk from 'chalk';
import ora from 'ora';

// ─────────────────────────────────────────────────────────────
// BRAND COLOURS (chalk doesn't do hex natively on all terminals,
// so we map to closest ANSI approximations + hex for truecolour)
// ─────────────────────────────────────────────────────────────

const c = {
  gold: chalk.hex('#C9A84C'),
  blush: chalk.hex('#E8C4C4'),
  charcoal: chalk.hex('#3D3535'),
  ivory: chalk.hex('#FAF7F0'),
  success: chalk.green,
  error: chalk.red,
  warn: chalk.yellow,
  info: chalk.cyan,
  dim: chalk.dim,
  bold: chalk.bold,
};

export const logger = {
  /** Print the branded header banner */
  banner() {
    console.log('');
    console.log(c.gold('╔══════════════════════════════════════╗'));
    console.log(c.gold('║') + c.ivory('     LUMIÈRE COLLECTION — CONTENT     ') + c.gold('║'));
    console.log(c.gold('║') + c.ivory('        AUTOMATION SYSTEM v1.0        ') + c.gold('║'));
    console.log(c.gold('╚══════════════════════════════════════╝'));
    console.log('');
  },

  /** Print a product header line */
  productHeader(name, ageRange) {
    console.log(c.bold(`Product: ${name}`) + c.dim(` (Ages ${ageRange})`));
    console.log(c.dim('─────────────────────────────────────────'));
    console.log('');
  },

  /** Print success message with ✓ */
  success(message) {
    console.log(c.success('✓ ') + message);
  },

  /** Print error message with ✗ */
  error(message, err) {
    console.log(c.error('✗ ') + message);
    if (err && process.env.LOG_LEVEL === 'debug') {
      console.error(c.dim(err.stack || err.message || err));
    }
  },

  /** Print warning */
  warn(message) {
    console.log(c.warn('⚠ ') + message);
  },

  /** Print info/note */
  info(message) {
    console.log(c.info('→ ') + message);
  },

  /** Print dim sub-step */
  step(message) {
    console.log(c.dim('  ↳ ') + message);
  },

  /** Print a notice box (for TikTok queue saves, etc.) */
  notice(lines) {
    console.log('');
    console.log(c.gold('📋 ') + lines[0]);
    lines.slice(1).forEach((line) => console.log(c.dim('   ') + line));
    console.log('');
  },

  /** Print the completion summary */
  complete(productName, outputPath, elapsedMs) {
    const secs = Math.round(elapsedMs / 1000);
    console.log('');
    console.log(c.dim('─────────────────────────────────────────'));
    console.log(c.gold('✨ COMPLETE — ') + c.bold(productName));
    console.log(c.dim('   Output: ') + outputPath);
    console.log(c.dim('   Time:   ') + `${secs} seconds`);
    console.log(c.dim('─────────────────────────────────────────'));
    console.log('');
  },

  /** Print a section divider */
  divider() {
    console.log(c.dim('─────────────────────────────────────────'));
  },

  /** Start a spinner and return it */
  spinner(text) {
    return ora({ text, spinner: 'dots' }).start();
  },

  /** Log a brand voice violation catch */
  brandViolation(word, attempt) {
    console.log(c.warn(`  ↳ Brand voice: caught "${word}" — retrying (attempt ${attempt}/2)`));
  },

  /** Log a brand voice clean pass */
  brandClean(violations) {
    if (violations === 0) {
      console.log(c.dim('  ↳ Brand voice check... ') + c.success('✓') + c.dim(' (0 violations)'));
    } else {
      console.log(c.dim('  ↳ Brand voice check... ') + c.warn(`⚠ ${violations} flagged for review`));
    }
  },
};

export default logger;
