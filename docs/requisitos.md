# Elo Connect — Requisitos (v3)

Consolidado a partir da entrevista e das respostas complementares do cliente. Última atualização: 09/10/2026.

**Legenda de status**

- [Validado] — confirmado pelo cliente ou decidido pelo grupo.

- [A confirmar] — mencionado, mas falta detalhe do cliente.

**Legenda de prioridade (MoSCoW)**: Must (obrigatório no MVP), Should (importante, entra se der), Could (desejável), Won't (fora do MVP).

Documentos relacionados: [Decisões Técnicas](decisoes-tecnicas.md), [Registro da Entrevista](registro-entrevista.md), [ADR-001](adr/0001-tecnologia-frontend.md) e o backlog no GitHub Projects da organização.

## 1. Glossário

| **Termo** | **Significado no projeto** |
| --- | --- |
| Associado | Qualquer farmácia/drogaria do universo do sindicato em MT (~2.000), identificada pelo CNAE. Não paga obrigatoriamente. Único tipo de usuário do lado do cliente. |
| Adimplente | Associado com a contribuição em dia. Acessa benefícios, suporte e inscrição em convenções. |
| Inadimplente | Associado que não está em dia: boleto vencido e não pago, ou que não contribui. Vê apenas as informações gerais das convenções. |
| Contribuição ativa | Atributo interno do cadastro (nome técnico livre) que marca os associados com cobrança recorrente (~150). É ativado pelo próprio associado ao pedir a cobrança recorrente no app e desativado por cancelamento aprovado pela sede ou por interrupção feita pela sede. Define quem recebe boleto e lembretes. Não é tipo de usuário e não aparece para o associado; no painel da sede, aparece como "Recebe boleto mensal: sim/não". |
| Contador | Contador da farmácia. Não é tipo de usuário e não tem conta própria: acessa com a conta do associado, que é responsável pelo compartilhamento (RN29). |
| Boleto avulso | Boleto de um único mês, pedido pelo associado sem aderir à cobrança recorrente. |
| Log de auditoria | Registro imutável de todas as ações feitas pelos usuários da sede (quem, o quê, quando, valor anterior e novo). |
| Feed de notícias | Área do app com notícias e atualizações do setor, publicadas pela sede. Visível a qualquer associado logado, adimplente ou inadimplente; visitantes não acessam. |
| Benefício | Serviços exclusivos para associados adimplentes (ex: suporte jurídico particular). Lista a definir em reunião futura com o cliente. |
| Convenção coletiva | Negociação anual (meio do ano) que define regras e reajustes salariais do setor. Módulo distinto de Benefícios. |
| Cobrança formal | Comunicado institucional obrigatório enviado a todos os associados, **sem boleto**. |
| CNAE | Classificação Nacional de Atividades Econômicas — identifica as empresas vinculadas ao sindicato. |
| JUCEMAT | Junta Comercial do Estado de Mato Grosso — fornece dados das empresas em XML. |

> Atenção: por decisão do cliente, o termo "afiliado" não é mais usado; a separação é feita por adimplente/inadimplente. Versões antigas dos documentos usavam associado/afiliado.

## 2. Perfis de usuário

| **Perfil** | **Descrição** | **Status** |
| --- | --- | --- |
| Administrador (sede) | 3 funcionários. Gerencia associados, cobrança, valores, conteúdo e cancelamentos. | [Validado] |
| Associado | Dono/representante de farmácia. Perfil único; o acesso depende do status. Adimplente: boletos, histórico, notícias, benefícios, suporte e convenções. Inadimplente: seus boletos e histórico, as notícias e as informações gerais das convenções, sem benefícios, suporte ou inscrição. O contador da farmácia usa esta mesma conta, com o mesmo acesso (RN29). | [Validado] |
| Visitante | Acessa a landing page pública com o que o sindicato oferece, login e cadastro. Não acessa o feed de notícias. | [Validado] |

Público majoritariamente de terceira idade: simplicidade de interface é requisito obrigatório, não opcional.

