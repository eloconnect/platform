# Elo Connect — Registro da Entrevista com o Cliente

Sindicato patronal de farmácias e drogarias de Mato Grosso. Baseado nas anotações da entrevista, nas respostas complementares do cliente, no questionário de 14/10/2026 (seção 8) e na conversa por vídeo de 28/10/2026 (seção 9). Última atualização: 28/10/2026.

> Este documento é o registro do que foi dito na entrevista. Requisitos formais e regras de negócio estão em [Requisitos](requisitos.md); o backlog está no GitHub Projects da organização.

## 1. Perfil da entidade

- Sindicato patronal, integra farmácias e drogarias do estado de Mato Grosso.

- **Associado**: todo o universo do setor no estado (~2.000 farmácias e drogarias), identificado pelo CNAE.

- Cerca de 150 associados assinaram contrato e pagam mensalmente.

- O cliente não quer diferenciar "associado" e "afiliado". Pediu que a separação seja feita por **adimplente** e **inadimplente**.


- Estrutura: 1 sede, equipe de 3 pessoas.

## 2. O que o sindicato faz hoje

- Firma convenções coletivas de trabalho (relacionadas aos empregados das farmácias), no meio de cada ano.

- Oferece orientação, esclarecimento e defesa jurídica aos associados em dia.

- Atua junto a órgãos de fiscalização.

- Divulga convenções coletivas e orientações por WhatsApp, e-mail ou telefone **restrito a quem está em dia com a contribuição**.

- Todo ano, resume os documentos de convenção coletiva (40+ páginas) e ajuda com coisas como correção de salário de funcionários, entre outros.

- Publica links/orientações sobre convenção coletiva; contadores dos associados também têm acesso a esse material.

- Atua em demandas jurídicas e ações trabalhistas relacionadas ao setor.

- Quando um associado quer sair, envia informações sobre os serviços prestados para tentar mantê-lo.

- É obrigado a enviar uma cobrança formal a todas as farmácias do estado, avisando que o sindicato existe, o valor e os benefícios. As farmácias não são obrigadas a pagar.

## 3. Como funciona hoje (processos manuais)

- O boleto é emitido manualmente quando o associado pede. Pagamento até o dia 10.

- Comunicação (atualização salarial, direitos e deveres) é feita manualmente por WhatsApp — com pico em julho/agosto (período da convenção coletiva).

- Todo atendimento inicial é respondido manualmente, um a um.

- O envio de e-mails com boletos e informações das convenções também é manual.

- O cadastro das farmácias existe numa base de dados, mas precisa ser atualizado. Fontes:

  - **JUCEMAT** — Junta Comercial do Estado de Mato Grosso, fornece dados em XML.

  - **CNAE Fiscal** — Classificação Nacional de Atividades Econômicas, identifica as empresas vinculadas ao sindicato.

- O sistema anterior coletava dados através desses canais.

- Não existe juros nem multa por inadimplência; o inadimplente perde o acesso aos benefícios.

- Não há contribuição sindical obrigatória a receita vem da contribuição dos ~150 associados pagantes.

- A Federação de Comércio (entidade relacionada) também está sem sistema no momento.

- Gateway de pagamento preferido: **Sicredi** (já têm conta).

## 4. Perfil dos usuários

- **Administrativo**: as 3 pessoas da sede. Um funcionário da sede é responsável por atualizar o conteúdo.

- **Associados**: donos de farmácia, majoritariamente de **terceira idade** pediram explicitamente que a solução seja **simples e fácil de usar** (fontes maiores, poucos passos por tela, linguagem direta).

- Reação positiva à ideia de **chatbot de WhatsApp**, mas confirmado como **fora do MVP**.

## 5. Dores identificadas

- Todo o processo de cobrança/pagamento é manual.

- A divulgação de informação (mudança salarial, novas leis, convenção coletiva) depende de WhatsApp manual trabalhoso, principalmente em julho/agosto.

- Atendimento inicial e envio de e-mails com boletos/informações são feitos um por um.

- Base de dados das farmácias desatualizada e dependente de fonte externa (JUCEMAT/CNAE).

- Não têm sistema próprio.

## 6. O que eles pediram

Ênfase principal:

- **Emissão de boleto** (e Pix) para a contribuição dos associados.

- **Agregação das informações das convenções coletivas** mudanças salariais e leis novas num lugar só.

Detalhes coletados na entrevista e nas respostas complementares:

- Aprovação mensal do lote de boletos por alguém da sede antes do envio, com edição e envio por um único botão, só para pagantes.

- Lembretes 48h antes do vencimento e a cada 48h após.

- Validade do boleto de 30 dias; vencimento fixo.

- Bloqueio imediato de benefícios após o vencimento, desbloqueio automático após o pagamento, mais painel de controle manual.

- Valor igual para todos, painel de edição de valor (só admin, com histórico), plano anual à vista com 20% de desconto, reajuste a cada 5 anos para todos, aviso por e-mail antes do próximo boleto.

