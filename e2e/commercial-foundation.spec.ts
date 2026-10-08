import { expect, test } from '@playwright/test'

test('landing apresenta proposta verificável e acesso aos preços', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /transforme seus pdfs/i })).toBeVisible()
  await expect(page.getByText('+2.000 estudantes')).toHaveCount(0)
  await page.getByRole('link', { name: 'Preços' }).first().click()
  await expect(page).toHaveURL(/\/precos$/)
  await expect(page.getByRole('heading', { name: /escolha como você quer avançar/i })).toBeVisible()
})

test('página de preços compara grátis e Pro', async ({ page }) => {
  await page.goto('/precos')
  await expect(page.getByRole('heading', { name: 'Grátis' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Pro' })).toBeVisible()
  await expect(page.getByText(/mesmo e-mail cadastrado/i)).toBeVisible()
})

test('documentos legais são públicos', async ({ page }) => {
  await page.goto('/termos')
  await expect(page.getByRole('heading', { name: 'Termos de Uso' })).toBeVisible()
  await page.goto('/privacidade')
  await expect(page.getByRole('heading', { name: 'Política de Privacidade' })).toBeVisible()
  await expect(page.getByText(/exportar dados/i)).toBeVisible()
})

test('recuperação de senha não revela se a conta existe', async ({ page }) => {
  await page.addInitScript(() => {
    const originalFetch = window.fetch.bind(window)
    window.fetch = (input, init) => String(input).includes('/api/auth/forgot-password')
      ? Promise.resolve(new Response(JSON.stringify({ success: true, message: 'Se a conta existir, enviaremos as instruções por e-mail.' }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      : originalFetch(input, init)
  })
  await page.goto('/esqueci-senha')
  await page.getByLabel('E-mail').fill('pessoa@example.com')
  await page.getByRole('button', { name: 'Enviar instruções' }).click()
  await expect(page.getByText(/se a conta existir/i)).toBeVisible()
})

test('área privada redireciona visitantes para o login', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/sign-in\?redirect=%2Fdashboard/)
})