## 3. Regras de negócio

| **ID** | **Regra** | **Status** |
| --- | --- | --- |
| RN01 | O valor da contribuição é o mesmo para todos os associados. | [Validado] |
| RN02 | Vencimento fixo, até o dia 10 de cada mês. | [Validado] |
| RN03 | Boleto com validade de 30 dias. | [Validado] — ver pendência P01 |
| RN04 | Todo mês, antes do envio, um administrador revisa o lote de boletos (podendo editar) e confirma o envio com um único botão. | [Validado] |
| RN05 | Boletos são enviados **somente a associados com contribuição ativa**, nunca a todos os cadastrados. | [Validado] |
| RN06 | Pagamento por boleto ou Pix (QR Code). | [Validado] |
| RN07 | Lembretes: um 48h antes do vencimento; após o vencimento, a cada 48h enquanto não pago. | [Validado] |
| RN08 | Não há juros nem multa por atraso. | [Validado] |
| RN09 | Bloqueio do acesso a benefícios e suporte é automático e imediato após o vencimento sem pagamento. | [Validado] |
| RN10 | O desbloqueio é automático após a confirmação do pagamento. | [Validado] |
| RN11 | O administrador pode bloquear/desbloquear manualmente, além do automático. | [Validado] |
| RN12 | Inadimplente continua vendo informações gerais das convenções, mas não pode se inscrever nem acessar benefícios/suporte. | [Validado] |
| RN13 | Plano anual pago à vista tem 20% de desconto. | [Validado] |
| RN14 | Reajuste a cada 5 anos, aplicado a todos os associados com contribuição ativa ao mesmo tempo. | [Validado] |
| RN15 | Toda alteração de valor gera um e-mail de aviso aos associados com contribuição ativa e passa a valer a partir do próximo boleto. | [Validado] |
| RN16 | Toda alteração de valor fica registrada em histórico (quem, quando, valor anterior e novo). | [Validado] |
| RN17 | O histórico de transações é imutável e serve como prova em caso de divergência. | [Validado] |
| RN18 | Cancelamento: o associado solicita pelo app, o sistema mostra os benefícios e o suporte que ele perderá, e a sede valida a solicitação. | [Validado] |
| RN19 | O sindicato é obrigado a enviar uma cobrança formal (comunicado) a todos os associados do estado, informando a existência do sindicato, o valor e os benefícios. Esse envio **não inclui boleto**. | [Validado] |
| RN20 | Alteração de valor e painel de valores são exclusivos do perfil administrador. | [Validado] |
| RN21 | A confirmação de 5 dígitos aleatórios do CNPJ é feita no primeiro cadastro, junto com a confirmação por e-mail, e não a cada login. | [Validado] — comunicar ao cliente (P08) |
| RN22 | Adimplente e inadimplente são status do associado, não tipos de usuário. O sistema usa o atributo interno "contribuição ativa" para definir quem recebe boleto e lembretes; no painel da sede, ele aparece com o rótulo "Recebe boleto mensal: sim/não". O associado vê apenas adimplente ou inadimplente. | [Validado] |
| RN23 | O associado pode pedir pelo app que os boletos sejam enviados todo mês (cobrança recorrente). A adesão é automática, sem aprovação da sede, e ativa a contribuição ativa. | [Validado] |
| RN24 | O associado pode pagar apenas um mês, pedindo um boleto avulso pelo app, sem aderir à cobrança recorrente. | [Validado] — detalhes em P10 |
| RN25 | A sede pode interromper a cobrança recorrente de um associado a qualquer momento, além do cancelamento solicitado por ele. | [Validado] |
| RN26 | Toda ação dos usuários da sede fica registrada em log de auditoria imutável: cadastro e edição de associados, bloqueio/desbloqueio, ativação ou interrupção da cobrança recorrente, edição e envio do lote, alteração de valores, aprovação de cancelamentos e publicação de notícias e conteúdo. | [Validado] |
| RN27 | Princípio do projeto: automatizar processos sem criar novos processos manuais. A entrada na cobrança recorrente é automática; só o cancelamento passa por aprovação da sede. | [Validado] |
| RN28 | O feed de notícias é visível a qualquer associado logado, adimplente ou inadimplente. Visitantes não têm acesso. | [Validado] |
| RN29 | Não existe conta para contador. O contador acessa com o e-mail e a senha da conta do associado, vinculada ao CNPJ da farmácia, e tem exatamente o mesmo acesso dela. O compartilhamento do acesso é responsabilidade exclusiva do titular da conta, e toda ação feita com esse login é considerada ação do associado. | [Validado] — forma de deixar explícito em P11 |

