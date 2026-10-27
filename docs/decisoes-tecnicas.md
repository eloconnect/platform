# Elo Connect — Decisões de Escopo e Técnicas

Última atualização: 27/10/2026.

Documentos relacionados: [Requisitos](requisitos.md) (regras de negócio, requisitos e pendências detalhadas), [Registro da Entrevista](registro-entrevista.md), [ADR-001](adr/0001-tecnologia-frontend.md) (tecnologia de front-end), [ADR-002](adr/0002-biblioteca-componentes.md) (biblioteca de componentes) e o backlog no GitHub Projects da organização.

## Nome

- Nome do projeto: **Elo Connect**

## Terminologia (definida pelo cliente)

- **Associado**: qualquer farmácia/drogaria do universo do sindicato em MT (~2.000), identificada pelo CNAE. Não é obrigada a pagar. É o único tipo de usuário do lado do cliente.

- **Adimplente**: associado com a contribuição em dia. Acessa benefícios, suporte e inscrição em convenções.

- **Inadimplente**: associado que não está em dia (boleto vencido e não pago, ou que não contribui). Vê apenas as informações gerais das convenções.

- **Contribuição ativa** (atributo interno do cadastro, nome técnico livre): marca os associados com cobrança recorrente (~150) e define quem recebe boleto e lembretes. É ativada pelo próprio associado ao pedir a cobrança recorrente no app. Não é um tipo de usuário e não aparece para o associado. No painel da sede, aparece como filtro com o rótulo "Recebe boleto mensal: sim/não".

- **Contador**: não é tipo de usuário. O contador de uma farmácia acessa o sistema com a conta do associado (ver Acesso).

- Decisão do cliente: não usar a separação entre "associado" e "afiliado". O termo "afiliado" foi abandonado e a separação é feita por adimplente/inadimplente.


## Escopo do MVP (fase atual)

- Aplicação **web**, responsiva (web mobile).

- Princípio do projeto: automatizar processos sem criar novos processos manuais.

- Perfis: **administrador** (equipe da sede, 3 pessoas), **associado** (perfil único, com acesso conforme o status adimplente ou inadimplente) e visitante (landing page).

- Funcionalidades do MVP [validadas]:

  - Landing page pública com o que o sindicato oferece, login e cadastro.

  - Cadastro/gestão de associados, com status (adimplente / inadimplente / cancelamento solicitado) e perfil completo rastreável pela sede.

  - **Cobrança mensal via Sicredi**: o sistema gera o lote de boletos (com Pix QR Code), um administrador revisa/edita e envia com um único botão, **só para associados com contribuição ativa**.

  - Adesão à cobrança recorrente pelo próprio associado no app, ativada automaticamente (sem aprovação da sede); o associado também pode pagar apenas um mês (boleto avulso).

  - A sede pode interromper a cobrança recorrente de qualquer associado.

  - Vencimento fixo (dia 10 de todo mês), validade do boleto de 30 dias.

  - Lembretes automáticos: 48h antes do vencimento e a cada 48h após o vencimento.

  - Sem juros e sem multa por atraso (decisão do cliente).

  - Bloqueio automático e imediato de benefícios/suporte após o vencimento sem pagamento; desbloqueio automático após o pagamento; controle manual pelo admin.

  - Painel de valores (só admin): valor único para todos, plano anual à vista com 20% de desconto, reajuste a cada 5 anos para todos; toda alteração gera e-mail de aviso, vale para o próximo boleto e fica em histórico.

  - Central de convenções coletivas (conteúdo atualizado por funcionário da sede); inadimplente vê informações gerais, mas não se inscreve.

  - Feed de notícias num ponto único, publicado pela sede e visível a qualquer associado logado (adimplente ou inadimplente); visitantes não acessam.

  - Módulo de benefícios separado do de convenções (lista de benefícios a definir em reunião futura do cliente).

  - Cancelamento pelo app: mostra os benefícios que serão perdidos, a sede valida.

  - Cobrança formal obrigatória a todos os associados (~2.000) por e-mail, **sem boleto**.

  - Histórico imutável de transações (data/hora, identificador do boleto, valor, status), usado como prova em divergências; exportação em PDF/CSV.

  - Log de auditoria imutável de todas as ações dos usuários da sede (quem, o quê, quando, valor anterior e novo), com consulta por filtros.

