// Envia UM e-mail de teste pelo Resend para o endereco informado (e so para ele).
// Uso: npm run email:teste -- destino@exemplo.com
import "dotenv/config";

const destino = process.argv[2];
if (!destino || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destino)) {
  console.error("Uso: npm run email:teste -- destino@exemplo.com");
  process.exit(1);
}

try {
  const { createResendSenderFromEnv } = await import("../dist/email.js");
  const email = createResendSenderFromEnv();
  if (!email.enabled) {
    console.error("RESEND_API_KEY ou EMAIL_REMETENTE ausentes no .env.");
    process.exit(1);
  }
  const r = await email.send({
    to: [destino],
    subject: "[IAZAN Sync] E-mail de teste",
    text: `Este e um e-mail de teste do robo de boletos (Conta Azul → Questor Zen).\n\nSe voce recebeu, o envio de alertas e do resumo diario esta funcionando.\n\nEnviado em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}.`,
  });
  console.log(r.ok ? `Enviado para ${destino} (id ${r.id}).` : `Falhou: ${r.error}`);
  process.exitCode = r.ok ? 0 : 1;
} catch (error) {
  console.error(`Falha: ${error?.message ?? "erro desconhecido"}`);
  process.exitCode = 1;
}
