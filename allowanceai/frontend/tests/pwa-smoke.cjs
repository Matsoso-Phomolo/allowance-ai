const { chromium } = require('playwright');
(async () => {
 const browser = await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL || 'msedge'});
 const context = await browser.newContext(); const page = await context.newPage();
 await page.goto('http://127.0.0.1:4173/');
 await page.evaluate(() => navigator.serviceWorker.ready);
 await page.reload(); await page.getByRole('heading',{name:/Take control/}).waitFor();
 const manifest = await page.evaluate(async()=> (await fetch('/manifest.webmanifest')).json());
 if(manifest.start_url !== '/' || manifest.icons.length < 2) throw Error('Manifest');
 await context.setOffline(true); await page.reload(); await page.getByRole('heading',{name:/Take control/}).waitFor();
 console.log('PASS service worker registration, manifest launch and cached offline homepage');
 await context.setOffline(false); await page.goto('http://127.0.0.1:4173/help');await page.getByRole('heading',{name:'Help & support'}).waitFor();
 console.log('PASS production build direct route'); await browser.close();
})();
