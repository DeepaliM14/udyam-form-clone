/**
 * scraper.js
 * - Puppeteer script to extract form inputs (step 1 & step 2) from
 *   https://udyamregistration.gov.in/UdyamRegistration.aspx
 * - Saves output to formSchema.json
 *
 * NOTE: This script only reads DOM attributes (label, name, id, type, pattern, required, options)
 * and DOES NOT attempt to submit the form or trigger OTP/PAN verification.
 */

const fs = require('fs');
const puppeteer = require('puppeteer');

async function extractFieldsFromPage(page) {
  await page.waitForSelector('form', { timeout: 8000 }).catch(() => {});
  return page.evaluate(() => {
    function getLabelFor(el) {
      if (!el) return '';
      const id = el.id;
      if (id) {
        const lab = document.querySelector(`label[for="${id}"]`);
        if (lab) return lab.innerText.trim();
      }
      const parentLabel = el.closest('label');
      if (parentLabel) return parentLabel.innerText.trim();
      const sib = el.previousElementSibling;
      if (sib && sib.tagName.toLowerCase() === 'label') return sib.innerText.trim();
      return el.placeholder?.trim() || '';
    }
    const nodes = Array.from(document.querySelectorAll('input, select, textarea, button'));
    return nodes.map(el => {
      const tag = el.tagName.toLowerCase();
      const type = el.type || (tag === 'select' ? 'select' : tag);
      const options = tag === 'select' ? Array.from(el.options || []).map(o => ({ value: o.value, label: o.text.trim() })) : null;
      return {
        tag,
        label: getLabelFor(el),
        name: el.name || null,
        id: el.id || null,
        type,
        placeholder: el.placeholder || null,
        required: el.required || false,
        pattern: el.getAttribute ? el.getAttribute('pattern') : null,
        options
      };
    }).filter(f => (f.name || f.id || f.label || f.tag === 'button'));
  });
}

(async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(0);
    await page.setCacheEnabled(false);

    console.log('Opening Udyam registration page...');
    await page.goto('https://udyamregistration.gov.in/UdyamRegistration.aspx', { waitUntil: 'networkidle0', timeout: 0 });

    await new Promise(r => setTimeout(r, 1500));

    //console.log('Opening dummy PAN form...');
    //await page.goto('file:///C:/Users/LENOVO/Desktop/dummyPanForm.html', { waitUntil: 'load' });

    console.log('Extracting Step 1 fields...');
    const step1 = await extractFieldsFromPage(page);
    console.log('Step 1 fields:', step1);

    fs.writeFileSync('formSchema_step1.json', JSON.stringify({ step1, url: page.url(), scrapedAt: new Date().toISOString() }, null, 2));
    console.log('Step 1 schema saved to formSchema_step1.json');

    // Now wait for manual interaction
    console.log('\nPlease complete Aadhaar + OTP validation manually in the browser.');
    console.log('Press any key here once Step 2 (PAN Validation) form is visible to scrape fields.');

    process.stdin.setRawMode(true);
    process.stdin.resume();

    // Attach event only once
    process.stdin.once('data', async () => {
      try {
        console.log('Extracting Step 2 fields...');
        const step2 = await extractFieldsFromPage(page);
        console.log('Step 2 fields:', step2);

        const combined = {
          url: page.url(),
          scrapedAt: new Date().toISOString(),
          step1,
          step2
        };

        fs.writeFileSync('formSchema_step1_and_2.json', JSON.stringify(combined, null, 2));
        console.log('Combined Step 1 & 2 schema saved to formSchema_step1_and_2.json');

      } catch (e) {
        console.error('Error extracting Step 2:', e);
      } finally {
        await browser.close();
        process.exit(0);
      }
    });

  } catch (err) {
    console.error('Error:', err);
    await browser.close();
    process.exit(1);
  }
})();