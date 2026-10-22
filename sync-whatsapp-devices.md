# Sincronização de Mensagens Externas do WhatsApp (Outros Dispositivos)

> **Status**: Pronto para aprovação / implementação  
> **Comando**: `/plan atualmente as mensagens enviadas de outros dispositivos não aparecem nas conversas`

---

## 1. Visão Geral do Problema

Quando um atendente envia mensagens diretamente pelo aplicativo do celular ou pelo WhatsApp Web, a Evolution Go recebe o evento `Message` com a flag `IsFromMe: true`. No código atual ([`src/app/api/webhooks/evolution/route.ts`](file:///Users/danilosantos/Documents/Workspace/agente-atendimento/src/app/api/webhooks/evolution/route.ts#L25-L28)), essas mensagens são ignoradas imediatamente, fazendo com que o painel admin fique desatualizado em relação às respostas enviadas pelo celular.

---

## 2. É Possível Capturar?

**Sim!** O protocolo WhatsApp Multi-Device sincroniza nativamente todas as mensagens de saída de todos os aparelhos pareados. A Evolution Go entrega essas mensagens com `fromMe: true`.

---

## 3. Desafio e Solução: Deduplicação

Para evitar que mensagens enviadas pelo **Bot** ou pelo **Painel Admin** sejam salvas duas vezes no banco:

1. **Quando o Bot / Painel envia via API**:
   - Ao chamar `sendText`, salvamos o ID retornado pelo WhatsApp (`key.id`) no Redis com TTL de 120s (`SET sent_msg:<id> 1 EX 120`).
2. **Quando o Webhook recebe `fromMe: true`**:
   - Se o ID estiver no Redis: ignora (é eco da própria API).
   - Se o ID NÃO estiver no Redis: é uma mensagem digitada no celular / WhatsApp Web!
     - Salva no banco com `sender: "HUMAN"`.
     - Atualiza o cliente para `isHumanAttending: true` (pausando o bot).
     - Publica no Redis para atualizar a tela do atendente em tempo real via WebSocket.

---

## 4. Tarefas de Implementação

| Tarefa | Arquivo | Descrição |
|--------|---------|-----------|
| 1 | `src/lib/services/evolution-go.ts` | Guardar `body.key.id` no Redis (`sent_msg:<id>`) em `sendText` |
| 2 | `src/app/api/webhooks/evolution/route.ts` | Processar `fromMe: true` quando não estiver no Redis, salvando como `HUMAN` e atualizando `isHumanAttending` |
| 3 | `test/evolution-webhook-outgoing.test.ts` | Testes de unidade cobrindo mensagens externas vs. deduplicação de mensagens da API |

---

## 5. Próximos Passos
- Revisar o plano e confirmar se ao enviar mensagem pelo celular o cliente deve assumir automaticamente `isHumanAttending: true`.
- Executar `/create` ou autorizar para iniciar a implementação.
