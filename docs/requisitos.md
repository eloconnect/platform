# Elo Connect — Requisitos (v6)

Consolidado a partir da entrevista, das respostas complementares do cliente e do questionário de 14/10/2026, respondido em partes em 27 e 28/10/2026, e da conversa por vídeo de 28/10/2026 (resumo no [Registro da Entrevista](registro-entrevista.md), seções 8 e 9). Última atualização: 28/10/2026.

**Legenda de status**

- [Validado] — confirmado pelo cliente ou decidido pelo grupo.

- [A confirmar] — mencionado, mas falta detalhe do cliente.

**Legenda de prioridade (MoSCoW)**: Must (obrigatório no MVP), Should (importante, entra se der), Could (desejável), Won't (fora do MVP).

Documentos relacionados: [Decisões Técnicas](decisoes-tecnicas.md), [Registro da Entrevista](registro-entrevista.md), [ADR-001](adr/0001-tecnologia-frontend.md) e o backlog no GitHub Projects da organização.

## 1. Glossário

| **Termo** | **Significado no projeto** |
| --- | --- |
| Associado | Qualquer farmácia/drogaria do universo do sindicato em MT (~2.000), identificada pelo CNAE. Não paga obrigatoriamente. Único tipo de usuário do lado do cliente. |
| Adimplente | Associado com a contribuição em dia. Acessa benefícios, suporte, inscrição em convenções e o PDF completo das convenções. |
| Inadimplente | Associado com contribuição ativa e boleto vencido e não pago. Perde o acesso a benefícios e suporte quando o boleto expira, 30 dias após o vencimento (RN09). Vê o PDF resumido das convenções. |
| Sem contribuição ativa | Texto que o associado vê quando não contribui (e não é obrigado a contribuir). Tem o mesmo acesso do inadimplente, mas a tela não usa a palavra "Inadimplente" (RN22). |
| Contribuição ativa | Atributo interno do cadastro (nome técnico livre) que marca os associados com cobrança recorrente (~150). É ativado pelo próprio associado ao pedir a cobrança recorrente no app e desativado por cancelamento confirmado ou por interrupção feita pela sede. Define quem recebe boleto e lembretes. Não é tipo de usuário. No painel da sede, aparece como "Recebe boleto mensal: sim/não"; para o associado que não está em dia, a falta dele aparece como "Sem contribuição ativa". |
| Contador | Contador da farmácia. Não é tipo de usuário e não tem conta própria: acessa com a conta do associado, que é responsável pelo compartilhamento (RN29). |
| Matriz e filiais | Farmácias do mesmo dono, cada uma com seu CNPJ. A contribuição é por CNPJ, mas o dono só precisa entrar na conta da matriz (RN31). |
| Boleto avulso | Boleto de um único mês, pedido pelo associado sem aderir à cobrança recorrente. |
| Boleto único dos meses em aberto | Boleto que junta o valor de todos os meses em aberto, sem juros, para o associado voltar a ficar em dia (RN30). |
| Log de auditoria | Registro imutável de todas as ações feitas pelos usuários da sede (quem, o quê, quando, valor anterior e novo). |
| Feed de notícias | Área do app com notícias e atualizações do setor, publicadas pela sede. Visível a qualquer associado logado, adimplente ou inadimplente; visitantes não acessam. |
| Benefício | Serviços exclusivos para associados em dia, em dois grupos: assessoria jurídica (atuação do advogado em tribunal) e consultoria (todos os outros benefícios). Cada grupo tem uma regra de início (RN32). A lista completa depende da P06. |
| Convenção coletiva | Negociação anual (meio do ano) que define regras e reajustes salariais do setor. Módulo distinto de Benefícios. Cada convenção tem dois PDFs: o completo, para quem está em dia, e o resumido, para os demais (RN12). |
| Cobrança formal | Comunicado institucional obrigatório enviado a todos os associados, **sem boleto**. |
| CNAE | Classificação Nacional de Atividades Econômicas — identifica as empresas vinculadas ao sindicato. |
| JUCEMAT | Junta Comercial do Estado de Mato Grosso — fornece dados das empresas, com o e-mail, provavelmente em XML (P02). |

> Atenção: por decisão do cliente, o termo "afiliado" não é mais usado; a separação é feita por adimplente/inadimplente. Versões antigas dos documentos usavam associado/afiliado.

