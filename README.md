# 🚁 Simulador de Encomendas em Drone

Uma API REST que simula logística de entregas por drone em uma malha de
coordenadas 2D, alocando pacotes com o **menor número de viagens possível**
sob restrições de peso, alcance de bateria, prioridade e zonas de exclusão
aérea. Roda em **Linux, macOS e Windows**.

Teste técnico — Processo Seletivo dti digital (Estágio Dev).

---

## Sumário

- [Instalação](#instalação)
- [Dependências](#dependências)
- [Quick Start](#quick-start)
- [O que isto é e o que não é](#o-que-isto-é-e-o-que-não-é)
- [Configuração](#configuração)
- [Persistência](#persistência)
- [Zonas de exclusão aérea](#zonas-de-exclusão-aérea)
- [Comparativo de estratégias](#comparativo-de-estratégias)
- [Arquitetura e decisões técnicas](#arquitetura-e-decisões-técnicas)
- [Dashboard visual](#dashboard-visual)
- [Referência da API](#referência-da-api)
- [Testes](#testes)
- [Funcionalidades implementadas](#funcionalidades-implementadas)
- [Skills de agente previstas](#skills-de-agente-previstas)
- [Possíveis evoluções](#possíveis-evoluções)

---

## Instalação

Não há pacote publicado — o projeto é rodado a partir do repositório.

```bash
git clone <url-do-repositorio>
cd drone-delivery-simulator
npm install
```

### Modo desenvolvimento (hot-reload)

```bash
npm run dev
```

### Build de produção

```bash
npm run build
npm start
```

O servidor sobe por padrão em `http://localhost:3000`.

---

## Dependências

| Requisito | Versão | Notas |
|-----------|--------|-------|
| Node.js | 18+ | testado com Node 22 |
| npm | qualquer | vem com o Node |
| Node.js | **22.5+** | **somente** se for usar `STORAGE=sqlite` |

**Dependência de produção: uma só — `express`.** Não há driver de banco,
não há `dotenv`, não há módulo nativo para compilar. Isso é deliberado:
quem clonar o repositório precisa apenas de `npm install` e Node.

### Sistemas operacionais suportados

| SO | Status | Notas |
|----|--------|-------|
| Windows | ✅ suportado | ambiente em que foi desenvolvido e testado |
| Linux | ✅ suportado | — |
| macOS | ✅ suportado | — |

O projeto é 100% JavaScript/TypeScript rodando sobre Node — sem binários
de plataforma, sem dependências nativas fora do `node:sqlite`, que já vem
embutido no próprio Node. A única diferença entre os três sistemas é a
sintaxe do shell para exportar variável de ambiente, e os exemplos abaixo
cobrem tanto `bash`/`zsh` quanto PowerShell.

---

## Quick Start

Com o servidor rodando (`npm run dev`), em outro terminal:

```bash
# 1. Popular um cenário de exemplo com 20 pedidos
curl -X POST localhost:3000/simulacao/demo \
  -H "Content-Type: application/json" \
  -d '{"quantidade":20}'

# 2. Ver o mapa das entregas direto no terminal
curl localhost:3000/entregas/mapa

# 3. Gerar as rotas e executar a simulação
curl localhost:3000/entregas/rota

# 4. Ver o estado final dos drones
curl localhost:3000/drones/status
```

> Prefere clicar a digitar? Abra `dashboard.html` no navegador com o
> servidor rodando — ver [Dashboard visual](#dashboard-visual).

Para criar um pedido individualmente:

```bash
curl -X POST localhost:3000/pedidos \
  -H "Content-Type: application/json" \
  -d '{"location":{"x":3,"y":4},"weightKg":1.5,"priority":"alta"}'
```

---

## O que isto é e o que não é

**É** um simulador: o tempo não passa de verdade, os drones não existem, e
o "voo" é uma sequência de transições de estado com consumo de bateria
calculado a partir da distância. O valor está na modelagem das regras e na
qualidade do algoritmo de alocação, não em fidelidade física.

**Não é** um otimizador exato. Alocação de pacotes com restrição de peso é
bin-packing e a ordem das paradas é caixeiro-viajante — ambos NP-difíceis.
O que está implementado são heurísticas gulosas que entregam uma boa
solução em tempo hábil, e um endpoint que **mede** o quanto elas ganham
contra um baseline (ver [Comparativo de estratégias](#comparativo-de-estratégias)).

**Não é** um pathfinder geral. O desvio de zona de exclusão usa um único
waypoint perpendicular: resolve o caso comum de uma zona no meio do
caminho, mas recusa explicitamente configurações que exigiriam A* ou grafo
de visibilidade — nunca devolve um caminho que atravessa área proibida.

**Escopo assumido:** aplicação de processo único, sem autenticação, sem
concorrência entre instâncias. Não há bloqueio ou transação distribuída;
o modo SQLite grava em arquivo local, não em banco remoto.

---

## Configuração

As specs do drone são ajustáveis por variável de ambiente.

> ⚠️ **`.env.example` não é carregado automaticamente.** O arquivo existe
> para documentar as variáveis, mas o projeto não usa `dotenv` — de
> propósito, para manter `express` como única dependência. Exporte as
> variáveis no shell antes de subir o servidor.

```bash
# bash / zsh — Linux e macOS
DRONE_MAX_WEIGHT_KG=8 DRONE_MAX_RANGE_KM=15 npm run dev
```

```powershell
# PowerShell — Windows
$env:DRONE_MAX_WEIGHT_KG = "8"
$env:DRONE_MAX_RANGE_KM = "15"
npm run dev
```

### Variáveis disponíveis

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `PORT` | `3000` | Porta do servidor HTTP |
| `DRONE_MAX_WEIGHT_KG` | `5` | Capacidade máxima de carga por drone (kg) |
| `DRONE_MAX_RANGE_KM` | `10` | Alcance máximo por carga de bateria (km) |
| `DRONE_SPEED_KMH` | `40` | Velocidade média — usada só para estimar ETA |
| `STORAGE` | `memory` | Persistência: `memory` ou `sqlite` |
| `DATABASE_FILE` | `drone-delivery.db` | Arquivo do banco, quando `STORAGE=sqlite` |

> **Falha rápida, não falha silenciosa.** Se `DRONE_MAX_WEIGHT_KG`,
> `DRONE_MAX_RANGE_KM` ou `DRONE_SPEED_KMH` receberem valor não-numérico ou
> não-positivo, o servidor **não sobe** e diz qual variável está inválida
> (ver `src/config.ts`). Antes dessa checagem, um `DRONE_MAX_WEIGHT_KG=abc`
> virava `NaN` e desligava o limite de peso sem avisar ninguém.

---

## Persistência

O acesso a dados passa por três interfaces (`OrderRepository`,
`DroneRepository`, `NoFlyZoneRepository`) com duas implementações
intercambiáveis.

| Driver | Quando usar | Onde vivem os dados | Node mínimo |
|--------|-------------|---------------------|-------------|
| `memory` *(padrão)* | desenvolvimento, testes, avaliação rápida | RAM — somem ao encerrar | 18 |
| `sqlite` | ver persistência real entre reinícios | arquivo `.db` local | **22.5** |

```bash
npm run dev                    # em memória (padrão)
STORAGE=sqlite npm run dev     # grava em drone-delivery.db
```

```powershell
# PowerShell
$env:STORAGE = "sqlite"; npm run dev
```

**Por que memória é o padrão:** quem clonar o repositório roda
`npm install && npm run dev` e funciona em qualquer Node 18+, sem
configuração e sem arquivo sobrando no disco. SQLite é opt-in.

**Por que SQLite pelo módulo nativo do Node (`node:sqlite`):** mantém o
`express` como única dependência de produção — sem driver externo e sem
módulo nativo para compilar na máquina de quem for avaliar.

**Por que as interfaces são síncronas:** as duas implementações são
síncronas, e a API do `node:sqlite` também. Manter o contrato assim evita
espalhar `async/await` por toda a camada HTTP sem ganho real.

> ⚠️ **Custo conhecido dessa escolha:** trocar por um banco remoto
> (Postgres, Mongo) exigiria tornar o contrato assíncrono e propagar isso
> por services e controllers.

### O bug que a troca de driver revelou

Vale registrar, porque é o tipo de defeito que só aparece quando existe
mais de uma implementação.

Com repositório em memória, `findPending()` devolve as **mesmas
instâncias** guardadas no `Map`: a simulação mutava os pedidos e a
"persistência" acontecia por acidente, sem ninguém gravar nada.

Com SQLite, `findPending()` devolve objetos **reconstruídos do banco**. A
simulação passou a rodar sobre cópias soltas — o pedido continuava
pendente e o drone, zerado, porque `save()` nunca era chamado depois do
voo. Pior: os drones eram gravados *antes* da simulação, então o banco
guardava bateria 100% e zero entregas.

A suíte de contrato (mesmos testes rodando contra os dois drivers) e um
teste de API sobre SQLite pegaram os dois casos. A correção foi persistir
o resultado **depois** da simulação, em
`DeliveryController.persistSimulationResult`.

---

## Zonas de exclusão aérea

Zonas são áreas **circulares** proibidas (aeroporto, heliponto de
hospital, área militar). Modelar como círculo, e não polígono, foi
deliberado: a checagem de "este trecho de voo invade a zona?" vira uma
única conta de distância ponto-segmento, sem perder o essencial do
comportamento.

Quando um trecho reto cruzaria uma zona, o drone **contorna** por um
waypoint perpendicular em vez de desistir da entrega.

### O afastamento do desvio é calculado, não chutado

Com o centro da zona a uma distância `c` ao longo do trecho e raio `r`, o
afastamento perpendicular `h` precisa satisfazer:

```
h ≥ r·c / √(c² − r²)
```

(o novo trecho deixa o centro a `c·h/√(c²+h²)` de distância; exigir que
isso seja ≥ `r` e isolar `h` dá a fórmula acima)

> Isso importa na prática: durante o desenvolvimento, um afastamento "que
> parecia suficiente" de 1,08 × raio deixava o caminho raspando o círculo
> por 2 centésimos, e a rota invadia a zona. Todo caminho gerado é
> validado contra *todas* as zonas antes de ser aceito — desviar de uma
> zona e cair em outra é recusado.

### Consequências no resto do sistema

- O desvio **conta para o alcance**: uma viagem que caberia em linha reta
  pode passar a não caber, e aí o pedido é reportado como não-alocável.
- O desvio **consome bateria de verdade** — a simulação voa o caminho
  planejado, não a linha reta.
- Se nenhum contorno for possível (ex: cliente cercado por zonas), a rota
  é recusada explicitamente em vez de devolver um caminho que atravessa
  área proibida.

### E quando a entrega é *dentro* da zona?

Depende de quem chegou primeiro, e os dois casos são tratados.

**A zona já existia** → o pedido é recusado na entrada, com HTTP 400
citando o nome da zona. Não chega a entrar no sistema.

**O pedido já existia e a zona foi criada depois** → a criação da zona
**não é bloqueada** (uma área restrita é um fato externo, não uma escolha
do sistema), mas a resposta já avisa o estrago:

```json
{
  "id": "zone-1",
  "name": "area-militar",
  "warning": "3 pedido(s) pendente(s) deixaram de ser entregáveis com esta zona.",
  "affectedOrders": [
    { "id": "order-1", "reasonCode": "dentro_de_zona_de_exclusao", "...": "..." }
  ]
}
```

O aviso cobre não só quem ficou *dentro* da zona, mas também quem passou a
estar **fora de alcance** porque o desvio encareceu a rota.

> Esses pedidos nunca são apagados nem entregues por engano: continuam
> pendentes e reaparecem em `unassignedOrders` a cada `GET /entregas/rota`,
> com o motivo explícito. Se a zona for removida, voltam a ser entregáveis
> normalmente — há teste cobrindo esse ciclo completo.

---

## Comparativo de estratégias

Afirmar que uma heurística é boa não vale muito sem número. Por isso a
estratégia de alocação é uma peça plugável (`src/services/strategies/`), e
`GET /entregas/comparar-estrategias` roda os mesmos pedidos por todas elas
e mostra o resultado lado a lado.

Saída real com 18 pedidos gerados por `POST /simulacao/demo`:

| Estratégia | Viagens | Distância total | Economia |
|------------|---------|-----------------|----------|
| uma-viagem-por-pedido | 18 | 97,01 km | — |
| nearest-first | 8 | 69,53 km | 55,6% |
| **first-fit-decreasing** | **7** | **62,45 km** | **61,1%** |

As três estratégias usam exatamente o mesmo empacotamento (first fit); o
que muda entre elas é **só o critério de ordenação** dos pedidos. Isso
isola a variável e torna a comparação justa:

- **uma-viagem-por-pedido** — o baseline. Não é uma estratégia séria, é a
  régua contra a qual o ganho é medido.
- **nearest-first** — atende primeiro quem está mais perto da base. É
  geograficamente intuitivo, mas perde: sem olhar o peso, enche as
  primeiras viagens de pacotes leves e deixa os pesados sobrando no fim.
- **first-fit-decreasing** — a estratégia padrão. Trata os itens mais
  difíceis de encaixar enquanto ainda há viagens vazias.

> A comparação é uma execução **a seco**: as estratégias apenas planejam,
> sem criar drones nem alterar o estado dos pedidos. Chamar esse endpoint
> não interfere na simulação (há teste garantindo isso).

---

## Arquitetura e decisões técnicas

```
src/
├── domain/             # Entidades: Order, Drone, NoFlyZone, tipos/enums
├── services/
│   ├── strategies/     # Estratégias de alocação plugáveis (+ empacotamento comum)
│   ├── AllocationService.ts
│   ├── SimulationService.ts
│   └── StrategyComparisonService.ts
├── repositories/       # Interfaces + implementações (inMemory/ e sqlite/)
├── utils/              # Geometria, roteirização (nearest neighbor) e mapa ASCII
├── api/
│   ├── controllers/    # Handlers HTTP
│   ├── routes/         # Definição das rotas
│   ├── validation.ts   # Validação de entrada
│   └── errorHandler.ts
├── config.ts           # Configuração via env vars
├── app.ts              # Montagem do Express (separado do server p/ testes)
└── server.ts           # Ponto de entrada (listen)
```

Camadas separadas por responsabilidade (domínio, regra de negócio,
persistência, API) para permitir testar cada peça isoladamente, sem
acoplar tudo em um único arquivo de rotas.

### Algoritmo de alocação

O problema é uma variante de **bin-packing** (capacidade de peso) somada a
**roteamento** (alcance da bateria). Como o objetivo prático é uma solução
boa em tempo hábil, a estratégia é uma heurística gulosa:

1. Pedidos são ordenados por **prioridade** (alta primeiro) e, dentro da
   mesma prioridade, por **peso decrescente** (First-Fit-Decreasing —
   itens mais "difíceis" de encaixar são tratados primeiro).
2. Para cada pedido, tenta-se encaixá-lo em alguma viagem já aberta que
   ainda tenha capacidade de peso e cuja rota recalculada continue dentro
   do alcance do drone.
3. Se não encaixar em nenhuma viagem aberta, abre-se uma nova viagem.
4. Pedidos que sozinhos já excedem peso ou alcance são reportados em
   `unassignedOrders`, **nunca silenciosamente descartados**.

A ordem das paradas dentro de cada viagem é otimizada com a heurística do
**vizinho mais próximo**, que aproxima bem o caixeiro-viajante para o
número pequeno de paradas que um drone tem por viagem.

### Máquina de estados do drone

```
Idle → Carregando → Idle
Idle → Em voo → Entregando → Em voo → Entregando → ... → Retornando → Idle
```

Implementada com uma tabela de transições válidas (`Drone.transitionTo`),
que lança erro em qualquer transição fora do fluxo esperado — isso pega
bugs de orquestração cedo (foi útil durante o próprio desenvolvimento: um
bug real de transição inválida foi pego pelos testes).

### Bateria

Cada km voado consome uma fração da bateria proporcional ao alcance
declarado do drone (`100 / maxRangeKm` por km, por padrão). Se a bateria
restante não é suficiente para uma rota, o drone **recarrega
automaticamente** antes de decolar.

---

## Dashboard visual

Abra `dashboard.html` no navegador com o servidor rodando. É um arquivo
único, sem build e sem dependência — HTML + CSS + JS puro consumindo a
mesma API.

Tem botão de cenário de exemplo, criação de pedidos e zonas, mapa das
entregas, comparativo de estratégias e painel de métricas. Os painéis são
recolhíveis (clique no título) e o estado fica salvo no `localStorage`,
porque com muitos pedidos acumulados a página ficava longa demais para
rolar.

---

## Referência da API

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/pedidos` | Cria um novo pedido de entrega |
| GET | `/pedidos` | Lista todos os pedidos criados |
| GET | `/entregas/rota` | Aloca os pedidos pendentes em viagens e executa a simulação |
| GET | `/entregas/mapa` | Mapa ASCII das entregas (`text/plain`) |
| GET | `/entregas/comparar-estrategias` | Compara estratégias de alocação sobre os pedidos pendentes |
| GET | `/drones/status` | Status atual de todos os drones já utilizados |
| POST | `/zonas-exclusao` | Cria uma zona de exclusão aérea |
| GET | `/zonas-exclusao` | Lista as zonas ativas |
| DELETE | `/zonas-exclusao/:id` | Remove uma zona |
| POST | `/simulacao/demo` | Popula o sistema com um cenário de exemplo |

### `POST /pedidos`

```json
{
  "location": { "x": 3, "y": 4 },
  "weightKg": 1.5,
  "priority": "alta"
}
```

| Campo | Tipo | Obrigatório | Notas |
|-------|------|-------------|-------|
| `location.x` / `location.y` | number | sim | coordenada na malha; a base é `(0,0)` |
| `weightKg` | number | sim | precisa ser finito e positivo |
| `priority` | string | sim | `"baixa"`, `"media"` ou `"alta"` |

Retorna **400** se o peso exceder a capacidade do drone, se a distância
até o cliente exceder o alcance máximo (mesmo sozinho, sem outros pacotes
na viagem), ou se o destino cair dentro de uma zona de exclusão existente.

### `GET /entregas/rota`

Pega todos os pedidos ainda não alocados, roda o algoritmo de alocação e
simula a execução das viagens. Retorna o relatório de entregas, as viagens
montadas e os pedidos não-alocáveis.

A resposta traz também um bloco `efficiency` com quantas viagens o
agrupamento economizou em relação ao pior caso (uma viagem por pedido), e
o `mostEfficientDrone` — o drone com melhor razão entregas/km.

### `GET /entregas/mapa`

Mapa ASCII em `text/plain`, pensado para ler direto no terminal. A base é
`@`, cada pedido é uma letra, `#` marca zonas de exclusão e `*` marca duas
ou mais entregas que caíram na mesma célula da grade:

```
. . . . . . . . . . . . . . . . . . . . E . . . . . . . . . .
. . . . . . . . . . . . . . . . . . @ . . . . . . . . . . . .
. . . . . . . . . . . . . I . . . . D . . . . . . . . . . . .
. . . . . . . . . . . . . . . . B . . . . . . . . . . . . . .

  @  base (0, 0)
  A  order-1    (2.4, -2.4)  1.2kg  media  pendente
```

> A grade é escalada para caber na tela, então **não há relação 1:1** entre
> unidade da malha e caractere — o mapa fica legível tanto para entregas a
> 2 km quanto a 200 km.

### `GET /entregas/comparar-estrategias`

Roda os mesmos pedidos pendentes por todas as estratégias e devolve o
comparativo — ver [Comparativo de estratégias](#comparativo-de-estratégias).

### `POST /zonas-exclusao`

```json
{
  "center": { "x": 2, "y": 0 },
  "radiusKm": 0.8,
  "name": "heliponto-hospital"
}
```

| Campo | Tipo | Obrigatório | Notas |
|-------|------|-------------|-------|
| `center.x` / `center.y` | number | sim | centro da zona circular |
| `radiusKm` | number | sim | precisa ser finito e positivo |
| `name` | string | não | default: o próprio id da zona |

> ⚠️ Retorna **400** se a zona cobriria a base `(0,0)` — isso travaria toda
> e qualquer decolagem, e quase sempre indica erro de digitação nas
> coordenadas.

Se já houver pedidos pendentes afetados, a resposta inclui `warning` e
`affectedOrders` — ver
[E quando a entrega é dentro da zona?](#e-quando-a-entrega-é-dentro-da-zona).

### `POST /simulacao/demo`

Cria um cenário de exemplo (padrão: 15 pedidos) para ver a simulação
funcionando sem cadastrar pedido por pedido. Aceita `{"quantidade": N}`,
com N entre 1 e 100. As posições são sorteadas em coordenadas polares
dentro do alcance do drone, então nenhum pedido gerado sai inalocável.

### `GET /drones/status`

Retorna todos os drones já criados (um por viagem executada), com estado
atual, bateria, distância total voada e total de entregas.

---

## Testes

```bash
npm test              # roda toda a suíte
npm run test:watch    # modo watch
npm run test:coverage # com relatório de cobertura
```

**273 testes** (unitários + integração da API), cobrindo:

- Alocação/bin-packing e as três estratégias de alocação
- Máquina de estados e bateria do drone (`Drone`)
- Execução da simulação (`SimulationService`)
- Zonas de exclusão aérea: geometria, desvio, e casos sem saída
- Utilitários de geometria, roteirização e mapa ASCII
- Validação de entrada e configuração via variável de ambiente
- Tratamento de erros (JSON malformado, exceções inesperadas)
- Endpoints da API (`supertest`)
- Suíte de contrato: os mesmos testes rodando contra os dois drivers de
  persistência, garantindo comportamento idêntico
- **Simulações de carga** com 50, 200 e 500 pedidos

> As simulações de carga usam um gerador pseudoaleatório com seed fixa
> (LCG) em vez de `Math.random()` — assim uma falha é sempre reproduzível
> na execução seguinte, em vez de aparecer e sumir.

Invariantes verificadas para todas as estratégias, em todas as escalas:
nenhum pedido é perdido ou duplicado, nenhuma viagem excede peso ou
alcance, e planejar nunca muta os pedidos.

---

## Funcionalidades implementadas

**Obrigatórias (enunciado):**
- [x] Capacidade de peso e alcance por drone (configurável)
- [x] Mapeamento em malha de coordenadas 2D
- [x] Recebimento de pedidos com localização, peso e prioridade
- [x] Alocação minimizando o número de viagens

**Avançadas:**
- [x] Simulação de bateria (consumo proporcional à distância)
- [x] Zonas de exclusão aérea (obstáculos), com desvio automático
- [x] Cálculo de tempo total/estimado de entrega (ETA)
- [x] Fila de entrega por prioridade + proximidade

**Diferenciais:**
- [x] Otimização por peso + prioridade + distância
- [x] Simulação orientada a eventos com máquina de estados
- [x] API RESTful com os endpoints sugeridos
- [x] Testes unitários (273 testes, ~98% de cobertura)
- [x] Simulações de carga (50 / 200 / 500 pedidos, com gerador determinístico)
- [x] Tratamento de erros e validações (mensagens claras, HTTP 400)
- [x] Relatório com métricas (entregas realizadas, tempo médio, distância total)
- [x] Mapa das entregas em ASCII, com as zonas de exclusão desenhadas
- [x] Drone mais eficiente (razão entregas/km)
- [x] Recarga automática do drone quando a bateria não é suficiente
- [x] Dashboard visual (`dashboard.html`)

**Extras (além do enunciado):**
- [x] Comparativo entre estratégias de alocação, medindo o ganho da
      heurística escolhida contra um baseline
- [x] Persistência em banco (SQLite) atrás de interfaces, com suíte de
      contrato garantindo que os dois drivers se comportam igual
- [x] Endpoint de cenário de exemplo (`POST /simulacao/demo`)

---

## Skills de agente previstas

O projeto foi desenvolvido com auxílio de IA (ver [AI_USAGE.md](AI_USAGE.md)).
*Skills* são instruções empacotadas que padronizam tarefas repetidas do
agente — o equivalente, para o ferramental de IA, do que um script npm é
para o desenvolvedor.

As três abaixo não estão implementadas. Estão documentadas porque cada uma
nasceu de um problema **concreto** desta base de código, e o registro do
problema vale mesmo sem a automação.

### `rodar-simulador` — subir e exercitar a API

Padroniza o ciclo: liberar a porta 3000, subir o servidor (em memória ou
`STORAGE=sqlite`), popular um cenário e percorrer os endpoints.

> ⚠️ **O problema que motivou:** durante um teste manual do modo SQLite,
> uma chamada à API respondeu com sucesso e quase confirmou que a
> persistência funcionava. Mas o servidor que respondeu era **outro**,
> em memória, ainda ocupando a porta 3000 de uma execução anterior — o
> novo processo nem tinha subido. O erro só não passou porque o arquivo
> `.db` foi conferido e não existia.

Regras que a skill fixaria: matar o listener da porta **antes** de subir,
e nunca declarar que a persistência funcionou sem verificar que o arquivo
de banco foi criado.

### `verificar-dashboard` — testar a interface em browser

Abre `dashboard.html` num browser headless, popula pedidos, clica para
recolher um painel, recarrega a página e confere que o estado foi
restaurado do `localStorage`, terminando em screenshot e leitura do
console.

> ⚠️ **O problema que motivou:** os painéis recolhíveis foram validados
> apenas de forma **estática** — sintaxe do JavaScript, IDs cruzando com
> as chamadas de `togglePanel()`, presença das regras de CSS. Nenhum
> painel chegou a ser clicado automaticamente; a conferência visual foi
> feita à mão. É a única parte do projeto sem verificação automatizada.

### `checagem-pre-entrega` — validar antes de publicar

Roda a suíte, compara o total de testes com o número declarado no README,
varre os arquivos atrás de acentuação corrompida, confirma que o
`.gitignore` está barrando `node_modules`/`dist`/`*.db` e revisa o que
entraria num commit.

> ⚠️ **O problema que motivou:** dois defeitos silenciosos apareceram
> perto da entrega. Um comando PowerShell de substituição em massa gravou
> arquivos sem `-Encoding utf8` e corrompeu acentos no README e num
> arquivo de teste (`á` virou `Ã¡`, `—` virou `â€"`), exigindo reparo byte
> a byte. E a contagem de testes no README é escrita à mão — desatualiza
> sozinha a cada teste novo, sem nada acusar.

---

## Possíveis evoluções

Com mais tempo, os próximos passos seriam:

- Pathfinding completo (A* / grafo de visibilidade) para desviar de
  configurações de zonas que o desvio de um waypoint não resolve
- Zonas poligonais, além das circulares
- Reuso de drones entre viagens (hoje cada viagem cria um drone novo)
- Banco remoto (Postgres) — exige tornar o contrato dos repositórios
  assíncrono, ver [Persistência](#persistência)
- Feedback de status da entrega em tempo real (ex: WebSocket)
