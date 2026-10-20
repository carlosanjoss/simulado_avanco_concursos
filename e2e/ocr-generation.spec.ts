import { expect, test } from '@playwright/test'
import { createCanvas } from '@napi-rs/canvas'
import { PDFDocument, degrees } from 'pdf-lib'
import { writeFile } from 'node:fs/promises'

const enabled = process.env.E2E_RUN_OCR === '1' && Boolean(process.env.E2E_PRO_EMAIL && process.env.E2E_PRO_PASSWORD)

test.skip(!enabled, 'Defina E2E_RUN_OCR=1, E2E_PRO_EMAIL e E2E_PRO_PASSWORD para executar o fluxo OCR que usa serviços reais.')
test('upload OCR Pro cria um simulado e atravessa páginas inclinadas, degradadas e em duas colunas', async ({ page }, testInfo) => {
  test.setTimeout(8 * 60_000)
  const pdfPath = testInfo.outputPath('ocr-scanned-fixture.pdf')
  await writeFile(pdfPath, await createScannedFixture())

  await page.goto('/sign-in')
  await page.getByLabel('E-mail').fill(process.env.E2E_PRO_EMAIL!)
  await page.getByLabel('Senha').fill(process.env.E2E_PRO_PASSWORD!)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForURL(/\/dashboard/)
  await page.goto('/dashboard/novo')
  await page.getByLabel('Selecionar arquivo PDF').setInputFiles(pdfPath)
  await expect(page.getByText('Configuração de OCR Pro')).toBeVisible()
  await page.getByRole('button', { name: 'Gerar Simulado' }).click()
  await expect(page.getByText(/confiança OCR|Aplicando OCR/i)).toBeVisible({ timeout: 120_000 })
  await page.waitForURL(/\/dashboard\/simulado\//, { timeout: 7 * 60_000 })
  await expect(page.getByText(/Questão 1/i).first()).toBeVisible()
})

async function createScannedFixture(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const samples = [
    { title: 'Página digitalizada', columns: false, degraded: false, rotation: 0 },
    { title: 'Página inclinada', columns: false, degraded: false, rotation: 2.5 },
    { title: 'Página borrada', columns: false, degraded: true, rotation: 0 },
    { title: 'Página em duas colunas', columns: true, degraded: false, rotation: 0 },
  ]
  for (const sample of samples) {
    const canvas = createCanvas(sample.degraded ? 620 : 1240, sample.degraded ? 877 : 1754)
    const context = canvas.getContext('2d'); context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); context.fillStyle = '#111'
    const scale = sample.degraded ? 0.5 : 1; context.font = `${32 * scale}px Arial`; context.fillText(sample.title, 70 * scale, 90 * scale)
    context.font = `${22 * scale}px Arial`
    const paragraph = 'A administração pública deve observar legalidade, impessoalidade, moralidade, publicidade e eficiência. Estes princípios orientam atos, decisões e controles administrativos.'
    const xPositions = sample.columns ? [70, 650] : [70]
    for (const x of xPositions) for (let line = 0; line < 18; line += 1) context.fillText(`${line + 1}. ${paragraph.slice(0, sample.columns ? 66 : 125)}`, x * scale, (150 + line * 72) * scale)
    const image = await pdf.embedPng(canvas.toBuffer('image/png'))
    const target = pdf.addPage([595, 842]); target.drawImage(image, { x: sample.rotation ? -8 : 0, y: sample.rotation ? -5 : 0, width: 595, height: 842, rotate: degrees(sample.rotation) })
  }
  return pdf.save()
}