## 2. Perfis de usuário

| **Perfil** | **Descrição** | **Status** |
| --- | --- | --- |
| Administrador (sede) | 3 funcionários, em dois perfis (RN33): **chave mestre**, com todas as funções, e **básico**, para o dia a dia (publicar conteúdo e consultar associados). | [Validado] |
| Associado | Dono/representante de farmácia. Perfil único; o acesso depende do status. Adimplente: boletos, histórico, notícias, benefícios, suporte e o PDF completo das convenções. Inadimplente ou sem contribuição ativa: seus boletos e histórico, as notícias e o PDF resumido das convenções, sem benefícios, suporte ou inscrição. O contador da farmácia usa esta mesma conta, com o mesmo acesso (RN29). | [Validado] |
| Visitante | Acessa a landing page pública com o que o sindicato oferece, o login, a criação de conta e o aviso com o e-mail para pedir o cadastro da farmácia. Não acessa o feed de notícias. | [Validado] |

Público majoritariamente de terceira idade: simplicidade de interface é requisito obrigatório, não opcional.

## 3. Regras de negócio

| **ID** | **Regra** | **Status** |
| --- | --- | --- |
| RN01 | O valor da contribuição é o mesmo para todos os associados. | [Validado] |
| RN02 | Vencimento fixo, até o dia 10 de cada mês. Os boletos mensais são enviados no primeiro dia útil do mês. | [Validado] — dia do envio: resposta 16 |
| RN03 | Boleto com validade de 30 dias, contados a partir do vencimento. Depois disso, o boleto expira. | [Validado] — lembretes depois da expiração em P01 |
| RN04 | Os boletos mensais são gerados e enviados automaticamente, sem revisão. A sede pode editar o boleto de um associado (o valor ou outro dado): a edição vale para o boleto do mês seguinte, e o associado recebe na hora um e-mail avisando que a cobrança vai mudar. | [Validado] — conversa de 28/10/2026 (P20); quais dados podem ser editados e até quando: decisão do grupo na M3 |
| RN05 | Boletos são enviados **somente a associados com contribuição ativa**, nunca a todos os cadastrados. | [Validado] |
| RN06 | Pagamento por boleto ou Pix (QR Code). | [Validado] |
| RN07 | Lembretes: um 48h antes do vencimento; depois do vencimento, um por semana, até o boleto expirar e o acesso ser bloqueado (RN09). | [Validado] — mudou em 28/10/2026 (resposta 15); antes, a cada 48h |
| RN08 | Não há juros nem multa por atraso. | [Validado] |
| RN09 | O bloqueio do acesso a benefícios e suporte é automático e acontece quando o boleto expira sem pagamento, 30 dias após o vencimento (perto do vencimento do boleto seguinte). Até lá, o acesso continua. | [Validado] — mudou em 27/10/2026; antes, o bloqueio era imediato |
| RN10 | O desbloqueio é automático após a confirmação do pagamento. | [Validado] |
| RN11 | O administrador pode bloquear/desbloquear manualmente, além do automático. A liberação manual vale 7 dias, com um aviso na área do associado; depois disso, o acesso volta a seguir o pagamento. O bloqueio manual vale até a sede mudar. | [Validado] — prazo e aviso: resposta 11 |
| RN12 | Cada convenção tem dois PDFs. Quem está em dia vê o completo. Quem não está (inadimplente ou sem contribuição ativa) vê o resumido e não pode se inscrever nem acessar benefícios e suporte. | [Validado] |
| RN13 | Plano anual pago à vista tem 20% de desconto. | [Validado] |
| RN14 | Reajuste a cada 5 anos, aplicado a todos os associados com contribuição ativa ao mesmo tempo. | [Validado] |
| RN15 | Toda alteração de valor gera, na hora, um e-mail de aviso aos associados com contribuição ativa e passa a valer a partir do boleto do mês seguinte ao da alteração. | [Validado] — aviso na hora: conversa de 28/10/2026 (pergunta 23) |
| RN16 | Toda alteração de valor fica registrada em histórico (quem, quando, valor anterior e novo). | [Validado] |
| RN17 | O histórico de transações é imutável e serve como prova em caso de divergência. | [Validado] |
| RN18 | Cancelamento: o associado solicita pelo app, e o sistema mostra os benefícios e o suporte que ele perderá. A sede tem 15 dias para recusar o pedido (por exemplo, quando a farmácia desiste depois de conversar com a sede). Sem recusa nesse prazo, o cancelamento é confirmado automaticamente. | [Validado] |
| RN19 | O sindicato é obrigado a enviar uma cobrança formal (comunicado) a todos os associados do estado, informando a existência do sindicato, o valor e os benefícios. Esse envio **não inclui boleto**. | [Validado] |
| RN20 | Alteração de valor e painel de valores são exclusivos do perfil administrador. | [Validado] |
| RN21 | A farmácia entra no cadastro pela sede, a pedido dela, ou pela importação da JUCEMAT (RF28). A conta de acesso é criada pelo próprio associado a partir do CNPJ: o sistema confere se a farmácia está no cadastro e manda para o e-mail desse cadastro um link para criar a senha. Não há confirmação de dígitos do CNPJ, nem na criação da conta nem no login. | [Validado] — decisão do grupo a partir da resposta 3 (O1); comunicar ao cliente (P08) |
| RN22 | Adimplente e inadimplente são status do associado, não tipos de usuário. O sistema usa o atributo interno "contribuição ativa" para definir quem recebe boleto e lembretes; no painel da sede, ele aparece com o rótulo "Recebe boleto mensal: sim/não". O associado vê "Adimplente", "Inadimplente" (tem contribuição ativa e está em atraso) ou "Sem contribuição ativa" (não contribui). | [Validado] |
| RN23 | O associado pode pedir pelo app que os boletos sejam enviados todo mês (cobrança recorrente). A adesão é automática, sem aprovação da sede, ativa a contribuição ativa e gera na hora o boleto do mês, com o valor cheio (sem valor proporcional). Para aderir, o associado aceita um termo, escrito pelos advogados do sindicato (resposta 19). | [Validado] — vencimento desse primeiro boleto em P16; texto do termo em P21 |
| RN24 | O associado pode pagar apenas um mês, pedindo um boleto avulso pelo app, sem aderir à cobrança recorrente. Em dia, ele gera o boleto na hora, um por mês; um segundo pedido no mesmo mês passa pela sede, para evitar custo. O boleto vence no dia 10, com lembrete semanal (resposta 20). | [Validado] — o que falta em P10 |
| RN25 | A sede pode interromper a cobrança recorrente de um associado a qualquer momento, além do cancelamento solicitado por ele. O associado recebe um aviso e mantém o acesso por mais 30 dias (resposta 12). | [Validado] |
| RN26 | Toda ação dos usuários da sede fica registrada em log de auditoria imutável: cadastro e edição de associados, bloqueio/desbloqueio, ativação ou interrupção da cobrança recorrente, edição de boletos, alteração de valores, aprovação de cancelamentos e publicação de notícias e conteúdo. | [Validado] |
| RN27 | Princípio do projeto: automatizar processos sem criar novos processos manuais. A entrada na cobrança recorrente é automática; só o cancelamento passa por aprovação da sede. | [Validado] |
| RN28 | O feed de notícias é visível a qualquer associado logado, adimplente ou inadimplente. Visitantes não têm acesso. | [Validado] |
| RN29 | Não existe conta para contador. O contador acessa com o e-mail e a senha da conta do associado, vinculada ao CNPJ da farmácia, e tem exatamente o mesmo acesso dela. O compartilhamento do acesso é responsabilidade exclusiva do titular da conta, e toda ação feita com esse login é considerada ação do associado. O contador que atende várias farmácias entra em cada uma separadamente (resposta 5). | [Validado] — forma de deixar explícito em P11 |
| RN30 | Para voltar a ficar em dia, o associado paga todos os meses em aberto, sem juros, num boleto só, que junta os valores (como o DAS do MEI). Ele pede esse boleto pelo app, e o pedido passa pela sede antes da emissão (resposta 20). | [Validado] — o que falta em P10 |
| RN31 | A contribuição é por CNPJ: a matriz e cada filial pagam a sua. O dono só precisa entrar na conta da matriz. | [Validado] — como a conta da matriz acompanha as filiais em P14 |
| RN32 | Os benefícios têm dois grupos. A assessoria jurídica (atuação do advogado em tribunal) exige o ano inteiro pago antecipado. A consultoria (todos os outros benefícios) vale a partir do primeiro boleto. | [Validado] — interpretação em P15 |
| RN33 | A sede tem dois perfis (resposta 7). O **chave mestre** faz tudo. O **básico** publica notícias, convenções e benefícios e consulta os associados, mas não altera cadastro, acesso, cobrança, valores nem cancelamentos, e não vê o log de auditoria. | [Validado] — as funções que o cliente não citou ficam com o chave mestre, e a consulta de associados fica com os dois (decisão do grupo) |
| RN34 | A sede pode trocar o e-mail da conta do associado (resposta 6). O e-mail do cadastro é o mesmo da conta: trocar um troca o outro, e o associado é avisado no e-mail antigo e no novo. | [Validado] — e-mail único por farmácia: decisão do grupo a partir da resposta 5 |

