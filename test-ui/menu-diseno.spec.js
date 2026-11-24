const { test, expect } = require('@playwright/test');
const { sinRedExterna } = require('./ayudas');

// Cómo se ve la pantalla de inicio en cada tamaño: el título grande, el logo separado de las cartas, sin hueco muerto abajo y Créditos arriba.
const PANTALLAS = [
  ['escritorio 1280×720', { width: 1280, height: 720 }, { titulo: 68, carta: 120, logo: 44, cabe: true, apilado: false }],
  ['escritorio 1280×800', { width: 1280, height: 800 }, { titulo: 78, carta: 140, logo: 44, cabe: true, apilado: false }],
  ['escritorio 1920×1080', { width: 1920, height: 1080 }, { titulo: 105, carta: 190, logo: 60, cabe: true, apilado: false }],
  ['iPhone en horizontal 844×390', { width: 844, height: 390 }, { titulo: 34, carta: 60, logo: 34, cabe: true, apilado: true }],
  ['iPhone pequeño en horizontal 667×375', { width: 667, height: 375 }, { titulo: 32, carta: 54, logo: 34, cabe: true, apilado: true }],
  ['iPhone en vertical 390×797', { width: 390, height: 797 }, { titulo: 40, carta: 0, logo: 34, cabe: false, apilado: true }]
];

for (const [nombre, viewport, esperado] of PANTALLAS) {
  test.describe(nombre, () => {
    test.use({ viewport });
    test.beforeEach(async ({ page }) => { await sinRedExterna(page); await page.goto('/'); await expect(page.locator('#vMenu')).toBeVisible(); });

    test('título grande, logo separado de las cartas y sin hueco muerto abajo', async ({ page }) => {
      const d = await page.evaluate(() => {
        const r = s => document.querySelector(s).getBoundingClientRect();
        const cartas = [...document.querySelectorAll('#vMenu .fan .fc')].map(c => c.getBoundingClientRect().top);
        return { titulo: parseFloat(getComputedStyle(document.querySelector('#vMenu h1')).fontSize), huecoLogoCartas: Math.min(...cartas) - r('#marca').bottom,
                 huecoAbajo: innerHeight - r('#vMenu .modos').bottom, alto: document.documentElement.scrollHeight - innerHeight,
                 carta: document.querySelector('#vMenu .fan .fc').offsetWidth, logo: r('.top .logo').height,
                 abanicoSobreTitulo: r('#vMenu .fan').bottom <= r('#vMenu h1').top + 6, tituloSobreModos: r('#vMenu h1').bottom <= r('#vMenu .modos').top };
      });
      expect(d.carta, 'tamaño de las cartas del abanico').toBeGreaterThanOrEqual(esperado.carta);
      expect(d.logo, 'tamaño del CC de arriba').toBeGreaterThanOrEqual(esperado.logo);
      expect(d.abanicoSobreTitulo, 'abanico arriba y título debajo (el formato de siempre)').toBe(true);
      expect(d.tituloSobreModos).toBe(true);
      expect(d.titulo, 'tamaño del título').toBeGreaterThanOrEqual(esperado.titulo);
      expect(d.huecoLogoCartas, 'el logo no toca las cartas').toBeGreaterThanOrEqual(10);
      if (esperado.cabe) {
        expect(d.alto, 'todo cabe sin bajar').toBeLessThanOrEqual(1);
        expect(d.huecoAbajo, 'sin hueco muerto debajo de las tarjetas').toBeLessThan(140);
      }
    });

    test('Créditos está arriba a la derecha (un toque desde el inicio) y ya no hay pie de página', async ({ page }) => {
      expect(await page.locator('footer.foot').count()).toBe(0);
      const cred = page.locator('.top #credBtn');
      await expect(cred).toBeVisible();
      const caja = await cred.evaluate(e => { const r = e.getBoundingClientRect(), t = document.querySelector('.top').getBoundingClientRect(); return { derecha: t.right - r.right, arriba: r.top - t.top }; });
      expect(caja.derecha, 'pegado al borde derecho de la barra').toBeLessThan(4);
      expect(caja.arriba).toBeLessThan(30);
      await cred.click();
      await expect(page.locator('#cred')).toHaveAttribute('open', '');
      await page.keyboard.press('Escape');
      await expect(page.locator('#cred')).not.toHaveAttribute('open', '');
    });

    test('Créditos solo se ve en el inicio: en las demás pantallas sale «Menú principal»', async ({ page }) => {
      await page.click('.modo[data-modo="rapida"]');
      await expect(page.locator('#credBtn')).toBeHidden();
      await expect(page.locator('#btnMenu')).toBeVisible();
      await page.click('#btnMenu');
      await expect(page.locator('#credBtn')).toBeVisible();
      await expect(page.locator('#btnMenu')).toBeHidden();
    });
  });
}