## 4. Requisitos funcionais

### 4.1 Acesso e landing page

| **ID** | **Requisito** | **Prioridade** | **Status** |
| --- | --- | --- | --- |
| RF01 | Landing page pública com o que o sindicato oferece (benefícios, convenção, suporte), botão de login e de cadastro. | Must | [Validado] |
| RF02 | Login com e-mail e senha. | Must | [Validado] |
| RF03 | Recuperação de senha por link enviado ao e-mail cadastrado. | Must | [Validado] |
| RF04 | No primeiro cadastro, verificação de identidade com 5 dígitos aleatórios do CNPJ e confirmação por e-mail. | Should | [Validado] |
| RF05 | Cadastro de nova conta pelo associado. | Must | [A confirmar] — ver P03 |

### 4.2 Gestão de associados (admin)

| **ID** | **Requisito** | **Prioridade** | **Status** |
| --- | --- | --- | --- |
| RF06 | Listar associados com status (adimplente / inadimplente / cancelamento solicitado), com busca e filtro (inclusive por contribuição ativa). | Must | [Validado] |
| RF07 | Visualizar perfil completo do associado: dados cadastrais, status, histórico de boletos/pagamentos e solicitações. | Must | [Validado] |
| RF08 | Cadastrar, editar e inativar associados manualmente, incluindo marcar ou desmarcar a contribuição ativa. | Must | [Validado] |
| RF09 | Bloquear/desbloquear manualmente o acesso de um associado a benefícios. | Must | [Validado] |

### 4.3 Cobrança (integração Sicredi)

| **ID** | **Requisito** | **Prioridade** | **Status** |
| --- | --- | --- | --- |
| RF10 | Gerar mensalmente, em modo rascunho, o lote de boletos (com Pix QR Code) de todos os associados com contribuição ativa. | Must | [Validado] |
| RF11 | Tela de aprovação do lote mensal: revisar, editar dados do boleto e enviar todos com um único botão. | Must | [Validado] |
| RF12 | Enviar o boleto por e-mail e disponibilizá-lo no app (boleto + Pix QR Code). | Must | [Validado] |
| RF13 | Enviar lembrete automático 48h antes do vencimento. | Must | [Validado] |
| RF14 | Enviar lembrete automático a cada 48h após o vencimento enquanto o boleto estiver em aberto. | Must | [Validado] — término a confirmar (P01) |
| RF15 | Registrar automaticamente o pagamento (baixa) e atualizar o status do associado. | Must | [Validado] — técnica a definir (O2) |
| RF16 | Bloquear automaticamente o acesso a benefícios no vencimento sem pagamento. | Must | [Validado] |
| RF17 | Permitir ao associado optar pelo plano anual à vista com 20% de desconto. | Should | [Validado] — ver P04 |
| RF36 | Tela de adesão: associado pede pelo app a cobrança recorrente; a contribuição ativa é ativada automaticamente, sem aprovação da sede. | Must | [Validado] — primeiro boleto em P03 |
| RF37 | Associado solicita pelo app um boleto avulso (pagamento de um único mês), sem aderir à cobrança recorrente. | Must | [Validado] — regras em P10 |
| RF38 | Admin interrompe a cobrança recorrente de um associado (desativa a contribuição ativa), com registro no log de auditoria. | Must | [Validado] |

### 4.4 Painel de valores (admin)