## 4. Requisitos funcionais

### 4.1 Acesso e landing page

| **ID** | **Requisito** | **Prioridade** | **Status** |
| --- | --- | --- | --- |
| RF01 | Landing page pública com o que o sindicato oferece (benefícios, convenção, suporte), botões de login e de criação de conta, e um aviso com o e-mail para a farmácia que ainda não está no cadastro pedir o cadastro. | Must | [Validado] — e-mail em P19 |
| RF02 | Login com e-mail e senha. | Must | [Validado] |
| RF03 | Recuperação de senha por link enviado ao e-mail cadastrado. | Must | [Validado] |
| RF04 | Verificação de identidade no primeiro cadastro. Desde 27/10/2026, faz parte do RF05: a identidade é confirmada pelo link enviado ao e-mail do cadastro, sem dígitos do CNPJ. | — | Substituído pelo RF05 |
| RF05 | Criação de conta pelo associado: ele informa o CNPJ, o sistema confere se a farmácia está no cadastro e tem e-mail, e envia a esse e-mail um link para criar a senha. A mensagem na tela é a mesma, esteja ou não o CNPJ no cadastro. | Must | [Validado] — e-mail repetido entre farmácias em P18 |

### 4.2 Gestão de associados (admin)

| **ID** | **Requisito** | **Prioridade** | **Status** |
| --- | --- | --- | --- |
| RF06 | Listar associados com status (adimplente / inadimplente / cancelamento solicitado), com busca e filtro (inclusive por contribuição ativa). | Must | [Validado] |
| RF07 | Visualizar perfil completo do associado: dados cadastrais, status, conta de acesso (criada ou não), histórico de boletos/pagamentos e solicitações. | Must | [Validado] |
| RF08 | Cadastrar, editar e inativar associados manualmente, incluindo marcar ou desmarcar a contribuição ativa e trocar o e-mail, que também é o de acesso (RN34). | Must | [Validado] — reativar um associado inativado: [A confirmar] (P13) |
| RF09 | Bloquear/desbloquear manualmente o acesso de um associado a benefícios. A liberação vale 7 dias e aparece como aviso na área do associado (RN11). | Must | [Validado] |
| RF42 | Carga inicial dos associados que já pagam: planilha modelo, montada pelo grupo, que a sede preenche, e importação dessa planilha. | Must | [Validado] |
| RF43 | A conta da matriz acompanha as filiais do mesmo dono (RN31). | Should | [A confirmar] — ver P14 |

