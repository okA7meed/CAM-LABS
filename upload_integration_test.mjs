import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const FIXTURES_DIR = '/Users/mac/Downloads/CAM LABS Project { 3D Printing Website }/test-fixtures';

const testFiles = {
  stl: 'tetrahedron.stl',
  obj: 'tetrahedron.obj',
  step: 'occt-linkrods.step',
  stp: 'occt-screw.stp',
  iges: 'occt-hammer.iges',
  igs: 'occt-hammer.igs',
  dxf: 'rectangle-mm.dxf',
  invalid: 'unsupported-cad.txt'
};

async function runFullTest() {
  let browser;
  try {
    // Connect to existing browser
    browser = await chromium.connectOverCDP('http://localhost:9222/');
    const context = browser.contexts()[0];
    const page = context.pages()[0];
    
    // Ensure we're on the upload page
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
    
    // Wait for upload zone to be ready
    await page.waitForSelector('[aria-label="Upload files"]', { timeout: 5000 }).catch(() => null);
    
    console.log('\n╔════════════════════════════════════════════╗');
    console.log('║   CAM LABS UPLOAD SYSTEM - LIVE TEST      ║');
    console.log('╚════════════════════════════════════════════╝\n');
    
    // TEST 1: Single File Upload
    console.log('TEST 1: Single STL File Upload');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const fileInput = page.locator('input[type="file"]');
    const stlFile = path.join(FIXTURES_DIR, testFiles.stl);
    
    // Upload first file
    await fileInput.setInputFiles(stlFile);
    console.log(`✓ Selected: ${testFiles.stl}`);
    
    // Wait for upload to complete
    await page.waitForTimeout(3000);
    
    // Check upload state by examining file rows
    const fileRows = page.locator('article');
    const fileCount = await fileRows.count();
    console.log(`✓ File rows visible: ${fileCount}`);
    
    if (fileCount > 0) {
      const firstRow = fileRows.first();
      const filenameEl = firstRow.locator('strong').first();
      const filename = await filenameEl.textContent();
      console.log(`✓ Filename: ${filename}`);
      
      // Wait for state transitions and check
      let finalState = 'Unknown';
      for (let i = 0; i < 40; i++) {
        await page.waitForTimeout(250);
        const status = await firstRow.locator('text=/Ready|Uploading|Analyzing|Unsupported/').first().textContent().catch(() => '');
        if (status.includes('Ready') || status.includes('Analyzing') || status.includes('Uploading')) {
          finalState = status.trim();
        }
        if (status.includes('Ready')) break;
      }
      console.log(`✓ Final state: ${finalState}`);
    }
    
    // Get counter display
    const counterPill = page.locator('generic:has-text("ready")').first();
    const counterText = await counterPill.textContent().catch(() => '');
    console.log(`✓ Counter: ${counterText}`);
    
    // TEST 2: Add Multiple Files
    console.log('\n\nTEST 2: Add Multiple Files (Different Formats)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const formats = ['obj', 'step', 'stp'];
    for (const format of formats) {
      const testFile = path.join(FIXTURES_DIR, testFiles[format]);
      await fileInput.setInputFiles(testFile);
      console.log(`✓ Added: ${testFiles[format]}`);
      await page.waitForTimeout(500);
    }
    
    // Wait for processing
    await page.waitForTimeout(5000);
    
    const finalCount = await fileRows.count();
    console.log(`✓ Total files uploaded: ${finalCount}`);
    
    // List all files
    for (let i = 0; i < finalCount; i++) {
      const row = fileRows.nth(i);
      const name = await row.locator('strong').first().textContent().catch(() => 'Unknown');
      const state = await row.locator('text=/Ready|Uploading|Analyzing|Unsupported|Processing/').first().textContent().catch(() => 'Unknown');
      console.log(`  [${i+1}] ${name} → ${state.trim()}`);
    }
    
    // TEST 3: Test File Removal
    console.log('\n\nTEST 3: Remove Individual File');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const beforeCount = await fileRows.count();
    console.log(`Before: ${beforeCount} files`);
    
    // Click remove button on first file
    const removeBtn = fileRows.first().locator('button:has-text("Remove")').first();
    await removeBtn.click().catch(() => console.log('Remove button not found'));
    
    await page.waitForTimeout(500);
    
    const afterCount = await fileRows.count();
    console.log(`After: ${afterCount} files`);
    console.log(`✓ File removed: ${beforeCount > afterCount ? 'YES' : 'NO'}`);
    
    // TEST 4: Test Clear All
    console.log('\n\nTEST 4: Clear All Files');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const clearBtn = page.locator('button:has-text("Clear All")');
    const clearExists = await clearBtn.isVisible().catch(() => false);
    console.log(`✓ Clear All button visible: ${clearExists}`);
    
    if (clearExists) {
      await clearBtn.click();
      await page.waitForTimeout(1000);
      const clearedCount = await fileRows.count();
      console.log(`✓ Files after Clear All: ${clearedCount}`);
    }
    
    console.log('\n╔════════════════════════════════════════════╗');
    console.log('║          Test Sequence Complete           ║');
    console.log('╚════════════════════════════════════════════╝\n');
    
    await page.waitForTimeout(2000);
    
  } catch (error) {
    console.error('Test Error:', error.message);
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

runFullTest().catch(console.error);
