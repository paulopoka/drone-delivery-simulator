# Uso de IA no desenvolvimento

Este projeto foi desenvolvido com o auxílio do Claude (Anthropic), usado
como par de programação sob minha direção. As decisões de escopo, prioridade
e arquitetura foram minhas em cada etapa; a IA implementou, e eu revisei o
resultado antes de aceitar. Este documento resume como isso aconteceu, para
transparência com os avaliadores.

## Ferramenta
Claude (via chat com acesso a ambiente de execução: bash, edição de
arquivos, execução de testes).

## Como foi conduzido
1. **Leitura do enunciado**: eu enviei o PDF do teste técnico à IA para
   extrair e resumir os requisitos (regras de capacidade, alcance,
   funcionalidades avançadas e diferenciais, entregáveis esperados). A
   leitura do enunciado e a decisão de quais requisitos priorizar foram
   minhas.
2. **Definição de stack**: escolhi Node.js + TypeScript + Express, por
   equilibrar produtividade em 3 dias com tipagem forte e boas práticas de
   teste (Jest).
3. **Estruturação do projeto**: pedi a separação em camadas (domain /
   services / repositories / api / utils); a IA propôs e criou a árvore de
   pastas dentro dessa diretriz.
4. **Implementação incremental**: acompanhei e validei manualmente (curl)
   cada camada antes de autorizar avançar para a próxima — entidades →
   algoritmo de alocação → simulação de estados/bateria → API → testes.
5. **Testes**: a IA escreveu a suíte de testes unitários e de integração
   cobrindo as regras de negócio principais (bin-packing, transições de
   estado do drone, validações da API). Um teste revelou um bug real
   (contagem de entregas do drone zerada por falta de associação de
   pedidos antes de finalizar a viagem), corrigido em seguida.
6. **Revisão de qualidade**: identifiquei a incompatibilidade de versão do
   TypeScript com `ts-jest` (a versão instalada por padrão, 6.x, quebrava
   os testes) e pedi que fosse fixada numa versão estável.
7. **Segunda revisão (pedido meu, pós-entrega inicial)**: pedi
   explicitamente para revisar todo o projeto e corrigir o que fosse
   necessário — "Quero que você reveja todo o processo e melhore o que
   achar necessário". A IA leu o código fonte inteiro e encontrou, entre
   outras coisas: variáveis de ambiente inválidas (ex:
   `DRONE_MAX_WEIGHT_KG=abc`) sendo aceitas como `NaN` e silenciosamente
   desativando os limites de peso/alcance em vez de dar erro; os mesmos
   `NaN`/`Infinity` não sendo rejeitados na validação de entrada da API;
   JSON malformado no corpo da requisição resultando em 500 em vez de 400;
   a instrução do README para copiar `.env.example` para `.env` não tinha
   efeito nenhum (o projeto nunca carregou esse arquivo, não há `dotenv`);
   e duas funções de teste (reset de sequência de IDs) que existiam mas
   nunca eram chamadas. Revisei os pontos levantados e pedi a correção de
   todos, com testes novos cobrindo cada um.

8. **Terceira passada — funcionalidades extras (ideia minha)**: pedi
   sugestões do que agregaria ao projeto sem complexidade excessiva e,
   depois de avaliar as opções, decidi quais implementar — "Então faça".
   Foram adicionados: mapa ASCII das entregas, endpoint de cenário de
   exemplo, métricas de eficiência (drone mais eficiente e economia de
   viagens vs. baseline), testes de carga (50/200/500 pedidos) e um
   comparativo entre estratégias de alocação. Um bug foi encontrado ao
   inspecionar a saída real do mapa: a base usava o símbolo `H`, que é
   também o 8º rótulo de pedido, então o 8º pedido aparecia idêntico à
   base; identifiquei o problema visualmente e pedi a correção, trocado
   por `@`, com teste de regressão.