### 4.3 Cobrança (integração Sicredi)

| **ID** | **Requisito** | **Prioridade** | **Status** |
| --- | --- | --- | --- |
| RF10 | Gerar e enviar automaticamente, no primeiro dia útil do mês, o lote de boletos (com Pix QR Code) de todos os associados com contribuição ativa, sem revisão (RN04). | Must | [Validado] — conversa de 28/10/2026 (P20) |
| RF11 | A sede edita o boleto de um associado (o valor ou outro dado). A edição vale para o boleto do mês seguinte, e o associado recebe um e-mail na hora (RN04). | Must | [Validado] — quais dados e até quando: decisão do grupo na M3 |
| RF12 | Enviar o boleto por e-mail e disponibilizá-lo no app (boleto + Pix QR Code). | Must | [Validado] |
| RF13 | Enviar lembrete automático 48h antes do vencimento. | Must | [Validado] |
| RF14 | Enviar lembrete automático uma vez por semana após o vencimento, até o boleto expirar (RN07). | Must | [Validado] |
| RF15 | Registrar automaticamente o pagamento (baixa) e atualizar o status do associado. | Must | [Validado] — técnica a definir (O2) |
| RF16 | Bloquear automaticamente o acesso a benefícios quando o boleto expira sem pagamento, 30 dias após o vencimento (RN09). | Must | [Validado] |
| RF17 | Permitir ao associado optar pelo plano anual à vista com 20% de desconto. | Should | [Validado] — ver P04 e P15 |
| RF36 | Tela de adesão: associado pede pelo app a cobrança recorrente; a contribuição ativa é ativada automaticamente, sem aprovação da sede, e o boleto do mês é gerado na hora, com o valor cheio. Antes de confirmar, o associado aceita o termo de adesão, e o sistema guarda a data, a hora e a versão do termo aceito (RN23). | Must | [Validado] — vencimento do primeiro boleto em P16; texto do termo em P21 |
| RF37 | Associado solicita pelo app um boleto avulso (pagamento de um único mês), sem aderir à cobrança recorrente, ou o boleto único dos meses em aberto (RN30). O avulso sai na hora para quem está em dia, um por mês; o boleto dos meses em aberto e o segundo avulso do mês passam pela sede, que aprova ou recusa (RN24, RN30). | Must | [Validado] — o que falta em P10 |
| RF38 | Admin interrompe a cobrança recorrente de um associado (desativa a contribuição ativa), com registro no log de auditoria. O associado recebe um aviso por e-mail e mantém o acesso por mais 30 dias (RN25). | Must | [Validado] |

