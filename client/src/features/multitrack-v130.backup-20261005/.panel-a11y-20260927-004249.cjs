const { chromium } = require('playwright');

const port = 5194;

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
      `http://127.0.0.1:${port}/.r3-v130-panel-preview.html`,
      {
        waitUntil: 'networkidle',
      },
    );

    await page.waitForSelector(
      '.r3-multitrack-v130 #stage',
    );

    const before =
      await page.evaluate(() => ({
        pcx:
          document.querySelectorAll(
            '.r3-multitrack-v130 .pcx',
          ).length,

        pcxButtons:
          document.querySelectorAll(
            '.r3-multitrack-v130 .pcx button',
          ).length,

        options:
          document.querySelectorAll(
            '.r3-multitrack-v130 [role="option"]',
          ).length,

        menu:
          !!document.querySelector(
            '.r3-multitrack-v130 [role="menu"]',
          ),

        listbox:
          !!document.querySelector(
            '.r3-multitrack-v130 [role="listbox"]',
          ),
      }));

    console.log(
      `pcx=${before.pcx}`,
    );

    console.log(
      `pcxButtons=${before.pcxButtons}`,
    );

    console.log(
      `options=${before.options}`,
    );

    if (before.pcx !== 8) {
      throw new Error(
        `Expected 8 runtime panel-control bars; got ${before.pcx}`,
      );
    }

    if (before.pcxButtons !== 24) {
      throw new Error(
        `Expected 24 runtime panel buttons; got ${before.pcxButtons}`,
      );
    }

    if (before.options < 1) {
      throw new Error(
        'Expected at least one DSP role=option',
      );
    }

    if (!before.menu || !before.listbox) {
      throw new Error(
        'Reference accessibility containers missing',
      );
    }

    console.log(
      'PASS: dynamic accessibility nodes',
    );

    const initial =
      await page
        .locator(
          '.r3-multitrack-v130 #arr',
        )
        .getAttribute(
          'class',
        );

    if (!initial?.includes('pn')) {
      throw new Error(
        'Arrangement panel baseline class missing',
      );
    }

    await page.locator(
      '#arr .pcx .cx',
    ).click();

    await page.waitForTimeout(50);

    const collapsed =
      await page
        .locator(
          '.r3-multitrack-v130 #arr',
        )
        .getAttribute(
          'class',
        );

    if (!collapsed?.includes('collapsed')) {
      throw new Error(
        'Arrangement panel did not enter collapsed state',
      );
    }

    console.log(
      'PASS: collapse behavior',
    );

    const ariaExpanded =
      await page.locator(
        '#arr .pcx .cx',
      ).getAttribute(
        'aria-expanded',
      );

    if (ariaExpanded !== 'false') {
      throw new Error(
        `Expected aria-expanded=false, got ${ariaExpanded}`,
      );
    }

    console.log(
      'PASS: collapse accessibility state',
    );

    await page.locator(
      '#arr .pcx .cx',
    ).click();

    await page.waitForTimeout(50);

    const expanded =
      await page
        .locator(
          '.r3-multitrack-v130 #arr',
        )
        .getAttribute(
          'class',
        );

    if (
      expanded?.includes(
        'collapsed',
      )
    ) {
      throw new Error(
        'Arrangement panel did not expand',
      );
    }

    console.log(
      'PASS: expand behavior',
    );

    await page.locator(
      '#arr .pcx .mx',
    ).click();

    await page.waitForTimeout(50);

    const maximized =
      await page
        .locator(
          '.r3-multitrack-v130 #arr',
        )
        .getAttribute(
          'class',
        );

    if (!maximized?.includes('max')) {
      throw new Error(
        'Arrangement panel did not maximize',
      );
    }

    console.log(
      'PASS: maximize behavior',
    );

    await page.keyboard.press(
      'Escape',
    );

    await page.waitForTimeout(50);

    const restored =
      await page
        .locator(
          '.r3-multitrack-v130 #arr',
        )
        .getAttribute(
          'class',
        );

    if (restored?.includes('max')) {
      throw new Error(
        'Escape did not restore maximized panel',
      );
    }

    console.log(
      'PASS: Esc restore',
    );

    await page.locator(
      '#arr .pcx .d3b',
    ).click();

    await page.waitForTimeout(50);

    const d3 =
      await page
        .locator(
          '.r3-multitrack-v130 #arr',
        )
        .getAttribute(
          'class',
        );

    if (!d3?.includes('d3')) {
      throw new Error(
        '3D state did not activate',
      );
    }

    const d3Pressed =
      await page.locator(
        '#arr .pcx .d3b',
      ).getAttribute(
        'aria-pressed',
      );

    if (d3Pressed !== 'true') {
      throw new Error(
        '3D aria state did not activate',
      );
    }

    console.log(
      'PASS: 2D/3D behavior',
    );

    await page.keyboard.press(
      'Shift+D',
    );

    await page.waitForTimeout(50);

    const all3d =
      await page.evaluate(() =>
        [
          ...document.querySelectorAll(
            '.r3-multitrack-v130 .pn',
          ),
        ].every(
          (el) =>
            el.classList.contains('d3'),
        ),
      );

    if (!all3d) {
      throw new Error(
        'Shift+D did not enable 3D on every panel',
      );
    }

    console.log(
      'PASS: Shift+D all-panel 3D',
    );

    await page.keyboard.press(
      'Shift+C',
    );

    await page.waitForTimeout(50);

    const allCollapsed =
      await page.evaluate(() =>
        document
          .getElementById('empty')
          ?.hasAttribute('hidden') === false,
      );

    if (!allCollapsed) {
      throw new Error(
        'Shift+C did not produce all-collapsed state',
      );
    }

    console.log(
      'PASS: Shift+C collapse-all',
    );

    await page.keyboard.press(
      'Shift+E',
    );

    await page.waitForTimeout(50);

    const allExpanded =
      await page.evaluate(() =>
        document
          .getElementById('empty')
          ?.hasAttribute('hidden') === true,
      );

    if (!allExpanded) {
      throw new Error(
        'Shift+E did not expand all panels',
      );
    }

    console.log(
      'PASS: Shift+E expand-all',
    );

    console.log(
      '\nPASS: panel runtime parity smoke',
    );
  } finally {
    await browser.close();
  }
})();
