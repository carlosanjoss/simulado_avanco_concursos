import { LegalPage, LegalSection } from '@/components/legal/LegalPage'

const privacyEmail = process.env.NEXT_PUBLIC_PRIVACY_EMAIL || process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'contato a definir'

export default function PrivacyPage() {
  return <LegalPage title="Política de Privacidade" updatedAt="8 de outubro de 2026">
    <LegalSection title="1. Dados tratados"><p>Tratamos dados de cadastro, como nome e e-mail; dados de autenticação protegidos; registros de uso, simulados, respostas, desempenho, feedbacks e informações necessárias à assinatura. Não armazenamos números completos de cartão.</p></LegalSection>
    <LegalSection title="2. PDFs e conteúdo de estudo"><p>O PDF é processado para gerar o simulado. O arquivo original não é persistido como biblioteca. Em documentos extensos, texto extraído e vetores ficam temporariamente no Supabase, isolados por usuário, e são eliminados pelo processo automático de limpeza.</p></LegalSection>
    <LegalSection title="3. Finalidades"><p>Usamos os dados para autenticar contas, gerar e corrigir simulados, apresentar histórico, controlar limites, processar assinaturas, prevenir abuso, atender suporte e melhorar segurança e qualidade.</p></LegalSection>
    <LegalSection title="4. Operadores e compartilhamento"><p>Podemos utilizar Vercel para hospedagem, Supabase/PostgreSQL para dados, OpenRouter e provedores de modelos para geração, serviço de e-mail para mensagens transacionais, Sentry para diagnóstico e Nuvemshop/Nuvem Pago para compras e assinaturas. Cada operador recebe apenas os dados necessários à sua função.</p></LegalSection>
    <LegalSection title="5. Retenção e segurança"><p>Dados da conta permanecem enquanto ela estiver ativa ou enquanto forem necessários para obrigações legais e defesa de direitos. Tokens de acesso e documentos temporários possuem prazo reduzido. Aplicamos controle de acesso, hash de senhas, cookies protegidos, limitação de requisições, logs administrativos e criptografia em trânsito.</p></LegalSection>
    <LegalSection title="6. Direitos do titular"><p>O titular pode solicitar confirmação do tratamento, acesso, correção, informação, portabilidade quando aplicável e exclusão nos limites legais. O perfil permite exportar dados e iniciar a exclusão da conta.</p></LegalSection>
    <LegalSection title="7. Cookies"><p>Usamos cookie essencial de autenticação e preferências locais de interface. Não utilizamos cookies publicitários por padrão. Caso ferramentas não essenciais sejam adicionadas, esta política e o mecanismo de consentimento serão atualizados.</p></LegalSection>
    <LegalSection title="8. Contato"><p>Solicitações relacionadas à privacidade podem ser enviadas para: <strong>{privacyEmail}</strong>.</p></LegalSection>
  </LegalPage>
}
