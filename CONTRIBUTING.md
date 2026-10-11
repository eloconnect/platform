# Como contribuir

Guia de trabalho da equipe do Elo Connect. Leia antes de abrir a primeira branch.

## Resumo

1. Pegue uma issue do [Project "Elo Connect - MVP"](https://github.com/orgs/eloconnect/projects/1) que **não** tenha o label `a-confirmar`.
2. Atribua a issue a você e mova para **In Progress**.
3. Crie uma branch a partir do `main` atualizado.
4. Faça commits pequenos, no padrão [Conventional Commits](#commits).
5. Abra um Pull Request com `Closes #N` na descrição.
6. Espere a revisão de pelo menos 1 colega e resolva as conversas.
7. Depois do merge, a issue fecha sozinha.

## Regras

- **Nada vai direto para o `main`.** O `main` é protegido: todo código entra por PR com 1 aprovação, inclusive o dos administradores.
- **Nunca feche uma issue à mão nem marque o checklist dela sem o código estar no `main`.** A issue fecha pelo merge do PR (`Closes #N`). O checklist é marcado conforme o PR é revisado.
- **Issue com label `a-confirmar` não sai do backlog.** Ela depende de uma pendência com o cliente ou com os professores (issues `tipo:pendencia`). Não invente regra de negócio para cobrir uma pendência: cite o ID dela (ex: P10) e deixe o ponto configurável ou com `TODO(P10)`.
- **Consulte [docs/requisitos.md](docs/requisitos.md) antes de implementar uma regra de negócio.** Cada regra tem ID (RN, RF, RNF) e status ([Validado] ou [A confirmar]).
- **Público majoritariamente idoso** (RNF01, RNF02): fonte base de no mínimo 18px, alto contraste, botões grandes, poucos passos por tela, linguagem direta, todos os campos com rótulo visível e navegação por teclado.

## Dados do cliente

O repositório é **público**. Nunca versione dados reais do cliente (RNF10):

- CNPJs, nomes e e-mails de farmácias reais;
- XML da JUCEMAT ou planilhas da sede;
- credenciais do Sicredi ou de qualquer serviço;
- contrato e dados do termo de parceria.

Seeds, testes, prints e demonstrações usam **somente dados fictícios**: CNPJs gerados, e-mails `@example.com`. Segredos ficam no `.env`, que não entra no Git; o `.env.example` traz só valores de desenvolvimento.

Se um dado real for commitado por engano, avise a equipe na hora: apagar num commit seguinte não basta, porque ele continua no histórico.

## Branches

Formato: `tipo/ID-descricao-curta`, em minúsculas e com hífens.

| Exemplo | Quando usar |
| --- | --- |
| `feat/us03-login-api` | Funcionalidade de uma user story |
| `fix/us03-mensagem-erro-login` | Correção de bug |
| `chore/ci-github-actions` | Configuração, dependências, ferramentas |
| `docs/readme-setup` | Só documentação |

## Commits

Usamos [Conventional Commits](https://www.conventionalcommits.org/pt-br/) com a descrição em português. O hook de `commit-msg` valida a mensagem e recusa o commit fora do padrão.

```
tipo(escopo): descrição curta no imperativo ou no particípio
```

- **Tipos:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
- **Escopos:** `api`, `web`, `shared`, `infra`, `docs` (opcional, mas recomendado).
- Exemplos:
  - `feat(api): login com e-mail e senha`
  - `fix(web): rótulo do campo de CNPJ`
  - `chore(infra): CI no GitHub Actions`

## Pull Requests

- **PR pequeno:** uma issue por PR. Se a issue for grande, divida em mais PRs.
- Preencha o template: o que muda, como testar e o checklist.
- A descrição precisa ter `Closes #N` para a issue fechar no merge.
- Revisor: confira o código, rode localmente se precisar e comente. Quem abriu o PR responde e resolve as conversas.
- Antes de pedir revisão, rode `pnpm lint`, `pnpm format:check`, `pnpm build` e `pnpm test`.

## Lint e formatação

- **Lint:** [oxlint](https://oxc.rs/docs/guide/usage/linter), configurado em `.oxlintrc.json` na raiz. Inclui regras de React e de acessibilidade (jsx-a11y).
- **Formatação:** [Prettier](https://prettier.io/), configurado em `.prettierrc`. Arquivos Markdown ficam de fora para não desalinhar as tabelas da documentação.
- O hook de `pre-commit` roda o oxlint e o Prettier só nos arquivos alterados. Os hooks são instalados automaticamente no `pnpm install`.
- No VS Code, instale as extensões recomendadas (o editor sugere ao abrir o projeto).

| Comando | O que faz |
| --- | --- |
| `pnpm lint` | Lint do monorepo inteiro |
| `pnpm lint:fix` | Corrige o que o lint consegue corrigir sozinho |
| `pnpm format` | Formata todos os arquivos |
| `pnpm format:check` | Só confere a formatação (usado no CI) |
