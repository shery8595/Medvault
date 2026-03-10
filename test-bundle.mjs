import { readFile } from 'fs/promises';
import { JSDOM } from 'jsdom';

async function test() {
  const html = await readFile('./dist/index.html', 'utf-8');
  const jsMatch = html.match(/src="(\/assets\/index-[^"]+\.js)"/);
  const jsPath = `./dist${jsMatch[1]}`;
  
  const dom = new JSDOM('<!DOCTYPE html><html lang="en"><body><div id="root"></div></body></html>', {
    url: "http://localhost/",
    runScripts: "dangerously"
  });
  
  Object.assign(global, {
    window: dom.window,
    document: dom.window.document,
    MutationObserver: dom.window.MutationObserver,
    self: dom.window,
    localStorage: { getItem: () => null, setItem: () => {} }
  });

  Object.defineProperty(global, 'navigator', {
    value: dom.window.navigator,
    writable: true,
    configurable: true
  });
  
  process.on('unhandledRejection', (reason) => {
    console.error("@@@ CAUGHT REJECTION @@@");
    console.error(reason);
    if (reason && reason.stack) console.error(reason.stack);
    process.exit(1);
  });
  
  try {
    console.log("Importing bundle...");
    await import('./' + jsPath);
    console.log("Imported successfully, waiting...");
    await new Promise(r => setTimeout(r, 1000));
    console.log("No crashes detected! UI would mount now.");
  } catch (e) {
    console.error("@@@ CAUGHT ERROR @@@");
    console.error(e);
  }
}

test().catch(console.error);
