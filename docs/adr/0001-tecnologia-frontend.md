# ADR-001: Tecnologia de front-end do Elo Connect

Web, web mobile e app nativo.

**Status:** Aceito
**Data:** 04/10/2026 (aceito em 09/10/2026)
**Decisores:** grupo do PI

Documentos relacionados: [Requisitos](../requisitos.md), [Decisões Técnicas](../decisoes-tecnicas.md).

## Contexto

O projeto dura 18 meses e precisa entregar três frentes: web desktop, web mobile e app nativo. A web é a primeira entrega e continua existindo depois, porque o painel administrativo da sede é web.

O PI não exige nem restringe tecnologia. A escolha fica a critério do grupo, conforme o que o cliente precisa e o que a equipe consegue manter.

O público é majoritariamente idoso, então acessibilidade e recursos do navegador pesam muito: zoom, preenchimento automático de senha, tradução e leitor de tela. A landing page pública já foi validada com o cliente.

A equipe conhece PHP/Laravel e Bootstrap, está aprendendo TypeScript e sabe pouco de React. O back-end discutido é NestJS (TypeScript). A carga é pequena: até ~2.000 associados e menos de 400 acessos por mês. Então "escalar" aqui significa crescer em módulos e manutenção, não em tráfego.

## Decisão

O grupo decidiu **não usar Flutter** e adotar **TypeScript de ponta a ponta**:

- React (com Vite) na web
- React Native (com Expo) no app, a partir do próximo semestre
- NestJS no back-end
- Tudo num monorepo, com um pacote compartilhado de tipos, validações e cliente da API

## Opções consideradas

### Opção A: Flutter (web + mobile) + NestJS

| Dimensão | Avaliação |
|---|---|
| Complexidade | Média. Dart é uma linguagem nova, e o projeto fica com duas linguagens (Dart + TS). |
| Custo | Zero |
| Escalabilidade | Boa |
| Familiaridade | Nenhuma |
| Acessibilidade web | Fraca para este público |

**Prós:** um único código de interface para web e mobile, e um app mobile excelente.

**Contras:**

- **Acessibilidade fica desligada por padrão.** O Flutter desenha a tela num canvas e, por questões de desempenho, a acessibilidade web não vem ligada; para ativá-la, o usuário precisa acionar um botão invisível ("Enable accessibility"). Dá para ativar via código, mas o problema de fundo continua: o canvas não se comporta como uma página comum, e recursos do navegador que idosos usam (seleção de texto, gerenciador de senhas, tradução) tendem a funcionar pior.
- **A landing page teria de ser feita em outra tecnologia.** A própria documentação do Flutter diz que ele hoje não é adequado para sites estáticos com conteúdo rico em texto, e recomenda separar a experiência principal do app da landing page e do conteúdo de ajuda, feitos em HTML.

### Opção B: React (web) + React Native/Expo (mobile) + NestJS, em monorepo

| Dimensão | Avaliação |
|---|---|
| Complexidade | Média |
| Custo | Zero |
| Escalabilidade | Boa |
| Familiaridade | Baixa, mas o TypeScript que a equipe já estuda vale para tudo |
| Acessibilidade web | Boa (HTML real) |

**Prós:**

- Uma linguagem só em todo o projeto.
- Os tipos e validações (por exemplo, a regra de boleto) são escritos uma vez e usados no front, no app e na API.
- HTML nativo: zoom, autofill, leitor de tela e tradução funcionam sem esforço extra.
- A landing page sai na mesma tecnologia.
- O conhecimento de React é reaproveitado no React Native.
- É a stack com mais material em português e mais vagas no mercado.

**Contras:** são duas bases de interface, uma web e uma mobile.

O custo dessa duplicação é menor do que parece. O painel admin (gestão, lote mensal, valores, auditoria) fica só na web. O app nativo atende só o associado: boleto/Pix, histórico, notícias, convenções, benefícios e cancelamento, cerca de 8 a 10 telas.

### Opção C: Expo universal (um código React Native gerando web e mobile)

**Prós:** uma base de interface só, e a web renderiza HTML de verdade, melhor que o canvas do Flutter.

**Contras:** o painel admin, cheio de tabelas, filtros e formulários densos, é desconfortável de construir com componentes React Native na web. Além disso, há menos bibliotecas de componentes web para isso. Serve se a equipe priorizar código único acima de tudo.

### Opção D: Laravel + Blade/Bootstrap

**Prós:** é onde a equipe já é produtiva, e o MVP do semestre atual sairia mais rápido.

**Contras:** as telas em Blade não são reaproveitadas no app nativo. No segundo semestre seriam necessárias uma API, uma nova tecnologia de front e a reescrita do que for compartilhado. Isso adia o aprendizado em vez de evitá-lo.

## Análise de trade-offs

O argumento mais forte do Flutter é ter um só código de interface. Ele perde força aqui por três motivos:

1. A web, que é exatamente onde o Flutter é mais fraco, é a parte mais importante do sistema.
2. O público é o que mais sofre com essas fraquezas.
3. A landing page exigiria uma segunda tecnologia de qualquer forma.

O argumento mais forte da opção B é a linguagem única com tipos compartilhados. Num projeto de 18 meses com regras de negócio que mudam (valor, reajuste, plano anual), escrever a regra uma vez evita divergência entre web, app e API.

Quanto à curva de aprendizado, Flutter e React partem do zero para a equipe. A diferença é que, no Flutter, o Dart só serve para o Flutter.

Uma observação sobre o back-end: NestJS e Laravel são uma decisão separada. Se o TypeScript no back-end virar um gargalo, usar Laravel apenas como API é um plano B razoável. A perda seria só o compartilhamento de tipos com o front.

## Consequências

- **Fica mais fácil:** acessibilidade, landing page, reaproveitar regras e tipos, achar material de estudo, e manter tudo com uma linguagem.
- **Fica mais difícil:** manter duas interfaces, e montar o monorepo no início (exige configuração inicial).
- **A revisitar:**
  - Se o SEO da landing page passar a importar, migrar a web de Vite para Next.js.
  - Se o app crescer muito, reavaliar a opção C.
  - Antes de iniciar o app nativo, confirmar a escolha do React Native/Expo com base na experiência do grupo com React no MVP.
  - Antes de escolher hospedagem para o front, verificar os termos dos planos gratuitos. Alguns proíbem uso comercial, e este é um cliente real.

## Ações

1. Fazer um spike de 1 semana: tela de login e lista de associados em React + Vite consumindo um endpoint NestJS, para medir a curva real de aprendizado do grupo.
2. Montar a estrutura do monorepo: `apps/web`, `apps/api`, `packages/shared` (com `apps/mobile` no próximo semestre). Feito em 09/10/2026 (`packages/shared` e `apps/api`; `apps/web` ainda não iniciado).
3. Escolher uma biblioteca de componentes acessível. React Bootstrap aproveita o que a equipe já sabe; Mantine é outra opção.
4. Registrar esta decisão em `docs/decisoes-tecnicas.md` e mudar o status para "Aceito". Feito em 09/10/2026.

## Referências

- Flutter — Web accessibility: https://docs.flutter.dev/ui/accessibility/web-accessibility
- Flutter — Web FAQ: https://docs.flutter.dev/platform-integration/web/faq