### 4.4 Painel de valores (admin)

| **ID** | **Requisito** | **Prioridade** | **Status** |
| --- | --- | --- | --- |
| RF18 | Alterar o valor mensal da contribuição. O valor anual é calculado: 12 vezes o mensal, com 20% de desconto (RN13). | Must | [Validado] — cálculo do anual em P23 |
| RF19 | Ao alterar o valor, enviar na hora um e-mail de aviso aos associados com contribuição ativa; o novo valor vale a partir do boleto do mês seguinte (RN15). | Must | [Validado] |
| RF20 | Exibir histórico de alterações de valor. | Must | [Validado] |

### 4.5 Convenções coletivas

| **ID** | **Requisito** | **Prioridade** | **Status** |
| --- | --- | --- | --- |
| RF21 | Funcionário da sede publica e edita a convenção coletiva: resumo em texto, PDF completo, PDF resumido e tabela de reajuste salarial. | Must | [Validado] — formato dos documentos e da tabela de reajuste em P24 |
| RF22 | Qualquer usuário logado vê as convenções: quem está em dia, o PDF completo; os demais (inclusive inadimplente), o resumido (RN12). O contador acessa pela conta do associado (RN29). | Must | [Validado] |
| RF23 | Associado adimplente pode se inscrever/registrar participação em uma convenção. | Should | [A confirmar] — ver P05 |

### 4.6 Benefícios e suporte

| **ID** | **Requisito** | **Prioridade** | **Status** |
| --- | --- | --- | --- |
| RF24 | Admin cadastra/edita os benefícios exibidos no app e na landing page, em dois grupos: assessoria jurídica e consultoria (RN32). | Must | [Validado] — lista completa em P06 |
| RF25 | Associado acessa os benefícios conforme a regra de cada grupo (RN32) e solicita suporte. | Should | [A confirmar] — depende da P06 e da P15 |

### 4.7 Cancelamento

| **ID** | **Requisito** | **Prioridade** | **Status** |
| --- | --- | --- | --- |
| RF26 | Associado solicita cancelamento pelo app; antes de confirmar, o sistema mostra os benefícios e o suporte que ele perderá. | Must | [Validado] |
| RF27 | Sede recebe notificação da solicitação e pode recusá-la em até 15 dias. Sem recusa, o cancelamento é confirmado automaticamente, e a cobrança deixa de ser gerada (RN18). | Must | [Validado] |

### 4.8 Cobrança formal (universo CNAE)