- Login com e-mail e senha; confirmação de 5 dígitos aleatórios do CNPJ para garantir que é o representante (no sistema, trocada pelo CNPJ na criação da conta, com link enviado ao e-mail do cadastro — ver seção 8 e Requisitos, RN21).

- Histórico de todas as transações (data/hora, identificador do boleto), usado em caso de divergência.

- Perfil de cada associado rastreável pela sede.

- O app precisa mostrar o que o sindicato oferece (landing page junto do login/cadastro).

- Benefícios e convenção coletiva como módulos distintos. O inadimplente vê informações da convenção, mas não se inscreve.

- Solicitação de cancelamento pelo app, mostrando o que será perdido, com validação pela sede.

- O associado deve conseguir pedir pelo app que os boletos sejam enviados todo mês (cobrança recorrente). Se preferir, pode pagar apenas um mês.

- Se quiser cancelar a cobrança recorrente, o cancelamento é aprovado por alguém da sede.

- A sede deve conseguir interromper a cobrança recorrente de um associado.

- Tudo o que os usuários da sede fizerem deve ficar registrado, para manter a integridade.

- Diretriz reforçada pelo grupo: a solução deve automatizar processos, não criar novos processos manuais.

- Junto com o MVP, os associados devem ver as notícias num ponto único (feed de notícias), tanto adimplentes quanto inadimplentes. Visitantes não acessam.

- Cobrança formal para todo o universo por e-mail, sem boleto, usando a base do CNAE.

Menor ênfase:

- Vincular informações do setor dentro do app.

## 7. Pontos a esclarecer

### Resolvidos

- **Acesso dos contadores às informações de convenção** (09/10/2026): os contadores não terão login próprio nem link/PDF compartilhado. Eles entram com o e-mail e a senha da conta do associado; se o dono da farmácia não quiser consultar pessoalmente, ele compartilha o próprio acesso com o contador, sob sua responsabilidade (ver Requisitos, RN29).

- **Dados cadastrais obrigatórios para o termo de parceria** (09/10/2026): coletados à parte, e o contrato entre a faculdade e o cliente já foi firmado. Esses dados e o contrato não ficam no repositório nem nestes documentos.

- **Criação de conta e primeiro boleto** (27/10/2026): respostas 1 a 3 e 18 do questionário (seção 8).

- **Lista dos associados que já pagam** (27/10/2026): não existe (resposta 42).

- **Validade do boleto, bloqueio e lembretes** (27 e 28/10/2026): respostas 10, 13 e 15 (seção 8).

- **Liberação manual, e-mail da conta e contador** (28/10/2026): respostas 5, 6 e 11 (seção 8).

- **Revisão do lote mensal e aviso de mudança de valor** (28/10/2026): conversa por vídeo (seção 9).

### Em aberto

- Formato, frequência e forma de recebimento do arquivo da JUCEMAT (o arquivo traz o e-mail).

- O que falta das regras do boleto avulso: vencimento do pedido feito depois do dia 10 e período de acesso de quem paga só um mês (Requisitos, P10).

- Texto do termo de adesão, que os advogados do sindicato vão escrever (resposta 19).

- Plano anual: fica fora do lote mensal? Renovação?

- O que significa "se registrar em uma convenção".

- Lista completa de benefícios (os dois grupos já foram definidos).

- Matriz e filiais, regra de início da assessoria jurídica, vencimento do primeiro boleto e e-mail para pedidos de cadastro (Requisitos, P14 a P16 e P19).

## 8. Respostas ao questionário de 14/10/2026 (recebidas em 27 e 28/10/2026)

O grupo enviou ao sindicato um questionário com 48 perguntas. O sindicato respondeu em partes: as 17 marcadas como importantes em 27/10 e mais 10 em 28/10. O documento respondido fica fora do repositório, que é público. O que cada resposta mudou nos requisitos está em [Requisitos](requisitos.md) (O1, RN21, RN30 a RN34 e as pendências).