9. **Zonas de exclusão aérea (exigência minha)**: insisti pessoalmente na
   priorização dessa funcionalidade por ser obrigatória no enunciado — "Eu
   preciso das zonas de exclusão, deveria ser uma das primeiras coisas a
   se preocupar uma vez que é obrigatório no projeto". Também fui eu quem
   levantou o caso de borda de pedido dentro de uma zona já existente
   ("Mas e quando a entrega está dentro da zona de exclusão?"), o que
   levou a IA a expor o aviso de pedidos afetados na criação de uma zona.
   Na implementação, o afastamento do waypoint de desvio precisou ser
   **derivado** (`h ≥ r·c/√(c²−r²)`), e não estimado: a primeira versão
   usava 1,08 × raio, que deixava o caminho raspando o círculo por 2
   centésimos — o teste que verifica se a rota gerada realmente não invade
   a zona pegou o erro.

10. **Persistência em banco (ideia minha)**: perguntei se dava para
    adicionar algum tipo de banco de dados ao projeto e optei pela opção
    de SQLite opcional (`STORAGE=sqlite`), mantendo o modo em memória como
    padrão. Foram extraídas interfaces para os três repositórios, com
    implementações em memória e SQLite via `node:sqlite` — módulo nativo,
    para não adicionar dependência nem exigir compilação na máquina do
    avaliador. A troca de driver expôs um bug introduzido pela própria
    implementação SQLite (não um bug pré-existente): com repositório em
    memória, `findPending()` devolvia as próprias instâncias guardadas,
    então a simulação mutava os objetos e a persistência acontecia por
    acidente; com banco de verdade isso não acontecia mais, e nada era
    gravado de volta. Ao ser questionado por mim sobre o valor real desse
    trabalho ("Mas o que isso agregou na aplicação?"), a IA reconheceu que
    havia inflado a descrição inicial do achado como "bug real
    encontrado" — o comportamento em memória nunca esteve quebrado; o
    defeito foi criado junto com o código novo, e a suíte de contrato só
    serviu para pegar o próprio erro introduzido na mesma etapa. Registro
    esse ponto aqui de propósito: acompanhei essa troca e não deixei a
    afirmação passar sem questionamento.

11. **Ajuste de UI a pedido meu**: com o dashboard acumulando pedidos, pedi
    que os painéis pudessem ser minimizados para não ficar rolando a
    página inteira — "queria que tivesse como minimizar o quadro". A IA
    implementou painéis recolhíveis com estado salvo em `localStorage`; eu
    abri o `dashboard.html` no navegador para conferir visualmente o
    resultado antes de aceitar.

## Meu papel de acompanhamento
Não usei a IA de forma passiva: acompanhei o código gerado em cada etapa,
rodei a aplicação manualmente para validar comportamento, decidi o que
entrava no escopo e em que ordem, e questionei diretamente quando uma
alegação da IA pareceu maior do que o que realmente foi entregue (item 10
acima é o exemplo mais claro disso). As prioridades técnicas (zonas de
exclusão primeiro, por ser obrigatório) e as decisões de produto
(persistência opcional, painéis recolhíveis) partiram de mim.

## Prompts / instruções centrais usadas
- "Monte a estrutura do projeto com Node + TypeScript, API REST, nível
  intermediário-avançado focado em qualidade do core + testes."
- "Quero que você reveja todo o processo e melhore o que achar
  necessário."
- "Eu preciso das zonas de exclusão, deveria ser uma das primeiras coisas
  a se preocupar uma vez que é obrigatório no projeto."
- "Mas o que isso agregou na aplicação?" — questionamento direto de uma
  alegação de valor, que levou a IA a corrigir o próprio discurso.
- Pedido explícito de reescrever testes e rodar a suíte completa antes de
  finalizar.

## O que foi decidido por humano vs. IA
- **Humano (eu)**: escolha da tecnologia (dentre as opções permitidas no
  enunciado), o que entrava no escopo e em que ordem, priorização das
  zonas de exclusão por serem obrigatórias, decisão de adicionar
  persistência e qual modelo usar, ajustes de UX vindos de uso real do
  dashboard, aprovação (ou não) de cada etapa e questionamento das
  alegações da IA quando pareciam exageradas.
- **IA**: implementação do código, design das classes/algoritmo de
  alocação, escrita dos testes, documentação.

## Observação
Todo o código foi revisado por mim e testado (`npm test`) antes da
entrega. Erros de compilação e um bug de lógica identificado pelos
próprios testes foram corrigidos durante o desenvolvimento assistido, e
uma segunda passada de revisão (item 7 acima), pedida por mim, endureceu
validação de entrada/configuração e fechou lacunas de cobertura de teste
encontradas depois da entrega inicial.
