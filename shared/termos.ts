/**
 * Terms the client accepts on first access. DRAFT: the text below must be reviewed by
 * N1's legal team before going live. When the text changes, bump TERMS_VERSION so every
 * client is asked to accept the new version on their next visit.
 */
export const TERMS_VERSION = "2026-10-v1";

export const TERMS_TITLE = "Termos de uso do portal e tratamento de dados";

export const TERMS_SECTIONS: { title: string; text: string }[] = [
  {
    title: "1. Sobre o portal",
    text: "O portal da N1 Soluções permite que você acompanhe a situação do seu processo, receba avisos e converse com a nossa equipe. As informações exibidas têm caráter informativo e podem ser atualizadas a qualquer momento conforme o andamento do caso.",
  },
  {
    title: "2. Seu acesso",
    text: "O acesso é pessoal e intransferível. Você é responsável por manter sua senha em sigilo. Se suspeitar de uso indevido, troque a senha pela opção \"Esqueci minha senha\" e avise a equipe.",
  },
  {
    title: "3. Dados pessoais (LGPD)",
    text: "Tratamos seus dados (como nome, CPF, telefone, e-mail e informações do processo) para prestar o serviço contratado, nos termos da Lei nº 13.709/2018 (LGPD). Seus dados não são vendidos e só são compartilhados com terceiros quando necessário para a execução do serviço ou por obrigação legal. Você pode pedir acesso, correção ou exclusão dos seus dados falando com a equipe pelo próprio portal.",
  },
  {
    title: "4. Comunicações",
    text: "Ao aceitar, você concorda em receber mensagens sobre o seu processo pelo WhatsApp, por e-mail e pelo portal, como avisos de andamento, pedidos de documentos e lembretes. Você pode pedir para não receber mensagens pelo WhatsApp a qualquer momento.",
  },
  {
    title: "5. Atendimento",
    text: "O assistente virtual do portal responde dúvidas gerais com respostas pré-definidas e não substitui a orientação da equipe. Questões sobre valores, pagamentos ou estratégia do processo são tratadas diretamente com um atendente.",
  },
];
