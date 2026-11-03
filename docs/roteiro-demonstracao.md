# Elo Connect — Roteiro da demonstração

Roteiro para apresentar o MVP aos professores e ao cliente, em cerca de 30 minutos. O que já funciona e o que espera pendências está em [Requisitos](requisitos.md), seção 9.

## Antes de começar

- Endereço: https://eloconnect.vercel.app. Os dados são todos fictícios, e a cobrança roda com o **banco simulado**: o boleto e o Pix existem só no sistema, e o PDF vem marcado "NÃO PAGUE". O convênio com o Sicredi ainda não existe (#40).
- Contas de teste, todas com a senha da `SEED_SENHA`, que só a equipe tem (nunca escrever a senha em slide, chat ou documento):

| Conta | Perfil | Farmácia |
| --- | --- | --- |
| `admin@example.com` | Sede, chave mestre | — |
| `sede@example.com` | Sede, básico | — |
| `associado@example.com` | Associado em dia | Farmácia Exemplo 01 |
| `inadimplente@example.com` | Associado com boleto vencido | Farmácia Exemplo 07 |

- Use uma janela normal para a sede e uma janela anônima para o associado, para trocar de conta sem sair.
- Na demonstração, os e-mails não saem: eles aparecem no log da função `eloconnect-api`, em Logs, na Vercel ([deploy.md](deploy.md)). Para mostrar os e-mails como o associado recebe, a apresentação local é mais clara: `pnpm dev` com o Mailpit em `http://localhost:8025`.
- Confira em Settings → Cron Jobs do `eloconnect-api` se o lote do mês já rodou. Ele sai no primeiro dia útil, por volta das 7h de Mato Grosso.
- Para a importação (passo 5.6), deixe pronto um CSV com duas farmácias fictícias, a partir da planilha modelo.

## 1. Visitante (2 min)

1. Abra a página inicial: o que o sindicato oferece, os benefícios cadastrados e os botões "Entrar" e "Criar conta".
2. Mostre o aviso para a farmácia que ainda não está no cadastro. O e-mail desse aviso depende da P19.
3. Em "Criar conta", explique que a farmácia informa o CNPJ e recebe o link no e-mail do cadastro (RF05).

## 2. Associado em dia: `associado@example.com` (5 min)

1. **Início:** a situação "Adimplente" e o quadro "Boleto mensal".
2. **Boletos:** o boleto do mês, se o lote já rodou, com o valor e o vencimento em destaque, o QR Code do Pix, os botões de copiar o Pix e a linha digitável, e o PDF.
3. **Histórico de pagamentos:** o boleto do mês passado, pago com Pix.
4. **Notícias** e **Convenções:** quem está em dia abre o PDF completo (RN12).

## 3. Associado com boleto vencido: `inadimplente@example.com` (3 min)

1. **Boletos:** o boleto vencido mostra até quando ainda dá para pagar (RN03).
2. **Convenções:** quem não está em dia abre só o PDF resumido.
3. Explique os lembretes: 2 dias antes do vencimento e uma vez por semana depois, até o boleto expirar (RN07). Sem pagamento, o bloqueio é automático 30 dias depois do vencimento (RN09).

## 4. Sede, perfil básico: `sede@example.com` (4 min)

1. **Notícias:** publique uma notícia com imagem e mostre no feed do associado, na outra janela.
2. **Convenções** e **Benefícios:** o básico também publica (RN33).
3. **Associados:** a lista e o perfil aparecem sem os botões de alterar. No perfil, baixe o histórico em PDF e em CSV (RF32).

## 5. Sede, chave mestre: `admin@example.com` (10 min)

