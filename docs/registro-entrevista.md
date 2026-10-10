# Elo Connect — Registro da Entrevista com o Cliente

Sindicato patronal de farmácias e drogarias de Mato Grosso. Baseado nas anotações da entrevista e nas respostas complementares do cliente. Última atualização: 09/10/2026.

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

- Login com e-mail e senha; confirmação de 5 dígitos aleatórios do CNPJ para garantir que é o representante (no sistema, aplicada no primeiro cadastro — ver Requisitos, RN21).

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

### Em aberto

- O que acontece após os 30 dias de validade do boleto?

- O XML da JUCEMAT traz e-mail das farmácias? Frequência e forma de recebimento.

- Criação de conta pelo associado e momento do primeiro boleto após o pedido de cobrança recorrente.

- Formato da lista atual dos ~150 associados que já pagam (carga inicial).

- Regras do boleto avulso (pagamento de um único mês).

- Plano anual: fica fora do lote mensal? Renovação?

- O que significa "se registrar em uma convenção".

- Lista de benefícios (reunião futura do cliente).