- Fora do escopo desta entrega: chatbot WhatsApp [confirmado pelo cliente], app mobile nativo, módulos de gestão fiscal/contábil.

- Em avaliação: importação automática da base de associados via XML da JUCEMAT (depende da pendência P02).

## Roadmap (18 meses, 3 semestres)

- **Semestre atual**: MVP web (cobrança automática + centralização de informações).

- **Próximo semestre**: app mobile nativo, com a web mobile já responsiva.

- **Último semestre**: chatbot WhatsApp + integração com IA.

## Stack

Decidida no ADR-001 (aceito pelo grupo em 09/10/2026). O PI não exige nem restringe tecnologia: a escolha fica a critério do grupo, conforme o que o cliente precisa e o que a equipe consegue manter.

- Front-end web: **React + Vite** (TypeScript). Flutter foi avaliado e descartado, por causa da acessibilidade web limitada (canvas) e da necessidade de outra tecnologia para a landing page.

- App mobile (próximo semestre): **React Native com Expo**.

- Back-end: **Node.js + NestJS** (TypeScript). Plano B, se o TypeScript no back-end virar gargalo: Laravel apenas como API.

- Banco de dados: **PostgreSQL** — dados relacionais (associado → boleto → pagamento → convenção).

- Organização: monorepo com apps/web, apps/api, packages/shared (tipos, validações e cliente da API) e, depois, apps/mobile.

- Biblioteca de componentes: **React Bootstrap**, com tema próprio em Sass para o público idoso (fonte base de 18px, cores com contraste acima do AA, foco bem visível). Decidida no [ADR-002](adr/0002-biblioteca-componentes.md).

