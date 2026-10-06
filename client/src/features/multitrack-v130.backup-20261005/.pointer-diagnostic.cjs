const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: true,
  });

  try {
    const page = await browser.newPage({
      viewport: {
        width: 1536,
        height: 1024,
      },
    });

    await page.goto(
      'http://127.0.0.1:5194/.r3-v130-pointer-preview.html',
      {
        waitUntil: 'networkidle',
      },
    );

    await page.waitForSelector(
      '.r3-multitrack-v130 #arr .pcx .cx',
    );

    const data = await page.evaluate(() => {
      const button =
        document.querySelector(
          '.r3-multitrack-v130 #arr .pcx .cx',
        );

      const pcx =
        document.querySelector(
          '.r3-multitrack-v130 #arr .pcx',
        );

      const ph =
        document.querySelector(
          '.r3-multitrack-v130 #arr .ph',
        );

      if (!button || !pcx || !ph) {
        throw new Error(
          'panel pointer diagnostic nodes missing',
        );
      }

      const b = button.getBoundingClientRect();
      const p = pcx.getBoundingClientRect();
      const h = ph.getBoundingClientRect();

      const x =
        b.left + Math.max(1, b.width / 2);

      const y =
        b.top + Math.max(1, b.height / 2);

      const stack =
        document.elementsFromPoint(
          x,
          y,
        ).map((el) => ({
          tag: el.tagName,
          id: el.id,
          className:
            typeof el.className === 'string'
              ? el.className
              : '',
          pointerEvents:
            getComputedStyle(el).pointerEvents,
          position:
            getComputedStyle(el).position,
          zIndex:
            getComputedStyle(el).zIndex,
          opacity:
            getComputedStyle(el).opacity,
        }));

      return {
        button: {
          rect: {
            x: b.x,
            y: b.y,
            width: b.width,
            height: b.height,
          },
          pointerEvents:
            getComputedStyle(button).pointerEvents,
          position:
            getComputedStyle(button).position,
          zIndex:
            getComputedStyle(button).zIndex,
          opacity:
            getComputedStyle(button).opacity,
        },

        pcx: {
          rect: {
            x: p.x,
            y: p.y,
            width: p.width,
            height: p.height,
          },
          pointerEvents:
            getComputedStyle(pcx).pointerEvents,
          position:
            getComputedStyle(pcx).position,
          zIndex:
            getComputedStyle(pcx).zIndex,
          opacity:
            getComputedStyle(pcx).opacity,
          overflow:
            getComputedStyle(pcx).overflow,
        },

        header: {
          rect: {
            x: h.x,
            y: h.y,
            width: h.width,
            height: h.height,
          },
          pointerEvents:
            getComputedStyle(ph).pointerEvents,
          position:
            getComputedStyle(ph).position,
          zIndex:
            getComputedStyle(ph).zIndex,
        },

        point: { x, y },

        elementFromPoint:
          document.elementFromPoint(
            x,
            y,
          )?.outerHTML.slice(
            0,
            500,
          ),

        stack,
      };
    });

    console.log(
      JSON.stringify(
        data,
        null,
        2,
      ),
    );

    const top =
      data.stack[0];

    console.log(
      '\n=== RESULT ===',
    );

    if (
      top?.tag === 'BUTTON' &&
      top?.className.includes('cx')
    ) {
      console.log(
        'PASS: collapse button is topmost at its hit point',
      );
    } else {
      console.log(
        'FAIL: collapse button is not topmost',
      );
      process.exit(2);
    }
  } finally {
    await browser.close();
  }
})();