| **ID** | **Requisito** | **Prioridade** | **Status** |
| --- | --- | --- | --- |
| RF28 | Importar a base de associados a partir do arquivo da JUCEMAT (provavelmente XML, filtrado pelo CNAE), que traz o e-mail das farmácias. | Should | [A confirmar] — formato e frequência em P02 |
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
| RNF08 | Integração de pagamento via API do Sicredi (conta já existente do cliente; custos do Sicredi pagos pelo sindicato). Ainda não há convênio de cobrança: no MVP, a cobrança funciona em simulação, até o sindicato decidir em reunião e pedir o acesso à API (O3). | [Validado] |
| RNF09 | Envio de e-mail transacional com volume compatível com ~2.000 destinatários (cobrança formal), com envio escalonado se necessário. | [Validado] |
| RNF10 | Dados do cliente: nenhum dado real (CNPJs, e-mails, XML da JUCEMAT, credenciais do Sicredi, contrato e dados do termo de parceria) é versionado no repositório, que é público. Seeds, testes e demonstrações usam dados fictícios. | [Validado] |

## 6. Backlog

As user stories (US01 a US39) são mantidas como issues no GitHub Projects da organização ("Elo Connect - MVP"), que é a fonte oficial do backlog. Cada issue traz o ID da história e os requisitos funcionais (RF) que ela atende, e usa labels de prioridade (MoSCoW), épico e status ("a confirmar").

## 7. Observações técnicas

**O1 — Verificação na criação da conta.** O cliente havia pedido a confirmação de 5 dígitos do CNPJ para garantir a identidade. O CNPJ é um dado público (consultável na Receita Federal), então pedir dígitos dele não comprova identidade e cria atrito para o público idoso. No questionário (resposta 3), o cliente disse preferir o login pelo CNPJ, com um código temporário enviado ao e-mail do cadastro, e aceitou como alternativa a sugestão do grupo: o CNPJ só na criação da conta, com confirmação por e-mail. Decisão do grupo (27/10/2026): o login continua com e-mail e senha (RF02); na criação da conta, a pessoa informa o CNPJ e recebe, no e-mail que já está no cadastro do sindicato, um link para criar a senha (RN21, RF05). Quem abre o link prova que lê o e-mail da farmácia. A decisão precisa ser comunicada ao cliente (P08).

**O2 — Conciliação de pagamento (baixa).** Como o desbloqueio automático foi validado (RN10), a baixa precisa ser automática. Duas formas: (1) webhook — o Sicredi avisa o sistema quando o boleto/Pix é pago; (2) polling — o sistema consulta a API do Sicredi periodicamente (ex: a cada hora). Webhook é imediato; polling é mais simples de implementar e testar. Verificar na documentação da API de Cobrança do Sicredi qual opção está disponível.

**O3 — Integração Sicredi.** O sindicato tem conta no Sicredi, mas não tem convênio de cobrança, que é o contrato com o banco para emitir boletos (resposta 25). O convênio e o acesso à API de Cobrança serão pedidos se necessário, depois de uma reunião do sindicato (resposta 26). Até lá, a cobrança funciona em simulação, com o mock do gateway (M3). Falta saber como o Sicredi cobra as tarifas (por boleto emitido ou só por boleto pago; pergunta 27, em branco), porque isso afeta o custo do envio mensal e reforça a decisão de não emitir boleto para as ~2.000 farmácias.

**O4 — Envio de e-mail em massa.** Serviços gratuitos de e-mail transacional costumam ter limite diário de envios. O comunicado para ~2.000 farmácias pode exigir envio escalonado em alguns dias ou um plano pago de baixo custo. Verificar os limites atuais do serviço escolhido.

**O5 — Tecnologia de front-end.** Decidida no ADR-001 (aceito em 09/10/2026): React + Vite na web, React Native/Expo no app, NestJS no back-end, em monorepo TypeScript. O PI não exige nem restringe tecnologia; a escolha fica a critério do grupo.

**O6 — Adimplente/inadimplente sem tipos de usuário.** O cliente pediu para não separar associado e afiliado. Por isso há um único perfil de associado, e adimplente/inadimplente é apenas um status que libera ou bloqueia benefícios. Ainda assim, o sistema precisa saber quem aderiu à contribuição: sem o atributo interno "contribuição ativa", os ~1.850 associados que nunca contribuíram seriam tratados como inadimplentes com boleto em aberto e receberiam boletos e lembretes a cada 48h. O nome interno é decisão do grupo; o que importa é o que aparece na tela. No painel da sede, o atributo aparece como filtro com o rótulo "Recebe boleto mensal: sim/não". Para o associado que não está em dia e não contribui, a tela mostra "Sem contribuição ativa", e não "Inadimplente", texto aprovado pelo cliente na resposta 8 (RN22).

