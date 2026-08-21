import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const FIXTURES = '/Users/mac/Downloads/CAM LABS Project { 3D Printing Website }/test-fixtures';

async function runTest() {
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║  CAM LABS UPLOAD - LIVE BROWSER TEST      ║');
  console.log('╚════════════════════════════════════════════╝\n');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.contexts()[0];
  const pages = context.pages();
  const page = pages.length > 0 ? pages[0] : await context.newPage();
  
  try {
    console.log('📄 Navigating to CAM LABS...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30000 });
    
    console.log('✓ Page loaded');
    
    // Wait for upload zone
    const uploadZone = page.locator('[aria-label="Upload files"]');
    await uploadZone.waitFor({ timeout: 10000 }).catch(() => console.log('⚠ Upload zone timeout'));
    console.log('✓ Upload zone ready\n');
    
    const fileInput = page.locator('input[type="file"]');
    
    // TEST 1: Single file upload
    console.log('🧪 TEST 1: Single STL File Upload');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const file1 = path.join(FIXTURES, 'tetrahedron.stl');
    await fileInput.setInputFiles(file1);
    console.log('✓ File selected: tetrahedron.stl\n');
    
    // Monitor upload
    let stateReached = { uploading: false, analyzing: false, ready: false };
    for (let i = 0; i < 50; i++) {
      await page.waitForTimeout(250);
      
      const articles = page.locator('article');
      const count = await articles.count().catch(() => 0);
      
      if (count > 0) {
        const article = articles.first();
        const statusElements = article.locator('text=/Ready|Uploading|Analyzing|Failed|Unsupported/i');
        const statusText = await statusElements.first().textContent().catch(() => '');
        
        if (statusText.includes('Uploading')) stateReached.uploading = true;
        if (statusText.includes('Analyzing')) stateReached.analyzing = true;
        if (statusText.includes('Ready')) stateReached.ready = true;
        
        if (i % 8 === 0) {
          console.log(`[${i}s] Status: ${statusText.substring(0, 25).trim()}`);
        }
        
        if (stateReached.ready) break;
      }
    }
    
    console.log(`✓ States reached: Uploading=${stateReached.uploading}, Analyzing=${stateReached.analyzing}, Ready=${stateReached.ready}`);
    console.log(`${stateReached.ready ? '✅ PASS' : '❌ FAIL'}: Single file upload\n`);
    
    // TEST 2: Add multiple files
    console.log('🧪 TEST 2: Multiple Files (Different Formats)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const formats = [
      { file: 'tetrahedron.obj', label: 'OBJ' },
      { file: 'occt-screw.stp', label: 'STP' },
      { file: 'rectangle-mm.dxf', label: 'DXF' }
    ];
    
    for (const fmt of formats) {
      const filePath = path.join(FIXTURES, fmt.file);
      await fileInput.setInputFiles(filePath);
      console.log(`✓ Added: ${fmt.label} (${fmt.file})`);
      await page.waitForTimeout(500);
    }
    
    // Wait for processing
    await page.waitForTimeout(3000);
    
    const articles = page.locator('article');
    const finalCount = await articles.count().catch(() => 0);
    console.log(`✓ Total files uploaded: ${finalCount}\n`);
    
    // List all files and their states
    for (let i = 0; i < finalCount; i++) {
      const row = articles.nth(i);
      const name = await row.locator('strong').first().textContent().catch(() => 'Unknown');
      const statusEl = row.locator('text=/Ready|Uploading|Analyzing|Failed|Unsupported/i').first();
      const status = await statusEl.textContent().catch(() => 'Unknown');
      console.log(`  [${i+1}] ${name?.padEnd(25)} → ${status?.trim().substring(0, 20)}`);
    }
    
    console.log(`${finalCount >= 4 ? '✅ PASS' : '❌ FAIL'}: Multiple file upload\n`);
    
    // TEST 3: File removal
    console.log('🧪 TEST 3: Remove Individual File');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const countBefore = await articles.count().catch(() => 0);
    console.log(`Before: ${countBefore} files`);
    
    const removeBtn = articles.first().locator('button[aria-label*="Remove"], button:has-text("Remove")').first();
    const hasBtnbefore = await removeBtn.isVisible().catch(() => false);
    
    if (hasBtnbefore) {
      await removeBtn.click().catch(() => {});
      await page.waitForTimeout(500);
    }
    
    const countAfter = await articles.count().catch(() => 0);
    console.log(`After: ${countAfter} files`);
    console.log(`${countBefore > countAfter ? '✅ PASS' : '❌ FAIL'}: Individual file removal\n`);
    
    // TEST 4: Clear All
    console.log('🧪 TEST 4: Clear All Files');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const clearBtn = page.locator('button:has-text("Clear All"), button[aria-label*="Clear"]');
    const hasClearBtn = await clearBtn.count().catch(() => 0) > 0;
    console.log(`Clear All button visible: ${hasClearBtn}`);
    
    if (hasClearBtn) {
      await clearBtn.click();
      await page.waitForTimeout(1000);
    }
    
    const finalClearedCount = await articles.count().catch(() => 0);
    console.log(`Files after Clear All: ${finalClearedCount}`);
    console.log(`${finalClearedCount === 0 ? '✅ PASS' : '❌ FAIL'}: Clear All\n`);
    
    console.log('╔════════════════════════════════════════════╗');
    console.log('║         TEST SEQUENCE COMPLETED          ║');
    console.log('║  Keeping browser open for manual review   ║');
    console.log('╚════════════════════════════════════════════╝\n');
    
    // Keep open for manual review
    await page.waitForTimeout(30000);
    
  } catch (error) {
    console.error('Test Error:', error.message);
  } finally {
    await browser.close().catch(() => {});
  }
}

runTest().catch(console.error);
