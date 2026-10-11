# ADR-002: Biblioteca de componentes da web

**Status:** Aceito
**Data:** 11/10/2026
**Decisores:** grupo do PI (proposta inicial do Lucas na issue #5)

Documentos relacionados: [ADR-001](0001-tecnologia-frontend.md) (ação 3), [Requisitos](../requisitos.md), [Decisões Técnicas](../decisoes-tecnicas.md).

## Contexto

O ADR-001 escolheu React + Vite para a web e deixou como ação escolher uma biblioteca de componentes acessível. As duas opções levantadas foram React Bootstrap e Mantine.

Critérios, em ordem de peso:

1. **Acessibilidade e público idoso** (RNF01, RNF02): fonte base grande, botões grandes, alto contraste, rótulos visíveis e navegação por teclado.
2. **Curva de aprendizado:** a equipe já conhece Bootstrap e sabe pouco de React.
3. **Painel da sede:** tabelas, filtros e formulários.

## Decisão

**React Bootstrap**, com um tema próprio em Sass (`apps/web/src/estilos/tema.scss`).

## Opções consideradas

### React Bootstrap

- Usa as classes e o sistema de grid do Bootstrap que a equipe já conhece. O que se sabe de Bootstrap continua valendo.
- Tema por variáveis Sass: um arquivo muda fonte, cores e espaçamentos do sistema inteiro.
- Tabelas, formulários e alertas cobrem o painel da sede.
- Ponto fraco: o foco padrão é uma sombra translúcida, pouco visível, e as cores padrão ficam no limite do contraste AA (4,5:1). As duas coisas são corrigidas no tema (ver Consequências).

### Mantine

- Nativa de React, com hooks e muitos componentes prontos (datas, notificações, formulários).
- Boa acessibilidade de fábrica.
- Ponto fraco: tudo novo para a equipe, sem aproveitar o conhecimento de Bootstrap, num semestre em que ela ainda está aprendendo React e TypeScript.

## Consequências

O tema (`tema.scss`) define a base de acessibilidade, e as telas não precisam repetir esses ajustes:

- **Fonte:** `1rem = 18px`, definido em porcentagem para respeitar quem aumentou a fonte no navegador.
- **Cores:** escurecidas, com contraste de 6,5:1 a 8,9:1 com texto branco. As padrão do Bootstrap ficavam em 4,5:1.
- **Foco:** anel preto e amarelo, visível em fundo claro e escuro.
- **Toque:** alvo mínimo de 44px em botões, campos e links do menu.

Os componentes base em `apps/web/src/componentes` aplicam as regras de uso:

- `Botao`: grande por padrão.
- `CampoTexto`: rótulo visível, com a ajuda e o erro ligados ao campo para leitores de tela.
- `MensagemErro`: anunciada na hora pelos leitores de tela.
- `AvisoSucesso`: anunciado como status pelos leitores de tela.

As telas devem usar esses componentes em vez de montar formulários e botões direto com o React Bootstrap.

O lint (oxlint com jsx-a11y) aponta problemas comuns de acessibilidade no código, mas não substitui o teste com teclado e leitor de tela previsto na revisão de acessibilidade (#58).