**O7 — Entrada automática, saída aprovada.** Seguindo o princípio de não criar processos manuais (RN27), a adesão à cobrança recorrente é feita pelo próprio associado e ativada automaticamente (RN23). O cancelamento continua passando pela sede (RN18), que já hoje usa esse momento para tentar reter o associado, mas sem prender o pedido: sem recusa em 15 dias, ele é confirmado sozinho. A sede também pode interromper a cobrança por conta própria (RN25), e tudo o que os usuários da sede fazem fica no log de auditoria (RN26). Os ~150 associados que já pagam entram por importação inicial, não por marcação manual um a um. Como não existe lista deles (resposta 42), o grupo monta uma planilha modelo para a sede preencher, e o sistema a importa (RF42).

**O8 — Contadores sem conta própria.** Pela RN29, o sistema não tem perfil nem convite para contador, o que mantém um único perfil de associado (RN22) e evita um fluxo extra de cadastro. Consequências: o contador vê o mesmo que o associado (se ele estiver inadimplente, só as informações gerais das convenções) e consegue fazer o mesmo que ele (pedir boleto, aderir à cobrança recorrente, solicitar cancelamento). A recuperação de senha vai para o e-mail do associado. O sistema não tem como distinguir o contador do associado nos registros.

## 8. Pendências

Os números de pergunta e de resposta são os do questionário de 14/10/2026 ([Registro da Entrevista](registro-entrevista.md), seção 8). As pendências respondidas ficam na tabela, para manter o histórico.