| **ID** | **Requisito** | **Prioridade** | **Status** |
| --- | --- | --- | --- |
| RF18 | Alterar o valor da contribuição (mensal e anual). | Must | [Validado] |
| RF19 | Ao alterar o valor, gerar e enviar e-mail de aviso aos associados com contribuição ativa; novo valor aplicado no próximo boleto. | Must | [Validado] |
| RF20 | Exibir histórico de alterações de valor. | Must | [Validado] |

### 4.5 Convenções coletivas

| **ID** | **Requisito** | **Prioridade** | **Status** |
| --- | --- | --- | --- |
| RF21 | Funcionário da sede publica e edita o resumo da convenção coletiva (texto, anexos em PDF, tabela de reajuste salarial). | Must | [Validado] |
| RF22 | Qualquer usuário logado (inclusive inadimplente) vê as informações gerais das convenções. O contador acessa pela conta do associado (RN29). | Must | [Validado] |
| RF23 | Associado adimplente pode se inscrever/registrar participação em uma convenção. | Should | [A confirmar] — ver P05 |

### 4.6 Benefícios e suporte

| **ID** | **Requisito** | **Prioridade** | **Status** |
| --- | --- | --- | --- |
| RF24 | Admin cadastra/edita os benefícios exibidos no app e na landing page. | Must | [Validado] — conteúdo a definir (P06) |
| RF25 | Associado adimplente acessa os benefícios e solicita suporte. | Should | [A confirmar] — depende da lista de benefícios |

### 4.7 Cancelamento

| **ID** | **Requisito** | **Prioridade** | **Status** |
| --- | --- | --- | --- |
| RF26 | Associado solicita cancelamento pelo app; antes de confirmar, o sistema mostra os benefícios e o suporte que ele perderá. | Must | [Validado] |
| RF27 | Sede recebe notificação da solicitação, valida, e a cobrança deixa de ser gerada. | Must | [Validado] |

### 4.8 Cobrança formal (universo CNAE)

| **ID** | **Requisito** | **Prioridade** | **Status** |
| --- | --- | --- | --- |
| RF28 | Importar a base de associados a partir do XML da JUCEMAT (filtrado pelo CNAE). | Should | [A confirmar] — ver P02 |
| RF29 | Enviar a cobrança formal (comunicado, sem boleto) por e-mail a todos os associados da base. | Must | [Validado] — depende de P02 |

### 4.9 Histórico e auditoria

| **ID** | **Requisito** | **Prioridade** | **Status** |
| --- | --- | --- | --- |
| RF30 | Registrar de forma imutável cada transação: data/hora, identificador do boleto, valor, forma de pagamento, status, usuário responsável. | Must | [Validado] |
| RF31 | Associado consulta seu próprio histórico de boletos e pagamentos. | Must | [Validado] |
| RF32 | Admin exporta o histórico de um associado (PDF/CSV) para comprovar contribuição ou não contribuição. | Should | [Validado] |
| RF39 | Registrar de forma imutável todas as ações dos usuários da sede: usuário, ação, data/hora, associado ou registro afetado, valor anterior e novo. | Must | [Validado] |
| RF40 | Admin consulta o log de auditoria com filtros por usuário, associado, tipo de ação e período. | Must | [Validado] |

### 4.10 Notícias
| ID | Requisito | Prioridade | Status |
|---|---|---|---|
| RF35 | Feed de notícias no app, num ponto único, visível a qualquer associado logado (adimplente ou inadimplente). | Must | [Validado] |
| RF41 | Funcionário da sede publica, edita e remove notícias do feed. | Must | [Validado] |

### 4.11 Fora do MVP

| **ID** | **Requisito** | **Prioridade** | **Status** |
| --- | --- | --- | --- |
| RF33 | Chatbot de WhatsApp para atendimento inicial. | Won't | [Validado] fora do MVP |
| RF34 | App mobile nativo. | Won't | Roadmap do próximo semestre |

## 5. Requisitos não funcionais