1. **Pagamento:** no perfil da Farmácia Exemplo 07, clique em "Simular pagamento" no boleto vencido. O acesso dela volta na hora (RN10). Faça este passo depois do passo 3, porque ele muda a situação da conta `inadimplente@example.com`.
2. **Próximo boleto:** no perfil da Farmácia Exemplo 01, mude o valor do boleto do mês seguinte. O associado recebe um e-mail (RF11).
3. **Acesso manual:** a Farmácia Exemplo 05 está bloqueada pela sede. Libere por 7 dias e mostre o aviso (RN11).
4. **Interromper a cobrança:** na Farmácia Exemplo 03, interrompa com um motivo. O perfil mostra até quando vai o acesso: mais 30 dias (RN25). Para desfazer, edite o cadastro e marque "Recebe boleto mensal: sim".
5. **Valores:** o valor atual e o histórico. Alterar o valor manda e-mail a todos que recebem o boleto e vale a partir do mês seguinte (RN15).
6. **Importar planilha:** em Associados, baixe a planilha modelo e importe o CSV preparado. Envie o mesmo arquivo de novo para mostrar que nada se repete (RF42).
7. **Cobrança formal:** escreva um comunicado curto. A tela mostra quantos associados recebem e quantos e-mails saem por dia; o envio começa na próxima execução diária (RF29). Só um comunicado é enviado por vez.
8. **Histórico de ações:** filtre pelo dia de hoje e mostre que cada ação feita na demonstração está registrada, com o valor de antes e o novo (RF40).

## 6. Cancelamento (3 min)

1. Na janela do associado (`associado@example.com`), em Início, clique em "Cancelar o boleto mensal". A página mostra o que a farmácia perde. Clique em "Pedir o cancelamento".
2. Na janela da sede, o painel mostra o pedido esperando resposta. Abra o perfil da Farmácia Exemplo 01 e **recuse** o pedido, com uma observação. Recusar mantém os dados da demonstração como estavam.
3. Explique: a sede tem 15 dias para responder; sem resposta, o pedido é confirmado sozinho no dia seguinte, e o associado recebe um e-mail nos três casos (RN18).

## 7. O que roda sozinho (2 min)

Cinco tarefas rodam uma vez por dia, pelo cron da Vercel, a partir das 7h de Mato Grosso: o lote mensal, o bloqueio, os lembretes, a confirmação dos cancelamentos e a parte do dia da cobrança formal. Para mostrar meses de cobrança em poucos segundos, rode na máquina da equipe, com o Docker ligado, o teste do fluxo, que simula a adesão, o pagamento, o lote, os lembretes, o bloqueio, a interrupção e o cancelamento:

```bash
pnpm --filter api test:e2e -- fluxo-cobranca
```

## 8. Depois da demonstração

Para voltar aos dados iniciais, use o `db:reset` de [deploy.md](deploy.md). Ele **apaga todos os dados da demonstração** e roda o seed de novo.

## 9. O que levar para a conversa

### Com o cliente

- Convênio de cobrança e acesso à API do Sicredi (#40): sem eles, a cobrança continua em simulação.
- P02: arquivo da JUCEMAT (formato, frequência e envio).
- P04, P15 e P23: plano anual, assessoria jurídica antecipada e valor atual da contribuição.
- P05: o que é se inscrever numa convenção.
- P06: lista completa de benefícios.
- P08: comunicar a forma de criação de conta escolhida.
- P10: regras que faltam do boleto avulso.
- P12: quanto o sindicato pode gastar por mês com hospedagem e e-mail.
- P13: o que muda com a inativação de um associado.
- P14: matriz e filiais.
- P16: vencimento do boleto gerado na adesão.
- P19: e-mail dos pedidos de cadastro e endereço de envio dos e-mails.
- P21: texto do termo de adesão.
- P24: documentos da convenção e tabela de reajuste.
- P25: acesso e boleto do mês depois do cancelamento, e quem recebe o aviso do pedido.
- P26: texto da cobrança formal.
- P27: se quem já paga, importado pela planilha, começa em dia.

### Com os professores

- P07: cuidados de LGPD com os dados cadastrais e financeiros e com o provedor de e-mail.
- P11 e P22: como registrar o compartilhamento do acesso com o contador e se o grupo pode indicar um modelo de termo de adesão.
- IoT: a exigência do curso ainda não entrou no escopo do MVP.
- Acessibilidade: a revisão com ferramentas e leitor de tela (#58) ainda não foi feita.