| **ID** | **Pergunta / ação** | **Com quem** | **Impacto** |
| --- | --- | --- | --- |
| P01 | Respondida (27 e 28/10): a validade de 30 dias conta do vencimento; depois disso, o boleto expira e os benefícios são bloqueados (respostas 10 e 13), e os meses em aberto vão para um boleto só (resposta 14). Depois do vencimento, o lembrete passa a ser semanal e para quando o boleto expira (resposta 15, RN07). | Cliente | RF14, histórico |
| P02 | Respondida em parte (27/10): o arquivo da JUCEMAT traz o e-mail das farmácias (resposta 40). Falta: formato (provavelmente XML), frequência e forma de recebimento, que o sindicato vai levantar com a JUCEMAT. Um exemplo do layout, sem dados reais, já permite começar a importação. | Cliente | RF28, RF29 |
| P03 | Respondida (27/10): a farmácia entra no cadastro pela sede, a pedido dela, e cria a conta pelo CNPJ (respostas 1 a 3, RN21); o primeiro boleto sai na hora, com o valor cheio (resposta 18, RN23). | Cliente | RF05, RF36 |
| P04 | O associado do plano anual fica fora do lote mensal? Como é a renovação no fim do ano? Se o valor mudar no meio do ano, o que acontece com quem já pagou? (pergunta 21, em branco; relação com a assessoria jurídica em P15) | Cliente | RF17, RF10 |
| P05 | O que significa "se registrar em uma convenção" na prática (inscrição em assembleia, evento, outro)? (pergunta 34, em branco) | Cliente | RF23 |
| P06 | Respondida em parte (27/10): os benefícios ficam em dois grupos, assessoria jurídica e consultoria (resposta 9, RN32). Falta a lista completa (pergunta 35, em branco). | Cliente | RF24, RF25, landing page |
| P07 | LGPD e tratamento de dados cadastrais e financeiros. | Prof. Poli | RNF05 |
| P08 | Comunicar ao cliente a decisão sobre a criação de conta: o login continua com e-mail e senha, e o CNPJ entra só na criação da conta, com um link enviado ao e-mail do cadastro (a alternativa que ele aceitou na resposta 3; O1). | Cliente | RF05, RN21 |
| P09 | Respondida (27/10): não existe lista dos associados que já pagam; tudo é feito à mão (resposta 42). O grupo monta uma planilha modelo para a sede preencher (RF42). | Cliente | RF42, implantação |
| P10 | Respondida em parte (28/10, resposta 20; RN24 e RN30). Falta: (a) o boleto avulso pedido depois do dia 10 vence no dia 10 do mês seguinte? (b) a resposta diz que os benefícios ficam liberados até vencerem 2 boletos seguidos; quem paga só um mês, sem cobrança recorrente, não recebe boleto todo mês: ele fica liberado até quando? | Cliente | RN24, RN30, RF37, RF16 |
| P11 | Responsabilidade pelo compartilhamento do acesso com o contador (RN29): um aviso com caixa de aceite no primeiro cadastro basta, ou é preciso um termo de uso formal? O sistema deve registrar data/hora do aceite? Permitir o compartilhamento de credenciais entra em conflito com a LGPD para os dados financeiros do associado? | Prof. Poli | RN29, RF04, RNF05 |
| P12 | Quanto o sindicato pode gastar por mês com hospedagem e envio de e-mail em produção? A demonstração do PI usa o plano grátis da Vercel, que é só para uso não comercial e por isso não serve para o sistema em produção. | Cliente | Hospedagem e e-mail de produção (decisoes-tecnicas.md), RNF09 |
| P13 | O que a inativação de um associado muda? A conta de acesso dele continua entrando? A cobrança recorrente para? A sede pode reativar um associado inativado (por exemplo, depois de uma inativação por engano)? | Cliente | RF08 |
| P14 | Matriz e filiais (resposta 4): a conta da matriz vê e paga os boletos das filiais? O acesso a benefícios de cada filial depende do pagamento dela ou do da matriz? | Cliente | RN31, RF43 |
| P15 | Benefícios (resposta 9): "ano inteiro antecipado" para a assessoria jurídica quer dizer o plano anual pago à vista ou 12 meses já pagos? A consultoria começa quando o primeiro boleto é emitido ou quando ele é pago? | Cliente | RN32, RF17, RF25 |
| P16 | Primeiro boleto da adesão (resposta 18): ele sai na hora, mas qual é o vencimento dele? | Cliente | RN23, RF36 |
| P17 | Respondida (28/10): a liberação manual vale 1 semana, com um aviso na conta do associado (resposta 11, RN11). | Cliente | RF09 |
| P18 | Respondida (28/10): a sede pode trocar o e-mail da conta (resposta 6, RN34), e o contador entra em cada farmácia separadamente (resposta 5). Quando o mesmo e-mail está no cadastro de mais de uma farmácia, a sede troca o de uma delas. | Cliente | RF05, RN29 |
| P19 | Qual e-mail recebe os pedidos de cadastro (resposta 2) e de qual endereço o sistema envia os e-mails (pergunta 46, em branco)? | Cliente | RF01, envio de e-mail |
| P20 | Respondida (28/10, conversa por vídeo): a revisão do lote sai. Os boletos são gerados e enviados sozinhos no primeiro dia útil, e a sede pode editar o boleto do mês seguinte, com aviso por e-mail na hora (RN04, RF10, RF11). A mesma conversa respondeu à pergunta 23: o aviso de mudança de valor sai na hora (RN15). | Cliente | RN04, RN15, RF10, RF11 |
| P21 | Texto do termo de adesão à cobrança recorrente, que os advogados do sindicato vão escrever (resposta 19). | Cliente | RN23, RF36 |
| P22 | O sindicato pediu um exemplo de termo de adesão para os advogados usarem de base (resposta 19). O grupo pode indicar um modelo? Que cuidados isso exige? O aceite do compartilhamento do acesso com o contador (P11) pode entrar no mesmo termo? | Professores | RN23, RN29, RF36 |
| P23 | Qual é o valor atual da contribuição mensal? O plano anual é o valor de 12 meses com 20% de desconto? (pergunta 22, em branco) Enquanto não houver resposta, a sede digita o valor mensal, e o sistema calcula o anual assim. | Cliente | RF18, RN13, RF17 |
| P24 | Em que formato chegam os documentos da convenção (PDF, planilha, outro)? Além do resumo, há algum conteúdo que sempre é publicado, como a tabela de reajuste? Os PDFs costumam passar de 4 MB? (pergunta 39, em branco; o envio pelo sistema tem esse limite por enquanto) Enquanto não houver resposta, a convenção tem o resumo em texto e os dois PDFs, e a tabela de reajuste espera. | Cliente | RF21, RF22 |