| **ID** | **Requisito** | **Status** |
| --- | --- | --- |
| RNF01 | Usabilidade para terceira idade: fonte base grande (mín. 18px), alto contraste, poucos passos por tela, botões grandes, linguagem direta, sem jargão. | [Validado] |
| RNF02 | Acessibilidade alinhada a WCAG 2.1 AA (contraste, navegação por teclado, rótulos). | [Validado] |
| RNF03 | Aplicação web responsiva (web mobile), pois parte do público tende a acessar pelo celular. | [Validado] |
| RNF04 | Segurança: senhas com hash (bcrypt/argon2), HTTPS, controle de acesso por perfil, credenciais do Sicredi apenas no back-end. | [Validado] |
| RNF05 | LGPD: tratamento de dados cadastrais e financeiros. | [A confirmar] — pergunta para o Prof. Poli (P07) |
| RNF06 | Auditoria: logs de transações, de alterações de valor e de todas as ações dos usuários da sede não podem ser apagados nem editados. | [Validado] |
| RNF07 | Volume: até ~2.000 associados, ~150 com contribuição ativa, estimativa de menos de 400 acessos mensais. Hospedagem em free tier é suficiente. | [Validado] |
| RNF08 | Integração de pagamento via API do Sicredi (conta já existente do cliente; custos do Sicredi pagos pelo sindicato). | [Validado] |
| RNF09 | Envio de e-mail transacional com volume compatível com ~2.000 destinatários (cobrança formal), com envio escalonado se necessário. | [Validado] |
| RNF10 | Dados do cliente: nenhum dado real (CNPJs, e-mails, XML da JUCEMAT, credenciais do Sicredi, contrato e dados do termo de parceria) é versionado no repositório, que é público. Seeds, testes e demonstrações usam dados fictícios. | [Validado] |

## 6. Backlog

As user stories (US01 a US39) são mantidas como issues no GitHub Projects da organização ("Elo Connect - MVP"), que é a fonte oficial do backlog. Cada issue traz o ID da história e os requisitos funcionais (RF) que ela atende, e usa labels de prioridade (MoSCoW), épico e status ("a confirmar").

## 7. Observações técnicas

**O1 — Verificação por CNPJ.** O CNPJ é um dado público (consultável na Receita Federal), então pedir dígitos dele a cada login não comprova identidade e cria atrito para o público idoso. Decisão: usar a confirmação de CNPJ apenas no primeiro cadastro, para vincular a conta à farmácia certa, junto com confirmação por e-mail (RN21). O cliente havia pedido a verificação para garantir a identidade; o ajuste precisa ser comunicado a ele (P08).

**O2 — Conciliação de pagamento (baixa).** Como o desbloqueio automático foi validado (RN10), a baixa precisa ser automática. Duas formas: (1) webhook — o Sicredi avisa o sistema quando o boleto/Pix é pago; (2) polling — o sistema consulta a API do Sicredi periodicamente (ex: a cada hora). Webhook é imediato; polling é mais simples de implementar e testar. Verificar na documentação da API de Cobrança do Sicredi qual opção está disponível.

**O3 — Integração Sicredi.** O cliente precisa solicitar à cooperativa o acesso à API de cobrança (credenciais e convênio). Confirmar também como o Sicredi cobra as tarifas (por boleto emitido ou só por boleto pago), porque isso afeta o custo do envio mensal e reforça a decisão de não emitir boleto para as ~2.000 farmácias.

**O4 — Envio de e-mail em massa.** Serviços gratuitos de e-mail transacional costumam ter limite diário de envios. O comunicado para ~2.000 farmácias pode exigir envio escalonado em alguns dias ou um plano pago de baixo custo. Verificar os limites atuais do serviço escolhido.

**O5 — Tecnologia de front-end.** Decidida no ADR-001 (aceito em 09/10/2026): React + Vite na web, React Native/Expo no app, NestJS no back-end, em monorepo TypeScript. O PI não exige nem restringe tecnologia; a escolha fica a critério do grupo.