| **Pergunta** | **Tema** | **Resposta (resumo)** |
| --- | --- | --- |
| 1 | Quem pode criar conta | O cadastro é feito internamente pela sede, a pedido das farmácias. |
| 2 | Aprovação da conta pela sede | O sindicato vai informar um e-mail para a farmácia mandar o pedido de cadastro, provavelmente num aviso (banner) na página inicial. |
| 3 | Dígitos do CNPJ (sugestão do grupo) | Preferem o login só pelo CNPJ, com um código enviado ao e-mail do cadastro como senha temporária. Se não for possível, preferem a sugestão do grupo (CNPJ na criação da conta, com confirmação por e-mail). |
| 4 | Matriz e filiais | A contribuição é por CNPJ, mas o dono só precisa entrar na matriz. |
| 5 | Acesso de contador e secretária | Um cadastro só, o do dono, sem cadastros adicionais. O contador que atende várias farmácias entra em cada uma separadamente. |
| 6 | A sede pode trocar o e-mail da conta? | Sim. |
| 7 | Divisão de tarefas na sede | O ideal são 2 usuários administrativos: um com funções básicas, para o dia a dia (publicar anúncios, convenções etc.), e um "chave mestre", com as funções mais críticas (alteração de cadastro, pedidos de cancelamento e afins). |
| 8 | Texto para quem não contribui (sugestão do grupo) | Pode ser "Sem contribuição ativa". |
| 9 | Início do acesso aos benefícios | Os benefícios são a assessoria jurídica (atuação do advogado em tribunal), com o ano inteiro antecipado, e a consultoria (todos os outros benefícios), a partir do primeiro boleto. |
| 10 | Prazo até o bloqueio | Até vencer o próximo boleto. |
| 11 | Até quando vale a liberação manual | 1 semana, de preferência com um aviso na conta. |
| 12 | Interrupção da cobrança pela sede | A farmácia recebe uma notificação e tem um prazo de 30 dias. |
| 13 | Validade de 30 dias | Conta a partir do vencimento. Passados 30 dias, o boleto expira e os benefícios são bloqueados, como na resposta 10. |
| 14 | Pagamento dos meses em aberto | O ideal é juntar todos os valores num boleto só, como o DAS do MEI. |
| 15 | Fim dos lembretes depois do vencimento | Reduzir para 1 por semana, até vencer o segundo boleto, quando o acesso é revogado. |
| 16 | Dia do envio e revisão do lote | Primeiro dia útil do mês. Não precisa de revisão. |
| 17 | O que muda na revisão mensal | Não há revisão. O sindicato vai marcar uma reunião para conversar, porque não entendeu o propósito dela. |
| 18 | Primeiro boleto da adesão | A farmácia paga o mês inteiro, na hora. |
| 19 | Termo na adesão | Preferem que a farmácia aceite um termo. Ele ainda não existe; os advogados do sindicato vão escrever e pediram um exemplo para usar de base. |
| 20 | Boleto pedido pela farmácia | Em atraso, o pedido passa pela sede. Em dia, sai na hora, até um por mês; um segundo pedido no mesmo mês passa pela sede, para evitar custo. Vence no dia 10, com lembrete a cada 7 dias. Os benefícios ficam liberados até vencerem 2 boletos seguidos. |
| 25 | Convênio de cobrança no Sicredi | Não há. O sindicato tem a conta, mas não o contrato de cobrança, que será feito se necessário. |
| 26 | Acesso à API de Cobrança | Por enquanto, só a simulação de boletos. O pedido ao banco depende de uma reunião do sindicato. |
| 28 | A sede pode recusar o cancelamento? | Prazo de 15 dias. Sem recusa nesse prazo, o cancelamento é confirmado automaticamente. |
| 33 | O que quem está em atraso vê das convenções | Dois PDFs, um completo e um resumido, conforme a situação do usuário. |
| 40 | O arquivo da JUCEMAT traz e-mail? | Sim. Frequência e forma de recebimento ficam em aberto: o sindicato vai levantar com a JUCEMAT. Provavelmente XML (antes vinha em CD). |
| 42 | Lista dos associados que já pagam | Não existe; tudo é feito à mão. O grupo pode montar uma planilha que facilite o trabalho da sede; senão, o cadastro começa do zero. |
| 45 | Os donos leem e-mail? | Nem sempre o dono, mas a parte da gestão normalmente lê. |

Ficaram em branco: plano anual (21), valor atual (22), antecedência do aviso de reajuste (23, respondida depois, na seção 9), condições diferentes em contrato (24), tarifas do Sicredi (27), cancelamento: boleto do mês, acesso ao histórico e volta (29 a 31), aviso de cancelamento para a sede (32), inscrição em convenção (34), lista de benefícios (35), suporte (36), aviso por e-mail de conteúdo novo (37), notícias (38), formato dos documentos da convenção (39), CNAE (41), boleto de quem já paga (43), comunicado obrigatório (44), endereço de envio dos e-mails (46), histórico de pagamentos (47) e conteúdo da página inicial (48).

## 9. Conversa por vídeo de 28/10/2026

Conversa do grupo com o cliente, depois das respostas da seção 8. Ela responde à P20 (revisão do lote mensal) e à pergunta 23 (antecedência do aviso de mudança de valor).

- Os boletos são gerados todo mês automaticamente, sem revisão, mas a sede precisa poder editá-los.
- A edição, para mudar o valor ou outro dado, vale só para o próximo boleto, o do mês seguinte.
- Na hora da edição, antes desse boleto, o sistema manda um e-mail a quem vai receber a cobrança diferente, avisando da mudança.
- No começo, a sede provavelmente vai precisar marcar à mão quem recebe os boletos e preencher o próprio boleto. Por isso, a edição do boleto é essencial para ela.

O que isso mudou nos requisitos está em [Requisitos](requisitos.md) (RN04, RN15, RF10, RF11, RF19 e P20).