- Hospedagem: volume estimado de até ~2.000 associados, ~150 com contribuição ativa e menos de 400 acessos mensais. Estudo de 20 a 24/10/2026 (#28):

  - **Demonstração do PI** (entrega até o fim de 2026): **Vercel** no plano grátis (Hobby) para as telas e a API, e **Neon** (Postgres grátis, sem prazo de validade) para o banco, só com dados fictícios. A Vercel roda o NestJS como uma função, sem configuração. As tarefas agendadas (lote mensal e lembretes) vão usar os Cron Jobs da Vercel. Quando houver provedor de e-mail (P12), a API precisa do `waitUntil` para o e-mail enviado depois da resposta. Como a demonstração está configurada: [deploy.md](deploy.md). Os PDFs das convenções (RF21) ficam no Vercel Blob, numa área privada servida pela API, com 1 GB grátis.
  - **Produção** (sistema do cliente): o plano grátis da Vercel é só para uso pessoal e não comercial, então não serve. A hospedagem de produção depende de quanto o sindicato pode gastar por mês (P12).
  - Avaliados e descartados: Render (o plano grátis dorme depois de 15 minutos sem acesso e leva cerca de 1 minuto para acordar, e o Postgres grátis expira em 30 dias), Koyeb (sem plano grátis para contas novas desde fevereiro de 2026, segundo fontes de terceiros) e Supabase (pausa o banco depois de 7 dias sem uso).

- E-mail transacional: em produção, um provedor com plano grátis e SMTP, porque a API envia por SMTP (Nodemailer). Pesquisa de 23/10/2026 (os limites mudam; conferir antes de contratar):

  - **Brevo**: 300 e-mails por dia (cerca de 9.000 por mês), com SMTP e sem prazo de validade. Os e-mails do plano grátis levam a marca do Brevo.
  - **Mailjet**: 200 por dia (6.000 por mês), com SMTP e sem cartão.
  - **Resend**: 100 por dia (3.000 por mês). O SMTP exige domínio verificado.
  - **Gmail pessoal**: cerca de 500 destinatários por dia, mas o remetente seria um endereço @gmail.com, a senha de app dá acesso à caixa inteira e a conta pode ser bloqueada por envio automático. Descartado.
  - **Google Workspace**: 2.000 e-mails por usuário por dia (ou até 10.000 pelo SMTP relay). É pago, então só faz sentido se o sindicato já usar o Workspace.
  - SendGrid e Amazon SES não têm plano grátis permanente.

  Recomendação: **Brevo**, pelo maior limite diário. O limite vale para todos os envios, então a cobrança formal aos ~2.000 associados (RNF09) precisa ser escalonada em vários dias, deixando folga diária para os e-mails urgentes (recuperação de senha, boletos e lembretes). A escolha final fica junto com a hospedagem de produção (P12).

  Depende de um domínio do sindicato (ou do projeto) com acesso ao DNS, para configurar SPF e DKIM e o remetente `nao-responda@<domínio>` (perguntar ao cliente). Pergunta para os professores (P07): o provedor recebe nome e e-mail dos associados; que cuidados de LGPD isso exige? A chave ou senha do provedor fica só nas configurações da hospedagem, nunca no repositório.

## Ambiente e ferramentas

Decididas no setup inicial do repositório (09/10/2026):

- Gerenciador de pacotes: **pnpm** (workspaces). Scripts de instalação de dependências precisam ser aprovados com `pnpm approve-builds`; a lista de aprovados fica no `pnpm-workspace.yaml`. A versão do pnpm vem do campo `packageManager` do `package.json` e é ativada com `corepack enable`, porque o pnpm não troca de versão sozinho (ver `pmOnFail` em Segurança do repositório).

- Node.js **24 (LTS)**, fixado no `.nvmrc`, a partir da **24.22.1**, que traz as correções de segurança de 20/10/2026 (entre elas, a do decodificador Brotli, que o Express usa para descomprimir o corpo das requisições). A versão mínima fica no `engines` do `package.json`, e o `engineStrict` do `pnpm-workspace.yaml` faz o `pnpm install` recusar versões mais antigas. O CI usa sempre a 24.x mais recente (`check-latest`).

- TypeScript **6**, fixado. O TypeScript 7 (novo compilador nativo) ainda não tem compatibilidade garantida com o NestJS CLI, o Jest e as ferramentas de lint.

- API: NestJS em **ESM com Jest** (`"type": "module"` no `package.json` da API). Até 26/10/2026 a API era CommonJS, mas o NestJS 12 é distribuído só em ESM e o carregador de funções da Vercel não aceita `require()` de módulo ESM, então a API caía ao iniciar. Consequências: os imports relativos terminam em `.js`, mesmo nos arquivos `.ts` (sem a extensão, o build falha); nos testes, o `jest` vem de `import { jest } from '@jest/globals'`; e o client do Prisma é gerado em ESM. O `packages/shared` continua compilando em CommonJS, que a API importa sem problema.

- Convenções da API: prefixo global `/api`; CORS liberado para o front em desenvolvimento (`http://localhost:5173`); variáveis de ambiente lidas do `.env` via `ConfigModule`; validação global de entrada com `ValidationPipe`. O `GET /api/health` também verifica a conexão com o banco.

- Acesso ao banco (ORM): **Prisma 7**. Alternativa avaliada: TypeORM. Motivos da escolha: schema legível num arquivo único, tipagem forte gerada a partir do schema e migrations simples. O Prisma 8 foi descartado por estar em release candidate; o Prisma 7 recebe suporte por 18 meses após o lançamento oficial do 8, o que cobre a duração do PI. A conexão usa o `@prisma/adapter-pg`, acessada pela API através de um `PrismaService`. O client é gerado automaticamente no `postinstall`, em `apps/api/src/generated/prisma`, e fica fora do Git.

- Modelo de dados: documentado em [Modelo de Dados](modelo-dados.md) (DER em Mermaid, decisões e pendências). Nomes de tabelas e colunas em português, iguais ao glossário. Situação do associado armazenada (`situacao`), com override manual separado (`acessoManual`). Histórico de valores, transações e log de auditoria são imutáveis por triggers no banco.

- Migrations e seed: migrations versionadas em `apps/api/prisma/migrations` (a primeira é a `init`). O seed (`apps/api/prisma/seed.ts`, executado com `tsx`) cria só dados fictícios. No Prisma 7, o `migrate reset` não roda o seed sozinho, por isso o script `db:reset` chama os dois.

- Hash de senha: **argon2id**, com o pacote `@node-rs/argon2` (binários prontos, sem compilação na instalação), conforme o RNF04. O seed já usa esse pacote, e o login (US03) deve usar o mesmo.

- Sessão: **JWT** válido por 1 hora, enviado no cabeçalho `Authorization: Bearer <token>`. No web, o token fica no `sessionStorage`. O mesmo formato serve para o app mobile do próximo semestre.

- Banco local: **PostgreSQL 17 no Docker Compose** (`docker-compose.yml` na raiz), com credenciais só de desenvolvimento. As portas do banco e do Mailpit ficam presas ao `127.0.0.1`: só a própria máquina acessa, porque as senhas de desenvolvimento estão no repositório público.

- E-mail em desenvolvimento: **Mailpit** no Docker Compose, com a versão fixada. Ele recebe os e-mails da API (SMTP na porta 1025) e mostra numa caixa de entrada em `http://localhost:8025`. Não reenvia nada para fora e não guarda as mensagens depois que o container para. O `.env.example` já aponta o SMTP para ele, e o `pnpm bootstrap` acrescenta ao `.env` as variáveis novas do exemplo, sem mexer nas que já existem.

- CI: **GitHub Actions** (`.github/workflows/ci.yml`), em todo PR para o `main`, em todo push no `main` e toda segunda-feira. Instala com o lockfile travado e roda a auditoria das dependências de produção (`pnpm audit --prod`, a partir de moderada), lint, formatação, build, testes e os testes e2e da API num Postgres 17 descartável. O check é obrigatório no ruleset do `main`. Não há filtro para PRs só de documentação, porque um check obrigatório que não roda deixa o PR travado.

- Lint e formatação: **oxlint** (com regras de React e jsx-a11y) e **Prettier** no monorepo inteiro, com hooks de commit (husky, lint-staged e commitlint). Arquivos Markdown ficam fora do Prettier. Detalhes no CONTRIBUTING.

- Segurança do repositório: secret scanning com push protection (o push com credencial é bloqueado), Dependabot e auditoria das dependências no CI. O pnpm 12 grava no começo do `pnpm-lock.yaml` uma parte só com a versão do próprio pnpm, e o grafo de dependências do GitHub, de onde vêm os alertas do Dependabot, lê apenas essa parte. Por isso, o `pnpm-workspace.yaml` usa `pmOnFail: ignore`, que mantém o lockfile num documento só. A auditoria no CI (`pnpm audit --prod`, que também roda toda segunda-feira) fica como segunda proteção. As atualizações comuns (`.github/dependabot.yml`) chegam uma vez por mês, num PR por ecossistema, sem versões major, porque TypeScript 6, Prisma 7 e Node 24 são fixados de propósito.

- Ambiente de desenvolvimento: o projeto fica no sistema de arquivos do WSL (ex.: `~/projetos`), não em `/mnt/c`, por desempenho.

- Pastas de instruções para ferramentas de IA geradas automaticamente por pacotes (ex.: `.claude/`, `.agents/`, `.windsurf/`) não entram no repositório.

## Repositório e dados do cliente

- Código no GitHub em `eloconnect/platform`, **público**. Backlog no Project "Elo Connect - MVP" da organização.

- Nenhum dado real do cliente entra no repositório: CNPJs, e-mails, XML da JUCEMAT, credenciais do Sicredi, contrato e dados cadastrais do termo de parceria. Seeds, testes e demonstrações usam dados fictícios.

- O contrato entre a faculdade e o cliente já foi firmado, e os dados cadastrais do termo de parceria foram coletados à parte. Ficam fora do repositório e destes documentos.

- Estes documentos ficam na pasta `docs/` do repositório (desde 10/10/2026). O ADR fica em `docs/adr/`. O snapshot do backlog não entra no repositório, porque a fonte oficial é o Project.

## Cobrança (Sicredi)

- Gateway: **Sicredi** [validado] — o sindicato já tem conta e prefere usá-la; os custos do Sicredi são pagos pelo sindicato.

- Boleto + Pix QR Code no MVP [validado].

- A fazer pelo cliente: solicitar à cooperativa o acesso à API de cobrança (credenciais/convênio).

- A confirmar: modelo de tarifa (por boleto emitido ou só por boleto pago).

- A estudar: baixa automática do pagamento via webhook (o Sicredi avisa o sistema) ou polling (o sistema consulta a API periodicamente) — necessária porque o desbloqueio automático foi validado.

- O boleto nunca é enviado a todos os ~2.000 associados, só aos que têm contribuição ativa (evita custo de emissão).

## Acesso

- Login com e-mail + senha [validado].

- Recuperação de senha por link enviado ao e-mail [validado].

- Confirmação de 5 dígitos aleatórios do CNPJ apenas no primeiro cadastro, junto com confirmação por e-mail [validado]. O CNPJ é público, então não serve como verificação a cada login. Comunicar o ajuste ao cliente, que havia pedido a verificação para garantir a identidade.

- Contadores não têm conta própria [validado]. O contador acessa com o e-mail e a senha da conta do associado; se o dono da farmácia não quiser consultar pessoalmente, ele compartilha o próprio acesso. O compartilhamento é responsabilidade exclusiva do titular da conta, e toda ação feita com esse login é considerada ação do associado (RN29). A forma de deixar isso explícito para o associado depende da pendência P11.

## IoT

- Exigência do curso (confirmada), ainda não incorporada ao escopo atual do MVP.

- Restrição prática: os alunos não moram na cidade do cliente qualquer solução de IoT precisa ser validada remotamente (protótipo testado localmente + demonstração por vídeo), não instalada fisicamente na sede.

## Pendências

### Com o cliente

- P01: o que acontece após os 30 dias de validade do boleto (cancela, acumula, lembretes param?).

- P02: o XML da JUCEMAT traz e-mail das farmácias? Frequência e forma de recebimento.

- P03: qualquer associado pode criar conta? Ao pedir a cobrança recorrente, o primeiro boleto sai na hora ou no próximo lote mensal?

- P04: o plano anual fica fora do lote mensal? Como é a renovação?

- P05: o que significa "se registrar em uma convenção" na prática.

- P06: lista de benefícios (reunião futura do cliente).

- P09: em que formato está a lista atual dos ~150 associados que já pagam (para a carga inicial)?

- P10: regras do boleto avulso (geração, vencimento, lembretes e período de acesso aos benefícios).

- P12: quanto o sindicato pode gastar por mês com hospedagem e envio de e-mail em produção.

- P13: o que a inativação de um associado muda (conta de acesso e cobrança recorrente) e se a sede pode reativá-lo.

### Com os professores

- P07: LGPD e tratamento de dados cadastrais e financeiros.

- P11: como registrar a responsabilidade do titular pelo compartilhamento do acesso com o contador (aviso com aceite no cadastro ou termo de uso formal).

- Orientação sobre os aspectos jurídicos/trabalhistas do projeto se necessário
