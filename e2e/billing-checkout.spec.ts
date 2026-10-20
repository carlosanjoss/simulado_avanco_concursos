import { expect, test } from '@playwright/test'

const enabled = process.env.E2E_RUN_BILLING === '1'
  && Boolean(process.env.E2E_FREE_EMAIL && process.env.E2E_FREE_PASSWORD)

test.skip(!enabled, 'Defina E2E_RUN_BILLING=1, E2E_FREE_EMAIL e E2E_FREE_PASSWORD para testar a iniciação segura do checkout.')

test('usuário autenticado inicia checkout mensal uma única vez e chega ao estado pendente', async ({ page }) => {
  await page.goto('/sign-in')
  await page.getByLabel('E-mail').fill(process.env.E2E_FREE_EMAIL!)
  await page.getByLabel('Senha').fill(process.env.E2E_FREE_PASSWORD!)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForURL(/\/dashboard/)
  await page.goto('/dashboard/assinatura')

  await page.getByRole('button', { name: /Assinar mensal/ }).click()
  await expect(page.getByRole('dialog', { name: 'Confirme seu upgrade' })).toBeVisible()
  await expect(page.getByText(process.env.E2E_FREE_EMAIL!)).toBeVisible()

  const popupPromise = page.waitForEvent('popup')
  await page.getByRole('button', { name: 'Ir para pagamento seguro' }).click()
  const checkout = await popupPromise
  await checkout.waitForLoadState('domcontentloaded')

  await expect(checkout).toHaveURL(/avancoconcursos\.com\.br\/produtos\/avanco-simulados-pro-mensal/)
  await expect(page).toHaveURL(/\/dashboard\/assinatura\?payment=pending/)
  await expect(page.getByText('Aguardando confirmação do pagamento')).toBeVisible()
})
