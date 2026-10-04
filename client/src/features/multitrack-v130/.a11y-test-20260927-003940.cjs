const { chromium } = require('playwright');

const stamp = process.env.R3_V130_STAMP;

if (!stamp) {
  throw new Error(
    'R3_V130_STAMP environment variable missing',
  );
}

const url =
  `http://127.0.0.1:5193/.r3-v130-a11y-preview-${stamp}.html`;

(async () => {
  const browser =
    await chromium.launch({
      headless: true,
    });

  try {
    const page =
      await browser.newPage({
        viewport: {
          width: 1536,
          height: 1024,
        },
      });

    await page.goto(
      url,
      {
        waitUntil: 'networkidle',
      },
    );

    await page.waitForSelector(
      '.r3-multitrack-v130 #stage',
    );

    const result =
      await page.evaluate(() => {
        const checks = {
          documentLang:
            document.documentElement.lang ===
            'en',

          menu:
            !!document.querySelector(
              '[role="menu"]',
            ),

          listbox:
            !!document.querySelector(
              '[role="listbox"]',
            ),

          option:
            !!document.querySelector(
              '[role="option"]',
            ),

          status:
            !!document.querySelector(
              '[role="status"]',
            ),

          transportGroup:
            !!document.querySelector(
              '[role="group"][aria-label="Transport"]',
            ),

          play:
            !!document.querySelector(
              '[aria-label="Play"]',
            ),

          stop:
            !!document.querySelector(
              '[aria-label="Stop"]',
            ),

          rewind:
            !!document.querySelector(
              '[aria-label="Rewind"]',
            ),

          fastForward:
            !!document.querySelector(
              '[aria-label="Fast forward"]',
            ),

          record:
            !!document.querySelector(
              '[aria-label="Record"]',
            ),

          settings:
            !!document.querySelector(
              '[aria-label="Settings"]',
            ),

          timeline:
            !!document.querySelector(
              '[aria-label="Arrangement timeline"]',
            ),

          piano:
            !!document.querySelector(
              '[aria-label="Two-octave keyboard"]',
            ),

          panels:
            !!document.querySelector(
              '[aria-label="Panels"]',
            ),

          tempo:
            !!document.querySelector(
              '[aria-label="Tempo in BPM"]',
            ),

          signalRouting:
            !!document.querySelector(
              '[aria-label="Signal routing"]',
            ),

          requiredPanelButtons:
            document.querySelectorAll(
              '.r3-multitrack-v130 .pcx button',
            ).length >= 9,

          ariaExpanded:
            document.querySelectorAll(
              '.r3-multitrack-v130 [aria-expanded]',
            ).length > 0,

          ariaPressed:
            document.querySelectorAll(
              '.r3-multitrack-v130 [aria-pressed]',
            ).length > 0,
        };

        return {
          checks,
          aria:
            [...document.querySelectorAll(
              '.r3-multitrack-v130 [aria-label]',
            )].map(
              (el) =>
                el.getAttribute(
                  'aria-label',
                ),
            ),
        };
      });

    for (const [
      name,
      passed,
    ] of Object.entries(
      result.checks,
    )) {
      console.log(
        `${passed ? 'PASS' : 'FAIL'}: ${name}`,
      );
    }

    if (
      Object.values(
        result.checks,
      ).some(
        (value) => !value,
      )
    ) {
      console.error(
        '\nARIA labels observed:',
      );

      for (const label of result.aria) {
        console.error(`  ${label}`);
      }

      process.exit(1);
    }

    console.log(
      '\nPASS: v1.3 accessibility structure',
    );
  } finally {
    await browser.close();
  }
})();