**O6 — Adimplente/inadimplente sem tipos de usuário.** O cliente pediu para não separar associado e afiliado. Por isso há um único perfil de associado, e adimplente/inadimplente é apenas um status que libera ou bloqueia benefícios. Ainda assim, o sistema precisa saber quem aderiu à contribuição: sem o atributo interno "contribuição ativa", os ~1.850 associados que nunca contribuíram seriam tratados como inadimplentes com boleto em aberto e receberiam boletos e lembretes a cada 48h. O nome interno é decisão do grupo; o que importa é o que aparece na tela. No painel da sede, o atributo aparece como filtro com o rótulo "Recebe boleto mensal: sim/não" (RN22).

**O7 — Entrada automática, saída aprovada.** Seguindo o princípio de não criar processos manuais (RN27), a adesão à cobrança recorrente é feita pelo próprio associado e ativada automaticamente (RN23). O cancelamento continua passando pela sede (RN18), que já hoje usa esse momento para tentar reter o associado. A sede também pode interromper a cobrança por conta própria (RN25), e tudo o que os usuários da sede fazem fica no log de auditoria (RN26). Os ~150 associados que já pagam entram por importação inicial, não por marcação manual um a um (P09).

**O8 — Contadores sem conta própria.** Pela RN29, o sistema não tem perfil nem convite para contador, o que mantém um único perfil de associado (RN22) e evita um fluxo extra de cadastro. Consequências: o contador vê o mesmo que o associado (se ele estiver inadimplente, só as informações gerais das convenções) e consegue fazer o mesmo que ele (pedir boleto, aderir à cobrança recorrente, solicitar cancelamento). A recuperação de senha vai para o e-mail do associado. O sistema não tem como distinguir o contador do associado nos registros.

## 8. Pendências

| **ID** | **Pergunta / ação** | **Com quem** | **Impacto** |
| --- | --- | --- | --- |
| P01 | A validade de 30 dias significa que o boleto pode ser pago até 30 dias após o vencimento? Depois disso, o boleto é cancelado e o valor vai para o mês seguinte, ou a dívida acumula? Os lembretes param nesse momento? | Cliente | RF14, RF15, histórico |
| P02 | O XML da JUCEMAT traz o e-mail das farmácias? Com que frequência e de que forma o sindicato recebe esse arquivo? | Cliente | RF28, RF29 (sem e-mail não há como enviar a cobrança formal) |
| P03 | Qualquer associado pode criar conta pelo app? Ao pedir a cobrança recorrente, o primeiro boleto é gerado na hora ou só no próximo lote mensal? | Cliente | RF05, RF36, fluxo de entrada |
| P04 | O associado do plano anual fica fora do lote mensal? Como é a renovação no fim do ano? | Cliente | RF17, RF10 |
| P05 | O que significa "se registrar em uma convenção" na prática (inscrição em assembleia, evento, outro)? | Cliente | RF23 |
| P06 | Lista de benefícios (aguardando reunião futura do cliente). | Cliente | RF24, RF25, landing page |
| P07 | LGPD e tratamento de dados cadastrais e financeiros. | Prof. Poli | RNF05 |
| P08 | Comunicar ao cliente o ajuste na verificação por CNPJ (só no primeiro cadastro, com confirmação por e-mail). | Cliente | RF04, RN21 |
| P09 | Carga inicial: em que formato está hoje a lista dos ~150 associados que já pagam (planilha, sistema anterior)? | Cliente | RF08, RF10, implantação |
| P10 | Boleto avulso: é gerado na hora ou entra no lote mensal? Segue o vencimento do dia 10 e os lembretes? O pagamento libera os benefícios por qual período? | Cliente | RN24, RF37, RF16 |
| P11 | Responsabilidade pelo compartilhamento do acesso com o contador (RN29): um aviso com caixa de aceite no primeiro cadastro basta, ou é preciso um termo de uso formal? O sistema deve registrar data/hora do aceite? Permitir o compartilhamento de credenciais entra em conflito com a LGPD para os dados financeiros do associado? | Prof. Poli | RN29, RF04, RNF05 |
