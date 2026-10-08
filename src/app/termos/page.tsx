import { LegalPage, LegalSection } from '@/components/legal/LegalPage'

const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'suporte a definir'

export default function TermsPage() {
  return <LegalPage title="Termos de Uso" updatedAt="8 de outubro de 2026">
    <LegalSection title="1. Serviço"><p>O Avanço Simulados transforma materiais enviados pelo usuário em questões de estudo com auxílio de inteligência artificial. As questões, respostas e justificativas são recursos educacionais e podem conter imprecisões; não substituem professores, fontes oficiais ou orientação profissional.</p></LegalSection>
    <LegalSection title="2. Conta e segurança"><p>O usuário deve fornecer informações verdadeiras, proteger sua senha e comunicar acessos indevidos. Contas podem ser suspensas em caso de fraude, abuso, tentativa de violação de segurança ou descumprimento destes termos.</p></LegalSection>
    <LegalSection title="3. Materiais enviados"><p>O usuário declara possuir autorização para utilizar os materiais enviados. É proibido enviar conteúdo ilícito, malicioso, que viole direitos de terceiros ou contenha dados pessoais sem base adequada.</p><p>O PDF original não é mantido como biblioteca permanente. Texto e vetores podem ser armazenados temporariamente durante o processamento e eliminados automaticamente conforme a política de retenção.</p></LegalSection>
    <LegalSection title="4. Planos e cobrança"><p>Os recursos disponíveis dependem do plano contratado. Compras e renovações do plano Pro são processadas pela Nuvemshop/Nuvem Pago. Preço, periodicidade e condições aparecem antes da conclusão da compra.</p><p>Enquanto o cancelamento autônomo não estiver disponível no checkout da Nuvemshop, o pedido de cancelamento deverá ser enviado ao suporte. O acesso pago permanece válido até o fim do período já quitado, salvo disposição diferente apresentada no momento da compra.</p></LegalSection>
    <LegalSection title="5. Uso aceitável"><p>Não é permitido automatizar requisições abusivas, compartilhar acesso comercialmente, contornar limites, testar vulnerabilidades sem autorização ou usar o serviço para produzir fraude acadêmica, conteúdo ilegal ou dano a terceiros.</p></LegalSection>
    <LegalSection title="6. Disponibilidade e alterações"><p>Podemos realizar manutenção, corrigir falhas, substituir provedores e modificar funcionalidades. Alterações relevantes destes termos serão comunicadas e terão uma nova data de vigência.</p></LegalSection>
    <LegalSection title="7. Encerramento e dados"><p>O usuário pode exportar seus dados e solicitar a exclusão da conta pelo perfil. Uma assinatura ativa deve ser cancelada antes da exclusão definitiva para evitar cobranças posteriores e perda de acesso.</p></LegalSection>
    <LegalSection title="8. Contato"><p>Dúvidas, cancelamentos e solicitações podem ser encaminhados para: <strong>{supportEmail}</strong>.</p></LegalSection>
  </LegalPage>
}
